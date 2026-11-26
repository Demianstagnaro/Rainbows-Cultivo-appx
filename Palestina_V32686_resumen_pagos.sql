-- Rainbows 3.26.86 — Datos personales para el resumen de pagos.
-- Requiere Asistencias V32677 y las migraciones posteriores ya instaladas.
begin;
create table if not exists public.palestina_sueldos_datos_pago(
 empleado_id uuid primary key references public.empleados(id),
 nombre_completo text not null default '' check(length(nombre_completo)<=180),
 dni text not null default '' check(dni='' or dni ~ '^[0-9]{6,12}$'),
 telefono text not null default '' check(length(telefono)<=30),
 alias text not null default '' check(length(alias)<=120),
 version integer not null default 1,
 actualizado_at timestamptz not null default now()
);
alter table public.palestina_sueldos_datos_pago enable row level security;
revoke all on public.palestina_sueldos_datos_pago from public,anon,authenticated;
create or replace function public.consultar_datos_pago_palestina()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para Asistencias y sueldos.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.palestina_sueldos_datos_pago p);
end; $$;
create or replace function public.guardar_datos_pago_palestina(p_empleado uuid,p_version integer,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.palestina_sueldos_datos_pago%rowtype;n public.palestina_sueldos_datos_pago%rowtype;
 v_nombre text:=btrim(coalesce(p_datos->>'nombre_completo',''));v_dni text:=regexp_replace(coalesce(p_datos->>'dni',''),'[.\s-]','','g');
 v_telefono text:=btrim(coalesce(p_datos->>'telefono',''));v_alias text:=btrim(coalesce(p_datos->>'alias',''));
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para modificar datos de pago.';end if;
 if p_empleado is null or not exists(select 1 from public.empleados where id=p_empleado) then raise exception 'Elegí un empleado existente.';end if;
 if p_version is null or p_version<0 then raise exception 'Versión inválida.';end if;
 if length(v_nombre)>180 or length(v_telefono)>30 or length(v_alias)>120 or (v_dni<>'' and v_dni !~ '^[0-9]{6,12}$') then raise exception 'Revisá el DNI y la longitud de los datos de pago.';end if;
 perform pg_advisory_xact_lock(32686,hashtext(p_empleado::text));
 select * into o from public.palestina_sueldos_datos_pago where empleado_id=p_empleado for update;
 if coalesce(o.version,0)<>p_version then raise exception 'Los datos cambiaron. Recargá y volvé a intentar.';end if;
 insert into public.palestina_sueldos_datos_pago(empleado_id,nombre_completo,dni,telefono,alias)
 values(p_empleado,v_nombre,v_dni,v_telefono,v_alias)
 on conflict(empleado_id) do update set nombre_completo=excluded.nombre_completo,dni=excluded.dni,telefono=excluded.telefono,alias=excluded.alias,version=public.palestina_sueldos_datos_pago.version+1,actualizado_at=now()
 returning * into n;
 return to_jsonb(n);
end; $$;
revoke all on function public.consultar_datos_pago_palestina(),public.guardar_datos_pago_palestina(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.consultar_datos_pago_palestina(),public.guardar_datos_pago_palestina(uuid,integer,jsonb) to authenticated;
commit;
