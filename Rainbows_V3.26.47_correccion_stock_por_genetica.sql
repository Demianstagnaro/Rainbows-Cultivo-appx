-- Rainbows V3.26.47
-- Correcciones administrativas de Stock Palestina por genética.

begin;

create table if not exists public.stock_correcciones_admin (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  realizado_por uuid not null default auth.uid(),
  accion text not null check (accion in ('corregir_cantidades','eliminar_genetica','eliminar_ciclo')),
  ciclo_id uuid,
  existencia_id uuid,
  motivo text not null,
  antes jsonb not null,
  despues jsonb
);

alter table public.stock_correcciones_admin enable row level security;
revoke all on table public.stock_correcciones_admin from public, anon, authenticated;

create or replace function public.recalcular_stock_inicial_ciclo(p_ciclo_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stock_ciclos
  set stock_inicial = coalesce((
    select sum(e.stock_inicial)
    from public.stock_existencias e
    where e.ciclo_id = p_ciclo_id
  ), 0)
  where id = p_ciclo_id;
$$;

create or replace function public.corregir_existencia_stock_palestina(
  p_existencia_id uuid,
  p_stock_inicial numeric,
  p_stock_actual numeric,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_existencias%rowtype;
  v_delta numeric := 0;
  v_base_actual numeric;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede corregir el stock.';
  end if;
  if p_stock_inicial is null or p_stock_inicial < 0 or p_stock_actual is null or p_stock_actual < 0 then
    raise exception 'Las cantidades deben ser iguales o mayores a cero.';
  end if;
  if nullif(btrim(coalesce(p_motivo,'')), '') is null then
    raise exception 'Indicá el motivo de la corrección.';
  end if;

  select * into v_item
  from public.stock_existencias
  where id = p_existencia_id
  for update;
  if not found then raise exception 'La genética de stock ya no existe.'; end if;

  select coalesce(sum(
    case
      when m.tipo = 'entrada' then coalesce(m.gramos,0)
      when m.tipo = 'salida' then -coalesce(m.gramos,0)
      else coalesce(m.ajuste_delta,0)
    end
  ),0)
  into v_delta
  from public.stock_movimientos m
  where m.existencia_id = p_existencia_id
    and m.afecta_stock is true;

  v_base_actual := p_stock_actual - v_delta;

  update public.stock_existencias
  set stock_inicial = p_stock_inicial,
      stock_actual_base = v_base_actual
  where id = p_existencia_id;

  perform public.recalcular_stock_inicial_ciclo(v_item.ciclo_id);

  insert into public.stock_correcciones_admin(
    accion,ciclo_id,existencia_id,motivo,antes,despues
  ) values (
    'corregir_cantidades',v_item.ciclo_id,v_item.id,btrim(p_motivo),to_jsonb(v_item),
    jsonb_build_object('stock_inicial',p_stock_inicial,'stock_actual',p_stock_actual,'stock_actual_base',v_base_actual)
  );
end;
$$;

create or replace function public.eliminar_existencia_stock_palestina(
  p_existencia_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.stock_existencias%rowtype;
  v_movimientos jsonb;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede eliminar una genética del stock.';
  end if;
  if nullif(btrim(coalesce(p_motivo,'')), '') is null then
    raise exception 'Indicá el motivo de la eliminación.';
  end if;

  select * into v_item
  from public.stock_existencias
  where id = p_existencia_id
  for update;
  if not found then raise exception 'La genética de stock ya no existe.'; end if;

  if exists (
    select 1 from public.stock_movimientos
    where existencia_id = p_existencia_id
      and coalesce(tipo,'') <> 'entrada'
  ) then
    raise exception 'No se puede eliminar esta genética porque ya tuvo salidas o correcciones operativas. Corregí sus cantidades en lugar de eliminarla.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at),'[]'::jsonb)
  into v_movimientos
  from public.stock_movimientos m
  where m.existencia_id = p_existencia_id;

  insert into public.stock_correcciones_admin(
    accion,ciclo_id,existencia_id,motivo,antes,despues
  ) values (
    'eliminar_genetica',v_item.ciclo_id,v_item.id,btrim(p_motivo),
    jsonb_build_object('existencia',to_jsonb(v_item),'movimientos_automaticos',v_movimientos),null
  );

  delete from public.stock_movimientos where existencia_id = p_existencia_id;
  delete from public.stock_existencias where id = p_existencia_id;
  perform public.recalcular_stock_inicial_ciclo(v_item.ciclo_id);
end;
$$;

create or replace function public.eliminar_registro_stock_palestina(p_ciclo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ciclo public.stock_ciclos%rowtype;
  v_antes jsonb;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede eliminar un registro de stock.';
  end if;

  select * into v_ciclo
  from public.stock_ciclos
  where id = p_ciclo_id
  for update;
  if not found then raise exception 'El registro de stock ya no existe.'; end if;

  if exists (
    select 1 from public.stock_movimientos
    where ciclo_id = p_ciclo_id
      and coalesce(tipo,'') <> 'entrada'
  ) then
    raise exception 'No se puede eliminar: este stock ya tuvo salidas o movimientos operativos.';
  end if;

  v_antes := jsonb_build_object(
    'ciclo',to_jsonb(v_ciclo),
    'existencias',coalesce((select jsonb_agg(to_jsonb(e)) from public.stock_existencias e where e.ciclo_id=p_ciclo_id),'[]'::jsonb),
    'movimientos_automaticos',coalesce((select jsonb_agg(to_jsonb(m)) from public.stock_movimientos m where m.ciclo_id=p_ciclo_id),'[]'::jsonb)
  );

  insert into public.stock_correcciones_admin(
    accion,ciclo_id,motivo,antes
  ) values (
    'eliminar_ciclo',p_ciclo_id,'Eliminación administrativa de registro cargado por error',v_antes
  );

  delete from public.stock_movimientos where ciclo_id = p_ciclo_id;
  delete from public.stock_existencias where ciclo_id = p_ciclo_id;
  delete from public.stock_ciclos where id = p_ciclo_id;
end;
$$;

revoke all on function public.recalcular_stock_inicial_ciclo(uuid) from public, anon, authenticated;
revoke all on function public.corregir_existencia_stock_palestina(uuid,numeric,numeric,text) from public, anon;
revoke all on function public.eliminar_existencia_stock_palestina(uuid,text) from public, anon;
revoke all on function public.eliminar_registro_stock_palestina(uuid) from public, anon;

grant execute on function public.corregir_existencia_stock_palestina(uuid,numeric,numeric,text) to authenticated;
grant execute on function public.eliminar_existencia_stock_palestina(uuid,text) to authenticated;
grant execute on function public.eliminar_registro_stock_palestina(uuid) to authenticated;

commit;
