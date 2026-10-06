-- Rainbows V3.26.7: las comandas de Laboratorio nacen en preparación.
-- Ejecutar una sola vez después de V3.26.6.
begin;

-- Las comandas abiertas dejan de requerir el paso manual "Iniciar".
update public.medrano_comandas_multiproducto_items i
set preparacion_estado='en_proceso',preparacion_trabajo_id=null
from public.medrano_comandas_multiproducto c
where c.id=i.comanda_id
  and c.estado='pendiente'
  and i.tipo in ('resina','aceites','cremas','capsulas')
  and coalesce(i.preparacion_estado,'pendiente')='pendiente';

create or replace function public.normalizar_preparacion_item_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo in ('resina','aceites','cremas','capsulas') then
    new.preparacion_estado:=coalesce(new.preparacion_estado,'en_proceso');
  else
    new.preparacion_estado:=null;
    new.preparacion_trabajo_id:=null;
  end if;
  return new;
end;
$$;

create or replace function public.cambiar_preparacion_item_comanda(
  p_item uuid,
  p_estado text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.medrano_comandas_multiproducto_items%rowtype;
  v_estado_comanda text;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso para preparar comandas.';
  end if;
  if p_estado not in ('en_proceso','listo') then
    raise exception 'Estado de preparación inválido.';
  end if;

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

  if not found or v_estado_comanda <> 'pendiente' then
    raise exception 'La comanda ya no está pendiente.';
  end if;

  update public.medrano_comandas_multiproducto_items
  set preparacion_estado=p_estado,preparacion_trabajo_id=null
  where id=p_item;
end;
$$;

revoke all on function public.normalizar_preparacion_item_comanda(),public.cambiar_preparacion_item_comanda(uuid,text)
from public,anon;
grant execute on function public.cambiar_preparacion_item_comanda(uuid,text) to authenticated;

commit;
