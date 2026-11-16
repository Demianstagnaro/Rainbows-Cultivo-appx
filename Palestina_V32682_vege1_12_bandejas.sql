-- Rainbows 3.26.82 — Vege 1 pasa de 11 a 12 bandejas de 9 plantas.
-- Conserva todos los registros, permisos y disparadores existentes.
begin;
alter table public.palestina_semillero drop constraint if exists palestina_semillero_check;
alter table public.palestina_semillero drop constraint if exists palestina_semillero_distribucion_check;
alter table public.palestina_semillero add constraint palestina_semillero_distribucion_check check(
 (sala='Vege 1' and bandeja between 1 and 12 and posicion between 1 and 9 and cantidad=1)
 or (sala='Vege 2' and bandeja between 1 and 11 and posicion between 1 and 9 and cantidad=1)
 or (sala='Esquejes' and bandeja between 1 and 26 and posicion=1 and cantidad between 1 and 36)
);
notify pgrst, 'reload schema';
commit;
