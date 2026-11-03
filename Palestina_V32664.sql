-- Incluye fecha de almácigos y cantidad de compra de insumos.
-- Reemplaza el SQL de V3.26.63; no requiere haberlo ejecutado.
begin;
alter table public.palestina_semillero
  add column if not exists fecha_inicio date;
alter table public.palestina_insumos
  add column if not exists reponer numeric(14,3)
  check (reponer >= 0 and reponer <> 'NaN'::numeric);
-- Los insumos existentes quedan sin cantidad de compra hasta definirla.
commit;
