-- Rainbows V3.26.56
-- Control físico seguro de Stock Medrano, con reservas e historial auditable.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.55.

begin;

create table if not exists public.medrano_stock_controles (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  observaciones text,
  productos_contados integer not null default 0 check (productos_contados>=0),
  productos_con_diferencia integer not null default 0 check (productos_con_diferencia>=0),
  productos_ajustados integer not null default 0 check (productos_ajustados>=0),
  productos_pendientes_revision integer not null default 0 check (productos_pendientes_revision>=0),
  creado_por uuid not null references auth.users(id),
  responsable_nombre text not null,
  created_at timestamptz not null default now()
);

alter table public.medrano_stock_controles
  add column if not exists productos_ajustados integer not null default 0,
  add column if not exists productos_pendientes_revision integer not null default 0;

create table if not exists public.medrano_stock_control_items (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.medrano_stock_controles(id) on delete restrict,
  sector text not null check (sector in ('dispensario','laboratorio')),
  categoria text not null,
  stock_id uuid not null,
  producto text not null,
  lote text,
  unidad text not null check (unidad in ('g','ml','unidades')),
  cantidad_sistema numeric not null check (cantidad_sistema>=0),
  cantidad_reservada numeric not null default 0 check (cantidad_reservada>=0),
  cantidad_disponible numeric not null default 0,
  cantidad_real numeric not null check (cantidad_real>=0),
  diferencia numeric not null,
  estado text not null default 'coincide',
  ajuste_aplicado boolean not null default false,
  created_at timestamptz not null default now(),
  unique(control_id,sector,categoria,stock_id)
);

alter table public.medrano_stock_control_items
  add column if not exists cantidad_reservada numeric not null default 0,
  add column if not exists cantidad_disponible numeric not null default 0,
  add column if not exists estado text not null default 'coincide',
  add column if not exists ajuste_aplicado boolean not null default false;

update public.medrano_stock_control_items
set cantidad_disponible=cantidad_sistema-cantidad_reservada,
    estado=case when diferencia=0 then 'coincide' else 'ajustado' end,
    ajuste_aplicado=(diferencia<>0)
where (estado='coincide' and diferencia<>0)
   or estado not in ('coincide','ajustado','requiere_revision')
   or cantidad_disponible is distinct from (cantidad_sistema-cantidad_reservada);

alter table public.medrano_stock_control_items
  drop constraint if exists medrano_stock_control_items_estado_check;
alter table public.medrano_stock_control_items
  add constraint medrano_stock_control_items_estado_check
  check (estado in ('coincide','ajustado','requiere_revision'));

create index if not exists medrano_stock_controles_fecha_idx
  on public.medrano_stock_controles(fecha desc,created_at desc);
create index if not exists medrano_stock_control_items_control_idx
  on public.medrano_stock_control_items(control_id,created_at);

alter table public.medrano_stock_controles enable row level security;
alter table public.medrano_stock_control_items enable row level security;

drop policy if exists medrano_stock_controles_select on public.medrano_stock_controles;
create policy medrano_stock_controles_select
on public.medrano_stock_controles for select to authenticated
using (public.usuario_rainbows_admin());

drop policy if exists medrano_stock_control_items_select on public.medrano_stock_control_items;
create policy medrano_stock_control_items_select
on public.medrano_stock_control_items for select to authenticated
using (public.usuario_rainbows_admin());

revoke all on public.medrano_stock_controles,public.medrano_stock_control_items
from public,anon,authenticated;
grant select on public.medrano_stock_controles,public.medrano_stock_control_items
to authenticated;

drop function if exists public.registrar_control_stock_medrano(jsonb,text);
create function public.registrar_control_stock_medrano(
  p_items jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_control_id uuid:=gen_random_uuid();
  v_item jsonb;
  v_sector text;
  v_categoria text;
  v_stock_id uuid;
  v_real numeric;
  v_sistema numeric;
  v_reservado_comandas numeric:=0;
  v_reservado_produccion numeric:=0;
  v_reservado numeric:=0;
  v_disponible numeric:=0;
  v_producto text;
  v_lote text;
  v_unidad text;
  v_diferencia numeric;
  v_estado text;
  v_ajuste boolean;
  v_contados integer:=0;
  v_diferencias integer:=0;
  v_ajustados integer:=0;
  v_pendientes integer:=0;
  v_responsable text;
  v_notas text:=nullif(btrim(coalesce(p_observaciones,'')),'');
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solamente Administración puede registrar controles físicos de stock.';
  end if;
  if p_items is null or jsonb_typeof(p_items)<>'array'
     or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>500 then
    raise exception 'El control debe incluir entre 1 y 500 productos contados.';
  end if;
  if v_notas is not null and length(v_notas)>1000 then
    raise exception 'Las observaciones no pueden superar los 1000 caracteres.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rainbows-control-fisico-stock',0));
  select coalesce(nullif(btrim(nombre),''),email,'Administración')
    into v_responsable
  from public.perfiles
  where id=auth.uid() and activo is true and lower(btrim(rol))='administrador';
  if v_responsable is null then
    raise exception 'No se encontró un perfil Administrador activo.';
  end if;

  insert into public.medrano_stock_controles(
    id,observaciones,creado_por,responsable_nombre
  ) values(v_control_id,v_notas,auth.uid(),v_responsable);

  insert into public.medrano_operaciones(id,tipo,referencia_id,estado,detalle,creado_por)
  values(v_control_id,'ajuste',v_control_id,'registrada','Control físico de stock',auth.uid());

  for v_item in
    select value from jsonb_array_elements(p_items)
    order by value->>'sector',value->>'categoria',value->>'stock_id'
  loop
    begin
      v_sector:=nullif(btrim(v_item->>'sector'),'');
      v_categoria:=nullif(btrim(v_item->>'categoria'),'');
      v_stock_id:=nullif(v_item->>'stock_id','')::uuid;
      v_real:=nullif(v_item->>'cantidad_real','')::numeric;
    exception when others then
      raise exception 'Hay un producto con datos inválidos en el control.';
    end;
    if v_stock_id is null or v_real is null or v_real<0
       or v_real::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Las cantidades contadas deben ser números válidos mayores o iguales a cero.';
    end if;

    if v_sector='dispensario' and v_categoria='flores' then
      select l.gramos_actual,
             coalesce(nullif(btrim(g.nombre),''),nullif(btrim(l.nombre_historico),''),'Flores'),
             l.codigo_lote,'g'
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_dispensario_lotes l
      left join public.geneticas g on g.id=l.genetica_id
      where l.id=v_stock_id
      for update of l;
    elsif v_sector='dispensario' and v_categoria='mostrador' then
      select cantidad,nombre,null::text,'unidades'
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_mostrador_productos
      where id=v_stock_id and activo
      for update;
    elsif v_sector='laboratorio'
          and v_categoria in ('flores','resina','aceites','cremas','capsulas','insumos') then
      select s.cantidad,
             concat_ws(' · ',s.nombre,nullif(btrim(s.perfil_cannabinoide),''),
               case when nullif(btrim(s.proporcion_cannabinoides),'') is not null
                    then 'Ratio '||replace(btrim(s.proporcion_cannabinoides),'-',':') end,
               case when nullif(btrim(g.nombre),'') is not null then 'Genética '||btrim(g.nombre) end),
             s.lote,s.unidad
        into v_sistema,v_producto,v_lote,v_unidad
      from public.medrano_laboratorio_stock s
      left join public.geneticas g on g.id=s.genetica_id
      where s.id=v_stock_id and s.categoria=v_categoria and s.activo
      for update of s;
    else
      raise exception 'El sector o la categoría del control no son válidos.';
    end if;

    if not found then
      raise exception 'Uno de los productos ya no existe o cambió de categoría. Actualizá la pantalla y volvé a contar.';
    end if;
    if v_unidad='unidades' and v_real<>trunc(v_real) then
      raise exception 'El conteo de “%” debe expresarse en unidades enteras.',v_producto;
    end if;

    select coalesce(sum(i.cantidad),0)
      into v_reservado_comandas
    from public.medrano_comandas_multiproducto_items i
    join public.medrano_comandas_multiproducto c on c.id=i.comanda_id
    where c.estado='pendiente' and c.eliminada_at is null
      and i.tipo=v_categoria and i.origen_id=v_stock_id;

    if v_sector='laboratorio' then
      select coalesce(sum(m.cantidad),0)
        into v_reservado_produccion
      from public.medrano_laboratorio_trabajos_materiales m
      join public.medrano_laboratorio_trabajos t on t.id=m.trabajo_id
      where m.stock_id=v_stock_id and m.categoria=v_categoria
        and t.produccion_controlada and t.estado='en_proceso';
    else
      v_reservado_produccion:=0;
    end if;

    v_reservado:=coalesce(v_reservado_comandas,0)+coalesce(v_reservado_produccion,0);
    v_disponible:=v_sistema-v_reservado;
    v_diferencia:=v_real-v_sistema;
    if v_diferencia<>0 and (v_notas is null or length(v_notas)<5) then
      raise exception 'Explicá en Observaciones el motivo de las diferencias (al menos 5 caracteres).';
    end if;

    v_ajuste:=false;
    if v_diferencia=0 then
      v_estado:='coincide';
    elsif v_real<v_reservado then
      v_estado:='requiere_revision';
      v_pendientes:=v_pendientes+1;
    else
      v_estado:='ajustado';
      v_ajuste:=true;
      v_ajustados:=v_ajustados+1;
    end if;

    insert into public.medrano_stock_control_items(
      control_id,sector,categoria,stock_id,producto,lote,unidad,
      cantidad_sistema,cantidad_reservada,cantidad_disponible,cantidad_real,
      diferencia,estado,ajuste_aplicado
    ) values(
      v_control_id,v_sector,v_categoria,v_stock_id,v_producto,v_lote,v_unidad,
      v_sistema,v_reservado,v_disponible,v_real,v_diferencia,v_estado,v_ajuste
    );
    v_contados:=v_contados+1;
    if v_diferencia<>0 then v_diferencias:=v_diferencias+1; end if;

    if v_ajuste then
      perform set_config('rainbows.operacion_id',v_control_id::text,true);
      perform set_config('rainbows.operacion_tipo','ajuste',true);
      perform set_config('rainbows.referencia_id',v_control_id::text,true);
      perform set_config(
        'rainbows.stock_accion',
        'Control físico de stock · '||v_producto||
        case when nullif(btrim(coalesce(v_lote,'')),'') is not null then ' · Lote '||v_lote else '' end||
        ' · sistema '||v_sistema||' '||v_unidad||
        ' · contado '||v_real||' '||v_unidad||
        ' · Motivo: '||v_notas,
        true
      );
      if v_sector='dispensario' and v_categoria='flores' then
        update public.medrano_dispensario_lotes set gramos_actual=v_real where id=v_stock_id;
      elsif v_sector='dispensario' and v_categoria='mostrador' then
        update public.medrano_mostrador_productos set cantidad=v_real,updated_at=now() where id=v_stock_id;
      else
        update public.medrano_laboratorio_stock set cantidad=v_real,updated_at=now() where id=v_stock_id;
      end if;
    end if;
  end loop;

  update public.medrano_stock_controles
  set productos_contados=v_contados,
      productos_con_diferencia=v_diferencias,
      productos_ajustados=v_ajustados,
      productos_pendientes_revision=v_pendientes
  where id=v_control_id;

  update public.medrano_operaciones
  set detalle='Control físico de stock · '||v_contados||' contados · '||
      v_diferencias||' diferencias · '||v_ajustados||' ajustados · '||
      v_pendientes||' pendientes de revisión',updated_at=now()
  where id=v_control_id;

  perform set_config('rainbows.stock_accion','',true);
  perform set_config('rainbows.operacion_id','',true);
  perform set_config('rainbows.operacion_tipo','',true);
  perform set_config('rainbows.referencia_id','',true);

  return jsonb_build_object(
    'control_id',v_control_id,
    'productos_contados',v_contados,
    'productos_con_diferencia',v_diferencias,
    'productos_ajustados',v_ajustados,
    'productos_pendientes_revision',v_pendientes
  );
end;
$$;

revoke all on function public.registrar_control_stock_medrano(jsonb,text)
from public,anon,authenticated;
grant execute on function public.registrar_control_stock_medrano(jsonb,text)
to authenticated;

commit;
