-- Rainbows V3.26.58
-- Parámetros objetivo y mediciones históricas de Palestina por sala y cama.
-- Ejecutar completo en Supabase SQL Editor después de V3.26.57.

begin;

create table if not exists public.cultivo_parametros_objetivo (
  etapa text primary key,
  temperatura text,
  luz text,
  humedad_ambiente text,
  co2 text,
  humedad_sustrato text,
  ec text,
  ph text,
  n text,
  p text,
  k text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.perfiles(id) on delete set null,
  constraint cultivo_parametros_etapa_check
    check (etapa in ('vege','flora_1','flora_2','flora_3','flora_4','flora_5','flora_6','flora_7','flora_8'))
);

create table if not exists public.cultivo_mediciones (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  sala_id uuid not null references public.salas(id),
  sala_nombre text not null,
  cama_id uuid references public.camas(id),
  cama_numero integer,
  etapa text not null,
  temperatura numeric,
  luz numeric,
  humedad_ambiente numeric,
  co2 numeric,
  humedad_sustrato numeric,
  ec numeric,
  ph numeric,
  n numeric,
  p numeric,
  k numeric,
  observaciones text,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.perfiles(id),
  constraint cultivo_mediciones_etapa_check
    check (etapa in ('vege','flora_1','flora_2','flora_3','flora_4','flora_5','flora_6','flora_7','flora_8')),
  constraint cultivo_mediciones_temperatura_check check (temperatura is null or temperatura between -10 and 60),
  constraint cultivo_mediciones_luz_check check (luz is null or luz between 0 and 5000),
  constraint cultivo_mediciones_humedad_ambiente_check check (humedad_ambiente is null or humedad_ambiente between 0 and 100),
  constraint cultivo_mediciones_co2_check check (co2 is null or co2 between 0 and 10000),
  constraint cultivo_mediciones_humedad_sustrato_check check (humedad_sustrato is null or humedad_sustrato between 0 and 100),
  constraint cultivo_mediciones_ec_check check (ec is null or ec between 0 and 50),
  constraint cultivo_mediciones_ph_check check (ph is null or ph between 0 and 14),
  constraint cultivo_mediciones_n_check check (n is null or n between 0 and 100000),
  constraint cultivo_mediciones_p_check check (p is null or p between 0 and 100000),
  constraint cultivo_mediciones_k_check check (k is null or k between 0 and 100000)
);

create index if not exists cultivo_mediciones_fecha_idx
  on public.cultivo_mediciones(fecha desc);
create index if not exists cultivo_mediciones_sala_fecha_idx
  on public.cultivo_mediciones(sala_id,fecha desc);
create index if not exists cultivo_mediciones_cama_fecha_idx
  on public.cultivo_mediciones(cama_id,fecha desc)
  where cama_id is not null;

insert into public.cultivo_parametros_objetivo(etapa)
select etapa
from unnest(array['vege','flora_1','flora_2','flora_3','flora_4','flora_5','flora_6','flora_7','flora_8']) etapa
on conflict(etapa) do nothing;

alter table public.cultivo_parametros_objetivo enable row level security;
alter table public.cultivo_mediciones enable row level security;

drop policy if exists cultivo_parametros_select on public.cultivo_parametros_objetivo;
create policy cultivo_parametros_select
on public.cultivo_parametros_objetivo for select to authenticated
using (public.usuario_rainbows_activo());

drop policy if exists cultivo_parametros_manager_write on public.cultivo_parametros_objetivo;
create policy cultivo_parametros_manager_write
on public.cultivo_parametros_objetivo for all to authenticated
using (public.usuario_rainbows_palestina_gestion())
with check (public.usuario_rainbows_palestina_gestion());

drop policy if exists cultivo_mediciones_select on public.cultivo_mediciones;
create policy cultivo_mediciones_select
on public.cultivo_mediciones for select to authenticated
using (public.usuario_rainbows_activo());

-- Las escrituras se realizan únicamente mediante las RPC protegidas.
drop policy if exists cultivo_mediciones_direct_write on public.cultivo_mediciones;

create or replace function public.guardar_parametros_cultivo(
  p_etapa text,
  p_valores jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa text := lower(trim(coalesce(p_etapa,'')));
begin
  if not public.usuario_rainbows_palestina_gestion() then
    raise exception 'No tenés permiso para modificar los parámetros objetivo.';
  end if;
  if v_etapa not in ('vege','flora_1','flora_2','flora_3','flora_4','flora_5','flora_6','flora_7','flora_8') then
    raise exception 'La etapa no es válida.';
  end if;
  if jsonb_typeof(coalesce(p_valores,'{}'::jsonb)) <> 'object' then
    raise exception 'Los parámetros no son válidos.';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(p_valores,'{}'::jsonb)) item
    where length(item.value) > 80
  ) then
    raise exception 'Cada valor objetivo admite hasta 80 caracteres.';
  end if;

  insert into public.cultivo_parametros_objetivo(
    etapa,temperatura,luz,humedad_ambiente,co2,humedad_sustrato,ec,ph,n,p,k,updated_at,updated_by
  ) values (
    v_etapa,
    nullif(trim(p_valores->>'temperatura'),''),
    nullif(trim(p_valores->>'luz'),''),
    nullif(trim(p_valores->>'humedad_ambiente'),''),
    nullif(trim(p_valores->>'co2'),''),
    nullif(trim(p_valores->>'humedad_sustrato'),''),
    nullif(trim(p_valores->>'ec'),''),
    nullif(trim(p_valores->>'ph'),''),
    nullif(trim(p_valores->>'n'),''),
    nullif(trim(p_valores->>'p'),''),
    nullif(trim(p_valores->>'k'),''),
    now(),auth.uid()
  )
  on conflict(etapa) do update set
    temperatura=excluded.temperatura,
    luz=excluded.luz,
    humedad_ambiente=excluded.humedad_ambiente,
    co2=excluded.co2,
    humedad_sustrato=excluded.humedad_sustrato,
    ec=excluded.ec,
    ph=excluded.ph,
    n=excluded.n,
    p=excluded.p,
    k=excluded.k,
    updated_at=now(),
    updated_by=auth.uid();
end;
$$;

create or replace function public.registrar_medicion_cultivo(
  p_sala_id uuid,
  p_cama_id uuid,
  p_etapa text,
  p_fecha timestamptz,
  p_valores jsonb,
  p_observaciones text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_sala public.salas%rowtype;
  v_cama public.camas%rowtype;
  v_etapa text := lower(trim(coalesce(p_etapa,'')));
  v_temperatura numeric := nullif(p_valores->>'temperatura','')::numeric;
  v_luz numeric := nullif(p_valores->>'luz','')::numeric;
  v_humedad_ambiente numeric := nullif(p_valores->>'humedad_ambiente','')::numeric;
  v_co2 numeric := nullif(p_valores->>'co2','')::numeric;
  v_humedad_sustrato numeric := nullif(p_valores->>'humedad_sustrato','')::numeric;
  v_ec numeric := nullif(p_valores->>'ec','')::numeric;
  v_ph numeric := nullif(p_valores->>'ph','')::numeric;
  v_n numeric := nullif(p_valores->>'n','')::numeric;
  v_p numeric := nullif(p_valores->>'p','')::numeric;
  v_k numeric := nullif(p_valores->>'k','')::numeric;
begin
  if not public.usuario_rainbows_operativo() then
    raise exception 'No tenés permiso para registrar mediciones.';
  end if;
  if v_etapa not in ('vege','flora_1','flora_2','flora_3','flora_4','flora_5','flora_6','flora_7','flora_8') then
    raise exception 'La etapa no es válida.';
  end if;
  if p_fecha is null or p_fecha > now() + interval '5 minutes' then
    raise exception 'La fecha de la medición no es válida.';
  end if;
  if length(trim(coalesce(p_observaciones,''))) > 1000 then
    raise exception 'Las observaciones admiten hasta 1000 caracteres.';
  end if;
  if v_temperatura is null and v_luz is null and v_humedad_ambiente is null and v_co2 is null
     and v_humedad_sustrato is null and v_ec is null and v_ph is null
     and v_n is null and v_p is null and v_k is null then
    raise exception 'Ingresá al menos una medición.';
  end if;

  select * into v_sala from public.salas where id=p_sala_id and activa is true;
  if not found then raise exception 'La sala no existe o está inactiva.'; end if;

  if p_cama_id is not null then
    select * into v_cama from public.camas where id=p_cama_id and sala_id=p_sala_id;
    if not found then raise exception 'La cama no pertenece a la sala elegida.'; end if;
  end if;

  insert into public.cultivo_mediciones(
    fecha,sala_id,sala_nombre,cama_id,cama_numero,etapa,
    temperatura,luz,humedad_ambiente,co2,humedad_sustrato,ec,ph,n,p,k,
    observaciones,created_by
  ) values (
    p_fecha,v_sala.id,v_sala.nombre,p_cama_id,
    case when p_cama_id is null then null else v_cama.numero end,v_etapa,
    v_temperatura,v_luz,v_humedad_ambiente,v_co2,v_humedad_sustrato,v_ec,v_ph,v_n,v_p,v_k,
    nullif(trim(coalesce(p_observaciones,'')),''),auth.uid()
  ) returning id into v_id;

  return v_id;
exception
  when invalid_text_representation then
    raise exception 'Revisá los valores numéricos ingresados.';
end;
$$;

revoke all on table public.cultivo_parametros_objetivo from anon;
revoke all on table public.cultivo_mediciones from anon;
revoke insert,update,delete on table public.cultivo_mediciones from authenticated;
revoke execute on function public.guardar_parametros_cultivo(text,jsonb) from public,anon;
revoke execute on function public.registrar_medicion_cultivo(uuid,uuid,text,timestamptz,jsonb,text) from public,anon;
grant execute on function public.guardar_parametros_cultivo(text,jsonb) to authenticated;
grant execute on function public.registrar_medicion_cultivo(uuid,uuid,text,timestamptz,jsonb,text) to authenticated;

commit;
