-- Rainbows V3.25.13: resultado automático y trazabilidad completa para cápsulas.
-- Requiere V3.25.12. No modifica producciones ya finalizadas.

begin;

create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;
  v_material record;
  v_stock public.medrano_laboratorio_stock%rowtype;
  v_categoria text;
  v_destino uuid;
  v_genetica uuid;
  v_lote text;
  v_resultado_lote text;
  v_perfil text;
  v_proporcion text;
  v_base text;
  v_concentracion numeric;
  v_tamano_capsula numeric;
  v_es_base boolean := false;
  v_resinas integer := 0;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso para finalizar producción.';
  end if;
  if p_retorno is null or p_retorno <= 0 or p_retorno::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá el rendimiento real, mayor a cero.';
  end if;

  select * into v_job
  from public.medrano_laboratorio_trabajos
  where id = p_id
  for update;

  if not found or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then
    raise exception 'La producción ya fue cerrada o no existe.';
  end if;
  if v_job.tipo = 'resina' and (v_job.producto not in ('Rosin','Resina BHO') or v_job.resultado_unidad <> 'g') then
    raise exception 'La extracción debe producir Rosin o Resina BHO en gramos.';
  end if;
  if v_job.tipo = 'aceite_base' and v_job.resultado_unidad <> 'ml' then
    raise exception 'El aceite debe quedar en mililitros.';
  end if;
  if v_job.tipo = 'capsulas' and (v_job.resultado_unidad <> 'unidades' or v_job.producto not like 'Cápsulas · %') then
    raise exception 'El resultado de esta producción debe ser Cápsulas expresadas en unidades.';
  end if;
  if v_job.resultado_unidad = 'unidades' and p_retorno <> trunc(p_retorno) then
    raise exception 'Las unidades deben ser enteras.';
  end if;

  v_categoria := case v_job.tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  v_perfil := nullif(v_job.resultado_metadata->>'perfil','');
  v_proporcion := nullif(v_job.resultado_metadata->>'proporcion','');
  v_base := nullif(v_job.resultado_metadata->>'base','');
  v_concentracion := nullif(v_job.resultado_metadata->>'concentracion','')::numeric;
  v_tamano_capsula := nullif(v_job.resultado_metadata->>'tamano_gramos','')::numeric;
  v_es_base := v_job.tipo = 'aceite_base';

  if v_job.tipo = 'capsulas' and coalesce(v_tamano_capsula,0) <= 0 then
    raise exception 'Falta el tamaño de las cápsulas.';
  end if;
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id = p_id) then
    raise exception 'Faltan materias primas.';
  end if;

  for v_material in
    select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id = p_id order by stock_id
  loop
    select * into v_stock from public.medrano_laboratorio_stock where id = v_material.stock_id for update;
    if not found or not v_stock.activo or v_stock.categoria <> v_material.categoria or v_stock.unidad <> v_material.unidad then
      raise exception 'Cambió el insumo %. Revisá la comanda.',v_material.nombre;
    end if;
    if v_stock.cantidad < v_material.cantidad then
      raise exception 'Stock insuficiente de %: disponible % %, solicitado % %.',v_material.nombre,v_stock.cantidad,v_stock.unidad,v_material.cantidad,v_material.unidad;
    end if;
    if v_stock.categoria = 'resina' then
      v_resinas := v_resinas + 1;
    end if;
    if v_job.tipo in ('resina','aceite_base','capsulas') and v_stock.categoria in ('flores','resina') then
      v_genetica := v_stock.genetica_id;
      v_lote := v_stock.lote;
      if v_job.tipo = 'capsulas' then
        v_perfil := v_stock.perfil_cannabinoide;
        v_proporcion := v_stock.proporcion_cannabinoides;
      end if;
    end if;
    perform set_config('rainbows.stock_accion','Producción laboratorio · consumo · '||p_id,true);
    update public.medrano_laboratorio_stock set cantidad = cantidad - v_material.cantidad where id = v_stock.id;
  end loop;

  if v_job.tipo = 'capsulas' and v_resinas <> 1 then
    raise exception 'Las cápsulas deben elaborarse con una sola resina trazable.';
  end if;

  if v_job.tipo = 'resina' then
    select id into v_destino from public.medrano_laboratorio_stock
    where categoria = 'resina' and activo and nombre = v_job.producto and unidad = 'g'
      and genetica_id is not distinct from v_genetica and lote is not distinct from v_lote
      and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion
    order by created_at limit 1 for update;
  elsif v_job.tipo = 'aceite_base' then
    v_destino := null;
  elsif v_job.tipo = 'capsulas' then
    select id into v_destino from public.medrano_laboratorio_stock
    where categoria = 'capsulas' and activo and nombre = v_job.producto and unidad = 'unidades'
      and genetica_id is not distinct from v_genetica and lote is not distinct from v_lote
      and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion
    order by created_at limit 1 for update;
  else
    v_destino := v_job.resultado_stock_id;
    if v_destino is not null then
      select * into v_stock from public.medrano_laboratorio_stock where id = v_destino for update;
      if not found or not v_stock.activo or v_stock.categoria <> v_categoria or v_stock.nombre <> v_job.producto
         or v_stock.unidad <> v_job.resultado_unidad then
        raise exception 'El producto de destino cambió. Revisá la comanda.';
      end if;
    end if;
  end if;

  perform set_config('rainbows.stock_accion','Producción laboratorio · resultado · '||p_id,true);
  if v_destino is null then
    v_destino := gen_random_uuid();
    v_resultado_lote := case when v_es_base then 'AB-'||upper(substr(replace(v_destino::text,'-',''),1,6)) else v_lote end;
    insert into public.medrano_laboratorio_stock(
      id,categoria,nombre,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,
      base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad
    ) values(
      v_destino,v_categoria,v_job.producto,v_genetica,v_resultado_lote,v_perfil,v_proporcion,
      v_base,v_concentracion,v_es_base,p_retorno,v_job.resultado_unidad
    );
  else
    update public.medrano_laboratorio_stock set cantidad = cantidad + p_retorno where id = v_destino;
  end if;

  update public.medrano_laboratorio_trabajos
  set estado = 'finalizado',resultado_stock_id = v_destino,resultado_cantidad = p_retorno,
      finalizado_at = now(),finalizado_por = auth.uid(),actualizado_por = auth.uid(),updated_at = now()
  where id = p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,'finalizado',auth.uid());
  perform set_config('rainbows.stock_accion','',true);
end;
$$;

revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;

commit;
