-- Corrección Rainbows V3.26.57
-- Permite guardar el nuevo rol Encargado P en public.perfiles.
-- Ejecutar completo una sola vez en Supabase SQL Editor.

begin;

alter table public.perfiles
  drop constraint if exists perfiles_rol_check;

alter table public.perfiles
  add constraint perfiles_rol_check
  check (lower(trim(rol)) in ('administrador','encargado_p','cultivo','medrano'));

commit;
