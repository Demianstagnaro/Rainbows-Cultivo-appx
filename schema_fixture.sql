\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb not null
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text default '' not null,
  rol text default 'cultivo' not null,
  activo boolean default false not null,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  nombre text unique not null,
  tipo text not null,
  activa boolean default true not null,
  updated_at timestamptz default now() not null
);

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid references public.salas(id) on delete set null,
  nombre text not null,
  clave_externa text,
  updated_at timestamptz default now() not null
);

create table public.cosechas (
  id uuid primary key,
  total_gramos numeric(12,2) default 0 not null,
  origen text default 'app' not null,
  updated_at timestamptz default now() not null
);

create table public.cosecha_geneticas (
  id uuid primary key,
  cosecha_id uuid not null references public.cosechas(id) on delete cascade,
  gramos numeric(12,2) not null
);

create table public.auditoria (id uuid primary key default gen_random_uuid());
create table public.camas (id uuid primary key default gen_random_uuid());
create table public.ciclos (id uuid primary key default gen_random_uuid());
create table public.configuracion (id uuid primary key default gen_random_uuid());
create table public.empleados (id uuid primary key default gen_random_uuid());
create table public.equipos (id uuid primary key default gen_random_uuid());
create table public.eventos_planta (id uuid primary key default gen_random_uuid());
create table public.geneticas (id uuid primary key default gen_random_uuid());
create table public.mantenimientos (id uuid primary key default gen_random_uuid());
create table public.medrano_comandas (
  id uuid primary key default gen_random_uuid(),
  producto text not null,
  cantidad numeric not null,
  paciente_id uuid,
  nombre_paciente text,
  fecha date not null,
  creado_por uuid,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create table public.medrano_dispensario_lotes (id uuid primary key default gen_random_uuid());
create table public.medrano_pacientes (id uuid primary key default gen_random_uuid());
create table public.plantas (id uuid primary key default gen_random_uuid());
create table public.produccion (id uuid primary key default gen_random_uuid());
create table public.realizacion_empleados (id uuid primary key default gen_random_uuid());
create table public.realizaciones_tarea (id uuid primary key default gen_random_uuid());
create table public.stock_ciclos (id uuid primary key default gen_random_uuid());
create table public.stock_existencias (id uuid primary key default gen_random_uuid());
create table public.stock_movimientos (id uuid primary key default gen_random_uuid());
create table public.stock_transferencia_items (id uuid primary key default gen_random_uuid());
create table public.stock_transferencias (id uuid primary key default gen_random_uuid());
create table public.tarea_general_empleados (id uuid primary key default gen_random_uuid());
create table public.tareas_generales (id uuid primary key default gen_random_uuid());

create view public.perfiles_directorio as
select id, nombre from public.perfiles;

create function public.admin_actualizar_perfil(uuid, text, boolean)
returns void language plpgsql security definer as $$ begin null; end; $$;
create function public.confirmar_transferencia_medrano(uuid, jsonb, text)
returns text language plpgsql security definer as $$ begin return 'ok'; end; $$;
create function public.crear_transferencia_medrano(uuid, date, text, jsonb)
returns uuid language plpgsql security definer as $$ begin return null; end; $$;
create function public.resolver_diferencia_transferencia(uuid, text, text default null)
returns text language plpgsql security definer as $$ begin return 'ok'; end; $$;
create function public.sincronizar_cosecha_stock(uuid)
returns jsonb language plpgsql security definer as $$ begin return '{"ok":true}'::jsonb; end; $$;

create function public.registrar_auditoria()
returns trigger language plpgsql security definer as $$ begin return coalesce(new, old); end; $$;
create function public.actualizar_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create function public.rainbows_asignar_numero_lote_stock()
returns trigger language plpgsql as $$ begin return new; end; $$;
create function public.rainbows_asignar_numero_lote_movimiento_stock()
returns trigger language plpgsql as $$ begin return new; end; $$;

grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
alter table public.camas enable row level security;
create policy antigua_abierta on public.camas for all to authenticated
using (true) with check (true);

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into auth.users(id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.test', '{"nombre":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'pendiente@example.test', '{"nombre":"Pendiente"}'),
  ('00000000-0000-0000-0000-000000000004', 'cultivo@example.test', '{"nombre":"Cultivo"}'),
  ('00000000-0000-0000-0000-000000000005', 'medrano@example.test', '{"nombre":"Medrano"}');
insert into public.perfiles(id, nombre, email, rol, activo) values
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'admin@example.test', 'administrador', true),
  ('00000000-0000-0000-0000-000000000004', 'Cultivo', 'cultivo@example.test', 'cultivo', true),
  ('00000000-0000-0000-0000-000000000005', 'Medrano', 'medrano@example.test', 'medrano', true);

insert into public.cosechas(id, total_gramos, origen) values
  ('10000000-0000-0000-0000-000000000001', 999, 'app'),
  ('10000000-0000-0000-0000-000000000002', 500, 'app');
insert into public.cosecha_geneticas(id, cosecha_id, gramos) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 50);

insert into public.medrano_comandas(id, producto, cantidad, nombre_paciente, fecha, creado_por)
values (
  '30000000-0000-0000-0000-000000000009', 'Comanda histórica existente', 2,
  'Paciente histórico', current_date - 10, '00000000-0000-0000-0000-000000000005'
);
