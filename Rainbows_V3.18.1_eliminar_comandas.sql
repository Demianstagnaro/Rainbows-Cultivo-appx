-- Rainbows V3.18.1
-- Permite eliminar comandas únicamente a usuarios activos con rol Administrador o Medrano.

begin;

drop policy if exists medrano_comandas_delete on public.medrano_comandas;
create policy medrano_comandas_delete
on public.medrano_comandas for delete to authenticated
using (public.usuario_rainbows_medrano());

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'medrano_comandas'
      and policyname = 'medrano_comandas_delete'
      and cmd = 'DELETE'
      and regexp_replace(coalesce(qual, ''), '[()[:space:]]', '', 'g') = 'usuario_rainbows_medrano()'
  ) then
    raise exception 'No se pudo verificar la política segura para eliminar comandas.';
  end if;
end;
$$;

commit;
