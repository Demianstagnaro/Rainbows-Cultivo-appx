-- Rainbows 3.26.68: aplicación y stock en una única transacción.
-- Requiere Palestina_V32661.sql y el esquema operativo de tareas existente.
begin;
create table if not exists public.palestina_aplicaciones (
 id uuid primary key default gen_random_uuid(),
 tarea_id uuid not null references public.tareas(id) on delete restrict,
 sala_nombre text not null, tarea_nombre text not null, fecha date not null,
 receta text not null, litros numeric(14,3), observaciones text not null default '',
 actor_id uuid, actor_nombre text not null,
 empleados_nombres text[] not null default '{}',
 created_at timestamptz not null default now(),
 anulada_at timestamptz, anulada_por uuid, anulada_nombre text,
 check(litros is null or (litros>0 and litros<>'NaN'::numeric))
);
create unique index if not exists palestina_aplicacion_activa on public.palestina_aplicaciones(tarea_id) where anulada_at is null;
create table if not exists public.palestina_aplicacion_insumos (
 aplicacion_id uuid not null references public.palestina_aplicaciones(id) on delete restrict,
 insumo_id uuid not null references public.palestina_insumos(id) on delete restrict,
 nombre text not null, unidad text not null,
 cantidad numeric(14,3) not null check(cantidad>0 and cantidad<>'NaN'::numeric),
 primary key(aplicacion_id,insumo_id)
);
alter table public.palestina_aplicaciones enable row level security;
alter table public.palestina_aplicacion_insumos enable row level security;
revoke all on public.palestina_aplicaciones,public.palestina_aplicacion_insumos from public,anon,authenticated;
grant select on public.palestina_aplicaciones,public.palestina_aplicacion_insumos to authenticated;
drop policy if exists consulta on public.palestina_aplicaciones;
create policy consulta on public.palestina_aplicaciones for select to authenticated using(public.usuario_rainbows_activo());
drop policy if exists consulta on public.palestina_aplicacion_insumos;
create policy consulta on public.palestina_aplicacion_insumos for select to authenticated using(public.usuario_rainbows_activo());

create or replace function public.confirmar_aplicacion_cultivo(
 p_tarea jsonb,p_insumos jsonb,p_empleados uuid[],p_receta text,
 p_litros numeric default null,p_observaciones text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_tarea public.tareas%rowtype; v_insumo public.palestina_insumos%rowtype;
 v_id uuid; v_real uuid; v_sala text; v_actor text; v_empleados text[]; v_line record;
 v_sala_id uuid := (p_tarea->>'sala_id')::uuid;
 v_fecha date := (p_tarea->>'fecha')::date;
 v_key text := nullif(p_tarea->>'clave_externa','');
 v_task_id uuid := nullif(p_tarea->>'id','')::uuid;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para registrar aplicaciones.'; end if;
 if v_sala_id is null or v_fecha is null or nullif(btrim(p_tarea->>'nombre'),'') is null
 or nullif(btrim(p_receta),'') is null or length(p_receta)>300 or length(coalesce(p_observaciones,''))>1000 then
   raise exception 'Completá la sala, la fecha, la tarea y la receta.';
 end if;
 if p_litros is not null and (p_litros<=0 or p_litros='NaN'::numeric or p_litros>99999999999) then raise exception 'Litros inválidos.'; end if;
 if p_insumos is null or jsonb_typeof(p_insumos)<>'array' then raise exception 'Detalle de insumos inválido.'; end if;
 if jsonb_array_length(p_insumos)>100 then raise exception 'Demasiados insumos.'; end if;
 if coalesce(cardinality(p_empleados),0)=0 or exists(select 1 from unnest(p_empleados) e(id) left join public.empleados x on x.id=e.id where x.id is null or x.activo is not true) then raise exception 'Elegí empleados activos.'; end if;
 select nombre into v_sala from public.salas where id=v_sala_id;
 if v_sala is null then raise exception 'Sala inexistente.'; end if;
 -- La misma tarea automática, aun sin fila previa, comparte este bloqueo.
 perform pg_advisory_xact_lock(hashtextextended(coalesce(v_key,v_task_id::text),32668));
 if v_task_id is not null then
   select * into v_tarea from public.tareas where id=v_task_id for update;
   if not found then raise exception 'La tarea ya no existe. Recargá la app.'; end if;
 else
   if v_key is null then raise exception 'Falta la identificación de la tarea.'; end if;
   select * into v_tarea from public.tareas where clave_externa=v_key for update;
   if not found then
     insert into public.tareas(clave_externa,sala_id,fecha,nombre,detalle,tipo,estado)
     values(v_key,v_sala_id,v_fecha,p_tarea->>'nombre',coalesce(p_tarea->>'detalle',''),'rutina','pendiente') returning * into v_tarea;
   end if;
 end if;
 select id into v_id from public.palestina_aplicaciones where tarea_id=v_tarea.id and anulada_at is null;
 -- Reintento o doble confirmación: se conserva la primera aplicación, sin descontar otra vez.
 if v_id is not null then return v_id; end if;
 if v_tarea.estado in ('realizada','cancelada') or exists(select 1 from public.realizaciones_tarea where tarea_id=v_tarea.id) then raise exception 'La tarea ya fue completada o cancelada. Recargá la app.'; end if;
 if v_tarea.sala_id is distinct from v_sala_id or v_tarea.fecha is distinct from v_fecha or v_tarea.nombre is distinct from p_tarea->>'nombre' then raise exception 'La tarea cambió. Recargá la app.'; end if;
 if not (v_tarea.nombre ~* '^Enmienda( Org[aá]nica)?( [0-9]+)?$' or v_tarea.nombre='KNF' or (v_tarea.nombre='Trasplante' and v_sala in ('Vege 1','Vege 2'))) then raise exception 'La tarea no corresponde a una aplicación de cultivo.'; end if;
 if v_tarea.nombre='KNF' and p_litros is null then raise exception 'Ingresá los litros preparados.'; end if;
 if jsonb_array_length(p_insumos)=0 and nullif(btrim(p_observaciones),'') is null then raise exception 'Explicá por qué se confirma sin consumo.'; end if;
 for v_line in select * from jsonb_to_recordset(p_insumos) as x(insumo_id uuid,cantidad numeric,unidad text) loop
   if v_line.unidad is null or v_line.insumo_id is null or v_line.cantidad is null or v_line.cantidad<=0 or v_line.cantidad='NaN'::numeric or v_line.cantidad>99999999999 or v_line.cantidad<>round(v_line.cantidad,3) then raise exception 'Cantidades inválidas: usá hasta tres decimales en la unidad del stock.'; end if;
 end loop;
 -- Orden fijo y filas bloqueadas: consumos de distintas tareas tampoco pisan el stock.
 for v_line in select insumo_id,sum(cantidad) cantidad from jsonb_to_recordset(p_insumos) as x(insumo_id uuid,cantidad numeric) group by insumo_id order by insumo_id loop
   select * into v_insumo from public.palestina_insumos where id=v_line.insumo_id for update;
   if not found then raise exception 'Un insumo ya no existe.'; end if;
   if exists(select 1 from jsonb_to_recordset(p_insumos) as x(insumo_id uuid,cantidad numeric,unidad text) where x.insumo_id=v_insumo.id and x.unidad is distinct from v_insumo.unidad) then raise exception 'La unidad del insumo % cambió. Recargá el stock.',v_insumo.nombre; end if;
   if v_insumo.categoria<>'Cultivo' then raise exception 'El insumo % no pertenece a Cultivo.',v_insumo.nombre; end if;
   if v_insumo.stock<v_line.cantidad then raise exception 'Stock insuficiente de %: hay % %, se necesitan %.',v_insumo.nombre,v_insumo.stock,v_insumo.unidad,v_line.cantidad; end if;
 end loop;
 select coalesce(nullif(nombre,''),email,'Usuario') into v_actor from public.perfiles where id=auth.uid();
 select array_agg(nombre order by nombre) into v_empleados from public.empleados where id=any(p_empleados);
 insert into public.palestina_aplicaciones(tarea_id,sala_nombre,tarea_nombre,fecha,receta,litros,observaciones,actor_id,actor_nombre,empleados_nombres)
 values(v_tarea.id,v_sala,v_tarea.nombre,v_tarea.fecha,p_receta,p_litros,coalesce(p_observaciones,''),auth.uid(),coalesce(v_actor,'Usuario'),v_empleados) returning id into v_id;
 for v_line in select insumo_id,sum(cantidad) cantidad from jsonb_to_recordset(p_insumos) as x(insumo_id uuid,cantidad numeric) group by insumo_id order by insumo_id loop
   select * into v_insumo from public.palestina_insumos where id=v_line.insumo_id;
   insert into public.palestina_aplicacion_insumos values(v_id,v_insumo.id,v_insumo.nombre,v_insumo.unidad,v_line.cantidad);
   update public.palestina_insumos set stock=stock-v_line.cantidad where id=v_insumo.id;
 end loop;
 update public.tareas set estado='realizada' where id=v_tarea.id;
 insert into public.realizaciones_tarea(tarea_id,realizada_at,registrada_por) values(v_tarea.id,now(),auth.uid()) returning id into v_real;
 insert into public.realizacion_empleados(realizacion_id,empleado_id) select v_real,id from (select distinct unnest(p_empleados) id) x;
 return v_id;
end; $$;

create or replace function public.anular_aplicacion_cultivo(p_tarea_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_app public.palestina_aplicaciones%rowtype; v_tarea public.tareas%rowtype; v_line record; v_actor text;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para anular aplicaciones.'; end if;
 select * into v_tarea from public.tareas where id=p_tarea_id for update;
 if not found then raise exception 'La tarea ya no existe.'; end if;
 select * into v_app from public.palestina_aplicaciones where tarea_id=p_tarea_id and anulada_at is null for update;
 if found then
   -- Marcar anulada antes de tocar la realización; todo revierte si falla cualquier paso.
   select coalesce(nullif(nombre,''),email,'Usuario') into v_actor from public.perfiles where id=auth.uid();
   update public.palestina_aplicaciones set anulada_at=now(),anulada_por=auth.uid(),anulada_nombre=coalesce(v_actor,'Usuario') where id=v_app.id;
   for v_line in select * from public.palestina_aplicacion_insumos where aplicacion_id=v_app.id order by insumo_id loop
     perform 1 from public.palestina_insumos where id=v_line.insumo_id for update;
     update public.palestina_insumos set stock=stock+v_line.cantidad where id=v_line.insumo_id;
   end loop;
 end if;
 -- Las tareas antiguas sin consumo registrado se desmarcan sin devolver insumos.
 delete from public.realizacion_empleados where realizacion_id in (select id from public.realizaciones_tarea where tarea_id=p_tarea_id);
 delete from public.realizaciones_tarea where tarea_id=p_tarea_id;
 update public.tareas set estado='pendiente' where id=p_tarea_id;
end; $$;

-- No permitir borrar o desmarcar una aplicación activa saltando la reversión.
create or replace function public.proteger_aplicacion_cultivo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='realizaciones_tarea' then
   if exists(select 1 from public.palestina_aplicaciones where tarea_id=old.tarea_id and anulada_at is null) then raise exception 'Primero anulá la aplicación para devolver sus insumos al stock.'; end if;
 elsif exists(select 1 from public.palestina_aplicaciones where tarea_id=old.id and anulada_at is null) then
   if tg_op='DELETE' then raise exception 'Primero anulá la aplicación para devolver sus insumos al stock.'; end if;
   if new.estado is distinct from 'realizada' or new.sala_id is distinct from old.sala_id or new.fecha is distinct from old.fecha or new.nombre is distinct from old.nombre or new.clave_externa is distinct from old.clave_externa then raise exception 'Anulá la aplicación antes de modificar esta tarea.'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
drop trigger if exists proteger_aplicacion on public.tareas;
create trigger proteger_aplicacion before update or delete on public.tareas for each row execute function public.proteger_aplicacion_cultivo();
drop trigger if exists proteger_aplicacion on public.realizaciones_tarea;
create trigger proteger_aplicacion before delete on public.realizaciones_tarea for each row execute function public.proteger_aplicacion_cultivo();
-- La unidad define la interpretación histórica del consumo y no puede cambiarse.
create or replace function public.proteger_unidad_insumo_cultivo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.unidad is distinct from old.unidad and exists(select 1 from public.palestina_aplicacion_insumos where insumo_id=old.id) then raise exception 'Este insumo tiene aplicaciones registradas. Conservá su unidad para mantener el historial y las devoluciones.'; end if;
 return new;
end; $$;
drop trigger if exists proteger_unidad_consumida on public.palestina_insumos;
create trigger proteger_unidad_consumida before update on public.palestina_insumos for each row execute function public.proteger_unidad_insumo_cultivo();
revoke all on function public.confirmar_aplicacion_cultivo(jsonb,jsonb,uuid[],text,numeric,text),public.anular_aplicacion_cultivo(uuid),public.proteger_aplicacion_cultivo(),public.proteger_unidad_insumo_cultivo() from public,anon,authenticated;
grant execute on function public.confirmar_aplicacion_cultivo(jsonb,jsonb,uuid[],text,numeric,text),public.anular_aplicacion_cultivo(uuid) to authenticated;
commit;
