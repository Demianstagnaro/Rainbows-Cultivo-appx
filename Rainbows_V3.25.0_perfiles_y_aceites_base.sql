-- Perfiles full spectrum y producción trazable de aceites base a granel. Requiere V3.24.8.
begin;

alter table public.medrano_laboratorio_stock
  add column if not exists perfil_cannabinoide text,
  add column if not exists proporcion_cannabinoides text,
  add column if not exists base_aceite text,
  add column if not exists concentracion_denominador numeric,
  add column if not exists es_aceite_base boolean not null default false;

alter table public.medrano_laboratorio_stock drop constraint if exists lab_stock_perfil_cannabinoide_check;
alter table public.medrano_laboratorio_stock add constraint lab_stock_perfil_cannabinoide_check
  check (perfil_cannabinoide is null or perfil_cannabinoide in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro'));
alter table public.medrano_laboratorio_stock drop constraint if exists lab_stock_concentracion_check;
alter table public.medrano_laboratorio_stock add constraint lab_stock_concentracion_check
  check (concentracion_denominador is null or concentracion_denominador>1);

alter table public.medrano_laboratorio_trabajos
  add column if not exists resultado_metadata jsonb not null default '{}'::jsonb;

drop function if exists public.guardar_stock_laboratorio(uuid,text,text,uuid,text,numeric,text,boolean);
create or replace function public.guardar_stock_laboratorio(
  p_id uuid,p_categoria text,p_nombre text,p_genetica_id uuid,p_lote text,
  p_perfil_cannabinoide text,p_proporcion_cannabinoides text,
  p_cantidad numeric,p_unidad text,p_activo boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para modificar stock.'; end if;
  if p_categoria='flores' then raise exception 'Las flores ingresan mediante recepción del Dispensario.'; end if;
  if p_cantidad is null or p_cantidad<0 or p_cantidad::text in ('NaN','Infinity','-Infinity')
     or nullif(btrim(p_nombre),'') is null then raise exception 'Revisá el producto y la cantidad.'; end if;
  if length(coalesce(p_proporcion_cannabinoides,''))>60 then raise exception 'La proporción es demasiado larga.'; end if;

  if p_categoria='resina' then
    p_unidad:='g';
    if p_activo and (p_nombre not in ('Rosin','Resina BHO') or p_genetica_id is null
       or nullif(btrim(p_lote),'') is null
       or p_perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or not exists(select 1 from public.geneticas where id=p_genetica_id)) then
      raise exception 'Completá producto, perfil predominante, genética, lote y disponible.';
    end if;
  elsif p_categoria<>'aceites' then
    p_genetica_id:=null;p_lote:=null;p_perfil_cannabinoide:=null;p_proporcion_cannabinoides:=null;
  end if;

  if p_unidad not in ('g','ml','unidades') then raise exception 'Unidad inválida.'; end if;
  if p_unidad='unidades' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las unidades deben ser cantidades enteras.'; end if;
  if p_id is not null and p_categoria not in ('resina','aceites')
     and exists(select 1 from public.medrano_laboratorio_stock where id=p_id and unidad<>p_unidad) then
    raise exception 'No se puede cambiar la unidad de un producto existente.';
  end if;

  if p_id is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,cantidad,unidad,activo)
    values(p_categoria,btrim(p_nombre),p_genetica_id,nullif(btrim(p_lote),''),p_perfil_cannabinoide,
      nullif(btrim(p_proporcion_cannabinoides),''),p_cantidad,p_unidad,p_activo);
  else
    update public.medrano_laboratorio_stock set nombre=btrim(p_nombre),genetica_id=p_genetica_id,
      lote=nullif(btrim(p_lote),''),perfil_cannabinoide=p_perfil_cannabinoide,
      proporcion_cannabinoides=nullif(btrim(p_proporcion_cannabinoides),''),cantidad=p_cantidad,unidad=p_unidad,activo=p_activo
    where id=p_id and categoria=p_categoria and categoria<>'flores';
    if not found then raise exception 'No se encontró el producto.'; end if;
  end if;
end; $$;

drop function if exists public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text);
create or replace function public.guardar_produccion_laboratorio(
  p_id uuid,p_tipo text,p_insumos jsonb,p_producto text,p_producto_id uuid,p_unidad text,p_detalle text,p_metadata jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;v_estado text;v_line jsonb;v_stock public.medrano_laboratorio_stock%rowtype;
        v_resina_stock public.medrano_laboratorio_stock%rowtype;v_base_stock public.medrano_laboratorio_stock%rowtype;
        v_categoria text;v_resina int:=0;v_flores int:=0;v_insumos int:=0;v_count int:=0;
        v_resina_cantidad numeric;v_base_cantidad numeric;v_concentracion numeric;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para registrar producción.'; end if;
  p_metadata:=coalesce(p_metadata,'{}'::jsonb);
  if p_tipo='resina' then
    if p_producto not in ('Rosin','Resina BHO')
       or p_metadata->>'perfil' not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro') then
      raise exception 'Elegí el producto y el perfil predominante de la resina.';
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
    select * into v_stock from public.medrano_laboratorio_stock where id=(v_line->>'id')::uuid and activo;
    if not found or v_stock.categoria not in ('flores','resina','insumos') then raise exception 'La materia prima no está disponible.'; end if;
    if v_stock.unidad='unidades' and (v_line->>'cantidad')::numeric<>trunc((v_line->>'cantidad')::numeric) then
      raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,(v_line->>'cantidad')::numeric,v_stock.unidad);
    v_count:=v_count+1;
    if v_stock.categoria='flores' then v_flores:=v_flores+1; end if;
    if v_stock.categoria='resina' then
      v_resina:=v_resina+1;v_resina_stock:=v_stock;v_resina_cantidad:=(v_line->>'cantidad')::numeric;
    end if;
    if v_stock.categoria='insumos' then
      v_insumos:=v_insumos+1;v_base_stock:=v_stock;v_base_cantidad:=(v_line->>'cantidad')::numeric;
    end if;
  end loop;

  if (p_tipo='resina' and (v_count<>1 or v_flores<>1))
     or (p_tipo='aceite_base' and (v_count<>2 or v_resina<>1 or v_insumos<>1))
     or (p_tipo not in ('resina','aceite_base') and (v_resina<>1 or v_flores<>0)) then
    raise exception 'Extracción: una flor. Aceite base: una resina y un aceite. Otras elaboraciones: una resina y sus insumos.';
  end if;

  if p_tipo='aceite_base' then
    if v_resina_stock.unidad<>'g' or v_base_stock.unidad<>'ml' then raise exception 'La resina debe estar en gramos y el aceite en mililitros.'; end if;
    if v_resina_stock.perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro') then
      raise exception 'Primero completá el perfil predominante de la resina.'; end if;
    v_concentracion:=(v_resina_cantidad+v_base_cantidad)/v_resina_cantidad;
    if v_concentracion<=1 then raise exception 'La cantidad de aceite debe ser mayor a cero.'; end if;
    p_metadata:=jsonb_build_object('perfil',v_resina_stock.perfil_cannabinoide,
      'proporcion',v_resina_stock.proporcion_cannabinoides,'base',v_base_stock.nombre,'concentracion',v_concentracion);
    p_producto:=left('Aceite base · '||v_base_stock.nombre||' · 1:'||round(v_concentracion,2)::text||' · '
      ||coalesce(v_resina_stock.perfil_cannabinoide,'Sin definir')
      ||case when v_resina_stock.proporcion_cannabinoides is null then '' else ' '||v_resina_stock.proporcion_cannabinoides end,180);
    update public.medrano_laboratorio_trabajos set producto=p_producto,resultado_unidad='ml',resultado_stock_id=null,
      resultado_metadata=p_metadata where id=v_id;
  end if;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
        v_categoria text;v_destino uuid;v_genetica uuid;v_lote text;v_resultado_lote text;
        v_perfil text;v_proporcion text;v_base text;v_concentracion numeric;v_es_base boolean:=false;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para finalizar producción.'; end if;
  if p_retorno is null or p_retorno<=0 or p_retorno::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá el rendimiento real, mayor a cero.'; end if;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then raise exception 'La producción ya fue cerrada o no existe.'; end if;
  if v_job.tipo='resina' and (v_job.producto not in ('Rosin','Resina BHO') or v_job.resultado_unidad<>'g') then
    raise exception 'La extracción debe producir Rosin o Resina BHO en gramos.'; end if;
  if v_job.tipo='aceite_base' and v_job.resultado_unidad<>'ml' then raise exception 'El aceite base debe quedar en mililitros.'; end if;
  if v_job.resultado_unidad='unidades' and p_retorno<>trunc(p_retorno) then raise exception 'Las unidades deben ser enteras.'; end if;
  v_categoria:=case v_job.tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  v_perfil:=nullif(v_job.resultado_metadata->>'perfil','');v_proporcion:=nullif(v_job.resultado_metadata->>'proporcion','');
  v_base:=nullif(v_job.resultado_metadata->>'base','');v_concentracion:=nullif(v_job.resultado_metadata->>'concentracion','')::numeric;
  v_es_base:=v_job.tipo='aceite_base';
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then raise exception 'Faltan materias primas.'; end if;
  for v_material in select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id order by stock_id loop
    select * into v_stock from public.medrano_laboratorio_stock where id=v_material.stock_id for update;
    if not found or not v_stock.activo or v_stock.categoria<>v_material.categoria or v_stock.unidad<>v_material.unidad then
      raise exception 'Cambió el insumo %. Revisá la comanda.',v_material.nombre; end if;
    if v_stock.cantidad<v_material.cantidad then raise exception 'Stock insuficiente de %: disponible % %, solicitado % %.',
      v_material.nombre,v_stock.cantidad,v_stock.unidad,v_material.cantidad,v_material.unidad; end if;
    if v_job.tipo in ('resina','aceite_base') and v_stock.categoria in ('flores','resina') then
      v_genetica:=v_stock.genetica_id;v_lote:=v_stock.lote;
    end if;
    perform set_config('rainbows.stock_accion','Producción laboratorio · consumo · '||p_id,true);
    update public.medrano_laboratorio_stock set cantidad=cantidad-v_material.cantidad where id=v_stock.id;
  end loop;

  if v_job.tipo='resina' then
    select id into v_destino from public.medrano_laboratorio_stock
    where categoria='resina' and activo and nombre=v_job.producto and unidad='g'
      and genetica_id is not distinct from v_genetica and lote is not distinct from v_lote
      and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion
    order by created_at limit 1 for update;
  elsif v_job.tipo='aceite_base' then
    v_destino:=null;
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
    v_destino:=gen_random_uuid();
    v_resultado_lote:=case when v_es_base then 'AB-'||upper(substr(replace(v_destino::text,'-',''),1,6)) else v_lote end;
    insert into public.medrano_laboratorio_stock(id,categoria,nombre,genetica_id,lote,perfil_cannabinoide,
      proporcion_cannabinoides,base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad)
    values(v_destino,v_categoria,v_job.producto,v_genetica,v_resultado_lote,v_perfil,v_proporcion,v_base,
      v_concentracion,v_es_base,p_retorno,v_job.resultado_unidad);
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

revoke all on function public.guardar_stock_laboratorio(uuid,text,text,uuid,text,text,text,numeric,text,boolean) from public,anon;
revoke all on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text,jsonb) from public,anon;
revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
grant execute on function public.guardar_stock_laboratorio(uuid,text,text,uuid,text,text,text,numeric,text,boolean) to authenticated;
grant execute on function public.guardar_produccion_laboratorio(uuid,text,jsonb,text,uuid,text,text,jsonb) to authenticated;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;

commit;
