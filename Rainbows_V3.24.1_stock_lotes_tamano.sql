-- Estandarización de lotes en Stock Palestina y Medrano. Requiere V3.24.0.
begin;

alter table public.stock_existencias
  add column if not exists fecha_ingreso date,
  add column if not exists tamano text check (tamano in ('grande','mediano','chico'));

alter table public.medrano_dispensario_lotes
  add column if not exists tamano text check (tamano in ('grande','mediano','chico'));

-- Para lotes existentes de Palestina se prioriza la fecha real de la cosecha.
update public.stock_existencias e
set fecha_ingreso=coalesce(
  (select c.fecha
   from public.stock_ciclos sc
   join public.cosechas c on c.id=sc.cosecha_id
   where sc.id=e.ciclo_id),
  (e.created_at at time zone 'America/Argentina/Buenos_Aires')::date
)
where e.fecha_ingreso is null;

create or replace function public.completar_fecha_stock_palestina()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.fecha_ingreso is null then
    select c.fecha into new.fecha_ingreso
    from public.stock_ciclos sc
    join public.cosechas c on c.id=sc.cosecha_id
    where sc.id=new.ciclo_id;
    new.fecha_ingreso:=coalesce(new.fecha_ingreso,(now() at time zone 'America/Argentina/Buenos_Aires')::date);
  end if;
  return new;
end; $$;

drop trigger if exists completar_fecha_stock_palestina on public.stock_existencias;
create trigger completar_fecha_stock_palestina
before insert or update of ciclo_id,fecha_ingreso on public.stock_existencias
for each row execute function public.completar_fecha_stock_palestina();

revoke execute on function public.completar_fecha_stock_palestina() from public,anon,authenticated;

-- Los lotes recibidos por traslado heredan fecha y tamaño del lote de Palestina.
update public.medrano_dispensario_lotes m
set tamano=e.tamano
from public.stock_existencias e
where m.tamano is null
  and e.tamano is not null
  and e.numero_lote=m.codigo_lote;

create or replace function public.completar_datos_lote_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  datos record;
begin
  if new.fecha_ingreso is null or new.tamano is null then
    select e.fecha_ingreso,e.tamano into datos
    from public.stock_existencias e
    where e.numero_lote=new.codigo_lote
    order by e.created_at desc
    limit 1;
    new.fecha_ingreso:=coalesce(new.fecha_ingreso,datos.fecha_ingreso);
    new.tamano:=coalesce(new.tamano,datos.tamano);
  end if;
  return new;
end; $$;

drop trigger if exists completar_datos_lote_medrano on public.medrano_dispensario_lotes;
create trigger completar_datos_lote_medrano
before insert on public.medrano_dispensario_lotes
for each row execute function public.completar_datos_lote_medrano();

revoke execute on function public.completar_datos_lote_medrano() from public,anon,authenticated;

commit;
