-- Exige proporción cuando una resina contiene más de un cannabinoide. Requiere V3.25.8.
begin;

alter table public.medrano_laboratorio_stock
  drop constraint if exists resina_perfil_multiple_requiere_proporcion;
alter table public.medrano_laboratorio_stock
  add constraint resina_perfil_multiple_requiere_proporcion
  check (
    categoria<>'resina'
    or coalesce(perfil_cannabinoide,'') not like '%-%'
    or nullif(btrim(proporcion_cannabinoides),'') is not null
  ) not valid;

alter table public.medrano_laboratorio_trabajos
  drop constraint if exists produccion_resina_multiple_requiere_proporcion;
alter table public.medrano_laboratorio_trabajos
  add constraint produccion_resina_multiple_requiere_proporcion
  check (
    not (produccion_controlada and tipo='resina')
    or coalesce(resultado_metadata->>'perfil','') not like '%-%'
    or nullif(btrim(resultado_metadata->>'proporcion'),'') is not null
  ) not valid;

commit;
