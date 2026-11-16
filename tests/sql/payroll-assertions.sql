do $$
declare e uuid:='10000000-0000-0000-0000-000000000001';d date:=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')-interval '2 months')::date;
 v_id uuid;v_payment uuid;v_req uuid:=gen_random_uuid();v_result jsonb;v_count int;i int;v_type text;v_amount numeric;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 perform public.guardar_sueldos_palestina('tarifa',jsonb_build_object('empleado_id',e,'version',0,'jornada',900,'horas',9,'sabado',300,'domingo',400));
 for i in 0..6 loop
  v_type:=(array['completa','media','horas','sabado','domingo','ausente','horas'])[i+1];
  v_id:=public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',case when i=0 then v_req else gen_random_uuid() end,'empleado_id',e,'fecha',d+i,'clase','asistencia','tipo',v_type,'horas',2,'importe_manual',case when i=6 then 55 else null end,'notas','Importe especial de prueba'));
  select importe into v_amount from public.palestina_sueldos_registros where id=v_id;
  if v_amount<>(array[900,450,200,300,400,0,55])[i+1] then raise exception 'Importe incorrecto para %',v_type;end if;
 end loop;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',v_req));
 if (select count(*) from public.palestina_sueldos_registros)<>7 then raise exception 'Duplicó reintento';end if;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','asistencia','tipo','completa'));
  raise exception 'Duplicó asistencia';
 exception when others then if sqlerrm='Duplicó asistencia' then raise;end if;end;
 v_payment:=public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','pago','importe',1000,'medio','efectivo'));
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','ajuste','importe',50,'notas','Extra de prueba'));
 v_result:=public.consultar_sueldos_palestina((d+interval '1 month')::date);
 if (select (x->>'saldo_anterior')::numeric from jsonb_array_elements(v_result->'empleados')x where x->>'id'=e::text)<>1355 then raise exception 'No arrastró el saldo correcto';end if;
 perform public.guardar_sueldos_palestina('tarifa',jsonb_build_object('empleado_id',e,'version',1,'jornada',1000,'horas',9,'motivo','Cambio de valor'));
 select id into v_id from public.palestina_sueldos_registros where solicitud=v_req;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',v_id,'version',1,'empleado_id',e,'fecha',d,'clase','asistencia','tipo','completa','notas','Nota corregida','motivo','Corrección de nota'));
 if (select importe from public.palestina_sueldos_registros where id=v_id)<>900 then raise exception 'Cambió el sueldo histórico al editar nota';end if;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',v_id,'version',1,'motivo','Versión vieja'));
  raise exception 'Aceptó edición desactualizada';
 exception when others then if sqlerrm='Aceptó edición desactualizada' then raise;end if;end;
 perform public.guardar_sueldos_palestina('anular',jsonb_build_object('id',v_payment,'version',1,'motivo','Anulación de pago'));
 perform public.guardar_sueldos_palestina('anular',jsonb_build_object('id',v_payment,'version',1,'motivo','Reintento'));
 if (select count(*) from public.palestina_sueldos_auditoria where entidad_id=v_payment)<>2 then raise exception 'Auditoría o anulación duplicada';end if;
 v_result:=public.consultar_sueldos_palestina((d+interval '1 month')::date);
 if (select (x->>'saldo_anterior')::numeric from jsonb_array_elements(v_result->'empleados')x where x->>'id'=e::text)<>2355 then raise exception 'No recalculó pago anulado';end if;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d+9,'clase','pago','importe','NaN','medio','efectivo'));raise exception 'Aceptó NaN';
 exception when others then if sqlerrm='Aceptó NaN' then raise;end if;end;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',current_date+2,'clase','asistencia','tipo','completa'));raise exception 'Aceptó fecha futura';
 exception when others then if sqlerrm='Aceptó fecha futura' then raise;end if;end;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id','10000000-0000-0000-0000-000000000002','fecha',d,'clase','asistencia','tipo','completa'));raise exception 'Aceptó empleado sin configurar';
 exception when others then if sqlerrm='Aceptó empleado sin configurar' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 perform public.consultar_sueldos_palestina(d);
 perform public.guardar_sueldos_palestina('tarifa',jsonb_build_object('empleado_id','10000000-0000-0000-0000-000000000002','version',0,'jornada',100,'horas',9));
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 begin
  perform public.consultar_sueldos_palestina(d);raise exception 'Cultivo vio sueldos';
 exception when others then if sqlerrm='Cultivo vio sueldos' then raise;end if;end;
 begin
  perform public.guardar_sueldos_palestina('anular',jsonb_build_object('id',v_id,'version',2,'motivo','Sin permiso'));raise exception 'Cultivo modificó sueldos';
 exception when others then if sqlerrm='Cultivo modificó sueldos' then raise;end if;end;
 if has_table_privilege('authenticated','public.palestina_sueldos_tarifas','UPDATE') or has_table_privilege('authenticated','public.palestina_sueldos_registros','INSERT') or has_function_privilege('anon','public.guardar_sueldos_palestina(text,jsonb)','EXECUTE') then raise exception 'Escrituras expuestas';end if;
end; $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
do $$ begin
 if exists(select 1 from public.palestina_sueldos_registros) or exists(select 1 from public.palestina_sueldos_tarifas) or exists(select 1 from public.palestina_sueldos_auditoria) then raise exception 'Medrano pudo leer sueldos';end if;
end; $$;
reset role;
