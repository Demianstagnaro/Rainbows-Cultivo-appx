do $$
declare e uuid:='10000000-0000-0000-0000-000000000001';p uuid:='10000000-0000-0000-0000-000000000002';d date:=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')-interval '2 months')::date;
 id1 uuid;id2 uuid;day_id uuid;req uuid:=gen_random_uuid();j jsonb;n int;old_total numeric;v_json jsonb;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 -- Tarifas de empleado2 se eliminan sólo en esta base de prueba: producción no exige jornal.
 delete from public.palestina_sueldos_tarifas where empleado_id=p;
 id1:=public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',req,'empleado_id',p,'fecha',d,'clase','produccion','trabajo','Poda de prueba','unidades',5,'valor_unidad',100));
 if (select importe from public.palestina_sueldos_registros where id=id1)<>500 or (select horas from public.palestina_sueldos_registros where id=id1) is not null then raise exception 'Calculó producción por horas';end if;
 id2:=public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',p,'fecha',d,'clase','produccion','trabajo','Segundo trabajo','unidades',0.5,'valor_unidad',300));
 if (select count(*) from public.palestina_sueldos_registros where empleado_id=p and fecha=d and clase='produccion')<>2 then raise exception 'No admite varios trabajos por día';end if;
 if public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',req))<>id1 then raise exception 'No reconoce reintento';end if;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',p,'fecha',d+7,'clase','pago','importe',200,'medio','efectivo'));
 v_json:=public.consultar_sueldos_palestina((d+interval '1 month')::date);
 if (select (x->>'saldo_anterior')::numeric from jsonb_array_elements(v_json->'empleados')x where x->>'id'=p::text)<>450 then raise exception 'No sumó producción y descontó pago';end if;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',id1,'version',1,'empleado_id',p,'fecha',d,'clase','produccion','trabajo','Poda corregida','unidades',6,'valor_unidad',100,'motivo','Corregir unidades'));
 if (select importe from public.palestina_sueldos_registros where id=id1)<>600 then raise exception 'No recalculó unidades';end if;
 begin perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',id1,'version',1,'motivo','Desactualizado'));raise exception 'Aceptó versión anterior';exception when others then if sqlerrm='Aceptó versión anterior' then raise;end if;end;
 for j in select value from jsonb_array_elements('[{"unidades":0,"valor_unidad":1},{"unidades":-1,"valor_unidad":1},{"unidades":1,"valor_unidad":-1},{"unidades":"NaN","valor_unidad":1},{"unidades":1.0001,"valor_unidad":1}]'::jsonb) loop
  begin perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',p,'fecha',d,'clase','produccion','trabajo','Inválido')||j);raise exception 'Aceptó unidades o precio inválidos';exception when others then if sqlerrm='Aceptó unidades o precio inválidos' then raise;end if;end;
 end loop;
 -- Puede coexistir con una asistencia del mismo día, sin modificarla.
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','produccion','trabajo','Extra por producción','unidades',2,'valor_unidad',50));
 if (select importe from public.palestina_sueldos_registros where empleado_id=e and clase='asistencia' and fecha=d and anulado_at is null)<>900 then raise exception 'Alteró la jornada existente';end if;
 select id into day_id from public.palestina_sueldos_registros where empleado_id=e and clase='asistencia' and fecha=d and anulado_at is null;
 perform public.guardar_sueldos_palestina('registro',jsonb_build_object('id',day_id,'version',2,'empleado_id',e,'fecha',d,'clase','produccion','trabajo','Cambio de jornada a producción','unidades',3,'valor_unidad',100,'motivo','Cambio de modalidad'));
 if (select importe from public.palestina_sueldos_registros where id=day_id and clase='produccion')<>300 or exists(select 1 from public.palestina_sueldos_registros where empleado_id=e and clase='asistencia' and fecha=d and anulado_at is null) then raise exception 'Duplicó el importe al convertir jornada';end if;
 perform public.guardar_sueldos_palestina('anular',jsonb_build_object('id',id2,'version',1,'motivo','Anular segundo trabajo'));
 v_json:=public.consultar_sueldos_palestina((d+interval '1 month')::date);
 if (select (x->>'saldo_anterior')::numeric from jsonb_array_elements(v_json->'empleados')x where x->>'id'=p::text)<>400 then raise exception 'No recalculó al anular producción';end if;
 update public.empleados set activo=false where id=p;
 v_json:=public.consultar_sueldos_palestina(d);
 if not exists(select 1 from jsonb_array_elements(v_json->'empleados')x where x->>'id'=p::text) then raise exception 'Ocultó empleado inactivo con producción pendiente';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 begin perform public.guardar_sueldos_palestina('registro',jsonb_build_object('solicitud',gen_random_uuid(),'empleado_id',e,'fecha',d,'clase','produccion','trabajo','Sin permiso','unidades',1,'valor_unidad',1));raise exception 'Cultivo pudo registrar producción';exception when others then if sqlerrm='Cultivo pudo registrar producción' then raise;end if;end;
end; $$;
