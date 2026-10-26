-- Rainbows V3.26.48
-- Guarda cosecha, detalle por genética y Stock Palestina en una sola transacción.
-- La clave de idempotencia evita que un doble clic o un reintento de red duplique la cosecha.

begin;

create table if not exists public.cosecha_operaciones (
  idempotency_key uuid primary key,
  cosecha_id uuid references public.cosechas(id) on delete set null,
  payload_hash text not null,
  stock_sincronizado boolean not null default true,
  creado_por uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.cosecha_operaciones
  add column if not exists stock_sincronizado boolean not null default true;

alter table public.cosecha_operaciones enable row level security;
revoke all on table public.cosecha_operaciones from public, anon, authenticated;

-- Si no quedan duplicados históricos, la base también impide escrituras directas
-- repetidas por sala y ciclo. Si los hubiera, la RPC igualmente queda protegida
-- por bloqueo transaccional y la migración puede volver a ejecutarse al corregirlos.
do $$
begin
  if not exists (
    select 1
    from public.cosechas
    group by sala,ciclo
    having count(*) > 1
  ) and to_regclass('public.cosechas_sala_ciclo_uidx') is null then
    execute 'create unique index cosechas_sala_ciclo_uidx on public.cosechas(sala,ciclo)';
  else
    if exists (
      select 1
      from public.cosechas
      group by sala,ciclo
      having count(*) > 1
    ) then
      raise warning 'Hay cosechas históricas duplicadas. La RPC queda protegida, pero el índice único se creará al volver a ejecutar esta migración después de corregirlas.';
    end if;
  end if;
end;
$$;

create or replace function public.guardar_cosecha_completa(
  p_cosecha_id uuid,
  p_idempotency_key uuid,
  p_fecha date,
  p_sala text,
  p_ciclo integer,
  p_meta_gramos numeric,
  p_total_gramos numeric,
  p_cantidad_plantas integer,
  p_observaciones text,
  p_origen text,
  p_detalles jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cosecha_id uuid;
  v_operacion public.cosecha_operaciones%rowtype;
  v_payload_hash text;
  v_detalle jsonb;
  v_detalle_id uuid;
  v_genetica_id uuid;
  v_nombre text;
  v_tamano text;
  v_gramos numeric;
  v_total numeric := 0;
  v_stock_sincronizado boolean := false;
begin
  if not public.usuario_rainbows_admin() then
    raise exception 'Solo un administrador puede guardar cosechas.';
  end if;
  if p_idempotency_key is null then
    raise exception 'Falta la clave de seguridad del guardado. Cerrá el formulario y volvé a abrirlo.';
  end if;
  if p_fecha is null or p_sala not in ('Flora 1','Flora 2','Flora 3') or coalesce(p_ciclo,0) <= 0 then
    raise exception 'Completá fecha, sala y ciclo.';
  end if;
  if p_meta_gramos is not null and p_meta_gramos < 0 then
    raise exception 'La meta no puede ser negativa.';
  end if;
  if p_cantidad_plantas is not null and p_cantidad_plantas < 0 then
    raise exception 'La cantidad de plantas no puede ser negativa.';
  end if;
  if jsonb_typeof(coalesce(p_detalles,'[]'::jsonb)) <> 'array' then
    raise exception 'El detalle de la cosecha no es válido.';
  end if;
  if p_cosecha_id is null and jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) = 0 then
    raise exception 'Agregá al menos una genética con su peso y tamaño.';
  end if;

  v_payload_hash := md5(jsonb_build_object(
    'cosecha_id',p_cosecha_id,'fecha',p_fecha,'sala',p_sala,'ciclo',p_ciclo,
    'meta',p_meta_gramos,'total',p_total_gramos,'plantas',p_cantidad_plantas,
    'observaciones',p_observaciones,'origen',p_origen,'detalles',coalesce(p_detalles,'[]'::jsonb)
  )::text);

  perform pg_advisory_xact_lock(hashtextextended('rainbows-cosecha-op-'||p_idempotency_key::text,0));

  select * into v_operacion
  from public.cosecha_operaciones
  where idempotency_key = p_idempotency_key;
  if found then
    if v_operacion.payload_hash is distinct from v_payload_hash then
      raise exception 'La solicitud de guardado ya fue utilizada con otros datos. Cerrá el formulario y volvé a abrirlo.';
    end if;
    return jsonb_build_object('cosecha_id',v_operacion.cosecha_id,'reutilizada',true,'stock_sincronizado',v_operacion.stock_sincronizado);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rainbows-cosecha-'||p_sala||'-'||p_ciclo::text,0));

  if p_cosecha_id is null then
    if exists(select 1 from public.cosechas where sala=p_sala and ciclo=p_ciclo) then
      raise exception 'Ya existe una cosecha de % · Ciclo %. Abrila para editarla en lugar de crear otra.',p_sala,p_ciclo;
    end if;
    insert into public.cosechas(
      fecha,sala,ciclo,meta_gramos,total_gramos,cantidad_plantas,observaciones,origen
    ) values (
      p_fecha,p_sala,p_ciclo,p_meta_gramos,coalesce(p_total_gramos,0),p_cantidad_plantas,
      nullif(btrim(coalesce(p_observaciones,'')),''),coalesce(nullif(btrim(p_origen),''),'app')
    ) returning id into v_cosecha_id;
  else
    select id into v_cosecha_id
    from public.cosechas
    where id=p_cosecha_id
    for update;
    if not found then raise exception 'La cosecha que intentás editar ya no existe.'; end if;
    if exists(select 1 from public.cosechas where sala=p_sala and ciclo=p_ciclo and id<>p_cosecha_id) then
      raise exception 'Ya existe otra cosecha de % · Ciclo %.',p_sala,p_ciclo;
    end if;
    update public.cosechas
    set fecha=p_fecha,sala=p_sala,ciclo=p_ciclo,meta_gramos=p_meta_gramos,
        total_gramos=coalesce(p_total_gramos,0),cantidad_plantas=p_cantidad_plantas,
        observaciones=nullif(btrim(coalesce(p_observaciones,'')),''),
        origen=coalesce(nullif(btrim(p_origen),''),origen),updated_at=now()
    where id=v_cosecha_id;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
    where coalesce((d->>'gramos')::numeric,0) <= 0
       or d->>'tamano' not in ('grande','mediano','chico')
       or nullif(btrim(coalesce(d->>'nombre_historico','')),'') is null
  ) then
    raise exception 'Cada genética debe tener nombre, tamaño y gramos mayores a cero.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
    where nullif(d->>'genetica_id','') is not null
    group by d->>'genetica_id'
    having count(*) > 1
  ) then
    raise exception 'Una genética está repetida. Unificá sus pesadas antes de guardar.';
  end if;

  delete from public.cosecha_geneticas cg
  where cg.cosecha_id=v_cosecha_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb)) d
      where nullif(d->>'id','')::uuid=cg.id
    );

  for v_detalle in select value from jsonb_array_elements(coalesce(p_detalles,'[]'::jsonb))
  loop
    v_detalle_id:=nullif(v_detalle->>'id','')::uuid;
    v_genetica_id:=nullif(v_detalle->>'genetica_id','')::uuid;
    v_nombre:=btrim(v_detalle->>'nombre_historico');
    v_tamano:=v_detalle->>'tamano';
    v_gramos:=(v_detalle->>'gramos')::numeric;
    v_total:=v_total+v_gramos;

    if v_detalle_id is null then
      insert into public.cosecha_geneticas(
        cosecha_id,genetica_id,nombre_historico,tamano,gramos
      ) values (
        v_cosecha_id,v_genetica_id,v_nombre,v_tamano,v_gramos
      );
    else
      update public.cosecha_geneticas
      set genetica_id=v_genetica_id,nombre_historico=v_nombre,tamano=v_tamano,gramos=v_gramos
      where id=v_detalle_id and cosecha_id=v_cosecha_id;
      if not found then raise exception 'Uno de los detalles de la cosecha cambió o ya no existe.'; end if;
    end if;
  end loop;

  if jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) > 0 then
    update public.cosechas set total_gramos=round(v_total,2),updated_at=now() where id=v_cosecha_id;
  end if;

  -- La función histórica de sincronización se ejecuta dentro de esta misma
  -- transacción. Si falla, también se revierten cosecha y genéticas. Las
  -- cosechas históricas sin desglose y nunca vinculadas siguen siendo editables.
  if jsonb_array_length(coalesce(p_detalles,'[]'::jsonb)) > 0
     or exists(select 1 from public.stock_ciclos where cosecha_id=v_cosecha_id) then
    perform public.sincronizar_cosecha_stock(v_cosecha_id);
    v_stock_sincronizado:=true;
  end if;

  insert into public.cosecha_operaciones(idempotency_key,cosecha_id,payload_hash,stock_sincronizado)
  values(p_idempotency_key,v_cosecha_id,v_payload_hash,v_stock_sincronizado);

  return jsonb_build_object('cosecha_id',v_cosecha_id,'reutilizada',false,'stock_sincronizado',v_stock_sincronizado);
end;
$$;

revoke all on function public.guardar_cosecha_completa(uuid,uuid,date,text,integer,numeric,numeric,integer,text,text,jsonb) from public,anon;
grant execute on function public.guardar_cosecha_completa(uuid,uuid,date,text,integer,numeric,numeric,integer,text,text,jsonb) to authenticated;

commit;
