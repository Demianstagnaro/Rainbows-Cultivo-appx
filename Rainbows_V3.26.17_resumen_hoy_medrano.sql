-- Rainbows V3.26.17: resumen liviano para Hoy en Medrano.
-- Ejecutar una sola vez después de V3.26.16.
begin;

create index if not exists medrano_comandas_hoy_idx
  on public.medrano_comandas_multiproducto(estado,pago_estado,dispensada_at desc);
create index if not exists medrano_trabajos_hoy_idx
  on public.medrano_laboratorio_trabajos(estado,updated_at desc);
create index if not exists medrano_traslados_pendientes_idx
  on public.medrano_traslados_laboratorio(estado,created_at desc);
create index if not exists stock_transferencias_pendientes_idx
  on public.stock_transferencias(estado,created_at desc);

create or replace function public.resumen_medrano_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_unpaid bigint;
  v_preparing bigint;
  v_deliverable bigint;
  v_active_jobs bigint;
  v_palestina_receipts bigint;
  v_laboratory_receipts bigint;
  v_completed_orders bigint;
  v_completed_jobs bigint;
  v_cash_movements bigint;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo Administración puede consultar Hoy en Medrano.';
  end if;

  select count(*) into v_unpaid
  from public.medrano_comandas_multiproducto c
  where c.estado='pendiente'
    and c.eliminada_at is null
    and coalesce(c.pago_estado,'pendiente')<>'pagada';

  select count(*) into v_preparing
  from public.medrano_comandas_multiproducto_items i
  join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
  where c.estado='pendiente'
    and c.eliminada_at is null
    and i.tipo in ('resina','aceites','cremas','capsulas')
    and coalesce(i.preparacion_estado,'en_proceso')='en_proceso';

  select count(*) into v_deliverable
  from public.medrano_comandas_multiproducto c
  where c.estado='pendiente'
    and c.eliminada_at is null
    and c.pago_estado='pagada'
    and not exists (
      select 1
      from public.medrano_comandas_multiproducto_items i
      where i.comanda_id=c.id
        and i.tipo in ('resina','aceites','cremas','capsulas')
        and i.preparacion_estado is distinct from 'listo'
    );

  select count(*) into v_active_jobs
  from public.medrano_laboratorio_trabajos
  where estado in ('pendiente','en_proceso');

  select count(*) into v_palestina_receipts
  from public.stock_transferencias
  where estado='en_viaje';

  select count(*) into v_laboratory_receipts
  from public.medrano_traslados_laboratorio
  where estado='en_viaje';

  select count(*) into v_completed_orders
  from public.medrano_comandas_multiproducto
  where estado='dispensada'
    and (dispensada_at at time zone 'America/Argentina/Buenos_Aires')::date=v_today;

  select count(*) into v_completed_jobs
  from public.medrano_laboratorio_trabajos
  where estado in ('finalizado','cancelado')
    and (coalesce(finalizado_at,updated_at) at time zone 'America/Argentina/Buenos_Aires')::date=v_today;

  select count(*) into v_cash_movements
  from public.medrano_caja_movimientos
  where (created_at at time zone 'America/Argentina/Buenos_Aires')::date=v_today;

  return jsonb_build_object(
    'comandas_pendientes_cobro',v_unpaid,
    'productos_preparacion',v_preparing,
    'comandas_listas',v_deliverable,
    'producciones_activas',v_active_jobs,
    'recepciones_palestina',v_palestina_receipts,
    'recepciones_laboratorio',v_laboratory_receipts,
    'comandas_entregadas_hoy',v_completed_orders,
    'producciones_cerradas_hoy',v_completed_jobs,
    'movimientos_caja_hoy',v_cash_movements
  );
end;
$$;

revoke all on function public.resumen_medrano_hoy() from public,anon,authenticated;
grant execute on function public.resumen_medrano_hoy() to authenticated;

commit;
