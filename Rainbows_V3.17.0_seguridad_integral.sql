-- Rainbows V3.17.0
-- Seguridad integral, roles definitivos, cuentas, Sala de trabajo e integridad de cosechas.
-- Ejecutar como propietario del proyecto desde Supabase SQL Editor.
-- La migración es atómica: si una sentencia falla, no se aplica ningún cambio.

begin;

-- 1. Roles definitivos. Las funciones SECURITY DEFINER evitan recursión de RLS,
-- pero solo exponen respuestas booleanas y fijan un search_path seguro.
create or replace function public.usuario_rainbows_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and activo is true
      and lower(trim(rol)) in ('administrador', 'cultivo', 'medrano')
  );
$$;

create or replace function public.usuario_rainbows_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and activo is true
      and lower(trim(rol)) = 'administrador'
  );
$$;

-- "editor" queda reservado a acciones administrativas como cosechas y stock.
create or replace function public.usuario_rainbows_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_rainbows_admin();
$$;

-- Operación cotidiana de Palestina: Administrador o Cultivo.
create or replace function public.usuario_rainbows_operativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and activo is true
      and lower(trim(rol)) in ('administrador', 'cultivo')
  );
$$;

-- Gestión y lectura de la sede Medrano.
create or replace function public.usuario_rainbows_medrano()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and activo is true
      and lower(trim(rol)) in ('administrador', 'medrano')
  );
$$;

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_rainbows_admin();
$$;

-- 2. Nuevas cuentas: nunca quedan activas automáticamente.
create or replace function public.rainbows_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  v_nombre := nullif(trim(coalesce(new.raw_user_meta_data->>'nombre', '')), '');
  if v_nombre is null then
    v_nombre := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  insert into public.perfiles(id, email, nombre, rol, activo)
  values(new.id, new.email, v_nombre, 'cultivo', false)
  on conflict(id) do update
    set email = excluded.email,
        nombre = coalesce(nullif(public.perfiles.nombre, ''), excluded.nombre);

  return new;
end;
$$;

-- Se endurece también la función histórica por si algún proyecto conserva ese trigger.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles(id, nombre, email, rol, activo)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    'cultivo',
    false
  )
  on conflict(id) do update set email = excluded.email;
  return new;
end;
$$;

-- Toda cuenta de Auth que haya quedado sin perfil reaparece desactivada para que
-- un administrador pueda identificarla y decidir si la habilita o la elimina.
insert into public.perfiles(id, nombre, email, rol, activo)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'nombre'), ''), split_part(coalesce(u.email, ''), '@', 1)),
  u.email,
  'cultivo',
  false
from auth.users u
left join public.perfiles p on p.id = u.id
where p.id is null
on conflict(id) do nothing;

-- 3. Gestión administrativa de perfiles y eliminación real de Auth.
create or replace function public.admin_actualizar_perfil_v2(
  objetivo_id uuid,
  nuevo_rol text,
  nuevo_activo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rol_normalizado text := lower(trim(coalesce(nuevo_rol, '')));
  objetivo public.perfiles%rowtype;
begin
  -- Serializa altas/bajas administrativas para que dos sesiones concurrentes
  -- no puedan desactivar al último administrador entre ambas.
  perform pg_advisory_xact_lock(871640217);

  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede modificar usuarios.';
  end if;

  if rol_normalizado not in ('administrador', 'cultivo', 'medrano') then
    raise exception 'Rol inválido. Usá Administrador, Cultivo o Medrano.';
  end if;

  if nuevo_activo is null then
    raise exception 'El estado activo del usuario es obligatorio.';
  end if;

  select * into objetivo from public.perfiles where id = objetivo_id for update;
  if not found then
    raise exception 'No se encontró el usuario indicado.';
  end if;

  if objetivo_id = auth.uid() and (rol_normalizado <> 'administrador' or nuevo_activo is not true) then
    raise exception 'No podés quitarte tu propio acceso de administrador.';
  end if;

  if lower(trim(objetivo.rol)) = 'administrador' and objetivo.activo is true
     and (rol_normalizado <> 'administrador' or nuevo_activo is not true)
     and not exists (
       select 1 from public.perfiles
       where id <> objetivo_id and rol = 'administrador' and activo is true
     ) then
    raise exception 'Rainbows debe conservar al menos un administrador activo.';
  end if;

  update public.perfiles
  set rol = rol_normalizado,
      activo = nuevo_activo,
      updated_at = now()
  where id = objetivo_id;
end;
$$;

create or replace function public.admin_eliminar_usuario(objetivo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  objetivo public.perfiles%rowtype;
begin
  perform pg_advisory_xact_lock(871640217);

  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede eliminar usuarios.';
  end if;

  if objetivo_id = auth.uid() then
    raise exception 'No podés eliminar tu propia cuenta.';
  end if;

  select * into objetivo from public.perfiles where id = objetivo_id for update;
  if lower(trim(objetivo.rol)) = 'administrador' and objetivo.activo is true
     and not exists (
       select 1 from public.perfiles
       where id <> objetivo_id and rol = 'administrador' and activo is true
     ) then
    raise exception 'Rainbows debe conservar al menos un administrador activo.';
  end if;

  delete from auth.users where id = objetivo_id;
  if not found then
    raise exception 'No se encontró la cuenta de autenticación indicada.';
  end if;
  -- perfiles se elimina por ON DELETE CASCADE.
end;
$$;

-- 4. Directorio mínimo para mostrar responsables sin exponer correos ni roles.
drop view if exists public.perfiles_directorio;
create or replace function public.listar_perfiles_directorio()
returns table(id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nombre
  from public.perfiles p
  where public.usuario_rainbows_activo()
  order by p.nombre;
$$;

-- No se presupone que el trigger de Auth exista o conserve el nombre histórico.
-- Este trigger propio garantiza que cada alta tenga un perfil inactivo.
drop trigger if exists rainbows_auth_user_created on auth.users;
create trigger rainbows_auth_user_created
after insert on auth.users
for each row execute function public.rainbows_handle_new_user();

-- 5. Sala de trabajo real. El frontend deja de convertirla silenciosamente en NULL.
insert into public.salas(nombre, tipo, activa)
values('Sala de trabajo', 'otra', true)
on conflict(nombre) do update
  set tipo = excluded.tipo,
      activa = true,
      updated_at = now();

-- Repara tareas históricas de Trimming que hayan quedado sin sala.
update public.tareas t
set sala_id = s.id,
    updated_at = now()
from public.salas s
where s.nombre = 'Sala de trabajo'
  and t.sala_id is null
  and (t.nombre ilike 'Trimming - %' or t.clave_externa like '%|Sala de trabajo|%');

-- 6. El detalle por genética es la fuente del total cuando existe desglose.
create or replace function public.rainbows_recalcular_total_cosecha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cosecha_id uuid;
begin
  if tg_op = 'UPDATE' and old.cosecha_id is distinct from new.cosecha_id then
    update public.cosechas
    set total_gramos = coalesce((
          select sum(cg.gramos)
          from public.cosecha_geneticas cg
          where cg.cosecha_id = old.cosecha_id
        ), 0),
        updated_at = now()
    where id = old.cosecha_id;
  end if;

  if tg_op = 'DELETE' then
    v_cosecha_id := old.cosecha_id;
  else
    v_cosecha_id := new.cosecha_id;
  end if;

  update public.cosechas
  set total_gramos = coalesce((
        select sum(cg.gramos)
        from public.cosecha_geneticas cg
        where cg.cosecha_id = v_cosecha_id
      ), 0),
      updated_at = now()
  where id = v_cosecha_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists rainbows_recalcular_total_cosecha on public.cosecha_geneticas;
create trigger rainbows_recalcular_total_cosecha
after insert or update or delete
on public.cosecha_geneticas
for each row execute function public.rainbows_recalcular_total_cosecha();

-- Backfill: corrige únicamente cosechas que sí tienen desglose. Las históricas sin
-- filas de genética conservan su total original.
update public.cosechas c
set total_gramos = x.total,
    updated_at = now()
from (
  select cosecha_id, round(sum(gramos)::numeric, 2) as total
  from public.cosecha_geneticas
  group by cosecha_id
) x
where c.id = x.cosecha_id
  and c.total_gramos is distinct from x.total;

update public.cosechas c
set origen = 'historico',
    updated_at = now()
where c.total_gramos > 0
  and not exists (
    select 1 from public.cosecha_geneticas cg where cg.cosecha_id = c.id
  );

-- 7. Se eliminan TODAS las políticas acumuladas de las tablas de Rainbows para
-- evitar que una política permisiva antigua vuelva a abrir accesos mediante OR.
do $$
declare
  v_table text;
  v_policy record;
  v_tables text[] := array[
    'auditoria', 'camas', 'ciclos', 'configuracion', 'cosecha_geneticas',
    'cosechas', 'empleados', 'equipos', 'eventos_planta', 'geneticas',
    'mantenimientos', 'medrano_comandas', 'medrano_dispensario_lotes',
    'medrano_pacientes', 'perfiles', 'plantas', 'produccion',
    'realizacion_empleados', 'realizaciones_tarea', 'salas', 'stock_ciclos',
    'stock_existencias', 'stock_movimientos', 'stock_transferencia_items',
    'stock_transferencias', 'tarea_general_empleados', 'tareas', 'tareas_generales'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Falta la tabla public.%', v_table;
    end if;

    execute format('alter table public.%I enable row level security', v_table);
    for v_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = v_table
    loop
      execute format('drop policy if exists %I on public.%I', v_policy.policyname, v_table);
    end loop;
  end loop;
end;
$$;

-- Perfiles: cada usuario ve su perfil; solo Administrador ve las filas completas.
create policy perfiles_select
on public.perfiles for select to authenticated
using (id = auth.uid() or public.usuario_rainbows_admin());

-- Directorio operativo de Palestina: lectura para los tres roles activos.
create policy salas_select on public.salas for select to authenticated
using (public.usuario_rainbows_activo());
create policy salas_admin_write on public.salas for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

create policy camas_select on public.camas for select to authenticated
using (public.usuario_rainbows_activo());
create policy camas_operativo_write on public.camas for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy plantas_select on public.plantas for select to authenticated
using (public.usuario_rainbows_activo());
create policy plantas_operativo_write on public.plantas for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy geneticas_select on public.geneticas for select to authenticated
using (public.usuario_rainbows_activo());
create policy geneticas_admin_write on public.geneticas for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

create policy empleados_select on public.empleados for select to authenticated
using (public.usuario_rainbows_activo());
create policy empleados_admin_write on public.empleados for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

create policy tareas_select on public.tareas for select to authenticated
using (public.usuario_rainbows_activo());
create policy tareas_operativo_write on public.tareas for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy realizaciones_select on public.realizaciones_tarea for select to authenticated
using (public.usuario_rainbows_activo());
create policy realizaciones_operativo_write on public.realizaciones_tarea for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy realizacion_empleados_select on public.realizacion_empleados for select to authenticated
using (public.usuario_rainbows_activo());
create policy realizacion_empleados_operativo_write on public.realizacion_empleados for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy tareas_generales_select on public.tareas_generales for select to authenticated
using (public.usuario_rainbows_activo());
create policy tareas_generales_operativo_write on public.tareas_generales for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

create policy tarea_general_empleados_select on public.tarea_general_empleados for select to authenticated
using (public.usuario_rainbows_activo());
create policy tarea_general_empleados_operativo_write on public.tarea_general_empleados for all to authenticated
using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo());

-- Cosechas: tanto lectura como escritura quedan solo para Administrador.
create policy cosechas_admin on public.cosechas for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy cosecha_geneticas_admin on public.cosecha_geneticas for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

-- Stock Palestina: Administrador gestiona; Medrano consulta.
create policy stock_ciclos_select on public.stock_ciclos for select to authenticated
using (public.usuario_rainbows_medrano());
create policy stock_ciclos_admin_write on public.stock_ciclos for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

create policy stock_existencias_select on public.stock_existencias for select to authenticated
using (public.usuario_rainbows_medrano());
create policy stock_existencias_admin_write on public.stock_existencias for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

create policy stock_movimientos_select on public.stock_movimientos for select to authenticated
using (public.usuario_rainbows_medrano());
create policy stock_movimientos_admin_write on public.stock_movimientos for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

-- Transferencias se escriben solo por las RPC verificadas.
create policy stock_transferencias_select on public.stock_transferencias for select to authenticated
using (public.usuario_rainbows_medrano());
create policy stock_transferencia_items_select on public.stock_transferencia_items for select to authenticated
using (public.usuario_rainbows_medrano());

-- Medrano: Administrador y Medrano pueden consultar, crear y editar. No se habilita
-- DELETE directo para preservar historia de pacientes, comandas y lotes.
create policy medrano_pacientes_select on public.medrano_pacientes for select to authenticated
using (public.usuario_rainbows_medrano());
create policy medrano_pacientes_insert on public.medrano_pacientes for insert to authenticated
with check (public.usuario_rainbows_medrano());
create policy medrano_pacientes_update on public.medrano_pacientes for update to authenticated
using (public.usuario_rainbows_medrano()) with check (public.usuario_rainbows_medrano());

create policy medrano_comandas_select on public.medrano_comandas for select to authenticated
using (public.usuario_rainbows_medrano());
create policy medrano_comandas_insert on public.medrano_comandas for insert to authenticated
with check (public.usuario_rainbows_medrano());
create policy medrano_comandas_update on public.medrano_comandas for update to authenticated
using (public.usuario_rainbows_medrano()) with check (public.usuario_rainbows_medrano());

create policy medrano_lotes_select on public.medrano_dispensario_lotes for select to authenticated
using (public.usuario_rainbows_medrano());
create policy medrano_lotes_insert on public.medrano_dispensario_lotes for insert to authenticated
with check (public.usuario_rainbows_medrano());
create policy medrano_lotes_update on public.medrano_dispensario_lotes for update to authenticated
using (public.usuario_rainbows_medrano()) with check (public.usuario_rainbows_medrano());

-- Auditoría y tablas históricas no usadas por el frontend actual: Administrador.
create policy auditoria_admin_select on public.auditoria for select to authenticated
using (public.usuario_rainbows_admin());

create policy ciclos_admin on public.ciclos for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy configuracion_admin on public.configuracion for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy equipos_admin on public.equipos for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy eventos_planta_admin on public.eventos_planta for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy mantenimientos_admin on public.mantenimientos for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());
create policy produccion_admin on public.produccion for all to authenticated
using (public.usuario_rainbows_admin()) with check (public.usuario_rainbows_admin());

-- 8. Privilegios de tabla y funciones: anon no accede a tablas públicas de Rainbows.
revoke all on table
  public.auditoria, public.camas, public.ciclos, public.configuracion,
  public.cosecha_geneticas, public.cosechas, public.empleados, public.equipos,
  public.eventos_planta, public.geneticas, public.mantenimientos,
  public.medrano_comandas, public.medrano_dispensario_lotes,
  public.medrano_pacientes, public.perfiles, public.plantas, public.produccion,
  public.realizacion_empleados, public.realizaciones_tarea, public.salas,
  public.stock_ciclos, public.stock_existencias, public.stock_movimientos,
  public.stock_transferencia_items, public.stock_transferencias,
  public.tarea_general_empleados, public.tareas, public.tareas_generales
from anon;

-- Las políticas RLS anteriores deciden qué operación puede hacer cada rol de app.
grant select, insert, update, delete on table
  public.camas, public.ciclos, public.configuracion, public.cosecha_geneticas,
  public.cosechas, public.empleados, public.equipos, public.eventos_planta,
  public.geneticas, public.mantenimientos, public.medrano_comandas,
  public.medrano_dispensario_lotes, public.medrano_pacientes, public.plantas,
  public.produccion, public.realizacion_empleados, public.realizaciones_tarea,
  public.salas, public.stock_ciclos, public.stock_existencias,
  public.stock_movimientos, public.tarea_general_empleados, public.tareas,
  public.tareas_generales
to authenticated;

revoke all on public.perfiles from authenticated;
grant select on public.perfiles to authenticated;
revoke all on public.auditoria from authenticated;
grant select on public.auditoria to authenticated;
revoke all on public.stock_transferencias, public.stock_transferencia_items from authenticated;
grant select on public.stock_transferencias, public.stock_transferencia_items to authenticated;

-- Solo las RPC de negocio se pueden invocar directamente desde una sesión.
-- Las SECURITY DEFINER existentes tampoco buscan objetos en esquemas modificables.
alter function public.admin_actualizar_perfil(uuid, text, boolean) set search_path = '';
alter function public.confirmar_transferencia_medrano(uuid, jsonb, text) set search_path = '';
alter function public.crear_transferencia_medrano(uuid, date, text, jsonb) set search_path = '';
alter function public.resolver_diferencia_transferencia(uuid, text, text) set search_path = '';
alter function public.sincronizar_cosecha_stock(uuid) set search_path = '';
alter function public.registrar_auditoria() set search_path = '';

revoke execute on function public.admin_actualizar_perfil(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.admin_actualizar_perfil_v2(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_eliminar_usuario(uuid) from public, anon;
revoke execute on function public.confirmar_transferencia_medrano(uuid, jsonb, text) from public, anon;
revoke execute on function public.crear_transferencia_medrano(uuid, date, text, jsonb) from public, anon;
revoke execute on function public.resolver_diferencia_transferencia(uuid, text, text) from public, anon;
revoke execute on function public.sincronizar_cosecha_stock(uuid) from public, anon;

grant execute on function public.admin_actualizar_perfil_v2(uuid, text, boolean) to authenticated;
grant execute on function public.admin_eliminar_usuario(uuid) to authenticated;
grant execute on function public.confirmar_transferencia_medrano(uuid, jsonb, text) to authenticated;
grant execute on function public.crear_transferencia_medrano(uuid, date, text, jsonb) to authenticated;
grant execute on function public.resolver_diferencia_transferencia(uuid, text, text) to authenticated;
grant execute on function public.sincronizar_cosecha_stock(uuid) to authenticated;

revoke execute on function public.usuario_rainbows_activo() from public, anon;
revoke execute on function public.usuario_rainbows_admin() from public, anon;
revoke execute on function public.usuario_rainbows_editor() from public, anon;
revoke execute on function public.usuario_rainbows_operativo() from public, anon;
revoke execute on function public.usuario_rainbows_medrano() from public, anon;
revoke execute on function public.es_administrador() from public, anon;
grant execute on function public.usuario_rainbows_activo() to authenticated;
grant execute on function public.usuario_rainbows_admin() to authenticated;
grant execute on function public.usuario_rainbows_editor() to authenticated;
grant execute on function public.usuario_rainbows_operativo() to authenticated;
grant execute on function public.usuario_rainbows_medrano() to authenticated;
grant execute on function public.es_administrador() to authenticated;
revoke execute on function public.listar_perfiles_directorio() from public, anon;
grant execute on function public.listar_perfiles_directorio() to authenticated;

-- Las funciones de trigger no son APIs públicas.
revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;
revoke execute on function public.rainbows_handle_new_user() from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.actualizar_updated_at() from public, anon, authenticated;
revoke execute on function public.rainbows_asignar_numero_lote_stock() from public, anon, authenticated;
revoke execute on function public.rainbows_asignar_numero_lote_movimiento_stock() from public, anon, authenticated;
revoke execute on function public.rainbows_recalcular_total_cosecha() from public, anon, authenticated;

-- Las funciones futuras no se publican automáticamente para anon.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- 9. Verificaciones de seguridad antes del COMMIT.
do $$
declare
  v_open_policies integer;
  v_policy_count integer;
  v_anon_access integer;
  v_missing_roles integer;
  v_orphan_auth integer;
  v_missing_room integer;
begin
  select count(*) into v_open_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = any(array[
      'auditoria', 'camas', 'ciclos', 'configuracion', 'cosecha_geneticas',
      'cosechas', 'empleados', 'equipos', 'eventos_planta', 'geneticas',
      'mantenimientos', 'medrano_comandas', 'medrano_dispensario_lotes',
      'medrano_pacientes', 'perfiles', 'plantas', 'produccion',
      'realizacion_empleados', 'realizaciones_tarea', 'salas', 'stock_ciclos',
      'stock_existencias', 'stock_movimientos', 'stock_transferencia_items',
      'stock_transferencias', 'tarea_general_empleados', 'tareas', 'tareas_generales'
    ])
    and (
      regexp_replace(coalesce(qual, ''), '[()[:space:]]', '', 'g') = 'true'
      or regexp_replace(coalesce(with_check, ''), '[()[:space:]]', '', 'g') = 'true'
    );
  if v_open_policies <> 0 then
    raise exception 'Quedaron % políticas abiertas.', v_open_policies;
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = any(array[
      'auditoria', 'camas', 'ciclos', 'configuracion', 'cosecha_geneticas',
      'cosechas', 'empleados', 'equipos', 'eventos_planta', 'geneticas',
      'mantenimientos', 'medrano_comandas', 'medrano_dispensario_lotes',
      'medrano_pacientes', 'perfiles', 'plantas', 'produccion',
      'realizacion_empleados', 'realizaciones_tarea', 'salas', 'stock_ciclos',
      'stock_existencias', 'stock_movimientos', 'stock_transferencia_items',
      'stock_transferencias', 'tarea_general_empleados', 'tareas', 'tareas_generales'
    ]);
  if v_policy_count <> 47 then
    raise exception 'Se esperaban 47 políticas de seguridad y quedaron %.', v_policy_count;
  end if;

  select count(*) into v_anon_access
  from unnest(array[
    'auditoria', 'camas', 'ciclos', 'configuracion', 'cosecha_geneticas',
    'cosechas', 'empleados', 'equipos', 'eventos_planta', 'geneticas',
    'mantenimientos', 'medrano_comandas', 'medrano_dispensario_lotes',
    'medrano_pacientes', 'perfiles', 'plantas', 'produccion',
    'realizacion_empleados', 'realizaciones_tarea', 'salas', 'stock_ciclos',
    'stock_existencias', 'stock_movimientos', 'stock_transferencia_items',
    'stock_transferencias', 'tarea_general_empleados', 'tareas', 'tareas_generales'
  ]) as table_name
  where has_table_privilege(
    'anon',
    format('public.%I', table_name),
    'SELECT, INSERT, UPDATE, DELETE'
  );
  if v_anon_access <> 0 then
    raise exception 'El rol anon conserva acceso directo a % tablas.', v_anon_access;
  end if;

  select count(*) into v_missing_roles
  from public.perfiles
  where lower(trim(rol)) not in ('administrador', 'cultivo', 'medrano');
  if v_missing_roles <> 0 then
    raise exception 'Hay % perfiles con roles no válidos.', v_missing_roles;
  end if;

  select count(*) into v_orphan_auth
  from auth.users u left join public.perfiles p on p.id = u.id
  where p.id is null;
  if v_orphan_auth <> 0 then
    raise exception 'Quedaron % cuentas de Auth sin perfil.', v_orphan_auth;
  end if;

  select count(*) into v_missing_room
  from public.salas where nombre = 'Sala de trabajo' and activa is true;
  if v_missing_room <> 1 then
    raise exception 'Sala de trabajo no quedó configurada correctamente.';
  end if;
end;
$$;

commit;

-- IMPORTANTE: además de esta migración, desactivar "Allow new users to sign up"
-- en Supabase Dashboard > Authentication > Settings. El trigger ya garantiza que,
-- aun si se reabre accidentalmente, las cuentas nuevas queden inactivas.
