do $$ declare v_count int;v_before jsonb;begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 insert into public.palestina_semillero values
 ('Vege 1',12,2,'00000000-0000-0000-0000-000000000022',1,'2026-11-01'),
 ('Vege 1',11,1,'00000000-0000-0000-0000-000000000022',1,null);
 v_count:=public.completar_bandeja_croquis('Vege 1',12,1,'00000000-0000-0000-0000-000000000021');
 if v_count<>8 or (select count(*) from public.palestina_semillero where sala='Vege 1' and bandeja=12)<>9 then raise exception 'No completó la bandeja 12';end if;
 if not exists(select 1 from public.palestina_semillero where sala='Vege 1' and bandeja=12 and posicion=2 and genetica_id='00000000-0000-0000-0000-000000000022' and fecha_inicio='2026-11-01') then raise exception 'Reemplazó otra maceta ocupada';end if;
 if not exists(select 1 from public.palestina_semillero where sala='Vege 1' and bandeja=11 and genetica_id='00000000-0000-0000-0000-000000000022') then raise exception 'Modificó otra bandeja';end if;
 perform public.completar_bandeja_croquis('Vege 1',12,1,'00000000-0000-0000-0000-000000000021');
 if (select count(*) from public.palestina_semillero where sala='Vege 1' and bandeja=12)<>9 then raise exception 'Duplicó carga repetida';end if;
 perform public.completar_bandeja_croquis('Vege 2',11,9,'00000000-0000-0000-0000-000000000021');
 if (select count(*) from public.palestina_semillero where sala='Vege 2' and bandeja=11)<>9 then raise exception 'No completó Vege 2';end if;
 begin perform public.completar_bandeja_croquis('Vege 2',12,1,'00000000-0000-0000-0000-000000000021');raise exception 'Aceptó bandeja fuera de límites';exception when others then if sqlerrm='Aceptó bandeja fuera de límites' then raise;end if;end;
 begin perform public.completar_bandeja_croquis('Esquejes',1,1,'00000000-0000-0000-0000-000000000021');raise exception 'Aceptó otra sala';exception when others then if sqlerrm='Aceptó otra sala' then raise;end if;end;
 begin perform public.completar_bandeja_croquis('Vege 1',1,1,'00000000-0000-0000-0000-000000000023');raise exception 'Aceptó genética inactiva';exception when others then if sqlerrm='Aceptó genética inactiva' then raise;end if;end;
 if exists(select 1 from public.palestina_semillero where sala='Vege 1' and bandeja=1) then raise exception 'Guardó una aplicación fallida parcialmente';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin perform public.completar_bandeja_croquis('Vege 1',1,1,'00000000-0000-0000-0000-000000000021');raise exception 'Medrano pudo completar bandeja';exception when others then if sqlerrm='Medrano pudo completar bandeja' then raise;end if;end;
 if has_function_privilege('anon','public.completar_bandeja_croquis(text,integer,integer,uuid)','EXECUTE') then raise exception 'Operación expuesta a anónimos';end if;
end; $$;
