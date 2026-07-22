-- ============================================================
-- RAINBOWS V3.6.0 — SQL UNIFICADO
-- ============================================================
-- Ejecutar completo una sola vez en:
-- Supabase > SQL Editor > New Query > Run
--
-- Este script:
-- 1. Crea las tablas faltantes para tareas generales.
-- 2. Normaliza funciones de permisos.
-- 3. Elimina políticas antiguas conocidas.
-- 4. Crea una única política clara por acción.
-- 5. Mantiene:
--    - Administrador/Encargado: crear, editar y eliminar tareas.
--    - Empleado: ver todo y completar/corregir realizaciones.
--    - Lectura: solo consultar.
--
-- Los queries anteriores pueden quedar guardados en SQL Editor.
-- No hace falta borrarlos: lo importante es ejecutar este script completo.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. TABLAS PARA TAREAS GENERALES
-- ------------------------------------------------------------

create table if not exists public.tareas_generales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  detalle text not null default '',
  estado text not null default 'pendiente'
    check (estado in ('pendiente','realizada')),
  creada_por uuid references auth.users(id) on delete set null,
  registrada_por uuid references auth.users(id) on delete set null,
  realizada_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tarea_general_empleados (
  tarea_general_id uuid not null
    references public.tareas_generales(id) on delete cascade,
  empleado_id uuid not null
    references public.empleados(id) on delete cascade,
  primary key (tarea_general_id, empleado_id)
);

-- ------------------------------------------------------------
-- 2. FUNCIONES DE PERMISOS
-- ------------------------------------------------------------

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
    where id = auth.uid()
      and activo = true
      and lower(trim(rol)) in (
        'administrador',
        'encargado',
        'empleado',
        'lectura'
      )
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
    where id = auth.uid()
      and activo = true
      and lower(trim(rol)) in (
        'administrador',
        'encargado',
        'empleado'
      )
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
    where id = auth.uid()
      and activo = true
      and lower(trim(rol)) in (
        'administrador',
        'encargado'
      )
  );
$$;

create or replace function public.usuario_rainbows_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.perfiles
    where id = auth.uid()
      and activo = true
      and lower(trim(rol)) = 'administrador'
  );
$$;

grant execute on function public.usuario_rainbows_activo() to authenticated;
grant execute on function public.usuario_rainbows_operativo() to authenticated;
grant execute on function public.usuario_rainbows_editor() to authenticated;
grant execute on function public.usuario_rainbows_admin() to authenticated;

-- ------------------------------------------------------------
-- 3. ACTIVAR RLS
-- ------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.salas enable row level security;
alter table public.camas enable row level security;
alter table public.plantas enable row level security;
alter table public.geneticas enable row level security;
alter table public.empleados enable row level security;
alter table public.tareas enable row level security;
alter table public.realizaciones_tarea enable row level security;
alter table public.realizacion_empleados enable row level security;
alter table public.tareas_generales enable row level security;
alter table public.tarea_general_empleados enable row level security;

-- ------------------------------------------------------------
-- 4. LIMPIEZA DE POLÍTICAS ANTIGUAS CONOCIDAS
-- ------------------------------------------------------------

do $$
declare
  tabla text;
  politica record;
begin
  foreach tabla in array array[
    'perfiles',
    'salas',
    'camas',
    'plantas',
    'geneticas',
    'empleados',
    'tareas',
    'realizaciones_tarea',
    'realizacion_empleados',
    'tareas_generales',
    'tarea_general_empleados'
  ]
  loop
    for politica in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tabla
        and (
          policyname like 'rainbows_%'
          or policyname like 'tareas_%'
          or policyname like 'realizaciones_%'
          or policyname like 'tarea_general_%'
          or policyname like 'tareas_generales_%'
        )
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        politica.policyname,
        tabla
      );
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. POLÍTICAS DE LECTURA
-- ------------------------------------------------------------

create policy rainbows_perfiles_select
on public.perfiles
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_salas_select
on public.salas
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_camas_select
on public.camas
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_plantas_select
on public.plantas
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_geneticas_select
on public.geneticas
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_empleados_select
on public.empleados
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_tareas_select
on public.tareas
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_realizaciones_select
on public.realizaciones_tarea
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_realizacion_empleados_select
on public.realizacion_empleados
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_tareas_generales_select
on public.tareas_generales
for select
to authenticated
using (public.usuario_rainbows_activo());

create policy rainbows_tarea_general_empleados_select
on public.tarea_general_empleados
for select
to authenticated
using (public.usuario_rainbows_activo());

-- ------------------------------------------------------------
-- 6. TAREAS FECHADAS
-- Administrador y Encargado crean/editan/eliminan.
-- ------------------------------------------------------------

create policy rainbows_tareas_insert
on public.tareas
for insert
to authenticated
with check (public.usuario_rainbows_editor());

create policy rainbows_tareas_update
on public.tareas
for update
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy rainbows_tareas_delete
on public.tareas
for delete
to authenticated
using (public.usuario_rainbows_editor());

-- ------------------------------------------------------------
-- 7. REALIZACIONES DE TAREAS FECHADAS
-- Administrador, Encargado y Empleado pueden completar,
-- destildar y corregir responsables.
-- ------------------------------------------------------------

create policy rainbows_realizaciones_insert
on public.realizaciones_tarea
for insert
to authenticated
with check (public.usuario_rainbows_operativo());

create policy rainbows_realizaciones_update
on public.realizaciones_tarea
for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy rainbows_realizaciones_delete
on public.realizaciones_tarea
for delete
to authenticated
using (public.usuario_rainbows_operativo());

create policy rainbows_realizacion_empleados_insert
on public.realizacion_empleados
for insert
to authenticated
with check (public.usuario_rainbows_operativo());

create policy rainbows_realizacion_empleados_update
on public.realizacion_empleados
for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy rainbows_realizacion_empleados_delete
on public.realizacion_empleados
for delete
to authenticated
using (public.usuario_rainbows_operativo());

-- ------------------------------------------------------------
-- 8. TAREAS GENERALES
-- Crear/editar/eliminar: Administrador y Encargado.
-- Completar/destildar: Administrador, Encargado y Empleado.
-- ------------------------------------------------------------

create policy rainbows_tareas_generales_insert
on public.tareas_generales
for insert
to authenticated
with check (public.usuario_rainbows_editor());

create policy rainbows_tareas_generales_update
on public.tareas_generales
for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy rainbows_tareas_generales_delete
on public.tareas_generales
for delete
to authenticated
using (public.usuario_rainbows_editor());

create policy rainbows_tarea_general_empleados_insert
on public.tarea_general_empleados
for insert
to authenticated
with check (public.usuario_rainbows_operativo());

create policy rainbows_tarea_general_empleados_update
on public.tarea_general_empleados
for update
to authenticated
using (public.usuario_rainbows_operativo())
with check (public.usuario_rainbows_operativo());

create policy rainbows_tarea_general_empleados_delete
on public.tarea_general_empleados
for delete
to authenticated
using (public.usuario_rainbows_operativo());

-- ------------------------------------------------------------
-- 9. CONFIGURACIÓN OPERATIVA
-- Salas/camas/plantas/genéticas/empleados:
-- Administrador y Encargado pueden modificar.
-- ------------------------------------------------------------

create policy rainbows_salas_write
on public.salas
for all
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy rainbows_camas_write
on public.camas
for all
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy rainbows_plantas_write
on public.plantas
for all
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy rainbows_geneticas_write
on public.geneticas
for all
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

create policy rainbows_empleados_write
on public.empleados
for all
to authenticated
using (public.usuario_rainbows_editor())
with check (public.usuario_rainbows_editor());

-- ------------------------------------------------------------
-- 10. PERFILES Y ROLES
-- Solo Administrador puede modificar usuarios/roles.
-- ------------------------------------------------------------

create policy rainbows_perfiles_insert
on public.perfiles
for insert
to authenticated
with check (
  id = auth.uid()
  or public.usuario_rainbows_admin()
);

create policy rainbows_perfiles_update
on public.perfiles
for update
to authenticated
using (
  id = auth.uid()
  or public.usuario_rainbows_admin()
)
with check (
  id = auth.uid()
  or public.usuario_rainbows_admin()
);

create policy rainbows_perfiles_delete
on public.perfiles
for delete
to authenticated
using (public.usuario_rainbows_admin());

commit;

-- ============================================================
-- FIN
-- Si Supabase muestra "Success. No rows returned", quedó aplicado.
-- ============================================================
