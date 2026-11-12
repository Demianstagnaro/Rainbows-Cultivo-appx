-- Rainbows 3.26.73 — Administración y Caja de Palestina.
-- Ejecutar completo en Supabase. Requiere los roles de V3.26.57.
-- Crea una caja vacía; el archivo de referencia no se importa como movimientos.
begin;
create table if not exists public.palestina_caja_apertura (
 id uuid primary key default gen_random_uuid(), unica boolean not null default true unique check(unica),
 fecha date not null, monto numeric(14,2) not null check(monto>=0 and monto<>'NaN'::numeric),
 version integer not null default 1, actualizado_por uuid, actualizado_nombre text, actualizado_at timestamptz not null default now()
);
create table if not exists public.palestina_caja_categorias (
 id uuid primary key default gen_random_uuid(),nombre text not null unique,
 tipo text not null check(tipo in ('ingreso','egreso')),orden integer not null default 0
);
create table if not exists public.palestina_caja_articulos (
 id uuid primary key default gen_random_uuid(),nombre text not null check(length(btrim(nombre)) between 1 and 180),activo boolean not null default true
);
create unique index if not exists palestina_caja_articulo_nombre on public.palestina_caja_articulos(lower(btrim(nombre)));
create table if not exists public.palestina_caja_movimientos (
 id uuid primary key default gen_random_uuid(),solicitud_id uuid not null unique,
 fecha date not null,tipo text not null check(tipo in ('ingreso','egreso')),
 medio text not null check(medio in ('efectivo','transferencia')),
 articulo_id uuid not null references public.palestina_caja_articulos(id),articulo text not null,
 cantidad numeric(12,3) not null check(cantidad>0 and cantidad<>'NaN'::numeric),
 monto numeric(14,2) not null check(monto>0 and monto<>'NaN'::numeric),
 categoria_id uuid not null references public.palestina_caja_categorias(id),notas text not null default '',
 version integer not null default 1,creado_por uuid,creado_nombre text,creado_at timestamptz not null default now(),
 actualizado_por uuid,actualizado_nombre text,actualizado_at timestamptz not null default now(),
 anulado_at timestamptz,anulado_por uuid,anulado_nombre text,motivo_anulacion text
);
create index if not exists palestina_caja_movimientos_fecha on public.palestina_caja_movimientos(fecha,id);
create table if not exists public.palestina_caja_auditoria (
 id uuid primary key default gen_random_uuid(),entidad text not null check(entidad in ('apertura','movimiento')),
 entidad_id uuid not null,accion text not null,antes jsonb,despues jsonb,motivo text,
 usuario_id uuid,usuario_nombre text,fecha timestamptz not null default now()
);
create index if not exists palestina_caja_auditoria_entidad on public.palestina_caja_auditoria(entidad_id,fecha);

alter table public.palestina_caja_apertura enable row level security;
alter table public.palestina_caja_categorias enable row level security;
alter table public.palestina_caja_articulos enable row level security;
alter table public.palestina_caja_movimientos enable row level security;
alter table public.palestina_caja_auditoria enable row level security;
revoke all on public.palestina_caja_apertura,public.palestina_caja_categorias,public.palestina_caja_articulos,public.palestina_caja_movimientos,public.palestina_caja_auditoria from public,anon,authenticated;
grant select on public.palestina_caja_apertura,public.palestina_caja_categorias,public.palestina_caja_articulos,public.palestina_caja_movimientos,public.palestina_caja_auditoria to authenticated;
do $$ declare t text; begin
 foreach t in array array['palestina_caja_apertura','palestina_caja_categorias','palestina_caja_articulos','palestina_caja_movimientos','palestina_caja_auditoria'] loop
  execute format('drop policy if exists consulta_gestion on public.%I',t);
  execute format('create policy consulta_gestion on public.%I for select to authenticated using(public.usuario_rainbows_palestina_gestion())',t);
 end loop;
end; $$;
insert into public.palestina_caja_categorias(nombre,tipo,orden) values
 ('Inversión','egreso',1),('Producción','egreso',2),('Reparación y mantenimiento','egreso',3),
 ('Personal','egreso',4),('Servicio de limpieza','egreso',5),('Insumos de limpieza','egreso',6),
 ('Insumos de oficina','egreso',7),('Sueldo de producción','egreso',8),('Sueldo Cosecha','egreso',9),
 ('Ingreso de efectivo','ingreso',10),('Ingreso por transferencia','ingreso',11)
 on conflict(nombre) do nothing;

create or replace function public.bloquear_caja_palestina()
returns void language sql security definer set search_path='' as $$ select pg_advisory_xact_lock(32673,1); $$;
create or replace function public.actor_caja_palestina()
returns text language sql stable security definer set search_path='' as $$
 select coalesce((select coalesce(nullif(nombre,''),email) from public.perfiles where id=auth.uid()),'Usuario');
$$;

create or replace function public.consultar_caja_palestina(p_mes date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inicio date;v_fin date;v_apertura public.palestina_caja_apertura%rowtype;v_inicial numeric:=0;v_rows jsonb;v_cats jsonb;v_articulos jsonb;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para Administración de Palestina.'; end if;
 if p_mes is null or p_mes<date '1900-01-01' or p_mes>date '2200-12-31' then raise exception 'Elegí un mes válido.'; end if;
 perform public.bloquear_caja_palestina();
 v_inicio:=date_trunc('month',p_mes)::date;v_fin:=(v_inicio+interval '1 month')::date;
 select * into v_apertura from public.palestina_caja_apertura where unica;
 if v_apertura.id is not null and v_apertura.fecha<v_fin then
  select v_apertura.monto+coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) into v_inicial
  from public.palestina_caja_movimientos where medio='efectivo' and anulado_at is null and fecha<v_inicio;
 end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.fecha desc,m.creado_at desc,m.id),'[]') into v_rows
 from public.palestina_caja_movimientos m where fecha>=v_inicio and fecha<v_fin;
 select coalesce(jsonb_agg(to_jsonb(c) order by orden,nombre),'[]') into v_cats from public.palestina_caja_categorias c;
 select coalesce(jsonb_agg(to_jsonb(a) order by nombre),'[]') into v_articulos from public.palestina_caja_articulos a where activo;
 return jsonb_build_object('apertura',case when v_apertura.id is null then null else to_jsonb(v_apertura) end,'saldo_inicial',v_inicial,'movimientos',v_rows,'categorias',v_cats,'articulos',v_articulos);
end; $$;

create or replace function public.guardar_apertura_caja_palestina(p_fecha date,p_monto numeric,p_version integer,p_motivo text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare old public.palestina_caja_apertura%rowtype;new public.palestina_caja_apertura%rowtype;v_nombre text;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para modificar la apertura.'; end if;
 perform public.bloquear_caja_palestina();
 if p_fecha is null or p_fecha<date '1900-01-01' or p_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Ingresá una fecha de inicio válida, hasta hoy.'; end if;
 if p_monto is null or p_monto<0 or p_monto::text in ('NaN','Infinity','-Infinity') or p_monto<>round(p_monto,2) or p_monto>999999999999.99 then raise exception 'Ingresá un saldo inicial válido, con hasta dos decimales.'; end if;
 if length(coalesce(p_motivo,''))>1000 then raise exception 'El motivo admite hasta 1000 caracteres.'; end if;
 if exists(select 1 from public.palestina_caja_movimientos where fecha<p_fecha) then raise exception 'La apertura debe ser anterior o igual al primer movimiento registrado.'; end if;
 select * into old from public.palestina_caja_apertura where unica for update;
 if coalesce(old.version,0) is distinct from p_version then raise exception 'La apertura cambió. Actualizá la pantalla.'; end if;
 if old.id is not null and length(btrim(coalesce(p_motivo,'')))<3 then raise exception 'Indicá el motivo de la corrección del saldo de partida.'; end if;
 v_nombre:=public.actor_caja_palestina();
 if old.id is null then
  insert into public.palestina_caja_apertura(fecha,monto,actualizado_por,actualizado_nombre) values(p_fecha,p_monto,auth.uid(),v_nombre) returning * into new;
 else
  update public.palestina_caja_apertura set fecha=p_fecha,monto=p_monto,version=version+1,actualizado_por=auth.uid(),actualizado_nombre=v_nombre,actualizado_at=now() where id=old.id returning * into new;
 end if;
 insert into public.palestina_caja_auditoria(entidad,entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values('apertura',new.id,case when old.id is null then 'alta' else 'correccion' end,case when old.id is null then null else to_jsonb(old) end,to_jsonb(new),p_motivo,auth.uid(),v_nombre);
 return new.id;
end; $$;

create or replace function public.guardar_movimiento_caja_palestina(
 p_id uuid,p_version integer,p_solicitud uuid,p_fecha date,p_tipo text,p_medio text,p_articulo text,
 p_cantidad numeric,p_monto numeric,p_categoria_id uuid,p_notas text default '',p_motivo text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.palestina_caja_movimientos%rowtype;new public.palestina_caja_movimientos%rowtype;
 v_articulo uuid;v_nombre text;v_texto text;v_apertura date;v_categoria public.palestina_caja_categorias%rowtype;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para registrar movimientos.'; end if;
 perform public.bloquear_caja_palestina();
 if p_id is null and p_solicitud is not null then
  select * into new from public.palestina_caja_movimientos where solicitud_id=p_solicitud;
  if found then return new.id; end if;
 end if;
 select fecha into v_apertura from public.palestina_caja_apertura where unica;
 if v_apertura is null then raise exception 'Registrá primero el saldo inicial de efectivo, aunque sea cero.'; end if;
 if p_fecha is null or p_fecha<v_apertura or p_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha debe estar entre la apertura de esta caja y hoy.'; end if;
 if p_tipo is null or p_tipo not in ('ingreso','egreso') or p_medio is null or p_medio not in ('efectivo','transferencia') then raise exception 'Elegí movimiento y forma de pago.'; end if;
 v_texto:=regexp_replace(btrim(coalesce(p_articulo,'')),'[[:space:]]+',' ','g');
 if length(v_texto) not between 1 and 180 or length(coalesce(p_notas,''))>1000 or length(coalesce(p_motivo,''))>1000 then raise exception 'Completá el artículo (hasta 180 caracteres) y notas o motivo de hasta 1000 caracteres.'; end if;
 if p_cantidad is null or p_cantidad<=0 or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<>round(p_cantidad,3) or p_cantidad>999999999 then raise exception 'La cantidad debe ser positiva, con hasta tres decimales.'; end if;
 if p_monto is null or p_monto<=0 or p_monto::text in ('NaN','Infinity','-Infinity') or p_monto<>round(p_monto,2) or p_monto>999999999999.99 then raise exception 'El costo total debe ser positivo, con hasta dos decimales.'; end if;
 select * into v_categoria from public.palestina_caja_categorias where id=p_categoria_id;
 if not found or v_categoria.tipo<>p_tipo then raise exception 'La categoría no corresponde al movimiento.'; end if;
 if p_tipo='ingreso' and v_categoria.nombre is distinct from (case when p_medio='efectivo' then 'Ingreso de efectivo' else 'Ingreso por transferencia' end) then raise exception 'Elegí la categoría de ingreso del medio de pago indicado.'; end if;
 if p_id is not null then
  select * into old from public.palestina_caja_movimientos where id=p_id for update;
  if not found or old.anulado_at is not null then raise exception 'El movimiento ya no está vigente.'; end if;
  if old.version is distinct from p_version then raise exception 'Otra persona modificó el movimiento. Actualizá antes de corregirlo.'; end if;
  if length(btrim(coalesce(p_motivo,'')))<3 then raise exception 'Indicá el motivo de la corrección.'; end if;
 elsif p_solicitud is null then raise exception 'Falta la identificación de la carga. Volvé a abrir el formulario.';
 end if;
 v_nombre:=public.actor_caja_palestina();
 insert into public.palestina_caja_articulos(nombre) values(v_texto)
 on conflict(lower(btrim(nombre))) do update set activo=true returning id into v_articulo;
 if p_id is null then
  insert into public.palestina_caja_movimientos(solicitud_id,fecha,tipo,medio,articulo_id,articulo,cantidad,monto,categoria_id,notas,creado_por,creado_nombre,actualizado_por,actualizado_nombre)
  values(p_solicitud,p_fecha,p_tipo,p_medio,v_articulo,v_texto,p_cantidad,p_monto,p_categoria_id,coalesce(p_notas,''),auth.uid(),v_nombre,auth.uid(),v_nombre) returning * into new;
 else
  update public.palestina_caja_movimientos set fecha=p_fecha,tipo=p_tipo,medio=p_medio,articulo_id=v_articulo,articulo=v_texto,cantidad=p_cantidad,monto=p_monto,categoria_id=p_categoria_id,notas=coalesce(p_notas,''),version=version+1,actualizado_por=auth.uid(),actualizado_nombre=v_nombre,actualizado_at=now() where id=p_id returning * into new;
 end if;
 insert into public.palestina_caja_auditoria(entidad,entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values('movimiento',new.id,case when p_id is null then 'alta' else 'correccion' end,case when p_id is null then null else to_jsonb(old) end,to_jsonb(new),p_motivo,auth.uid(),v_nombre);
 return new.id;
end; $$;

create or replace function public.anular_movimiento_caja_palestina(p_id uuid,p_version integer,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare old public.palestina_caja_movimientos%rowtype;new public.palestina_caja_movimientos%rowtype;v_nombre text;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para anular movimientos.'; end if;
 perform public.bloquear_caja_palestina();
 select * into old from public.palestina_caja_movimientos where id=p_id for update;
 if not found then raise exception 'No se encontró el movimiento.'; end if;
 if old.anulado_at is not null then return; end if;
 if old.version is distinct from p_version then raise exception 'El movimiento cambió. Actualizá la pantalla.'; end if;
 if length(btrim(coalesce(p_motivo,'')))<3 or length(p_motivo)>1000 then raise exception 'Indicá un motivo de 3 a 1000 caracteres.'; end if;
 v_nombre:=public.actor_caja_palestina();
 update public.palestina_caja_movimientos set anulado_at=now(),anulado_por=auth.uid(),anulado_nombre=v_nombre,motivo_anulacion=p_motivo,version=version+1 where id=p_id returning * into new;
 insert into public.palestina_caja_auditoria(entidad,entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values('movimiento',p_id,'anulacion',to_jsonb(old),to_jsonb(new),p_motivo,auth.uid(),v_nombre);
end; $$;
revoke all on function public.bloquear_caja_palestina(),public.actor_caja_palestina(),public.consultar_caja_palestina(date),public.guardar_apertura_caja_palestina(date,numeric,integer,text),public.guardar_movimiento_caja_palestina(uuid,integer,uuid,date,text,text,text,numeric,numeric,uuid,text,text),public.anular_movimiento_caja_palestina(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.consultar_caja_palestina(date),public.guardar_apertura_caja_palestina(date,numeric,integer,text),public.guardar_movimiento_caja_palestina(uuid,integer,uuid,date,text,text,text,numeric,numeric,uuid,text,text),public.anular_movimiento_caja_palestina(uuid,integer,text) to authenticated;

notify pgrst, 'reload schema';
commit;
