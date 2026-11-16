-- Rainbows 3.26.84 — Trabajos por producción, separados de las jornadas.
-- Requiere Asistencias V3.26.77 y modalidad mensual V3.26.80. Conserva registros existentes.
begin;
alter table public.palestina_sueldos_registros add column if not exists trabajo text;
alter table public.palestina_sueldos_registros add column if not exists unidades numeric(12,3);
alter table public.palestina_sueldos_registros add column if not exists valor_unidad numeric(14,2);
alter table public.palestina_sueldos_registros drop constraint if exists palestina_sueldos_registros_clase_check;
alter table public.palestina_sueldos_registros add constraint palestina_sueldos_registros_clase_check check(clase in ('asistencia','pago','ajuste','produccion'));
alter table public.palestina_sueldos_registros drop constraint if exists palestina_sueldos_produccion_check;
alter table public.palestina_sueldos_registros add constraint palestina_sueldos_produccion_check check(clase<>'produccion' or (tipo='produccion' and trabajo is not null and length(btrim(trabajo)) between 1 and 180 and unidades is not null and unidades>0 and unidades<>'NaN'::numeric and valor_unidad is not null and valor_unidad>0 and valor_unidad<>'NaN'::numeric and importe=round(unidades*valor_unidad,2) and horas is null and manual=false));
create or replace function public.consultar_sueldos_palestina(p_mes date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d date;f date;v_empleados jsonb;v_registros jsonb;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para Asistencias y sueldos.';end if;
 if p_mes is null or p_mes<date '1900-01-01' or p_mes>date '2200-12-31' then raise exception 'Elegí un mes válido.';end if;
 perform pg_advisory_xact_lock(32677,1);
 d:=date_trunc('month',p_mes)::date;f:=(d+interval '1 month')::date;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nombre',e.nombre,'activo',e.activo,'tarifa',case when t.empleado_id is null then null else to_jsonb(t) end,'saldo_anterior',coalesce(b.saldo,0)) order by e.nombre),'[]') into v_empleados
 from public.empleados e left join public.palestina_sueldos_tarifas t on t.empleado_id=e.id
 left join (select empleado_id,sum(case when clase='pago' then -importe else importe end) saldo from public.palestina_sueldos_registros where fecha<d and anulado_at is null group by empleado_id)b on b.empleado_id=e.id
 where e.activo or t.empleado_id is not null or b.empleado_id is not null or exists(select 1 from public.palestina_sueldos_registros r where r.empleado_id=e.id);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.fecha desc,r.creado_at desc,r.id),'[]') into v_registros from public.palestina_sueldos_registros r where fecha>=d and fecha<f;
 return jsonb_build_object('empleados',v_empleados,'registros',v_registros);
end; $$;
create or replace function public.guardar_sueldos_palestina(p_operacion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;v_id uuid;v_req uuid;v_version int;v_fecha date;v_clase text;v_tipo text;v_nombre text;v_motivo text;v_notas text;
 t public.palestina_sueldos_tarifas%rowtype;o public.palestina_sueldos_registros%rowtype;n public.palestina_sueldos_registros%rowtype;
 v_antes jsonb;v_despues jsonb;v_tarifa jsonb;v_horas numeric;v_importe numeric;v_calculado numeric;v_manual boolean:=false;v_modalidad text;v_unidades numeric;v_valor numeric;v_trabajo text;
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
  if v_clase is null or v_clase not in ('asistencia','pago','ajuste','produccion') or (o.id is not null and o.clase<>v_clase and not(o.clase='asistencia' and o.tipo<>'mensual' and v_clase='produccion')) then raise exception 'Elegí un tipo de registro válido.';end if;
  select * into t from public.palestina_sueldos_tarifas where empleado_id=e;
  if not exists(select 1 from public.empleados where id=e) then raise exception 'Elegí un empleado existente.';end if;
  if v_clase='asistencia' and t.empleado_id is null then raise exception 'Configurá primero los valores por jornada del empleado.';end if;
  if o.id is null and v_clase='asistencia' and (not t.habilitado or not exists(select 1 from public.empleados where id=e and activo)) then raise exception 'El empleado no está habilitado para nuevas asistencias.';end if;
  if v_clase='produccion' then
   if o.id is null and not exists(select 1 from public.empleados where id=e and activo) then raise exception 'Elegí un empleado activo.';end if;
   v_tipo:='produccion';v_trabajo:=btrim(coalesce(p_datos->>'trabajo',''));v_unidades:=(p_datos->>'unidades')::numeric;v_valor:=(p_datos->>'valor_unidad')::numeric;
   if length(v_trabajo) not between 1 and 180 then raise exception 'Indicá el trabajo realizado (hasta 180 caracteres).';end if;
   if v_unidades is null or v_unidades<=0 or v_unidades::text in ('NaN','Infinity','-Infinity') or v_unidades<>round(v_unidades,3) or v_unidades>999999999.999 then raise exception 'Ingresá unidades positivas con hasta tres decimales.';end if;
   if v_valor is null or v_valor<=0 or v_valor::text in ('NaN','Infinity','-Infinity') or v_valor<>round(v_valor,2) or v_valor>999999999999.99 then raise exception 'Ingresá un valor por unidad positivo, con hasta dos decimales.';end if;
   v_importe:=round(v_unidades*v_valor,2);v_calculado:=v_importe;
  elsif v_clase='asistencia' then
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
   insert into public.palestina_sueldos_registros(solicitud,empleado_id,fecha,clase,tipo,horas,tarifa,calculado,manual,importe,medio,notas,creado_por,creado_nombre,trabajo,unidades,valor_unidad)
   values(v_req,e,v_fecha,v_clase,v_tipo,v_horas,v_tarifa,v_calculado,v_manual,v_importe,case when v_clase='pago' then p_datos->>'medio' end,v_notas,auth.uid(),v_nombre,v_trabajo,v_unidades,v_valor) returning * into n;
  else
   update public.palestina_sueldos_registros set empleado_id=e,fecha=v_fecha,clase=v_clase,tipo=v_tipo,trabajo=v_trabajo,unidades=v_unidades,valor_unidad=v_valor,horas=v_horas,tarifa=v_tarifa,calculado=v_calculado,manual=v_manual,importe=v_importe,medio=case when v_clase='pago' then p_datos->>'medio' end,notas=v_notas,version=version+1,actualizado_at=now() where id=o.id returning * into n;
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
