-- Comandas de pacientes y trabajos de producción del Laboratorio de Medrano.
begin;
create table if not exists public.medrano_laboratorio_trabajos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('comanda_paciente','aceite_base','crema','resina','otra_produccion')),
  producto text not null check (length(btrim(producto)) between 1 and 180),
  paciente text,
  cantidad numeric check (cantidad is null or cantidad > 0),
  unidad text check (unidad is null or unidad in ('g','ml','unidades')),
  detalle text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','finalizado','cancelado')),
  creado_por uuid not null references auth.users(id),
  actualizado_por uuid references auth.users(id),
  finalizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizado_at timestamptz,
  constraint lab_trabajo_cantidad_unidad check ((cantidad is null)=(unidad is null)),
  constraint lab_trabajo_paciente check (tipo <> 'comanda_paciente' or nullif(btrim(paciente),'') is not null),
  constraint lab_trabajo_finalizado check ((estado='finalizado')=(finalizado_at is not null))
);
create index if not exists medrano_lab_trabajos_estado_idx on public.medrano_laboratorio_trabajos(estado,created_at desc);
create index if not exists medrano_lab_trabajos_finalizado_idx on public.medrano_laboratorio_trabajos(finalizado_at desc);

create table if not exists public.medrano_laboratorio_trabajos_eventos (
  id uuid primary key default gen_random_uuid(),
  trabajo_id uuid not null references public.medrano_laboratorio_trabajos(id),
  accion text not null check (accion in ('creado','editado','estado')),
  estado_anterior text,
  estado_nuevo text not null,
  usuario_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists medrano_lab_trabajos_eventos_idx on public.medrano_laboratorio_trabajos_eventos(trabajo_id,created_at desc);
alter table public.medrano_laboratorio_trabajos enable row level security;
alter table public.medrano_laboratorio_trabajos_eventos enable row level security;
drop policy if exists medrano_lab_trabajos_select on public.medrano_laboratorio_trabajos;
create policy medrano_lab_trabajos_select on public.medrano_laboratorio_trabajos
  for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists medrano_lab_trabajos_eventos_select on public.medrano_laboratorio_trabajos_eventos;
create policy medrano_lab_trabajos_eventos_select on public.medrano_laboratorio_trabajos_eventos
  for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_laboratorio_trabajos, public.medrano_laboratorio_trabajos_eventos from public,anon,authenticated;
grant select on public.medrano_laboratorio_trabajos, public.medrano_laboratorio_trabajos_eventos to authenticated;

create or replace function public.guardar_trabajo_laboratorio(
  p_id uuid,p_tipo text,p_producto text,p_paciente text,p_cantidad numeric,p_unidad text,p_detalle text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_estado text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para registrar trabajos.'; end if;
  if p_tipo is null or p_tipo not in ('comanda_paciente','aceite_base','crema','resina','otra_produccion')
     or nullif(btrim(p_producto),'') is null or length(btrim(p_producto)) > 180
     or length(coalesce(p_detalle,'')) > 2000
     or (p_tipo='comanda_paciente' and nullif(btrim(p_paciente),'') is null)
     or length(coalesce(p_paciente,'')) > 180
     or (p_cantidad is null) <> (p_unidad is null)
     or (p_cantidad is not null and (p_cantidad <= 0 or p_cantidad::text in ('NaN','Infinity','-Infinity')))
     or (p_unidad is not null and p_unidad not in ('g','ml','unidades'))
     or (p_unidad='unidades' and p_cantidad<>trunc(p_cantidad)) then
    raise exception 'Revisá tipo, producto, paciente y cantidad.';
  end if;
  if p_id is null then
    insert into public.medrano_laboratorio_trabajos(tipo,producto,paciente,cantidad,unidad,detalle,creado_por)
    values(p_tipo,btrim(p_producto),nullif(btrim(p_paciente),''),p_cantidad,p_unidad,btrim(coalesce(p_detalle,'')),auth.uid()) returning id into v_id;
    insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_nuevo,usuario_id)
    values(v_id,'creado','pendiente',auth.uid());
  else
    select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id for update;
    if not found then raise exception 'No se encontró el trabajo.'; end if;
    if v_estado in ('finalizado','cancelado') then raise exception 'Reabrí el trabajo antes de editarlo.'; end if;
    update public.medrano_laboratorio_trabajos set tipo=p_tipo,producto=btrim(p_producto),paciente=nullif(btrim(p_paciente),''),
      cantidad=p_cantidad,unidad=p_unidad,detalle=btrim(coalesce(p_detalle,'')),actualizado_por=auth.uid(),updated_at=now()
    where id=p_id;
    insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
    values(p_id,'editado',v_estado,v_estado,auth.uid());
    v_id:=p_id;
  end if;
  return v_id;
end; $$;

create or replace function public.cambiar_estado_trabajo_laboratorio(p_id uuid,p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  if not public.usuario_rainbows_medrano() then raise exception 'No tenés permiso para actualizar trabajos.'; end if;
  if p_estado is null or p_estado not in ('pendiente','en_proceso','finalizado','cancelado') then
    raise exception 'Estado inválido.';
  end if;
  select estado into v_estado from public.medrano_laboratorio_trabajos where id=p_id for update;
  if not found then raise exception 'No se encontró el trabajo.'; end if;
  if v_estado=p_estado then return; end if;
  update public.medrano_laboratorio_trabajos set estado=p_estado,actualizado_por=auth.uid(),updated_at=now(),
    finalizado_por=case when p_estado='finalizado' then auth.uid() else null end,
    finalizado_at=case when p_estado='finalizado' then now() else null end
  where id=p_id;
  insert into public.medrano_laboratorio_trabajos_eventos(trabajo_id,accion,estado_anterior,estado_nuevo,usuario_id)
  values(p_id,'estado',v_estado,p_estado,auth.uid());
end; $$;
revoke all on function public.guardar_trabajo_laboratorio(uuid,text,text,text,numeric,text,text),
  public.cambiar_estado_trabajo_laboratorio(uuid,text) from public,anon;
grant execute on function public.guardar_trabajo_laboratorio(uuid,text,text,text,numeric,text,text),
  public.cambiar_estado_trabajo_laboratorio(uuid,text) to authenticated;
commit;
