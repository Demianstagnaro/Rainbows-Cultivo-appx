create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.perfiles(id uuid primary key,nombre text,email text,activo boolean,rol text);
insert into public.perfiles values('00000000-0000-0000-0000-000000000001','Administración','admin@example.test',true,'administrador'),('00000000-0000-0000-0000-000000000002','Encargado','enc@example.test',true,'encargado_p'),('00000000-0000-0000-0000-000000000003','Cultivo','cult@example.test',true,'cultivo'),('00000000-0000-0000-0000-000000000004','Consulta Medrano','med@example.test',true,'medrano');
create function public.usuario_rainbows_palestina_gestion() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and activo and rol in ('administrador','encargado_p'))$$;
