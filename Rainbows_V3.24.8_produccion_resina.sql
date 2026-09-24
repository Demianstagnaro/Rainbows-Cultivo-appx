-- La extracción produce Rosin o Resina BHO, siempre en gramos y con trazabilidad del lote de flores. Requiere V3.24.7.
begin;

create or replace function public.guardar_produccion_laboratorio(
  p_id uuid,p_tipo text,p_insumos jsonb,p_producto text,p_producto_id uuid,p_unidad text,p_detalle text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;v_estado text;v_line jsonb;v_stock public.medrano_laboratorio_stock%rowtype;
        v_categoria text;v_resina int:=0;v_flores int:=0;v_insumos int:=0;v_count int:=0;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para registrar producción.'; end if;
  if p_tipo='resina' then
    if p_producto not in ('Rosin','Resina BHO') then raise exception 'Elegí Rosin o Resina BHO.'; end if;
    p_producto_id:=null;
    p_unidad:='g';
  end if;
  if p_tipo not in ('resina','aceite_base','crema','capsulas') or p_tipo is null
    or p_insumos is null or jsonb_typeof(p_insumos)<>'array' or jsonb_array_length(p_insumos) not between 1 and 20
    or nullif(btrim(p_producto),'') is null or length(btrim(p_producto))>180
    or length(coalesce(p_detalle,''))>2000 or p_unidad not in ('g','ml','unidades') or p_unidad is null then
    raise exception 'Revisá el tipo, el resultado y los insumos.';
  end if;
  v_categoria:=case p_tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  if p_producto_id is not null and not exists(
    select 1 from public.medrano_laboratorio_stock where id=p_producto_id and categoria=v_categoria and activo
    and unidad=p_unidad and nombre=btrim(p_producto)) then raise exception 'El producto de destino cambió; actualizá la comanda.'; end if;
  if p_id is null then
    insert into public.medrano_laboratorio_trabajos(tipo,producto,detalle,resultado_unidad,resultado_stock_id,creado_por,produccion_controlada)
    values(p_tipo,btrim(p_producto),btrim(coalesce(p_detalle,'')),p_unidad,p_producto_id,auth.uid(),true) returning id into v_id;
  else
    select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id and produccion_controlada for update;
    if not found or v_estado not in ('pendiente','en_proceso') then raise exception 'Solo se puede editar producción pendiente o en proceso.'; end if;
    update public.medrano_laboratorio_trabajos set tipo=p_tipo,producto=btrim(p_producto),detalle=btrim(coalesce(p_detalle,'')),
      resultado_unidad=p_unidad,resultado_stock_id=p_producto_id,actualizado_por=auth.uid(),updated_at=now() where id=p_id;
    delete from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id;
    v_id:=p_id;
  end if;
  for v_line in select value from jsonb_array_elements(p_insumos) loop
    if jsonb_typeof(v_line)<>'object' or (v_line->>'cantidad') is null
      or (v_line->>'cantidad') !~ '^[0-9]+(\.[0-9]+)?$'
      or (v_line->>'cantidad')::numeric<=0 then raise exception 'Cantidad de insumo inválida.'; end if;
    select * into v_stock from public.medrano_laboratorio_stock where id=(v_line->>'id')::uuid and activo;
    if not found or v_stock.categoria not in ('flores','resina','insumos') then raise exception 'La materia prima no está disponible.'; end if;
    if v_stock.unidad='unidades' and (v_line->>'cantidad')::numeric<>trunc((v_line->>'cantidad')::numeric) then
      raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,(v_line->>'cantidad')::numeric,v_stock.unidad);
    v_count:=v_count+1;
    if v_stock.categoria='flores' then v_flores:=v_flores+1; end if;
    if v_stock.categoria='resina' then v_resina:=v_resina+1; end if;
    if v_stock.categoria='insumos' then v_insumos:=v_insumos+1; end if;
  end loop;
  if (p_tipo='resina' and (v_count<>1 or v_flores<>1))
     or (p_tipo<>'resina' and (v_resina<>1 or v_flores<>0))
     or (p_tipo='aceite_base' and v_insumos<1) then
    raise exception 'Extracción: una flor. Aceite: resina y un insumo de aceite. Cremas y cápsulas: resina y los insumos que correspondan.';
  end if;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
        v_categoria text;v_destino uuid;v_genetica uuid;v_lote text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para finalizar producción.'; end if;
  if p_retorno is null or p_retorno<=0 or p_retorno::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá el rendimiento real, mayor a cero.'; end if;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then
    raise exception 'La producción ya fue cerrada o no existe.'; end if;
  if v_job.tipo='resina' and (v_job.producto not in ('Rosin','Resina BHO') or v_job.resultado_unidad<>'g') then
    raise exception 'La extracción debe producir Rosin o Resina BHO en gramos.';
  end if;
  if v_job.resultado_unidad='unidades' and p_retorno<>trunc(p_retorno) then raise exception 'Las unidades deben ser enteras.'; end if;
  v_categoria:=case v_job.tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then raise exception 'Faltan materias primas.'; end if;
  for v_material in select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id order by stock_id loop
    select * into v_stock from public.medrano_laboratorio_stock where id=v_material.stock_id for update;
    if not found or not v_stock.activo or v_stock.categoria<>v_material.categoria or v_stock.unidad<>v_material.unidad then
      raise exception 'Cambió el insumo %. Revisá la comanda.',v_material.nombre; end if;
    if v_stock.cantidad<v_material.cantidad then raise exception 'Stock insuficiente de %: disponible % %, solicitado % %.',
      v_material.nombre,v_stock.cantidad,v_stock.unidad,v_material.cantidad,v_material.unidad; end if;
    if v_job.tipo='resina' and v_stock.categoria='flores' then
      v_genetica:=v_stock.genetica_id;
      v_lote:=v_stock.lote;
    end if;
    perform set_config('rainbows.stock_accion','Producción laboratorio · consumo · '||p_id,true);
    update public.medrano_laboratorio_stock set cantidad=cantidad-v_material.cantidad where id=v_stock.id;
  end loop;

  if v_job.tipo='resina' then
    select id into v_destino
    from public.medrano_laboratorio_stock
    where categoria='resina' and activo and nombre=v_job.producto and unidad='g'
      and genetica_id is not distinct from v_genetica
      and lote is not distinct from v_lote
    order by created_at limit 1 for update;
  else
    v_destino:=v_job.resultado_stock_id;
    if v_destino is not null then
      select * into v_stock from public.medrano_laboratorio_stock where id=v_destino for update;
      if not found or not v_stock.activo or v_stock.categoria<>v_categoria or v_stock.nombre<>v_job.producto
         or v_stock.unidad<>v_job.resultado_unidad then raise exception 'El producto de destino cambió. Revisá la comanda.'; end if;
    end if;
  end if;

  perform set_config('rainbows.stock_accion','Producción laboratorio · resultado · '||p_id,true);
  if v_destino is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,genetica_id,lote,cantidad,unidad)
    values(v_categoria,v_job.producto,v_genetica,v_lote,p_retorno,v_job.resultado_unidad) returning id into v_destino;
  else
    update public.medrano_laboratorio_stock set cantidad=cantidad+p_retorno where id=v_destino;
  end if;
  update public.medrano_laboratorio_trabajos set estado='finalizado',resultado_stock_id=v_destino,
    resultado_cantidad=p_retorno,finalizado_at=now(),finalizado_por=auth.uid(),actualizado_por=auth.uid(),updated_at=now()
  where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,'finalizado',auth.uid());
  perform set_config('rainbows.stock_accion','',true);
end; $$;

revoke all on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text) from public,anon;
revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
grant execute on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text) to authenticated;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;

commit;
