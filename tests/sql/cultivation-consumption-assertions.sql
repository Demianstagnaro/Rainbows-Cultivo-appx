do $$
declare
 t jsonb := '{"clave_externa":"2026-11-05|Flora 1|Enmienda","sala_id":"00000000-0000-0000-0000-000000000011","fecha":"2026-11-05","nombre":"Enmienda"}';
 items jsonb := '[{"insumo_id":"00000000-0000-0000-0000-000000000031","cantidad":4.5,"unidad":"kg"}]';
 workers uuid[] := array['00000000-0000-0000-0000-000000000021'::uuid];
 a uuid; b uuid; tid uuid; msg text;
begin
 -- Cada invocación de psql abre una conexión: la identidad pertenece a esta prueba.
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 a:=public.confirmar_aplicacion_cultivo(t,items,workers,'Flora 1 trasplante');
 select tarea_id into tid from public.palestina_aplicaciones where id=a;
 if (select stock from public.palestina_insumos where nombre='Pescado')<>15.5 then raise exception 'Consumo incorrecto'; end if;
 if not exists(select 1 from public.tareas where id=tid and estado='realizada') then raise exception 'Tarea pendiente'; end if;
 if (select count(*) from public.realizacion_empleados)<>1 then raise exception 'Responsable no guardado'; end if;
 b:=public.confirmar_aplicacion_cultivo(t,items,workers,'reintento');
 if a<>b or (select stock from public.palestina_insumos where nombre='Pescado')<>15.5 then raise exception 'Descuento duplicado'; end if;
 begin
   delete from public.realizaciones_tarea where tarea_id=tid;
   raise exception 'DELETE sin protección';
 exception when others then if sqlerrm='DELETE sin protección' then raise; end if; end;
 begin
   update public.tareas set estado='pendiente' where id=tid;
   raise exception 'UPDATE sin protección';
 exception when others then if sqlerrm='UPDATE sin protección' then raise; end if; end;
 begin
   update public.palestina_insumos set unidad='g' where nombre='Pescado';
   raise exception 'Unidad sin protección';
 exception when others then if sqlerrm='Unidad sin protección' then raise; end if; end;
 perform public.anular_aplicacion_cultivo(tid);
 perform public.anular_aplicacion_cultivo(tid);
 if (select stock from public.palestina_insumos where nombre='Pescado')<>20 then raise exception 'Reversión duplicada o incorrecta'; end if;
 if exists(select 1 from public.realizaciones_tarea where tarea_id=tid) then raise exception 'Realización sin anular'; end if;
 if not exists(select 1 from public.palestina_aplicaciones where id=a and anulada_at is not null) then raise exception 'Historial perdido'; end if;
 b:=public.confirmar_aplicacion_cultivo(t,items,workers,'reaplicación');
 if b=a then raise exception 'Reaplicación debe tener otro id'; end if;
 -- Faltante en el segundo insumo revierte también el primero y la tarea nueva.
 begin
   perform public.confirmar_aplicacion_cultivo(t||'{"clave_externa":"fallo-stock"}',items||'[{"insumo_id":"00000000-0000-0000-0000-000000000032","cantidad":101,"unidad":"L"}]',workers,'faltante');
   raise exception 'Permitió faltante';
 exception when others then if sqlerrm='Permitió faltante' then raise; end if; end;
 if exists(select 1 from public.tareas where clave_externa='fallo-stock') or (select stock from public.palestina_insumos where nombre='Pescado')<>15.5 then raise exception 'Guardado parcial'; end if;
 begin
   perform public.confirmar_aplicacion_cultivo(t||'{"clave_externa":"unidad-vieja"}', '[{"insumo_id":"00000000-0000-0000-0000-000000000031","cantidad":4.5,"unidad":"g"}]',workers,'unidad');
   raise exception 'Permitió unidad desactualizada';
 exception when others then if sqlerrm='Permitió unidad desactualizada' then raise; end if; end;
 begin
   perform public.confirmar_aplicacion_cultivo(t||'{"clave_externa":"nan"}', '[{"insumo_id":"00000000-0000-0000-0000-000000000031","cantidad":"NaN","unidad":"kg"}]',workers,'NaN');
   raise exception 'Permitió NaN';
 exception when others then if sqlerrm='Permitió NaN' then raise; end if; end;
 begin
   perform public.confirmar_aplicacion_cultivo(t||'{"clave_externa":"empleado-invalido"}',items,array['00000000-0000-0000-0000-000000000099'::uuid],'empleado');
   raise exception 'Permitió empleado inválido';
 exception when others then if sqlerrm='Permitió empleado inválido' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin
   perform public.confirmar_aplicacion_cultivo(t||'{"clave_externa":"sin-permiso"}',items,workers,'sin permiso');
   raise exception 'Permitió usuario de consulta';
 exception when others then if sqlerrm='Permitió usuario de consulta' then raise; end if; end;
 begin
   perform public.anular_aplicacion_cultivo(tid);
   raise exception 'Permitió anular sin permiso';
 exception when others then if sqlerrm='Permitió anular sin permiso' then raise; end if; end;
end; $$;
-- Las tablas de historial admiten sólo consulta desde el cliente.
do $$ begin
 if has_table_privilege('authenticated','public.palestina_aplicaciones','INSERT') or has_table_privilege('authenticated','public.palestina_aplicacion_insumos','UPDATE') then raise exception 'Historial modificable directamente'; end if;
end; $$;
