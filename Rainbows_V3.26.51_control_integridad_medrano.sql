-- Rainbows V3.26.51
-- Control automático, administrativo y de solo lectura para Medrano.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.50.

begin;

create table if not exists public.medrano_integridad_config (
  singleton boolean primary key default true check (singleton),
  instalado_at timestamptz not null default now()
);
insert into public.medrano_integridad_config(singleton)
values(true)
on conflict(singleton) do nothing;
alter table public.medrano_integridad_config enable row level security;
revoke all on table public.medrano_integridad_config from public,anon,authenticated;

create index if not exists medrano_tokens_comanda_tipo_idx
  on public.medrano_tokens_movimientos(comanda_id,tipo)
  where comanda_id is not null;
create index if not exists medrano_items_origen_reserva_idx
  on public.medrano_comandas_multiproducto_items(tipo,origen_id,comanda_id)
  where origen_id is not null;

create or replace function public.revisar_integridad_medrano()
returns table(
  severidad text,
  codigo text,
  titulo text,
  detalle text,
  destino text,
  referencia_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_desde timestamptz;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo Administración puede revisar la integridad de Medrano.';
  end if;
  select instalado_at into v_desde
  from public.medrano_integridad_config
  where singleton=true;

  return query
  with
  stock_fisico as (
    select 'flores'::text tipo,l.id,l.nombre_historico::text producto,l.codigo_lote::text lote,
           l.gramos_actual::numeric cantidad,'g'::text unidad,'stock-dispensario'::text destino
    from public.medrano_dispensario_lotes l
    union all
    select 'mostrador',m.id,m.nombre,null,m.cantidad,'unidades','stock-dispensario'
    from public.medrano_mostrador_productos m where m.activo
    union all
    select s.categoria,s.id,s.nombre,s.lote,s.cantidad,s.unidad,
           ('stock-laboratorio-'||s.categoria)::text
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
  ),
  problemas as (
    select 'critica'::text severidad,'stock_negativo'::text codigo,
      'Stock negativo'::text titulo,
      concat_ws(' · ',f.producto,case when nullif(btrim(coalesce(f.lote,'')),'') is not null then 'Lote '||f.lote end,
        f.cantidad||' '||f.unidad)::text detalle,
      f.destino,f.id referencia_id
    from stock_fisico f where f.cantidad<0

    union all
    select 'critica','reserva_excedida','Reservas superiores al stock',
      concat_ws(' · ',f.producto,case when nullif(btrim(coalesce(f.lote,'')),'') is not null then 'Lote '||f.lote end,
        'Físico '||f.cantidad||' '||f.unidad,'Reservado '||r.cantidad||' '||f.unidad),
      f.destino,f.id
    from stock_fisico f join reservas r on r.tipo=f.tipo and r.stock_id=f.id
    where r.cantidad>f.cantidad+0.0001

    union all
    select 'critica','pago_sin_tokens','Comanda pagada sin consumo de Tokens',
      c.paciente_nombre||' · '||c.tokens_total||' Tokens',
      'administracion-comandas',c.id
    from public.medrano_comandas_multiproducto c
    where c.created_at>=v_desde and c.pago_estado='pagada' and c.eliminada_at is null
      and not exists(
        select 1 from public.medrano_tokens_movimientos t
        where t.comanda_id=c.id and t.tipo='consumo'
      )

    union all
    select 'critica','pago_sin_caja','Comanda cobrada sin ingreso de Caja',
      c.paciente_nombre||' · Medio '||initcap(c.medio_pago),
      'administracion-caja',c.id
    from public.medrano_comandas_multiproducto c
    where c.created_at>=v_desde and c.pago_estado='pagada' and c.eliminada_at is null
      and c.medio_pago in ('efectivo','digital')
      and not exists(
        select 1 from public.medrano_caja_movimientos m
        where m.comanda_id=c.id and m.tipo='ingreso' and m.origen='comanda'
      )

    union all
    select 'critica','dispensa_sin_stock','Dispensa sin todos sus movimientos de stock',
      c.paciente_nombre||' · Esperados '||
        (select count(*) from public.medrano_comandas_multiproducto_items i where i.comanda_id=c.id)||
        ' · Registrados '||
        (select count(*) from public.medrano_stock_historial h where h.operacion_id=c.id and h.operacion_tipo='dispensa'),
      'dispensario',c.id
    from public.medrano_comandas_multiproducto c
    where c.dispensada_at>=v_desde and c.estado='dispensada' and c.eliminada_at is null
      and (select count(*) from public.medrano_stock_historial h where h.operacion_id=c.id and h.operacion_tipo='dispensa')
          < (select count(*) from public.medrano_comandas_multiproducto_items i where i.comanda_id=c.id)

    union all
    select 'critica','produccion_incompleta','Producción finalizada sin trazabilidad completa',
      t.producto||' · Resultado '||coalesce(t.resultado_cantidad::text,'sin registrar')||' '||coalesce(t.resultado_unidad,''),
      'laboratorio',t.id
    from public.medrano_laboratorio_trabajos t
    where t.finalizado_at>=v_desde and t.produccion_controlada and t.estado='finalizado'
      and (
        t.resultado_stock_id is null or coalesce(t.resultado_cantidad,0)<=0
        or not exists(
          select 1 from public.medrano_stock_historial h
          where h.operacion_id=t.id and h.operacion_tipo='produccion' and h.cantidad_nueva>h.cantidad_anterior
        )
        or not exists(
          select 1 from public.medrano_stock_historial h
          where h.operacion_id=t.id and h.operacion_tipo='produccion' and h.cantidad_nueva<h.cantidad_anterior
        )
      )

    union all
    select 'advertencia','traslado_demorado','Traslado pendiente hace más de 48 horas',
      t.nombre||' · Lote '||t.codigo_lote||' · '||t.gramos||' g · Dispensario → Laboratorio',
      'stock-laboratorio-flores',t.id
    from public.medrano_traslados_laboratorio t
    where t.estado='en_viaje' and t.created_at<now()-interval '48 hours'

    union all
    select 'advertencia','producto_sin_catalogo','Producto activo sin catálogo o precio',
      concat_ws(' · ',s.nombre,initcap(s.categoria),case when s.catalogo_producto_id is null then 'Sin catálogo' end,
        case when coalesce(s.tokens_por_unidad,0)<=0 then 'Sin precio' end),
      ('stock-laboratorio-'||s.categoria)::text,s.id
    from public.medrano_laboratorio_stock s
    where s.activo and not coalesce(s.es_aceite_base,false)
      and s.categoria in ('resina','aceites','cremas','capsulas')
      and (s.catalogo_producto_id is null or coalesce(s.tokens_por_unidad,0)<=0)

    union all
    select 'advertencia','producto_sin_catalogo','Producto de Mostrador sin catálogo o precio',
      concat_ws(' · ',m.nombre,case when m.catalogo_producto_id is null then 'Sin catálogo' end,
        case when coalesce(m.tokens_por_unidad,0)<=0 then 'Sin precio' end),
      'stock-dispensario',m.id
    from public.medrano_mostrador_productos m
    where m.activo and (m.catalogo_producto_id is null or coalesce(m.tokens_por_unidad,0)<=0)

    union all
    select 'advertencia','lote_incompleto','Flores con trazabilidad incompleta',
      concat_ws(' · ',coalesce(nullif(btrim(l.nombre_historico),''),'Flores'),
        case when nullif(btrim(coalesce(l.codigo_lote,'')),'') is null then 'Sin lote' end,
        case when l.genetica_id is null then 'Sin genética' end,
        case when l.tamano is null then 'Sin tamaño' end),
      'stock-dispensario',l.id
    from public.medrano_dispensario_lotes l
    where l.gramos_actual>0 and (
      nullif(btrim(coalesce(l.codigo_lote,'')),'') is null or l.genetica_id is null or l.tamano is null
    )

    union all
    select 'advertencia','aceite_sin_produccion','Aceite personalizado sin producción vinculada',
      c.paciente_nombre||' · '||i.nombre,
      'laboratorio',i.id
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente' and c.eliminada_at is null and i.tipo='aceites'
      and i.origen_id is null and i.preparacion_trabajo_id is null
  )
  select p.severidad,p.codigo,p.titulo,p.detalle,p.destino,p.referencia_id
  from problemas p
  order by case p.severidad when 'critica' then 0 else 1 end,p.titulo,p.detalle
  limit 200;
end;
$$;

revoke all on function public.revisar_integridad_medrano() from public,anon,authenticated;
grant execute on function public.revisar_integridad_medrano() to authenticated;

commit;
