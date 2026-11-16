do $$ declare v_sala text;v_tray int;v_pos int;v_count int;i int;begin
 if (select count(*) from public.palestina_semillero)<>3 or not exists(select 1 from public.palestina_semillero where sala='Vege 1' and bandeja=11 and posicion=9 and fecha_inicio='2026-11-01') then raise exception 'Alteró datos anteriores';end if;
 insert into public.palestina_semillero(sala,bandeja,posicion,genetica_id,cantidad) select 'Vege 1',12,n,'00000000-0000-0000-0000-000000000001',1 from generate_series(1,9)n;
 if (select count(*) from public.palestina_semillero where sala='Vege 1' and bandeja=12)<>9 then raise exception 'No admitió la bandeja 12 completa';end if;
 for i in 1..6 loop
  v_sala:=(array['Vege 1','Vege 2','Vege 1','Vege 1','Esquejes','Esquejes'])[i];
  v_tray:=(array[13,12,12,12,27,26])[i];v_pos:=(array[1,1,10,1,1,1])[i];v_count:=(array[1,1,1,2,36,37])[i];
  begin
   insert into public.palestina_semillero values(v_sala,v_tray,v_pos,'00000000-0000-0000-0000-000000000001',v_count,null) on conflict(sala,bandeja,posicion) do update set cantidad=excluded.cantidad;
   raise exception 'Aceptó distribución fuera de límites';
  exception when check_violation then null;end;
 end loop;
 if (select count(*) from public.palestina_semillero)<>12 then raise exception 'Cambió las plantas guardadas';end if;
end; $$;
