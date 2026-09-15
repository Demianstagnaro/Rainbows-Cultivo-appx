-- Requiere V3.18.7. Historial automático y traslados internos transaccionales.
begin;

create table if not exists public.medrano_laboratorio_stock (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('flores','resina','aceites','cremas','capsulas','insumos')),
  nombre text not null check (btrim(nombre) <> ''),
  lote text,
  genetica_id uuid,
  origen_lote_id uuid unique references public.medrano_dispensario_lotes(id),
  cantidad numeric not null default 0 check (cantidad >= 0),
  unidad text not null default 'g' check (unidad in ('g','ml','unidades')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.medrano_traslados_laboratorio (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.medrano_dispensario_lotes(id),
  nombre text not null,
  codigo_lote text not null,
  genetica_id uuid,
  gramos numeric not null check (gramos > 0),
  estado text not null default 'en_viaje' check (estado in ('en_viaje','recibido')),
  enviado_por uuid not null,
  recibido_por uuid,
  created_at timestamptz not null default now(),
  recibido_at timestamptz
);
create table if not exists public.medrano_stock_historial (
  id uuid primary key default gen_random_uuid(),
  sector text not null,
  categoria text not null,
  producto text not null,
  lote text,
  cantidad_anterior numeric not null,
  cantidad_nueva numeric not null,
  unidad text not null,
  accion text not null,
  usuario_id uuid,
  usuario_nombre text not null,
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  created_at timestamptz not null default now()
);
create index if not exists medrano_stock_historial_fecha_idx on public.medrano_stock_historial(fecha desc, created_at desc);

alter table public.medrano_laboratorio_stock enable row level security;
alter table public.medrano_traslados_laboratorio enable row level security;
alter table public.medrano_stock_historial enable row level security;
drop policy if exists laboratorio_stock_select on public.medrano_laboratorio_stock;
create policy laboratorio_stock_select on public.medrano_laboratorio_stock for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists traslados_laboratorio_select on public.medrano_traslados_laboratorio;
create policy traslados_laboratorio_select on public.medrano_traslados_laboratorio for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists stock_historial_select on public.medrano_stock_historial;
create policy stock_historial_select on public.medrano_stock_historial for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_laboratorio_stock, public.medrano_traslados_laboratorio, public.medrano_stock_historial from anon, authenticated;
grant select on public.medrano_laboratorio_stock, public.medrano_traslados_laboratorio, public.medrano_stock_historial to authenticated;

-- Usa JSON para preservar compatibilidad con los lotes existentes.
create or replace function public.registrar_movimiento_stock_medrano()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_sector text; v_categoria text; v_producto text; v_unidad text;
  v_anterior numeric; v_nueva numeric; v_nombre text; v_accion text;
begin
  if tg_table_name = 'medrano_dispensario_lotes' then
    v_sector := 'dispensario'; v_categoria := 'flores'; v_unidad := 'g';
    v_producto := coalesce(v_new->>'nombre_historico','Flores');
    v_anterior := coalesce((v_old->>'gramos_actual')::numeric,0);
    v_nueva := coalesce((v_new->>'gramos_actual')::numeric,0);
  else
    v_sector := case when tg_table_name = 'medrano_mostrador_productos' then 'dispensario' else 'laboratorio' end;
    v_categoria := coalesce(v_new->>'categoria','mostrador');
    v_unidad := coalesce(v_new->>'unidad','unidades'); v_producto := v_new->>'nombre';
    v_anterior := coalesce((v_old->>'cantidad')::numeric,0);
    v_nueva := coalesce((v_new->>'cantidad')::numeric,0);
  end if;
  v_accion := case when tg_op = 'INSERT' then 'Ingreso' when v_new->>'activo' = 'false' and v_old->>'activo' is distinct from 'false' then 'Producto retirado de la lista' when v_old->>'activo' = 'false' and v_new->>'activo' = 'true' then 'Producto reactivado' else 'Ajuste de stock' end;
  if tg_op = 'UPDATE' and v_anterior = v_nueva and v_old->>'activo' is not distinct from v_new->>'activo' then return new; end if;
  select coalesce(nullif(btrim(nombre),''),email) into v_nombre from public.perfiles where id = auth.uid();
  insert into public.medrano_stock_historial(sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,usuario_id,usuario_nombre)
  values (v_sector,v_categoria,v_producto,coalesce(v_new->>'codigo_lote',v_new->>'lote'),v_anterior,v_nueva,v_unidad,coalesce(nullif(current_setting('rainbows.stock_accion',true),''),v_accion),auth.uid(),coalesce(v_nombre,'Sistema'));
  return new;
end; $$;
drop trigger if exists medrano_lotes_historial on public.medrano_dispensario_lotes;
create trigger medrano_lotes_historial after insert or update on public.medrano_dispensario_lotes for each row execute function public.registrar_movimiento_stock_medrano();
drop trigger if exists medrano_mostrador_historial on public.medrano_mostrador_productos;
create trigger medrano_mostrador_historial after insert or update on public.medrano_mostrador_productos for each row execute function public.registrar_movimiento_stock_medrano();
drop trigger if exists medrano_laboratorio_historial on public.medrano_laboratorio_stock;
create trigger medrano_laboratorio_historial after insert or update on public.medrano_laboratorio_stock for each row execute function public.registrar_movimiento_stock_medrano();

create or replace function public.enviar_flores_laboratorio(p_lote_id uuid,p_gramos numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lote jsonb; v_id uuid;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para trasladar stock.'; end if;
  if p_gramos is null or p_gramos <= 0 then raise exception 'Ingresá una cantidad mayor a cero.'; end if;
  select to_jsonb(l) into v_lote from public.medrano_dispensario_lotes l where id = p_lote_id for update;
  if v_lote is null then raise exception 'No se encontró el lote.'; end if;
  if coalesce((v_lote->>'gramos_actual')::numeric,0) < p_gramos then raise exception 'El lote no tiene stock suficiente.'; end if;
  perform set_config('rainbows.stock_accion','Envío Dispensario → Laboratorio · En viaje',true);
  -- SQL dinámico permite validar esta migración también con el esquema de pruebas mínimo.
  execute 'update public.medrano_dispensario_lotes set gramos_actual = gramos_actual - $1 where id = $2' using p_gramos,p_lote_id;
  insert into public.medrano_traslados_laboratorio(lote_id,nombre,codigo_lote,genetica_id,gramos,enviado_por)
  values(p_lote_id,coalesce(v_lote->>'nombre_historico','Flores'),coalesce(v_lote->>'codigo_lote','—'),(v_lote->>'genetica_id')::uuid,p_gramos,auth.uid()) returning id into v_id;
  perform set_config('rainbows.stock_accion','',true);
  return v_id;
end; $$;

create or replace function public.recibir_flores_laboratorio(p_traslado_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_t public.medrano_traslados_laboratorio; v_disponible numeric; v_usuario text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para recibir stock.'; end if;
  select * into v_t from public.medrano_traslados_laboratorio where id = p_traslado_id for update;
  if not found then raise exception 'No se encontró el traslado.'; end if;
  if v_t.estado <> 'en_viaje' then raise exception 'Este traslado ya fue recibido.'; end if;
  perform set_config('rainbows.stock_accion','Recepción confirmada · Dispensario → Laboratorio',true);
  insert into public.medrano_laboratorio_stock(categoria,nombre,lote,genetica_id,origen_lote_id,cantidad,unidad)
  values('flores',v_t.nombre,v_t.codigo_lote,v_t.genetica_id,v_t.lote_id,v_t.gramos,'g')
  on conflict (origen_lote_id) do update set cantidad = public.medrano_laboratorio_stock.cantidad + excluded.cantidad;
  update public.medrano_traslados_laboratorio set estado = 'recibido',recibido_por = auth.uid(),recibido_at = now() where id = p_traslado_id;
  select coalesce((to_jsonb(l)->>'gramos_actual')::numeric,0) into v_disponible from public.medrano_dispensario_lotes l where id=v_t.lote_id;
  select coalesce(nullif(btrim(nombre),''),email) into v_usuario from public.perfiles where id=auth.uid();
  insert into public.medrano_stock_historial(sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,usuario_id,usuario_nombre)
  values('dispensario','flores',v_t.nombre,v_t.codigo_lote,v_disponible,v_disponible,'g','Laboratorio confirmó la recepción de '||v_t.gramos||' g (sin nuevo descuento)',auth.uid(),coalesce(v_usuario,'Sistema'));
  perform set_config('rainbows.stock_accion','',true);
end; $$;

create or replace function public.guardar_stock_laboratorio(p_id uuid,p_categoria text,p_nombre text,p_cantidad numeric,p_unidad text,p_activo boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para modificar stock.'; end if;
  if p_categoria = 'flores' then raise exception 'Las flores ingresan mediante recepción del Dispensario.'; end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad::text in ('NaN','Infinity','-Infinity') or nullif(btrim(p_nombre),'') is null then raise exception 'Revisá el producto y la cantidad.'; end if;
  if p_unidad = 'unidades' and p_cantidad <> trunc(p_cantidad) then raise exception 'Las unidades deben ser cantidades enteras.'; end if;
  if p_id is not null and exists(select 1 from public.medrano_laboratorio_stock where id=p_id and unidad<>p_unidad) then raise exception 'No se puede cambiar la unidad de un producto existente.'; end if;
  if p_id is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,cantidad,unidad,activo) values(p_categoria,btrim(p_nombre),p_cantidad,p_unidad,p_activo);
  else
    update public.medrano_laboratorio_stock set nombre=btrim(p_nombre),cantidad=p_cantidad,unidad=p_unidad,activo=p_activo where id=p_id and categoria=p_categoria and categoria <> 'flores';
    if not found then raise exception 'No se encontró el producto.'; end if;
  end if;
end; $$;
revoke all on function public.registrar_movimiento_stock_medrano() from public;
revoke all on function public.enviar_flores_laboratorio(uuid,numeric),public.recibir_flores_laboratorio(uuid),public.guardar_stock_laboratorio(uuid,text,text,numeric,text,boolean) from public;
grant execute on function public.enviar_flores_laboratorio(uuid,numeric),public.recibir_flores_laboratorio(uuid),public.guardar_stock_laboratorio(uuid,text,text,numeric,text,boolean) to authenticated;
commit;
