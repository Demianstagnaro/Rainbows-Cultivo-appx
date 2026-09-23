-- El tamaño se define una sola vez y queda fijo en toda la trazabilidad. Requiere V3.24.3.
begin;

-- Antes de bloquear, completa datos históricos respetando esta prioridad:
-- Cosecha → Stock Palestina → Dispensario Medrano.
update public.cosecha_geneticas cg
set tamano=(
  select e.tamano
  from public.stock_ciclos sc
  join public.stock_existencias e on e.ciclo_id=sc.id
  where sc.cosecha_id=cg.cosecha_id
    and e.tamano is not null
    and (
      (cg.genetica_id is not null and e.genetica_id=cg.genetica_id)
      or
      (cg.genetica_id is null and e.genetica_id is null and e.nombre_historico=cg.nombre_historico)
    )
  limit 1
)
where cg.tamano is null
  and exists(
    select 1
    from public.stock_ciclos sc
    join public.stock_existencias e on e.ciclo_id=sc.id
    where sc.cosecha_id=cg.cosecha_id
      and e.tamano is not null
      and (
        (cg.genetica_id is not null and e.genetica_id=cg.genetica_id)
        or
        (cg.genetica_id is null and e.genetica_id is null and e.nombre_historico=cg.nombre_historico)
      )
  );

update public.stock_existencias e
set tamano=cg.tamano
from public.stock_ciclos sc
join public.cosecha_geneticas cg on cg.cosecha_id=sc.cosecha_id
where e.ciclo_id=sc.id
  and cg.tamano is not null
  and (
    (e.genetica_id is not null and cg.genetica_id=e.genetica_id)
    or
    (e.genetica_id is null and cg.genetica_id is null and cg.nombre_historico=e.nombre_historico)
  )
  and e.tamano is distinct from cg.tamano;

update public.stock_existencias e
set tamano=m.tamano
from public.medrano_dispensario_lotes m
where e.tamano is null
  and m.tamano is not null
  and m.codigo_lote=e.numero_lote;

update public.medrano_dispensario_lotes m
set tamano=e.tamano
from public.stock_existencias e
where e.tamano is not null
  and m.codigo_lote=e.numero_lote
  and m.tamano is distinct from e.tamano;

create or replace function public.bloquear_cambio_tamano_lote()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.tamano is not null and old.tamano is distinct from new.tamano then
    raise exception 'El tamaño del lote ya fue definido y no se puede cambiar.';
  end if;
  return new;
end; $$;

drop trigger if exists aa_bloquear_tamano_cosecha on public.cosecha_geneticas;
create trigger aa_bloquear_tamano_cosecha
before update of tamano on public.cosecha_geneticas
for each row execute function public.bloquear_cambio_tamano_lote();

drop trigger if exists aa_bloquear_tamano_stock_palestina on public.stock_existencias;
create trigger aa_bloquear_tamano_stock_palestina
before update of tamano on public.stock_existencias
for each row execute function public.bloquear_cambio_tamano_lote();

drop trigger if exists aa_bloquear_tamano_stock_medrano on public.medrano_dispensario_lotes;
create trigger aa_bloquear_tamano_stock_medrano
before update of tamano on public.medrano_dispensario_lotes
for each row execute function public.bloquear_cambio_tamano_lote();

revoke execute on function public.bloquear_cambio_tamano_lote() from public,anon,authenticated;

commit;
