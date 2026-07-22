-- RAINBOWS V3.5.1
-- Ejecutar en Supabase > SQL Editor > New Query.
-- Corrige comparaciones de roles con mayúsculas/espacios y reafirma permisos.

create or replace function public.usuario_rainbows_activo()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.perfiles
    where id=auth.uid()
      and activo=true
      and lower(trim(rol)) in ('administrador','encargado','empleado','lectura')
  );
$$;

create or replace function public.usuario_rainbows_operativo()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.perfiles
    where id=auth.uid()
      and activo=true
      and lower(trim(rol)) in ('administrador','encargado','empleado')
  );
$$;

create or replace function public.usuario_rainbows_editor()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.perfiles
    where id=auth.uid()
      and activo=true
      and lower(trim(rol)) in ('administrador','encargado')
  );
$$;

grant execute on function public.usuario_rainbows_activo() to authenticated;
grant execute on function public.usuario_rainbows_operativo() to authenticated;
grant execute on function public.usuario_rainbows_editor() to authenticated;

-- Tareas fechadas: crear, editar y eliminar solo administrador/encargado.
drop policy if exists tareas_insert_admin_encargado on public.tareas;
drop policy if exists tareas_update_operativos on public.tareas;
drop policy if exists tareas_delete_admin_encargado on public.tareas;

create policy tareas_insert_admin_encargado
on public.tareas for insert
to authenticated
with check (public.usuario_rainbows_editor());

create policy tareas_update_admin_encargado
on public.tareas for update
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy tareas_delete_admin_encargado
on public.tareas for delete
to authenticated
using (public.usuario_rainbows_editor());

-- Las realizaciones pueden ser creadas/corregidas por administrador, encargado o empleado.
drop policy if exists rainbows_insert_operativos on public.realizaciones_tarea;
drop policy if exists rainbows_update_operativos on public.realizaciones_tarea;
drop policy if exists rainbows_delete_operativos on public.realizaciones_tarea;

create policy realizaciones_insert_operativos
on public.realizaciones_tarea for insert
to authenticated
with check (public.usuario_rainbows_operativo());

create policy realizaciones_update_operativos
on public.realizaciones_tarea for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy realizaciones_delete_operativos
on public.realizaciones_tarea for delete
to authenticated
using (public.usuario_rainbows_operativo());

-- Tareas generales.
drop policy if exists tareas_generales_insert_admin_encargado on public.tareas_generales;
drop policy if exists tareas_generales_update_operativos on public.tareas_generales;
drop policy if exists tareas_generales_delete_admin_encargado on public.tareas_generales;

create policy tareas_generales_insert_admin_encargado
on public.tareas_generales for insert
to authenticated
with check (public.usuario_rainbows_editor());

create policy tareas_generales_update_operativos
on public.tareas_generales for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy tareas_generales_delete_admin_encargado
on public.tareas_generales for delete
to authenticated
using (public.usuario_rainbows_editor());

-- Responsables de tareas generales.
drop policy if exists tarea_general_empleados_insert_operativos on public.tarea_general_empleados;
drop policy if exists tarea_general_empleados_delete_operativos on public.tarea_general_empleados;

create policy tarea_general_empleados_insert_operativos
on public.tarea_general_empleados for insert
to authenticated
with check (public.usuario_rainbows_operativo());

create policy tarea_general_empleados_delete_operativos
on public.tarea_general_empleados for delete
to authenticated
using (public.usuario_rainbows_operativo());
