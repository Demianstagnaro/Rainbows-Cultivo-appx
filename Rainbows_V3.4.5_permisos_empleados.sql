-- RAINBOWS V3.4.5
-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Permite que usuarios activos (incluido rol empleado) consulten Salas,
-- Calendario e Historial. Mantiene las modificaciones operativas para
-- administrador, encargado y empleado.

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
      and rol in ('administrador','encargado','empleado','lectura')
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
      and rol in ('administrador','encargado','empleado')
  );
$$;

grant execute on function public.usuario_rainbows_activo() to authenticated;
grant execute on function public.usuario_rainbows_operativo() to authenticated;

-- Lectura para todos los usuarios activos.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'perfiles','salas','camas','plantas','geneticas','empleados',
    'tareas','realizaciones_tarea','realizacion_empleados'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('drop policy if exists rainbows_lectura_activos on public.%I', tabla);
    execute format(
      'create policy rainbows_lectura_activos on public.%I for select to authenticated using (public.usuario_rainbows_activo())',
      tabla
    );
  end loop;
end $$;

-- Escritura operativa para administrador, encargado y empleado.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'tareas','realizaciones_tarea','realizacion_empleados'
  ]
  loop
    execute format('drop policy if exists rainbows_insert_operativos on public.%I', tabla);
    execute format('drop policy if exists rainbows_update_operativos on public.%I', tabla);
    execute format('drop policy if exists rainbows_delete_operativos on public.%I', tabla);

    execute format(
      'create policy rainbows_insert_operativos on public.%I for insert to authenticated with check (public.usuario_rainbows_operativo())',
      tabla
    );
    execute format(
      'create policy rainbows_update_operativos on public.%I for update to authenticated using (public.usuario_rainbows_operativo()) with check (public.usuario_rainbows_operativo())',
      tabla
    );
    execute format(
      'create policy rainbows_delete_operativos on public.%I for delete to authenticated using (public.usuario_rainbows_operativo())',
      tabla
    );
  end loop;
end $$;
