-- Rainbows V3.18.3
-- Las comandas quedan pendientes hasta confirmar su dispensación.

begin;

alter table public.medrano_comandas
  add column if not exists requiere_cierre boolean not null default false,
  add column if not exists dispensada_at timestamptz,
  add column if not exists dispensada_fecha date,
  add column if not exists dispensada_por uuid,
  add column if not exists dispensada_por_nombre text;

-- Las comandas históricas previas a esta versión conservan su lugar actual.
-- Las del día de la migración y todas las nuevas pasan al nuevo flujo pendiente.
update public.medrano_comandas
set requiere_cierre = true
where fecha >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
  and eliminada_at is null;
alter table public.medrano_comandas
  alter column requiere_cierre set default true;

alter table public.medrano_comandas
  drop constraint if exists medrano_comandas_dispensacion_completa;
alter table public.medrano_comandas
  add constraint medrano_comandas_dispensacion_completa check (
    (dispensada_at is null and dispensada_fecha is null and dispensada_por is null and dispensada_por_nombre is null)
    or
    (dispensada_at is not null and dispensada_fecha is not null and dispensada_por is not null and nullif(btrim(dispensada_por_nombre), '') is not null)
  );

create index if not exists medrano_comandas_dispensada_fecha_idx
  on public.medrano_comandas (dispensada_fecha desc)
  where dispensada_at is not null and eliminada_at is null;

create or replace function public.marcar_comanda_dispensada(objetivo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_nombre text;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para confirmar comandas.';
  end if;

  select nullif(btrim(nombre), '') into v_usuario_nombre
  from public.perfiles
  where id = auth.uid() and activo is true;

  if v_usuario_nombre is null then
    raise exception 'No se pudo identificar al usuario que confirma la comanda.';
  end if;

  update public.medrano_comandas
  set dispensada_at = now(),
      dispensada_fecha = (now() at time zone 'America/Argentina/Buenos_Aires')::date,
      dispensada_por = auth.uid(),
      dispensada_por_nombre = v_usuario_nombre,
      updated_at = now()
  where id = objetivo_id
    and requiere_cierre is true
    and eliminada_at is null
    and dispensada_at is null;

  if not found then
    raise exception 'No se encontró la comanda, ya fue dispensada o fue eliminada.';
  end if;
end;
$$;

-- Solo la RPC puede completar los datos de dispensación. Las operaciones
-- normales conservan acceso exclusivamente a los campos editables de la comanda.
revoke insert, update on public.medrano_comandas from authenticated;
grant insert (producto, cantidad, paciente_id, nombre_paciente, fecha, creado_por, updated_at)
  on public.medrano_comandas to authenticated;
grant update (producto, cantidad, paciente_id, nombre_paciente, fecha, updated_at)
  on public.medrano_comandas to authenticated;

revoke execute on function public.marcar_comanda_dispensada(uuid) from public, anon;
grant execute on function public.marcar_comanda_dispensada(uuid) to authenticated;

do $$
begin
  if has_column_privilege('authenticated', 'public.medrano_comandas', 'dispensada_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.medrano_comandas', 'dispensada_por', 'INSERT') then
    raise exception 'Los datos de dispensación se pueden modificar directamente.';
  end if;
  if has_function_privilege('anon', 'public.marcar_comanda_dispensada(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.marcar_comanda_dispensada(uuid)', 'EXECUTE') then
    raise exception 'Los permisos de marcar_comanda_dispensada son incorrectos.';
  end if;
end;
$$;

commit;
