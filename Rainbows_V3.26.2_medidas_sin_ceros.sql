-- Rainbows V3.26.2: medidas legibles sin decimales finales innecesarios.
-- Ejecutar una sola vez después de V3.26.1.
begin;

create or replace function public.normalizar_medidas_medrano(p_texto text)
returns text language sql immutable strict set search_path='' as $$
  select regexp_replace(
    regexp_replace(p_texto,'([0-9]+[.][0-9]*[1-9])0+([^0-9]|$)','\1\2','g'),
    '([0-9]+)[.]0+([^0-9]|$)','\1\2','g'
  )
$$;

create or replace function public.normalizar_medidas_stock_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.nombre:=public.normalizar_medidas_medrano(new.nombre);
  if new.nombre_comercial is not null then
    new.nombre_comercial:=public.normalizar_medidas_medrano(new.nombre_comercial);
  end if;
  return new;
end; $$;

create or replace function public.normalizar_medidas_trabajo_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.producto:=public.normalizar_medidas_medrano(new.producto);
  return new;
end; $$;

create or replace function public.normalizar_medidas_catalogo_medrano()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.nombre:=public.normalizar_medidas_medrano(new.nombre);
  return new;
end; $$;

drop trigger if exists a_normalizar_medidas_stock_medrano on public.medrano_laboratorio_stock;
create trigger a_normalizar_medidas_stock_medrano
before insert or update of nombre,nombre_comercial on public.medrano_laboratorio_stock
for each row execute function public.normalizar_medidas_stock_medrano();

drop trigger if exists a_normalizar_medidas_trabajo_medrano on public.medrano_laboratorio_trabajos;
create trigger a_normalizar_medidas_trabajo_medrano
before insert or update of producto on public.medrano_laboratorio_trabajos
for each row execute function public.normalizar_medidas_trabajo_medrano();

drop trigger if exists a_normalizar_medidas_catalogo_medrano on public.medrano_catalogo_productos;
create trigger a_normalizar_medidas_catalogo_medrano
before insert or update of nombre on public.medrano_catalogo_productos
for each row execute function public.normalizar_medidas_catalogo_medrano();

-- Si la escritura anterior y la nueva ya habían creado dos artículos equivalentes,
-- conserva uno solo, mantiene el precio mayor y vuelve a enlazar sus lotes físicos.
create temporary table catalogo_medidas_merge on commit drop as
select c.id as old_id,
  first_value(c.id) over (
    partition by c.categoria,lower(public.normalizar_medidas_medrano(btrim(c.nombre)))
    order by c.tokens_por_unidad desc,c.created_at,c.id
  ) as canonical_id,
  public.normalizar_medidas_medrano(btrim(c.nombre)) as nombre_normalizado
from public.medrano_catalogo_productos c
where c.categoria in ('aceites','cremas','capsulas');

update public.medrano_catalogo_productos c
set tokens_por_unidad=datos.tokens_por_unidad,
  activo=datos.activo,
  updated_at=now()
from (
  select m.canonical_id,max(origen.tokens_por_unidad) as tokens_por_unidad,bool_or(origen.activo) as activo
  from catalogo_medidas_merge m
  join public.medrano_catalogo_productos origen on origen.id=m.old_id
  group by m.canonical_id
) datos
where c.id=datos.canonical_id;

update public.medrano_laboratorio_stock s
set catalogo_producto_id=m.canonical_id,updated_at=now()
from catalogo_medidas_merge m
where s.catalogo_producto_id=m.old_id and m.old_id<>m.canonical_id;

delete from public.medrano_catalogo_productos c
using catalogo_medidas_merge m
where c.id=m.old_id and m.old_id<>m.canonical_id;

update public.medrano_catalogo_productos c
set nombre=m.nombre_normalizado,updated_at=now()
from catalogo_medidas_merge m
where c.id=m.canonical_id and c.nombre is distinct from m.nombre_normalizado;

-- Corrige los nombres que ya estaban guardados, sin modificar cantidades ni recetas.
update public.medrano_laboratorio_trabajos
set producto=public.normalizar_medidas_medrano(producto),updated_at=now()
where producto is distinct from public.normalizar_medidas_medrano(producto);

update public.medrano_laboratorio_trabajos_materiales
set nombre=public.normalizar_medidas_medrano(nombre)
where nombre is distinct from public.normalizar_medidas_medrano(nombre);

update public.medrano_laboratorio_stock
set nombre=public.normalizar_medidas_medrano(nombre),
  nombre_comercial=case when nombre_comercial is null then null else public.normalizar_medidas_medrano(nombre_comercial) end,
  updated_at=now()
where nombre is distinct from public.normalizar_medidas_medrano(nombre)
   or nombre_comercial is distinct from public.normalizar_medidas_medrano(nombre_comercial);

update public.medrano_stock_historial
set producto=public.normalizar_medidas_medrano(producto),
  detalle=case when detalle is null then null else public.normalizar_medidas_medrano(detalle) end
where producto is distinct from public.normalizar_medidas_medrano(producto)
   or detalle is distinct from public.normalizar_medidas_medrano(detalle);

update public.medrano_operaciones
set detalle=public.normalizar_medidas_medrano(detalle),updated_at=now()
where detalle is distinct from public.normalizar_medidas_medrano(detalle);

update public.medrano_comandas_multiproducto_items
set nombre=public.normalizar_medidas_medrano(nombre)
where nombre is distinct from public.normalizar_medidas_medrano(nombre);

revoke all on function public.normalizar_medidas_medrano(text) from public,anon;
revoke all on function public.normalizar_medidas_stock_medrano() from public,anon;
revoke all on function public.normalizar_medidas_trabajo_medrano() from public,anon;
revoke all on function public.normalizar_medidas_catalogo_medrano() from public,anon;

commit;
