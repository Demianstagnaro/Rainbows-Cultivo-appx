do $$
declare d date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; a uuid; c public.medrano_caja_arqueos%rowtype; n integer;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if not exists(select 1 from public.medrano_caja_arqueos where fecha=d-1 and digital_esperado=1500 and digital_diario is false) then raise exception 'Se modificó el arqueo anterior'; end if;
 begin
  perform public.cerrar_caja_medrano_diaria_digital(650,75,d-1);
  raise exception 'Aceptó un formulario de otro día';
 exception when others then if sqlerrm='Aceptó un formulario de otro día' then raise; end if; end;
 begin
  perform public.cerrar_caja_medrano(650,1575);
  raise exception 'Aceptó el cierre global de una app anterior';
 exception when others then if sqlerrm='Aceptó el cierre global de una app anterior' then raise; end if; end;
 begin
  perform public.cerrar_caja_medrano_diaria_digital(650,'NaN',d);
  raise exception 'Aceptó NaN';
 exception when others then if sqlerrm='Aceptó NaN' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin
  perform public.cerrar_caja_medrano_diaria_digital(650,75,d);
  raise exception 'Usuario sin permisos pudo cerrar';
 exception when others then if sqlerrm='Usuario sin permisos pudo cerrar' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 a:=public.cerrar_caja_medrano_diaria_digital(650,75,d,'Control diario');
 select * into c from public.medrano_caja_arqueos where id=a;
 if c.efectivo_esperado<>700 or c.efectivo_real<>650 or c.diferencia_efectivo<>-50 then raise exception 'Cambió el arqueo físico acumulado'; end if;
 if c.digital_esperado<>80 or c.digital_real<>75 or c.diferencia_digital<>-5 or c.digital_diario is not true then raise exception 'No verificó sólo el digital del día'; end if;
 if (select count(*) from public.medrano_caja_movimientos where medio='digital')<>5 then raise exception 'Creó o borró movimientos digitales'; end if;
 if not exists(select 1 from public.medrano_caja_movimientos where medio='efectivo' and origen='arqueo' and tipo='egreso' and monto=50) then raise exception 'Falta ajuste físico'; end if;
 if (select sum(case when tipo='ingreso' then monto else -monto end) from public.medrano_caja_movimientos where medio='efectivo')<>650 then raise exception 'Saldo efectivo incorrecto'; end if;
 begin
  perform public.cerrar_caja_medrano_diaria_digital(650,75,d);
  raise exception 'Cerró dos veces';
 exception when others then if sqlerrm='Cerró dos veces' then raise; end if; end;
 begin
  insert into public.medrano_caja_movimientos(tipo,medio,monto,concepto,origen,creado_por) values('ingreso','digital',1,'Luego del cierre','manual',auth.uid());
  raise exception 'Permitió movimientos después del cierre';
 exception when others then if sqlerrm='Permitió movimientos después del cierre' then raise; end if; end;
 if exists(select 1 from public.medrano_caja_movimientos where concepto='Luego del cierre') then raise exception 'Insertó movimiento inválido'; end if;
end; $$;
