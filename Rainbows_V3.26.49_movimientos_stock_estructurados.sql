-- Rainbows V3.26.49
-- Clasifica y relaciona todos los movimientos de stock de Medrano.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.48.

begin;

alter table public.medrano_stock_historial
  add column if not exists tipo_movimiento text,
  add column if not exists cantidad_movida numeric,
  add column if not exists origen text,
  add column if not exists destino text,
  add column if not exists paciente_id uuid,
  add column if not exists paciente_nombre text;

alter table public.medrano_stock_historial
  drop constraint if exists medrano_stock_historial_tipo_movimiento_check;

create or replace function public.normalizar_movimiento_stock_medrano()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_delta numeric:=coalesce(new.cantidad_nueva,0)-coalesce(new.cantidad_anterior,0);
  v_tipo_operacion text:=nullif(btrim(coalesce(new.operacion_tipo,'')),'');
  v_accion text:=lower(coalesce(new.accion,''));
  v_traslado_cantidad numeric;
  v_paciente_id uuid;
  v_paciente_nombre text;
begin
  if v_tipo_operacion is null and new.operacion_id is not null then
    select o.tipo into v_tipo_operacion
    from public.medrano_operaciones o
    where o.id=new.operacion_id;
    new.operacion_tipo:=coalesce(new.operacion_tipo,v_tipo_operacion);
  end if;

  new.tipo_movimiento:=case
    when v_tipo_operacion='dispensa' or v_accion like 'dispensa a paciente%'
      then 'dispensa'
    when v_tipo_operacion='produccion' and v_delta<0
      then 'produccion_consumo'
    when v_tipo_operacion='produccion'
      then 'produccion_resultado'
    when v_tipo_operacion='traslado'
         and (v_accion like '%recepci%' or v_accion like '%recibid%' or (new.sector='laboratorio' and v_delta>=0))
      then 'traslado_recepcion'
    when v_tipo_operacion='traslado'
      then 'traslado_salida'
    when v_tipo_operacion='ajuste' or v_accion like 'control físico%'
      then 'control_fisico'
    when v_accion like '%retirado de la lista%'
      then 'baja'
    when v_accion like '%reactivado%'
      then 'reactivacion'
    when v_accion like 'ingreso%' or (coalesce(new.cantidad_anterior,0)=0 and v_delta>0)
      then 'ingreso'
    else 'correccion'
  end;

  new.cantidad_movida:=abs(v_delta);
  if new.tipo_movimiento in ('traslado_salida','traslado_recepcion') and new.referencia_id is not null then
    select t.gramos into v_traslado_cantidad
    from public.medrano_traslados_laboratorio t
    where t.id=new.referencia_id;
    new.cantidad_movida:=coalesce(v_traslado_cantidad,new.cantidad_movida);
  end if;

  if new.tipo_movimiento='dispensa' and new.referencia_id is not null then
    select c.paciente_id,c.paciente_nombre
      into v_paciente_id,v_paciente_nombre
    from public.medrano_comandas_multiproducto c
    where c.id=new.referencia_id;
    new.paciente_id:=v_paciente_id;
    new.paciente_nombre:=v_paciente_nombre;
  end if;

  if new.tipo_movimiento='dispensa' then
    new.origen:=coalesce(nullif(new.origen,''),initcap(new.sector));
    new.destino:=coalesce(nullif(new.destino,''),
      case when nullif(btrim(coalesce(new.paciente_nombre,'')),'') is not null
           then 'Paciente · '||new.paciente_nombre else 'Paciente' end);
  elsif new.tipo_movimiento='traslado_salida' then
    new.origen:=coalesce(nullif(new.origen,''),'Dispensario');
    new.destino:=coalesce(nullif(new.destino,''),'Laboratorio');
  elsif new.tipo_movimiento='traslado_recepcion' then
    new.origen:=coalesce(nullif(new.origen,''),'Dispensario');
    new.destino:=coalesce(nullif(new.destino,''),'Laboratorio');
  elsif new.tipo_movimiento in ('produccion_consumo','produccion_resultado') then
    new.origen:=coalesce(nullif(new.origen,''),'Laboratorio');
    new.destino:=coalesce(nullif(new.destino,''),'Producción de Laboratorio');
  elsif new.tipo_movimiento='ingreso' then
    new.origen:=coalesce(nullif(new.origen,''),'Ingreso externo');
    new.destino:=coalesce(nullif(new.destino,''),initcap(new.sector));
  else
    new.origen:=coalesce(nullif(new.origen,''),initcap(new.sector));
    new.destino:=coalesce(nullif(new.destino,''),initcap(new.sector));
  end if;

  return new;
end;
$$;

drop trigger if exists normalizar_movimiento_stock_medrano on public.medrano_stock_historial;
create trigger normalizar_movimiento_stock_medrano
before insert or update of accion,cantidad_anterior,cantidad_nueva,operacion_id,operacion_tipo,referencia_id
on public.medrano_stock_historial
for each row execute function public.normalizar_movimiento_stock_medrano();

-- La actualización activa el normalizador para el historial existente sin
-- alterar cantidades ni fechas. Solo completa la nueva clasificación.
update public.medrano_stock_historial
set accion=accion;

alter table public.medrano_stock_historial
  alter column tipo_movimiento set default 'correccion',
  alter column tipo_movimiento set not null,
  alter column cantidad_movida set default 0,
  alter column cantidad_movida set not null;

alter table public.medrano_stock_historial
  add constraint medrano_stock_historial_tipo_movimiento_check check (
    tipo_movimiento in (
      'ingreso','dispensa','produccion_consumo','produccion_resultado',
      'traslado_salida','traslado_recepcion','control_fisico','correccion',
      'baja','reactivacion'
    )
  );

create index if not exists medrano_stock_historial_tipo_fecha_idx
  on public.medrano_stock_historial(tipo_movimiento,fecha desc,created_at desc);
create index if not exists medrano_stock_historial_paciente_idx
  on public.medrano_stock_historial(paciente_id,created_at desc)
  where paciente_id is not null;

revoke all on function public.normalizar_movimiento_stock_medrano() from public,anon,authenticated;

commit;
