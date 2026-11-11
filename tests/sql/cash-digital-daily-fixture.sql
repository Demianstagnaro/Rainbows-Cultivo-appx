create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table auth.users(id uuid primary key);
insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
create function public.usuario_rainbows_admin() returns boolean language sql stable as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
create function public.usuario_rainbows_medrano() returns boolean language sql stable as $$select auth.uid() is not null$$;
create table public.medrano_caja_movimientos(
 id uuid primary key default gen_random_uuid(),tipo text not null check(tipo in ('ingreso','egreso')),
 medio text not null check(medio in ('efectivo','digital')),monto numeric not null check(monto>0),
 concepto text not null,origen text not null check(origen in ('manual','comanda','compra_tokens','arqueo')),
 creado_por uuid not null references auth.users(id),created_at timestamptz not null default now()
);
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

do $$ declare d date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; begin
 insert into public.medrano_caja_arqueos(fecha,efectivo_esperado,efectivo_real,diferencia_efectivo,digital_esperado,digital_real,diferencia_digital,cerrado_por)
 values(d-1,500,500,0,1500,1500,0,'00000000-0000-0000-0000-000000000001');
 insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,origen,creado_por,created_at) values
 ('ingreso','efectivo',500,'Saldo anterior','manual','00000000-0000-0000-0000-000000000001',((d-1)+time '12:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('ingreso','digital',1000,'Ingreso anterior','comanda','00000000-0000-0000-0000-000000000001',((d-1)+time '12:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('ingreso','digital',500,'Ajuste anterior','arqueo','00000000-0000-0000-0000-000000000001',((d-1)+time '12:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('ingreso','efectivo',200,'Ingreso hoy','comanda','00000000-0000-0000-0000-000000000001',(d+time '00:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('ingreso','digital',100,'Ingreso hoy','comanda','00000000-0000-0000-0000-000000000001',(d+time '00:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('egreso','digital',20,'Devolución hoy','manual','00000000-0000-0000-0000-000000000001',(d+time '00:00') at time zone 'America/Argentina/Buenos_Aires'),
 ('ingreso','digital',7,'Ajuste histórico de hoy','arqueo','00000000-0000-0000-0000-000000000001',(d+time '00:00') at time zone 'America/Argentina/Buenos_Aires');
end; $$;
