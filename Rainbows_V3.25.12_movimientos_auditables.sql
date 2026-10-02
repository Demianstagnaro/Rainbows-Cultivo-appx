-- Rainbows V3.25.12 CORREGIDO: identifica las dispensas y conserva paciente, producto y cantidad.
-- Esta versión reemplaza a la anterior y evita modificar el trigger general del historial.
begin;

alter table public.medrano_stock_historial
  add column if not exists detalle text;

create or replace function public.dispensar_comanda_multiproducto(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.medrano_comandas_multiproducto%rowtype;
  v_line record;
  v_accion text;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso.';
  end if;

  select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
  if not found or v_c.estado<>'pendiente' then
    raise exception 'La comanda ya fue cerrada o eliminada.';
  end if;

  for v_line in
    select * from public.medrano_comandas_multiproducto_items
    where comanda_id=p_id order by tipo,origen_id
  loop
    if not (select permitir_negativo from public.medrano_configuracion_stock where singleton)
       and public.stock_libre_comanda(v_line.tipo,v_line.origen_id,p_id)<v_line.cantidad then
      raise exception 'Stock insuficiente para %.',v_line.nombre;
    end if;
    if v_line.tipo='flores' then
      perform 1 from public.medrano_dispensario_lotes where id=v_line.origen_id for update;
    elsif v_line.tipo='mostrador' then
      perform 1 from public.medrano_mostrador_productos where id=v_line.origen_id for update;
    else
      perform 1 from public.medrano_laboratorio_stock where id=v_line.origen_id for update;
    end if;
  end loop;

  update public.medrano_comandas_multiproducto
  set estado='dispensada',dispensada_por=auth.uid(),dispensada_at=now(),updated_at=now()
  where id=p_id;

  for v_line in
    select * from public.medrano_comandas_multiproducto_items
    where comanda_id=p_id order by tipo,origen_id
  loop
    v_accion := 'Dispensa a paciente · Detalle: '
      ||v_line.cantidad::text||' '||v_line.unidad||' de '||v_line.nombre
      ||' · Paciente '||v_c.paciente_nombre;
    perform set_config('rainbows.stock_accion',v_accion,true);

    if v_line.tipo='flores' then
      update public.medrano_dispensario_lotes
      set gramos_actual=gramos_actual-v_line.cantidad where id=v_line.origen_id;
    elsif v_line.tipo='mostrador' then
      update public.medrano_mostrador_productos
      set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;
    else
      update public.medrano_laboratorio_stock
      set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;
    end if;
    if not found then
      raise exception 'Stock insuficiente para %.',v_line.nombre;
    end if;
  end loop;

  perform set_config('rainbows.stock_accion','',true);
end;
$$;

-- Corrige dispensas anteriores relacionables de forma inequívoca por horario, producto y cantidad.
update public.medrano_stock_historial h
set accion = 'Dispensa a paciente · Detalle: '||(
      select i.cantidad::text||' '||i.unidad||' de '||i.nombre||' · Paciente '||c.paciente_nombre
      from public.medrano_comandas_multiproducto c
      join public.medrano_comandas_multiproducto_items i on i.comanda_id=c.id
      where c.estado='dispensada'
        and abs(extract(epoch from (h.created_at-c.dispensada_at)))<10
        and i.tipo=h.categoria and i.unidad=h.unidad
        and i.cantidad=abs(h.cantidad_nueva-h.cantidad_anterior)
        and (i.nombre=h.producto or i.nombre=concat_ws(' · ',h.producto,h.lote))
      order by c.dispensada_at desc limit 1
    ),
    detalle = (
      select i.cantidad::text||' '||i.unidad||' de '||i.nombre||' · Paciente '||c.paciente_nombre
      from public.medrano_comandas_multiproducto c
      join public.medrano_comandas_multiproducto_items i on i.comanda_id=c.id
      where c.estado='dispensada'
        and abs(extract(epoch from (h.created_at-c.dispensada_at)))<10
        and i.tipo=h.categoria and i.unidad=h.unidad
        and i.cantidad=abs(h.cantidad_nueva-h.cantidad_anterior)
        and (i.nombre=h.producto or i.nombre=concat_ws(' · ',h.producto,h.lote))
      order by c.dispensada_at desc limit 1
    )
where h.accion in ('Ajuste de stock','Ajuste manual de stock')
  and h.cantidad_nueva<h.cantidad_anterior
  and exists (
    select 1
    from public.medrano_comandas_multiproducto c
    join public.medrano_comandas_multiproducto_items i on i.comanda_id=c.id
    where c.estado='dispensada'
      and abs(extract(epoch from (h.created_at-c.dispensada_at)))<10
      and i.tipo=h.categoria and i.unidad=h.unidad
      and i.cantidad=abs(h.cantidad_nueva-h.cantidad_anterior)
      and (i.nombre=h.producto or i.nombre=concat_ws(' · ',h.producto,h.lote))
  );

revoke execute on function public.dispensar_comanda_multiproducto(uuid)
from public,anon,authenticated;

commit;
