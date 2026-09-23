-- Caja y Tokens para Medrano. Requiere V3.22.0.
begin;

alter table public.medrano_pacientes
  add column if not exists saldo_tokens numeric not null default 0 check (saldo_tokens >= 0);
alter table public.geneticas
  add column if not exists medrano_tokens_por_unidad numeric not null default 0 check (medrano_tokens_por_unidad >= 0);
alter table public.medrano_laboratorio_stock
  add column if not exists tokens_por_unidad numeric not null default 0 check (tokens_por_unidad >= 0);
alter table public.medrano_mostrador_productos
  add column if not exists tokens_por_unidad numeric not null default 0 check (tokens_por_unidad >= 0);

-- El saldo sólo puede cambiar dentro de las RPC transaccionales de Tokens.
revoke insert,update on public.medrano_pacientes from authenticated;
grant insert(numero_socio,nombre,apellido,dni,telefono,domicilio,codigo_vinculacion,fecha_ingreso,sexo,referido,fecha_vencimiento_reprocann,updated_at,creado_por)
  on public.medrano_pacientes to authenticated;
grant update(numero_socio,nombre,apellido,dni,telefono,domicilio,codigo_vinculacion,fecha_ingreso,sexo,referido,fecha_vencimiento_reprocann,updated_at)
  on public.medrano_pacientes to authenticated;

alter table public.medrano_comandas_multiproducto
  add column if not exists tokens_total numeric not null default 0 check (tokens_total >= 0),
  add column if not exists pago_estado text not null default 'pendiente' check (pago_estado in ('pendiente','pagada','historica')),
  add column if not exists pagada_at timestamptz,
  add column if not exists pagada_por uuid references auth.users(id),
  add column if not exists medio_pago text check (medio_pago in ('efectivo','digital','saldo'));
alter table public.medrano_comandas_multiproducto_items
  add column if not exists tokens_por_unidad numeric not null default 0 check (tokens_por_unidad >= 0),
  add column if not exists tokens_total numeric not null default 0 check (tokens_total >= 0);

-- Las comandas históricas no generan movimientos retroactivos de Caja.
update public.medrano_comandas_multiproducto
set pago_estado='historica'
where estado='dispensada' and pago_estado='pendiente';

create table if not exists public.medrano_caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ingreso','egreso')),
  medio text not null check (medio in ('efectivo','digital')),
  monto numeric not null check (monto > 0),
  concepto text not null,
  tokens numeric not null default 0 check (tokens >= 0),
  paciente_id uuid references public.medrano_pacientes(id),
  comanda_id uuid references public.medrano_comandas_multiproducto(id),
  origen text not null default 'manual' check (origen in ('manual','compra_tokens','comanda')),
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.medrano_tokens_movimientos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.medrano_pacientes(id),
  comanda_id uuid references public.medrano_comandas_multiproducto(id),
  tipo text not null check (tipo in ('acreditacion','consumo','reintegro','ajuste')),
  tokens numeric not null check (tokens <> 0),
  saldo_anterior numeric not null,
  saldo_nuevo numeric not null check (saldo_nuevo >= 0),
  detalle text not null,
  creado_por uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists medrano_caja_fecha_idx on public.medrano_caja_movimientos(created_at desc);
create index if not exists medrano_tokens_paciente_idx on public.medrano_tokens_movimientos(paciente_id,created_at desc);
create unique index if not exists medrano_caja_comanda_unica on public.medrano_caja_movimientos(comanda_id) where origen='comanda';

alter table public.medrano_caja_movimientos enable row level security;
alter table public.medrano_tokens_movimientos enable row level security;
drop policy if exists medrano_caja_select on public.medrano_caja_movimientos;
create policy medrano_caja_select on public.medrano_caja_movimientos for select to authenticated using (public.usuario_rainbows_medrano());
drop policy if exists medrano_tokens_select on public.medrano_tokens_movimientos;
create policy medrano_tokens_select on public.medrano_tokens_movimientos for select to authenticated using (public.usuario_rainbows_medrano());
revoke all on public.medrano_caja_movimientos,public.medrano_tokens_movimientos from public,anon,authenticated;
grant select on public.medrano_caja_movimientos,public.medrano_tokens_movimientos to authenticated;

create or replace function public.precio_tokens_producto(p_tipo text,p_origen uuid)
returns numeric language plpgsql security definer set search_path='' stable as $$
declare v_precio numeric;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if p_tipo='flores' then
   select g.medrano_tokens_por_unidad into v_precio
   from public.medrano_dispensario_lotes l join public.geneticas g on g.id=l.genetica_id where l.id=p_origen;
 elsif p_tipo='mostrador' then
   select tokens_por_unidad into v_precio from public.medrano_mostrador_productos where id=p_origen and activo;
 elsif p_tipo in ('resina','aceites','cremas','capsulas') then
   select tokens_por_unidad into v_precio from public.medrano_laboratorio_stock where id=p_origen and categoria=p_tipo and activo;
 else raise exception 'Tipo de producto inválido.'; end if;
 return coalesce(v_precio,0);
end; $$;

create or replace function public.calcular_tokens_item_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_precio numeric;
begin
 v_precio:=public.precio_tokens_producto(new.tipo,new.origen_id);
 if v_precio<=0 then raise exception 'El producto % todavía no tiene configurado su valor en Tokens.',new.nombre; end if;
 new.tokens_por_unidad:=v_precio;
 new.tokens_total:=round(v_precio*new.cantidad,2);
 return new;
end; $$;
drop trigger if exists calcular_tokens_item_comanda on public.medrano_comandas_multiproducto_items;
create trigger calcular_tokens_item_comanda before insert or update of tipo,origen_id,cantidad
on public.medrano_comandas_multiproducto_items for each row execute function public.calcular_tokens_item_comanda();

create or replace function public.actualizar_total_tokens_comanda()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then v_id:=old.comanda_id; else v_id:=new.comanda_id; end if;
 update public.medrano_comandas_multiproducto
 set tokens_total=(select coalesce(sum(tokens_total),0) from public.medrano_comandas_multiproducto_items where comanda_id=v_id),updated_at=now()
 where id=v_id;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists actualizar_total_tokens_comanda on public.medrano_comandas_multiproducto_items;
create trigger actualizar_total_tokens_comanda after insert or update or delete
on public.medrano_comandas_multiproducto_items for each row execute function public.actualizar_total_tokens_comanda();

create or replace function public.proteger_comanda_pagada()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.medrano_comandas_multiproducto where id=old.comanda_id and pago_estado='pagada') then
   raise exception 'Una comanda pagada no se puede editar. Cancelala para devolver los Tokens al paciente.';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists proteger_items_comanda_pagada on public.medrano_comandas_multiproducto_items;
create trigger proteger_items_comanda_pagada before update or delete
on public.medrano_comandas_multiproducto_items for each row execute function public.proteger_comanda_pagada();

create or replace function public.guardar_precio_tokens_producto(p_tipo text,p_id uuid,p_tokens numeric)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if p_tokens is null or p_tokens<0 or p_tokens::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresá un valor de Tokens válido.'; end if;
 if p_tipo='flores' then update public.geneticas set medrano_tokens_por_unidad=p_tokens where id=p_id;
 elsif p_tipo='mostrador' then update public.medrano_mostrador_productos set tokens_por_unidad=p_tokens,updated_at=now() where id=p_id;
 elsif p_tipo in ('resina','aceites','cremas','capsulas') then update public.medrano_laboratorio_stock set tokens_por_unidad=p_tokens,updated_at=now() where id=p_id and categoria=p_tipo;
 else raise exception 'Tipo inválido.'; end if;
 if not found then raise exception 'Producto no encontrado.'; end if;
 -- También actualiza las comandas pendientes que existían antes de instalar Caja.
 if p_tipo='flores' then
   update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad
   from public.medrano_comandas_multiproducto c
   where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo='flores'
     and i.origen_id in (select id from public.medrano_dispensario_lotes where genetica_id=p_id);
 else
   update public.medrano_comandas_multiproducto_items i set cantidad=i.cantidad
   from public.medrano_comandas_multiproducto c
   where c.id=i.comanda_id and c.estado='pendiente' and c.pago_estado<>'pagada' and i.tipo=p_tipo and i.origen_id=p_id;
 end if;
end; $$;

create or replace function public.registrar_movimiento_caja(p_tipo text,p_medio text,p_monto numeric,p_concepto text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if p_tipo not in ('ingreso','egreso') or p_medio not in ('efectivo','digital') or p_monto is null or p_monto<=0 or p_monto::text in ('NaN','Infinity','-Infinity') or nullif(btrim(p_concepto),'') is null then
   raise exception 'Revisá tipo, medio, monto y concepto.'; end if;
 insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,creado_por)
 values(p_tipo,p_medio,p_monto,btrim(p_concepto),auth.uid()) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.acreditar_tokens_paciente(p_paciente uuid,p_tokens numeric,p_medio text,p_detalle text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_saldo numeric;v_nombre text;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 if p_tokens is null or p_tokens<=0 or p_tokens::text in ('NaN','Infinity','-Infinity') or p_tokens<>trunc(p_tokens) or p_medio not in ('efectivo','digital') then raise exception 'Revisá Tokens y medio de pago.'; end if;
 select saldo_tokens,nullif(btrim(concat_ws(' ',nombre,apellido)),'') into v_saldo,v_nombre from public.medrano_pacientes where id=p_paciente for update;
 if not found then raise exception 'Paciente no encontrado.'; end if;
 update public.medrano_pacientes set saldo_tokens=v_saldo+p_tokens,updated_at=now() where id=p_paciente;
 insert into public.medrano_tokens_movimientos(paciente_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por)
 values(p_paciente,'acreditacion',p_tokens,v_saldo,v_saldo+p_tokens,coalesce(nullif(btrim(p_detalle),''),'Compra de Tokens'),auth.uid());
 insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,tokens,paciente_id,origen,creado_por)
 values('ingreso',p_medio,p_tokens*1000,'Compra de Tokens · '||coalesce(v_nombre,'Paciente'),p_tokens,p_paciente,'compra_tokens',auth.uid());
end; $$;

create or replace function public.pagar_comanda_multiproducto(p_id uuid,p_medio text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto;v_saldo numeric;v_faltan numeric;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
 if not found or v_c.estado<>'pendiente' then raise exception 'La comanda no está pendiente.'; end if;
 if v_c.pago_estado='pagada' then return; end if;
 if v_c.tokens_total<=0 then raise exception 'La comanda no tiene un total válido de Tokens. Editala después de configurar los valores.'; end if;
 select saldo_tokens into v_saldo from public.medrano_pacientes where id=v_c.paciente_id for update;
 v_faltan:=greatest(v_c.tokens_total-v_saldo,0);
 if v_faltan>0 and p_medio not in ('efectivo','digital') then raise exception 'Seleccioná efectivo o digital para cobrar los Tokens faltantes.'; end if;
 if v_faltan>0 then
   insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,tokens,paciente_id,comanda_id,origen,creado_por)
   values('ingreso',p_medio,v_faltan*1000,'Cobro de comanda · '||v_c.paciente_nombre,v_faltan,v_c.paciente_id,v_c.id,'comanda',auth.uid());
   insert into public.medrano_tokens_movimientos(paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por)
   values(v_c.paciente_id,v_c.id,'acreditacion',v_faltan,v_saldo,v_saldo+v_faltan,'Tokens acreditados al cobrar la comanda',auth.uid());
   v_saldo:=v_saldo+v_faltan;
 end if;
 update public.medrano_pacientes set saldo_tokens=v_saldo-v_c.tokens_total,updated_at=now() where id=v_c.paciente_id;
 insert into public.medrano_tokens_movimientos(paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por)
 values(v_c.paciente_id,v_c.id,'consumo',-v_c.tokens_total,v_saldo,v_saldo-v_c.tokens_total,'Pago de comanda',auth.uid());
 update public.medrano_comandas_multiproducto set pago_estado='pagada',pagada_at=now(),pagada_por=auth.uid(),medio_pago=case when v_faltan>0 then p_medio else 'saldo' end,updated_at=now() where id=p_id;
end; $$;

create or replace function public.cerrar_comanda_multiproducto(p_id uuid,p_medio text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 perform public.pagar_comanda_multiproducto(p_id,p_medio);
 perform public.dispensar_comanda_multiproducto(p_id);
end; $$;

create or replace function public.eliminar_comanda_tokens(p_id uuid,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v_c public.medrano_comandas_multiproducto;v_saldo numeric;
begin
 if not public.usuario_rainbows_medrano() then raise exception 'Sin permiso.'; end if;
 select * into v_c from public.medrano_comandas_multiproducto where id=p_id for update;
 if not found or v_c.estado<>'pendiente' then perform public.eliminar_comanda_multiproducto(p_id,p_motivo);return;end if;
 if v_c.pago_estado='pagada' then
   select saldo_tokens into v_saldo from public.medrano_pacientes where id=v_c.paciente_id for update;
   update public.medrano_pacientes set saldo_tokens=v_saldo+v_c.tokens_total,updated_at=now() where id=v_c.paciente_id;
   insert into public.medrano_tokens_movimientos(paciente_id,comanda_id,tipo,tokens,saldo_anterior,saldo_nuevo,detalle,creado_por)
   values(v_c.paciente_id,v_c.id,'reintegro',v_c.tokens_total,v_saldo,v_saldo+v_c.tokens_total,'Reintegro por cancelación de comanda',auth.uid());
 end if;
 perform public.eliminar_comanda_multiproducto(p_id,p_motivo);
end; $$;

revoke execute on function public.dispensar_comanda_multiproducto(uuid) from authenticated;
revoke all on function public.precio_tokens_producto(text,uuid),public.calcular_tokens_item_comanda(),public.actualizar_total_tokens_comanda(),public.proteger_comanda_pagada(),
 public.guardar_precio_tokens_producto(text,uuid,numeric),public.registrar_movimiento_caja(text,text,numeric,text),
 public.acreditar_tokens_paciente(uuid,numeric,text,text),public.pagar_comanda_multiproducto(uuid,text),
 public.cerrar_comanda_multiproducto(uuid,text),public.eliminar_comanda_tokens(uuid,text) from public,anon;
grant execute on function public.guardar_precio_tokens_producto(text,uuid,numeric),public.registrar_movimiento_caja(text,text,numeric,text),
 public.acreditar_tokens_paciente(uuid,numeric,text,text),public.pagar_comanda_multiproducto(uuid,text),
 public.cerrar_comanda_multiproducto(uuid,text),public.eliminar_comanda_tokens(uuid,text) to authenticated;

commit;
