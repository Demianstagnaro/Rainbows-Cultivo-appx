-- Lista de precios centralizada y flores agrupadas por tamaño. Requiere V3.24.4.
begin;

create table if not exists public.medrano_precios_flores (
  id uuid primary key default gen_random_uuid(),
  tamano text not null unique check (tamano in ('grande','mediano','chico')),
  tokens_por_gramo numeric not null default 0 check (tokens_por_gramo >= 0),
  actualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conserva como valor inicial el precio anterior de las genéticas, si existía.
insert into public.medrano_precios_flores(tamano,tokens_por_gramo)
select tamano,coalesce((select max(medrano_tokens_por_unidad) from public.geneticas where medrano_tokens_por_unidad>0),0)
from unnest(array['grande','mediano','chico']::text[]) as tamanos(tamano)
on conflict (tamano) do nothing;

alter table public.medrano_precios_flores enable row level security;
drop policy if exists medrano_precios_flores_select on public.medrano_precios_flores;
create policy medrano_precios_flores_select on public.medrano_precios_flores
for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_precios_flores from public,anon,authenticated;
grant select on public.medrano_precios_flores to authenticated;

-- Las flores toman el valor por tamaño del lote, no por genética.
create or replace function public.precio_tokens_producto(p_tipo text,p_origen uuid)
returns numeric language plpgsql security definer set search_path='' stable as $$
declare v_precio numeric;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  if p_tipo='flores' then
    select p.tokens_por_gramo into v_precio
    from public.medrano_dispensario_lotes l
    join public.medrano_precios_flores p on p.tamano=l.tamano
    where l.id=p_origen;
  elsif p_tipo='mostrador' then
    select tokens_por_unidad into v_precio
    from public.medrano_mostrador_productos where id=p_origen;
  elsif p_tipo in ('resina','aceites','cremas','capsulas') then
    select tokens_por_unidad into v_precio
    from public.medrano_laboratorio_stock where id=p_origen and categoria=p_tipo;
  else
    raise exception 'Tipo de producto inválido.';
  end if;
  return coalesce(v_precio,0);
end; $$;

create or replace function public.guardar_precio_lista_medrano(
  p_tipo text,
  p_id uuid,
  p_tamano text,
  p_tokens numeric
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
  if p_tokens is null or p_tokens<0 or p_tokens::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Ingresá un valor de Tokens válido.';
  end if;

  if p_tipo='flores' then
    if p_tamano not in ('grande','mediano','chico') then raise exception 'Tamaño de flor inválido.'; end if;
    insert into public.medrano_precios_flores(tamano,tokens_por_gramo,actualizado_por,updated_at)
    values(p_tamano,p_tokens,auth.uid(),now())
    on conflict (tamano) do update
    set tokens_por_gramo=excluded.tokens_por_gramo,actualizado_por=auth.uid(),updated_at=now();
  elsif p_tipo='mostrador' then
    update public.medrano_mostrador_productos
    set tokens_por_unidad=p_tokens,updated_at=now()
    where id=p_id;
    if not found then raise exception 'Producto no encontrado.'; end if;
  elsif p_tipo in ('resina','aceites','cremas','capsulas') then
    update public.medrano_laboratorio_stock
    set tokens_por_unidad=p_tokens,updated_at=now()
    where id=p_id and categoria=p_tipo;
    if not found then raise exception 'Producto no encontrado.'; end if;
  else
    raise exception 'Tipo inválido.';
  end if;

  -- Recalcula únicamente comandas pendientes y todavía no pagadas.
  if p_tipo='flores' then
    update public.medrano_comandas_multiproducto_items i
    set cantidad=i.cantidad
    from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id
      and c.estado='pendiente'
      and c.pago_estado<>'pagada'
      and i.tipo='flores'
      and i.origen_id in (
        select id from public.medrano_dispensario_lotes where tamano=p_tamano
      );
  else
    update public.medrano_comandas_multiproducto_items i
    set cantidad=i.cantidad
    from public.medrano_comandas_multiproducto c
    where c.id=i.comanda_id
      and c.estado='pendiente'
      and c.pago_estado<>'pagada'
      and i.tipo=p_tipo
      and i.origen_id=p_id;
  end if;
end; $$;

revoke all on function public.guardar_precio_lista_medrano(text,uuid,text,numeric) from public,anon;
grant execute on function public.guardar_precio_lista_medrano(text,uuid,text,numeric) to authenticated;

commit;
