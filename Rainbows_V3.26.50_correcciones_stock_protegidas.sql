-- Rainbows V3.26.50
-- Correcciones manuales de stock protegidas, atómicas y con motivo obligatorio.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.49.

begin;

alter table public.medrano_operaciones
  drop constraint if exists medrano_operaciones_tipo_check;
alter table public.medrano_operaciones
  add constraint medrano_operaciones_tipo_check check (
    tipo in ('produccion','traslado','dispensa','pago','ajuste','correccion')
  );

create or replace function public.corregir_stock_medrano(
  p_sector text,
  p_categoria text,
  p_stock_id uuid,
  p_cantidad numeric,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_anterior numeric;
  v_unidad text;
  v_producto text;
  v_operacion_id uuid:=gen_random_uuid();
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para corregir stock.';
  end if;
  if p_stock_id is null or p_cantidad is null or p_cantidad<0
     or p_cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá una cantidad válida, mayor o igual a cero.';
  end if;
  if v_motivo is null or length(v_motivo)<5 or length(v_motivo)>500 then
    raise exception 'Explicá el motivo de la corrección (entre 5 y 500 caracteres).';
  end if;

  if p_sector='dispensario' and p_categoria='mostrador' then
    select cantidad,'unidades',nombre
      into v_anterior,v_unidad,v_producto
    from public.medrano_mostrador_productos
    where id=p_stock_id and activo
    for update;
  elsif p_sector='dispensario' and p_categoria='flores' then
    select gramos_actual,'g',coalesce(nullif(btrim(nombre_historico),''),'Flores')
      into v_anterior,v_unidad,v_producto
    from public.medrano_dispensario_lotes
    where id=p_stock_id
    for update;
  elsif p_sector='laboratorio'
        and p_categoria in ('flores','resina','aceites','cremas','capsulas','insumos') then
    select cantidad,unidad,nombre
      into v_anterior,v_unidad,v_producto
    from public.medrano_laboratorio_stock
    where id=p_stock_id and categoria=p_categoria and activo
    for update;
  else
    raise exception 'El sector o la categoría no son válidos.';
  end if;

  if not found then
    raise exception 'El producto ya no existe o no está activo. Actualizá la pantalla.';
  end if;
  if v_unidad='unidades' and p_cantidad<>trunc(p_cantidad) then
    raise exception '“%” debe expresarse en unidades enteras.',v_producto;
  end if;
  if p_cantidad=v_anterior then
    raise exception 'La cantidad nueva es igual al stock actual.';
  end if;

  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(
    v_operacion_id,'correccion',p_stock_id,'registrada',
    'Corrección de '||v_producto||' · '||v_anterior||' → '||p_cantidad||' '||v_unidad||' · Motivo: '||v_motivo,
    auth.uid()
  );

  perform set_config('rainbows.operacion_id',v_operacion_id::text,true);
  perform set_config('rainbows.operacion_tipo','correccion',true);
  perform set_config('rainbows.referencia_id',p_stock_id::text,true);
  perform set_config('rainbows.stock_accion','Corrección manual de stock · Motivo: '||v_motivo,true);

  if p_sector='dispensario' and p_categoria='mostrador' then
    update public.medrano_mostrador_productos
    set cantidad=p_cantidad,updated_at=now()
    where id=p_stock_id;
  elsif p_sector='dispensario' and p_categoria='flores' then
    update public.medrano_dispensario_lotes
    set gramos_actual=p_cantidad
    where id=p_stock_id;
  else
    update public.medrano_laboratorio_stock
    set cantidad=p_cantidad,updated_at=now()
    where id=p_stock_id;
  end if;

  perform set_config('rainbows.stock_accion','',true);
  perform set_config('rainbows.operacion_id','',true);
  perform set_config('rainbows.operacion_tipo','',true);
  perform set_config('rainbows.referencia_id','',true);
end;
$$;

create or replace function public.retirar_stock_mostrador(
  p_stock_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_item public.medrano_mostrador_productos%rowtype;
  v_operacion_id uuid:=gen_random_uuid();
  v_motivo text:=nullif(btrim(coalesce(p_motivo,'')),'');
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para retirar productos.';
  end if;
  if v_motivo is null or length(v_motivo)<5 or length(v_motivo)>500 then
    raise exception 'Explicá el motivo del retiro (entre 5 y 500 caracteres).';
  end if;
  select * into v_item
  from public.medrano_mostrador_productos
  where id=p_stock_id and activo
  for update;
  if not found then raise exception 'El producto ya no está activo.'; end if;

  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(v_operacion_id,'correccion',p_stock_id,'registrada',
    'Retiro de '||v_item.nombre||' · Motivo: '||v_motivo,auth.uid());
  perform set_config('rainbows.operacion_id',v_operacion_id::text,true);
  perform set_config('rainbows.operacion_tipo','correccion',true);
  perform set_config('rainbows.referencia_id',p_stock_id::text,true);
  perform set_config('rainbows.stock_accion','Producto retirado de la lista · Motivo: '||v_motivo,true);
  update public.medrano_mostrador_productos
  set activo=false,updated_at=now()
  where id=p_stock_id;
  perform set_config('rainbows.stock_accion','',true);
  perform set_config('rainbows.operacion_id','',true);
  perform set_config('rainbows.operacion_tipo','',true);
  perform set_config('rainbows.referencia_id','',true);
end;
$$;

create or replace function public.guardar_stock_laboratorio_v4(
  p_id uuid,p_categoria text,p_nombre text,p_catalogo_producto_id uuid,p_genetica_id uuid,p_lote text,
  p_perfil_cannabinoide text,p_proporcion_cannabinoides text,p_cantidad numeric,p_unidad text,p_activo boolean,
  p_tipo_insumo text,p_capacidad_envase numeric,p_unidad_capacidad text,p_presentacion_cantidad numeric,
  p_presentacion_unidad text,p_motivo_correccion text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actual public.medrano_laboratorio_stock%rowtype;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para modificar stock.';
  end if;

  if p_id is null then
    perform public.guardar_stock_laboratorio_v3(
      p_id,p_categoria,p_nombre,p_catalogo_producto_id,p_genetica_id,p_lote,
      p_perfil_cannabinoide,p_proporcion_cannabinoides,p_cantidad,p_unidad,p_activo,
      p_tipo_insumo,p_capacidad_envase,p_unidad_capacidad,p_presentacion_cantidad,p_presentacion_unidad
    );
    return;
  end if;

  select * into v_actual
  from public.medrano_laboratorio_stock
  where id=p_id
  for update;
  if not found or v_actual.categoria<>p_categoria then
    raise exception 'No se encontró el producto.';
  end if;

  -- Guarda los datos descriptivos conservando momentáneamente la existencia.
  -- Si cambia la cantidad, la segunda función registra la corrección dentro
  -- de esta misma transacción.
  perform public.guardar_stock_laboratorio_v3(
    p_id,p_categoria,p_nombre,p_catalogo_producto_id,p_genetica_id,p_lote,
    p_perfil_cannabinoide,p_proporcion_cannabinoides,v_actual.cantidad,p_unidad,p_activo,
    p_tipo_insumo,p_capacidad_envase,p_unidad_capacidad,p_presentacion_cantidad,p_presentacion_unidad
  );

  if p_cantidad is distinct from v_actual.cantidad then
    perform public.corregir_stock_medrano(
      'laboratorio',p_categoria,p_id,p_cantidad,p_motivo_correccion
    );
  end if;
end;
$$;

revoke all on function public.corregir_stock_medrano(text,text,uuid,numeric,text) from public,anon;
revoke all on function public.retirar_stock_mostrador(uuid,text) from public,anon;
revoke all on function public.guardar_stock_laboratorio_v4(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text,numeric,text,text) from public,anon;
revoke execute on function public.guardar_stock_laboratorio_v3(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text,numeric,text) from authenticated;
revoke update on table public.medrano_mostrador_productos from authenticated;
grant execute on function public.corregir_stock_medrano(text,text,uuid,numeric,text) to authenticated;
grant execute on function public.retirar_stock_mostrador(uuid,text) to authenticated;
grant execute on function public.guardar_stock_laboratorio_v4(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean,text,numeric,text,numeric,text,text) to authenticated;

commit;
