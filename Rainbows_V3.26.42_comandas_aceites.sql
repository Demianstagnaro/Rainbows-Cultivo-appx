-- Rainbows V3.26.42
-- Corrige el guardado y el precio automático de aceites preparados a pedido.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

alter table public.medrano_comandas_multiproducto_items drop constraint if exists comanda_item_origen_check;
alter table public.medrano_comandas_multiproducto_items add constraint comanda_item_origen_check check (
  (not pedido_laboratorio and origen_id is not null and catalogo_producto_id is null and receta is null)
  or
  (pedido_laboratorio and tipo='aceites' and origen_id is null and jsonb_typeof(receta)='object')
  or
  (pedido_laboratorio and tipo='aceites' and origen_id is not null and catalogo_producto_id is not null and jsonb_typeof(receta)='object')
);

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
    v_tipo:=case when coalesce((v_line->>'pedido_laboratorio')::boolean,false) then 'aceites' else v_line->>'tipo' end;
    v_qty:=(v_line->>'cantidad')::numeric;v_pedido:=coalesce((v_line->>'pedido_laboratorio')::boolean,false);
    if v_qty is null or v_qty<=0 or v_qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad inválida.'; end if;
    if v_pedido then
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

revoke all on function public.precio_tokens_aceite(numeric,numeric) from public,anon;
grant execute on function public.precio_tokens_aceite(numeric,numeric) to authenticated;
revoke all on function public.guardar_comanda_multiproducto(uuid,uuid,date,jsonb) from public,anon;
grant execute on function public.guardar_comanda_multiproducto(uuid,uuid,date,jsonb) to authenticated;
revoke all on function public.completar_aceite_comanda_desde_produccion() from public,anon,authenticated;

commit;
