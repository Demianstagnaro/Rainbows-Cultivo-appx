begin;
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check(lower(trim(rol)) in ('administrador','encargado_p','cultivo','medrano','contador'));
create or replace function public.admin_actualizar_perfil_v2(
  objetivo_id uuid,
  nuevo_rol text,
  nuevo_activo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rol_normalizado text := lower(trim(coalesce(nuevo_rol, '')));
  objetivo public.perfiles%rowtype;
begin
  perform pg_advisory_xact_lock(871640217);

  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede modificar usuarios.';
  end if;

  if rol_normalizado not in ('administrador','encargado_p','cultivo','medrano','contador') then
    raise exception 'Rol inválido. Usá Administrador, Encargado P, Cultivo, Medrano o Contador.';
  end if;
  if nuevo_activo is null then
    raise exception 'El estado activo del usuario es obligatorio.';
  end if;

  select * into objetivo
  from public.perfiles
  where id = objetivo_id
  for update;
  if not found then raise exception 'No se encontró el usuario indicado.'; end if;

  if objetivo_id = auth.uid()
     and (rol_normalizado <> 'administrador' or nuevo_activo is not true) then
    raise exception 'No podés quitarte tu propio acceso de administrador.';
  end if;

  if lower(trim(objetivo.rol)) = 'administrador' and objetivo.activo is true
     and (rol_normalizado <> 'administrador' or nuevo_activo is not true)
     and not exists (
       select 1 from public.perfiles
       where id <> objetivo_id
         and lower(trim(rol)) = 'administrador'
         and activo is true
     ) then
    raise exception 'Rainbows debe conservar al menos un administrador activo.';
  end if;

  update public.perfiles
  set rol = rol_normalizado,
      activo = nuevo_activo,
      updated_at = now()
  where id = objetivo_id;
end;
$$;


create or replace function public.es_contador_rainbows() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and activo and lower(trim(rol))='contador')
$$;
revoke all on function public.es_contador_rainbows() from public;
grant execute on function public.es_contador_rainbows() to authenticated;
create or replace function public.proteger_escritura_contador() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.perfiles where id=auth.uid() and lower(trim(rol))='contador') then raise exception 'Contador tiene acceso de solo lectura.' using errcode='42501'; end if;
 return null;
end $$;
do $$ declare rel record; begin
 for rel in select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') loop
 execute format('drop trigger if exists proteger_contador on public.%I',rel.relname);
 execute format('create trigger proteger_contador before insert or update or delete or truncate on public.%I for each statement execute function public.proteger_escritura_contador()',rel.relname);
 if rel.relrowsecurity and rel.relname=any(array['tareas','medrano_mostrador_productos','perfiles','salas','camas','plantas','geneticas','cosechas','cosecha_geneticas','stock_ciclos','stock_existencias','stock_movimientos','medrano_dispensario_lotes','medrano_pacientes','medrano_comandas','stock_transferencias','stock_transferencia_items','empleados','realizaciones_tarea','realizacion_empleados','tareas_generales','tarea_general_empleados','medrano_laboratorio_stock','medrano_traslados_laboratorio','medrano_stock_historial','medrano_laboratorio_dispensario_movimientos','medrano_laboratorio_trabajos','medrano_comandas_multiproducto','medrano_comandas_multiproducto_items','medrano_laboratorio_trabajos_materiales','medrano_caja_movimientos','medrano_tokens_movimientos','medrano_precios_flores','medrano_precios_categorias','medrano_catalogo_productos','medrano_caja_arqueos','medrano_stock_controles','medrano_stock_control_items','palestina_insumos','palestina_aplicaciones','palestina_sala_periodos','palestina_madres','palestina_semillero','cultivo_parametros_objetivo','cultivo_mediciones','configuracion','palestina_aplicacion_items','palestina_caja_auditoria']) then
 execute format('drop policy if exists contador_lectura on public.%I',rel.relname);
 execute format('create policy contador_lectura on public.%I for select to authenticated using (public.es_contador_rainbows())',rel.relname);
 end if;
 end loop;
end $$;
-- Ampliar exclusivamente consultas conocidas, sin cambiar los permisos de gestión.
do $$ declare fn record; body text; begin
 for fn in select oid from pg_proc where pronamespace='public'::regnamespace and proname in ('consultar_caja_palestina','consultar_sueldos_palestina','consultar_datos_pago_palestina','listar_control_stock_medrano','revisar_integridad_medrano') loop
 body:=pg_get_functiondef(fn.oid);
 if position('public.es_contador_rainbows()' in body)=0 then
 body:=regexp_replace(body,'public\.(usuario_rainbows_(palestina_gestion|admin|medrano))\(\)','(public.\1() or public.es_contador_rainbows())','g');
 execute body;
 end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
