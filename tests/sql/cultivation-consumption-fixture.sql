-- Fixture aislado para validar la RPC de consumo en PostgreSQL.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.perfiles(id uuid primary key,nombre text,email text,activo boolean,rol text);
create table public.salas(id uuid primary key,nombre text);
create table public.empleados(id uuid primary key,nombre text,activo boolean);
create table public.tareas(id uuid primary key default gen_random_uuid(),sala_id uuid references public.salas,fecha date,nombre text,detalle text,tipo text,estado text,clave_externa text unique);
create table public.realizaciones_tarea(id uuid primary key default gen_random_uuid(),tarea_id uuid unique references public.tareas,realizada_at timestamptz,registrada_por uuid);
create table public.realizacion_empleados(realizacion_id uuid references public.realizaciones_tarea on delete cascade,empleado_id uuid references public.empleados,primary key(realizacion_id,empleado_id));
create table public.palestina_insumos(id uuid primary key default gen_random_uuid(),categoria text,nombre text,unidad text,stock numeric(14,3) check(stock>=0),minimo numeric(14,3) default 0);
create function public.usuario_rainbows_operativo() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol in ('administrador','encargado_p','cultivo'))$$;
create function public.usuario_rainbows_activo() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo)$$;
insert into public.perfiles values ('00000000-0000-0000-0000-000000000001','Operador','operador@example.test',true,'cultivo'),('00000000-0000-0000-0000-000000000002','Consulta','consulta@example.test',true,'medrano');
insert into public.salas values('00000000-0000-0000-0000-000000000011','Flora 1');
insert into public.empleados values('00000000-0000-0000-0000-000000000021','Empleado',true);
insert into public.palestina_insumos values('00000000-0000-0000-0000-000000000031','Cultivo','Pescado','kg',20,0),('00000000-0000-0000-0000-000000000032','Cultivo','Compost','L',100,0);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
