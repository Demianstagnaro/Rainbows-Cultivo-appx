-- RAINBOWS V3.5.0
-- Ejecutar completo en Supabase > SQL Editor > New Query.
-- Crea la lista general de tareas del edificio y sus permisos.

create table if not exists public.tareas_generales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  detalle text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','realizada')),
  creada_por uuid references auth.users(id) on delete set null,
  registrada_por uuid references auth.users(id) on delete set null,
  realizada_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tarea_general_empleados (
  tarea_general_id uuid not null references public.tareas_generales(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  primary key (tarea_general_id, empleado_id)
);

alter table public.tareas_generales enable row level security;
alter table public.tarea_general_empleados enable row level security;

drop policy if exists tareas_generales_lectura on public.tareas_generales;
create policy tareas_generales_lectura
on public.tareas_generales for select
to authenticated
using (public.usuario_rainbows_activo());

drop policy if exists tareas_generales_insert_admin_encargado on public.tareas_generales;
create policy tareas_generales_insert_admin_encargado
on public.tareas_generales for insert
to authenticated
with check (
  exists (
    select 1 from public.perfiles
    where id=auth.uid() and activo=true and rol in ('administrador','encargado')
  )
);

drop policy if exists tareas_generales_update_operativos on public.tareas_generales;
create policy tareas_generales_update_operativos
on public.tareas_generales for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

drop policy if exists tareas_generales_delete_admin_encargado on public.tareas_generales;
create policy tareas_generales_delete_admin_encargado
on public.tareas_generales for delete
to authenticated
using (
  exists (
    select 1 from public.perfiles
    where id=auth.uid() and activo=true and rol in ('administrador','encargado')
  )
);

drop policy if exists tarea_general_empleados_lectura on public.tarea_general_empleados;
create policy tarea_general_empleados_lectura
on public.tarea_general_empleados for select
to authenticated
using (public.usuario_rainbows_activo());

drop policy if exists tarea_general_empleados_insert_operativos on public.tarea_general_empleados;
create policy tarea_general_empleados_insert_operativos
on public.tarea_general_empleados for insert
to authenticated
with check (public.usuario_rainbows_operativo());

drop policy if exists tarea_general_empleados_delete_operativos on public.tarea_general_empleados;
create policy tarea_general_empleados_delete_operativos
on public.tarea_general_empleados for delete
to authenticated
using (public.usuario_rainbows_operativo());

-- Asegura que solo administradores y encargados puedan crear/editar tareas fechadas.
-- Los empleados siguen pudiendo completarlas y corregir una realización.
drop policy if exists rainbows_insert_operativos on public.tareas;
drop policy if exists rainbows_update_operativos on public.tareas;
drop policy if exists rainbows_delete_operativos on public.tareas;

create policy tareas_insert_admin_encargado
on public.tareas for insert
to authenticated
with check (
  exists (
    select 1 from public.perfiles
    where id=auth.uid() and activo=true and rol in ('administrador','encargado')
  )
  or clave_externa is not null
);

create policy tareas_update_operativos
on public.tareas for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy tareas_delete_admin_encargado
on public.tareas for delete
to authenticated
using (
  exists (
    select 1 from public.perfiles
    where id=auth.uid() and activo=true and rol in ('administrador','encargado')
  )
);
