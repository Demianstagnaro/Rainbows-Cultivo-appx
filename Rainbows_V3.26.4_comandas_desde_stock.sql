-- Rainbows V3.26.4: las comandas de Laboratorio se preparan desde el lote reservado.
-- Ejecutar una sola vez después de V3.26.2. Incluye lo necesario de V3.26.3.
begin;

-- Este archivo también completa V3.26.3 si aquella migración no llegó a ejecutarse.
alter table public.medrano_comandas_multiproducto_items
  add column if not exists preparacion_estado text,
  add column if not exists preparacion_trabajo_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.medrano_comandas_multiproducto_items'::regclass
      and conname='comanda_item_preparacion_estado_check'
  ) then
    alter table public.medrano_comandas_multiproducto_items
      add constraint comanda_item_preparacion_estado_check
      check (preparacion_estado is null or preparacion_estado in ('pendiente','en_proceso','listo'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.medrano_comandas_multiproducto_items'::regclass
      and conname='comanda_item_preparacion_trabajo_fk'
  ) then
    alter table public.medrano_comandas_multiproducto_items
      add constraint comanda_item_preparacion_trabajo_fk
      foreign key(preparacion_trabajo_id) references public.medrano_laboratorio_trabajos(id) on delete set null;
  end if;
end $$;

create index if not exists comanda_items_preparacion_idx
  on public.medrano_comandas_multiproducto_items(preparacion_estado,comanda_id)
  where preparacion_estado is not null;
create unique index if not exists comanda_items_preparacion_trabajo_idx
  on public.medrano_comandas_multiproducto_items(preparacion_trabajo_id)
  where preparacion_trabajo_id is not null;

update public.medrano_comandas_multiproducto_items i
set preparacion_estado=case when c.estado='dispensada' then 'listo' else 'pendiente' end
from public.medrano_comandas_multiproducto c
where c.id=i.comanda_id
  and i.tipo in ('resina','aceites','cremas','capsulas')
  and i.preparacion_estado is null;

update public.medrano_comandas_multiproducto_items
set preparacion_estado=null,preparacion_trabajo_id=null
where tipo not in ('resina','aceites','cremas','capsulas');

create or replace function public.normalizar_preparacion_item_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.tipo in ('resina','aceites','cremas','capsulas') then
    new.preparacion_estado:=coalesce(new.preparacion_estado,'pendiente');
  else
    new.preparacion_estado:=null;
    new.preparacion_trabajo_id:=null;
  end if;
  return new;
end; $$;
drop trigger if exists normalizar_preparacion_item_comanda on public.medrano_comandas_multiproducto_items;
create trigger normalizar_preparacion_item_comanda
before insert or update of tipo,preparacion_estado,preparacion_trabajo_id
on public.medrano_comandas_multiproducto_items
for each row execute function public.normalizar_preparacion_item_comanda();

-- V3.26.3 generaba un trabajo genérico al iniciar una preparación. Se conserva su
-- auditoría, pero se lo cierra y desvincula porque preparar un pedido desde stock
-- no es una nueva producción ni debe crear otro lote.
insert into public.medrano_laboratorio_trabajos_eventos(
  trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id
)
select j.id,'estado',j.estado,'cancelado',coalesce(j.actualizado_por,j.creado_por)
from public.medrano_laboratorio_trabajos j
where j.id in (
  select i.preparacion_trabajo_id
  from public.medrano_comandas_multiproducto_items i
  where i.preparacion_trabajo_id is not null
)
and j.tipo='comanda_paciente'
and j.detalle='Preparación vinculada a comanda'
and j.estado<>'cancelado';

update public.medrano_comandas_multiproducto_items i
set preparacion_trabajo_id=null
where i.preparacion_trabajo_id in (
  select j.id from public.medrano_laboratorio_trabajos j
  where j.tipo='comanda_paciente' and j.detalle='Preparación vinculada a comanda'
);

update public.medrano_laboratorio_trabajos j
set estado='cancelado',actualizado_por=coalesce(j.actualizado_por,j.creado_por),
    updated_at=now(),finalizado_por=null,finalizado_at=null
where j.tipo='comanda_paciente'
and j.detalle='Preparación vinculada a comanda';

-- Ya no se sincronizan comandas desde trabajos genéricos: la preparación usa stock.
drop trigger if exists sincronizar_preparacion_desde_trabajo on public.medrano_laboratorio_trabajos;

create or replace function public.cambiar_preparacion_item_comanda(p_item uuid,p_estado text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_item public.medrano_comandas_multiproducto_items%rowtype;
  v_estado_comanda text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para preparar comandas.'; end if;
  if p_estado not in ('pendiente','en_proceso','listo') then raise exception 'Estado de preparación inválido.'; end if;

  select * into v_item
  from public.medrano_comandas_multiproducto_items
  where id=p_item
  for update;
  if not found or v_item.tipo not in ('resina','aceites','cremas','capsulas') then
    raise exception 'No se encontró un producto de Laboratorio para preparar.';
  end if;

  select estado into v_estado_comanda
  from public.medrano_comandas_multiproducto
  where id=v_item.comanda_id
  for update;
  if not found or v_estado_comanda<>'pendiente' then raise exception 'La comanda ya no está pendiente.'; end if;

  -- El origen_id del ítem ya identifica el lote físico reservado. Este cambio sólo
  -- registra el avance operativo; el stock se descuenta al dispensar la comanda.
  update public.medrano_comandas_multiproducto_items
  set preparacion_estado=p_estado,preparacion_trabajo_id=null
  where id=p_item;
end; $$;

-- Bloqueo definitivo: no permite dispensar si algún producto de Laboratorio no está listo.
create or replace function public.dispensar_comanda_multiproducto(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto%rowtype;v_line record;v_accion text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
  if not found or v_c.estado<>'pendiente' then raise exception 'La comanda ya fue cerrada o eliminada.'; end if;
  if exists(
    select 1 from public.medrano_comandas_multiproducto_items
    where comanda_id=p_id and tipo in ('resina','aceites','cremas','capsulas')
      and preparacion_estado is distinct from 'listo'
  ) then
    raise exception 'Laboratorio todavía tiene productos pendientes de preparación.';
  end if;
  for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
    if not (select permitir_negativo from public.medrano_configuracion_stock where singleton)
       and public.stock_libre_comanda(v_line.tipo,v_line.origen_id,p_id)<v_line.cantidad then raise exception 'Stock insuficiente para %.',v_line.nombre; end if;
  end loop;
  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(p_id,'dispensa',p_id,'dispensada','Dispensa a '||v_c.paciente_nombre,auth.uid())
  on conflict(id) do update set tipo='dispensa',estado='dispensada',detalle=excluded.detalle,updated_at=now();
  update public.medrano_comandas_multiproducto set estado='dispensada',dispensada_por=auth.uid(),dispensada_at=now(),updated_at=now() where id=p_id;
  perform set_config('rainbows.operacion_id',p_id::text,true);perform set_config('rainbows.operacion_tipo','dispensa',true);perform set_config('rainbows.referencia_id',p_id::text,true);
  for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
    v_accion:='Dispensa a paciente · Detalle: '||v_line.cantidad||' '||v_line.unidad||' de '||v_line.nombre||' · Paciente '||v_c.paciente_nombre;
    perform set_config('rainbows.stock_accion',v_accion,true);
    if v_line.tipo='flores' then update public.medrano_dispensario_lotes set gramos_actual=gramos_actual-v_line.cantidad where id=v_line.origen_id;
    elsif v_line.tipo='mostrador' then update public.medrano_mostrador_productos set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;
    else update public.medrano_laboratorio_stock set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;end if;
    if not found then raise exception 'No se encontró stock para %.',v_line.nombre; end if;
  end loop;
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end; $$;

revoke all on function public.cambiar_preparacion_item_comanda(uuid,text) from public,anon;
grant execute on function public.cambiar_preparacion_item_comanda(uuid,text) to authenticated;
revoke execute on function public.dispensar_comanda_multiproducto(uuid) from authenticated;

commit;
