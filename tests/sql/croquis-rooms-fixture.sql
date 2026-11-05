create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.perfiles(id uuid primary key,nombre text,email text,activo boolean,rol text);
create table public.salas(id uuid primary key,nombre text);
create table public.geneticas(id uuid primary key,nombre text,nomenclatura text,activa boolean);
create table public.camas(id uuid primary key,sala_id uuid references public.salas,numero integer,capacidad integer);
create table public.plantas(id uuid primary key default gen_random_uuid(),cama_id uuid references public.camas,posicion integer,habilitada boolean,ocupada boolean default false,genetica_id uuid references public.geneticas,observaciones text not null default '');
create table public.palestina_semillero(sala text,bandeja integer,posicion integer,genetica_id uuid references public.geneticas,cantidad integer,fecha_inicio date,primary key(sala,bandeja,posicion));
create function public.usuario_rainbows_operativo() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol in ('administrador','encargado_p','cultivo'))$$;
create function public.usuario_rainbows_activo() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo)$$;
insert into public.perfiles values('00000000-0000-0000-0000-000000000001','Operador','op@example.test',true,'cultivo'),('00000000-0000-0000-0000-000000000002','Consulta','ro@example.test',true,'medrano');
insert into public.salas values('00000000-0000-0000-0000-000000000011','Flora 1'),('00000000-0000-0000-0000-000000000012','Flora 2');
insert into public.geneticas values('00000000-0000-0000-0000-000000000021','Mandarin','MC',true),('00000000-0000-0000-0000-000000000022','Sugar','S',true),('00000000-0000-0000-0000-000000000023','Archivada','A',false);
insert into public.camas values('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011',1,5),('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000012',1,9);
insert into public.plantas(cama_id,posicion,habilitada,ocupada,genetica_id,observaciones)
select c.id,n,n<=c.capacidad,n=1,'00000000-0000-0000-0000-000000000022','Existente' from public.camas c cross join generate_series(1,9) n;
