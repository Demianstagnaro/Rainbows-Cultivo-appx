-- Rainbows 3.26.80 — Norma en la planilla, con sueldo mensual.
-- Requiere Asistencias y sueldos V3.26.77. No establece un importe de sueldo.
begin;
alter table public.palestina_sueldos_tarifas add column if not exists modalidad text not null default 'jornada' check(modalidad in ('jornada','mensual'));
update public.empleados set activo=true where lower(btrim(nombre))='norma';
insert into public.empleados(id,nombre,activo) select gen_random_uuid(),'Norma',true where not exists(select 1 from public.empleados where lower(btrim(nombre))='norma');
create or replace function public.guardar_sueldos_palestina(p_operacion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;v_id uuid;v_req uuid;v_version int;v_fecha date;v_clase text;v_tipo text;v_nombre text;v_motivo text;v_notas text;
 t public.palestina_sueldos_tarifas%rowtype;o public.palestina_sueldos_registros%rowtype;n public.palestina_sueldos_registros%rowtype;
 v_antes jsonb;v_despues jsonb;v_tarifa jsonb;v_horas numeric;v_importe numeric;v_calculado numeric;v_manual boolean:=false;v_modalidad text;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para modificar Asistencias y sueldos.';end if;
 perform pg_advisory_xact_lock(32677,1);
 select coalesce(nullif(nombre,''),email,'Usuario') into v_nombre from public.perfiles where id=auth.uid();
 v_motivo:=btrim(coalesce(p_datos->>'motivo',''));v_notas:=btrim(coalesce(p_datos->>'notas',''));
 if length(v_motivo)>1000 or length(v_notas)>1000 then raise exception 'Notas y motivo admiten hasta 1000 caracteres.';end if;
 v_version:=coalesce((p_datos->>'version')::integer,0);v_id:=nullif(p_datos->>'id','')::uuid;
 if p_operacion='anular' then
  select * into o from public.palestina_sueldos_registros where id=v_id for update;
  if not found then raise exception 'No se encontró el registro.';end if;
  if o.anulado_at is not null then return o.id;end if;
  if o.version<>v_version then raise exception 'El registro cambió. Actualizá la pantalla.';end if;
  if length(v_motivo)<3 then raise exception 'Indicá el motivo de la anulación.';end if;
  update public.palestina_sueldos_registros set anulado_at=now(),motivo_anulacion=v_motivo,version=version+1,actualizado_at=now() where id=o.id returning * into n;
  v_antes:=to_jsonb(o);v_despues:=to_jsonb(n);
 elsif p_operacion='tarifa' then
  e:=(p_datos->>'empleado_id')::uuid;
  if not exists(select 1 from public.empleados where id=e) then raise exception 'Elegí un empleado existente.';end if;
  select * into t from public.palestina_sueldos_tarifas where empleado_id=e for update;v_antes:=case when found then to_jsonb(t) else null end;
  if coalesce(t.version,0)<>v_version then raise exception 'Los valores cambiaron. Actualizá la pantalla.';end if;
  if t.empleado_id is not null and length(v_motivo)<3 then raise exception 'Indicá el motivo del cambio de valores.';end if;
  v_modalidad:=coalesce(p_datos->>'modalidad',t.modalidad,'jornada');
  if v_modalidad not in ('jornada','mensual') then raise exception 'Modalidad no válida.';end if;
  v_importe:=(p_datos->>'jornada')::numeric;v_horas:=(p_datos->>'horas')::numeric;
  if v_importe is null or v_importe<=0 or v_importe::text in ('NaN','Infinity','-Infinity') or v_importe<>round(v_importe,2) or v_importe>9999999999.99 or v_horas is null or v_horas<=0 or v_horas>24 or v_horas<>round(v_horas,2) then raise exception 'Revisá el valor por jornada y las horas de una jornada completa.';end if;
  insert into public.palestina_sueldos_tarifas(empleado_id,habilitado,jornada,horas,sabado,domingo,modalidad)
  values(e,coalesce((p_datos->>'habilitado')::boolean,true),v_importe,v_horas,nullif(p_datos->>'sabado','')::numeric,nullif(p_datos->>'domingo','')::numeric,v_modalidad)
  on conflict(empleado_id) do update set modalidad=excluded.modalidad,habilitado=excluded.habilitado,jornada=excluded.jornada,horas=excluded.horas,sabado=excluded.sabado,domingo=excluded.domingo,version=public.palestina_sueldos_tarifas.version+1,actualizado_at=now() returning * into t;
  v_id:=e;v_despues:=to_jsonb(t);
 elsif p_operacion='registro' then
  v_req:=(p_datos->>'solicitud')::uuid;
  if v_id is null then
   if v_req is null then raise exception 'Volvé a abrir el formulario.';end if;
   select id into v_id from public.palestina_sueldos_registros where solicitud=v_req;
   if found then return v_id;end if;
  else
   select * into o from public.palestina_sueldos_registros where id=v_id for update;
   if not found or o.anulado_at is not null then raise exception 'El registro ya no está vigente.';end if;
   if o.version<>v_version then raise exception 'Otra persona modificó el registro. Actualizá la pantalla.';end if;
   if length(v_motivo)<3 then raise exception 'Indicá el motivo de la corrección.';end if;
   v_antes:=to_jsonb(o);
  end if;
  e:=(p_datos->>'empleado_id')::uuid;v_fecha:=(p_datos->>'fecha')::date;v_clase:=p_datos->>'clase';v_tipo:=p_datos->>'tipo';
  if v_fecha is null or v_fecha<date '1900-01-01' or v_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha debe ser válida y no posterior a hoy.';end if;
  if v_clase is null or v_clase not in ('asistencia','pago','ajuste') or (o.id is not null and o.clase<>v_clase) then raise exception 'Elegí un tipo de registro válido.';end if;
  select * into t from public.palestina_sueldos_tarifas where empleado_id=e;
  if t.empleado_id is null then raise exception 'Configurá primero los valores por jornada del empleado.';end if;
  if o.id is null and v_clase='asistencia' and (not t.habilitado or not exists(select 1 from public.empleados where id=e and activo)) then raise exception 'El empleado no está habilitado para nuevas asistencias.';end if;
  if v_clase='asistencia' then
   v_tarifa:=case when o.id is not null and o.empleado_id=e and not(v_tipo='mensual' and o.tipo<>'mensual') then o.tarifa else to_jsonb(t) end;
   if v_tipo is null or v_tipo not in ('completa','media','horas','sabado','domingo','ausente','mensual') then raise exception 'Elegí la jornada realizada.';end if;
   if v_tipo='mensual' then
    if coalesce(v_tarifa->>'modalidad','jornada')<>'mensual' then raise exception 'Configurá primero el sueldo mensual del empleado.';end if;
    if extract(day from v_fecha)<>1 then raise exception 'El sueldo mensual se registra el primer día del mes.';end if;
   elsif coalesce(v_tarifa->>'modalidad','jornada')='mensual' then raise exception 'Para este empleado elegí Sueldo mensual, una sola vez por mes.';end if;
   v_horas:=case v_tipo when 'completa' then (v_tarifa->>'horas')::numeric when 'media' then (v_tarifa->>'horas')::numeric/2 when 'horas' then (p_datos->>'horas')::numeric when 'ausente' then 0 when 'mensual' then 0 else 2 end;
   if v_horas is null or v_horas<0 or v_horas>24 or (v_tipo not in ('ausente','mensual') and v_horas=0) or v_horas<>round(v_horas,2) then raise exception 'Revisá las horas trabajadas (hasta dos decimales).';end if;
   v_calculado:=round(case v_tipo when 'mensual' then (v_tarifa->>'jornada')::numeric when 'sabado' then coalesce((v_tarifa->>'sabado')::numeric,(v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*2*1.5) when 'domingo' then coalesce((v_tarifa->>'domingo')::numeric,(v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*2*2) else (v_tarifa->>'jornada')::numeric/(v_tarifa->>'horas')::numeric*v_horas end,2);
   v_manual:=nullif(p_datos->>'importe_manual','') is not null;
   v_importe:=case when v_manual then (p_datos->>'importe_manual')::numeric else v_calculado end;
   if v_tipo='ausente' and v_importe<>0 then raise exception 'Una ausencia tiene importe cero. Usá Ajuste para otro concepto.';end if;
   if v_manual and length(v_notas)<3 then raise exception 'Explicá el motivo del importe especial en Notas.';end if;
   if exists(select 1 from public.palestina_sueldos_registros where empleado_id=e and fecha=v_fecha and clase='asistencia' and anulado_at is null and id is distinct from v_id) then raise exception 'Ya hay una asistencia de ese empleado en esa fecha. Editá la existente.';end if;
  else
   v_importe:=(p_datos->>'importe')::numeric;v_tipo:=v_clase;
   if v_importe=0 or (v_clase='pago' and v_importe<0) then raise exception 'El pago debe ser positivo; el ajuste no puede ser cero.';end if;
   if v_clase='pago' and coalesce(p_datos->>'medio','') not in ('efectivo','transferencia') then raise exception 'Elegí el medio de pago.';end if;
   if v_clase='ajuste' and length(v_notas)<3 then raise exception 'Indicá el concepto del ajuste.';end if;
  end if;
  if v_importe is null or v_importe::text in ('NaN','Infinity','-Infinity') or abs(v_importe)>999999999999.99 or v_importe<>round(v_importe,2) or (v_clase='asistencia' and v_importe<0) then raise exception 'Ingresá un importe válido, con hasta dos decimales.';end if;
  if o.id is null then
   insert into public.palestina_sueldos_registros(solicitud,empleado_id,fecha,clase,tipo,horas,tarifa,calculado,manual,importe,medio,notas,creado_por,creado_nombre)
   values(v_req,e,v_fecha,v_clase,v_tipo,v_horas,v_tarifa,v_calculado,v_manual,v_importe,case when v_clase='pago' then p_datos->>'medio' end,v_notas,auth.uid(),v_nombre) returning * into n;
  else
   update public.palestina_sueldos_registros set empleado_id=e,fecha=v_fecha,tipo=v_tipo,horas=v_horas,tarifa=v_tarifa,calculado=v_calculado,manual=v_manual,importe=v_importe,medio=case when v_clase='pago' then p_datos->>'medio' end,notas=v_notas,version=version+1,actualizado_at=now() where id=o.id returning * into n;
  end if;
  v_id:=n.id;v_despues:=to_jsonb(n);
 else raise exception 'Operación no válida.';
 end if;
 insert into public.palestina_sueldos_auditoria(entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values(v_id,case when p_operacion='anular' then 'anulacion' when p_operacion='tarifa' then 'valores' when o.id is null then 'alta' else 'correccion' end,v_antes,v_despues,v_motivo,auth.uid(),v_nombre);
 return v_id;
end; $$;
revoke all on function public.guardar_sueldos_palestina(text,jsonb) from public,anon,authenticated;
grant execute on function public.guardar_sueldos_palestina(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
