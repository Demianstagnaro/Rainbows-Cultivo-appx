-- Rainbows V3.18.5
-- Editar una comanda la devuelve de forma segura al estado pendiente.

begin;

create or replace function public.editar_comanda_medrano(
  objetivo_id uuid,
  producto_nuevo text,
  cantidad_nueva numeric,
  paciente_id_nuevo uuid,
  nombre_paciente_nuevo text,
  fecha_nueva date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para editar comandas.';
  end if;
  if nullif(btrim(coalesce(producto_nuevo, '')), '') is null then
    raise exception 'Ingresá el producto.';
  end if;
  if cantidad_nueva is null or cantidad_nueva <= 0 then
    raise exception 'Ingresá una cantidad válida.';
  end if;
  if paciente_id_nuevo is null then
    raise exception 'Seleccioná un paciente.';
  end if;
  if fecha_nueva is null then
    raise exception 'Ingresá la fecha.';
  end if;

  update public.medrano_comandas
  set producto = btrim(producto_nuevo),
      cantidad = cantidad_nueva,
      paciente_id = paciente_id_nuevo,
      nombre_paciente = nullif(btrim(coalesce(nombre_paciente_nuevo, '')), ''),
      fecha = fecha_nueva,
      requiere_cierre = true,
      dispensada_at = null,
      dispensada_fecha = null,
      dispensada_por = null,
      dispensada_por_nombre = null,
      updated_at = now()
  where id = objetivo_id
    and eliminada_at is null;

  if not found then
    raise exception 'No se encontró la comanda o fue eliminada.';
  end if;
end;
$$;

revoke execute on function public.editar_comanda_medrano(uuid, text, numeric, uuid, text, date)
  from public, anon;
grant execute on function public.editar_comanda_medrano(uuid, text, numeric, uuid, text, date)
  to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.editar_comanda_medrano(uuid,text,numeric,uuid,text,date)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.editar_comanda_medrano(uuid,text,numeric,uuid,text,date)',
    'EXECUTE'
  ) then
    raise exception 'Los permisos de editar_comanda_medrano son incorrectos.';
  end if;
end;
$$;

commit;
