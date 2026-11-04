begin;
alter table public.cultivo_mediciones add column if not exists updated_at timestamptz;
alter table public.cultivo_mediciones add column if not exists updated_by uuid references public.perfiles(id) on delete set null;

create or replace function public.editar_medicion_cultivo(
  p_id uuid,
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
  v_original public.cultivo_mediciones%rowtype;
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
  select * into v_original from public.cultivo_mediciones where id=p_id for update;
  if not found then raise exception 'La medición ya no existe.'; end if;
  if not public.usuario_rainbows_palestina_gestion() and v_original.created_by is distinct from auth.uid() then
    raise exception 'Solo podés corregir tus propias mediciones.';
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

  update public.cultivo_mediciones set
    fecha=p_fecha,sala_id=v_sala.id,sala_nombre=v_sala.nombre,cama_id=p_cama_id,
    cama_numero=case when p_cama_id is null then null else v_cama.numero end,etapa=v_etapa,
    temperatura=v_temperatura,luz=v_luz,humedad_ambiente=v_humedad_ambiente,co2=v_co2,
    humedad_sustrato=v_humedad_sustrato,ec=v_ec,ph=v_ph,n=v_n,p=v_p,k=v_k,
    observaciones=nullif(trim(coalesce(p_observaciones,'')),''),
    updated_at=now(),updated_by=auth.uid()
  where id=p_id returning id into v_id;

  return v_id;
exception
  when invalid_text_representation then
    raise exception 'Revisá los valores numéricos ingresados.';
end;
$$;

create or replace function public.eliminar_medicion_cultivo(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_original public.cultivo_mediciones%rowtype;
begin
  if not public.usuario_rainbows_operativo() then
    raise exception 'Sin permiso para eliminar mediciones.';
  end if;
  select * into v_original from public.cultivo_mediciones where id=p_id for update;
  if not found then raise exception 'La medición ya no existe.'; end if;
  if not public.usuario_rainbows_palestina_gestion() and v_original.created_by is distinct from auth.uid() then
    raise exception 'Solo podés eliminar tus propias mediciones.';
  end if;
  delete from public.cultivo_mediciones where id=p_id;
end;
$$;
revoke execute on function public.editar_medicion_cultivo(uuid,uuid,uuid,text,timestamptz,jsonb,text) from public,anon;
revoke execute on function public.eliminar_medicion_cultivo(uuid) from public,anon;
grant execute on function public.editar_medicion_cultivo(uuid,uuid,uuid,text,timestamptz,jsonb,text) to authenticated;
grant execute on function public.eliminar_medicion_cultivo(uuid) to authenticated;
commit;
