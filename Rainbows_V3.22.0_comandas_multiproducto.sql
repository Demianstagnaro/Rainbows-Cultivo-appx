-- Comandas multiproducto con reserva transaccional. Requiere V3.21.0.
begin;
create table if not exists public.medrano_configuracion_stock (
 singleton boolean primary key default true check (singleton),
 permitir_negativo boolean not null default true
);
insert into public.medrano_configuracion_stock(singleton,permitir_negativo) values(true,true) on conflict (singleton) do nothing;
alter table public.medrano_configuracion_stock enable row level security;
revoke all on public.medrano_configuracion_stock from public,anon,authenticated;
-- El cambio futuro a modo estricto se hace modificando permitir_negativo desde SQL Editor.
-- Quita únicamente checks de no-negatividad de las tres columnas físicas involucradas.
do $$
declare v_row record;
begin
 for v_row in
  select c.conrelid::regclass as tabla,c.conname
  from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
  where c.contype='c' and array_length(c.conkey,1)=1
    and ((c.conrelid='public.medrano_dispensario_lotes'::regclass and a.attname='gramos_actual')
      or (c.conrelid='public.medrano_mostrador_productos'::regclass and a.attname='cantidad')
      or (c.conrelid='public.medrano_laboratorio_stock'::regclass and a.attname='cantidad'))
    and pg_get_constraintdef(c.oid) like '%>=%'
 loop execute format('alter table %s drop constraint %I',v_row.tabla,v_row.conname);end loop;
end $$;
create table if not exists public.medrano_comandas_multiproducto (
 id uuid primary key default gen_random_uuid(),
 paciente_id uuid not null references public.medrano_pacientes(id),
 paciente_nombre text not null,
 fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
 estado text not null default 'pendiente' check (estado in ('pendiente','dispensada','eliminada')),
 creado_por uuid not null references auth.users(id),
 dispensada_por uuid references auth.users(id),
 dispensada_at timestamptz,
 eliminada_por uuid references auth.users(id),
 eliminada_at timestamptz,
 motivo_eliminacion text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint comanda_multi_disp check ((estado='dispensada')=(dispensada_at is not null)),
 constraint comanda_multi_elim check ((estado='eliminada')=(eliminada_at is not null))
);
create table if not exists public.medrano_comandas_multiproducto_items (
 id uuid primary key default gen_random_uuid(),
 comanda_id uuid not null references public.medrano_comandas_multiproducto(id),
 tipo text not null check (tipo in ('flores','resina','aceites','cremas','capsulas','mostrador')),
 origen_id uuid not null,
 nombre text not null,
 cantidad numeric not null check (cantidad>0),
 unidad text not null check (unidad in ('g','ml','unidades')),
 created_at timestamptz not null default now(),
 unique(comanda_id,tipo,origen_id)
);
create index if not exists comanda_multi_estado_idx on public.medrano_comandas_multiproducto(estado,fecha desc);
create index if not exists comanda_multi_items_origen_idx on public.medrano_comandas_multiproducto_items(tipo,origen_id);
alter table public.medrano_comandas_multiproducto enable row level security;
alter table public.medrano_comandas_multiproducto_items enable row level security;
drop policy if exists comanda_multi_select on public.medrano_comandas_multiproducto;
create policy comanda_multi_select on public.medrano_comandas_multiproducto for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists comanda_multi_items_select on public.medrano_comandas_multiproducto_items;
create policy comanda_multi_items_select on public.medrano_comandas_multiproducto_items for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_comandas_multiproducto,public.medrano_comandas_multiproducto_items from public,anon,authenticated;
grant select on public.medrano_comandas_multiproducto,public.medrano_comandas_multiproducto_items to authenticated;

create or replace function public.stock_libre_comanda(p_tipo text,p_origen uuid,p_excluir uuid default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_stock numeric; v_reservado numeric;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if p_tipo='flores' then select gramos_actual into v_stock from public.medrano_dispensario_lotes where id=p_origen;
 elsif p_tipo='mostrador' then select cantidad into v_stock from public.medrano_mostrador_productos where id=p_origen and activo;
 elsif p_tipo in ('resina','aceites','cremas','capsulas') then
   select cantidad into v_stock from public.medrano_laboratorio_stock where id=p_origen and categoria=p_tipo and activo;
 else raise exception 'Tipo de producto inválido.'; end if;
 if v_stock is null then raise exception 'El producto ya no está disponible.'; end if;
 select coalesce(sum(i.cantidad),0) into v_reservado
 from public.medrano_comandas_multiproducto_items i
 join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
 where c.estado='pendiente' and i.tipo=p_tipo and i.origen_id=p_origen and (p_excluir is null or c.id<>p_excluir);
 return v_stock-v_reservado;
end; $$;

-- La reserva también protege los ajustes manuales y otros traslados del inventario.
create or replace function public.respetar_reservas_comandas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tipo text; v_nuevo numeric; v_reservado numeric;
begin
 if tg_table_name='medrano_dispensario_lotes' then v_tipo:='flores';v_nuevo:=new.gramos_actual;
 elsif tg_table_name='medrano_mostrador_productos' then v_tipo:='mostrador';v_nuevo:=new.cantidad;
 else v_tipo:=new.categoria;v_nuevo:=new.cantidad; end if;
 if tg_op='UPDATE' and v_nuevo>=coalesce((to_jsonb(old)->>case when tg_table_name='medrano_dispensario_lotes' then 'gramos_actual' else 'cantidad' end)::numeric,0)
    and not (to_jsonb(new)->>'activo'='false' and to_jsonb(old)->>'activo' is distinct from 'false') then return new; end if;
 select coalesce(sum(i.cantidad),0) into v_reservado
 from public.medrano_comandas_multiproducto_items i join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
 where c.estado='pendiente' and i.tipo=v_tipo and i.origen_id=new.id;
 if not (select permitir_negativo from public.medrano_configuracion_stock where singleton) and v_nuevo<v_reservado then
   raise exception 'Hay stock reservado en comandas pendientes (% %).',v_reservado,v_tipo;
 end if;
 if v_reservado>0 and to_jsonb(new)->>'activo'='false' then raise exception 'No se puede retirar un producto reservado en comandas.'; end if;
 return new;
end; $$;
drop trigger if exists proteger_reservas_flores on public.medrano_dispensario_lotes;
create trigger proteger_reservas_flores before update on public.medrano_dispensario_lotes for each row execute function public.respetar_reservas_comandas();
drop trigger if exists proteger_reservas_mostrador on public.medrano_mostrador_productos;
create trigger proteger_reservas_mostrador before update on public.medrano_mostrador_productos for each row execute function public.respetar_reservas_comandas();
drop trigger if exists proteger_reservas_laboratorio on public.medrano_laboratorio_stock;
create trigger proteger_reservas_laboratorio before update on public.medrano_laboratorio_stock for each row execute function public.respetar_reservas_comandas();

create or replace function public.guardar_comanda_multiproducto(p_id uuid,p_paciente uuid,p_fecha date,p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;v_estado text;v_paciente text;v_line jsonb;v_tipo text;v_origen uuid;v_qty numeric;v_name text;v_unit text;v_old record;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso para guardar comandas.'; end if;
 if p_fecha is null or p_paciente is null or coalesce(jsonb_typeof(p_items),'')<>'array' then
   raise exception 'Seleccioná un paciente, fecha y productos válidos.'; end if;
 if jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30 then
   raise exception 'Seleccioná un paciente, fecha y al menos un producto (máximo 30).'; end if;
 select nullif(btrim(concat_ws(' ',nombre,apellido)),'') into v_paciente from public.medrano_pacientes where id=p_paciente;
 if v_paciente is null then raise exception 'Paciente no encontrado.'; end if;
 if p_id is not null then
   select estado into v_estado from public.medrano_comandas_multiproducto where id=p_id for update;
   if not found or v_estado='eliminada' then raise exception 'Comanda no disponible.'; end if;
   -- Bloquear las filas antiguas y nuevas en orden estable para evitar escrituras concurrentes.
   for v_old in select tipo,origen_id,cantidad from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
     if v_old.tipo='flores' then perform 1 from public.medrano_dispensario_lotes where id=v_old.origen_id for update;
     elsif v_old.tipo='mostrador' then perform 1 from public.medrano_mostrador_productos where id=v_old.origen_id for update;
     else perform 1 from public.medrano_laboratorio_stock where id=v_old.origen_id for update; end if;
   end loop;
   if v_estado='dispensada' then
     -- Editar una comanda ya dispensada restaura las unidades y la devuelve a pendiente.
     for v_old in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
       if v_old.tipo='flores' then update public.medrano_dispensario_lotes set gramos_actual=gramos_actual+v_old.cantidad where id=v_old.origen_id;
       elsif v_old.tipo='mostrador' then update public.medrano_mostrador_productos set cantidad=cantidad+v_old.cantidad where id=v_old.origen_id;
       else update public.medrano_laboratorio_stock set cantidad=cantidad+v_old.cantidad where id=v_old.origen_id; end if;
     end loop;
   end if;
   delete from public.medrano_comandas_multiproducto_items where comanda_id=p_id;
   update public.medrano_comandas_multiproducto set paciente_id=p_paciente,paciente_nombre=v_paciente,fecha=p_fecha,
     estado='pendiente',dispensada_at=null,dispensada_por=null,updated_at=now() where id=p_id;
   v_id:=p_id;
 else
   insert into public.medrano_comandas_multiproducto(paciente_id,paciente_nombre,fecha,creado_por)
   values(p_paciente,v_paciente,p_fecha,auth.uid()) returning id into v_id;
 end if;
 for v_line in select value from jsonb_array_elements(p_items) order by value->>'tipo',value->>'origen_id' loop
   v_tipo:=v_line->>'tipo';v_origen:=(v_line->>'origen_id')::uuid;v_qty:=(v_line->>'cantidad')::numeric;
   if v_qty is null or v_qty<=0 or v_qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Cantidad inválida.'; end if;
   if v_tipo='flores' then
     select concat_ws(' · ',nombre_historico,codigo_lote),'g' into v_name,v_unit from public.medrano_dispensario_lotes where id=v_origen for update;
   elsif v_tipo='mostrador' then
     select nombre,'unidades' into v_name,v_unit from public.medrano_mostrador_productos where id=v_origen and activo for update;
   elsif v_tipo in ('resina','aceites','cremas','capsulas') then
     select nombre,unidad into v_name,v_unit from public.medrano_laboratorio_stock where id=v_origen and categoria=v_tipo and activo for update;
   else raise exception 'Tipo de producto inválido.'; end if;
   if v_name is null then raise exception 'El producto ya no está disponible.'; end if;
   if not (select permitir_negativo from public.medrano_configuracion_stock where singleton)
     and public.stock_libre_comanda(v_tipo,v_origen,v_id)<v_qty then raise exception 'No alcanza el stock libre de %.',v_name; end if;
   if v_unit='unidades' and v_qty<>trunc(v_qty) then raise exception 'Las unidades deben ser enteras.'; end if;
   insert into public.medrano_comandas_multiproducto_items(comanda_id,tipo,origen_id,nombre,cantidad,unidad)
   values(v_id,v_tipo,v_origen,v_name,v_qty,v_unit);
 end loop;
 return v_id;
end; $$;

create or replace function public.dispensar_comanda_multiproducto(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_estado text;v_line record;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 select estado into v_estado from public.medrano_comandas_multiproducto where id=p_id for update;
 if not found or v_estado<>'pendiente' then raise exception 'La comanda ya fue cerrada o eliminada.'; end if;
 for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
   if not (select permitir_negativo from public.medrano_configuracion_stock where singleton)
      and public.stock_libre_comanda(v_line.tipo,v_line.origen_id,p_id)<v_line.cantidad then raise exception 'Stock insuficiente para %.',v_line.nombre; end if;
   if v_line.tipo='flores' then perform 1 from public.medrano_dispensario_lotes where id=v_line.origen_id for update;
   elsif v_line.tipo='mostrador' then perform 1 from public.medrano_mostrador_productos where id=v_line.origen_id for update;
   else perform 1 from public.medrano_laboratorio_stock where id=v_line.origen_id for update; end if;
 end loop;
 update public.medrano_comandas_multiproducto set estado='dispensada',dispensada_por=auth.uid(),dispensada_at=now(),updated_at=now() where id=p_id;
 for v_line in select * from public.medrano_comandas_multiproducto_items where comanda_id=p_id order by tipo,origen_id loop
   if v_line.tipo='flores' then update public.medrano_dispensario_lotes set gramos_actual=gramos_actual-v_line.cantidad where id=v_line.origen_id;
   elsif v_line.tipo='mostrador' then update public.medrano_mostrador_productos set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id;
   else update public.medrano_laboratorio_stock set cantidad=cantidad-v_line.cantidad where id=v_line.origen_id; end if;
   if not found then raise exception 'Stock insuficiente para %.',v_line.nombre; end if;
 end loop;
end; $$;

create or replace function public.eliminar_comanda_multiproducto(p_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if nullif(btrim(p_motivo),'') is null then raise exception 'Ingresá el motivo.'; end if;
 select estado into v_estado from public.medrano_comandas_multiproducto where id=p_id for update;
 if not found or v_estado='eliminada' then raise exception 'Comanda no disponible.'; end if;
 update public.medrano_comandas_multiproducto set estado='eliminada',eliminada_at=now(),eliminada_por=auth.uid(),motivo_eliminacion=btrim(p_motivo),updated_at=now() where id=p_id;
end; $$;
revoke all on function public.stock_libre_comanda(text,uuid,uuid),public.respetar_reservas_comandas(),
 public.guardar_comanda_multiproducto(uuid,uuid,date,jsonb),public.dispensar_comanda_multiproducto(uuid),
 public.eliminar_comanda_multiproducto(uuid,text) from public,anon;
grant execute on function public.guardar_comanda_multiproducto(uuid,uuid,date,jsonb),public.dispensar_comanda_multiproducto(uuid),
 public.eliminar_comanda_multiproducto(uuid,text) to authenticated;
commit;
