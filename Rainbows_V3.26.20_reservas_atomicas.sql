-- Rainbows V3.26.20
-- Evita que comandas y producciones reserven simultáneamente el mismo stock.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

create or replace function public.validar_reserva_comanda_operativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fisico numeric;
  v_reservado_comandas numeric;
  v_reservado_produccion numeric := 0;
  v_disponible numeric;
  v_nombre text;
  v_unidad text;
  v_old_id uuid;
begin
  if new.cantidad is null or new.cantidad <= 0 or new.cantidad::text in ('NaN','Infinity','-Infinity') then
    raise exception 'La cantidad solicitada no es válida.';
  end if;

  if new.tipo = 'flores' then
    select gramos_actual,concat_ws(' · ',nombre_historico,codigo_lote),'g'
      into v_fisico,v_nombre,v_unidad
    from public.medrano_dispensario_lotes
    where id=new.origen_id
    for update;
  elsif new.tipo = 'mostrador' then
    select cantidad,nombre,'unidades'
      into v_fisico,v_nombre,v_unidad
    from public.medrano_mostrador_productos
    where id=new.origen_id and activo
    for update;
  elsif new.tipo in ('resina','aceites','cremas','capsulas') then
    select cantidad,nombre,unidad
      into v_fisico,v_nombre,v_unidad
    from public.medrano_laboratorio_stock
    where id=new.origen_id and categoria=new.tipo and activo
    for update;
  else
    raise exception 'Tipo de producto inválido.';
  end if;

  if v_fisico is null then
    raise exception 'El producto seleccionado ya no está disponible.';
  end if;
  if v_unidad='unidades' and new.cantidad<>trunc(new.cantidad) then
    raise exception 'Las unidades deben ser enteras.';
  end if;

  if tg_op='UPDATE' then
    v_old_id:=old.id;
  else
    v_old_id:=null;
  end if;
  select coalesce(sum(i.cantidad),0)
    into v_reservado_comandas
  from public.medrano_comandas_multiproducto_items i
  join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
  where c.estado='pendiente'
    and i.tipo=new.tipo
    and i.origen_id=new.origen_id
    and (v_old_id is null or i.id<>v_old_id);

  if new.tipo in ('resina','aceites','cremas','capsulas') then
    select coalesce(sum(m.cantidad),0)
      into v_reservado_produccion
    from public.medrano_laboratorio_trabajos_materiales m
    join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
    where m.stock_id=new.origen_id
      and t.produccion_controlada
      and t.estado='en_proceso';
  end if;

  v_disponible:=v_fisico-v_reservado_comandas-v_reservado_produccion;
  if new.cantidad>v_disponible then
    raise exception 'Stock insuficiente de “%”. Disponible: % %; solicitado: % %.',
      v_nombre,greatest(v_disponible,0),v_unidad,new.cantidad,v_unidad;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_reserva_comanda_operativa on public.medrano_comandas_multiproducto_items;
create trigger validar_reserva_comanda_operativa
before insert or update of tipo,origen_id,cantidad
on public.medrano_comandas_multiproducto_items
for each row execute function public.validar_reserva_comanda_operativa();

create or replace function public.validar_inicio_produccion_operativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material record;
  v_stock public.medrano_laboratorio_stock%rowtype;
  v_reservado_comandas numeric;
  v_reservado_produccion numeric;
  v_disponible numeric;
begin
  if not new.produccion_controlada
     or new.estado<>'en_proceso'
     or old.estado is not distinct from new.estado then
    return new;
  end if;

  for v_material in
    select *
    from public.medrano_laboratorio_trabajos_materiales
    where trabajo_id=new.id
    order by stock_id
  loop
    select * into v_stock
    from public.medrano_laboratorio_stock
    where id=v_material.stock_id
    for update;

    if not found or not v_stock.activo
       or v_stock.categoria<>v_material.categoria
       or v_stock.unidad<>v_material.unidad then
      raise exception 'No se puede iniciar porque cambió o ya no está disponible la materia prima “%”.',v_material.nombre;
    end if;

    select coalesce(sum(i.cantidad),0)
      into v_reservado_comandas
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente'
      and i.tipo=v_stock.categoria
      and i.origen_id=v_stock.id;

    select coalesce(sum(m.cantidad),0)
      into v_reservado_produccion
    from public.medrano_laboratorio_trabajos_materiales m
    join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
    where m.stock_id=v_stock.id
      and m.trabajo_id<>new.id
      and t.produccion_controlada
      and t.estado='en_proceso';

    v_disponible:=v_stock.cantidad-v_reservado_comandas-v_reservado_produccion;
    if v_material.cantidad>v_disponible then
      raise exception 'No se puede iniciar: stock insuficiente de “%”. Disponible: % %; solicitado: % %.',
        v_material.nombre,greatest(v_disponible,0),v_material.unidad,v_material.cantidad,v_material.unidad;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists validar_inicio_produccion_operativa on public.medrano_laboratorio_trabajos;
create trigger validar_inicio_produccion_operativa
before update of estado
on public.medrano_laboratorio_trabajos
for each row execute function public.validar_inicio_produccion_operativa();

revoke all on function public.validar_reserva_comanda_operativa() from public,anon,authenticated;
revoke all on function public.validar_inicio_produccion_operativa() from public,anon,authenticated;

commit;
