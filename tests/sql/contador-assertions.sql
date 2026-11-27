\set ON_ERROR_STOP on
begin;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.admin_actualizar_perfil_v2('00000000-0000-0000-0000-000000000004','contador',true);
set local role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
do $$begin
 if not public.es_contador_rainbows() or public.usuario_rainbows_admin() then raise exception 'Rol incorrecto'; end if;
 if not exists(select from public.cosechas) or not exists(select from public.medrano_comandas) then raise exception 'Falta lectura entre sedes'; end if;
 begin update public.cosechas set total_gramos=0; raise exception 'Aceptó edición'; exception when insufficient_privilege then null; end;
 begin delete from public.medrano_comandas; raise exception 'Aceptó eliminación'; exception when insufficient_privilege then null; end;
 begin insert into public.salas(nombre,tipo) values ('Prueba','flora'); raise exception 'Aceptó alta'; exception when insufficient_privilege then null; end;
end$$;
rollback;
