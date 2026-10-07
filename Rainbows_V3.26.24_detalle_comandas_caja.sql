-- Rainbows V3.26.24
-- Detalle de productos en los movimientos de Caja originados por comandas.
-- No requiere instalar la V3.26.23 de Control de stock que quedó en pausa.
-- Ejecutar completo en Supabase SQL Editor antes de subir la aplicación.

begin;

alter table public.medrano_caja_movimientos
  add column if not exists detalle text;

create or replace function public.detalle_comanda_caja(p_comanda_id uuid)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select string_agg(
    concat_ws(
      ' · ',
      case i.tipo
        when 'flores' then 'Flores'
        when 'resina' then 'Resina'
        when 'aceites' then 'Aceite'
        when 'cremas' then 'Crema'
        when 'capsulas' then 'Cápsulas'
        when 'mostrador' then 'Mostrador'
        else initcap(i.tipo)
      end||': '||
      case
        when i.cantidad=trunc(i.cantidad) then trunc(i.cantidad)::text
        else trim(trailing '0' from i.cantidad::text)
      end||' '||i.unidad,
      nullif(btrim(i.nombre),''),
      case when nullif(btrim(i.genetica_nombre),'') is not null
           then 'Genética '||btrim(i.genetica_nombre) end,
      case when nullif(btrim(i.numero_lote),'') is not null
           then 'Lote '||btrim(i.numero_lote) end
    ),
    E'\n' order by i.tipo,i.nombre,i.id
  )
  from public.medrano_comandas_multiproducto_items i
  where i.comanda_id=p_comanda_id;
$$;

-- Completa los cobros ya existentes, incluida la comanda histórica que motivó
-- este cambio, sin modificar montos, Tokens ni saldos de Caja.
update public.medrano_caja_movimientos m
set detalle=public.detalle_comanda_caja(m.comanda_id)
where m.origen='comanda'
  and m.comanda_id is not null
  and nullif(btrim(coalesce(m.detalle,'')),'') is null;

create or replace function public.pagar_comanda_multiproducto(
  p_id uuid,
  p_medio text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_c public.medrano_comandas_multiproducto;
  v_saldo numeric;
  v_faltan numeric;
  v_detalle text;
begin
  if not public.usuario_rainbows_medrano() then
    raise exception 'Sin permiso.';
  end if;
  select * into v_c
  from public.medrano_comandas_multiproducto
  where id=p_id
  for update;
  if not found or v_c.estado<>'pendiente' then
    raise exception 'La comanda no está pendiente.';
  end if;
  if v_c.pago_estado='pagada' then return; end if;
  if v_c.tokens_total<=0 then
    raise exception 'La comanda no tiene un total válido de Tokens. Editala después de configurar los valores.';
  end if;

  v_detalle:=public.detalle_comanda_caja(v_c.id);
  if nullif(btrim(coalesce(v_detalle,'')),'') is null then
    raise exception 'La comanda no tiene productos para registrar en Caja.';
  end if;

  select saldo_tokens into v_saldo
  from public.medrano_pacientes
  where id=v_c.paciente_id
  for update;
  v_faltan:=greatest(v_c.tokens_total-v_saldo,0);
  if v_faltan>0 and p_medio not in ('efectivo','digital') then
    raise exception 'Seleccioná efectivo o digital para cobrar los Tokens faltantes.';
  end if;

  if v_faltan>0 then
    insert into public.medrano_caja_movimientos(
      tipo,medio,monto,concepto,detalle,tokens,paciente_id,comanda_id,origen,creado_por
    ) values(
      'ingreso',p_medio,v_faltan*1000,
      'Cobro de comanda · '||v_c.paciente_nombre,v_detalle,
      v_faltan,v_c.paciente_id,v_c.id,'comanda',auth.uid()
    );
    insert into public.medrano_tokens_movimientos(
      paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por
    ) values(
      v_c.paciente_id,v_c.id,'acreditacion',v_faltan,v_saldo,v_saldo+v_faltan,
      'Tokens acreditados al cobrar la comanda',auth.uid()
    );
    v_saldo:=v_saldo+v_faltan;
  end if;

  update public.medrano_pacientes
  set saldo_tokens=v_saldo-v_c.tokens_total,updated_at=now()
  where id=v_c.paciente_id;
  insert into public.medrano_tokens_movimientos(
    paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por
  ) values(
    v_c.paciente_id,v_c.id,'consumo',-v_c.tokens_total,v_saldo,v_saldo-v_c.tokens_total,
    'Pago de comanda',auth.uid()
  );
  update public.medrano_comandas_multiproducto
  set pago_estado='pagada',pagada_at=now(),pagada_por=auth.uid(),
      medio_pago=case when v_faltan>0 then p_medio else 'saldo' end,updated_at=now()
  where id=p_id;
end;
$$;

revoke all on function public.detalle_comanda_caja(uuid) from public,anon,authenticated;
revoke all on function public.pagar_comanda_multiproducto(uuid,text) from public,anon;
grant execute on function public.pagar_comanda_multiproducto(uuid,text) to authenticated;

commit;
