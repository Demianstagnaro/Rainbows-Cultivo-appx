\set ON_ERROR_STOP on

-- Cada paso de GitHub Actions abre una conexión nueva a PostgreSQL.
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
declare
  v_count integer;
begin
  if (select total_gramos from public.cosechas where id = '10000000-0000-0000-0000-000000000001') <> 50 then
    raise exception 'El backfill no corrigió el total con desglose.';
  end if;
  if (select origen from public.cosechas where id = '10000000-0000-0000-0000-000000000002') <> 'historico' then
    raise exception 'La cosecha sin desglose no quedó identificada como histórica.';
  end if;

  select count(*) into v_count from public.salas where nombre = 'Sala de trabajo' and tipo = 'otra' and activa;
  if v_count <> 1 then raise exception 'Sala de trabajo inválida.'; end if;

  select count(*) into v_count from pg_policies where schemaname = 'public';
  if v_count <> 47 then raise exception 'Cantidad de políticas inesperada: %.', v_count; end if;
  if exists (select 1 from pg_policies where policyname = 'antigua_abierta') then
    raise exception 'La política abierta anterior no fue eliminada.';
  end if;

  if has_table_privilege('anon', 'public.perfiles', 'SELECT')
     or has_table_privilege('anon', 'public.camas', 'INSERT') then
    raise exception 'Anon conserva privilegios de tabla.';
  end if;
  if not has_table_privilege('authenticated', 'public.perfiles', 'SELECT')
     or has_table_privilege('authenticated', 'public.perfiles', 'UPDATE') then
    raise exception 'Privilegios de perfiles incorrectos.';
  end if;
  if has_function_privilege('anon', 'public.admin_eliminar_usuario(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_eliminar_usuario(uuid)', 'EXECUTE') then
    raise exception 'Privilegios de la RPC de eliminación incorrectos.';
  end if;
  if has_table_privilege('authenticated', 'public.medrano_comandas', 'DELETE')
     or has_column_privilege('authenticated', 'public.medrano_comandas', 'motivo_eliminacion', 'UPDATE') then
    raise exception 'La auditoría de comandas puede evadirse mediante acceso directo.';
  end if;
  if has_function_privilege('anon', 'public.eliminar_comanda_medrano(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.eliminar_comanda_medrano(uuid,text)', 'EXECUTE') then
    raise exception 'Privilegios de eliminar_comanda_medrano incorrectos.';
  end if;
  if has_column_privilege('authenticated', 'public.medrano_comandas', 'dispensada_at', 'UPDATE')
     or has_function_privilege('anon', 'public.marcar_comanda_dispensada(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.marcar_comanda_dispensada(uuid)', 'EXECUTE') then
    raise exception 'Privilegios de confirmación de comandas incorrectos.';
  end if;
  if not exists (
    select 1 from public.medrano_comandas
    where id = '30000000-0000-0000-0000-000000000009' and requiere_cierre is false
  ) then
    raise exception 'La migración sacó del historial una comanda histórica existente.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'rainbows_auth_user_created' and not tgisinternal
  ) then
    raise exception 'Falta el trigger seguro de alta de usuarios.';
  end if;

  if not public.usuario_rainbows_admin()
     or not public.usuario_rainbows_operativo()
     or not public.usuario_rainbows_medrano() then
    raise exception 'El administrador no recibe la matriz completa de permisos.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
  if not public.usuario_rainbows_activo()
     or not public.usuario_rainbows_operativo()
     or public.usuario_rainbows_admin()
     or public.usuario_rainbows_medrano() then
    raise exception 'La matriz de Cultivo es incorrecta.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
  if not public.usuario_rainbows_activo()
     or not public.usuario_rainbows_medrano()
     or public.usuario_rainbows_admin()
     or public.usuario_rainbows_operativo() then
    raise exception 'La matriz de Medrano es incorrecta.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  if public.usuario_rainbows_activo()
     or public.usuario_rainbows_admin()
     or public.usuario_rainbows_operativo()
     or public.usuario_rainbows_medrano() then
    raise exception 'Una cuenta inactiva obtuvo permisos.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  begin
    perform public.admin_actualizar_perfil_v2(
      '00000000-0000-0000-0000-000000000001',
      'cultivo',
      true
    );
    raise exception 'La autodemoción de administrador no fue bloqueada.';
  exception when others then
    if sqlerrm not like 'No podés quitarte tu propio acceso%' then
      raise;
    end if;
  end;
end;
$$;

insert into public.medrano_comandas(id, producto, cantidad, nombre_paciente, fecha, creado_por)
values (
  '30000000-0000-0000-0000-000000000002', 'Comanda pendiente', 5,
  'Paciente pendiente', current_date - 3, '00000000-0000-0000-0000-000000000005'
);

do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
  perform public.marcar_comanda_dispensada('30000000-0000-0000-0000-000000000002');

  if not exists (
    select 1 from public.medrano_comandas
    where id = '30000000-0000-0000-0000-000000000002'
      and dispensada_at is not null
      and dispensada_fecha = (now() at time zone 'America/Argentina/Buenos_Aires')::date
      and dispensada_por = '00000000-0000-0000-0000-000000000005'
      and dispensada_por_nombre = 'Medrano'
  ) then
    raise exception 'La dispensación no registró fecha y usuario correctamente.';
  end if;

  begin
    perform public.marcar_comanda_dispensada('30000000-0000-0000-0000-000000000002');
    raise exception 'Una comanda ya dispensada pudo confirmarse dos veces.';
  exception when others then
    if sqlerrm not like 'No se encontró la comanda%' then raise; end if;
  end;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000003', 'nuevo@example.test', '{"nombre":"Nuevo"}');

do $$
begin
  if not exists (
    select 1 from public.perfiles
    where id = '00000000-0000-0000-0000-000000000002'
      and rol = 'cultivo' and activo is false
  ) then
    raise exception 'La cuenta huérfana no fue recuperada de forma segura.';
  end if;
  if not exists (
    select 1 from public.perfiles
    where id = '00000000-0000-0000-0000-000000000003'
      and nombre = 'Nuevo' and rol = 'cultivo' and activo is false
  ) then
    raise exception 'La cuenta nueva no quedó inactiva.';
  end if;
end;
$$;

update public.cosecha_geneticas
set cosecha_id = '10000000-0000-0000-0000-000000000002'
where id = '20000000-0000-0000-0000-000000000001';

do $$
begin
  if (select total_gramos from public.cosechas where id = '10000000-0000-0000-0000-000000000001') <> 0
     or (select total_gramos from public.cosechas where id = '10000000-0000-0000-0000-000000000002') <> 50 then
    raise exception 'Mover un detalle no recalculó ambas cosechas.';
  end if;
end;
$$;

delete from public.cosecha_geneticas
where id = '20000000-0000-0000-0000-000000000001';

do $$
begin
  if (select total_gramos from public.cosechas where id = '10000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'Eliminar el último detalle no dejó el total en cero.';
  end if;
end;
$$;

insert into public.medrano_comandas(id, producto, cantidad, nombre_paciente, fecha, creado_por)
values (
  '30000000-0000-0000-0000-000000000001', 'Producto de prueba', 10,
  'Paciente de prueba', current_date - 1, '00000000-0000-0000-0000-000000000005'
);

do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

  begin
    perform public.eliminar_comanda_medrano('30000000-0000-0000-0000-000000000001', null);
    raise exception 'La comanda histórica se eliminó sin motivo.';
  exception when others then
    if sqlerrm not like 'Ingresá el motivo%' then raise; end if;
  end;

  perform public.eliminar_comanda_medrano(
    '30000000-0000-0000-0000-000000000001',
    'Carga duplicada'
  );

  if not exists (
    select 1 from public.medrano_comandas
    where id = '30000000-0000-0000-0000-000000000001'
      and eliminada_at is not null
      and eliminada_por = '00000000-0000-0000-0000-000000000005'
      and eliminada_por_nombre = 'Medrano'
      and motivo_eliminacion = 'Carga duplicada'
  ) then
    raise exception 'La eliminación no conservó el registro de auditoría completo.';
  end if;
end;
$$;
