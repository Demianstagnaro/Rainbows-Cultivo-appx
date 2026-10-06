-- Rainbows V3.26.6: separa cobro y dispensa, y protege cantidades enteras.
-- Ejecutar una sola vez después de V3.26.5.
begin;

create or replace function public.validar_cantidad_item_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cantidad is null or new.cantidad <= 0
     or new.cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá una cantidad válida.';
  end if;
  if new.unidad = 'unidades' and new.cantidad <> trunc(new.cantidad) then
    raise exception 'Los productos por unidad deben tener cantidades enteras.';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_cantidad_item_comanda
on public.medrano_comandas_multiproducto_items;
create trigger validar_cantidad_item_comanda
before insert or update of cantidad,unidad
on public.medrano_comandas_multiproducto_items
for each row execute function public.validar_cantidad_item_comanda();

-- El cierre ya no cobra automáticamente. Administración confirma primero el pago;
-- después Administración o Dispensario confirman la entrega desde la aplicación.
create or replace function public.cerrar_comanda_multiproducto(
  p_id uuid,
  p_medio text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_pago text;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso para dispensar comandas.';
  end if;

  select estado,pago_estado
  into v_estado,v_pago
  from public.medrano_comandas_multiproducto
  where id=p_id
  for update;

  if not found or v_estado <> 'pendiente' then
    raise exception 'La comanda ya fue cerrada o eliminada.';
  end if;
  if v_pago <> 'pagada' then
    raise exception 'Administración debe confirmar primero el cobro de la comanda.';
  end if;

  perform public.dispensar_comanda_multiproducto(p_id);
end;
$$;

revoke all on function public.validar_cantidad_item_comanda() from public,anon,authenticated;
revoke all on function public.cerrar_comanda_multiproducto(uuid,text) from public,anon;
grant execute on function public.cerrar_comanda_multiproducto(uuid,text) to authenticated;

commit;
