do $$
declare e uuid;d date:=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')-interval '2 months')::date;v_id uuid;v_json jsonb;v_amount numeric;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if (select count(*) from public.empleados where lower(btrim(nombre))='norma')<>1 then raise exception 'Norma duplicada o ausente';end if;
 select id into e from public.empleados where lower(btrim(nombre))='norma';
 perform public.guardar_sueldos_palestina('tarifa',jsonb_build_object('empleado_id',e,'version',0,'modalidad','mensual','jornada',1200,'horas',1));
 v_id:=public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','asistencia','tipo','mensual'));
 if (select importe from public.palestina_sueldos_registros where id=v_id)<>1200 then raise exception 'Sueldo mensual incorrecto';end if;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d+1,'clase','asistencia','tipo','mensual'));raise exception 'Repitió sueldo mensual en otro día';
 exception when others then if sqlerrm='Repitió sueldo mensual en otro día' then raise;end if;end;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','asistencia','tipo','mensual'));raise exception 'Duplicó sueldo mensual';
 exception when others then if sqlerrm='Duplicó sueldo mensual' then raise;end if;end;
 begin
  perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d+2,'clase','asistencia','tipo','completa'));raise exception 'Multiplicó sueldo mensual por asistencia';
 exception when others then if sqlerrm='Multiplicó sueldo mensual por asistencia' then raise;end if;end;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d+7,'clase','pago','importe',300,'medio','efectivo'));
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d+14,'clase','pago','importe',400,'medio','efectivo'));
 v_json:=public.consultar_sueldos_palestina((d+interval '1 month')::date);
 select (x->>'saldo_anterior')::numeric into v_amount from jsonb_array_elements(v_json->'empleados')x where x->>'id'=e::text;
 if v_amount<>500 then raise exception 'No descontó los pagos parciales';end if;
 perform public.guardar_sueldos_palestina('tarifa',jsonb_build_object('empleado_id',e,'version',1,'modalidad','mensual','jornada',1500,'horas',1,'motivo','Cambio de sueldo mensual'));
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',v_id,'version',1,'empleado_id',e,'fecha',d,'clase','asistencia','tipo','mensual','notas','Sólo cambia nota','motivo','Corrección de nota'));
 if (select importe from public.palestina_sueldos_registros where id=v_id)<>1200 then raise exception 'Alteró sueldo histórico';end if;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',(d+interval '1 month')::date,'clase','asistencia','tipo','mensual'));
 if (select sum(case when clase='pago' then -importe else importe end) from public.palestina_sueldos_registros where empleado_id=e and anulado_at is null)<>2000 then raise exception 'Saldo mensual incorrecto';end if;
end; $$;
