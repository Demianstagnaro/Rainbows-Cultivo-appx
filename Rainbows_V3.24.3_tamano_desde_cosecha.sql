-- El tamaño nace en la cosecha y se propaga al lote de Stock Palestina. Requiere V3.24.2.
begin;

alter table public.cosecha_geneticas
  add column if not exists tamano text check (tamano in ('grande','mediano','chico'));

-- Recupera para cosechas anteriores el tamaño que ya se hubiera clasificado en Stock.
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

-- Cuando se crea el stock automático, toma el tamaño elegido en la cosecha.
create or replace function public.completar_tamano_stock_desde_cosecha()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tamano is null then
    select cg.tamano into new.tamano
    from public.stock_ciclos sc
    join public.cosecha_geneticas cg on cg.cosecha_id=sc.cosecha_id
    where sc.id=new.ciclo_id
      and (
        (new.genetica_id is not null and cg.genetica_id=new.genetica_id)
        or
        (new.genetica_id is null and cg.genetica_id is null and cg.nombre_historico=new.nombre_historico)
      )
    limit 1;
  end if;
  return new;
end; $$;

drop trigger if exists zy_completar_tamano_stock_desde_cosecha on public.stock_existencias;
create trigger zy_completar_tamano_stock_desde_cosecha
before insert or update on public.stock_existencias
for each row execute function public.completar_tamano_stock_desde_cosecha();

-- Si se corrige el tamaño desde Cosechas, actualiza el lote ya sincronizado.
create or replace function public.propagar_tamano_cosecha_a_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.stock_existencias e
  set tamano=new.tamano
  from public.stock_ciclos sc
  where e.ciclo_id=sc.id
    and sc.cosecha_id=new.cosecha_id
    and (
      (new.genetica_id is not null and e.genetica_id=new.genetica_id)
      or
      (new.genetica_id is null and e.genetica_id is null and e.nombre_historico=new.nombre_historico)
    )
    and e.tamano is distinct from new.tamano;
  return new;
end; $$;

drop trigger if exists propagar_tamano_cosecha_a_stock on public.cosecha_geneticas;
create trigger propagar_tamano_cosecha_a_stock
after insert or update of tamano,genetica_id,nombre_historico,cosecha_id on public.cosecha_geneticas
for each row execute function public.propagar_tamano_cosecha_a_stock();

-- Mantiene sincronizada cualquier corrección hecha en Cosecha, Palestina o Dispensario.
create or replace function public.propagar_tamano_stock_a_medrano()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.tamano is distinct from new.tamano then
    update public.cosecha_geneticas cg
    set tamano=new.tamano
    from public.stock_ciclos sc
    where sc.id=new.ciclo_id
      and cg.cosecha_id=sc.cosecha_id
      and (
        (new.genetica_id is not null and cg.genetica_id=new.genetica_id)
        or
        (new.genetica_id is null and cg.genetica_id is null and cg.nombre_historico=new.nombre_historico)
      )
      and cg.tamano is distinct from new.tamano;

    update public.medrano_dispensario_lotes
    set tamano=new.tamano
    where codigo_lote=new.numero_lote
      and tamano is distinct from new.tamano;
  end if;
  return new;
end; $$;

drop trigger if exists propagar_tamano_stock_a_medrano on public.stock_existencias;
create trigger propagar_tamano_stock_a_medrano
after update of tamano on public.stock_existencias
for each row execute function public.propagar_tamano_stock_a_medrano();

create or replace function public.propagar_tamano_medrano_a_stock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.tamano is distinct from new.tamano then
    update public.stock_existencias
    set tamano=new.tamano
    where numero_lote=new.codigo_lote
      and tamano is distinct from new.tamano;
  end if;
  return new;
end; $$;

drop trigger if exists propagar_tamano_medrano_a_stock on public.medrano_dispensario_lotes;
create trigger propagar_tamano_medrano_a_stock
after update of tamano on public.medrano_dispensario_lotes
for each row execute function public.propagar_tamano_medrano_a_stock();

revoke execute on function public.completar_tamano_stock_desde_cosecha() from public,anon,authenticated;
revoke execute on function public.propagar_tamano_cosecha_a_stock() from public,anon,authenticated;
revoke execute on function public.propagar_tamano_stock_a_medrano() from public,anon,authenticated;
revoke execute on function public.propagar_tamano_medrano_a_stock() from public,anon,authenticated;

commit;
