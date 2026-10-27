-- Rainbows V3.26.53
-- Mínimos configurables y alertas de stock libre para Hoy en Medrano.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.52.

begin;

create table if not exists public.medrano_stock_minimos (
  sector text not null check (sector in ('dispensario','laboratorio')),
  stock_id uuid not null,
  minimo numeric not null check (minimo > 0),
  actualizado_por uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (sector,stock_id)
);

alter table public.medrano_stock_minimos enable row level security;
revoke all on table public.medrano_stock_minimos from public,anon,authenticated;

create or replace function public.listar_control_stock_medrano()
returns table(
  sector text,
  categoria text,
  stock_id uuid,
  producto text,
  lote text,
  unidad text,
  stock_fisico numeric,
  reservado numeric,
  disponible numeric,
  minimo numeric,
  alerta text,
  destino text
)
language sql
stable
security definer
set search_path=''
as $$
  with stock_fisico as (
    select 'dispensario'::text sector,'flores'::text categoria,l.id stock_id,
      concat_ws(' · ',coalesce(nullif(btrim(l.nombre_historico),''),'Flores'),
        case when nullif(btrim(coalesce(l.codigo_lote,'')),'') is not null then 'Lote '||l.codigo_lote end)::text producto,
      l.codigo_lote::text lote,'g'::text unidad,l.gramos_actual::numeric stock_fisico,
      'stock-dispensario'::text destino
    from public.medrano_dispensario_lotes l
    where l.gramos_actual>0 or exists(
      select 1 from public.medrano_stock_minimos m where m.sector='dispensario' and m.stock_id=l.id
    )
    union all
    select 'dispensario','mostrador',m.id,m.nombre,null,'unidades',m.cantidad,
      'stock-dispensario'
    from public.medrano_mostrador_productos m where m.activo
    union all
    select 'laboratorio',s.categoria,s.id,
      concat_ws(' · ',s.nombre,case when nullif(btrim(coalesce(s.lote,'')),'') is not null then 'Lote '||s.lote end),
      s.lote,s.unidad,s.cantidad,('stock-laboratorio-'||s.categoria)::text
    from public.medrano_laboratorio_stock s where s.activo
  ),
  reservas_comandas as (
    select i.tipo,i.origen_id stock_id,sum(i.cantidad)::numeric cantidad
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente' and c.eliminada_at is null and i.origen_id is not null
    group by i.tipo,i.origen_id
  ),
  reservas_produccion as (
    select m.categoria tipo,m.stock_id,sum(m.cantidad)::numeric cantidad
    from public.medrano_laboratorio_trabajos_materiales m
    join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
    where t.produccion_controlada and t.estado='en_proceso'
    group by m.categoria,m.stock_id
  ),
  reservas as (
    select tipo,stock_id,sum(cantidad)::numeric cantidad
    from (
      select * from reservas_comandas
      union all
      select * from reservas_produccion
    ) r group by tipo,stock_id
  )
  select f.sector,f.categoria,f.stock_id,f.producto,f.lote,f.unidad,f.stock_fisico,
    coalesce(r.cantidad,0)::numeric reservado,
    (f.stock_fisico-coalesce(r.cantidad,0))::numeric disponible,
    m.minimo,
    case
      when m.minimo is null then null
      when f.stock_fisico-coalesce(r.cantidad,0)<=0 then 'sin_stock'
      when f.stock_fisico-coalesce(r.cantidad,0)<=m.minimo then 'bajo'
      else null
    end::text alerta,
    f.destino
  from stock_fisico f
  left join reservas r on r.tipo=f.categoria and r.stock_id=f.stock_id
  left join public.medrano_stock_minimos m on m.sector=f.sector and m.stock_id=f.stock_id
  where public.usuario_rainbows_admin()
  order by case when m.minimo is not null and f.stock_fisico-coalesce(r.cantidad,0)<=m.minimo then 0 else 1 end,
    f.sector,f.categoria,lower(f.producto);
$$;

create or replace function public.guardar_minimos_stock_medrano(p_minimos jsonb)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_item jsonb;
  v_sector text;
  v_stock_id uuid;
  v_minimo numeric;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo Administración puede configurar los mínimos de stock.';
  end if;
  if p_minimos is null or jsonb_typeof(p_minimos)<>'array' then
    raise exception 'La configuración de mínimos no es válida.';
  end if;

  create temporary table if not exists pg_temp.nuevos_minimos_medrano(
    sector text,
    stock_id uuid,
    minimo numeric,
    primary key(sector,stock_id)
  ) on commit drop;
  truncate pg_temp.nuevos_minimos_medrano;

  for v_item in select value from jsonb_array_elements(p_minimos)
  loop
    v_sector:=nullif(v_item->>'sector','');
    v_stock_id:=nullif(v_item->>'stock_id','')::uuid;
    v_minimo:=nullif(v_item->>'minimo','')::numeric;
    if v_sector not in ('dispensario','laboratorio') or v_stock_id is null
       or v_minimo is null or v_minimo<=0 or v_minimo::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Hay un mínimo de stock inválido.';
    end if;
    if v_sector='dispensario' and not (
      exists(select 1 from public.medrano_dispensario_lotes where id=v_stock_id)
      or exists(select 1 from public.medrano_mostrador_productos where id=v_stock_id and activo)
    ) then raise exception 'No se encontró un producto de Dispensario.';
    end if;
    if v_sector='laboratorio' and not exists(
      select 1 from public.medrano_laboratorio_stock where id=v_stock_id and activo
    ) then raise exception 'No se encontró un producto de Laboratorio.';
    end if;
    insert into pg_temp.nuevos_minimos_medrano(sector,stock_id,minimo)
    values(v_sector,v_stock_id,v_minimo)
    on conflict(sector,stock_id) do update set minimo=excluded.minimo;
  end loop;

  delete from public.medrano_stock_minimos;
  insert into public.medrano_stock_minimos(sector,stock_id,minimo,actualizado_por,updated_at)
  select sector,stock_id,minimo,auth.uid(),now()
  from pg_temp.nuevos_minimos_medrano;
end;
$$;

revoke all on function public.listar_control_stock_medrano() from public,anon,authenticated;
revoke all on function public.guardar_minimos_stock_medrano(jsonb) from public,anon,authenticated;
grant execute on function public.listar_control_stock_medrano() to authenticated;
grant execute on function public.guardar_minimos_stock_medrano(jsonb) to authenticated;

commit;
