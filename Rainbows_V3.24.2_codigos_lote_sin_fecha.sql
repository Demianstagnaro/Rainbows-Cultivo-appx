-- Quita la fecha DDMMYY del final de los códigos de lote. Requiere V3.24.1.
begin;

create or replace function public.rainbows_codigo_lote_sin_fecha(valor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when valor is null then null else regexp_replace(
    valor,
    '([0-2][0-9]|3[01])(0[1-9]|1[0-2])[0-9]{2}$',
    ''
  ) end;
$$;

-- Corrige los lotes y las copias históricas ya guardadas en Palestina.
update public.stock_existencias
set numero_lote=public.rainbows_codigo_lote_sin_fecha(numero_lote)
where numero_lote is distinct from public.rainbows_codigo_lote_sin_fecha(numero_lote);

update public.stock_movimientos
set numero_lote=public.rainbows_codigo_lote_sin_fecha(numero_lote)
where numero_lote is distinct from public.rainbows_codigo_lote_sin_fecha(numero_lote);

update public.stock_transferencia_items
set numero_lote=public.rainbows_codigo_lote_sin_fecha(numero_lote)
where numero_lote is distinct from public.rainbows_codigo_lote_sin_fecha(numero_lote);

-- Corrige las copias del mismo lote que ya llegaron a Medrano y Laboratorio.
update public.medrano_dispensario_lotes
set codigo_lote=public.rainbows_codigo_lote_sin_fecha(codigo_lote)
where codigo_lote is distinct from public.rainbows_codigo_lote_sin_fecha(codigo_lote);

update public.medrano_traslados_laboratorio
set codigo_lote=public.rainbows_codigo_lote_sin_fecha(codigo_lote)
where codigo_lote is distinct from public.rainbows_codigo_lote_sin_fecha(codigo_lote);

update public.medrano_laboratorio_stock
set lote=public.rainbows_codigo_lote_sin_fecha(lote)
where lote is distinct from public.rainbows_codigo_lote_sin_fecha(lote);

update public.medrano_stock_historial
set lote=public.rainbows_codigo_lote_sin_fecha(lote)
where lote is distinct from public.rainbows_codigo_lote_sin_fecha(lote);

-- Se ejecuta después del generador actual y deja los códigos nuevos sin fecha.
create or replace function public.rainbows_quitar_fecha_numero_lote()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.numero_lote:=public.rainbows_codigo_lote_sin_fecha(new.numero_lote);
  return new;
end; $$;

drop trigger if exists zz_quitar_fecha_lote_existencia on public.stock_existencias;
create trigger zz_quitar_fecha_lote_existencia
before insert or update on public.stock_existencias
for each row execute function public.rainbows_quitar_fecha_numero_lote();

drop trigger if exists zz_quitar_fecha_lote_movimiento on public.stock_movimientos;
create trigger zz_quitar_fecha_lote_movimiento
before insert or update on public.stock_movimientos
for each row execute function public.rainbows_quitar_fecha_numero_lote();

drop trigger if exists zz_quitar_fecha_lote_transferencia on public.stock_transferencia_items;
create trigger zz_quitar_fecha_lote_transferencia
before insert or update on public.stock_transferencia_items
for each row execute function public.rainbows_quitar_fecha_numero_lote();

create or replace function public.rainbows_quitar_fecha_codigo_lote()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.codigo_lote:=public.rainbows_codigo_lote_sin_fecha(new.codigo_lote);
  return new;
end; $$;

drop trigger if exists zz_quitar_fecha_lote_medrano on public.medrano_dispensario_lotes;
create trigger zz_quitar_fecha_lote_medrano
before insert or update on public.medrano_dispensario_lotes
for each row execute function public.rainbows_quitar_fecha_codigo_lote();

drop trigger if exists zz_quitar_fecha_lote_traslado_laboratorio on public.medrano_traslados_laboratorio;
create trigger zz_quitar_fecha_lote_traslado_laboratorio
before insert or update on public.medrano_traslados_laboratorio
for each row execute function public.rainbows_quitar_fecha_codigo_lote();

create or replace function public.rainbows_quitar_fecha_lote_medrano()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.lote:=public.rainbows_codigo_lote_sin_fecha(new.lote);
  return new;
end; $$;

drop trigger if exists zz_quitar_fecha_lote_laboratorio on public.medrano_laboratorio_stock;
create trigger zz_quitar_fecha_lote_laboratorio
before insert or update on public.medrano_laboratorio_stock
for each row execute function public.rainbows_quitar_fecha_lote_medrano();

drop trigger if exists zz_quitar_fecha_lote_historial on public.medrano_stock_historial;
create trigger zz_quitar_fecha_lote_historial
before insert or update on public.medrano_stock_historial
for each row execute function public.rainbows_quitar_fecha_lote_medrano();

revoke execute on function public.rainbows_codigo_lote_sin_fecha(text) from public,anon,authenticated;
revoke execute on function public.rainbows_quitar_fecha_numero_lote() from public,anon,authenticated;
revoke execute on function public.rainbows_quitar_fecha_codigo_lote() from public,anon,authenticated;
revoke execute on function public.rainbows_quitar_fecha_lote_medrano() from public,anon,authenticated;

commit;
