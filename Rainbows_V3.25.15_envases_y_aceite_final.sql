-- Rainbows V3.25.15: envases trazables y elaboración de aceites finales.
-- Requiere las migraciones de Laboratorio hasta V3.25.12 e incorpora el cierre trazable de V3.25.13.

begin;

alter table public.medrano_laboratorio_stock
  add column if not exists tipo_insumo text not null default 'ingrediente',
  add column if not exists capacidad_envase numeric,
  add column if not exists unidad_capacidad text;

alter table public.medrano_laboratorio_stock drop constraint if exists lab_stock_tipo_insumo_check;
alter table public.medrano_laboratorio_stock add constraint lab_stock_tipo_insumo_check
  check (tipo_insumo in ('ingrediente','envase'));
alter table public.medrano_laboratorio_stock drop constraint if exists lab_stock_envase_check;
alter table public.medrano_laboratorio_stock add constraint lab_stock_envase_check check (
  (tipo_insumo='ingrediente' and capacidad_envase is null and unidad_capacidad is null)
  or
  (categoria='insumos' and tipo_insumo='envase' and capacidad_envase>0 and unidad_capacidad in ('g','ml') and unidad='unidades')
);

alter table public.medrano_laboratorio_trabajos drop constraint if exists medrano_laboratorio_trabajos_tipo_check;
alter table public.medrano_laboratorio_trabajos add constraint medrano_laboratorio_trabajos_tipo_check
  check (tipo in ('comanda_paciente','aceite_base','aceite_final','crema','capsulas','resina','otra_produccion'));

create or replace function public.guardar_stock_laboratorio_v2(
  p_id uuid,p_categoria text,p_nombre text,p_catalogo_producto_id uuid,p_genetica_id uuid,p_lote text,
  p_perfil_cannabinoide text,p_proporcion_cannabinoides text,p_cantidad numeric,p_unidad text,p_activo boolean,
  p_tipo_insumo text,p_capacidad_envase numeric,p_unidad_capacidad text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_producto public.medrano_catalogo_productos%rowtype;
  v_actual public.medrano_laboratorio_stock%rowtype;
  v_es_base boolean:=false;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para modificar stock.'; end if;
  if p_categoria='flores' then raise exception 'Las flores ingresan mediante recepción del Dispensario.'; end if;
  if p_cantidad is null or p_cantidad<0 or p_cantidad::text in ('NaN','Infinity','-Infinity') then raise exception 'Revisá el producto y la cantidad.'; end if;
  if p_id is not null then
    select * into v_actual from public.medrano_laboratorio_stock where id=p_id for update;
    if not found or v_actual.categoria<>p_categoria then raise exception 'No se encontró el producto.'; end if;
    v_es_base:=v_actual.es_aceite_base;
  end if;
  if p_categoria<>'insumos' and not v_es_base then
    select * into v_producto from public.medrano_catalogo_productos
    where id=p_catalogo_producto_id and categoria=p_categoria and (activo or p_id is not null);
    if not found then raise exception 'Seleccioná un producto activo de la Lista de precios.'; end if;
    p_nombre:=v_producto.nombre;p_unidad:=v_producto.unidad;
  elsif nullif(btrim(p_nombre),'') is null then raise exception 'Ingresá el producto.';
  end if;
  if length(coalesce(p_proporcion_cannabinoides,''))>60 then raise exception 'La proporción es demasiado larga.'; end if;
  if p_categoria='resina' then
    if p_nombre not in ('Rosin','Resina BHO') or p_genetica_id is null or nullif(btrim(p_lote),'') is null
       or p_perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or not exists(select 1 from public.geneticas where id=p_genetica_id) then
      raise exception 'Completá producto, perfil de cannabinoides, genética, lote y disponible.'; end if;
  elsif p_categoria<>'aceites' then
    p_genetica_id:=null;p_lote:=null;p_perfil_cannabinoide:=null;p_proporcion_cannabinoides:=null;
  end if;
  if p_categoria<>'insumos' then
    p_tipo_insumo:='ingrediente';p_capacidad_envase:=null;p_unidad_capacidad:=null;
  elsif p_tipo_insumo='envase' then
    if p_capacidad_envase is null or p_capacidad_envase<=0 or p_unidad_capacidad not in ('g','ml') then
      raise exception 'Indicá la capacidad y la unidad del envase.'; end if;
    p_unidad:='unidades';
  else
    p_tipo_insumo:='ingrediente';p_capacidad_envase:=null;p_unidad_capacidad:=null;
  end if;
  if p_unidad not in ('g','ml','unidades') then raise exception 'Unidad inválida.'; end if;
  if p_unidad='unidades' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las unidades deben ser cantidades enteras.'; end if;
  if p_id is not null and exists(select 1 from public.medrano_laboratorio_trabajos_materiales where stock_id=p_id)
     and (v_actual.tipo_insumo is distinct from p_tipo_insumo or v_actual.capacidad_envase is distinct from p_capacidad_envase
       or v_actual.unidad_capacidad is distinct from p_unidad_capacidad) then
    raise exception 'El tipo y la capacidad no pueden cambiar porque el insumo ya tiene trazabilidad.';
  end if;
  if p_id is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,catalogo_producto_id,genetica_id,lote,perfil_cannabinoide,
      proporcion_cannabinoides,cantidad,unidad,activo,tokens_por_unidad,tipo_insumo,capacidad_envase,unidad_capacidad)
    values(p_categoria,btrim(p_nombre),p_catalogo_producto_id,p_genetica_id,nullif(btrim(p_lote),''),p_perfil_cannabinoide,
      nullif(btrim(p_proporcion_cannabinoides),''),p_cantidad,p_unidad,p_activo,coalesce(v_producto.tokens_por_unidad,0),
      p_tipo_insumo,p_capacidad_envase,p_unidad_capacidad);
  else
    update public.medrano_laboratorio_stock set nombre=btrim(p_nombre),catalogo_producto_id=coalesce(p_catalogo_producto_id,catalogo_producto_id),
      genetica_id=p_genetica_id,lote=nullif(btrim(p_lote),''),perfil_cannabinoide=p_perfil_cannabinoide,
      proporcion_cannabinoides=nullif(btrim(p_proporcion_cannabinoides),''),cantidad=p_cantidad,unidad=p_unidad,activo=p_activo,
      tipo_insumo=p_tipo_insumo,capacidad_envase=p_capacidad_envase,unidad_capacidad=p_unidad_capacidad,updated_at=now()
    where id=p_id and categoria=p_categoria and categoria<>'flores';
  end if;
end;
$$;

create or replace function public.guardar_produccion_aceite_final(
  p_id uuid,p_aceites uuid[],p_aceite_puro_id uuid,p_envase_id uuid,p_perfil text,p_proporcion text,
  p_concentracion numeric,p_unidades numeric,p_detalle text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;v_estado text;v_stock public.medrano_laboratorio_stock%rowtype;v_puro public.medrano_laboratorio_stock%rowtype;
  v_envase public.medrano_laboratorio_stock%rowtype;v_nombres text[];v_ratios_text text[];v_ratios numeric[]:=array[]::numeric[];
  v_total_ratio numeric:=0;v_total_volumen numeric;v_equivalente numeric;v_volumen_fuentes numeric:=0;v_cantidad numeric;
  v_producto text;v_metadata jsonb;v_i integer;v_distintos integer;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para registrar producción.'; end if;
  if p_aceites is null or p_perfil not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN')
     or p_concentracion is null or p_concentracion<=1 or p_unidades is null or p_unidades<=0 or p_unidades<>trunc(p_unidades)
     or length(coalesce(p_detalle,''))>2000 then raise exception 'Revisá el perfil, la concentración y la cantidad de goteros.'; end if;
  v_nombres:=string_to_array(p_perfil,'-');
  v_ratios_text:=string_to_array(replace(coalesce(nullif(btrim(p_proporcion),''),'1'),'-',':'),':');
  select count(distinct oil_id) into v_distintos from unnest(p_aceites) as selected_oil(oil_id);
  if cardinality(v_nombres)=1 and cardinality(v_ratios_text)=1 then v_ratios_text:=array['1']; end if;
  if cardinality(p_aceites)<>cardinality(v_nombres) or cardinality(v_ratios_text)<>cardinality(v_nombres)
     or cardinality(p_aceites)<>v_distintos then
    raise exception 'Elegí un aceite base diferente por cada cannabinoide y cargá el ratio completo.'; end if;
  for v_i in 1..cardinality(v_ratios_text) loop
    begin v_ratios:=array_append(v_ratios,replace(v_ratios_text[v_i],',','.')::numeric); exception when others then raise exception 'Ratio inválido.'; end;
    if v_ratios[v_i]<=0 then raise exception 'Ratio inválido.'; end if;
    v_total_ratio:=v_total_ratio+v_ratios[v_i];
  end loop;
  select * into v_puro from public.medrano_laboratorio_stock where id=p_aceite_puro_id and activo for update;
  if not found or v_puro.categoria<>'insumos' or v_puro.tipo_insumo<>'ingrediente' or v_puro.unidad<>'ml' then
    raise exception 'Seleccioná un aceite puro disponible en mililitros.'; end if;
  select * into v_envase from public.medrano_laboratorio_stock where id=p_envase_id and activo for update;
  if not found or v_envase.categoria<>'insumos' or v_envase.tipo_insumo<>'envase' or v_envase.unidad<>'unidades'
     or v_envase.unidad_capacidad<>'ml' or coalesce(v_envase.capacidad_envase,0)<=0 then
    raise exception 'Seleccioná un gotero con capacidad en mililitros.'; end if;
  v_total_volumen:=v_envase.capacidad_envase*p_unidades;v_equivalente:=v_total_volumen/p_concentracion;
  v_producto:=left('Aceite · '||v_puro.nombre||' · '||p_perfil||' · Ratio '||array_to_string(v_ratios,':')||
    ' · 1:'||round(p_concentracion,2)::text||' · '||round(v_envase.capacidad_envase,2)::text||' ml',180);
  if p_id is null then
    v_id:=gen_random_uuid();
    insert into public.medrano_laboratorio_trabajos(id,tipo,producto,detalle,resultado_unidad,resultado_stock_id,resultado_metadata,creado_por,produccion_controlada)
    values(v_id,'aceite_final',v_producto,btrim(coalesce(p_detalle,'')),'unidades',null,'{}'::jsonb,auth.uid(),true);
  else
    select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id and produccion_controlada for update;
    if not found or v_estado not in ('pendiente','en_proceso') then raise exception 'Solo se puede editar producción pendiente o en proceso.'; end if;
    v_id:=p_id;delete from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id;
    update public.medrano_laboratorio_trabajos set tipo='aceite_final',producto=v_producto,detalle=btrim(coalesce(p_detalle,'')),
      resultado_unidad='unidades',resultado_stock_id=null,actualizado_por=auth.uid(),updated_at=now() where id=v_id;
  end if;
  for v_i in 1..cardinality(v_nombres) loop
    select * into v_stock from public.medrano_laboratorio_stock where id=p_aceites[v_i] and activo for update;
    if not found or v_stock.categoria<>'aceites' or v_stock.unidad<>'ml' or not v_stock.es_aceite_base
       or v_stock.perfil_cannabinoide<>v_nombres[v_i] or position('-' in v_stock.perfil_cannabinoide)>0
       or coalesce(v_stock.concentracion_denominador,0)<=1 then
      raise exception 'Cada componente necesita un aceite base simple y trazable del cannabinoide correspondiente.'; end if;
    v_cantidad:=round(v_equivalente*(v_ratios[v_i]/v_total_ratio)*v_stock.concentracion_denominador,6);
    v_volumen_fuentes:=v_volumen_fuentes+v_cantidad;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,'aceites',v_stock.nombre,v_cantidad,'ml');
  end loop;
  v_cantidad:=round(v_total_volumen-v_volumen_fuentes,6);
  if v_cantidad<=0 then raise exception 'La concentración solicitada es demasiado fuerte para los aceites base elegidos.'; end if;
  insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
  values(v_id,v_puro.id,'insumos',v_puro.nombre,v_cantidad,'ml');
  insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
  values(v_id,v_envase.id,'insumos',v_envase.nombre,p_unidades,'unidades');
  v_metadata:=jsonb_build_object('perfil',p_perfil,'proporcion',array_to_string(v_ratios,':'),'concentracion',p_concentracion,
    'base',v_puro.nombre,'unidades_previstas',p_unidades,'presentacion_ml',v_envase.capacidad_envase,
    'aceite_puro_id',v_puro.id,'envase_id',v_envase.id,'volumen_total',v_total_volumen);
  update public.medrano_laboratorio_trabajos set resultado_metadata=v_metadata where id=v_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end;
$$;

create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
  v_categoria text;v_destino uuid;v_genetica uuid;v_lote text;v_resultado_lote text;v_perfil text;v_proporcion text;
  v_base text;v_concentracion numeric;v_tamano_capsula numeric;v_es_base boolean:=false;v_resinas integer:=0;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para finalizar producción.'; end if;
  if p_retorno is null or p_retorno<=0 or p_retorno::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá el rendimiento real, mayor a cero.'; end if;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then raise exception 'La producción ya fue cerrada o no existe.'; end if;
  if v_job.tipo='resina' and (v_job.producto not in ('Rosin','Resina BHO') or v_job.resultado_unidad<>'g') then raise exception 'La extracción debe producir Rosin o Resina BHO en gramos.'; end if;
  if v_job.tipo='aceite_base' and v_job.resultado_unidad<>'ml' then raise exception 'El aceite debe quedar en mililitros.'; end if;
  if v_job.tipo='aceite_final' and (v_job.resultado_unidad<>'unidades' or v_job.producto not like 'Aceite · %') then raise exception 'El aceite final debe quedar en goteros.'; end if;
  if v_job.tipo='capsulas' and (v_job.resultado_unidad<>'unidades' or v_job.producto not like 'Cápsulas · %') then raise exception 'El resultado debe ser Cápsulas expresadas en unidades.'; end if;
  if v_job.resultado_unidad='unidades' and p_retorno<>trunc(p_retorno) then raise exception 'Las unidades deben ser enteras.'; end if;
  v_categoria:=case v_job.tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'aceite_final' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  v_perfil:=nullif(v_job.resultado_metadata->>'perfil','');v_proporcion:=nullif(v_job.resultado_metadata->>'proporcion','');
  v_base:=nullif(v_job.resultado_metadata->>'base','');v_concentracion:=nullif(v_job.resultado_metadata->>'concentracion','')::numeric;
  v_tamano_capsula:=nullif(v_job.resultado_metadata->>'tamano_gramos','')::numeric;v_es_base:=v_job.tipo='aceite_base';
  if v_job.tipo='capsulas' and coalesce(v_tamano_capsula,0)<=0 then raise exception 'Falta el tamaño de las cápsulas.'; end if;
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then raise exception 'Faltan materias primas.'; end if;
  for v_material in select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id order by stock_id loop
    select * into v_stock from public.medrano_laboratorio_stock where id=v_material.stock_id for update;
    if not found or not v_stock.activo or v_stock.categoria<>v_material.categoria or v_stock.unidad<>v_material.unidad then raise exception 'Cambió el insumo %. Revisá la comanda.',v_material.nombre; end if;
    if v_stock.cantidad<v_material.cantidad then raise exception 'Stock insuficiente de %: disponible % %, solicitado % %.',v_material.nombre,v_stock.cantidad,v_stock.unidad,v_material.cantidad,v_material.unidad; end if;
    if v_stock.categoria='resina' then v_resinas:=v_resinas+1; end if;
    if v_job.tipo in ('resina','aceite_base','capsulas') and v_stock.categoria in ('flores','resina') then
      v_genetica:=v_stock.genetica_id;v_lote:=v_stock.lote;
      if v_job.tipo='capsulas' then v_perfil:=v_stock.perfil_cannabinoide;v_proporcion:=v_stock.proporcion_cannabinoides; end if;
    end if;
    perform set_config('rainbows.stock_accion','Producción laboratorio · consumo · '||p_id,true);
    update public.medrano_laboratorio_stock set cantidad=cantidad-v_material.cantidad where id=v_stock.id;
  end loop;
  if v_job.tipo='capsulas' and v_resinas<>1 then raise exception 'Las cápsulas deben elaborarse con una sola resina trazable.'; end if;
  if v_job.tipo='resina' then
    select id into v_destino from public.medrano_laboratorio_stock where categoria='resina' and activo and nombre=v_job.producto and unidad='g'
      and genetica_id is not distinct from v_genetica and lote is not distinct from v_lote and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion order by created_at limit 1 for update;
  elsif v_job.tipo='aceite_base' then v_destino:=null;
  elsif v_job.tipo in ('aceite_final','capsulas') then
    select id into v_destino from public.medrano_laboratorio_stock where categoria=v_categoria and activo and nombre=v_job.producto
      and unidad=v_job.resultado_unidad and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion order by created_at limit 1 for update;
  else
    v_destino:=v_job.resultado_stock_id;
    if v_destino is not null then
      select * into v_stock from public.medrano_laboratorio_stock where id=v_destino for update;
      if not found or not v_stock.activo or v_stock.categoria<>v_categoria or v_stock.nombre<>v_job.producto or v_stock.unidad<>v_job.resultado_unidad then raise exception 'El producto de destino cambió. Revisá la comanda.'; end if;
    end if;
  end if;
  perform set_config('rainbows.stock_accion','Producción laboratorio · resultado · '||p_id,true);
  if v_destino is null then
    v_destino:=gen_random_uuid();
    v_resultado_lote:=case when v_job.tipo='aceite_base' then 'AB-' when v_job.tipo='aceite_final' then 'AF-' else '' end||case when v_job.tipo in ('aceite_base','aceite_final') then upper(substr(replace(v_destino::text,'-',''),1,6)) else coalesce(v_lote,'') end;
    insert into public.medrano_laboratorio_stock(id,categoria,nombre,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,
      base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad)
    values(v_destino,v_categoria,v_job.producto,v_genetica,nullif(v_resultado_lote,''),v_perfil,v_proporcion,v_base,v_concentracion,v_es_base,p_retorno,v_job.resultado_unidad);
  else update public.medrano_laboratorio_stock set cantidad=cantidad+p_retorno where id=v_destino;
  end if;
  update public.medrano_laboratorio_trabajos set estado='finalizado',resultado_stock_id=v_destino,resultado_cantidad=p_retorno,
    finalizado_at=now(),finalizado_por=auth.uid(),actualizado_por=auth.uid(),updated_at=now() where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,'finalizado',auth.uid());
  perform set_config('rainbows.stock_accion','',true);
end;
$$;

revoke all on function public.guardar_stock_laboratorio_v2(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text) from public,anon;
revoke all on function public.guardar_produccion_aceite_final(uuid,uuid[],uuid,uuid,text,text,numeric,numeric,text) from public,anon;
revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
grant execute on function public.guardar_stock_laboratorio_v2(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text) to authenticated;
grant execute on function public.guardar_produccion_aceite_final(uuid,uuid[],uuid,uuid,text,text,numeric,numeric,text) to authenticated;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;

commit;
