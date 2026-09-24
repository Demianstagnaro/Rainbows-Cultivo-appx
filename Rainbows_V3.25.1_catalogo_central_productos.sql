-- Catálogo maestro de productos de Medrano. Requiere V3.25.0.
begin;

create table if not exists public.medrano_catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('resina','aceites','cremas','capsulas','mostrador')),
  nombre text not null check (nullif(btrim(nombre),'') is not null),
  unidad text not null check (unidad in ('g','ml','unidades')),
  grupo_precio text,
  tokens_por_unidad numeric not null default 0 check (tokens_por_unidad>=0),
  activo boolean not null default true,
  creado_por uuid references auth.users(id),
  actualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists medrano_catalogo_categoria_nombre_uidx
  on public.medrano_catalogo_productos(categoria,lower(btrim(nombre)));

insert into public.medrano_catalogo_productos(categoria,nombre,unidad,grupo_precio,tokens_por_unidad)
select 'resina',v.nombre,'g','resina_general',coalesce(p.tokens_por_unidad,0)
from (values ('Rosin'),('Resina BHO')) v(nombre)
left join public.medrano_precios_categorias p on p.categoria='resina'
on conflict (categoria,lower(btrim(nombre))) do update
set unidad='g',grupo_precio='resina_general',tokens_por_unidad=excluded.tokens_por_unidad,updated_at=now();

insert into public.medrano_catalogo_productos(categoria,nombre,unidad,tokens_por_unidad)
select distinct on (s.categoria,lower(btrim(s.nombre))) s.categoria,btrim(s.nombre),s.unidad,coalesce(s.tokens_por_unidad,0)
from public.medrano_laboratorio_stock s
where s.categoria in ('aceites','cremas','capsulas') and not coalesce(s.es_aceite_base,false)
order by s.categoria,lower(btrim(s.nombre)),s.updated_at desc
on conflict (categoria,lower(btrim(nombre))) do nothing;

insert into public.medrano_catalogo_productos(categoria,nombre,unidad,tokens_por_unidad)
select 'mostrador',btrim(m.nombre),'unidades',coalesce(m.tokens_por_unidad,0)
from public.medrano_mostrador_productos m
on conflict (categoria,lower(btrim(nombre))) do nothing;

alter table public.medrano_laboratorio_stock
  add column if not exists catalogo_producto_id uuid references public.medrano_catalogo_productos(id);
alter table public.medrano_mostrador_productos
  add column if not exists catalogo_producto_id uuid references public.medrano_catalogo_productos(id);

update public.medrano_laboratorio_stock s set catalogo_producto_id=c.id
from public.medrano_catalogo_productos c
where s.catalogo_producto_id is null and c.categoria=s.categoria
  and lower(btrim(c.nombre))=lower(btrim(s.nombre)) and not coalesce(s.es_aceite_base,false);
update public.medrano_mostrador_productos m set catalogo_producto_id=c.id
from public.medrano_catalogo_productos c
where m.catalogo_producto_id is null and c.categoria='mostrador'
  and lower(btrim(c.nombre))=lower(btrim(m.nombre));

create index if not exists medrano_lab_catalogo_idx on public.medrano_laboratorio_stock(catalogo_producto_id);
create index if not exists medrano_mostrador_catalogo_idx on public.medrano_mostrador_productos(catalogo_producto_id);

alter table public.medrano_catalogo_productos enable row level security;
drop policy if exists medrano_catalogo_select on public.medrano_catalogo_productos;
create policy medrano_catalogo_select on public.medrano_catalogo_productos
for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_catalogo_productos from public,anon,authenticated;
grant select on public.medrano_catalogo_productos to authenticated;

create or replace function public.asignar_catalogo_stock_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_producto public.medrano_catalogo_productos%rowtype;
begin
  if tg_table_name='medrano_laboratorio_stock' then
    if new.catalogo_producto_id is null and not coalesce(new.es_aceite_base,false) then
      select * into v_producto from public.medrano_catalogo_productos
      where categoria=new.categoria and lower(btrim(nombre))=lower(btrim(new.nombre)) limit 1;
    elsif new.catalogo_producto_id is not null then
      select * into v_producto from public.medrano_catalogo_productos where id=new.catalogo_producto_id;
    end if;
  else
    if new.catalogo_producto_id is null then
      select * into v_producto from public.medrano_catalogo_productos
      where categoria='mostrador' and lower(btrim(nombre))=lower(btrim(new.nombre)) limit 1;
    else
      select * into v_producto from public.medrano_catalogo_productos where id=new.catalogo_producto_id;
    end if;
  end if;
  if v_producto.id is not null then
    new.catalogo_producto_id:=v_producto.id;
    new.nombre:=v_producto.nombre;
    if tg_table_name='medrano_laboratorio_stock' then new.unidad:=v_producto.unidad; end if;
    new.tokens_por_unidad:=case when v_producto.categoria='resina'
      then coalesce((select tokens_por_unidad from public.medrano_precios_categorias where categoria='resina'),0)
      else v_producto.tokens_por_unidad end;
  end if;
  return new;
end; $$;

drop trigger if exists asignar_catalogo_lab_stock on public.medrano_laboratorio_stock;
create trigger asignar_catalogo_lab_stock before insert or update of catalogo_producto_id,nombre,categoria
on public.medrano_laboratorio_stock for each row execute function public.asignar_catalogo_stock_medrano();
drop trigger if exists asignar_catalogo_mostrador on public.medrano_mostrador_productos;
create trigger asignar_catalogo_mostrador before insert or update of catalogo_producto_id,nombre
on public.medrano_mostrador_productos for each row execute function public.asignar_catalogo_stock_medrano();

create or replace function public.guardar_producto_catalogo_medrano(
  p_id uuid,p_categoria text,p_nombre text,p_unidad text,p_tokens numeric,p_activo boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_nombre text:=btrim(p_nombre);
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  if p_categoria not in ('resina','aceites','cremas','capsulas','mostrador') or nullif(v_nombre,'') is null
     or p_unidad not in ('g','ml','unidades') or p_tokens is null or p_tokens<0
     or p_tokens::text in ('NaN','Infinity','-Infinity') then raise exception 'Revisá categoría, producto, unidad y Tokens.'; end if;
  if p_categoria='resina' and (v_nombre not in ('Rosin','Resina BHO') or p_unidad<>'g') then
    raise exception 'Las resinas disponibles son Rosin y Resina BHO, en gramos.'; end if;
  if p_id is null then
    insert into public.medrano_catalogo_productos(categoria,nombre,unidad,grupo_precio,tokens_por_unidad,activo,creado_por,actualizado_por)
    values(p_categoria,v_nombre,p_unidad,case when p_categoria='resina' then 'resina_general' end,p_tokens,p_activo,auth.uid(),auth.uid())
    on conflict (categoria,lower(btrim(nombre))) do update set activo=excluded.activo,updated_at=now(),actualizado_por=auth.uid()
    returning id into v_id;
  else
    update public.medrano_catalogo_productos set nombre=v_nombre,unidad=p_unidad,tokens_por_unidad=p_tokens,
      activo=p_activo,actualizado_por=auth.uid(),updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Producto no encontrado.'; end if;
  end if;
  if p_categoria='resina' then
    insert into public.medrano_precios_categorias(categoria,tokens_por_unidad,unidad,actualizado_por,updated_at)
    values('resina',p_tokens,'g',auth.uid(),now()) on conflict(categoria) do update
    set tokens_por_unidad=excluded.tokens_por_unidad,actualizado_por=auth.uid(),updated_at=now();
    update public.medrano_catalogo_productos set tokens_por_unidad=p_tokens,updated_at=now() where categoria='resina';
  end if;
  return v_id;
end; $$;

create or replace function public.guardar_stock_mostrador_catalogo(p_catalogo_producto_id uuid,p_cantidad integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_producto public.medrano_catalogo_productos%rowtype;v_id uuid;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  if p_cantidad is null or p_cantidad<0 then raise exception 'Cantidad inválida.'; end if;
  select * into v_producto from public.medrano_catalogo_productos
    where id=p_catalogo_producto_id and categoria='mostrador' and activo;
  if not found then raise exception 'Seleccioná un producto activo de Mostrador.'; end if;
  insert into public.medrano_mostrador_productos(nombre,cantidad,activo,creado_por,catalogo_producto_id,tokens_por_unidad)
  values(v_producto.nombre,p_cantidad,true,auth.uid(),v_producto.id,v_producto.tokens_por_unidad)
  on conflict (lower(btrim(nombre))) do update set cantidad=excluded.cantidad,activo=true,
    catalogo_producto_id=excluded.catalogo_producto_id,tokens_por_unidad=excluded.tokens_por_unidad,updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;

drop function if exists public.guardar_stock_laboratorio(uuid,text,text,uuid,text,text,text,numeric,text,boolean);
create or replace function public.guardar_stock_laboratorio(
  p_id uuid,p_categoria text,p_nombre text,p_catalogo_producto_id uuid,p_genetica_id uuid,p_lote text,
  p_perfil_cannabinoide text,p_proporcion_cannabinoides text,p_cantidad numeric,p_unidad text,p_activo boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare v_producto public.medrano_catalogo_productos%rowtype;v_es_base boolean:=false;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para modificar stock.'; end if;
  if p_categoria='flores' then raise exception 'Las flores ingresan mediante recepción del Dispensario.'; end if;
  if p_cantidad is null or p_cantidad<0 or p_cantidad::text in ('NaN','Infinity','-Infinity') then raise exception 'Revisá el producto y la cantidad.'; end if;
  if p_id is not null then select es_aceite_base into v_es_base from public.medrano_laboratorio_stock where id=p_id; end if;
  if p_categoria<>'insumos' and not v_es_base then
    select * into v_producto from public.medrano_catalogo_productos where id=p_catalogo_producto_id and categoria=p_categoria and (activo or p_id is not null);
    if not found then raise exception 'Seleccioná un producto activo de la Lista de precios.'; end if;
    p_nombre:=v_producto.nombre;p_unidad:=v_producto.unidad;
  elsif nullif(btrim(p_nombre),'') is null then raise exception 'Ingresá el producto.';
  end if;
  if length(coalesce(p_proporcion_cannabinoides,''))>60 then raise exception 'La proporción es demasiado larga.'; end if;
  if p_categoria='resina' then
    if p_nombre not in ('Rosin','Resina BHO') or p_genetica_id is null or nullif(btrim(p_lote),'') is null
       or p_perfil_cannabinoide not in ('THC','CBD','CBN','THC-CBD','THC-CBN','CBD-CBN','THC-CBD-CBN','Otro')
       or not exists(select 1 from public.geneticas where id=p_genetica_id) then
      raise exception 'Completá producto, perfil de cannabinoides, genética, lote y disponible.'; end if;
  elsif p_categoria<>'aceites' then
    p_genetica_id:=null;p_lote:=null;p_perfil_cannabinoide:=null;p_proporcion_cannabinoides:=null;
  end if;
  if p_unidad not in ('g','ml','unidades') then raise exception 'Unidad inválida.'; end if;
  if p_unidad='unidades' and p_cantidad<>trunc(p_cantidad) then raise exception 'Las unidades deben ser cantidades enteras.'; end if;
  if p_id is null then
    insert into public.medrano_laboratorio_stock(categoria,nombre,catalogo_producto_id,genetica_id,lote,perfil_cannabinoide,proporcion_cannabinoides,cantidad,unidad,activo,tokens_por_unidad)
    values(p_categoria,btrim(p_nombre),p_catalogo_producto_id,p_genetica_id,nullif(btrim(p_lote),''),p_perfil_cannabinoide,
      nullif(btrim(p_proporcion_cannabinoides),''),p_cantidad,p_unidad,p_activo,coalesce(v_producto.tokens_por_unidad,0));
  else
    update public.medrano_laboratorio_stock set nombre=btrim(p_nombre),catalogo_producto_id=coalesce(p_catalogo_producto_id,catalogo_producto_id),genetica_id=p_genetica_id,
      lote=nullif(btrim(p_lote),''),perfil_cannabinoide=p_perfil_cannabinoide,proporcion_cannabinoides=nullif(btrim(p_proporcion_cannabinoides),''),
      cantidad=p_cantidad,unidad=p_unidad,activo=p_activo where id=p_id and categoria=p_categoria and categoria<>'flores';
    if not found then raise exception 'No se encontró el producto.'; end if;
  end if;
end; $$;

create or replace function public.guardar_precio_lista_medrano(p_tipo text,p_id uuid,p_tamano text,p_tokens numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  if p_tokens is null or p_tokens<0 or p_tokens::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá un valor de Tokens válido.'; end if;
  if p_tipo='flores' then
    if p_tamano not in ('grande','mediano','chico') then raise exception 'Tamaño de flor inválido.'; end if;
    insert into public.medrano_precios_flores(tamano,tokens_por_gramo,actualizado_por,updated_at)
    values(p_tamano,p_tokens,auth.uid(),now()) on conflict(tamano) do update
    set tokens_por_gramo=excluded.tokens_por_gramo,actualizado_por=auth.uid(),updated_at=now();
  elsif p_tipo='resina' then
    insert into public.medrano_precios_categorias(categoria,tokens_por_unidad,unidad,actualizado_por,updated_at)
    values('resina',p_tokens,'g',auth.uid(),now()) on conflict(categoria) do update
    set tokens_por_unidad=excluded.tokens_por_unidad,actualizado_por=auth.uid(),updated_at=now();
    update public.medrano_catalogo_productos set tokens_por_unidad=p_tokens,updated_at=now() where categoria='resina';
    update public.medrano_laboratorio_stock set tokens_por_unidad=p_tokens,updated_at=now() where categoria='resina';
  elsif p_tipo in ('aceites','cremas','capsulas','mostrador') then
    update public.medrano_catalogo_productos set tokens_por_unidad=p_tokens,actualizado_por=auth.uid(),updated_at=now()
    where id=p_id and categoria=p_tipo;
    if not found then raise exception 'Producto no encontrado.'; end if;
    if p_tipo='mostrador' then update public.medrano_mostrador_productos set tokens_por_unidad=p_tokens,updated_at=now() where catalogo_producto_id=p_id;
    else update public.medrano_laboratorio_stock set tokens_por_unidad=p_tokens,updated_at=now() where catalogo_producto_id=p_id; end if;
  else raise exception 'Tipo inválido.';
  end if;
  if p_tipo='flores' then
    update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='flores'
      and i.origen_id in (select id from public.medrano_dispensario_lotes where tamano=p_tamano);
  elsif p_tipo='resina' then
    update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='resina';
  elsif p_tipo='mostrador' then
    update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='mostrador'
      and i.origen_id in (select id from public.medrano_mostrador_productos where catalogo_producto_id=p_id);
  else
    update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo=p_tipo
      and i.origen_id in (select id from public.medrano_laboratorio_stock where catalogo_producto_id=p_id);
  end if;
end; $$;

revoke all on function public.guardar_producto_catalogo_medrano(uuid,text,text,text,numeric,boolean) from public,anon;
revoke all on function public.guardar_stock_mostrador_catalogo(uuid,integer) from public,anon;
revoke all on function public.guardar_stock_laboratorio(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean) from public,anon;
revoke all on function public.guardar_precio_lista_medrano(text,uuid,text,numeric) from public,anon;
grant execute on function public.guardar_producto_catalogo_medrano(uuid,text,text,text,numeric,boolean) to authenticated;
grant execute on function public.guardar_stock_mostrador_catalogo(uuid,integer) to authenticated;
grant execute on function public.guardar_stock_laboratorio(uuid,text,text,uuid,uuid,text,text,text,numeric,text,boolean) to authenticated;
grant execute on function public.guardar_precio_lista_medrano(text,uuid,text,numeric) to authenticated;

commit;
