\set ON_ERROR_STOP on
-- Completa únicamente el esquema mínimo de pruebas.
alter table public.medrano_dispensario_lotes
  add column gramos_actual numeric not null default 0,
  add column codigo_lote text,
  add column nombre_historico text,
  add column genetica_id uuid;
insert into public.medrano_dispensario_lotes(id,gramos_actual,codigo_lote,nombre_historico)
values('40000000-0000-0000-0000-000000000001',100,'LOTE-TEST','Flores test');
do $$
declare v_transfer uuid; v_hist integer; v_item uuid;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
  v_transfer:=public.enviar_flores_laboratorio('40000000-0000-0000-0000-000000000001',40);
  if (select gramos_actual from public.medrano_dispensario_lotes where codigo_lote='LOTE-TEST')<>60 then raise exception 'No se descontó el envío.'; end if;
  if exists(select 1 from public.medrano_laboratorio_stock where lote='LOTE-TEST') then raise exception 'El envío ingresó sin confirmar.'; end if;
  if not exists(select 1 from public.medrano_traslados_laboratorio where id=v_transfer and estado='en_viaje') then raise exception 'No se registró el pendiente.'; end if;
  begin
    perform public.enviar_flores_laboratorio('40000000-0000-0000-0000-000000000001',61);
    raise exception 'Se permitió sobreventa.';
  exception when others then if sqlerrm not like 'El lote no tiene stock%' then raise; end if; end;
  perform public.recibir_flores_laboratorio(v_transfer);
  if (select cantidad from public.medrano_laboratorio_stock where lote='LOTE-TEST')<>40 then raise exception 'Recepción incorrecta.'; end if;
  begin
    perform public.recibir_flores_laboratorio(v_transfer);
    raise exception 'Se duplicó la recepción.';
  exception when others then if sqlerrm not like 'Este traslado ya fue recibido%' then raise; end if; end;
  if not exists(select 1 from public.medrano_stock_historial where accion like 'Envío Dispensario%' and usuario_nombre='Medrano') then raise exception 'No se auditó el envío.'; end if;
  if not exists(select 1 from public.medrano_stock_historial where accion like 'Recepción confirmada%' and sector='laboratorio') then raise exception 'No se auditó la recepción.'; end if;
  perform public.guardar_stock_laboratorio(null,'insumos','Insumo test',10,'unidades',true);
  select id into v_item from public.medrano_laboratorio_stock where nombre='Insumo test';
  perform public.guardar_stock_laboratorio(v_item,'insumos','Insumo test',8,'unidades',true);
  perform public.guardar_stock_laboratorio(v_item,'insumos','Insumo test',8,'unidades',false);
  select count(*) into v_hist from public.medrano_stock_historial where producto='Insumo test';
  if v_hist<>3 then raise exception 'No se registraron ingreso, ajuste y retiro.'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  begin
    perform public.enviar_flores_laboratorio('40000000-0000-0000-0000-000000000001',1);
    raise exception 'Cultivo pudo enviar stock.';
  exception when others then if sqlerrm not like 'No tenés permiso%' then raise; end if; end;
  if has_table_privilege('authenticated','public.medrano_stock_historial','INSERT') or has_table_privilege('authenticated','public.medrano_stock_historial','DELETE') then raise exception 'El historial se puede falsificar.'; end if;
end; $$;
