-- Rainbows 3.26.69. Madres, períodos de ocupación y vaciado seguro de croquis.
-- Ejecutar completo en Supabase. No vacía ni modifica las plantas existentes.
begin;
create table if not exists public.palestina_madres (
 genetica_id uuid primary key references public.geneticas(id),
 created_at timestamptz not null default now()
);
create table if not exists public.palestina_sala_periodos (
 id uuid primary key default gen_random_uuid(),
 sala text not null check(sala in ('Flora 1','Flora 2','Flora 3','Vege 1','Vege 2','Esquejes','Madres')),
 fecha_ingreso date, fecha_vaciado date,
 detalle jsonb not null default '[]',
 motivo text, observaciones text not null default '',
 creado_at timestamptz not null default now(), creado_por uuid,
 cerrado_at timestamptz, cerrado_por uuid, cerrado_nombre text,
 check(fecha_ingreso is null or fecha_vaciado is null or fecha_vaciado>=fecha_ingreso)
);
create unique index if not exists palestina_sala_periodo_abierto on public.palestina_sala_periodos(sala) where fecha_vaciado is null;
alter table public.palestina_madres enable row level security;
alter table public.palestina_sala_periodos enable row level security;
revoke all on public.palestina_madres,public.palestina_sala_periodos from public,anon,authenticated;
grant select on public.palestina_madres,public.palestina_sala_periodos to authenticated;
drop policy if exists consulta on public.palestina_madres;
create policy consulta on public.palestina_madres for select to authenticated using(public.usuario_rainbows_activo());
drop policy if exists consulta on public.palestina_sala_periodos;
create policy consulta on public.palestina_sala_periodos for select to authenticated using(public.usuario_rainbows_activo());

-- Un mismo bloqueo antes de cada sentencia evita cruces entre ediciones y vaciados.
create or replace function public.bloquear_croquis_salas()
returns void language sql security definer set search_path='' as $$
 select pg_advisory_xact_lock(32669,1);
$$;
create or replace function public.bloquear_escritura_croquis()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.bloquear_croquis_salas(); return null; end; $$;

create or replace function public.contenido_croquis_sala(p_sala text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 if p_sala in ('Flora 1','Flora 2','Flora 3') then
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'cama',c.numero,'posicion',p.posicion,'genetica_id',p.genetica_id,'genetica',coalesce(g.nombre,'Sin genética'),'codigo',g.nomenclatura,'cantidad',1,'datos',to_jsonb(p)) order by c.numero,p.posicion,p.id),'[]') into v
   from public.plantas p join public.camas c on c.id=p.cama_id join public.salas s on s.id=c.sala_id left join public.geneticas g on g.id=p.genetica_id where s.nombre=p_sala and p.ocupada is true;
 elsif p_sala in ('Vege 1','Vege 2','Esquejes') then
   select coalesce(jsonb_agg(jsonb_build_object('bandeja',p.bandeja,'posicion',p.posicion,'genetica_id',p.genetica_id,'genetica',g.nombre,'codigo',g.nomenclatura,'cantidad',p.cantidad,'datos',to_jsonb(p)) order by p.bandeja,p.posicion),'[]') into v
   from public.palestina_semillero p left join public.geneticas g on g.id=p.genetica_id where p.sala=p_sala;
 elsif p_sala='Madres' then
   select coalesce(jsonb_agg(jsonb_build_object('genetica_id',p.genetica_id,'genetica',g.nombre,'codigo',g.nomenclatura,'cantidad',1) order by g.nombre,p.genetica_id),'[]') into v
   from public.palestina_madres p join public.geneticas g on g.id=p.genetica_id;
 else raise exception 'Sala de croquis inválida.';
 end if;
 return v;
end; $$;

create or replace function public.sincronizar_periodos_croquis(p_inicial boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare v_sala text; v_detalle jsonb; v_actor text;
 v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 perform public.bloquear_croquis_salas();
 select coalesce(nullif(nombre,''),email,'Usuario') into v_actor from public.perfiles where id=auth.uid();
 foreach v_sala in array array['Flora 1','Flora 2','Flora 3','Vege 1','Vege 2','Esquejes','Madres'] loop
   v_detalle:=public.contenido_croquis_sala(v_sala);
   if jsonb_array_length(v_detalle)>0 then
     insert into public.palestina_sala_periodos(sala,fecha_ingreso,detalle,creado_por)
     values(v_sala,case when p_inicial then null else v_hoy end,v_detalle,auth.uid())
     on conflict(sala) where fecha_vaciado is null do update set detalle=excluded.detalle;
   elsif not p_inicial then
     update public.palestina_sala_periodos set fecha_vaciado=v_hoy,cerrado_at=now(),cerrado_por=auth.uid(),cerrado_nombre=coalesce(v_actor,'Usuario'),motivo='Vaciado manual'
     where sala=v_sala and fecha_vaciado is null;
   end if;
 end loop;
end; $$;
create or replace function public.actualizar_periodos_croquis()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.sincronizar_periodos_croquis(false); return null; end; $$;

drop trigger if exists bloquear_croquis on public.plantas;
create trigger bloquear_croquis before insert or update or delete on public.plantas for each statement execute function public.bloquear_escritura_croquis();
drop trigger if exists bloquear_croquis on public.camas;
create trigger bloquear_croquis before insert or update or delete on public.camas for each statement execute function public.bloquear_escritura_croquis();
drop trigger if exists bloquear_croquis on public.palestina_semillero;
create trigger bloquear_croquis before insert or update or delete on public.palestina_semillero for each statement execute function public.bloquear_escritura_croquis();
drop trigger if exists bloquear_croquis on public.palestina_madres;
create trigger bloquear_croquis before insert or update or delete on public.palestina_madres for each statement execute function public.bloquear_escritura_croquis();
drop trigger if exists actualizar_periodo on public.plantas;
create trigger actualizar_periodo after insert or update or delete on public.plantas for each statement execute function public.actualizar_periodos_croquis();
drop trigger if exists actualizar_periodo on public.palestina_semillero;
create trigger actualizar_periodo after insert or update or delete on public.palestina_semillero for each statement execute function public.actualizar_periodos_croquis();
drop trigger if exists actualizar_periodo on public.palestina_madres;
create trigger actualizar_periodo after insert or update or delete on public.palestina_madres for each statement execute function public.actualizar_periodos_croquis();

create or replace function public.estado_croquis_sala(p_sala text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_detalle jsonb; v_periodo public.palestina_sala_periodos%rowtype;
begin
 if not public.usuario_rainbows_activo() then raise exception 'Sin permisos de consulta.'; end if;
 perform public.bloquear_croquis_salas();
 v_detalle:=public.contenido_croquis_sala(p_sala);
 select * into v_periodo from public.palestina_sala_periodos where sala=p_sala and fecha_vaciado is null;
 return jsonb_build_object('periodo',case when v_periodo.id is null then null else to_jsonb(v_periodo) end,'detalle',v_detalle,'firma',md5(v_detalle::text));
end; $$;

create or replace function public.guardar_madre_croquis(p_genetica_id uuid,p_presente boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para modificar Madres.'; end if;
 perform public.bloquear_croquis_salas();
 if p_presente is true then
   if not exists(select 1 from public.geneticas where id=p_genetica_id and activa is true) then raise exception 'Elegí una genética activa.'; end if;
   insert into public.palestina_madres(genetica_id) values(p_genetica_id) on conflict do nothing;
 else delete from public.palestina_madres where genetica_id=p_genetica_id;
 end if;
end; $$;

create or replace function public.fecha_ingreso_croquis(p_sala text,p_periodo_id uuid,p_fecha date)
returns void language plpgsql security definer set search_path='' as $$
declare v_periodo public.palestina_sala_periodos%rowtype;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para modificar fechas.'; end if;
 perform public.bloquear_croquis_salas();
 if p_fecha is null or p_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Ingresá una fecha válida, hasta hoy.'; end if;
 select * into v_periodo from public.palestina_sala_periodos where id=p_periodo_id and sala=p_sala and fecha_vaciado is null for update;
 if not found then raise exception 'La ocupación de la sala cambió. Volvé a abrirla.'; end if;
 if exists(select 1 from public.palestina_sala_periodos where sala=p_sala and fecha_vaciado>p_fecha) then raise exception 'La fecha se superpone con un período anterior.'; end if;
 update public.palestina_sala_periodos set fecha_ingreso=p_fecha where id=p_periodo_id;
end; $$;

create or replace function public.vaciar_sala_croquis(p_sala text,p_periodo_id uuid,p_firma text,p_fecha date,p_motivo text,p_observaciones text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_periodo public.palestina_sala_periodos%rowtype; v_detalle jsonb; v_actor text; v_set text;
 v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para vaciar salas.'; end if;
 perform public.bloquear_croquis_salas();
 v_detalle:=public.contenido_croquis_sala(p_sala);
 select * into v_periodo from public.palestina_sala_periodos where id=p_periodo_id and sala=p_sala for update;
 if not found then raise exception 'La ocupación de la sala cambió. Volvé a abrirla.'; end if;
 if v_periodo.fecha_vaciado is not null then
   if jsonb_array_length(v_detalle)=0 then return v_periodo.id; end if;
   raise exception 'La sala se volvió a cargar. Volvé a abrirla para revisar el contenido actual.';
 end if;
 if p_firma is distinct from md5(v_detalle::text) then raise exception 'El contenido cambió desde que abriste la ventana. Volvé a revisar la sala.'; end if;
 if p_fecha is null or p_fecha>v_hoy or p_fecha<coalesce(v_periodo.fecha_ingreso,p_fecha) then raise exception 'La fecha de vaciado debe estar entre el ingreso y hoy.'; end if;
 if p_motivo not in ('Cosecha','Traslado','Otro') or p_motivo is null or length(coalesce(p_observaciones,''))>1000 then raise exception 'Elegí el motivo e ingresá hasta 1000 caracteres de observaciones.'; end if;
 if p_sala in ('Flora 1','Flora 2','Flora 3') then
   v_set:='ocupada=false,genetica_id=null';
   if exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantas' and column_name='observaciones') then v_set:=v_set||',observaciones='''' '; end if;
   if exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantas' and column_name='notas') then v_set:=v_set||',notas='''' '; end if;
   execute 'update public.plantas p set '||v_set||' from public.camas c join public.salas s on s.id=c.sala_id where p.cama_id=c.id and s.nombre=$1' using p_sala;
 elsif p_sala='Madres' then delete from public.palestina_madres;
 else delete from public.palestina_semillero where sala=p_sala;
 end if;
 select coalesce(nullif(nombre,''),email,'Usuario') into v_actor from public.perfiles where id=auth.uid();
 update public.palestina_sala_periodos set fecha_vaciado=p_fecha,detalle=v_detalle,motivo=p_motivo,observaciones=coalesce(p_observaciones,''),cerrado_at=now(),cerrado_por=auth.uid(),cerrado_nombre=coalesce(v_actor,'Usuario') where id=v_periodo.id;
 return v_periodo.id;
end; $$;

create or replace function public.completar_pileta_croquis(p_planta_id uuid,p_genetica_id uuid,p_observaciones text default '')
returns integer language plpgsql security definer set search_path='' as $$
declare v_planta public.plantas%rowtype; v_capacidad integer; v_n integer;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para completar piletas.'; end if;
 perform public.bloquear_croquis_salas();
 select * into v_planta from public.plantas where id=p_planta_id;
 if not found or v_planta.habilitada is not true then raise exception 'La maceta ya no está habilitada.'; end if;
 select c.capacidad into v_capacidad from public.camas c join public.salas s on s.id=c.sala_id where c.id=v_planta.cama_id and s.nombre in ('Flora 1','Flora 2','Flora 3');
 if v_capacidad is null or v_planta.posicion>v_capacidad then raise exception 'Pileta o posición inválida.'; end if;
 if not exists(select 1 from public.geneticas where id=p_genetica_id and activa is true) then raise exception 'Elegí una genética activa.'; end if;
 update public.plantas set ocupada=true,genetica_id=p_genetica_id
 where cama_id=v_planta.cama_id and habilitada is true and posicion<=v_capacidad and (ocupada is not true or id=p_planta_id);
 get diagnostics v_n=row_count;
 if length(coalesce(p_observaciones,''))>1000 then raise exception 'Ingresá hasta 1000 caracteres de observaciones.'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantas' and column_name='observaciones') then execute 'update public.plantas set observaciones=$1 where id=$2' using coalesce(p_observaciones,''),p_planta_id;
 elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name='plantas' and column_name='notas') then execute 'update public.plantas set notas=$1 where id=$2' using coalesce(p_observaciones,''),p_planta_id; end if;
 return v_n;
end; $$;

-- Salas ya ocupadas: conservamos su contenido sin inventar una fecha de ingreso.
select public.sincronizar_periodos_croquis(true);
revoke all on function public.bloquear_croquis_salas(),public.bloquear_escritura_croquis(),public.contenido_croquis_sala(text),public.sincronizar_periodos_croquis(boolean),public.actualizar_periodos_croquis(),public.estado_croquis_sala(text),public.guardar_madre_croquis(uuid,boolean),public.fecha_ingreso_croquis(text,uuid,date),public.vaciar_sala_croquis(text,uuid,text,date,text,text),public.completar_pileta_croquis(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.estado_croquis_sala(text),public.guardar_madre_croquis(uuid,boolean),public.fecha_ingreso_croquis(text,uuid,date),public.vaciar_sala_croquis(text,uuid,text,date,text,text),public.completar_pileta_croquis(uuid,uuid,text) to authenticated;
commit;
