-- Producción flexible de Aceites: resina, aceite preparado y aceite puro. Requiere V3.25.1.
begin;

create or replace function public.guardar_produccion_laboratorio(
  p_id uuid,p_tipo text,p_insumos jsonb,p_producto text,p_producto_id uuid,p_unidad text,p_detalle text,p_metadata jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;v_estado text;v_line jsonb;v_stock public.medrano_laboratorio_stock%rowtype;
  v_categoria text;v_resina int:=0;v_flores int:=0;v_insumos int:=0;v_aceites int:=0;v_fuentes int:=0;v_count int:=0;
  v_cantidad numeric;v_total_volumen numeric:=0;v_resina_equivalente numeric:=0;v_concentracion numeric;
  v_perfil text;v_proporcion text;v_base text;v_bases text[]:=array[]::text[];
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para registrar producción.'; end if;
  p_metadata:=coalesce(p_metadata,'{}'::jsonb);
  if p_tipo='resina' then
    if p_producto not in ('Rosin','Resina BHO')
       or p_metadata->>'perfil' not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro') then
      raise exception 'Elegí el producto y el perfil de cannabinoides de la resina.';
    end if;
    p_producto_id:=null;p_unidad:='g';
  elsif p_tipo='aceite_base' then
    p_producto_id:=null;p_unidad:='ml';
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
    insert into public.medrano_laboratorio_trabajos(tipo,producto,detalle,resultado_unidad,resultado_stock_id,resultado_metadata,creado_por,produccion_controlada)
    values(p_tipo,btrim(p_producto),btrim(coalesce(p_detalle,'')),p_unidad,p_producto_id,p_metadata,auth.uid(),true) returning id into v_id;
  else
    select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id and produccion_controlada for update;
    if not found or v_estado not in ('pendiente','en_proceso') then raise exception 'Solo se puede editar producción pendiente o en proceso.'; end if;
    update public.medrano_laboratorio_trabajos set tipo=p_tipo,producto=btrim(p_producto),detalle=btrim(coalesce(p_detalle,'')),
      resultado_unidad=p_unidad,resultado_stock_id=p_producto_id,resultado_metadata=p_metadata,
      actualizado_por=auth.uid(),updated_at=now() where id=p_id;
    delete from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id;v_id:=p_id;
  end if;

  for v_line in select value from jsonb_array_elements(p_insumos) loop
    if jsonb_typeof(v_line)<>'object' or (v_line->>'cantidad') is null
      or (v_line->>'cantidad') !~ '^[0-9]+(\.[0-9]+)?$' or (v_line->>'cantidad')::numeric<=0 then
      raise exception 'Cantidad de insumo inválida.'; end if;
    v_cantidad:=(v_line->>'cantidad')::numeric;
    select * into v_stock from public.medrano_laboratorio_stock where id=(v_line->>'id')::uuid and activo;
    if not found or v_stock.categoria not in ('flores','resina','insumos','aceites') then raise exception 'La materia prima no está disponible.'; end if;
    if v_stock.unidad='unidades' and v_cantidad<>trunc(v_cantidad) then raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,v_cantidad,v_stock.unidad);
    v_count:=v_count+1;
    if v_stock.categoria='flores' then v_flores:=v_flores+1; end if;
    if v_stock.categoria='resina' then
      v_resina:=v_resina+1;
      if p_tipo='aceite_base' then
        if v_stock.unidad<>'g' or v_stock.perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro') then
          raise exception 'La resina debe estar en gramos y tener perfil de cannabinoides.'; end if;
        v_fuentes:=v_fuentes+1;v_total_volumen:=v_total_volumen+v_cantidad;v_resina_equivalente:=v_resina_equivalente+v_cantidad;
      end if;
    elsif v_stock.categoria='aceites' then
      v_aceites:=v_aceites+1;
      if p_tipo<>'aceite_base' or v_stock.unidad<>'ml' or not v_stock.es_aceite_base
         or coalesce(v_stock.concentracion_denominador,0)<=1
         or v_stock.perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro') then
        raise exception 'Sólo se pueden mezclar aceites preparados, trazables y expresados en mililitros.'; end if;
      v_fuentes:=v_fuentes+1;v_total_volumen:=v_total_volumen+v_cantidad;
      v_resina_equivalente:=v_resina_equivalente+(v_cantidad/v_stock.concentracion_denominador);
      if nullif(btrim(v_stock.base_aceite),'') is not null then v_bases:=array_append(v_bases,btrim(v_stock.base_aceite)); end if;
    elsif v_stock.categoria='insumos' then
      v_insumos:=v_insumos+1;
      if p_tipo='aceite_base' then
        if v_stock.unidad<>'ml' then raise exception 'El aceite puro debe estar expresado en mililitros.'; end if;
        v_total_volumen:=v_total_volumen+v_cantidad;v_bases:=array_append(v_bases,btrim(v_stock.nombre));
      end if;
    end if;
  end loop;

  if (p_tipo='resina' and (v_count<>1 or v_flores<>1))
     or (p_tipo='aceite_base' and (v_count<2 or v_fuentes<1 or v_flores<>0))
     or (p_tipo not in ('resina','aceite_base') and (v_resina<>1 or v_flores<>0 or v_aceites<>0)) then
    raise exception 'Extracción: una flor. Aceite: al menos una fuente cannabinoide y otro componente. Otras elaboraciones: una resina y sus insumos.';
  end if;

  if p_tipo='aceite_base' then
    v_concentracion:=v_total_volumen/v_resina_equivalente;
    v_perfil:=nullif(p_metadata->>'perfil','');v_proporcion:=nullif(p_metadata->>'proporcion','');
    v_base:=coalesce(nullif(btrim(p_metadata->>'base'),''),nullif(array_to_string(v_bases,' + '),''),'Base combinada');
    if v_concentracion<=1 or v_perfil not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or length(coalesce(v_proporcion,''))>60 or length(v_base)>180 then
      raise exception 'No se pudo calcular la concentración o el perfil del aceite.'; end if;
    p_metadata:=jsonb_build_object('perfil',v_perfil,'proporcion',v_proporcion,'base',v_base,
      'concentracion',v_concentracion,'resina_equivalente',v_resina_equivalente,'volumen_teorico',v_total_volumen);
    p_producto:=left('Aceite · '||v_base||' · 1:'||round(v_concentracion,2)::text||' · '||v_perfil
      ||case when v_proporcion is null then '' else ' '||v_proporcion end,180);
    update public.medrano_laboratorio_trabajos set producto=p_producto,resultado_unidad='ml',resultado_stock_id=null,
      resultado_metadata=p_metadata where id=v_id;
  end if;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

revoke all on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text,jsonb) from public,anon;
grant execute on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text,jsonb) to authenticated;

commit;
