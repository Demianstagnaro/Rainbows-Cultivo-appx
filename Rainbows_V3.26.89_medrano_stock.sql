-- Rainbows 3.26.89. Aplicar sobre 3.26.88.
begin;
alter table public.medrano_configuracion_stock alter column permitir_negativo set default false;
update public.medrano_configuracion_stock set permitir_negativo=false where permitir_negativo;
alter table public.medrano_configuracion_stock drop constraint if exists medrano_modo_estricto;
alter table public.medrano_configuracion_stock add constraint medrano_modo_estricto check (not permitir_negativo);

-- NOT VALID conserva los saldos históricos y controla inmediatamente cada escritura nueva.
alter table public.medrano_dispensario_lotes drop constraint if exists saldo_flores_v89;
alter table public.medrano_dispensario_lotes add constraint saldo_flores_v89 check
 (gramos_actual is not null and gramos_actual>=0 and gramos_actual<'Infinity'::numeric) not valid;
alter table public.medrano_laboratorio_stock drop constraint if exists saldo_lab_v89;
alter table public.medrano_laboratorio_stock add constraint saldo_lab_v89 check
 (cantidad is not null and cantidad>=0 and cantidad<'Infinity'::numeric) not valid;
alter table public.medrano_mostrador_productos drop constraint if exists saldo_mostrador_v89;
alter table public.medrano_mostrador_productos add constraint saldo_mostrador_v89 check (cantidad is not null and cantidad>=0) not valid;

create or replace function public.respetar_reservas_comandas()
returns trigger language plpgsql security definer set search_path='' as $$
declare sector text; categoria_stock text; cantidad_nueva numeric; anterior numeric; reservado numeric; trabajo uuid; baja boolean;
begin
  sector:=case when tg_table_name='medrano_laboratorio_stock' then 'laboratorio' else 'dispensario' end;
  if tg_table_name='medrano_dispensario_lotes' then
    categoria_stock:='flores'; cantidad_nueva:=new.gramos_actual; anterior:=old.gramos_actual;
  else
    cantidad_nueva:=new.cantidad; anterior:=old.cantidad;
    categoria_stock:=coalesce(to_jsonb(old)->>'categoria','mostrador');
  end if;
  baja:=coalesce((to_jsonb(old)->>'activo')::boolean,true) and not coalesce((to_jsonb(new)->>'activo')::boolean,true);
  if sector='laboratorio' then
    if old.unidad is distinct from new.unidad or old.categoria is distinct from new.categoria then
      if anterior<>0 or public.stock_reservado_medrano(sector,categoria_stock,old.id,null)>0 then
        raise exception 'El artículo tiene saldo o reservas. No se puede cambiar su unidad o categoría.'; end if;
    end if;
  end if;
  if cantidad_nueva>=anterior and not baja then return new;end if;
  if sector='laboratorio' and current_setting('rainbows.operacion_tipo',true)='produccion'
     and current_setting('rainbows.stock_accion',true)='Producción laboratorio · consumo' then
    trabajo:=nullif(current_setting('rainbows.operacion_id',true),'')::uuid;
  end if;
  reservado:=public.stock_reservado_medrano(sector,categoria_stock,old.id,trabajo);
  if cantidad_nueva<reservado or (baja and reservado>0) then
    raise exception 'Stock insuficiente. Quedan % reservados. Revisá las comandas y producciones pendientes.',reservado;
  end if;
  return new;
end; $$;

alter table public.medrano_laboratorio_trabajos_materiales add column if not exists masa_pesada_g numeric
 check (masa_pesada_g>0 and masa_pesada_g<'Infinity'::numeric);
create or replace function public.masa_material_medrano(p_unidad text,p_cantidad numeric,p_peso numeric)
returns numeric language plpgsql immutable set search_path='' as $$
begin
  if p_unidad='g' then return p_cantidad; end if;
  if p_unidad='kg' then return p_cantidad*1000; end if;
  if p_peso>0 and p_peso<'Infinity'::numeric then return p_peso; end if;
  raise exception 'Ingresá el peso medido en gramos de la cantidad de ingrediente que vas a usar (%).',p_unidad;
end; $$;
revoke all on function public.masa_material_medrano(text,numeric,numeric) from public,anon,authenticated;

-- Cada clave identifica una intención de envío, incluso tras una pérdida de respuesta.
create table if not exists public.medrano_solicitudes_traslado (
 usuario uuid not null, solicitud uuid not null, lote uuid not null, gramos numeric not null,
 traslado uuid references public.medrano_traslados_laboratorio(id), primary key(usuario,solicitud)
);
alter table public.medrano_solicitudes_traslado enable row level security;
revoke all on public.medrano_solicitudes_traslado from public,anon,authenticated;
create or replace function public.enviar_flores_laboratorio_v89(p_solicitud uuid,p_lote_id uuid,p_gramos numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.medrano_solicitudes_traslado%rowtype;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para trasladar stock.';end if;
 if p_solicitud is null or p_lote_id is null or p_gramos is null or p_gramos<=0 or p_gramos>='Infinity'::numeric
    or p_gramos<>round(p_gramos,3) then raise exception 'Ingresá gramos positivos con hasta tres decimales.';end if;
 insert into public.medrano_solicitudes_traslado(usuario,solicitud,lote,gramos) values(auth.uid(),p_solicitud,p_lote_id,p_gramos)
 on conflict(usuario,solicitud) do nothing;
 select * into strict r from public.medrano_solicitudes_traslado where usuario=auth.uid() and solicitud=p_solicitud for update;
 if (r.lote,r.gramos) is distinct from (p_lote_id,p_gramos) then raise exception 'Este intento corresponde a otro traslado.';end if;
 if r.traslado is null then
   r.traslado:=public.enviar_flores_laboratorio(p_lote_id,p_gramos);
   update public.medrano_solicitudes_traslado set traslado=r.traslado where usuario=auth.uid() and solicitud=p_solicitud;
 end if;
 return r.traslado;
end; $$;
revoke all on function public.enviar_flores_laboratorio(uuid,numeric) from public,anon,authenticated;
revoke all on function public.enviar_flores_laboratorio_v89(uuid,uuid,numeric) from public,anon;
grant execute on function public.enviar_flores_laboratorio_v89(uuid,uuid,numeric) to authenticated;

create or replace function public.vehiculos_aceite_medrano(p_puro text,p_bases uuid[])
returns text language plpgsql stable set search_path='' as $$
declare vehiculos text;
begin
 if exists(select 1 from public.medrano_laboratorio_stock s where s.id=any(p_bases) and nullif(btrim(s.base_aceite),'') is null)
 then raise exception 'Falta identificar el vehículo de un aceite base.';end if;
 select string_agg(nombre,' + ' order by pos) into vehiculos from (
   select lower(btrim(nombre)) as clave,(array_agg(btrim(nombre) order by pos))[1] as nombre,min(pos) as pos
   from (select p_puro as nombre,0::bigint as pos union all
     select s.base_aceite,b.ord from unnest(p_bases) with ordinality as b(id,ord) join public.medrano_laboratorio_stock s on s.id=b.id) v
   group by lower(btrim(nombre))) lista;
 return vehiculos;
end; $$;
revoke all on function public.vehiculos_aceite_medrano(text,uuid[]) from public,anon,authenticated;

-- Reconcilia el resultado con las filas de insumos realmente guardadas.
create or replace function public.validar_rendimiento_medrano(p_id uuid,p_retorno numeric)
returns void language plpgsql security definer set search_path='' as $$
declare
 j public.medrano_laboratorio_trabajos%rowtype; m record; masa numeric:=0; volumen numeric:=0;
 envases numeric:=0; capacidad numeric; envases_distintos integer:=0; resina_g numeric:=0; peso_capsula numeric;
begin
 select * into strict j from public.medrano_laboratorio_trabajos where id=p_id;
 for m in select ma.*,s.tipo_insumo,s.capacidad_envase,s.unidad_capacidad,s.nombre as nombre_stock
   from public.medrano_laboratorio_trabajos_materiales ma join public.medrano_laboratorio_stock s on s.id=ma.stock_id
   where ma.trabajo_id=p_id order by ma.stock_id for update of s loop
   if j.tipo in ('aceite_final','crema') and m.tipo_insumo='envase' then
     envases_distintos:=envases_distintos+1; envases:=m.cantidad; capacidad:=m.capacidad_envase;
     if m.unidad<>'unidades' or m.unidad_capacidad is distinct from (case when j.tipo='crema' then 'g' else 'ml' end)
       then raise exception 'Revisá la unidad del envase.'; end if;
   elsif j.tipo='capsulas' and m.unidad='unidades' and m.nombre_stock ~* 'c[aá]psul' then
     envases_distintos:=envases_distintos+1; envases:=m.cantidad;
     capacidad:=replace(substring(m.nombre_stock from '(?i)([0-9]+(?:[.,][0-9]+)?)\s*(?:gramos?|gr|g)\y'),',','.')::numeric;
   elsif j.tipo='resina' or j.tipo in ('crema','capsulas') then
     if m.categoria='resina' then resina_g:=resina_g+m.cantidad;end if;
     masa:=masa+public.masa_material_medrano(m.unidad,m.cantidad,m.masa_pesada_g);
   elsif j.tipo='aceite_final' then
     if m.unidad<>'ml' then raise exception 'Los líquidos del gotero deben estar en ml.';end if;
     volumen:=volumen+m.cantidad;
   end if;
 end loop;
 if j.tipo='resina' and p_retorno>masa then raise exception 'El rendimiento de resina no puede superar los % g de flores usados.',masa;end if;
 if j.tipo='aceite_base' then
   volumen:=(j.resultado_metadata->>'volumen_teorico')::numeric;
   if volumen is null or p_retorno>volumen then raise exception 'Revisá el volumen de la base. El máximo teórico es % ml.',volumen;end if;
   if p_retorno<volumen and (j.resultado_metadata->>'volumen_verificado_ml')::numeric is distinct from p_retorno then
     raise exception 'Para registrar merma, indicá la concentración verificada del lote y el motivo.';end if;
 end if;
 if j.tipo not in ('crema','capsulas','aceite_final') then return;end if;
 if envases_distintos<>1 or capacidad is null or capacidad<=0 or capacidad>='Infinity'::numeric then raise exception 'Falta un envase identificable con su capacidad.';end if;
 if p_retorno>envases then raise exception 'El resultado supera los % envases cargados.',envases;end if;
 if j.tipo='capsulas' then peso_capsula:=(j.resultado_metadata->>'tamano_gramos')::numeric;
 elsif j.tipo='crema' then peso_capsula:=(j.resultado_metadata->>'presentacion_cantidad')::numeric;
 else peso_capsula:=(j.resultado_metadata->>'presentacion_ml')::numeric;end if;
 if peso_capsula is distinct from capacidad then raise exception 'La presentación del producto difiere del envase utilizado.';end if;
 if j.tipo='crema' and (resina_g<=0 or abs(masa/nullif(resina_g,0)-(j.resultado_metadata->>'concentracion')::numeric)>0.0000001) then
   raise exception 'El peso de la mezcla cambió la concentración. Revisá y guardá la receta antes de cerrar.';end if;
 if j.tipo='aceite_final' and p_retorno*capacidad>volumen then raise exception 'Falta volumen para llenar la cantidad de goteros indicada.';end if;
 if j.tipo in ('crema','capsulas') and p_retorno*capacidad>masa then raise exception 'Hay % g de ingredientes para un resultado declarado de % g.',masa,p_retorno*capacidad;end if;
end; $$;
revoke all on function public.validar_rendimiento_medrano(uuid,numeric) from public,anon,authenticated;

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
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad,masa_pesada_g)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,v_cantidad,v_stock.unidad,
      case when v_stock.categoria='insumos' and v_stock.unidad not in ('g','kg') then nullif(v_line->>'masa_pesada_g','')::numeric end);
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
  if p_tipo='capsulas' then
    if coalesce((p_metadata->>'capsulas_previstas')::numeric,0)<=0 then raise exception 'Indicá las cápsulas previstas.';end if;
    perform public.validar_rendimiento_medrano(v_id,(p_metadata->>'capsulas_previstas')::numeric);
  elsif p_tipo='resina' and nullif(p_metadata->>'resultado_esperado','') is not null then
    perform public.validar_rendimiento_medrano(v_id,(p_metadata->>'resultado_esperado')::numeric);
  end if;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end; $$;

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
    insert into public.medrano_laboratorio_trabajos_materiales(trabajo_id,stock_id,categoria,nombre,cantidad,unidad,masa_pesada_g)
    values(v_id,v_stock.id,v_stock.categoria,v_stock.nombre,v_cantidad,v_stock.unidad,
      case when v_stock.categoria='insumos' and v_stock.unidad not in ('g','kg') then nullif(v_line->>'masa_pesada_g','')::numeric end);
    if v_stock.categoria='resina' then v_resinas:=v_resinas+1;v_resina:=v_stock;v_resina_cantidad:=v_cantidad;
    elsif v_stock.tipo_insumo='envase' then v_envases:=v_envases+1;v_envase:=v_stock;v_previstas:=v_cantidad;
    else v_ingredientes:=v_ingredientes+1;end if;
  end loop;
  if v_resinas<>1 or v_resina.unidad<>'g' or v_envases<>1 or v_envase.unidad<>'unidades' or v_envase.unidad_capacidad<>'g'
     or coalesce(v_envase.capacidad_envase,0)<=0 or v_ingredientes<1 or v_resina.perfil_cannabinoide is null then
    raise exception 'La crema necesita una resina trazable, ingredientes de base y un frasco con capacidad en gramos.'; end if;
  if position('-' in v_resina.perfil_cannabinoide)>0 and nullif(btrim(v_resina.proporcion_cannabinoides),'') is null then
    raise exception 'La resina necesita tener cargado su ratio.'; end if;
  select sum(public.masa_material_medrano(m.unidad,m.cantidad,m.masa_pesada_g)) into v_gramos_totales
  from public.medrano_laboratorio_trabajos_materiales m where m.trabajo_id=v_id and m.stock_id<>v_envase.id;
  if v_gramos_totales<v_envase.capacidad_envase*v_previstas then raise exception 'Faltan gramos de ingredientes para llenar los frascos previstos.';end if;
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

create or replace function public.guardar_produccion_aceite_final(
  p_id uuid,p_aceites uuid[],p_aceite_puro_id uuid,p_envase_id uuid,p_perfil text,p_proporcion text,
  p_concentracion numeric,p_unidades numeric,p_detalle text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;v_estado text;v_stock public.medrano_laboratorio_stock%rowtype;v_puro public.medrano_laboratorio_stock%rowtype;
  v_envase public.medrano_laboratorio_stock%rowtype;v_nombres text[];v_ratios_text text[];v_ratios numeric[]:=array[]::numeric[];
  v_total_ratio numeric:=0;v_total_volumen numeric;v_equivalente numeric;v_volumen_fuentes numeric:=0;v_cantidad numeric;
  v_vehiculos text;v_producto text;v_metadata jsonb;v_i integer;v_distintos integer;
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
  v_vehiculos:=public.vehiculos_aceite_medrano(v_puro.nombre,p_aceites);
  v_producto:=left('Aceite · '||v_vehiculos||' · '||p_perfil||' · Ratio '||array_to_string(v_ratios,':')||
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
    'base',v_vehiculos,'unidades_previstas',p_unidades,'presentacion_ml',v_envase.capacidad_envase,
    'aceite_puro_id',v_puro.id,'envase_id',v_envase.id,'volumen_total',v_total_volumen);
  update public.medrano_laboratorio_trabajos set resultado_metadata=v_metadata where id=v_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(v_id,case when p_id is null then 'creado' else 'editado' end,v_estado,coalesce(v_estado,'pendiente'),auth.uid());
  return v_id;
end;
$$;

create or replace function public.vincular_produccion_aceite_comanda(p_item uuid,p_trabajo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_item public.medrano_comandas_multiproducto_items%rowtype;v_job public.medrano_laboratorio_trabajos%rowtype;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para preparar comandas.'; end if;
  perform 1 from public.medrano_comandas_multiproducto c join public.medrano_comandas_multiproducto_items i on i.comanda_id=c.id
    where i.id=p_item and c.estado='pendiente' for update of c;
  if not found then raise exception 'La comanda ya no está pendiente.';end if;
  select * into v_item from public.medrano_comandas_multiproducto_items where id=p_item for update;
  select * into v_job from public.medrano_laboratorio_trabajos where id=p_trabajo for update;
  if v_item.id is null or not v_item.pedido_laboratorio or v_item.tipo<>'aceites' or v_item.origen_id is not null then
    raise exception 'El aceite de la comanda ya no está pendiente de producción.';
  end if;
  if v_item.preparacion_trabajo_id is not null and v_item.preparacion_trabajo_id<>p_trabajo then
    raise exception 'El renglón ya tiene una producción vinculada.';end if;
  if v_job.id is null or v_job.tipo<>'aceite_final' or not v_job.produccion_controlada or v_job.estado not in ('pendiente','en_proceso') then
    raise exception 'Seleccioná una producción de aceite válida.';
  end if;
  if v_job.resultado_metadata->>'perfil' is distinct from v_item.receta->>'perfil'
     or replace(coalesce(v_job.resultado_metadata->>'proporcion',''),'-',':') is distinct from replace(coalesce(v_item.receta->>'proporcion',''),'-',':')
     or (v_job.resultado_metadata->>'concentracion')::numeric is distinct from (v_item.receta->>'concentracion')::numeric
     or (v_job.resultado_metadata->>'presentacion_ml')::numeric is distinct from (v_item.receta->>'presentacion_ml')::numeric
     or lower(btrim(v_job.resultado_metadata->>'base')) is distinct from lower(btrim(v_item.receta->>'base'))
     or (v_job.resultado_metadata->>'unidades_previstas')::numeric<v_item.cantidad then
    raise exception 'La producción no coincide con la receta y cantidad de la comanda.';
  end if;
  if exists(select 1 from public.medrano_comandas_multiproducto_items where preparacion_trabajo_id=p_trabajo and id<>p_item) then
    raise exception 'La producción ya está vinculada a otra comanda.';
  end if;

  update public.medrano_comandas_multiproducto_items
  set preparacion_estado='en_proceso',preparacion_trabajo_id=p_trabajo
  where id=p_item;

  if v_job.estado='pendiente' then
    perform public.cambiar_estado_trabajo_laboratorio(p_trabajo,'en_proceso');
  end if;
end;
$$;

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
  perform public.validar_rendimiento_medrano(p_id,p_retorno);
  if v_job.tipo='aceite_final' and (select public.vehiculos_aceite_medrano(puro.nombre,
       array(select ma.stock_id from public.medrano_laboratorio_trabajos_materiales ma where ma.trabajo_id=p_id and ma.categoria='aceites' order by array_position(string_to_array(v_job.resultado_metadata->>'perfil','-'),(select s.perfil_cannabinoide from public.medrano_laboratorio_stock s where s.id=ma.stock_id))))
       from public.medrano_laboratorio_stock puro where puro.id=(v_job.resultado_metadata->>'aceite_puro_id')::uuid)
       is distinct from v_job.resultado_metadata->>'base' then raise exception 'Revisá los vehículos y volvé a guardar la receta antes de cerrar.';end if;
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

create or replace function public.finalizar_base_con_merma_v89(p_id uuid,p_retorno numeric,p_concentracion numeric,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.medrano_laboratorio_trabajos%rowtype; teorico numeric; equivalente numeric; etiqueta text;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para finalizar producción.';end if;
 select * into strict j from public.medrano_laboratorio_trabajos where id=p_id for update;
 teorico:=(j.resultado_metadata->>'volumen_teorico')::numeric;
 equivalente:=(j.resultado_metadata->>'resina_equivalente')::numeric;
 if j.tipo<>'aceite_base' or teorico is null or equivalente is null or p_retorno is null or p_retorno<=0 or p_retorno>=teorico
    or p_concentracion is null or p_concentracion<=1 or p_concentracion>='Infinity'::numeric
    or p_retorno/p_concentracion>equivalente or length(btrim(coalesce(p_motivo,''))) not between 3 and 500
 then raise exception 'Revisá el volumen obtenido, la concentración verificada y la explicación de la merma.';end if;
 etiqueta:='Aceite · '||(j.resultado_metadata->>'base')||' · 1:'||trim_scale(p_concentracion)::text||' · '||(j.resultado_metadata->>'perfil')
    ||coalesce(' '||nullif(j.resultado_metadata->>'proporcion',''),'');
 update public.medrano_laboratorio_trabajos set producto=etiqueta,resultado_metadata=resultado_metadata||jsonb_build_object(
  'concentracion_teorica',resultado_metadata->'concentracion','concentracion',p_concentracion,'volumen_verificado_ml',p_retorno,
  'merma_ml',teorico-p_retorno,'motivo_merma',btrim(p_motivo)) where id=p_id;
 perform public.finalizar_produccion_laboratorio(p_id,p_retorno);
end; $$;
revoke all on function public.finalizar_base_con_merma_v89(uuid,numeric,numeric,text) from public,anon;
grant execute on function public.finalizar_base_con_merma_v89(uuid,numeric,numeric,text) to authenticated;

create or replace function public.preparar_aceite_pedido_v89(p_item uuid,p_aceites uuid[],p_aceite_puro_id uuid,p_envase_id uuid,
 p_perfil text,p_proporcion text,p_concentracion numeric,p_unidades numeric,p_detalle text)
returns uuid language plpgsql security definer set search_path='' as $$
declare trabajo uuid;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para preparar comandas.';end if;
 perform 1 from public.medrano_comandas_multiproducto c join public.medrano_comandas_multiproducto_items i on i.comanda_id=c.id
 where i.id=p_item and c.estado='pendiente' for update of c,i;
 if not found then raise exception 'La comanda no está pendiente.';end if;
 trabajo:=public.guardar_produccion_aceite_final(null,p_aceites,p_aceite_puro_id,p_envase_id,p_perfil,p_proporcion,p_concentracion,p_unidades,p_detalle);
 perform public.vincular_produccion_aceite_comanda(p_item,trabajo);
 return trabajo;
end; $$;
revoke all on function public.preparar_aceite_pedido_v89(uuid,uuid[],uuid,uuid,text,text,numeric,numeric,text) from public,anon;
grant execute on function public.preparar_aceite_pedido_v89(uuid,uuid[],uuid,uuid,text,text,numeric,numeric,text) to authenticated;

create or replace function public.cancelar_preparaciones_medrano_v89()
returns trigger language plpgsql security definer set search_path='' as $$
declare trabajo record;
begin
 for trabajo in select t.id from public.medrano_comandas_multiproducto_items i
 join public.medrano_laboratorio_trabajos t on t.id=i.preparacion_trabajo_id
 where i.comanda_id=new.id and i.pedido_laboratorio and t.estado in ('pendiente','en_proceso')
 order by t.id for update of t loop
   perform public.cambiar_estado_trabajo_laboratorio(trabajo.id,'cancelado');
 end loop;
 return new;
end; $$;
revoke all on function public.cancelar_preparaciones_medrano_v89() from public,anon,authenticated;
drop trigger if exists cancelar_preparaciones_v89 on public.medrano_comandas_multiproducto;
create trigger cancelar_preparaciones_v89 after update of estado on public.medrano_comandas_multiproducto
 for each row when (new.estado='eliminada' and old.estado='pendiente') execute function public.cancelar_preparaciones_medrano_v89();
-- Conservar en cada nuevo renglón de resina el perfil elegido incluso si el stock cambia después.
create or replace function public.identificar_resina_comanda_v89()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='resina' then
   select concat_ws(' · ',s.nombre,nullif(s.perfil_cannabinoide,''),
     'Ratio '||replace(nullif(s.proporcion_cannabinoides,''),'-',':'))
   into new.nombre from public.medrano_laboratorio_stock s where s.id=new.origen_id;
 end if;
 return new;
end; $$;
revoke all on function public.identificar_resina_comanda_v89() from public,anon,authenticated;
drop trigger if exists identificar_resina_v89 on public.medrano_comandas_multiproducto_items;
create trigger identificar_resina_v89 before insert or update of origen_id,tipo on public.medrano_comandas_multiproducto_items
 for each row execute function public.identificar_resina_comanda_v89();

-- Si una edición reemplaza los renglones, liberar los trabajos que quedaron sin pedido.
create or replace function public.liberar_preparacion_eliminada_v89()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.medrano_laboratorio_trabajos where id=old.preparacion_trabajo_id
           and estado in ('pendiente','en_proceso') for update) then
    perform public.cambiar_estado_trabajo_laboratorio(old.preparacion_trabajo_id,'cancelado');
 end if;
 return old;
end; $$;
revoke all on function public.liberar_preparacion_eliminada_v89() from public,anon,authenticated;
drop trigger if exists liberar_preparacion_eliminada_v89 on public.medrano_comandas_multiproducto_items;
create trigger liberar_preparacion_eliminada_v89 after delete on public.medrano_comandas_multiproducto_items
 for each row when (old.pedido_laboratorio and old.preparacion_trabajo_id is not null)
 execute function public.liberar_preparacion_eliminada_v89();


-- El registro histórico de un recuento debe poder reflejar el saldo anterior exacto.
alter table public.medrano_stock_control_items drop constraint if exists medrano_stock_control_items_cantidad_sistema_check;
create or replace function public.registrar_control_stock_medrano(
  p_items jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_control_id uuid:=gen_random_uuid();
  v_item jsonb;
  v_sector text;
  v_categoria text;
  v_stock_id uuid;
  v_real numeric;
  v_sistema numeric;
  v_reservado_comandas numeric:=0;
  v_reservado_produccion numeric:=0;
  v_reservado numeric:=0;
  v_disponible numeric:=0;
  v_producto text;
  v_lote text;
  v_unidad text;
  v_diferencia numeric;
  v_estado text;
  v_ajuste boolean;
  v_contados integer:=0;
  v_diferencias integer:=0;
  v_ajustados integer:=0;
  v_pendientes integer:=0;
  v_responsable text;
  v_notas text:=nullif(btrim(coalesce(p_observaciones,'')),'');
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solamente Administración puede registrar controles físicos de stock.';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>500 then
    raise exception 'El control debe incluir entre 1 y 500 productos contados.';
  end if;
  if v_notas is not null and length(v_notas)>1000 then
    raise exception 'Las observaciones no pueden superar los 1000 caracteres.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rainbows-control-fisico-stock',0));
  select coalesce(nullif(btrim(nombre),''),email,'Administración')
    into v_responsable
  from public.perfiles
  where id=auth.uid() and activo is true and lower(btrim(rol))='administrador';
  if v_responsable is null then
    raise exception 'No se encontró un perfil Administrador activo.';
  end if;

  insert into public.medrano_stock_controles(
    id,observaciones,creado_por,responsable_nombre
  ) values(v_control_id,v_notas,auth.uid(),v_responsable);

  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(v_control_id,'ajuste',v_control_id,'registrada','Control físico de stock',auth.uid());

  for v_item in
    select value from jsonb_array_elements(p_items)
    order by value->>'sector',value->>'categoria',value->>'stock_id'
  loop
    begin
      v_sector:=nullif(btrim(v_item->>'sector'),'');
      v_categoria:=nullif(btrim(v_item->>'categoria'),'');
      v_stock_id:=nullif(v_item->>'stock_id','')::uuid;
      v_real:=nullif(v_item->>'cantidad_real','')::numeric;
    exception when others then
      raise exception 'Hay un producto con datos inválidos en el control.';
    end;
    if v_stock_id is null or v_real is null or v_real<0
       or v_real::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Las cantidades contadas deben ser números válidos mayores o iguales a cero.';
    end if;

    if v_sector='dispensario' and v_categoria='flores' then
      select l.gramos_actual,
             coalesce(nullif(btrim(g.nombre),''),nullif(btrim(l.nombre_historico),''),'Flores'),
             l.codigo_lote,'g'
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_dispensario_lotes l
      left join public.geneticas g on g.id=l.genetica_id
      where l.id=v_stock_id
      for update of l;
    elsif v_sector='dispensario' and v_categoria='mostrador' then
      select cantidad,nombre,null::text,'unidades'
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_mostrador_productos
      where id=v_stock_id and (activo or cantidad<0)
      for update;
    elsif v_sector='laboratorio'
          and v_categoria in ('flores','resina','aceites','cremas','capsulas','insumos') then
      select s.cantidad,
             concat_ws(' · ',s.nombre,nullif(btrim(s.perfil_cannabinoide),''),
               case when nullif(btrim(s.proporcion_cannabinoides),'') is not null
                    then 'Ratio '||replace(btrim(s.proporcion_cannabinoides),'-',':') end,
               case when nullif(btrim(g.nombre),'') is not null then 'Genética '||btrim(g.nombre) end),
             s.lote,s.unidad
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_laboratorio_stock s
      left join public.geneticas g on g.id=s.genetica_id
      where s.id=v_stock_id and s.categoria=v_categoria and (s.activo or s.cantidad<0)
      for update of s;
    else
      raise exception 'El sector o la categoría del control no son válidos.';
    end if;

    if not found then
      raise exception 'Uno de los productos ya no existe o cambió de categoría. Actualizá la pantalla y volvé a contar.';
    end if;
    if v_unidad='unidades' and v_real<>trunc(v_real) then
      raise exception 'El conteo de “%” debe expresarse en unidades enteras.',v_producto;
    end if;

    select coalesce(sum(i.cantidad),0)
      into v_reservado_comandas
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente' and c.eliminada_at is null
      and i.tipo=v_categoria and i.origen_id=v_stock_id;

    if v_sector='laboratorio' then
      select coalesce(sum(m.cantidad),0)
        into v_reservado_produccion
      from public.medrano_laboratorio_trabajos_materiales m
      join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
      where m.stock_id=v_stock_id and m.categoria=v_categoria
        and t.produccion_controlada and t.estado='en_proceso';
    else
      v_reservado_produccion:=0;
    end if;

    v_reservado:=coalesce(v_reservado_comandas,0)+coalesce(v_reservado_produccion,0);
    v_disponible:=v_sistema-v_reservado;
    v_diferencia:=v_real-v_sistema;
    if v_diferencia<>0 and (v_notas is null or length(v_notas)<5) then
      raise exception 'Explicá en Observaciones el motivo de las diferencias (al menos 5 caracteres).';
    end if;

    v_ajuste:=false;
    if v_real<v_reservado then
      v_estado:='requiere_revision';
      v_pendientes:=v_pendientes+1;
    elsif v_diferencia=0 then
      v_estado:='coincide';
    else
      v_estado:='ajustado';
      v_ajuste:=true;
      v_ajustados:=v_ajustados+1;
    end if;

    insert into public.medrano_stock_control_items(
      control_id,sector,categoria,stock_id,producto,lote,unidad,
      cantidad_sistema,cantidad_reservada,cantidad_disponible,cantidad_real,
      diferencia,estado,ajuste_aplicado
    ) values(
      v_control_id,v_sector,v_categoria,v_stock_id,v_producto,v_lote,v_unidad,
      v_sistema,v_reservado,v_disponible,v_real,v_diferencia,v_estado,v_ajuste
    );
    v_contados:=v_contados+1;
    if v_diferencia<>0 then v_diferencias:=v_diferencias+1; end if;

    if v_ajuste then
      perform set_config('rainbows.operacion_id',v_control_id::text,true);
      perform set_config('rainbows.operacion_tipo','ajuste',true);
      perform set_config('rainbows.referencia_id',v_control_id::text,true);
      perform set_config(
        'rainbows.stock_accion',
        'Control físico de stock · '||v_producto||
        case when nullif(btrim(coalesce(v_lote,'')),'') is not null then ' · Lote '||v_lote else '' end||
        ' · sistema '||v_sistema||' '||v_unidad||
        ' · contado '||v_real||' '||v_unidad||
        ' · Motivo: '||v_notas,
        true
      );
      if v_sector='dispensario' and v_categoria='flores' then
        update public.medrano_dispensario_lotes set gramos_actual=v_real where id=v_stock_id;
      elsif v_sector='dispensario' and v_categoria='mostrador' then
        update public.medrano_mostrador_productos set cantidad=v_real,updated_at=now() where id=v_stock_id;
      else
        update public.medrano_laboratorio_stock set cantidad=v_real,updated_at=now() where id=v_stock_id;
      end if;
    end if;
  end loop;

  update public.medrano_stock_controles
  set productos_contados=v_contados,
      productos_con_diferencia=v_diferencias,
      productos_ajustados=v_ajustados,
      productos_pendientes_revision=v_pendientes
  where id=v_control_id;

  update public.medrano_operaciones
  set detalle='Control físico de stock · '||v_contados||' contados · '||
      v_diferencias||' diferencias · '||v_ajustados||' ajustados · '||
      v_pendientes||' pendientes de revisión',updated_at=now()
  where id=v_control_id;

  perform set_config('rainbows.stock_accion','',true);
  perform set_config('rainbows.operacion_id','',true);
  perform set_config('rainbows.operacion_tipo','',true);
  perform set_config('rainbows.referencia_id','',true);

  return jsonb_build_object(
    'control_id',v_control_id,
    'productos_contados',v_contados,
    'productos_con_diferencia',v_diferencias,
    'productos_ajustados',v_ajustados,
    'productos_pendientes_revision',v_pendientes
  );
end;
$$;


commit;
