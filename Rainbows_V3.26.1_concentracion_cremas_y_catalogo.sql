-- Rainbows V3.26.1: concentración de cremas y catálogo automático de elaborados.
-- Ejecutar una sola vez después de V3.26.0.
begin;

alter table public.medrano_laboratorio_stock
  add column if not exists nombre_comercial text;

create or replace function public.guardar_produccion_crema(p_id uuid,p_insumos jsonb,p_detalle text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;v_estado text;v_line jsonb;v_stock public.medrano_laboratorio_stock%rowtype;v_resina public.medrano_laboratorio_stock%rowtype;
  v_envase public.medrano_laboratorio_stock%rowtype;v_resinas integer:=0;v_envases integer:=0;v_ingredientes integer:=0;
  v_cantidad numeric;v_resina_cantidad numeric;v_previstas numeric;v_gramos_totales numeric;v_concentracion numeric;
  v_producto text;v_metadata jsonb;
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
    if (v_line->>'cantidad') is null or (v_line->>'cantidad') !~ '^[0-9]+(\.[0-9]+)?$' or (v_line->>'cantidad')::numeric<=0 then
      raise exception 'Cantidad de insumo inválida.'; end if;
    select * into v_stock from public.medrano_laboratorio_stock where id=(v_line->>'id')::uuid and activo;
    if not found or v_stock.categoria not in ('resina','insumos') then raise exception 'La materia prima no está disponible.'; end if;
    v_cantidad:=(v_line->>'cantidad')::numeric;
    if v_stock.unidad='unidades' and v_cantidad<>trunc(v_cantidad) then raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,v_cantidad,v_stock.unidad);
    if v_stock.categoria='resina' then v_resinas:=v_resinas+1;v_resina:=v_stock;v_resina_cantidad:=v_cantidad;
    elsif v_stock.tipo_insumo='envase' then v_envases:=v_envases+1;v_envase:=v_stock;v_previstas:=v_cantidad;
    else v_ingredientes:=v_ingredientes+1;end if;
  end loop;
  if v_resinas<>1 or v_resina.unidad<>'g' or v_envases<>1 or v_envase.unidad<>'unidades' or v_envase.unidad_capacidad<>'g'
     or coalesce(v_envase.capacidad_envase,0)<=0 or v_ingredientes<1 or v_resina.perfil_cannabinoide is null then
    raise exception 'La crema necesita una resina trazable, ingredientes de base y un frasco con capacidad en gramos.'; end if;
  if position('-' in v_resina.perfil_cannabinoide)>0 and nullif(btrim(v_resina.proporcion_cannabinoides),'') is null then
    raise exception 'La resina necesita tener cargado su ratio.'; end if;
  v_gramos_totales:=v_envase.capacidad_envase*v_previstas;
  v_concentracion:=v_gramos_totales/v_resina_cantidad;
  if v_concentracion<=1 then raise exception 'La cantidad de resina debe ser menor al peso final planificado de la crema.'; end if;
  v_producto:=left('Crema · '||v_resina.perfil_cannabinoide
    ||case when v_resina.proporcion_cannabinoides is null then '' else ' · Ratio '||replace(v_resina.proporcion_cannabinoides,'-',':') end
    ||' · 1:'||round(v_concentracion,2)::text||' · '||round(v_envase.capacidad_envase,2)::text||' g',180);
  v_metadata:=jsonb_build_object('perfil',v_resina.perfil_cannabinoide,'proporcion',v_resina.proporcion_cannabinoides,
    'genetica_id',v_resina.genetica_id,'lote_resina',v_resina.lote,'resina_producto',v_resina.nombre,
    'resina_gramos',v_resina_cantidad,'gramos_totales',v_gramos_totales,'concentracion',v_concentracion,
    'presentacion_cantidad',v_envase.capacidad_envase,'presentacion_unidad','g','unidades_previstas',v_previstas,'envase_id',v_envase.id);
  update public.medrano_laboratorio_trabajos set tipo='crema',producto=v_producto,detalle=btrim(coalesce(p_detalle,'')),resultado_unidad='unidades',
    resultado_stock_id=null,resultado_metadata=v_metadata,actualizado_por=case when p_id is null then actualizado_por else auth.uid() end,updated_at=now()
  where id=v_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

-- Cada elaboración final crea su propio lote físico. El nombre comercial queda
-- separado para que distintas genéticas y partidas compartan artículo y precio.
create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
  v_categoria text;v_destino uuid;v_genetica uuid;v_lote text;v_resultado_lote text;v_perfil text;v_proporcion text;
  v_base text;v_concentracion numeric;v_tamano_capsula numeric;v_presentacion numeric;v_presentacion_unidad text;
  v_nombre_comercial text;v_es_base boolean:=false;v_resinas integer:=0;v_detalle text;
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
  if v_job.tipo='crema' and (coalesce(v_presentacion,0)<=0 or v_presentacion_unidad<>'g' or coalesce(v_concentracion,0)<=1) then raise exception 'Falta la presentación o concentración de la crema.'; end if;
  if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then raise exception 'Faltan materias primas.'; end if;
  v_nombre_comercial:=case
    when v_job.tipo='capsulas' then left('Cápsulas · '||round(v_tamano_capsula,3)::text||' g · '||coalesce(v_perfil,'Sin definir')
      ||case when v_proporcion is null then '' else ' · Ratio '||replace(v_proporcion,'-',':') end,180)
    else v_job.producto end;
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
  elsif v_job.tipo in ('aceite_final','crema','capsulas') then v_destino:=null;
  else v_destino:=v_job.resultado_stock_id;
  end if;
  perform set_config('rainbows.stock_accion','Producción laboratorio · resultado',true);
  if v_destino is null then
    v_destino:=gen_random_uuid();
    v_resultado_lote:=case when v_job.tipo='aceite_base' then 'AB-' when v_job.tipo='aceite_final' then 'AF-' when v_job.tipo='crema' then 'CR-' when v_job.tipo='capsulas' then 'CP-' else '' end
      ||case when v_job.tipo in ('aceite_base','aceite_final','crema','capsulas') then upper(substr(replace(v_destino::text,'-',''),1,6)) else coalesce(v_lote,'') end;
    insert into public.medrano_laboratorio_stock(id,categoria,nombre,nombre_comercial,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,
      base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad,presentacion_cantidad,presentacion_unidad)
    values(v_destino,v_categoria,v_job.producto,case when v_es_base then null else v_nombre_comercial end,v_genetica,nullif(v_resultado_lote,''),v_perfil,v_proporcion,
      v_base,v_concentracion,v_es_base,p_retorno,v_job.resultado_unidad,v_presentacion,v_presentacion_unidad);
  else update public.medrano_laboratorio_stock set cantidad=cantidad+p_retorno where id=v_destino;
  end if;
  update public.medrano_laboratorio_trabajos set estado='finalizado',resultado_stock_id=v_destino,resultado_cantidad=p_retorno,
    finalizado_at=now(),finalizado_por=auth.uid(),actualizado_por=auth.uid(),updated_at=now() where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,'finalizado',auth.uid());
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end; $$;

-- Todo producto terminado de Laboratorio queda enlazado al catálogo. Los aceites base
-- a granel se excluyen porque son materias primas intermedias y no productos dispensables.
create or replace function public.catalogar_producto_terminado_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_catalogo public.medrano_catalogo_productos%rowtype;v_nombre text;
begin
  if new.categoria not in ('resina','aceites','cremas','capsulas') or not new.activo or new.es_aceite_base then return new; end if;
  v_nombre:=coalesce(nullif(btrim(new.nombre_comercial),''),new.nombre);
  if new.catalogo_producto_id is not null then
    select * into v_catalogo from public.medrano_catalogo_productos where id=new.catalogo_producto_id;
  end if;
  if new.catalogo_producto_id is null or v_catalogo.id is null or v_catalogo.categoria<>new.categoria then
    insert into public.medrano_catalogo_productos(categoria,nombre,unidad,tokens_por_unidad,activo,creado_por,actualizado_por)
    values(new.categoria,v_nombre,new.unidad,0,true,auth.uid(),auth.uid())
    on conflict (categoria,lower(btrim(nombre))) do update set activo=true,actualizado_por=auth.uid(),updated_at=now()
    returning * into v_catalogo;
  end if;
  new.nombre_comercial:=v_catalogo.nombre;
  new.catalogo_producto_id:=v_catalogo.id;
  new.tokens_por_unidad:=v_catalogo.tokens_por_unidad;
  return new;
end; $$;

drop trigger if exists catalogar_producto_terminado_medrano on public.medrano_laboratorio_stock;
create trigger catalogar_producto_terminado_medrano
before insert or update of nombre,nombre_comercial,categoria,unidad,activo,es_aceite_base,catalogo_producto_id
on public.medrano_laboratorio_stock for each row execute function public.catalogar_producto_terminado_medrano();

-- Recupera las cremas elaboradas con V3.26.0: completa la receta histórica con
-- gramos de resina, gramos finales y concentración.
update public.medrano_laboratorio_trabajos j
set resultado_metadata=j.resultado_metadata||jsonb_build_object(
  'resina_gramos',datos.resina_gramos,
  'gramos_totales',datos.gramos_totales,
  'concentracion',datos.gramos_totales/datos.resina_gramos
),updated_at=now()
from (
  select trabajo.id,
    sum(m.cantidad) filter(where m.categoria='resina') as resina_gramos,
    (trabajo.resultado_metadata->>'presentacion_cantidad')::numeric*(trabajo.resultado_metadata->>'unidades_previstas')::numeric as gramos_totales
  from public.medrano_laboratorio_trabajos trabajo
  join public.medrano_laboratorio_trabajos_materiales m on m.trabajo_id=trabajo.id
  where trabajo.tipo='crema'
    and nullif(trabajo.resultado_metadata->>'presentacion_cantidad','') is not null
    and nullif(trabajo.resultado_metadata->>'unidades_previstas','') is not null
  group by trabajo.id
) datos
where j.id=datos.id and datos.resina_gramos>0 and datos.gramos_totales/datos.resina_gramos>1
  and not (j.resultado_metadata?'concentracion');

-- Si todas las producciones acumuladas en un lote tienen la misma concentración,
-- la completa en stock y agrega 1:X al nombre histórico para distinguir su precio.
update public.medrano_laboratorio_stock s
set concentracion_denominador=datos.concentracion,
  nombre=case when s.nombre not like '% · 1:%' then regexp_replace(s.nombre,' · ([0-9]+([.][0-9]+)?) g$',' · 1:'||round(datos.concentracion,2)::text||' · \1 g') else s.nombre end,
  updated_at=now()
from (
  select j.resultado_stock_id,min((j.resultado_metadata->>'concentracion')::numeric) as concentracion
  from public.medrano_laboratorio_trabajos j
  where j.tipo='crema' and j.resultado_stock_id is not null
    and nullif(j.resultado_metadata->>'concentracion','') is not null
  group by j.resultado_stock_id
  having max((j.resultado_metadata->>'concentracion')::numeric)-min((j.resultado_metadata->>'concentracion')::numeric)<0.000001
) datos
where s.id=datos.resultado_stock_id and datos.concentracion>1 and s.concentracion_denominador is null;

update public.medrano_laboratorio_trabajos j
set producto=s.nombre,updated_at=now()
from public.medrano_laboratorio_stock s
where j.tipo='crema' and j.resultado_stock_id=s.id and j.producto is distinct from s.nombre;

update public.medrano_laboratorio_stock s
set nombre_comercial=datos.nombre_comercial,updated_at=now()
from (
  select distinct on (j.resultado_stock_id) j.resultado_stock_id,
    case when j.tipo='capsulas' then left('Cápsulas · '||round((j.resultado_metadata->>'tamano_gramos')::numeric,3)::text||' g · '
      ||coalesce(nullif(j.resultado_metadata->>'perfil',''),'Sin definir')
      ||case when nullif(j.resultado_metadata->>'proporcion','') is null then '' else ' · Ratio '||replace(j.resultado_metadata->>'proporcion','-',':') end,180)
    else j.producto end as nombre_comercial
  from public.medrano_laboratorio_trabajos j
  where j.resultado_stock_id is not null and j.tipo in ('aceite_final','crema','capsulas')
    and (j.tipo<>'capsulas' or nullif(j.resultado_metadata->>'tamano_gramos','') is not null)
  order by j.resultado_stock_id,j.finalizado_at desc nulls last,j.created_at desc
) datos
where s.id=datos.resultado_stock_id and s.nombre_comercial is distinct from datos.nombre_comercial;

-- Incorpora al catálogo los productos terminados existentes y vincula sus lotes.
insert into public.medrano_catalogo_productos(categoria,nombre,unidad,tokens_por_unidad,activo)
select distinct s.categoria,coalesce(nullif(btrim(s.nombre_comercial),''),s.nombre),s.unidad,0,true
from public.medrano_laboratorio_stock s
where s.activo and s.categoria in ('resina','aceites','cremas','capsulas') and not s.es_aceite_base
on conflict (categoria,lower(btrim(nombre))) do update set activo=true,updated_at=now();

update public.medrano_laboratorio_stock s
set catalogo_producto_id=c.id,tokens_por_unidad=c.tokens_por_unidad,updated_at=now()
from public.medrano_catalogo_productos c
where s.activo and s.categoria=c.categoria and lower(btrim(coalesce(nullif(s.nombre_comercial,''),s.nombre)))=lower(btrim(c.nombre))
  and s.categoria in ('resina','aceites','cremas','capsulas') and not s.es_aceite_base;

revoke all on function public.guardar_produccion_crema(uuid,jsonb,text) from public,anon;
revoke all on function public.finalizar_produccion_laboratorio(uuid,numeric) from public,anon;
grant execute on function public.guardar_produccion_crema(uuid,jsonb,text) to authenticated;
grant execute on function public.finalizar_produccion_laboratorio(uuid,numeric) to authenticated;

commit;
