-- V3.26.67: luz medida en lux. Conserva los valores existentes sin conversión.
begin;
alter table public.cultivo_mediciones
  drop constraint if exists cultivo_mediciones_luz_check;
alter table public.cultivo_mediciones
  add constraint cultivo_mediciones_luz_check
  check (luz is null or luz between 0 and 200000);
comment on column public.cultivo_mediciones.luz is 'Iluminancia medida en lux; los valores anteriores se conservan sin conversión.';
comment on column public.cultivo_parametros_objetivo.luz is 'Objetivo de iluminancia en lux, como valor o rango.';
commit;
