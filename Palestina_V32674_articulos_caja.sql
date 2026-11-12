-- Rainbows 3.26.74 — Artículos de Caja con alta explícita.
-- Requiere V3.26.73. Conserva artículos, movimientos, apertura e historial.
begin;
create or replace function public.crear_articulo_caja_palestina(p_nombre text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nombre text;v_existente text;v_articulo public.palestina_caja_articulos%rowtype;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para agregar artículos.'; end if;
 perform public.bloquear_caja_palestina();
 v_nombre:=regexp_replace(btrim(coalesce(p_nombre,'')),'[[:space:]]+',' ','g');
 if length(v_nombre) not between 1 and 180 then raise exception 'El nombre debe tener entre 1 y 180 caracteres.'; end if;
 select nombre into v_existente from public.palestina_caja_articulos
 where translate(lower(regexp_replace(btrim(nombre),'[[:space:]]+',' ','g')),'áéíóúüñ','aeiouun')=translate(lower(v_nombre),'áéíóúüñ','aeiouun') limit 1;
 if found then raise exception 'Ya existe el artículo «%». Elegilo en la lista.',v_existente; end if;
 insert into public.palestina_caja_articulos(nombre) values(v_nombre) returning * into v_articulo;
 return to_jsonb(v_articulo);
end; $$;
create or replace function public.guardar_movimiento_caja_palestina(
 p_id uuid,p_version integer,p_solicitud uuid,p_fecha date,p_tipo text,p_medio text,p_articulo text,
 p_cantidad numeric,p_monto numeric,p_categoria_id uuid,p_notas text default '',p_motivo text default ''
) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.palestina_caja_movimientos%rowtype;new public.palestina_caja_movimientos%rowtype;
 v_articulo uuid;v_nombre text;v_texto text;v_apertura date;v_categoria public.palestina_caja_categorias%rowtype;
begin
 if not public.usuario_rainbows_palestina_gestion() then raise exception 'Sin permisos para registrar movimientos.'; end if;
 perform public.bloquear_caja_palestina();
 if p_id is null and p_solicitud is not null then
  select * into new from public.palestina_caja_movimientos where solicitud_id=p_solicitud;
  if found then return new.id; end if;
 end if;
 select fecha into v_apertura from public.palestina_caja_apertura where unica;
 if v_apertura is null then raise exception 'Registrá primero el saldo inicial de efectivo, aunque sea cero.'; end if;
 if p_fecha is null or p_fecha<v_apertura or p_fecha>(now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'La fecha debe estar entre la apertura de esta caja y hoy.'; end if;
 if p_tipo is null or p_tipo not in ('ingreso','egreso') or p_medio is null or p_medio not in ('efectivo','transferencia') then raise exception 'Elegí movimiento y forma de pago.'; end if;
 v_texto:=regexp_replace(btrim(coalesce(p_articulo,'')),'[[:space:]]+',' ','g');
 if length(v_texto) not between 1 and 180 or length(coalesce(p_notas,''))>1000 or length(coalesce(p_motivo,''))>1000 then raise exception 'Completá el artículo (hasta 180 caracteres) y notas o motivo de hasta 1000 caracteres.'; end if;
 if p_cantidad is null or p_cantidad<=0 or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<>round(p_cantidad,3) or p_cantidad>999999999 then raise exception 'La cantidad debe ser positiva, con hasta tres decimales.'; end if;
 if p_monto is null or p_monto<=0 or p_monto::text in ('NaN','Infinity','-Infinity') or p_monto<>round(p_monto,2) or p_monto>999999999999.99 then raise exception 'El costo total debe ser positivo, con hasta dos decimales.'; end if;
 select * into v_categoria from public.palestina_caja_categorias where id=p_categoria_id;
 if not found or v_categoria.tipo<>p_tipo then raise exception 'La categoría no corresponde al movimiento.'; end if;
 if p_tipo='ingreso' and v_categoria.nombre is distinct from (case when p_medio='efectivo' then 'Ingreso de efectivo' else 'Ingreso por transferencia' end) then raise exception 'Elegí la categoría de ingreso del medio de pago indicado.'; end if;
 if p_id is not null then
  select * into old from public.palestina_caja_movimientos where id=p_id for update;
  if not found or old.anulado_at is not null then raise exception 'El movimiento ya no está vigente.'; end if;
  if old.version is distinct from p_version then raise exception 'Otra persona modificó el movimiento. Actualizá antes de corregirlo.'; end if;
  if length(btrim(coalesce(p_motivo,'')))<3 then raise exception 'Indicá el motivo de la corrección.'; end if;
 elsif p_solicitud is null then raise exception 'Falta la identificación de la carga. Volvé a abrir el formulario.';
 end if;
 v_nombre:=public.actor_caja_palestina();
 select id,nombre into v_articulo,v_texto from public.palestina_caja_articulos
 where activo and lower(btrim(nombre))=lower(v_texto);
 if not found then raise exception 'Elegí un artículo existente. Si falta, agregalo con Nuevo artículo antes de guardar el movimiento.'; end if;
 if p_id is null then
  insert into public.palestina_caja_movimientos(solicitud_id,fecha,tipo,medio,articulo_id,articulo,cantidad,monto,categoria_id,notas,creado_por,creado_nombre,actualizado_por,actualizado_nombre)
  values(p_solicitud,p_fecha,p_tipo,p_medio,v_articulo,v_texto,p_cantidad,p_monto,p_categoria_id,coalesce(p_notas,''),auth.uid(),v_nombre,auth.uid(),v_nombre) returning * into new;
 else
  update public.palestina_caja_movimientos set fecha=p_fecha,tipo=p_tipo,medio=p_medio,articulo_id=v_articulo,articulo=v_texto,cantidad=p_cantidad,monto=p_monto,categoria_id=p_categoria_id,notas=coalesce(p_notas,''),version=version+1,actualizado_por=auth.uid(),actualizado_nombre=v_nombre,actualizado_at=now() where id=p_id returning * into new;
 end if;
 insert into public.palestina_caja_auditoria(entidad,entidad_id,accion,antes,despues,motivo,usuario_id,usuario_nombre)
 values('movimiento',new.id,case when p_id is null then 'alta' else 'correccion' end,case when p_id is null then null else to_jsonb(old) end,to_jsonb(new),p_motivo,auth.uid(),v_nombre);
 return new.id;
end; $$;

revoke all on function public.crear_articulo_caja_palestina(text),public.guardar_movimiento_caja_palestina(uuid,integer,uuid,date,text,text,text,numeric,numeric,uuid,text,text) from public,anon,authenticated;
grant execute on function public.crear_articulo_caja_palestina(text),public.guardar_movimiento_caja_palestina(uuid,integer,uuid,date,text,text,text,numeric,numeric,uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
