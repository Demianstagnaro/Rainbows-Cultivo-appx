-- Rainbows 3.26.88
begin;

-- Consultar después de bloquear la fila de stock para serializar cambios y reservas.
create or replace function public.stock_reservado_medrano(
  p_sector text,p_categoria text,p_stock_id uuid,p_excluir_trabajo uuid
)
returns numeric language sql volatile set search_path='' as $$
  select coalesce((
    select sum(i.cantidad)
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente' and c.eliminada_at is null and i.tipo=p_categoria and i.origen_id=p_stock_id
      and (p_sector='dispensario' or p_categoria not in ('flores','mostrador'))
  ),0)+coalesce((
    select sum(m.cantidad)
    from public.medrano_laboratorio_trabajos_materiales m
    join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
    where p_sector='laboratorio' and m.stock_id=p_stock_id
      and m.trabajo_id is distinct from p_excluir_trabajo
      and t.produccion_controlada and t.estado='en_proceso'
  ),0);
$$;
revoke all on function public.stock_reservado_medrano(text,text,uuid,uuid) from public,anon,authenticated;


create or replace function public.finalizar_produccion_laboratorio(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;v_material record;v_stock public.medrano_laboratorio_stock%rowtype;
  v_disponible numeric;
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
    v_disponible:=v_stock.cantidad-public.stock_reservado_medrano('laboratorio',v_stock.categoria,v_stock.id,p_id);
    if v_material.cantidad>v_disponible then
      raise exception 'Stock insuficiente de %: libre de otras reservas % %, solicitado % %.',
        v_material.nombre,greatest(v_disponible,0),v_stock.unidad,v_material.cantidad,v_material.unidad;
    end if;
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
  v_reservado numeric;
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

  v_reservado:=public.stock_reservado_medrano(p_sector,p_categoria,p_stock_id,null);
  if p_cantidad<v_anterior and p_cantidad<v_reservado then
    raise exception '“%” tiene % % reservados. Resolvé las reservas antes de reducir el stock a % %.',
      v_producto,v_reservado,v_unidad,p_cantidad,v_unidad;
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

create or replace function public.proteger_comanda_pagada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.medrano_comandas_multiproducto where id=old.comanda_id and pago_estado='pagada') then
    if tg_op='UPDATE' and (
      (to_jsonb(new)-array['preparacion_estado','preparacion_trabajo_id'])=(to_jsonb(old)-array['preparacion_estado','preparacion_trabajo_id'])
      or
      (current_setting('rainbows.vincular_aceite_comanda',true)='1'
       and old.pedido_laboratorio and old.origen_id is null and new.origen_id is not null
       and (to_jsonb(new)-array['origen_id','nombre','catalogo_producto_id','preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote'])
          =(to_jsonb(old)-array['origen_id','nombre','catalogo_producto_id','preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote']))
    ) then return new; end if;
    raise exception 'Una comanda pagada no se puede editar. Cancelala para devolver los Tokens al paciente.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.calcular_tokens_item_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_precio numeric;
begin
  if tg_op='UPDATE' and old.pedido_laboratorio and old.origen_id is null
     and new.origen_id is not null and current_setting('rainbows.vincular_aceite_comanda',true)='1'
     and exists(select 1 from public.medrano_comandas_multiproducto
                where id=old.comanda_id and pago_estado='pagada') then
    new.tokens_por_unidad:=old.tokens_por_unidad;
    new.tokens_total:=old.tokens_total;
    return new;
  end if;
  if new.pedido_laboratorio then
    begin
      v_precio:=public.precio_tokens_aceite((new.receta->>'concentracion')::numeric,(new.receta->>'presentacion_ml')::numeric);
    exception when others then v_precio:=null; end;
  else
    v_precio:=public.precio_tokens_producto(new.tipo,new.origen_id);
  end if;
  if coalesce(v_precio,0)<=0 then
    raise exception 'El producto % todavía no tiene configurado su valor en Tokens.',new.nombre;
  end if;
  new.tokens_por_unidad:=v_precio;
  new.tokens_total:=round(v_precio*new.cantidad,2);
  return new;
end;
$$;

create or replace function public.eliminar_comanda_tokens(p_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto;v_saldo numeric;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
 if v_c.estado='dispensada' then raise exception 'La comanda ya fue dispensada.'; end if;
 if not found or v_c.estado<>'pendiente' then perform public.eliminar_comanda_multiproducto(p_id,p_motivo);return;end if;
 if v_c.pago_estado='pagada' then
   select saldo_tokens into v_saldo from public.medrano_pacientes where id=v_c.paciente_id for update;
   update public.medrano_pacientes set saldo_tokens=v_saldo+v_c.tokens_total,updated_at=now() where id=v_c.paciente_id;
   insert into public.medrano_tokens_movimientos(paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por)
   values(v_c.paciente_id,v_c.id,'reintegro',v_c.tokens_total,v_saldo,v_saldo+v_c.tokens_total,'Reintegro por cancelación de comanda',auth.uid());
 end if;
 perform public.eliminar_comanda_multiproducto(p_id,p_motivo);
end; $$;

alter table public.palestina_caja_movimientos add column if not exists solicitud_datos jsonb;
alter table public.palestina_sueldos_registros add column if not exists solicitud_datos jsonb;

create or replace function public.guardar_movimiento_caja_palestina(
 p_id uuid,p_version integer,p_solicitud uuid,p_fecha date,p_tipo text,p_medio text,p_articulo text,
 p_cantidad numeric,p_monto numeric,p_categoria_id uuid,p_notas text default '',p_motivo text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.palestina_caja_movimientos%rowtype;new public.palestina_caja_movimientos%rowtype;
 v_solicitud_datos jsonb;
 v_articulo uuid;v_nombre text;v_texto text;v_apertura date;v_categoria public.palestina_caja_categorias%rowtype;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para registrar movimientos.'; end if;
 perform public.bloquear_caja_palestina();
 v_texto:=regexp_replace(btrim(coalesce(p_articulo,'')),'[[:space:]]+',' ','g');
 if p_id is null and p_solicitud is not null then
  v_solicitud_datos:=jsonb_build_array(p_fecha,p_tipo,p_medio,lower(v_texto),
    p_cantidad,p_monto,p_categoria_id,coalesce(p_notas,''));
  select * into new from public.palestina_caja_movimientos where solicitud_id=p_solicitud;
  if found then
   if new.creado_por is distinct from auth.uid()
      or new.solicitud_datos is distinct from v_solicitud_datos then
    raise exception 'La solicitud ya corresponde a otro guardado. Actualizá la caja y verificá el movimiento antes de seguir.';
   end if;
   return new.id;
  end if;
 end if;
 select fecha into v_apertura from public.palestina_caja_apertura where unica;
 if v_apertura is null then raise exception 'Registrá primero el saldo inicial de efectivo, aunque sea cero.'; end if;
 if p_fecha is null or p_fecha<v_apertura or p_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha debe estar entre la apertura de esta caja y hoy.'; end if;
 if p_tipo is null or p_tipo not in ('ingreso','egreso') or p_medio is null or p_medio not in ('efectivo','transferencia') then raise exception 'Elegí movimiento y forma de pago.'; end if;
 if length(v_texto) not between 1 and 180 or length(coalesce(p_notas,''))>1000 or length(coalesce(p_motivo,''))>1000 then raise exception 'Completá el artículo (hasta 180 caracteres) y notas o motivo de hasta 1000 caracteres.'; end if;
 if p_cantidad is null or p_cantidad<=0 or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<>round(p_cantidad,3) or p_cantidad>999999999 then raise exception 'La cantidad debe ser positiva, con hasta tres decimales.'; end if;
 if p_monto is null or p_monto<=0 or p_monto::text in ('NaN','Infinity','-Infinity') or p_monto<>round(p_monto,2) or p_monto>999999999999.99 then raise exception 'El costo total debe ser positivo, con hasta dos decimales.'; end if;
 select * into v_categoria from public.palestina_caja_categorias where id=p_categoria_id;
 if not found or v_categoria.tipo<>p_tipo then raise exception 'La categoría no corresponde al movimiento.'; end if;
 if p_tipo='ingreso' and v_categoria.nombre is distinct from (case when p_medio='efectivo' then 'Ingreso de efectivo' else 'Ingreso por transferencia' end) then raise exception 'Elegí la categoría de ingreso del medio de pago indicado.'; end if;
 if p_id is not null then
  select * into old from public.palestina_caja_movimientos where id=p_id for update;
  if not found or old.anulado_at is not null then raise exception 'El movimiento ya no está vigente.'; end if;
  if old.version is distinct from p_version then raise exception 'Otra persona modificó el movimiento. Actualizá antes de corregirlo.'; end if;
  if length(btrim(coalesce(p_motivo,'')))<3 then raise exception 'Indicá el motivo de la corrección.'; end if;
 elsif p_solicitud is null then raise exception 'Falta la identificación de la carga. Volvé a abrir el formulario.';
 end if;
 v_nombre:=public.actor_caja_palestina();
 select id,nombre into v_articulo,v_texto from public.palestina_caja_articulos
 where activo and lower(btrim(nombre))=lower(v_texto);
 if not found then raise exception 'Elegí un artículo existente. Si falta, agregalo con Nuevo artículo antes de guardar el movimiento.'; end if;
 if p_id is null then
  insert into public.palestina_caja_movimientos(solicitud_id,solicitud_datos,fecha,tipo,medio,articulo_id,articulo,cantidad,monto,categoria_id,notas,creado_por,creado_nombre,actualizado_por,actualizado_nombre)
  values(p_solicitud,v_solicitud_datos,p_fecha,p_tipo,p_medio,v_articulo,v_texto,p_cantidad,p_monto,p_categoria_id,coalesce(p_notas,''),auth.uid(),v_nombre,auth.uid(),v_nombre) returning * into new;
 else
  update public.palestina_caja_movimientos set fecha=p_fecha,tipo=p_tipo,medio=p_medio,articulo_id=v_articulo,articulo=v_texto,cantidad=p_cantidad,monto=p_monto,categoria_id=p_categoria_id,notas=coalesce(p_notas,''),version=version+1,actualizado_por=auth.uid(),actualizado_nombre=v_nombre,actualizado_at=now() where id=p_id returning * into new;
 end if;
 insert into public.palestina_caja_auditoria(entidad,entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values('movimiento',new.id,case when p_id is null then 'alta' else 'correccion' end,case when p_id is null then null else to_jsonb(old) end,to_jsonb(new),p_motivo,auth.uid(),v_nombre);
 return new.id;
end; $$;

create or replace function public.guardar_sueldos_palestina(p_operacion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;v_id uuid;v_req uuid;v_version int;v_fecha date;v_clase text;v_tipo text;v_nombre text;v_motivo text;v_notas text;
 t public.palestina_sueldos_tarifas%rowtype;o public.palestina_sueldos_registros%rowtype;n public.palestina_sueldos_registros%rowtype;
 v_solicitud_datos jsonb;
 v_antes jsonb;v_despues jsonb;v_tarifa jsonb;v_horas numeric;v_importe numeric;v_calculado numeric;v_manual boolean:=false;v_modalidad text;v_unidades numeric;v_valor numeric;v_trabajo text;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para modificar Asistencias y sueldos.';end if;
 perform pg_advisory_xact_lock(32677,1);
 select coalesce(nullif(nombre,''),email,'Usuario') into v_nombre from public.perfiles where id=auth.uid();
 v_motivo:=btrim(coalesce(p_datos->>'motivo',''));v_notas:=btrim(coalesce(p_datos->>'notas',''));
 if length(v_motivo)>1000 or length(v_notas)>1000 then raise exception 'Notas y motivo admiten hasta 1000 caracteres.';end if;
 v_version:=coalesce((p_datos->>'version')::integer,0);v_id:=nullif(p_datos->>'id','')::uuid;
 if p_operacion='anular' then
  select * into o from public.palestina_sueldos_registros where id=v_id for update;
  if not found then raise exception 'No se encontró el registro.';end if;
  if o.anulado_at is not null then return o.id;end if;
  if o.version<>v_version then raise exception 'El registro cambió. Actualizá la pantalla.';end if;
  if length(v_motivo)<3 then raise exception 'Indicá el motivo de la anulación.';end if;
  update public.palestina_sueldos_registros set anulado_at=now(),motivo_anulacion=v_motivo,version=version+1,actualizado_at=now() where id=o.id returning * into n;
  v_antes:=to_jsonb(o);v_despues:=to_jsonb(n);
 elsif p_operacion='tarifa' then
  e:=(p_datos->>'empleado_id')::uuid;
  if not exists(select 1 from public.empleados where id=e) then raise exception 'Elegí un empleado existente.';end if;
  select * into t from public.palestina_sueldos_tarifas where empleado_id=e for update;v_antes:=case when found then to_jsonb(t) else null end;
  if coalesce(t.version,0)<>v_version then raise exception 'Los valores cambiaron. Actualizá la pantalla.';end if;
  if t.empleado_id is not null and length(v_motivo)<3 then raise exception 'Indicá el motivo del cambio de valores.';end if;
  v_modalidad:=coalesce(p_datos->>'modalidad',t.modalidad,'jornada');
  if v_modalidad not in ('jornada','mensual') then raise exception 'Modalidad no válida.';end if;
  v_importe:=(p_datos->>'jornada')::numeric;v_horas:=(p_datos->>'horas')::numeric;
  if v_importe is null or v_importe<=0 or v_importe::text in ('NaN','Infinity','-Infinity') or v_importe<>round(v_importe,2) or v_importe>9999999999.99 or v_horas is null or v_horas<=0 or v_horas>24 or v_horas<>round(v_horas,2) then raise exception 'Revisá el valor por jornada y las horas de una jornada completa.';end if;
  insert into public.palestina_sueldos_tarifas(empleado_id,habilitado,jornada,horas,sabado,domingo,modalidad)
  values(e,coalesce((p_datos->>'habilitado')::boolean,true),v_importe,v_horas,nullif(p_datos->>'sabado','')::numeric,nullif(p_datos->>'domingo','')::numeric,v_modalidad)
  on conflict(empleado_id) do update set modalidad=excluded.modalidad,habilitado=excluded.habilitado,jornada=excluded.jornada,horas=excluded.horas,sabado=excluded.sabado,domingo=excluded.domingo,version=public.palestina_sueldos_tarifas.version+1,actualizado_at=now() returning * into t;
  v_id:=e;v_despues:=to_jsonb(t);
 elsif p_operacion='registro' then
  v_req:=(p_datos->>'solicitud')::uuid;
  if v_id is null then
   if v_req is null then raise exception 'Volvé a abrir el formulario.';end if;
   v_solicitud_datos:=p_datos - array['solicitud','id','version','motivo'];
   select * into n from public.palestina_sueldos_registros where solicitud=v_req;
   if found then
    if n.creado_por is distinct from auth.uid()
       or n.solicitud_datos is distinct from v_solicitud_datos then
     raise exception 'La solicitud ya corresponde a otro guardado. Actualizá Sueldos y verificá el registro antes de seguir.';
    end if;
    return n.id;
   end if;
  else
   select * into o from public.palestina_sueldos_registros where id=v_id for update;
   if not found or o.anulado_at is not null then raise exception 'El registro ya no está vigente.';end if;
   if o.version<>v_version then raise exception 'Otra persona modificó el registro. Actualizá la pantalla.';end if;
   if length(v_motivo)<3 then raise exception 'Indicá el motivo de la corrección.';end if;
   v_antes:=to_jsonb(o);
  end if;
  e:=(p_datos->>'empleado_id')::uuid;v_fecha:=(p_datos->>'fecha')::date;v_clase:=p_datos->>'clase';v_tipo:=p_datos->>'tipo';
  if v_fecha is null or v_fecha<date '1900-01-01' or v_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha debe ser válida y no posterior a hoy.';end if;
  if v_clase is null or v_clase not in ('asistencia','pago','ajuste','produccion') or (o.id is not null and o.clase<>v_clase and not(o.clase='asistencia' and o.tipo<>'mensual' and v_clase='produccion')) then raise exception 'Elegí un tipo de registro válido.';end if;
  select * into t from public.palestina_sueldos_tarifas where empleado_id=e;
  if not exists(select 1 from public.empleados where id=e) then raise exception 'Elegí un empleado existente.';end if;
  if v_clase='asistencia' and t.empleado_id is null then raise exception 'Configurá primero los valores por jornada del empleado.';end if;
  if o.id is null and v_clase='asistencia' and (not t.habilitado or not exists(select 1 from public.empleados where id=e and activo)) then raise exception 'El empleado no está habilitado para nuevas asistencias.';end if;
  if v_clase='produccion' then
   if o.id is null and not exists(select 1 from public.empleados where id=e and activo) then raise exception 'Elegí un empleado activo.';end if;
   v_tipo:='produccion';v_trabajo:=btrim(coalesce(p_datos->>'trabajo',''));v_unidades:=(p_datos->>'unidades')::numeric;v_valor:=(p_datos->>'valor_unidad')::numeric;
   if length(v_trabajo) not between 1 and 180 then raise exception 'Indicá el trabajo realizado (hasta 180 caracteres).';end if;
   if v_unidades is null or v_unidades<=0 or v_unidades::text in ('NaN','Infinity','-Infinity') or v_unidades<>round(v_unidades,3) or v_unidades>999999999.999 then raise exception 'Ingresá unidades positivas con hasta tres decimales.';end if;
   if v_valor is null or v_valor<=0 or v_valor::text in ('NaN','Infinity','-Infinity') or v_valor<>round(v_valor,2) or v_valor>999999999999.99 then raise exception 'Ingresá un valor por unidad positivo, con hasta dos decimales.';end if;
   v_importe:=round(v_unidades*v_valor,2);v_calculado:=v_importe;
  elsif v_clase='asistencia' then
   v_tarifa:=case when o.id is not null and o.empleado_id=e and not(v_tipo='mensual' and o.tipo<>'mensual') then o.tarifa else to_jsonb(t) end;
   if v_tipo is null or v_tipo not in ('completa','media','horas','sabado','domingo','ausente','mensual') then raise exception 'Elegí la jornada realizada.';end if;
   if v_tipo='mensual' then
    if coalesce(v_tarifa->>'modalidad','jornada')<>'mensual' then raise exception 'Configurá primero el sueldo mensual del empleado.';end if;
    if extract(day from v_fecha)<>1 then raise exception 'El sueldo mensual se registra el primer día del mes.';end if;
   elsif coalesce(v_tarifa->>'modalidad','jornada')='mensual' then raise exception 'Para este empleado elegí Sueldo mensual, una sola vez por mes.';end if;
   v_horas:=case v_tipo when 'completa' then (v_tarifa->>'horas')::numeric when 'media' then (v_tarifa->>'horas')::numeric/2 when 'horas' then (p_datos->>'horas')::numeric when 'ausente' then 0 when 'mensual' then 0 else 2 end;
   if v_horas is null or v_horas<0 or v_horas>24 or (v_tipo not in ('ausente','mensual') and v_horas=0) or v_horas<>round(v_horas,2) then raise exception 'Revisá las horas trabajadas (hasta dos decimales).';end if;
   v_calculado:=round(case v_tipo when 'mensual' then (v_tarifa->>'jornada')::numeric when 'sabado' then coalesce((v_tarifa->>'sabado')::numeric,(v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*2*1.5) when 'domingo' then coalesce((v_tarifa->>'domingo')::numeric,(v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*2*2) else (v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*v_horas end,2);
   v_manual:=nullif(p_datos->>'importe_manual','') is not null;
   v_importe:=case when v_manual then (p_datos->>'importe_manual')::numeric else v_calculado end;
   if v_tipo='ausente' and v_importe<>0 then raise exception 'Una ausencia tiene importe cero. Usá Ajuste para otro concepto.';end if;
   if v_manual and length(v_notas)<3 then raise exception 'Explicá el motivo del importe especial en Notas.';end if;
   if exists(select 1 from public.palestina_sueldos_registros where empleado_id=e and fecha=v_fecha and clase='asistencia' and anulado_at is null and id is distinct from v_id) then raise exception 'Ya hay una asistencia de ese empleado en esa fecha. Editá la existente.';end if;
  else
   v_importe:=(p_datos->>'importe')::numeric;v_tipo:=v_clase;
   if v_importe=0 or (v_clase='pago' and v_importe<0) then raise exception 'El pago debe ser positivo; el ajuste no puede ser cero.';end if;
   if v_clase='pago' and coalesce(p_datos->>'medio','') not in ('efectivo','transferencia') then raise exception 'Elegí el medio de pago.';end if;
   if v_clase='ajuste' and length(v_notas)<3 then raise exception 'Indicá el concepto del ajuste.';end if;
  end if;
  if v_importe is null or v_importe::text in ('NaN','Infinity','-Infinity') or abs(v_importe)>999999999999.99 or v_importe<>round(v_importe,2) or (v_clase='asistencia' and v_importe<0) then raise exception 'Ingresá un importe válido, con hasta dos decimales.';end if;
  if o.id is null then
   insert into public.palestina_sueldos_registros(solicitud,solicitud_datos,empleado_id,fecha,clase,tipo,horas,tarifa,calculado,manual,importe,medio,notas,creado_por,creado_nombre,trabajo,unidades,valor_unidad)
   values(v_req,v_solicitud_datos,e,v_fecha,v_clase,v_tipo,v_horas,v_tarifa,v_calculado,v_manual,v_importe,case when v_clase='pago' then p_datos->>'medio' end,v_notas,auth.uid(),v_nombre,v_trabajo,v_unidades,v_valor) returning * into n;
  else
   update public.palestina_sueldos_registros set empleado_id=e,fecha=v_fecha,clase=v_clase,tipo=v_tipo,trabajo=v_trabajo,unidades=v_unidades,valor_unidad=v_valor,horas=v_horas,tarifa=v_tarifa,calculado=v_calculado,manual=v_manual,importe=v_importe,medio=case when v_clase='pago' then p_datos->>'medio' end,notas=v_notas,version=version+1,actualizado_at=now() where id=o.id returning * into n;
  end if;
  v_id:=n.id;v_despues:=to_jsonb(n);
 else raise exception 'Operación no válida.';
 end if;
 insert into public.palestina_sueldos_auditoria(entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values(v_id,case when p_operacion='anular' then 'anulacion' when p_operacion='tarifa' then 'valores' when o.id is null then 'alta' else 'correccion' end,v_antes,v_despues,v_motivo,auth.uid(),v_nombre);
 return v_id;
end; $$;

create or replace function public.guardar_cosecha_completa(
  p_cosecha_id uuid,
  p_idempotency_key uuid,
  p_fecha date,
  p_sala text,
  p_ciclo integer,
  p_meta_gramos numeric,
  p_total_gramos numeric,
  p_cantidad_plantas integer,
  p_observaciones text,
  p_origen text,
  p_detalles jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cosecha_id uuid;
  v_operacion public.cosecha_operaciones%rowtype;
  v_payload_hash text;
  v_detalle jsonb;
  v_detalle_id uuid;
  v_genetica_id uuid;
  v_nombre text;
  v_tamano text;
  v_gramos numeric;
  v_total numeric := 0;
  v_stock_sincronizado boolean := false;
begin
  if not public.usuario_rainbows_palestina_gestion() then
    raise exception 'Sin permisos para guardar cosechas.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Falta la clave de seguridad del guardado. Cerrá el formulario y volvé a abrirlo.';
  end if;
  if p_fecha is null or p_sala not in ('Flora 1','Flora 2','Flora 3') or coalesce(p_ciclo,0) <= 0 then
    raise exception 'Completá fecha, sala y ciclo.';
  end if;
  if p_meta_gramos is not null and p_meta_gramos < 0 then
    raise exception 'La meta no puede ser negativa.';
  end if;
  if p_cantidad_plantas is not null and p_cantidad_plantas < 0 then
    raise exception 'La cantidad de plantas no puede ser negativa.';
  end if;
  if jsonb_typeof(coalesce(p_detalles,'[]'::jsonb)) <> 'array' then
    raise exception 'El detalle de la cosecha no es válido.';
  end if;
  if p_cosecha_id is null and jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) = 0 then
    raise exception 'Agregá al menos una genética con su peso y tamaño.';
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'cosecha_id',p_cosecha_id,'fecha',p_fecha,'sala',p_sala,'ciclo',p_ciclo,
    'meta',p_meta_gramos,'total',p_total_gramos,'plantas',p_cantidad_plantas,
    'observaciones',p_observaciones,'origen',p_origen,'detalles',coalesce(p_detalles,'[]'::jsonb)
  )::text);

  perform pg_advisory_xact_lock(hashtextextended('rainbows-cosecha-op-'||p_idempotency_key::text,0));

  select * into v_operacion
  from public.cosecha_operaciones
  where idempotency_key = p_idempotency_key;
  if found then
    if v_operacion.payload_hash is distinct from v_payload_hash then
      raise exception 'La solicitud de guardado ya fue utilizada con otros datos. Cerrá el formulario y volvé a abrirlo.';
    end if;
    return jsonb_build_object('cosecha_id',v_operacion.cosecha_id,'reutilizada',true,'stock_sincronizado',v_operacion.stock_sincronizado);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rainbows-cosecha-'||p_sala||'-'||p_ciclo::text,0));

  if p_cosecha_id is null then
    if exists(select 1 from public.cosechas where sala=p_sala and ciclo=p_ciclo) then
      raise exception 'Ya existe una cosecha de % · Ciclo %. Abrila para editarla en lugar de crear otra.',p_sala,p_ciclo;
    end if;
    insert into public.cosechas(
      fecha,sala,ciclo,meta_gramos,total_gramos,cantidad_plantas,observaciones,origen
    ) values (
      p_fecha,p_sala,p_ciclo,p_meta_gramos,coalesce(p_total_gramos,0),p_cantidad_plantas,
      nullif(btrim(coalesce(p_observaciones,'')),''),coalesce(nullif(btrim(p_origen),''),'app')
    ) returning id into v_cosecha_id;
  else
    select id into v_cosecha_id
    from public.cosechas
    where id=p_cosecha_id
    for update;
    if not found then raise exception 'La cosecha que intentás editar ya no existe.'; end if;
    if exists(select 1 from public.cosechas where sala=p_sala and ciclo=p_ciclo and id<>p_cosecha_id) then
      raise exception 'Ya existe otra cosecha de % · Ciclo %.',p_sala,p_ciclo;
    end if;
    update public.cosechas
    set fecha=p_fecha,sala=p_sala,ciclo=p_ciclo,meta_gramos=p_meta_gramos,
        total_gramos=coalesce(p_total_gramos,0),cantidad_plantas=p_cantidad_plantas,
        observaciones=nullif(btrim(coalesce(p_observaciones,'')),''),
        origen=coalesce(nullif(btrim(p_origen),''),origen),updated_at=now()
    where id=v_cosecha_id;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
    where coalesce((d->>'gramos')::numeric,0) <= 0
       or d->>'tamano' not in ('grande','mediano','chico')
       or nullif(btrim(coalesce(d->>'nombre_historico','')),'') is null
  ) then
    raise exception 'Cada genética debe tener nombre, tamaño y gramos mayores a cero.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
    where nullif(d->>'genetica_id','') is not null
    group by d->>'genetica_id'
    having count(*) > 1
  ) then
    raise exception 'Una genética está repetida. Unificá sus pesadas antes de guardar.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
    where nullif(d->>'id','') is not null
    group by nullif(d->>'id','')::uuid
    having count(*) > 1
  ) then
    raise exception 'Hay un detalle de cosecha repetido. Revisá el desglose.';
  end if;

  delete from public.cosecha_geneticas cg
  where cg.cosecha_id=v_cosecha_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
      where nullif(d->>'id','')::uuid=cg.id
    );

  for v_detalle in select value from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb))
  loop
    v_detalle_id:=nullif(v_detalle->>'id','')::uuid;
    v_genetica_id:=nullif(v_detalle->>'genetica_id','')::uuid;
    v_nombre:=btrim(v_detalle->>'nombre_historico');
    v_tamano:=v_detalle->>'tamano';
    v_gramos:=(v_detalle->>'gramos')::numeric;

    if v_detalle_id is null then
      insert into public.cosecha_geneticas(
        cosecha_id,genetica_id,nombre_historico,tamano,gramos
      ) values (
        v_cosecha_id,v_genetica_id,v_nombre,v_tamano,v_gramos
      );
    else
      update public.cosecha_geneticas
      set genetica_id=v_genetica_id,nombre_historico=v_nombre,tamano=v_tamano,gramos=v_gramos
      where id=v_detalle_id and cosecha_id=v_cosecha_id;
      if not found then raise exception 'Uno de los detalles de la cosecha cambió o ya no existe.'; end if;
    end if;
  end loop;

  if jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) > 0 then
    select coalesce(sum(gramos),0) into v_total from public.cosecha_geneticas
    where cosecha_id=v_cosecha_id;
    update public.cosechas set total_gramos=round(v_total,2),updated_at=now() where id=v_cosecha_id;
  end if;

  -- La función histórica de sincronización se ejecuta dentro de esta misma
  -- transacción. Si falla, también se revierten cosecha y genéticas. Las
  -- cosechas históricas sin desglose y nunca vinculadas siguen siendo editables.
  if jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) > 0
     or exists(select 1 from public.stock_ciclos where cosecha_id=v_cosecha_id) then
    perform public.sincronizar_cosecha_stock(v_cosecha_id);
    v_stock_sincronizado:=true;
  end if;

  insert into public.cosecha_operaciones(idempotency_key,cosecha_id,payload_hash,stock_sincronizado)
  values(p_idempotency_key,v_cosecha_id,v_payload_hash,v_stock_sincronizado);

  return jsonb_build_object('cosecha_id',v_cosecha_id,'reutilizada',false,'stock_sincronizado',v_stock_sincronizado);
end;
$$;

-- Se conservan las políticas RLS de las tablas y los permisos del operador.
create or replace function public.registrar_estado_tarea_palestina(
  p_id uuid,p_general boolean,p_completar boolean,p_detalle text,p_empleados uuid[]
)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_realizacion uuid;
  v_estado text;
  v_actor uuid:=auth.uid();
  v_empleados uuid[]:=coalesce(p_empleados,'{}');
begin
  if v_actor is null or not public.usuario_rainbows_operativo() then
    raise exception 'Sin permisos para registrar tareas.';
  end if;
  if p_completar and exists (
    select 1 from unnest(v_empleados) as seleccionado(id)
    left join public.empleados e on e.id=seleccionado.id and e.activo
    where e.id is null
  ) then
    raise exception 'Elegí empleados activos.';
  end if;

  if p_general then
    select estado into v_estado from public.tareas_generales where id=p_id for update;
    if not found or v_estado='cancelada' then raise exception 'La tarea ya no está disponible.'; end if;

    update public.tareas_generales
    set estado=case when p_completar then 'realizada' else 'pendiente' end,
        realizada_at=case when p_completar then coalesce(realizada_at,now()) end,
        registrada_por=case when p_completar then coalesce(registrada_por,v_actor) end
    where id=p_id;
    if not found then raise exception 'No se pudo actualizar la tarea.'; end if;
    delete from public.tarea_general_empleados where tarea_general_id=p_id;
    if p_completar then
      insert into public.tarea_general_empleados(tarea_general_id,empleado_id)
      select distinct p_id,id from unnest(v_empleados) as seleccionado(id);
    end if;
  else
    select estado into v_estado from public.tareas where id=p_id for update;
    if not found or v_estado='cancelada' then raise exception 'La tarea ya no está disponible.'; end if;

    update public.tareas
    set estado=case when p_completar then 'realizada' else 'pendiente' end,detalle=p_detalle
    where id=p_id;
    if not found then raise exception 'No se pudo actualizar la tarea.'; end if;
    if p_completar then
      insert into public.realizaciones_tarea as r(tarea_id,realizada_at,registrada_por)
      values(p_id,now(),v_actor)
      on conflict(tarea_id) do update set realizada_at=r.realizada_at
      returning id into v_realizacion;
      delete from public.realizacion_empleados where realizacion_id=v_realizacion;
      insert into public.realizacion_empleados(realizacion_id,empleado_id)
      select distinct v_realizacion,id from unnest(v_empleados) as seleccionado(id);
    else
      delete from public.realizaciones_tarea where tarea_id=p_id;
    end if;
  end if;
end;
$$;

revoke all on function public.registrar_estado_tarea_palestina(uuid,boolean,boolean,text,uuid[]) from public,anon;
grant execute on function public.registrar_estado_tarea_palestina(uuid,boolean,boolean,text,uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
