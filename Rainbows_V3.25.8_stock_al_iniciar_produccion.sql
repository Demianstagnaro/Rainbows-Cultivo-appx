-- Valida y reserva virtualmente las materias primas al iniciar una producción. Requiere V3.25.2.
begin;

create or replace function public.proteger_materiales_produccion_iniciada()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_trabajo_id uuid;
  v_estado text;
  v_controlada boolean;
begin
  v_trabajo_id:=case when tg_op='DELETE' then old.trabajo_id else new.trabajo_id end;
  select estado,produccion_controlada into v_estado,v_controlada
  from public.medrano_laboratorio_trabajos where id=v_trabajo_id;
  if v_controlada and v_estado='en_proceso' then
    raise exception 'No se pueden cambiar las materias primas de una producción iniciada. Cancelala, reabrila y editála antes de volver a iniciar.';
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;

drop trigger if exists proteger_materiales_produccion_iniciada on public.medrano_laboratorio_trabajos_materiales;
create trigger proteger_materiales_produccion_iniciada
before insert or update or delete on public.medrano_laboratorio_trabajos_materiales
for each row execute function public.proteger_materiales_produccion_iniciada();

revoke all on function public.proteger_materiales_produccion_iniciada() from public,anon,authenticated;

create or replace function public.cambiar_estado_trabajo_laboratorio(p_id uuid,p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.medrano_laboratorio_trabajos%rowtype;
  v_material record;
  v_stock public.medrano_laboratorio_stock%rowtype;
  v_reservado numeric;
  v_disponible numeric;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para actualizar trabajos.'; end if;
  if p_estado is null or p_estado not in ('pendiente','en_proceso','finalizado','cancelado') then raise exception 'Estado inválido.'; end if;

  select * into v_job from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found then raise exception 'No se encontró el trabajo.'; end if;
  if v_job.produccion_controlada and (p_estado='finalizado' or v_job.estado='finalizado') then
    raise exception 'La producción se finaliza con rendimiento y no puede reabrirse después de mover stock.';
  end if;
  if v_job.estado=p_estado then return; end if;

  if v_job.produccion_controlada and p_estado='en_proceso' then
    if not exists(select 1 from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id) then
      raise exception 'No se puede iniciar: faltan materias primas.';
    end if;
    for v_material in
      select * from public.medrano_laboratorio_trabajos_materiales where trabajo_id=p_id order by stock_id
    loop
      select * into v_stock from public.medrano_laboratorio_stock where id=v_material.stock_id for update;
      if not found or not v_stock.activo or v_stock.categoria<>v_material.categoria or v_stock.unidad<>v_material.unidad then
        raise exception 'No se puede iniciar porque cambió o ya no está disponible la materia prima “%”.',v_material.nombre;
      end if;
      select coalesce(sum(material.cantidad),0) into v_reservado
      from public.medrano_laboratorio_trabajos_materiales material
      join public.medrano_laboratorio_trabajos trabajo on trabajo.id=material.trabajo_id
      where material.stock_id=v_material.stock_id
        and material.trabajo_id<>p_id
        and trabajo.produccion_controlada
        and trabajo.estado='en_proceso';
      v_disponible:=v_stock.cantidad-v_reservado;
      if v_disponible<v_material.cantidad then
        raise exception 'No se puede iniciar: stock insuficiente de “%”. Disponible para producción: % %; solicitado: % %.',
          v_material.nombre,greatest(v_disponible,0),v_material.unidad,v_material.cantidad,v_material.unidad;
      end if;
    end loop;
  end if;

  update public.medrano_laboratorio_trabajos set estado=p_estado,actualizado_por=auth.uid(),updated_at=now(),
    finalizado_por=case when p_estado='finalizado' then auth.uid() else null end,
    finalizado_at=case when p_estado='finalizado' then now() else null end where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_job.estado,p_estado,auth.uid());
end; $$;

revoke all on function public.cambiar_estado_trabajo_laboratorio(uuid,text) from public,anon;
grant execute on function public.cambiar_estado_trabajo_laboratorio(uuid,text) to authenticated;

commit;
