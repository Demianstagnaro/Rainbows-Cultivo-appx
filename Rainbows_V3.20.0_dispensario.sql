-- Rainbows V3.20.0: movimientos de Laboratorio a Dispensario e historial diario.
-- Requiere V3.19.0 y los permisos definitivos de V3.17.0.
begin;

create table if not exists public.medrano_dispensario_laboratorio_stock (
  id uuid primary key default gen_random_uuid(),
  origen_item_id uuid not null unique references public.medrano_laboratorio_stock(id),
  categoria text not null check (categoria in ('resina','aceites','cremas','capsulas')),
  nombre text not null check (btrim(nombre) <> ''),
  cantidad numeric not null default 0 check (cantidad >= 0),
  unidad text not null check (unidad in ('g','ml','unidades')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medrano_laboratorio_dispensario_movimientos (
  id uuid primary key default gen_random_uuid(),
  origen_item_id uuid not null references public.medrano_laboratorio_stock(id),
  categoria text not null,
  producto text not null,
  lote text,
  cantidad numeric not null check (cantidad > 0),
  unidad text not null,
  usuario_id uuid not null,
  usuario_nombre text not null,
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now()
);
create index if not exists medrano_lab_disp_movimientos_fecha_idx
  on public.medrano_laboratorio_dispensario_movimientos(fecha desc,created_at desc);

alter table public.medrano_dispensario_laboratorio_stock enable row level security;
alter table public.medrano_laboratorio_dispensario_movimientos enable row level security;
drop policy if exists medrano_disp_lab_stock_select on public.medrano_dispensario_laboratorio_stock;
create policy medrano_disp_lab_stock_select on public.medrano_dispensario_laboratorio_stock
  for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists medrano_lab_disp_movimientos_select on public.medrano_laboratorio_dispensario_movimientos;
create policy medrano_lab_disp_movimientos_select on public.medrano_laboratorio_dispensario_movimientos
  for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_dispensario_laboratorio_stock, public.medrano_laboratorio_dispensario_movimientos from public, anon, authenticated;
grant select on public.medrano_dispensario_laboratorio_stock, public.medrano_laboratorio_dispensario_movimientos to authenticated;

create or replace function public.mover_laboratorio_a_dispensario(p_item_id uuid,p_cantidad numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_item public.medrano_laboratorio_stock%rowtype;
  v_usuario text;
  v_movimiento uuid;
  v_anterior numeric;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para mover stock de Laboratorio.';
  end if;
  if p_cantidad is null or p_cantidad <= 0 or p_cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá una cantidad válida mayor a cero.';
  end if;
  select * into v_item from public.medrano_laboratorio_stock where id=p_item_id for update;
  if not found or not v_item.activo or v_item.categoria not in ('flores','resina','aceites','cremas','capsulas') then
    raise exception 'El producto de Laboratorio no está disponible para traslado.';
  end if;
  if v_item.cantidad < p_cantidad then raise exception 'No hay stock suficiente en Laboratorio.'; end if;
  if v_item.unidad='unidades' and p_cantidad<>trunc(p_cantidad) then
    raise exception 'La cantidad de unidades debe ser entera.';
  end if;
  select coalesce(nullif(btrim(nombre),''),email) into v_usuario
    from public.perfiles where id=auth.uid() and activo is true;
  if v_usuario is null then raise exception 'No se pudo identificar al usuario.'; end if;

  perform set_config('rainbows.stock_accion','Envío Laboratorio → Dispensario',true);
  update public.medrano_laboratorio_stock set cantidad=cantidad-p_cantidad where id=v_item.id;
  if v_item.categoria='flores' then
    if v_item.origen_lote_id is null then raise exception 'Las flores no tienen lote de origen en Dispensario.'; end if;
    -- El trigger existente registra la recepción en el historial de flores.
    perform set_config('rainbows.stock_accion','Recepción Laboratorio → Dispensario',true);
    update public.medrano_dispensario_lotes
       set gramos_actual=gramos_actual+p_cantidad where id=v_item.origen_lote_id;
    if not found then raise exception 'No se encontró el lote de origen en Dispensario.'; end if;
  else
    -- Solo la RPC tiene permisos de escritura; dos envíos concurrentes al mismo
    -- producto se serializan mediante el bloqueo de su fila de Laboratorio.
    insert into public.medrano_dispensario_laboratorio_stock(origen_item_id,categoria,nombre,cantidad,unidad)
      values(v_item.id,v_item.categoria,v_item.nombre,p_cantidad,v_item.unidad)
      on conflict (origen_item_id) do update
        set cantidad=public.medrano_dispensario_laboratorio_stock.cantidad+excluded.cantidad,
            nombre=excluded.nombre,updated_at=now();
    select cantidad-p_cantidad into v_anterior
      from public.medrano_dispensario_laboratorio_stock where origen_item_id=v_item.id;
    insert into public.medrano_stock_historial(sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,usuario_id,usuario_nombre)
      values('dispensario',v_item.categoria,v_item.nombre,v_item.lote,v_anterior,v_anterior+p_cantidad,v_item.unidad,
             'Recepción Laboratorio → Dispensario',auth.uid(),v_usuario);
  end if;
  perform set_config('rainbows.stock_accion','',true);
  insert into public.medrano_laboratorio_dispensario_movimientos(origen_item_id,categoria,producto,lote,cantidad,unidad,usuario_id,usuario_nombre)
    values(v_item.id,v_item.categoria,v_item.nombre,v_item.lote,p_cantidad,v_item.unidad,auth.uid(),v_usuario)
    returning id into v_movimiento;
  return v_movimiento;
end; $$;
revoke execute on function public.mover_laboratorio_a_dispensario(uuid,numeric) from public,anon;
grant execute on function public.mover_laboratorio_a_dispensario(uuid,numeric) to authenticated;
commit;
