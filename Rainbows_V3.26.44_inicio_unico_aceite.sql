-- Rainbows V3.26.44
-- Al vincular un aceite personalizado con su producción, la inicia en la misma operación.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

create or replace function public.vincular_produccion_aceite_comanda(p_item uuid,p_trabajo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.medrano_comandas_multiproducto_items%rowtype;v_job public.medrano_laboratorio_trabajos%rowtype;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para preparar comandas.'; end if;
  select * into v_item from public.medrano_comandas_multiproducto_items where id=p_item for update;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_trabajo for update;
  if v_item.id is null or not v_item.pedido_laboratorio or v_item.tipo<>'aceites' or v_item.origen_id is not null then
    raise exception 'El aceite de la comanda ya no está pendiente de producción.';
  end if;
  if v_job.id is null or v_job.tipo<>'aceite_final' or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then
    raise exception 'Seleccioná una producción de aceite válida.';
  end if;
  if v_job.resultado_metadata->>'perfil' is distinct from v_item.receta->>'perfil'
     or replace(coalesce(v_job.resultado_metadata->>'proporcion',''),'-',':') is distinct from replace(coalesce(v_item.receta->>'proporcion',''),'-',':')
     or (v_job.resultado_metadata->>'concentracion')::numeric is distinct from (v_item.receta->>'concentracion')::numeric
     or (v_job.resultado_metadata->>'presentacion_ml')::numeric is distinct from (v_item.receta->>'presentacion_ml')::numeric
     or lower(btrim(v_job.resultado_metadata->>'base')) is distinct from lower(btrim(v_item.receta->>'base'))
     or (v_job.resultado_metadata->>'unidades_previstas')::numeric<v_item.cantidad then
    raise exception 'La producción no coincide con la receta y cantidad de la comanda.';
  end if;
  if exists(select 1 from public.medrano_comandas_multiproducto_items where preparacion_trabajo_id=p_trabajo and id<>p_item) then
    raise exception 'La producción ya está vinculada a otra comanda.';
  end if;

  update public.medrano_comandas_multiproducto_items
  set preparacion_estado='en_proceso',preparacion_trabajo_id=p_trabajo
  where id=p_item;

  if v_job.estado='pendiente' then
    perform public.cambiar_estado_trabajo_laboratorio(p_trabajo,'en_proceso');
  end if;
end;
$$;

revoke all on function public.vincular_produccion_aceite_comanda(uuid,uuid) from public,anon;
grant execute on function public.vincular_produccion_aceite_comanda(uuid,uuid) to authenticated;

commit;
