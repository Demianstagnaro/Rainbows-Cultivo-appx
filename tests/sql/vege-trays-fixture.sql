create table public.geneticas(id uuid primary key);
insert into public.geneticas values('00000000-0000-0000-0000-000000000001');
-- Definición original de V3.26.61 y campo de fecha de V3.26.64.
create table public.palestina_semillero(
 sala text not null,bandeja integer not null,posicion integer not null,genetica_id uuid not null references public.geneticas(id),cantidad integer not null,fecha_inicio date,
 primary key(sala,bandeja,posicion),
 check((sala in ('Vege 1','Vege 2') and bandeja between 1 and 11 and posicion between 1 and 9 and cantidad=1)
 or(sala='Esquejes' and bandeja between 1 and 26 and posicion=1 and cantidad between 1 and 36))
);
insert into public.palestina_semillero values
 ('Vege 1',11,9,'00000000-0000-0000-0000-000000000001',1,'2026-11-01'),
 ('Vege 2',11,9,'00000000-0000-0000-0000-000000000001',1,null),
 ('Esquejes',26,1,'00000000-0000-0000-0000-000000000001',36,null);
