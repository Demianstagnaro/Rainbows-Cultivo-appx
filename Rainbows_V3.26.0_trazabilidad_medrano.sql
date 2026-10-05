-- Rainbows V3.26.0: cremas trazables y operaciones relacionadas de Medrano.
-- Ejecutar una sola vez después de V3.25.15.
begin;

alter table public.medrano_laboratorio_stock
  add column if not exists presentacion_cantidad numeric,
  add column if not exists presentacion_unidad text;

alter table public.medrano_laboratorio_stock drop constraint if exists lab_stock_presentacion_check;
alter table public.medrano_laboratorio_stock add constraint lab_stock_presentacion_check check (
  (presentacion_cantidad is null and presentacion_unidad is null)
  or (presentacion_cantidad>0 and presentacion_unidad in ('g','ml'))
);

create table if not exists public.medrano_operaciones (
  id uuid primary key,
  tipo text not null check (tipo in ('produccion','traslado','dispensa','pago','ajuste')),
  referencia_id uuid,
  estado text not null default 'registrada',
  detalle text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medrano_operaciones_referencia_idx on public.medrano_operaciones(referencia_id);
alter table public.medrano_operaciones enable row level security;
drop policy if exists medrano_operaciones_select on public.medrano_operaciones;
create policy medrano_operaciones_select on public.medrano_operaciones for select to authenticated
  using (public.usuario_rainbows_medrano());
revoke all on public.medrano_operaciones from public,anon,authenticated;
grant select on public.medrano_operaciones to authenticated;

alter table public.medrano_stock_historial
  add column if not exists operacion_id uuid references public.medrano_operaciones(id),
  add column if not exists operacion_tipo text,
  add column if not exists referencia_id uuid;
alter table public.medrano_caja_movimientos
  add column if not exists operacion_id uuid references public.medrano_operaciones(id);
alter table public.medrano_tokens_movimientos
  add column if not exists operacion_id uuid references public.medrano_operaciones(id);
create index if not exists medrano_historial_operacion_idx on public.medrano_stock_historial(operacion_id,created_at);

create or replace function public.registrar_movimiento_stock_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_new jsonb:=to_jsonb(new);v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_sector text;v_categoria text;v_producto text;v_unidad text;v_anterior numeric;v_nueva numeric;
  v_nombre text;v_accion text;v_detalle text;v_genetica text;v_operacion uuid;v_operacion_tipo text;v_referencia uuid;
begin
  if tg_table_name='medrano_dispensario_lotes' then
    v_sector:='dispensario';v_categoria:='flores';v_unidad:='g';v_producto:=coalesce(v_new->>'nombre_historico','Flores');
    v_anterior:=coalesce((v_old->>'gramos_actual')::numeric,0);v_nueva:=coalesce((v_new->>'gramos_actual')::numeric,0);
  else
    v_sector:=case when tg_table_name='medrano_mostrador_productos' then 'dispensario' else 'laboratorio' end;
    v_categoria:=coalesce(v_new->>'categoria','mostrador');v_unidad:=coalesce(v_new->>'unidad','unidades');v_producto:=v_new->>'nombre';
    v_anterior:=coalesce((v_old->>'cantidad')::numeric,0);v_nueva:=coalesce((v_new->>'cantidad')::numeric,0);
  end if;
  v_accion:=case when tg_op='INSERT' then 'Ingreso'
    when v_new->>'activo'='false' and v_old->>'activo' is distinct from 'false' then 'Producto retirado de la lista'
    when v_old->>'activo'='false' and v_new->>'activo'='true' then 'Producto reactivado' else 'Ajuste de stock' end;
  if tg_op='UPDATE' and v_anterior=v_nueva and v_old->>'activo' is not distinct from v_new->>'activo' then return new; end if;
  if v_sector='laboratorio' then
    select g.nombre into v_genetica from public.geneticas g where g.id=nullif(v_new->>'genetica_id','')::uuid;
    v_detalle:=concat_ws(' · ',nullif(v_producto,''),nullif(v_new->>'perfil_cannabinoide',''),
      case when nullif(btrim(v_new->>'proporcion_cannabinoides'),'') is not null then 'Ratio '||replace(btrim(v_new->>'proporcion_cannabinoides'),'-',':') end,
      case when nullif(v_new->>'presentacion_cantidad','') is not null then 'Presentación '||(v_new->>'presentacion_cantidad')||' '||coalesce(v_new->>'presentacion_unidad','') end,
      case when nullif(btrim(v_genetica),'') is not null then 'Genética '||btrim(v_genetica) end,
      case when nullif(btrim(v_new->>'lote'),'') is not null then 'Lote '||btrim(v_new->>'lote') end);
  end if;
  begin v_operacion:=nullif(current_setting('rainbows.operacion_id',true),'')::uuid; exception when others then v_operacion:=null; end;
  v_operacion_tipo:=nullif(current_setting('rainbows.operacion_tipo',true),'');
  begin v_referencia:=nullif(current_setting('rainbows.referencia_id',true),'')::uuid; exception when others then v_referencia:=null; end;
  select coalesce(nullif(btrim(nombre),''),email) into v_nombre from public.perfiles where id=auth.uid();
  insert into public.medrano_stock_historial(sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,detalle,
    usuario_id,usuario_nombre,operacion_id,operacion_tipo,referencia_id)
  values(v_sector,v_categoria,v_producto,coalesce(v_new->>'codigo_lote',v_new->>'lote'),v_anterior,v_nueva,v_unidad,
    coalesce(nullif(current_setting('rainbows.stock_accion',true),''),v_accion),v_detalle,auth.uid(),coalesce(v_nombre,'Sistema'),
    v_operacion,v_operacion_tipo,v_referencia);
  return new;
end; $$;

create or replace function public.guardar_stock_laboratorio_v3(
  p_id uuid,p_categoria text,p_nombre text,p_catalogo_producto_id uuid,p_genetica_id uuid,p_lote text,
  p_perfil_cannabinoide text,p_proporcion_cannabinoides text,p_cantidad numeric,p_unidad text,p_activo boolean,
  p_tipo_insumo text,p_capacidad_envase numeric,p_unidad_capacidad text,p_presentacion_cantidad numeric,p_presentacion_unidad text)
returns void language plpgsql security definer set search_path='' as $$
declare v_producto public.medrano_catalogo_productos%rowtype;v_actual public.medrano_laboratorio_stock%rowtype;v_es_base boolean:=false;
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
    select * into v_producto from public.medrano_catalogo_productos where id=p_catalogo_producto_id and categoria=p_categoria and (activo or p_id is not null);
    if not found then raise exception 'Seleccioná un producto activo de la Lista de precios.'; end if;
    p_nombre:=v_producto.nombre;p_unidad:=v_producto.unidad;
  elsif nullif(btrim(p_nombre),'') is null then raise exception 'Ingresá el producto.';
  end if;
  if length(coalesce(p_proporcion_cannabinoides,''))>60 then raise exception 'El ratio es demasiado largo.'; end if;
  if p_categoria='resina' then
    p_unidad:='g';p_presentacion_cantidad:=null;p_presentacion_unidad:=null;
    if p_nombre not in ('Rosin','Resina BHO') or p_genetica_id is null or nullif(btrim(p_lote),'') is null
       or p_perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or not exists(select 1 from public.geneticas where id=p_genetica_id) then
      raise exception 'Completá producto, perfil de cannabinoides, genética, lote y disponible.'; end if;
  elsif p_categoria='cremas' then
    p_genetica_id:=null;p_unidad:='unidades';
    if p_perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or nullif(btrim(p_lote),'') is null or p_presentacion_cantidad is null or p_presentacion_cantidad<=0 or p_presentacion_unidad<>'g' then
      raise exception 'Completá perfil de cannabinoides, lote y presentación de la crema.'; end if;
  elsif p_categoria<>'aceites' then
    p_genetica_id:=null;p_lote:=null;p_perfil_cannabinoide:=null;p_proporcion_cannabinoides:=null;
    p_presentacion_cantidad:=null;p_presentacion_unidad:=null;
  end if;
  if p_categoria<>'insumos' then p_tipo_insumo:='ingrediente';p_capacidad_envase:=null;p_unidad_capacidad:=null;
  elsif p_tipo_insumo='envase' then
    if p_capacidad_envase is null or p_capacidad_envase<=0 or p_unidad_capacidad not in ('g','ml') then raise exception 'Indicá la capacidad y la unidad del envase.'; end if;
    p_unidad:='unidades';p_presentacion_cantidad:=null;p_presentacion_unidad:=null;
  else p_tipo_insumo:='ingrediente';p_capacidad_envase:=null;p_unidad_capacidad:=null;p_presentacion_cantidad:=null;p_presentacion_unidad:=null;
  end if;
  if p_unidad not in ('g','ml','unidades') then raise exception 'Unidad inválida.'; end if;
  if p_unidad='unidades' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las unidades deben ser cantidades enteras.'; end if;
  if p_id is not null and exists(select 1 from public.medrano_laboratorio_trabajos_materiales where stock_id=p_id)
     and (v_actual.tipo_insumo is distinct from p_tipo_insumo or v_actual.capacidad_envase is distinct from p_capacidad_envase
       or v_actual.unidad_capacidad is distinct from p_unidad_capacidad or v_actual.presentacion_cantidad is distinct from p_presentacion_cantidad
       or v_actual.presentacion_unidad is distinct from p_presentacion_unidad) then
    raise exception 'El tipo, capacidad o presentación no pueden cambiar porque el producto ya tiene trazabilidad.'; end if;
  if p_id is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,catalogo_producto_id,genetica_id,lote,perfil_cannabinoide,
      proporcion_cannabinoides,cantidad,unidad,activo,tokens_por_unidad,tipo_insumo,capacidad_envase,unidad_capacidad,
      presentacion_cantidad,presentacion_unidad)
    values(p_categoria,btrim(p_nombre),p_catalogo_producto_id,p_genetica_id,nullif(btrim(p_lote),''),p_perfil_cannabinoide,
      nullif(btrim(p_proporcion_cannabinoides),''),p_cantidad,p_unidad,p_activo,coalesce(v_producto.tokens_por_unidad,0),
      p_tipo_insumo,p_capacidad_envase,p_unidad_capacidad,p_presentacion_cantidad,p_presentacion_unidad);
  else
    update public.medrano_laboratorio_stock set nombre=btrim(p_nombre),catalogo_producto_id=coalesce(p_catalogo_producto_id,catalogo_producto_id),
      genetica_id=p_genetica_id,lote=nullif(btrim(p_lote),''),perfil_cannabinoide=p_perfil_cannabinoide,
      proporcion_cannabinoides=nullif(btrim(p_proporcion_cannabinoides),''),cantidad=p_cantidad,unidad=p_unidad,activo=p_activo,
      tipo_insumo=p_tipo_insumo,capacidad_envase=p_capacidad_envase,unidad_capacidad=p_unidad_capacidad,
      presentacion_cantidad=p_presentacion_cantidad,presentacion_unidad=p_presentacion_unidad,updated_at=now()
    where id=p_id and categoria=p_categoria and categoria<>'flores';
  end if;
end; $$;

create or replace function public.guardar_produccion_crema(p_id uuid,p_insumos jsonb,p_detalle text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;v_estado text;v_line jsonb;v_stock public.medrano_laboratorio_stock%rowtype;v_resina public.medrano_laboratorio_stock%rowtype;
  v_envase public.medrano_laboratorio_stock%rowtype;v_resinas integer:=0;v_envases integer:=0;v_ingredientes integer:=0;
  v_cantidad numeric;v_previstas numeric;v_producto text;v_metadata jsonb;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para registrar producción.'; end if;
  if p_insumos is null or jsonb_typeof(p_insumos)<>'array' or jsonb_array_length(p_insumos) not between 3 and 20
     or length(coalesce(p_detalle,''))>2000 then raise exception 'Revisá los insumos de la crema.'; end if;
  if p_id is null then
    v_id:=gen_random_uuid();
    insert into public.medrano_laboratorio_trabajos(id,tipo,producto,detalle,resultado_unidad,resultado_metadata,creado_por,produccion_controlada)
    values(v_id,'crema','Crema',btrim(coalesce(p_detalle,'')),'unidades','{}'::jsonb,auth.uid(),true);
  else
    select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id and produccion_controlada for update;
    if not found or v_estado not in ('pendiente','en_proceso') then raise exception 'Solo se puede editar producción pendiente o en proceso.'; end if;
    v_id:=p_id;delete from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id;
  end if;
  for v_line in select value from jsonb_array_elements(p_insumos) loop
    if (v_line->>'cantidad') is null or (v_line->>'cantidad') !~ '^[0-9]+(\.[0-9]+)?$' or (v_line->>'cantidad')::numeric<=0 then raise exception 'Cantidad de insumo inválida.'; end if;
    select * into v_stock from public.medrano_laboratorio_stock where id=(v_line->>'id')::uuid and activo;
    if not found or v_stock.categoria not in ('resina','insumos') then raise exception 'La materia prima no está disponible.'; end if;
    v_cantidad:=(v_line->>'cantidad')::numeric;
    if v_stock.unidad='unidades' and v_cantidad<>trunc(v_cantidad) then raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,v_cantidad,v_stock.unidad);
    if v_stock.categoria='resina' then v_resinas:=v_resinas+1;v_resina:=v_stock;
    elsif v_stock.tipo_insumo='envase' then v_envases:=v_envases+1;v_envase:=v_stock;v_previstas:=v_cantidad;
    else v_ingredientes:=v_ingredientes+1;end if;
  end loop;
  if v_resinas<>1 or v_resina.unidad<>'g' or v_envases<>1 or v_envase.unidad<>'unidades' or v_envase.unidad_capacidad<>'g'
     or coalesce(v_envase.capacidad_envase,0)<=0 or v_ingredientes<1 or v_resina.perfil_cannabinoide is null then
    raise exception 'La crema necesita una resina trazable, ingredientes de base y un frasco con capacidad en gramos.'; end if;
  if position('-' in v_resina.perfil_cannabinoide)>0 and nullif(btrim(v_resina.proporcion_cannabinoides),'') is null then raise exception 'La resina necesita tener cargado su ratio.'; end if;
  v_producto:=left('Crema · '||v_resina.perfil_cannabinoide||case when v_resina.proporcion_cannabinoides is null then '' else ' · Ratio '||replace(v_resina.proporcion_cannabinoides,'-',':') end
    ||' · '||round(v_envase.capacidad_envase,2)::text||' g',180);
  v_metadata:=jsonb_build_object('perfil',v_resina.perfil_cannabinoide,'proporcion',v_resina.proporcion_cannabinoides,
    'genetica_id',v_resina.genetica_id,'lote_resina',v_resina.lote,'resina_producto',v_resina.nombre,
    'presentacion_cantidad',v_envase.capacidad_envase,'presentacion_unidad','g','unidades_previstas',v_previstas,'envase_id',v_envase.id);
  update public.medrano_laboratorio_trabajos set tipo='crema',producto=v_producto,detalle=btrim(coalesce(p_detalle,'')),resultado_unidad='unidades',
    resultado_stock_id=null,resultado_metadata=v_metadata,actualizado_por=case when p_id is null then actualizado_por else auth.uid() end,updated_at=now() where id=v_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
  v_categoria text;v_destino uuid;v_genetica uuid;v_lote text;v_resultado_lote text;v_perfil text;v_proporcion text;
  v_base text;v_concentracion numeric;v_tamano_capsula numeric;v_presentacion numeric;v_presentacion_unidad text;
  v_es_base boolean:=false;v_resinas integer:=0;v_detalle text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para finalizar producción.'; end if;
  if p_retorno is null or p_retorno<=0 or p_retorno::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá el rendimiento real, mayor a cero.'; end if;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then raise exception 'La producción ya fue cerrada o no existe.'; end if;
  if v_job.tipo='resina' and (v_job.producto not in ('Rosin','Resina BHO') or v_job.resultado_unidad<>'g') then raise exception 'La extracción debe producir Rosin o Resina BHO en gramos.'; end if;
  if v_job.tipo='aceite_base' and v_job.resultado_unidad<>'ml' then raise exception 'El aceite debe quedar en mililitros.'; end if;
  if v_job.tipo='aceite_final' and (v_job.resultado_unidad<>'unidades' or v_job.producto not like 'Aceite · %') then raise exception 'El aceite final debe quedar en goteros.'; end if;
  if v_job.tipo='crema' and (v_job.resultado_unidad<>'unidades' or v_job.producto not like 'Crema · %') then raise exception 'La crema debe quedar expresada en frascos.'; end if;
  if v_job.tipo='capsulas' and (v_job.resultado_unidad<>'unidades' or v_job.producto not like 'Cápsulas · %') then raise exception 'El resultado debe ser Cápsulas expresadas en unidades.'; end if;
  if v_job.resultado_unidad='unidades' and p_retorno<>trunc(p_retorno) then raise exception 'Las unidades deben ser enteras.'; end if;
  v_categoria:=case v_job.tipo when 'resina' then 'resina' when 'aceite_base' then 'aceites' when 'aceite_final' then 'aceites' when 'crema' then 'cremas' else 'capsulas' end;
  v_perfil:=nullif(v_job.resultado_metadata->>'perfil','');v_proporcion:=nullif(v_job.resultado_metadata->>'proporcion','');
  v_base:=nullif(v_job.resultado_metadata->>'base','');v_concentracion:=nullif(v_job.resultado_metadata->>'concentracion','')::numeric;
  v_tamano_capsula:=nullif(v_job.resultado_metadata->>'tamano_gramos','')::numeric;
  v_presentacion:=coalesce(nullif(v_job.resultado_metadata->>'presentacion_cantidad','')::numeric,nullif(v_job.resultado_metadata->>'presentacion_ml','')::numeric);
  v_presentacion_unidad:=coalesce(nullif(v_job.resultado_metadata->>'presentacion_unidad',''),case when v_job.resultado_metadata?'presentacion_ml' then 'ml' end);
  v_es_base:=v_job.tipo='aceite_base';
  if v_job.tipo='capsulas' and coalesce(v_tamano_capsula,0)<=0 then raise exception 'Falta el tamaño de las cápsulas.'; end if;
  if v_job.tipo='crema' and (coalesce(v_presentacion,0)<=0 or v_presentacion_unidad<>'g') then raise exception 'Falta la presentación de la crema.'; end if;
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then raise exception 'Faltan materias primas.'; end if;
  v_detalle:='Producción de '||v_job.producto;
  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(p_id,'produccion',p_id,'finalizada',v_detalle,auth.uid())
  on conflict(id) do update set estado='finalizada',detalle=excluded.detalle,updated_at=now();
  perform set_config('rainbows.operacion_id',p_id::text,true);perform set_config('rainbows.operacion_tipo','produccion',true);perform set_config('rainbows.referencia_id',p_id::text,true);
  for v_material in select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id order by stock_id loop
    select * into v_stock from public.medrano_laboratorio_stock where id=v_material.stock_id for update;
    if not found or not v_stock.activo or v_stock.categoria<>v_material.categoria or v_stock.unidad<>v_material.unidad then raise exception 'Cambió el insumo %. Revisá la comanda.',v_material.nombre; end if;
    if v_stock.cantidad<v_material.cantidad then raise exception 'Stock insuficiente de %: disponible % %, solicitado % %.',v_material.nombre,v_stock.cantidad,v_stock.unidad,v_material.cantidad,v_material.unidad; end if;
    if v_stock.categoria='resina' then v_resinas:=v_resinas+1; end if;
    if v_job.tipo in ('resina','aceite_base','crema','capsulas') and v_stock.categoria in ('flores','resina') then
      v_genetica:=v_stock.genetica_id;v_lote:=v_stock.lote;
      if v_job.tipo in ('crema','capsulas') then v_perfil:=v_stock.perfil_cannabinoide;v_proporcion:=v_stock.proporcion_cannabinoides; end if;
    end if;
    perform set_config('rainbows.stock_accion','Producción laboratorio · consumo',true);
    update public.medrano_laboratorio_stock set cantidad=cantidad-v_material.cantidad where id=v_stock.id;
  end loop;
  if v_job.tipo in ('crema','capsulas') and v_resinas<>1 then raise exception 'La elaboración debe usar una sola resina trazable.'; end if;
  if v_job.tipo='resina' then
    select id into v_destino from public.medrano_laboratorio_stock where categoria='resina' and activo and nombre=v_job.producto and unidad='g'
      and genetica_id is not distinct from v_genetica and lote is not distinct from v_lote and perfil_cannabinoide is not distinct from v_perfil
      and proporcion_cannabinoides is not distinct from v_proporcion order by created_at limit 1 for update;
  elsif v_job.tipo='aceite_base' then v_destino:=null;
  elsif v_job.tipo in ('aceite_final','crema','capsulas') then
    select id into v_destino from public.medrano_laboratorio_stock where categoria=v_categoria and activo and nombre=v_job.producto
      and unidad=v_job.resultado_unidad and perfil_cannabinoide is not distinct from v_perfil and proporcion_cannabinoides is not distinct from v_proporcion
      and presentacion_cantidad is not distinct from v_presentacion and presentacion_unidad is not distinct from v_presentacion_unidad
      order by created_at limit 1 for update;
  else v_destino:=v_job.resultado_stock_id;
  end if;
  perform set_config('rainbows.stock_accion','Producción laboratorio · resultado',true);
  if v_destino is null then
    v_destino:=gen_random_uuid();
    v_resultado_lote:=case when v_job.tipo='aceite_base' then 'AB-' when v_job.tipo='aceite_final' then 'AF-' when v_job.tipo='crema' then 'CR-' when v_job.tipo='capsulas' then 'CP-' else '' end
      ||case when v_job.tipo in ('aceite_base','aceite_final','crema','capsulas') then upper(substr(replace(v_destino::text,'-',''),1,6)) else coalesce(v_lote,'') end;
    insert into public.medrano_laboratorio_stock(id,categoria,nombre,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,
      base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad,presentacion_cantidad,presentacion_unidad)
    values(v_destino,v_categoria,v_job.producto,v_genetica,nullif(v_resultado_lote,''),v_perfil,v_proporcion,v_base,v_concentracion,v_es_base,
      p_retorno,v_job.resultado_unidad,v_presentacion,v_presentacion_unidad);
  else update public.medrano_laboratorio_stock set cantidad=cantidad+p_retorno where id=v_destino;
  end if;
  update public.medrano_laboratorio_trabajos set estado='finalizado',resultado_stock_id=v_destino,resultado_cantidad=p_retorno,
    finalizado_at=now(),finalizado_por=auth.uid(),actualizado_por=auth.uid(),updated_at=now() where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,'finalizado',auth.uid());
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end; $$;

create or replace function public.enviar_flores_laboratorio(p_lote_id uuid,p_gramos numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_lote jsonb;v_id uuid:=gen_random_uuid();
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para trasladar stock.'; end if;
  if p_gramos is null or p_gramos<=0 then raise exception 'Ingresá una cantidad mayor a cero.'; end if;
  select to_jsonb(l) into v_lote from public.medrano_dispensario_lotes l where id=p_lote_id for update;
  if v_lote is null or coalesce((v_lote->>'gramos_actual')::numeric,0)<p_gramos then raise exception 'El lote no tiene stock suficiente.'; end if;
  insert into public.medrano_traslados_laboratorio(id,lote_id,nombre,codigo_lote,genetica_id,gramos,enviado_por)
  values(v_id,p_lote_id,coalesce(v_lote->>'nombre_historico','Flores'),coalesce(v_lote->>'codigo_lote','—'),(v_lote->>'genetica_id')::uuid,p_gramos,auth.uid());
  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(v_id,'traslado',v_id,'en_viaje',p_gramos||' g · Dispensario → Laboratorio',auth.uid());
  perform set_config('rainbows.operacion_id',v_id::text,true);perform set_config('rainbows.operacion_tipo','traslado',true);perform set_config('rainbows.referencia_id',v_id::text,true);
  perform set_config('rainbows.stock_accion','Traslado Dispensario → Laboratorio · salida',true);
  update public.medrano_dispensario_lotes set gramos_actual=gramos_actual-p_gramos where id=p_lote_id;
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
  return v_id;
end; $$;

create or replace function public.recibir_flores_laboratorio(p_traslado_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_t public.medrano_traslados_laboratorio;v_disponible numeric;v_usuario text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para recibir stock.'; end if;
  select * into v_t from public.medrano_traslados_laboratorio where id=p_traslado_id for update;
  if not found or v_t.estado<>'en_viaje' then raise exception 'Este traslado ya fue recibido o no existe.'; end if;
  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(p_traslado_id,'traslado',p_traslado_id,'recibido',v_t.gramos||' g · Dispensario → Laboratorio',v_t.enviado_por)
  on conflict(id) do update set estado='recibido',updated_at=now();
  perform set_config('rainbows.operacion_id',p_traslado_id::text,true);perform set_config('rainbows.operacion_tipo','traslado',true);perform set_config('rainbows.referencia_id',p_traslado_id::text,true);
  perform set_config('rainbows.stock_accion','Traslado Dispensario → Laboratorio · recepción',true);
  insert into public.medrano_laboratorio_stock(categoria,nombre,lote,genetica_id,origen_lote_id,cantidad,unidad)
  values('flores',v_t.nombre,v_t.codigo_lote,v_t.genetica_id,v_t.lote_id,v_t.gramos,'g')
  on conflict(origen_lote_id) do update set cantidad=public.medrano_laboratorio_stock.cantidad+excluded.cantidad;
  update public.medrano_traslados_laboratorio set estado='recibido',recibido_por=auth.uid(),recibido_at=now() where id=p_traslado_id;
  select coalesce((to_jsonb(l)->>'gramos_actual')::numeric,0) into v_disponible from public.medrano_dispensario_lotes l where id=v_t.lote_id;
  select coalesce(nullif(btrim(nombre),''),email) into v_usuario from public.perfiles where id=auth.uid();
  insert into public.medrano_stock_historial(sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,detalle,
    usuario_id,usuario_nombre,operacion_id,operacion_tipo,referencia_id)
  values('dispensario','flores',v_t.nombre,v_t.codigo_lote,v_disponible,v_disponible,'g','Traslado recibido por Laboratorio',
    v_t.gramos||' g recibidos sin un nuevo descuento',auth.uid(),coalesce(v_usuario,'Sistema'),p_traslado_id,'traslado',p_traslado_id);
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end; $$;

create or replace function public.dispensar_comanda_multiproducto(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto%rowtype;v_line record;v_accion text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
  if not found or v_c.estado<>'pendiente' then raise exception 'La comanda ya fue cerrada o eliminada.'; end if;
  for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
    if not (select permitir_negativo from public.medrano_configuracion_stock where singleton)
       and public.stock_libre_comanda(v_line.tipo,v_line.origen_id,p_id)<v_line.cantidad then raise exception 'Stock insuficiente para %.',v_line.nombre; end if;
  end loop;
  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(p_id,'dispensa',p_id,'dispensada','Dispensa a '||v_c.paciente_nombre,auth.uid())
  on conflict(id) do update set tipo='dispensa',estado='dispensada',detalle=excluded.detalle,updated_at=now();
  update public.medrano_comandas_multiproducto set estado='dispensada',dispensada_por=auth.uid(),dispensada_at=now(),updated_at=now() where id=p_id;
  perform set_config('rainbows.operacion_id',p_id::text,true);perform set_config('rainbows.operacion_tipo','dispensa',true);perform set_config('rainbows.referencia_id',p_id::text,true);
  for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
    v_accion:='Dispensa a paciente · Detalle: '||v_line.cantidad||' '||v_line.unidad||' de '||v_line.nombre||' · Paciente '||v_c.paciente_nombre;
    perform set_config('rainbows.stock_accion',v_accion,true);
    if v_line.tipo='flores' then update public.medrano_dispensario_lotes set gramos_actual=gramos_actual-v_line.cantidad where id=v_line.origen_id;
    elsif v_line.tipo='mostrador' then update public.medrano_mostrador_productos set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;
    else update public.medrano_laboratorio_stock set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;end if;
    if not found then raise exception 'No se encontró stock para %.',v_line.nombre; end if;
  end loop;
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end; $$;

create or replace function public.vincular_movimiento_financiero_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.comanda_id is not null then
    insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
    values(new.comanda_id,'pago',new.comanda_id,'registrado','Pago y Tokens de comanda',coalesce(new.creado_por,auth.uid()))
    on conflict(id) do update set updated_at=now();
    new.operacion_id:=new.comanda_id;
  end if;
  return new;
end; $$;
drop trigger if exists vincular_caja_operacion on public.medrano_caja_movimientos;
create trigger vincular_caja_operacion before insert or update of comanda_id on public.medrano_caja_movimientos
for each row execute function public.vincular_movimiento_financiero_medrano();
drop trigger if exists vincular_tokens_operacion on public.medrano_tokens_movimientos;
create trigger vincular_tokens_operacion before insert or update of comanda_id on public.medrano_tokens_movimientos
for each row execute function public.vincular_movimiento_financiero_medrano();

insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
select distinct c.id,'dispensa',c.id,c.estado,'Comanda de '||c.paciente_nombre,coalesce(c.dispensada_por,c.creado_por)
from public.medrano_comandas_multiproducto c
where exists(select 1 from public.medrano_caja_movimientos m where m.comanda_id=c.id)
   or exists(select 1 from public.medrano_tokens_movimientos t where t.comanda_id=c.id)
on conflict(id) do nothing;
update public.medrano_caja_movimientos set operacion_id=comanda_id where comanda_id is not null and operacion_id is null;
update public.medrano_tokens_movimientos set operacion_id=comanda_id where comanda_id is not null and operacion_id is null;

revoke all on function public.guardar_stock_laboratorio_v3(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text,numeric,text) from public,anon;
revoke all on function public.guardar_produccion_crema(uuid,jsonb,text) from public,anon;
revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
revoke all on function public.enviar_flores_laboratorio(uuid,numeric),public.recibir_flores_laboratorio(uuid),public.dispensar_comanda_multiproducto(uuid) from public,anon;
grant execute on function public.guardar_stock_laboratorio_v3(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text,numeric,text) to authenticated;
grant execute on function public.guardar_produccion_crema(uuid,jsonb,text) to authenticated;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;
grant execute on function public.enviar_flores_laboratorio(uuid,numeric),public.recibir_flores_laboratorio(uuid) to authenticated;

commit;
