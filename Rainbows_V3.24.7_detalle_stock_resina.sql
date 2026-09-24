-- Detalle trazable de resinas: producto, genética, lote y disponible en gramos. Requiere V3.24.6.
begin;

drop function if exists public.guardar_stock_laboratorio(uuid,text,text,numeric,text,boolean);

create or replace function public.guardar_stock_laboratorio(
  p_id uuid,
  p_categoria text,
  p_nombre text,
  p_genetica_id uuid,
  p_lote text,
  p_cantidad numeric,
  p_unidad text,
  p_activo boolean default true
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'No tenés permiso para modificar stock.';
  end if;
  if p_categoria = 'flores' then
    raise exception 'Las flores ingresan mediante recepción del Dispensario.';
  end if;
  if p_cantidad is null or p_cantidad < 0
     or p_cantidad::text in ('NaN','Infinity','-Infinity')
     or nullif(btrim(p_nombre),'') is null then
    raise exception 'Revisá el producto y la cantidad.';
  end if;

  if p_categoria = 'resina' then
    p_unidad := 'g';
    if p_activo and (
      p_nombre not in ('Rosin','Resina BHO')
      or p_genetica_id is null
      or nullif(btrim(p_lote),'') is null
      or not exists(select 1 from public.geneticas where id=p_genetica_id)
    ) then
      raise exception 'Completá producto, genética, lote y disponible.';
    end if;
  else
    p_genetica_id := null;
    p_lote := null;
  end if;

  if p_unidad not in ('g','ml','unidades') then
    raise exception 'Unidad inválida.';
  end if;
  if p_unidad = 'unidades' and p_cantidad <> trunc(p_cantidad) then
    raise exception 'Las unidades deben ser cantidades enteras.';
  end if;
  if p_id is not null and p_categoria <> 'resina'
     and exists(select 1 from public.medrano_laboratorio_stock where id=p_id and unidad<>p_unidad) then
    raise exception 'No se puede cambiar la unidad de un producto existente.';
  end if;

  if p_id is null then
    insert into public.medrano_laboratorio_stock(
      categoria,nombre,genetica_id,lote,cantidad,unidad,activo
    ) values(
      p_categoria,btrim(p_nombre),p_genetica_id,nullif(btrim(p_lote),''),p_cantidad,p_unidad,p_activo
    );
  else
    update public.medrano_laboratorio_stock
    set nombre=btrim(p_nombre),
        genetica_id=p_genetica_id,
        lote=nullif(btrim(p_lote),''),
        cantidad=p_cantidad,
        unidad=p_unidad,
        activo=p_activo
    where id=p_id and categoria=p_categoria and categoria<>'flores';
    if not found then raise exception 'No se encontró el producto.'; end if;
  end if;
end; $$;

revoke all on function public.guardar_stock_laboratorio(uuid,text,text,uuid,text,numeric,text,boolean) from public,anon;
grant execute on function public.guardar_stock_laboratorio(uuid,text,text,uuid,text,numeric,text,boolean) to authenticated;

commit;
