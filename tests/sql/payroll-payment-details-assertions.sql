-- Fixture payroll-fixture.sql + V32686 migration required.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.guardar_datos_pago_palestina('10000000-0000-0000-0000-000000000001',0,'{"nombre_completo":"Nombre completo","dni":"12.345.678","telefono":"1100000000","alias":"alias.test"}');
do $$begin
 if not exists(select 1 from public.palestina_sueldos_datos_pago where dni='12345678' and version=1) then raise exception 'Datos no guardados';end if;
 if jsonb_array_length(public.consultar_datos_pago_palestina())<>1 then raise exception 'Consulta incorrecta';end if;
 begin
 perform public.guardar_datos_pago_palestina('10000000-0000-0000-0000-000000000001',0,'{}');
 raise exception 'TEST: aceptó versión vieja';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin
 perform public.guardar_datos_pago_palestina('10000000-0000-0000-0000-000000000001',1,'{"dni":"invalido"}');
 raise exception 'TEST: aceptó DNI inválido';
 exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.guardar_datos_pago_palestina('10000000-0000-0000-0000-000000000001',1,'{"alias":"nuevo.alias"}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$begin
 begin perform public.consultar_datos_pago_palestina();raise exception 'TEST: cultivo pudo consultar';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 begin perform public.guardar_datos_pago_palestina('10000000-0000-0000-0000-000000000001',2,'{}');raise exception 'TEST: cultivo pudo editar';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
end $$;
set role authenticated;
do $$begin
 begin perform * from public.palestina_sueldos_datos_pago;raise exception 'TEST: acceso directo permitido';exception when insufficient_privilege then null;end;
end $$;
reset role;
