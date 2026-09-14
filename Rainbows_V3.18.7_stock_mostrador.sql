-- Rainbows V3.18.7
-- Inventario compartido y editable del Mostrador de Medrano.

begin;

create table if not exists public.medrano_mostrador_productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  cantidad integer not null default 0 check (cantidad >= 0),
  activo boolean not null default true,
  creado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists medrano_mostrador_productos_nombre_lower_uidx
  on public.medrano_mostrador_productos (lower(btrim(nombre)));

alter table public.medrano_mostrador_productos enable row level security;

drop policy if exists medrano_mostrador_select on public.medrano_mostrador_productos;
drop policy if exists medrano_mostrador_insert on public.medrano_mostrador_productos;
drop policy if exists medrano_mostrador_update on public.medrano_mostrador_productos;

create policy medrano_mostrador_select on public.medrano_mostrador_productos
for select to authenticated using (public.usuario_rainbows_medrano());

create policy medrano_mostrador_insert on public.medrano_mostrador_productos
for insert to authenticated
with check (public.usuario_rainbows_medrano() and creado_por = auth.uid());

create policy medrano_mostrador_update on public.medrano_mostrador_productos
for update to authenticated
using (public.usuario_rainbows_medrano())
with check (public.usuario_rainbows_medrano());

revoke all on public.medrano_mostrador_productos from anon;
grant select, insert, update on public.medrano_mostrador_productos to authenticated;

insert into public.medrano_mostrador_productos(nombre, cantidad)
select seed.nombre, 0
from (values ('Papelitos'), ('Armadores'), ('Picadores')) as seed(nombre)
where not exists (
  select 1 from public.medrano_mostrador_productos product
  where lower(btrim(product.nombre)) = lower(seed.nombre)
);

commit;
