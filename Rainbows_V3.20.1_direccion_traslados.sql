-- Retira la dirección Laboratorio → Dispensario del acceso de usuarios.
-- Conserva las existencias y el historial creados antes de esta corrección.
begin;
revoke execute on function public.mover_laboratorio_a_dispensario(uuid,numeric) from authenticated;
commit;
