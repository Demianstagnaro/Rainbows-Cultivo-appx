-- Rainbows V3.18.2
-- Conserva las comandas eliminadas y registra quién, cuándo y por qué las eliminó.

begin;

alter table public.medrano_comandas
  add column if not exists eliminada_at timestamptz,
  add column if not exists eliminada_por uuid,
  add column if not exists eliminada_por_nombre text,
  add column if not exists motivo_eliminacion text;

alter table public.medrano_comandas
  drop constraint if exists medrano_comandas_eliminacion_completa;
alter table public.medrano_comandas
  add constraint medrano_comandas_eliminacion_completa check (
    (eliminada_at is null and eliminada_por is null and eliminada_por_nombre is null and motivo_eliminacion is null)
    or
    (eliminada_at is not null and eliminada_por is not null and nullif(btrim(eliminada_por_nombre), '') is not null and nullif(btrim(motivo_eliminacion), '') is not null)
  );

create index if not exists medrano_comandas_eliminada_at_idx
  on public.medrano_comandas (eliminada_at desc)
  where eliminada_at is not null;

-- Una comanda ya eliminada queda congelada. La RPC puede marcarla porque es
-- SECURITY DEFINER, pero una sesión normal solo puede editar registros vigentes.
drop policy if exists medrano_comandas_update on public.medrano_comandas;
create policy medrano_comandas_update
on public.medrano_comandas for update to authenticated
using (public.usuario_rainbows_medrano() and eliminada_at is null)
with check (public.usuario_rainbows_medrano() and eliminada_at is null);

create or replace function public.eliminar_comanda_medrano(objetivo_id uuid, motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda public.medrano_comandas%rowtype;
  v_motivo text := nullif(btrim(coalesce(motivo, '')), '');
  v_usuario_nombre text;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para eliminar comandas.';
  end if;

  select * into v_comanda
  from public.medrano_comandas
  where id = objetivo_id and eliminada_at is null
  for update;

  if not found then
    raise exception 'No se encontró la comanda o ya fue eliminada.';
  end if;

  if v_comanda.fecha < v_hoy and v_motivo is null then
    raise exception 'Ingresá el motivo de la eliminación de la comanda histórica.';
  end if;

  if v_motivo is null then
    v_motivo := 'Eliminación de comanda del día';
  end if;

  select nullif(btrim(nombre), '') into v_usuario_nombre
  from public.perfiles
  where id = auth.uid() and activo is true;

  if v_usuario_nombre is null then
    raise exception 'No se pudo identificar al usuario que elimina la comanda.';
  end if;

  update public.medrano_comandas
  set eliminada_at = now(),
      eliminada_por = auth.uid(),
      eliminada_por_nombre = v_usuario_nombre,
      motivo_eliminacion = v_motivo,
      updated_at = now()
  where id = v_comanda.id;
end;
$$;

-- El borrado físico deja de estar disponible: toda eliminación pasa por la RPC
-- transaccional que conserva la comanda y completa el registro de auditoría.
drop policy if exists medrano_comandas_delete on public.medrano_comandas;
revoke delete on public.medrano_comandas from authenticated;

-- Los campos de auditoría tampoco pueden falsificarse mediante INSERT o UPDATE.
revoke insert, update on public.medrano_comandas from authenticated;
grant insert (producto, cantidad, paciente_id, nombre_paciente, fecha, creado_por, updated_at)
  on public.medrano_comandas to authenticated;
grant update (producto, cantidad, paciente_id, nombre_paciente, fecha, updated_at)
  on public.medrano_comandas to authenticated;

revoke execute on function public.eliminar_comanda_medrano(uuid, text) from public, anon;
grant execute on function public.eliminar_comanda_medrano(uuid, text) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'medrano_comandas' and cmd = 'DELETE'
  ) then
    raise exception 'Quedó habilitado un borrado directo de comandas.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'medrano_comandas'
      and policyname = 'medrano_comandas_update'
      and cmd = 'UPDATE'
      and lower(regexp_replace(coalesce(qual, ''), '[()[:space:]]', '', 'g')) like '%eliminada_atisnull%'
      and lower(regexp_replace(coalesce(with_check, ''), '[()[:space:]]', '', 'g')) like '%eliminada_atisnull%'
  ) then
    raise exception 'La política de edición no congela las comandas eliminadas.';
  end if;
  if has_table_privilege('authenticated', 'public.medrano_comandas', 'DELETE') then
    raise exception 'Authenticated conserva permiso de borrado físico.';
  end if;
  if has_column_privilege('authenticated', 'public.medrano_comandas', 'motivo_eliminacion', 'UPDATE')
     or has_column_privilege('authenticated', 'public.medrano_comandas', 'eliminada_por', 'INSERT') then
    raise exception 'Los campos de auditoría todavía se pueden modificar directamente.';
  end if;
  if has_function_privilege('anon', 'public.eliminar_comanda_medrano(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.eliminar_comanda_medrano(uuid,text)', 'EXECUTE') then
    raise exception 'Los permisos de eliminar_comanda_medrano son incorrectos.';
  end if;
end;
$$;

commit;
