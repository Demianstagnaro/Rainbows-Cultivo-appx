-- Rainbows V3.26.57
-- Rol Encargado P: gestión completa de Palestina sin Config ni acceso a Medrano.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.56.

begin;

-- La tabla también debe aceptar el identificador interno del nuevo rol.
-- Las funciones validan y guardan siempre los roles normalizados en minúsculas.
alter table public.perfiles
  drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check
  check (lower(trim(rol)) in ('administrador','encargado_p','cultivo','medrano'));

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
      and lower(trim(rol)) in ('administrador','encargado_p','cultivo','medrano')
  );
$$;

create or replace function public.usuario_rainbows_palestina_gestion()
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
      and lower(trim(rol)) in ('administrador','encargado_p')
  );
$$;

-- Las RPC históricas de cosecha, stock y traslados usan "editor".
-- Se amplía solamente a Encargado P; Administrador sigue siendo el único
-- rol reconocido por usuario_rainbows_admin().
create or replace function public.usuario_rainbows_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.usuario_rainbows_palestina_gestion();
$$;

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
      and lower(trim(rol)) in ('administrador','encargado_p','cultivo')
  );
$$;

-- Config continúa siendo exclusivamente administrativa. Esta RPC solo permite
-- que un Administrador asigne o retire el nuevo rol.
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
  perform pg_advisory_xact_lock(871640217);

  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede modificar usuarios.';
  end if;

  if rol_normalizado not in ('administrador','encargado_p','cultivo','medrano') then
    raise exception 'Rol inválido. Usá Administrador, Encargado P, Cultivo o Medrano.';
  end if;
  if nuevo_activo is null then
    raise exception 'El estado activo del usuario es obligatorio.';
  end if;

  select * into objetivo
  from public.perfiles
  where id = objetivo_id
  for update;
  if not found then raise exception 'No se encontró el usuario indicado.'; end if;

  if objetivo_id = auth.uid()
     and (rol_normalizado <> 'administrador' or nuevo_activo is not true) then
    raise exception 'No podés quitarte tu propio acceso de administrador.';
  end if;

  if lower(trim(objetivo.rol)) = 'administrador' and objetivo.activo is true
     and (rol_normalizado <> 'administrador' or nuevo_activo is not true)
     and not exists (
       select 1 from public.perfiles
       where id <> objetivo_id
         and lower(trim(rol)) = 'administrador'
         and activo is true
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

-- Escritura administrativa de Palestina. Config, empleados, perfiles, auditoría
-- y toda la sede Medrano conservan sus políticas anteriores de Administrador.
drop policy if exists salas_admin_write on public.salas;
create policy salas_admin_write on public.salas for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists geneticas_admin_write on public.geneticas;
create policy geneticas_admin_write on public.geneticas for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists cosechas_admin on public.cosechas;
create policy cosechas_admin on public.cosechas for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists cosecha_geneticas_admin on public.cosecha_geneticas;
create policy cosecha_geneticas_admin on public.cosecha_geneticas for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists stock_ciclos_select on public.stock_ciclos;
create policy stock_ciclos_select on public.stock_ciclos for select to authenticated
using (public.usuario_rainbows_medrano() or public.usuario_rainbows_palestina_gestion());
drop policy if exists stock_ciclos_admin_write on public.stock_ciclos;
create policy stock_ciclos_admin_write on public.stock_ciclos for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists stock_existencias_select on public.stock_existencias;
create policy stock_existencias_select on public.stock_existencias for select to authenticated
using (public.usuario_rainbows_medrano() or public.usuario_rainbows_palestina_gestion());
drop policy if exists stock_existencias_admin_write on public.stock_existencias;
create policy stock_existencias_admin_write on public.stock_existencias for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists stock_movimientos_select on public.stock_movimientos;
create policy stock_movimientos_select on public.stock_movimientos for select to authenticated
using (public.usuario_rainbows_medrano() or public.usuario_rainbows_palestina_gestion());
drop policy if exists stock_movimientos_admin_write on public.stock_movimientos;
create policy stock_movimientos_admin_write on public.stock_movimientos for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists stock_transferencias_select on public.stock_transferencias;
create policy stock_transferencias_select on public.stock_transferencias for select to authenticated
using (public.usuario_rainbows_medrano() or public.usuario_rainbows_palestina_gestion());
drop policy if exists stock_transferencia_items_select on public.stock_transferencia_items;
create policy stock_transferencia_items_select on public.stock_transferencia_items for select to authenticated
using (public.usuario_rainbows_medrano() or public.usuario_rainbows_palestina_gestion());

drop policy if exists ciclos_admin on public.ciclos;
create policy ciclos_admin on public.ciclos for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());
drop policy if exists equipos_admin on public.equipos;
create policy equipos_admin on public.equipos for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());
drop policy if exists eventos_planta_admin on public.eventos_planta;
create policy eventos_planta_admin on public.eventos_planta for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());
drop policy if exists mantenimientos_admin on public.mantenimientos;
create policy mantenimientos_admin on public.mantenimientos for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());
drop policy if exists produccion_admin on public.produccion;
create policy produccion_admin on public.produccion for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

-- Las funciones actuales se conservan completas y solamente se cambia su
-- control de acceso, evitando duplicar o desactualizar su lógica de trazabilidad.
do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.guardar_cosecha_completa(uuid,uuid,date,text,integer,numeric,numeric,integer,text,text,jsonb)',
    'public.corregir_existencia_stock_palestina(uuid,numeric,numeric,text)',
    'public.eliminar_existencia_stock_palestina(uuid,text)',
    'public.eliminar_registro_stock_palestina(uuid)',
    'public.crear_transferencia_medrano(uuid,date,text,jsonb)',
    'public.resolver_diferencia_transferencia(uuid,text,text)',
    'public.sincronizar_cosecha_stock(uuid)'
  ] loop
    v_function := to_regprocedure(v_signature);
    if v_function is null then
      raise exception 'Falta la función requerida: %',v_signature;
    end if;
    v_definition := pg_get_functiondef(v_function);
    if position('public.usuario_rainbows_admin()' in v_definition) > 0 then
      v_definition := replace(
        v_definition,
        'public.usuario_rainbows_admin()',
        'public.usuario_rainbows_palestina_gestion()'
      );
      execute v_definition;
    end if;
  end loop;
end;
$migration$;

revoke execute on function public.usuario_rainbows_palestina_gestion() from public,anon;
grant execute on function public.usuario_rainbows_palestina_gestion() to authenticated;
revoke execute on function public.usuario_rainbows_activo() from public,anon;
revoke execute on function public.usuario_rainbows_editor() from public,anon;
revoke execute on function public.usuario_rainbows_operativo() from public,anon;
grant execute on function public.usuario_rainbows_activo() to authenticated;
grant execute on function public.usuario_rainbows_editor() to authenticated;
grant execute on function public.usuario_rainbows_operativo() to authenticated;

-- Verificación estructural: Encargado P nunca entra en la función de Medrano
-- ni reemplaza el permiso administrativo de Config.
do $$
begin
  if position('encargado_p' in pg_get_functiondef('public.usuario_rainbows_medrano()'::regprocedure)) > 0 then
    raise exception 'Encargado P obtuvo acceso indebido a Medrano.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='configuracion'
      and policyname='configuracion_admin'
      and coalesce(qual,'') like '%usuario_rainbows_admin%'
  ) then
    raise exception 'Config dejó de estar protegida para Administrador.';
  end if;
end;
$$;

commit;
