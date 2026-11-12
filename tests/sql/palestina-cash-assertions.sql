do $$
declare d date:=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')-interval '2 months')::date;
 v_cat uuid;v_ing uuid;v_tr uuid;v_id uuid;v_next uuid;v_open uuid;v_json jsonb;v_count integer;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 v_json:=public.consultar_caja_palestina(d);
 if v_json->'apertura'<>'null'::jsonb or jsonb_array_length(v_json->'movimientos')<>0 then raise exception 'La caja no comenzó vacía'; end if;
 v_open:=public.guardar_apertura_caja_palestina(d,100,0);
 select id into v_cat from public.palestina_caja_categorias where nombre='Sueldo Cosecha';
 select id into v_ing from public.palestina_caja_categorias where nombre='Ingreso de efectivo';
 select id into v_tr from public.palestina_caja_categorias where nombre='Ingreso por transferencia';
 v_id:=public.guardar_movimiento_caja_palestina(null,0,'00000000-0000-0000-0000-000000000011',d,'egreso','efectivo','Insumo de prueba',4,20,v_cat,'Costo total manual');
 v_next:=public.guardar_movimiento_caja_palestina(null,0,'00000000-0000-0000-0000-000000000011',d,'egreso','efectivo','Insumo de prueba',4,20,v_cat);
 if v_next<>v_id or (select count(*) from public.palestina_caja_movimientos)<>1 then raise exception 'Duplicó una carga repetida'; end if;
 if (select monto from public.palestina_caja_movimientos where id=v_id)<>20 then raise exception 'Multiplicó el costo por cantidad'; end if;
 perform public.guardar_movimiento_caja_palestina(null,0,'00000000-0000-0000-0000-000000000012',d,'ingreso','efectivo','Reposición de caja',1,50,v_ing);
 perform public.guardar_movimiento_caja_palestina(null,0,'00000000-0000-0000-0000-000000000013',d,'ingreso','transferencia','Transferencia recibida',1,500,v_tr);
 perform public.guardar_movimiento_caja_palestina(null,0,'00000000-0000-0000-0000-000000000014',d,'egreso','transferencia','Gasto bancario de prueba',2,90,v_cat);
 v_json:=public.consultar_caja_palestina((d+interval '1 month')::date);
 if (v_json->>'saldo_inicial')::numeric<>130 then raise exception 'El efectivo no pasó al mes siguiente o mezcló transferencias'; end if;
 if jsonb_array_length(v_json->'movimientos')<>0 then raise exception 'Incluyó movimientos de otro mes'; end if;
 begin
  perform public.guardar_movimiento_caja_palestina(v_id,9,null,d,'egreso','efectivo','Insumo',4,30,v_cat,'','Corrección');
  raise exception 'Aceptó versión desactualizada';
 exception when others then if sqlerrm='Aceptó versión desactualizada' then raise; end if; end;
 perform public.guardar_movimiento_caja_palestina(v_id,1,null,d,'egreso','efectivo','Insumo de prueba',4,30,v_cat,'Corregido','Importe corregido');
 if (select count(*) from public.palestina_caja_auditoria where entidad_id=v_id)<>2 then raise exception 'Falta historial de corrección'; end if;
 begin
  perform public.guardar_movimiento_caja_palestina(null,0,gen_random_uuid(),d,'ingreso','efectivo','Ingreso',1,10,v_cat);
  raise exception 'Aceptó categoría de egreso para ingreso';
 exception when others then if sqlerrm='Aceptó categoría de egreso para ingreso' then raise; end if; end;
 begin
  perform public.guardar_movimiento_caja_palestina(null,0,gen_random_uuid(),d,'egreso','efectivo','Gasto',1,'NaN',v_cat);
  raise exception 'Aceptó monto inválido';
 exception when others then if sqlerrm='Aceptó monto inválido' then raise; end if; end;
 begin
  perform public.guardar_movimiento_caja_palestina(null,0,gen_random_uuid(),d-1,'egreso','efectivo','Gasto',1,10,v_cat);
  raise exception 'Aceptó fecha anterior al saldo inicial';
 exception when others then if sqlerrm='Aceptó fecha anterior al saldo inicial' then raise; end if; end;
 perform public.anular_movimiento_caja_palestina(v_id,2,'Carga de prueba anulada');
 perform public.anular_movimiento_caja_palestina(v_id,2,'Reintento');
 if (select count(*) from public.palestina_caja_auditoria where entidad_id=v_id)<>3 then raise exception 'Duplicó anulación o perdió historia'; end if;
 v_json:=public.consultar_caja_palestina((d+interval '1 month')::date);
 if (v_json->>'saldo_inicial')::numeric<>150 then raise exception 'La anulación no recalculó saldos posteriores'; end if;
 begin
  perform public.guardar_apertura_caja_palestina(d+1,200,1,'Corrección inválida');
  raise exception 'Apertura posterior al primer movimiento';
 exception when others then if sqlerrm='Apertura posterior al primer movimiento' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 v_json:=public.consultar_caja_palestina(d);
 if jsonb_array_length(v_json->'movimientos')<>4 then raise exception 'Encargado no pudo consultar la caja'; end if;
 perform public.guardar_apertura_caja_palestina(d,120,1,'Saldo de partida corregido');
 v_json:=public.consultar_caja_palestina((d+interval '1 month')::date);
 if (v_json->>'saldo_inicial')::numeric<>170 then raise exception 'Corrección de apertura no aplicada'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 begin
  perform public.consultar_caja_palestina(d);
  raise exception 'Cultivo pudo consultar Administración';
 exception when others then if sqlerrm='Cultivo pudo consultar Administración' then raise; end if; end;
 begin
  perform public.guardar_apertura_caja_palestina(d,10,2,'Sin permiso');
  raise exception 'Cultivo pudo editar Administración';
 exception when others then if sqlerrm='Cultivo pudo editar Administración' then raise; end if; end;
 if has_table_privilege('authenticated','public.palestina_caja_movimientos','UPDATE') or has_function_privilege('authenticated','public.bloquear_caja_palestina()','EXECUTE') then raise exception 'Escritura directa expuesta'; end if;
end; $$;
-- Las políticas también impiden leer tablas directamente con rol Cultivo/Medrano.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
do $$ begin
 if exists(select 1 from public.palestina_caja_movimientos) then raise exception 'Medrano pudo leer Caja Palestina'; end if;
end; $$;
reset role;
