-- Rainbows V3.26.45
-- La preparación de Laboratorio corresponde únicamente a aceites personalizados.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

-- Los productos elegidos desde stock ya están elaborados: no requieren un estado
-- de preparación ni una confirmación manual de Laboratorio.
create or replace function public.normalizar_preparacion_item_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.pedido_laboratorio,false) then
    if new.tipo <> 'aceites' then
      raise exception 'Solamente los aceites personalizados pueden requerir preparación.';
    end if;
    new.preparacion_estado:=coalesce(new.preparacion_estado,'en_proceso');
  else
    new.preparacion_estado:=null;
    new.preparacion_trabajo_id:=null;
  end if;
  return new;
end;
$$;

drop trigger if exists normalizar_preparacion_item_comanda
on public.medrano_comandas_multiproducto_items;
create trigger normalizar_preparacion_item_comanda
before insert or update of tipo,pedido_laboratorio,preparacion_estado,preparacion_trabajo_id
on public.medrano_comandas_multiproducto_items
for each row execute function public.normalizar_preparacion_item_comanda();

-- Limpia el estado heredado de comandas normales, incluidas las históricas.
-- Sólo se modifican los dos campos operativos permitidos en comandas pagadas.
update public.medrano_comandas_multiproducto_items
set preparacion_estado=null,preparacion_trabajo_id=null
where not coalesce(pedido_laboratorio,false)
  and (preparacion_estado is not null or preparacion_trabajo_id is not null);

-- Una versión anterior de la app no podrá marcar manualmente un producto como
-- listo: el aceite personalizado cambia a "listo" al finalizar su producción.
create or replace function public.cambiar_preparacion_item_comanda(
  p_item uuid,
  p_estado text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso para preparar comandas.';
  end if;
  raise exception 'La preparación se actualiza automáticamente al finalizar el aceite personalizado.';
end;
$$;

revoke all on function public.normalizar_preparacion_item_comanda(),public.cambiar_preparacion_item_comanda(uuid,text)
from public,anon;
grant execute on function public.cambiar_preparacion_item_comanda(uuid,text) to authenticated;

commit;
