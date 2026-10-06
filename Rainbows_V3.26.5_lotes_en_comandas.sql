-- Rainbows V3.26.5: genética y lote persistentes en comandas e historial.
-- Ejecutar una sola vez después de V3.26.4.
begin;

alter table public.medrano_comandas_multiproducto_items
  add column if not exists genetica_nombre text,
  add column if not exists numero_lote text;

-- Durante la recuperación histórica se permite completar solamente la trazabilidad.
-- Producto, origen, cantidad, unidad y Tokens de una comanda pagada siguen bloqueados.
create or replace function public.proteger_comanda_pagada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select 1 from public.medrano_comandas_multiproducto
    where id=old.comanda_id and pago_estado='pagada'
  ) then
    if tg_op='UPDATE' then
      if (to_jsonb(new)-array['preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote'])
         =(to_jsonb(old)-array['preparacion_estado','preparacion_trabajo_id','genetica_nombre','numero_lote']) then
        return new;
      end if;
    end if;
    raise exception 'Una comanda pagada no se puede editar. Cancelala para devolver los Tokens al paciente.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;

update public.medrano_comandas_multiproducto_items i
set genetica_nombre=coalesce(g.nombre,l.nombre_historico,i.genetica_nombre),
    numero_lote=coalesce(l.codigo_lote,i.numero_lote)
from public.medrano_dispensario_lotes l
left join public.geneticas g on g.id=l.genetica_id
where i.tipo='flores' and i.origen_id=l.id
  and (i.genetica_nombre is null or i.numero_lote is null);

update public.medrano_comandas_multiproducto_items i
set genetica_nombre=coalesce(g.nombre,i.genetica_nombre),
    numero_lote=coalesce(s.lote,i.numero_lote)
from public.medrano_laboratorio_stock s
left join public.geneticas g on g.id=s.genetica_id
where i.tipo in ('resina','aceites','cremas','capsulas') and i.origen_id=s.id
  and (i.genetica_nombre is null or i.numero_lote is null);

create or replace function public.completar_trazabilidad_item_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_genetica text;v_lote text;
begin
  if new.tipo='flores' then
    select coalesce(g.nombre,l.nombre_historico),l.codigo_lote
    into v_genetica,v_lote
    from public.medrano_dispensario_lotes l
    left join public.geneticas g on g.id=l.genetica_id
    where l.id=new.origen_id;
  elsif new.tipo in ('resina','aceites','cremas','capsulas') then
    select g.nombre,s.lote
    into v_genetica,v_lote
    from public.medrano_laboratorio_stock s
    left join public.geneticas g on g.id=s.genetica_id
    where s.id=new.origen_id;
  else
    v_genetica:=null;v_lote:=null;
  end if;
  new.genetica_nombre:=nullif(btrim(v_genetica),'');
  new.numero_lote:=nullif(btrim(v_lote),'');
  return new;
end; $$;
drop trigger if exists completar_trazabilidad_item_comanda on public.medrano_comandas_multiproducto_items;
create trigger completar_trazabilidad_item_comanda
before insert or update of tipo,origen_id
on public.medrano_comandas_multiproducto_items
for each row execute function public.completar_trazabilidad_item_comanda();

-- Protección definitiva: una comanda pagada sólo admite avanzar su preparación.
create or replace function public.proteger_comanda_pagada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select 1 from public.medrano_comandas_multiproducto
    where id=old.comanda_id and pago_estado='pagada'
  ) then
    if tg_op='UPDATE' then
      if (to_jsonb(new)-array['preparacion_estado','preparacion_trabajo_id'])
         =(to_jsonb(old)-array['preparacion_estado','preparacion_trabajo_id']) then
        return new;
      end if;
    end if;
    raise exception 'Una comanda pagada no se puede editar. Cancelala para devolver los Tokens al paciente.';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;

commit;
