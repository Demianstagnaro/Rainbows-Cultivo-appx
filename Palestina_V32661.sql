begin;
create table public.palestina_semillero (
 sala text not null, bandeja integer not null, posicion integer not null,
 genetica_id uuid not null references public.geneticas(id), cantidad integer not null,
 primary key(sala,bandeja,posicion),
 check ((sala in ('Vege 1','Vege 2') and bandeja between 1 and 11 and posicion between 1 and 9 and cantidad=1)
 or (sala='Esquejes' and bandeja between 1 and 26 and posicion=1 and cantidad between 1 and 36))
);
create table public.palestina_insumos (
 id uuid primary key default gen_random_uuid(), categoria text not null check(categoria in ('Cultivo','Personal','Oficina','Limpieza')),
 nombre text not null check(length(btrim(nombre)) between 1 and 120), unidad text not null check(length(btrim(unidad)) between 1 and 30),
 stock numeric(14,3) not null check(stock>=0 and stock<>'NaN'::numeric), minimo numeric(14,3) not null check(minimo>=0 and minimo<>'NaN'::numeric)
);
create unique index palestina_insumos_nombre on public.palestina_insumos(categoria,lower(btrim(nombre)));
alter table public.palestina_semillero enable row level security;
alter table public.palestina_insumos enable row level security;
revoke all on public.palestina_semillero,public.palestina_insumos from public,anon,authenticated;
grant select,insert,update,delete on public.palestina_semillero to authenticated;
grant select,insert,update on public.palestina_insumos to authenticated;
create policy consulta on public.palestina_semillero for select to authenticated using(public.usuario_rainbows_activo());
create policy operacion on public.palestina_semillero for all to authenticated using(public.usuario_rainbows_operativo()) with check(public.usuario_rainbows_operativo());
create policy consulta on public.palestina_insumos for select to authenticated using(public.usuario_rainbows_activo());
create policy operacion on public.palestina_insumos for all to authenticated using(public.usuario_rainbows_operativo()) with check(public.usuario_rainbows_operativo());
commit;
