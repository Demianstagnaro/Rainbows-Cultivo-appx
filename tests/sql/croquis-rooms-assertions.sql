do $$
declare
 hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
 entrada uuid; planta uuid; st jsonb; firma text; periodo uuid; n integer; r record;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 -- La migración conserva las existencias y no inventa la fecha de ingreso.
 if (select count(*) from public.plantas where ocupada)<>2 then raise exception 'Se modificó el contenido previo'; end if;
 if exists(select 1 from public.palestina_sala_periodos where fecha_ingreso is not null) then raise exception 'Fecha histórica inventada'; end if;
 st:=public.estado_croquis_sala('Flora 1');periodo:=(st->'periodo'->>'id')::uuid;
 perform public.fecha_ingreso_croquis('Flora 1',periodo,hoy-10);
 select id into planta from public.plantas where cama_id='00000000-0000-0000-0000-000000000031' and posicion=2;
 n:=public.completar_pileta_croquis(planta,'00000000-0000-0000-0000-000000000021','Nueva');
 if n<>4 then raise exception 'No completó las cuatro posiciones vacías habilitadas'; end if;
 if (select count(*) from public.plantas where cama_id='00000000-0000-0000-0000-000000000031' and ocupada)<>5 then raise exception 'Capacidad incorrecta'; end if;
 if exists(select 1 from public.plantas where ocupada and not habilitada) then raise exception 'Ocupó posiciones deshabilitadas'; end if;
 if not exists(select 1 from public.plantas where posicion=1 and cama_id='00000000-0000-0000-0000-000000000031' and genetica_id='00000000-0000-0000-0000-000000000022') then raise exception 'Sobrescribió otra genética existente'; end if;
 if (select observaciones from public.plantas where id=planta)<>'Nueva' then raise exception 'No guardó notas'; end if;
 -- Firmas desactualizadas y fechas erróneas no borran nada.
 begin
  perform public.vaciar_sala_croquis('Flora 1',periodo,st->>'firma',hoy,'Cosecha');
  raise exception 'Aceptó una firma desactualizada';
 exception when others then if sqlerrm='Aceptó una firma desactualizada' then raise; end if; end;
 st:=public.estado_croquis_sala('Flora 1');firma:=st->>'firma';
 begin
  perform public.vaciar_sala_croquis('Flora 1',periodo,firma,hoy-11,'Cosecha');
  raise exception 'Aceptó fecha anterior al ingreso';
 exception when others then if sqlerrm='Aceptó fecha anterior al ingreso' then raise; end if; end;
 entrada:=public.vaciar_sala_croquis('Flora 1',periodo,firma,hoy,'Cosecha','Sala cosechada');
 if exists(select 1 from public.plantas where cama_id='00000000-0000-0000-0000-000000000031' and (ocupada or genetica_id is not null or observaciones<>'')) then raise exception 'Vaciado incompleto'; end if;
 if (select count(*) from public.plantas where cama_id='00000000-0000-0000-0000-000000000031')<>9 or (select capacidad from public.camas where id='00000000-0000-0000-0000-000000000031')<>5 then raise exception 'Perdió la estructura del croquis'; end if;
 if (select count(*) from public.plantas where cama_id='00000000-0000-0000-0000-000000000032' and ocupada)<>1 then raise exception 'Vació otra sala'; end if;
 if not exists(select 1 from public.palestina_sala_periodos where id=entrada and fecha_ingreso=hoy-10 and fecha_vaciado=hoy and jsonb_array_length(detalle)=5 and cerrado_nombre='Operador') then raise exception 'Historial incompleto'; end if;
 perform public.vaciar_sala_croquis('Flora 1',periodo,firma,hoy,'Cosecha');
 perform public.completar_pileta_croquis(planta,'00000000-0000-0000-0000-000000000021');
 st:=public.estado_croquis_sala('Flora 1');
 if (st->'periodo'->>'id')::uuid=periodo or (st->'periodo'->>'fecha_ingreso')::date<>hoy then raise exception 'No abrió un período nuevo'; end if;
 begin
  perform public.vaciar_sala_croquis('Flora 1',periodo,firma,hoy,'Cosecha');
  raise exception 'Vació una sala recargada con confirmación vieja';
 exception when others then if sqlerrm='Vació una sala recargada con confirmación vieja' then raise; end if; end;
 -- Madres es una lista única de genéticas, sin duplicados ni ocupación ficticia.
 perform public.guardar_madre_croquis('00000000-0000-0000-0000-000000000021',true);
 perform public.guardar_madre_croquis('00000000-0000-0000-0000-000000000021',true);
 if (select count(*) from public.palestina_madres)<>1 then raise exception 'Genética duplicada en Madres'; end if;
 st:=public.estado_croquis_sala('Madres');
 perform public.vaciar_sala_croquis('Madres',(st->'periodo'->>'id')::uuid,st->>'firma',hoy,'Traslado');
 if exists(select 1 from public.palestina_madres) then raise exception 'No vació Madres'; end if;
 -- El semillero conserva sala, fechas y cantidades antes de vaciar.
 insert into public.palestina_semillero values('Esquejes',1,1,'00000000-0000-0000-0000-000000000021',36,hoy-5),('Vege 1',1,1,'00000000-0000-0000-0000-000000000022',1,null);
 st:=public.estado_croquis_sala('Esquejes');
 entrada:=public.vaciar_sala_croquis('Esquejes',(st->'periodo'->>'id')::uuid,st->>'firma',hoy,'Traslado');
 if exists(select 1 from public.palestina_semillero where sala='Esquejes') or not exists(select 1 from public.palestina_semillero where sala='Vege 1') then raise exception 'Error al vaciar semillero'; end if;
 if not exists(select 1 from public.palestina_sala_periodos where id=entrada and detalle->0->>'cantidad'='36' and detalle->0->'datos'->>'fecha_inicio'=(hoy-5)::text) then raise exception 'Perdió el detalle de almácigos'; end if;
 -- Las piletas de nueve posiciones también respetan su capacidad.
 select id into planta from public.plantas where cama_id='00000000-0000-0000-0000-000000000032' and posicion=2;
 n:=public.completar_pileta_croquis(planta,'00000000-0000-0000-0000-000000000021');
 if n<>8 or (select count(*) from public.plantas where cama_id='00000000-0000-0000-0000-000000000032' and ocupada)<>9 then raise exception 'No completó capacidad de nueve'; end if;
 begin
  perform public.guardar_madre_croquis('00000000-0000-0000-0000-000000000023',true);
  raise exception 'Admitió una genética archivada';
 exception when others then if sqlerrm='Admitió una genética archivada' then raise; end if; end;
 -- Sin permisos operativos no se puede vaciar ni completar piletas.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 st:=public.estado_croquis_sala('Flora 1');
 begin
  perform public.vaciar_sala_croquis('Flora 1',(st->'periodo'->>'id')::uuid,st->>'firma',hoy,'Cosecha');
  raise exception 'Consulta pudo vaciar';
 exception when others then if sqlerrm='Consulta pudo vaciar' then raise; end if; end;
 begin
  perform public.completar_pileta_croquis(planta,'00000000-0000-0000-0000-000000000021');
  raise exception 'Consulta pudo llenar';
 exception when others then if sqlerrm='Consulta pudo llenar' then raise; end if; end;
 if has_table_privilege('authenticated','public.palestina_sala_periodos','UPDATE') or has_function_privilege('authenticated','public.sincronizar_periodos_croquis(boolean)','EXECUTE') then raise exception 'Historial expuesto a cambios directos'; end if;
end; $$;
