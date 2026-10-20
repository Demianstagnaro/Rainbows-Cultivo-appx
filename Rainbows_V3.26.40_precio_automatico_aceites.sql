-- Rainbows V3.26.40
-- Precio automático de aceites según gramos de resina y corrección de concentración.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

alter table public.medrano_comandas_multiproducto_items
  alter column origen_id drop not null,
  add column if not exists catalogo_producto_id uuid references public.medrano_catalogo_productos(id),
  add column if not exists pedido_laboratorio boolean not null default false,
  add column if not exists receta jsonb;

alter table public.medrano_comandas_multiproducto_items drop constraint if exists comanda_item_origen_check;
alter table public.medrano_comandas_multiproducto_items add constraint comanda_item_origen_check check (
  (not pedido_laboratorio and origen_id is not null and catalogo_producto_id is null and receta is null)
  or
  (pedido_laboratorio and tipo='aceites' and origen_id is null and jsonb_typeof(receta)='object')
  or
  (pedido_laboratorio and tipo='aceites' and origen_id is not null and catalogo_producto_id is not null and jsonb_typeof(receta)='object')
);

create index if not exists comanda_items_catalogo_idx
  on public.medrano_comandas_multiproducto_items(catalogo_producto_id)
  where catalogo_producto_id is not null;

create or replace function public.precio_tokens_aceite(p_concentracion numeric,p_presentacion_ml numeric)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare v_resina numeric;
begin
  if p_concentracion is null or p_concentracion<=1 or p_presentacion_ml is null or p_presentacion_ml<=0 then return null; end if;
  select tokens_por_unidad into v_resina from public.medrano_precios_categorias where categoria='resina';
  if coalesce(v_resina,0)<=0 then return null; end if;
  return round(v_resina*p_presentacion_ml/p_concentracion,2);
end;
$$;

create or replace function public.calcular_tokens_item_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_precio numeric;
begin
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

create or replace function public.validar_reserva_comanda_operativa()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_fisico numeric;v_reservado_comandas numeric;v_reservado_produccion numeric:=0;
  v_disponible numeric;v_nombre text;v_unidad text;v_old_id uuid;
begin
  if new.cantidad is null or new.cantidad<=0 or new.cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'La cantidad solicitada no es válida.';
  end if;
  if new.pedido_laboratorio and new.origen_id is null then
    if new.tipo<>'aceites' or new.unidad<>'unidades' or new.cantidad<>trunc(new.cantidad) then
      raise exception 'Los aceites a pedido deben registrarse en unidades enteras.';
    end if;
    return new;
  end if;
  if new.tipo='flores' then
    select gramos_actual,concat_ws(' · ',nombre_historico,codigo_lote),'g' into v_fisico,v_nombre,v_unidad
    from public.medrano_dispensario_lotes where id=new.origen_id for update;
  elsif new.tipo='mostrador' then
    select cantidad,nombre,'unidades' into v_fisico,v_nombre,v_unidad
    from public.medrano_mostrador_productos where id=new.origen_id and activo for update;
  elsif new.tipo in ('resina','aceites','cremas','capsulas') then
    select cantidad,nombre,unidad into v_fisico,v_nombre,v_unidad
    from public.medrano_laboratorio_stock where id=new.origen_id and categoria=new.tipo and activo for update;
  else raise exception 'Tipo de producto inválido.';
  end if;
  if v_fisico is null then raise exception 'El producto seleccionado ya no está disponible.'; end if;
  if v_unidad='unidades' and new.cantidad<>trunc(new.cantidad) then raise exception 'Las unidades deben ser enteras.'; end if;
  v_old_id:=case when tg_op='UPDATE' then old.id else null end;
  select coalesce(sum(i.cantidad),0) into v_reservado_comandas
  from public.medrano_comandas_multiproducto_items i
  join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
  where c.estado='pendiente' and i.tipo=new.tipo and i.origen_id=new.origen_id
    and (v_old_id is null or i.id<>v_old_id);
  if new.tipo in ('resina','aceites','cremas','capsulas') then
    select coalesce(sum(m.cantidad),0) into v_reservado_produccion
    from public.medrano_laboratorio_trabajos_materiales m
    join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
    where m.stock_id=new.origen_id and t.produccion_controlada and t.estado='en_proceso';
  end if;
  v_disponible:=v_fisico-v_reservado_comandas-v_reservado_produccion;
  if new.cantidad>v_disponible then
    raise exception 'Stock insuficiente de “%”. Disponible: % %; solicitado: % %.',v_nombre,greatest(v_disponible,0),v_unidad,new.cantidad,v_unidad;
  end if;
  return new;
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
       and (to_jsonb(new)-array['origen_id','nombre','tokens_por_unidad','tokens_total','preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote'])
          =(to_jsonb(old)-array['origen_id','nombre','tokens_por_unidad','tokens_total','preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote']))
    ) then return new; end if;
    raise exception 'Una comanda pagada no se puede editar. Cancelala para devolver los Tokens al paciente.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.guardar_comanda_multiproducto(p_id uuid,p_paciente uuid,p_fecha date,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;v_estado text;v_paciente text;v_line jsonb;v_tipo text;v_origen uuid;v_catalogo uuid;v_qty numeric;
  v_name text;v_unit text;v_old record;v_pedido boolean;v_receta jsonb;v_perfil text;v_ratio text;v_base text;
  v_concentracion numeric;v_presentacion numeric;v_profile_parts text[];v_ratio_parts text[];v_index integer;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para guardar comandas.'; end if;
  if p_fecha is null or p_paciente is null or coalesce(jsonb_typeof(p_items),'')<>'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'Seleccioná un paciente, fecha y al menos un producto (máximo 30).';
  end if;
  select nullif(btrim(concat_ws(' ',nombre,apellido)),'') into v_paciente from public.medrano_pacientes where id=p_paciente;
  if v_paciente is null then raise exception 'Paciente no encontrado.'; end if;
  if p_id is not null then
    select estado into v_estado from public.medrano_comandas_multiproducto where id=p_id for update;
    if not found or v_estado='eliminada' then raise exception 'Comanda no disponible.'; end if;
    for v_old in select tipo,origen_id,cantidad from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id nulls last loop
      if v_old.origen_id is null then continue; end if;
      if v_old.tipo='flores' then perform 1 from public.medrano_dispensario_lotes where id=v_old.origen_id for update;
      elsif v_old.tipo='mostrador' then perform 1 from public.medrano_mostrador_productos where id=v_old.origen_id for update;
      else perform 1 from public.medrano_laboratorio_stock where id=v_old.origen_id for update; end if;
    end loop;
    if v_estado='dispensada' then
      for v_old in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id nulls last loop
        if v_old.origen_id is null then continue; end if;
        if v_old.tipo='flores' then update public.medrano_dispensario_lotes set gramos_actual=gramos_actual+v_old.cantidad where id=v_old.origen_id;
        elsif v_old.tipo='mostrador' then update public.medrano_mostrador_productos set cantidad=cantidad+v_old.cantidad where id=v_old.origen_id;
        else update public.medrano_laboratorio_stock set cantidad=cantidad+v_old.cantidad where id=v_old.origen_id; end if;
      end loop;
    end if;
    delete from public.medrano_comandas_multiproducto_items where comanda_id=p_id;
    update public.medrano_comandas_multiproducto set paciente_id=p_paciente,paciente_nombre=v_paciente,fecha=p_fecha,
      estado='pendiente',dispensada_at=null,dispensada_por=null,updated_at=now() where id=p_id;
    v_id:=p_id;
  else
    insert into public.medrano_comandas_multiproducto(paciente_id,paciente_nombre,fecha,creado_por)
    values(p_paciente,v_paciente,p_fecha,auth.uid()) returning id into v_id;
  end if;
  for v_line in select value from jsonb_array_elements(p_items) order by value->>'tipo',coalesce(value->>'origen_id',value->>'catalogo_producto_id') loop
    v_tipo:=v_line->>'tipo';v_qty:=(v_line->>'cantidad')::numeric;v_pedido:=coalesce((v_line->>'pedido_laboratorio')::boolean,false);
    if v_qty is null or v_qty<=0 or v_qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad inválida.'; end if;
    if v_pedido then
      if v_tipo<>'aceites' then raise exception 'El pedido personalizado no es válido.'; end if;
      v_catalogo:=null;v_receta:=v_line->'receta';
      v_perfil:=v_receta->>'perfil';v_ratio:=regexp_replace(replace(coalesce(v_receta->>'proporcion',''),'-',':'),'[[:space:]]','','g');v_base:=nullif(btrim(v_receta->>'base'),'');
      begin v_concentracion:=(v_receta->>'concentracion')::numeric;v_presentacion:=(v_receta->>'presentacion_ml')::numeric;
      exception when others then raise exception 'La receta del aceite no es válida.'; end;
      if v_perfil not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN')
         or v_ratio !~ '^[0-9]+([.,][0-9]+)?(:[0-9]+([.,][0-9]+)?)*$' or v_base is null or v_concentracion<=1 or v_presentacion<=0 or v_qty<>trunc(v_qty) then
        raise exception 'Completá una receta válida para el aceite a pedido.';
      end if;
      v_profile_parts:=string_to_array(v_perfil,'-');v_ratio_parts:=string_to_array(v_ratio,':');
      if cardinality(v_profile_parts)<>cardinality(v_ratio_parts) then
        raise exception 'El ratio debe tener un valor por cada cannabinoide del perfil.';
      end if;
      for v_index in 1..cardinality(v_ratio_parts) loop
        if replace(v_ratio_parts[v_index],',','.')::numeric<=0 then raise exception 'Todos los valores del ratio deben ser mayores a cero.'; end if;
      end loop;
      v_receta:=jsonb_set(v_receta,'{proporcion}',to_jsonb(v_ratio),true);
      if public.precio_tokens_aceite(v_concentracion,v_presentacion) is null then
        raise exception 'Configurá primero el precio general de Resina en la Lista de precios.';
      end if;
      v_name:=left('Aceite a pedido · '||v_perfil||' · Ratio '||replace(v_ratio,'-',':')||' · 1:'||v_concentracion::text||' · '||v_presentacion::text||' ml · '||v_base,180);
      insert into public.medrano_comandas_multiproducto_items(
        comanda_id,tipo,origen_id,catalogo_producto_id,pedido_laboratorio,receta,nombre,cantidad,unidad,preparacion_estado
      ) values(v_id,'aceites',null,v_catalogo,true,v_receta,v_name,v_qty,'unidades','en_proceso');
      continue;
    end if;
    v_origen:=(v_line->>'origen_id')::uuid;v_catalogo:=null;v_receta:=null;
    if v_tipo='flores' then select concat_ws(' · ',nombre_historico,codigo_lote),'g' into v_name,v_unit from public.medrano_dispensario_lotes where id=v_origen for update;
    elsif v_tipo='mostrador' then select nombre,'unidades' into v_name,v_unit from public.medrano_mostrador_productos where id=v_origen and activo for update;
    elsif v_tipo in ('resina','aceites','cremas','capsulas') then select nombre,unidad into v_name,v_unit from public.medrano_laboratorio_stock where id=v_origen and categoria=v_tipo and activo for update;
    else raise exception 'Tipo de producto inválido.'; end if;
    if v_name is null then raise exception 'El producto ya no está disponible.'; end if;
    if v_unit='unidades' and v_qty<>trunc(v_qty) then raise exception 'Las unidades deben ser enteras.'; end if;
    insert into public.medrano_comandas_multiproducto_items(comanda_id,tipo,origen_id,nombre,cantidad,unidad)
    values(v_id,v_tipo,v_origen,v_name,v_qty,v_unit);
  end loop;
  return v_id;
end;
$$;

create or replace function public.vincular_produccion_aceite_comanda(p_item uuid,p_trabajo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.medrano_comandas_multiproducto_items%rowtype;v_job public.medrano_laboratorio_trabajos%rowtype;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para preparar comandas.'; end if;
  select * into v_item from public.medrano_comandas_multiproducto_items where id=p_item for update;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_trabajo for update;
  if v_item.id is null or not v_item.pedido_laboratorio or v_item.tipo<>'aceites' or v_item.origen_id is not null then raise exception 'El aceite de la comanda ya no está pendiente de producción.'; end if;
  if v_job.id is null or v_job.tipo<>'aceite_final' or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then raise exception 'Seleccioná una producción de aceite válida.'; end if;
  if v_job.resultado_metadata->>'perfil' is distinct from v_item.receta->>'perfil'
     or replace(coalesce(v_job.resultado_metadata->>'proporcion',''),'-',':') is distinct from replace(coalesce(v_item.receta->>'proporcion',''),'-',':')
     or (v_job.resultado_metadata->>'concentracion')::numeric is distinct from (v_item.receta->>'concentracion')::numeric
     or (v_job.resultado_metadata->>'presentacion_ml')::numeric is distinct from (v_item.receta->>'presentacion_ml')::numeric
     or lower(btrim(v_job.resultado_metadata->>'base')) is distinct from lower(btrim(v_item.receta->>'base'))
     or (v_job.resultado_metadata->>'unidades_previstas')::numeric<v_item.cantidad then
    raise exception 'La producción no coincide con la receta y cantidad de la comanda.';
  end if;
  if exists(select 1 from public.medrano_comandas_multiproducto_items where preparacion_trabajo_id=p_trabajo and id<>p_item) then raise exception 'La producción ya está vinculada a otra comanda.'; end if;
  update public.medrano_comandas_multiproducto_items set preparacion_estado='en_proceso',preparacion_trabajo_id=p_trabajo where id=p_item;
end;
$$;

create or replace function public.completar_aceite_comanda_desde_produccion()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_item public.medrano_comandas_multiproducto_items%rowtype;v_stock public.medrano_laboratorio_stock%rowtype;v_precio numeric;v_reservado numeric;
begin
  select * into v_item from public.medrano_comandas_multiproducto_items where preparacion_trabajo_id=new.id for update;
  if not found or not v_item.pedido_laboratorio then return new; end if;
  if new.estado='cancelado' and old.estado<>'cancelado' then
    perform set_config('rainbows.vincular_aceite_comanda','1',true);
    update public.medrano_comandas_multiproducto_items set preparacion_trabajo_id=null,preparacion_estado='en_proceso' where id=v_item.id;
    perform set_config('rainbows.vincular_aceite_comanda','',true);
    return new;
  end if;
  if new.estado<>'finalizado' or old.estado='finalizado' or new.resultado_stock_id is null then return new; end if;
  v_precio:=public.precio_tokens_aceite((v_item.receta->>'concentracion')::numeric,(v_item.receta->>'presentacion_ml')::numeric);
  if coalesce(v_precio,0)<=0 then raise exception 'Configurá primero el precio general de Resina en la Lista de precios.'; end if;
  update public.medrano_laboratorio_stock set tokens_por_unidad=v_precio,updated_at=now()
  where id=new.resultado_stock_id returning * into v_stock;
  update public.medrano_catalogo_productos set tokens_por_unidad=v_precio,updated_at=now()
  where id=v_stock.catalogo_producto_id and categoria='aceites';
  select coalesce(sum(i.cantidad),0) into v_reservado
  from public.medrano_comandas_multiproducto_items i join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
  where c.estado='pendiente' and i.origen_id=v_stock.id and i.id<>v_item.id;
  perform set_config('rainbows.vincular_aceite_comanda','1',true);
  if v_stock.cantidad-v_reservado>=v_item.cantidad then
    update public.medrano_comandas_multiproducto_items
    set origen_id=v_stock.id,catalogo_producto_id=v_stock.catalogo_producto_id,nombre=v_stock.nombre,preparacion_estado='listo'
    where id=v_item.id;
  else
    update public.medrano_comandas_multiproducto_items
    set preparacion_trabajo_id=null,preparacion_estado='en_proceso'
    where id=v_item.id;
  end if;
  perform set_config('rainbows.vincular_aceite_comanda','',true);
  return new;
end;
$$;

drop trigger if exists completar_aceite_comanda_desde_produccion on public.medrano_laboratorio_trabajos;
create trigger completar_aceite_comanda_desde_produccion
after update of estado,resultado_stock_id on public.medrano_laboratorio_trabajos
for each row execute function public.completar_aceite_comanda_desde_produccion();

create or replace function public.dispensar_comanda_multiproducto(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto%rowtype;v_line record;v_accion text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
  if not found or v_c.estado<>'pendiente' then raise exception 'La comanda ya fue cerrada o eliminada.'; end if;
  if exists(select 1 from public.medrano_comandas_multiproducto_items where comanda_id=p_id and origen_id is null) then
    raise exception 'El aceite a pedido todavía no fue producido por Laboratorio.';
  end if;
  for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
    if public.stock_libre_comanda(v_line.tipo,v_line.origen_id,p_id)<v_line.cantidad then raise exception 'Stock insuficiente para %.',v_line.nombre; end if;
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
    else update public.medrano_laboratorio_stock set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id; end if;
    if not found then raise exception 'No se encontró stock para %.',v_line.nombre; end if;
  end loop;
  perform set_config('rainbows.stock_accion','',true);perform set_config('rainbows.operacion_id','',true);perform set_config('rainbows.operacion_tipo','',true);perform set_config('rainbows.referencia_id','',true);
end;
$$;

-- Los productos terminados de aceite toman automáticamente el valor proporcional
-- de la resina: gramos de resina = presentación / denominador de concentración.
create or replace function public.catalogar_producto_terminado_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_catalogo public.medrano_catalogo_productos%rowtype;v_nombre text;v_precio numeric:=0;
begin
  if new.categoria not in ('resina','aceites','cremas','capsulas') or not new.activo or new.es_aceite_base then return new; end if;
  v_nombre:=coalesce(nullif(btrim(new.nombre_comercial),''),new.nombre);
  if new.categoria='aceites' and new.unidad='unidades' and new.presentacion_unidad='ml' then
    v_precio:=coalesce(public.precio_tokens_aceite(new.concentracion_denominador,new.presentacion_cantidad),0);
  end if;
  if new.catalogo_producto_id is not null then
    select * into v_catalogo from public.medrano_catalogo_productos where id=new.catalogo_producto_id;
  end if;
  if new.catalogo_producto_id is null or v_catalogo.id is null or v_catalogo.categoria<>new.categoria then
    insert into public.medrano_catalogo_productos(categoria,nombre,unidad,tokens_por_unidad,activo,creado_por,actualizado_por)
    values(new.categoria,v_nombre,new.unidad,v_precio,true,auth.uid(),auth.uid())
    on conflict (categoria,lower(btrim(nombre))) do update set activo=true,
      tokens_por_unidad=case when excluded.categoria='aceites' and excluded.tokens_por_unidad>0 then excluded.tokens_por_unidad else public.medrano_catalogo_productos.tokens_por_unidad end,
      actualizado_por=auth.uid(),updated_at=now()
    returning * into v_catalogo;
  elsif v_precio>0 and new.categoria='aceites' then
    update public.medrano_catalogo_productos set tokens_por_unidad=v_precio,updated_at=now()
    where id=v_catalogo.id returning * into v_catalogo;
  end if;
  new.nombre_comercial:=v_catalogo.nombre;
  new.catalogo_producto_id:=v_catalogo.id;
  new.tokens_por_unidad:=case when v_precio>0 then v_precio else v_catalogo.tokens_por_unidad end;
  return new;
end;
$$;

create or replace function public.actualizar_precios_aceites_desde_resina()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.categoria<>'resina' then return new; end if;
  update public.medrano_laboratorio_stock
  set tokens_por_unidad=public.precio_tokens_aceite(concentracion_denominador,presentacion_cantidad),updated_at=now()
  where categoria='aceites' and not es_aceite_base and unidad='unidades' and presentacion_unidad='ml'
    and concentracion_denominador>1 and presentacion_cantidad>0;
  update public.medrano_catalogo_productos c
  set tokens_por_unidad=p.tokens,updated_at=now()
  from (
    select catalogo_producto_id,max(public.precio_tokens_aceite(concentracion_denominador,presentacion_cantidad)) tokens
    from public.medrano_laboratorio_stock
    where categoria='aceites' and not es_aceite_base and catalogo_producto_id is not null
      and unidad='unidades' and presentacion_unidad='ml' and concentracion_denominador>1 and presentacion_cantidad>0
    group by catalogo_producto_id
  ) p where c.id=p.catalogo_producto_id;
  update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad
  from public.medrano_comandas_multiproducto c
  where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='aceites';
  return new;
end;
$$;

drop trigger if exists actualizar_precios_aceites_desde_resina on public.medrano_precios_categorias;
create trigger actualizar_precios_aceites_desde_resina
after insert or update of tokens_por_unidad on public.medrano_precios_categorias
for each row execute function public.actualizar_precios_aceites_desde_resina();

update public.medrano_laboratorio_stock
set tokens_por_unidad=public.precio_tokens_aceite(concentracion_denominador,presentacion_cantidad),updated_at=now()
where categoria='aceites' and not es_aceite_base and unidad='unidades' and presentacion_unidad='ml'
  and concentracion_denominador>1 and presentacion_cantidad>0;

update public.medrano_catalogo_productos c
set tokens_por_unidad=p.tokens,updated_at=now()
from (
  select catalogo_producto_id,max(public.precio_tokens_aceite(concentracion_denominador,presentacion_cantidad)) tokens
  from public.medrano_laboratorio_stock
  where categoria='aceites' and not es_aceite_base and catalogo_producto_id is not null
    and unidad='unidades' and presentacion_unidad='ml' and concentracion_denominador>1 and presentacion_cantidad>0
  group by catalogo_producto_id
) p where c.id=p.catalogo_producto_id;

update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad
from public.medrano_comandas_multiproducto c
where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='aceites';

revoke all on function public.precio_tokens_aceite(numeric,numeric) from public,anon;
grant execute on function public.precio_tokens_aceite(numeric,numeric) to authenticated;
revoke all on function public.actualizar_precios_aceites_desde_resina() from public,anon,authenticated;
revoke all on function public.vincular_produccion_aceite_comanda(uuid,uuid) from public,anon;
grant execute on function public.vincular_produccion_aceite_comanda(uuid,uuid) to authenticated;
revoke execute on function public.dispensar_comanda_multiproducto(uuid) from authenticated;

commit;
