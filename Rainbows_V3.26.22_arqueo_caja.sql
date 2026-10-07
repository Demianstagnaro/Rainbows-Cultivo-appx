-- Rainbows V3.26.22
-- Arqueo y cierre diario de Caja de Medrano.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

alter table public.medrano_caja_movimientos
  drop constraint if exists medrano_caja_movimientos_origen_check;
alter table public.medrano_caja_movimientos
  add constraint medrano_caja_movimientos_origen_check
  check (origen in ('manual','compra_tokens','comanda','arqueo'));

create table if not exists public.medrano_caja_arqueos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  efectivo_esperado numeric not null,
  efectivo_real numeric not null check (efectivo_real>=0),
  diferencia_efectivo numeric not null,
  digital_esperado numeric not null,
  digital_real numeric not null check (digital_real>=0),
  diferencia_digital numeric not null,
  observaciones text,
  cerrado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists medrano_caja_arqueos_fecha_idx
  on public.medrano_caja_arqueos(fecha desc);

alter table public.medrano_caja_arqueos enable row level security;
drop policy if exists medrano_caja_arqueos_select on public.medrano_caja_arqueos;
create policy medrano_caja_arqueos_select
on public.medrano_caja_arqueos for select to authenticated
using (public.usuario_rainbows_medrano());

revoke all on public.medrano_caja_arqueos from public,anon,authenticated;
grant select on public.medrano_caja_arqueos to authenticated;

create or replace function public.bloquear_movimiento_caja_cerrada()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_fecha date;
begin
  v_fecha:=(coalesce(new.created_at,now()) at time zone 'America/Argentina/Buenos_Aires')::date;
  perform pg_advisory_xact_lock(hashtextextended('rainbows-caja-'||v_fecha::text,0));
  if exists(select 1 from public.medrano_caja_arqueos where fecha=v_fecha) then
    raise exception 'La Caja del % ya fue cerrada. El próximo movimiento corresponde a la jornada siguiente.',to_char(v_fecha,'DD/MM/YYYY');
  end if;
  return new;
end;
$$;

drop trigger if exists bloquear_movimiento_caja_cerrada on public.medrano_caja_movimientos;
create trigger bloquear_movimiento_caja_cerrada
before insert on public.medrano_caja_movimientos
for each row execute function public.bloquear_movimiento_caja_cerrada();

create or replace function public.cerrar_caja_medrano(
  p_efectivo_real numeric,
  p_digital_real numeric,
  p_observaciones text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_fecha date;
  v_efectivo_esperado numeric;
  v_digital_esperado numeric;
  v_diferencia_efectivo numeric;
  v_diferencia_digital numeric;
  v_id uuid;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solamente Administración puede realizar el arqueo y cierre de Caja.';
  end if;
  if p_efectivo_real is null or p_efectivo_real<0
     or p_digital_real is null or p_digital_real<0
     or p_efectivo_real::text in ('NaN','Infinity','-Infinity')
     or p_digital_real::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá montos reales válidos para Efectivo y Digital.';
  end if;

  v_fecha:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
  perform pg_advisory_xact_lock(hashtextextended('rainbows-caja-'||v_fecha::text,0));
  if exists(select 1 from public.medrano_caja_arqueos where fecha=v_fecha) then
    raise exception 'La Caja de hoy ya fue cerrada.';
  end if;

  select
    coalesce(sum(case when medio='efectivo' then case when tipo='ingreso' then monto else -monto end else 0 end),0),
    coalesce(sum(case when medio='digital' then case when tipo='ingreso' then monto else -monto end else 0 end),0)
  into v_efectivo_esperado,v_digital_esperado
  from public.medrano_caja_movimientos;

  v_diferencia_efectivo:=p_efectivo_real-v_efectivo_esperado;
  v_diferencia_digital:=p_digital_real-v_digital_esperado;

  if v_diferencia_efectivo<>0 then
    insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,origen,creado_por)
    values(
      case when v_diferencia_efectivo>0 then 'ingreso' else 'egreso' end,
      'efectivo',abs(v_diferencia_efectivo),'Ajuste por arqueo diario · Efectivo','arqueo',auth.uid()
    );
  end if;
  if v_diferencia_digital<>0 then
    insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,origen,creado_por)
    values(
      case when v_diferencia_digital>0 then 'ingreso' else 'egreso' end,
      'digital',abs(v_diferencia_digital),'Ajuste por arqueo diario · Digital','arqueo',auth.uid()
    );
  end if;

  insert into public.medrano_caja_arqueos(
    fecha,efectivo_esperado,efectivo_real,diferencia_efectivo,
    digital_esperado,digital_real,diferencia_digital,observaciones,cerrado_por
  ) values(
    v_fecha,v_efectivo_esperado,p_efectivo_real,v_diferencia_efectivo,
    v_digital_esperado,p_digital_real,v_diferencia_digital,
    nullif(btrim(coalesce(p_observaciones,'')),''),auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.bloquear_movimiento_caja_cerrada() from public,anon,authenticated;
revoke all on function public.cerrar_caja_medrano(numeric,numeric,text) from public,anon;
grant execute on function public.cerrar_caja_medrano(numeric,numeric,text) to authenticated;

commit;
