-- Rainbows V3.25.11: conserva en el historial el detalle completo de cada movimiento de Resina.
-- Requiere V3.25.9. No modifica cantidades ni vuelve a ejecutar producciones.
begin;

alter table public.medrano_stock_historial
  add column if not exists detalle text;

create or replace function public.registrar_movimiento_stock_medrano()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_sector text; v_categoria text; v_producto text; v_unidad text;
  v_anterior numeric; v_nueva numeric; v_nombre text; v_accion text;
  v_detalle text; v_genetica text;
begin
  if tg_table_name = 'medrano_dispensario_lotes' then
    v_sector := 'dispensario'; v_categoria := 'flores'; v_unidad := 'g';
    v_producto := coalesce(v_new->>'nombre_historico','Flores');
    v_anterior := coalesce((v_old->>'gramos_actual')::numeric,0);
    v_nueva := coalesce((v_new->>'gramos_actual')::numeric,0);
  else
    v_sector := case when tg_table_name = 'medrano_mostrador_productos' then 'dispensario' else 'laboratorio' end;
    v_categoria := coalesce(v_new->>'categoria','mostrador');
    v_unidad := coalesce(v_new->>'unidad','unidades');
    v_producto := v_new->>'nombre';
    v_anterior := coalesce((v_old->>'cantidad')::numeric,0);
    v_nueva := coalesce((v_new->>'cantidad')::numeric,0);
  end if;

  v_accion := case
    when tg_op = 'INSERT' then 'Ingreso'
    when v_new->>'activo' = 'false' and v_old->>'activo' is distinct from 'false' then 'Producto retirado de la lista'
    when v_old->>'activo' = 'false' and v_new->>'activo' = 'true' then 'Producto reactivado'
    else 'Ajuste de stock'
  end;
  if tg_op = 'UPDATE' and v_anterior = v_nueva and v_old->>'activo' is not distinct from v_new->>'activo' then return new; end if;

  if v_sector = 'laboratorio' and v_categoria = 'resina' then
    select g.nombre into v_genetica
    from public.geneticas g
    where g.id = nullif(v_new->>'genetica_id','')::uuid;
    v_detalle := concat_ws(' · ',
      nullif(v_producto,''),
      nullif(v_new->>'perfil_cannabinoide',''),
      case when nullif(btrim(v_new->>'proporcion_cannabinoides'),'') is not null
        then 'Ratio '||replace(btrim(v_new->>'proporcion_cannabinoides'),'-',':') end,
      case when nullif(btrim(v_genetica),'') is not null then 'Genética '||btrim(v_genetica) end,
      case when nullif(btrim(v_new->>'lote'),'') is not null then 'Lote '||btrim(v_new->>'lote') end
    );
  end if;

  select coalesce(nullif(btrim(nombre),''),email) into v_nombre
  from public.perfiles where id = auth.uid();
  insert into public.medrano_stock_historial(
    sector,categoria,producto,lote,cantidad_anterior,cantidad_nueva,unidad,accion,detalle,usuario_id,usuario_nombre
  ) values (
    v_sector,v_categoria,v_producto,coalesce(v_new->>'codigo_lote',v_new->>'lote'),v_anterior,v_nueva,v_unidad,
    coalesce(nullif(current_setting('rainbows.stock_accion',true),''),v_accion),v_detalle,auth.uid(),coalesce(v_nombre,'Sistema')
  );
  return new;
end; $$;

-- Completa también los movimientos históricos cuando todavía existe el registro de stock relacionado.
update public.medrano_stock_historial h
set detalle = (
  select concat_ws(' · ',
    nullif(s.nombre,''),
    nullif(s.perfil_cannabinoide,''),
    case when nullif(btrim(s.proporcion_cannabinoides),'') is not null
      then 'Ratio '||replace(btrim(s.proporcion_cannabinoides),'-',':') end,
    case when nullif(btrim(g.nombre),'') is not null then 'Genética '||btrim(g.nombre) end,
    case when nullif(btrim(s.lote),'') is not null then 'Lote '||btrim(s.lote) end
  )
  from public.medrano_laboratorio_stock s
  left join public.geneticas g on g.id = s.genetica_id
  where s.categoria = 'resina'
    and s.nombre = h.producto
    and s.lote is not distinct from h.lote
  order by s.created_at desc
  limit 1
)
where h.sector = 'laboratorio'
  and h.categoria = 'resina'
  and nullif(btrim(h.detalle),'') is null
  and exists (
    select 1 from public.medrano_laboratorio_stock s
    where s.categoria = 'resina'
      and s.nombre = h.producto
      and s.lote is not distinct from h.lote
  );

commit;
