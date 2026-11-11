-- Rainbows 3.26.72: control digital diario y efectivo acumulado.
-- Requiere Rainbows_V3.26.22_arqueo_caja.sql ya instalado.
-- Ejecutar completo antes de subir el ZIP. Conserva movimientos y arqueos previos.
begin;
alter table public.medrano_caja_arqueos
  add column if not exists digital_diario boolean not null default false;

create or replace function public.cerrar_caja_medrano_diaria_digital(
  p_efectivo_real numeric,
  p_digital_real numeric,
  p_fecha date,
  p_observaciones text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_fecha date;
  v_efectivo_esperado numeric;
  v_digital_esperado numeric;
  v_diferencia_efectivo numeric;
  v_diferencia_digital numeric;
  v_id uuid;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solamente Administración puede realizar el arqueo y cierre de Caja.';
  end if;
  if p_efectivo_real is null or p_efectivo_real<0
     or p_digital_real is null or p_digital_real<0
     or p_efectivo_real::text in ('NaN','Infinity','-Infinity')
     or p_digital_real::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá montos reales válidos para Efectivo y Digital.';
  end if;

  v_fecha:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;
  if p_fecha is distinct from v_fecha then
    raise exception 'Cambió el día. Volvé a abrir el arqueo antes de confirmar.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rainbows-caja-'||v_fecha::text,0));
  if exists(select 1 from public.medrano_caja_arqueos where fecha=v_fecha) then
    raise exception 'La Caja de hoy ya fue cerrada.';
  end if;

  select
    coalesce(sum(case when medio='efectivo' then case when tipo='ingreso' then monto else -monto end else 0 end),0),
    coalesce(sum(case when medio='digital' and origen<>'arqueo' and (created_at at time zone 'America/Argentina/Buenos_Aires')::date=v_fecha then case when tipo='ingreso' then monto else -monto end else 0 end),0)
  into v_efectivo_esperado,v_digital_esperado
  from public.medrano_caja_movimientos;

  v_diferencia_efectivo:=p_efectivo_real-v_efectivo_esperado;
  v_diferencia_digital:=p_digital_real-v_digital_esperado;

  if v_diferencia_efectivo<>0 then
    insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,origen,creado_por)
    values(
      case when v_diferencia_efectivo>0 then 'ingreso' else 'egreso' end,
      'efectivo',abs(v_diferencia_efectivo),'Ajuste por arqueo diario · Efectivo','arqueo',auth.uid()
    );
  end if;
  -- Digital se controla por día: la diferencia se guarda en el arqueo, sin
  -- crear un ingreso o egreso ficticio ni trasladarla al día siguiente.

  insert into public.medrano_caja_arqueos(
    fecha,efectivo_esperado,efectivo_real,diferencia_efectivo,
    digital_esperado,digital_real,diferencia_digital,observaciones,cerrado_por,digital_diario
  ) values(
    v_fecha,v_efectivo_esperado,p_efectivo_real,v_diferencia_efectivo,
    v_digital_esperado,p_digital_real,v_diferencia_digital,
    nullif(btrim(coalesce(p_observaciones,'')),''),auth.uid(),true
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Evitar que una app vieja envíe un saldo digital global al nuevo control diario.
create or replace function public.cerrar_caja_medrano(
 p_efectivo_real numeric,p_digital_real numeric,p_observaciones text default null
) returns uuid language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Actualizá la app a la versión 3.26.72 para realizar el arqueo con Digital del día.';
end; $$;
revoke all on function public.cerrar_caja_medrano_diaria_digital(numeric,numeric,date,text),public.cerrar_caja_medrano(numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.cerrar_caja_medrano_diaria_digital(numeric,numeric,date,text),public.cerrar_caja_medrano(numeric,numeric,text) to authenticated;
commit;
