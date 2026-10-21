-- Rainbows V3.26.46
-- Permite corregir un ingreso de Stock Palestina creado por error sin borrar
-- la cosecha. Solo un administrador puede hacerlo y únicamente antes de que
-- el registro tenga movimientos, para no romper la trazabilidad.

begin;

create or replace function public.eliminar_registro_stock_palestina(p_ciclo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede eliminar un registro de stock.';
  end if;

  perform 1
  from public.stock_ciclos
  where id = p_ciclo_id
  for update;

  if not found then
    raise exception 'El registro de stock ya no existe.';
  end if;

  if exists (
    select 1
    from public.stock_movimientos
    where ciclo_id = p_ciclo_id
  ) then
    raise exception 'No se puede eliminar: este stock ya tiene movimientos registrados.';
  end if;

  delete from public.stock_existencias
  where ciclo_id = p_ciclo_id;

  delete from public.stock_ciclos
  where id = p_ciclo_id;
end;
$$;

revoke all on function public.eliminar_registro_stock_palestina(uuid) from public, anon;
grant execute on function public.eliminar_registro_stock_palestina(uuid) to authenticated;

commit;
