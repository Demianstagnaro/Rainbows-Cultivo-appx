-- Rainbows 3.26.83 — Completar bandejas de Veges con una genética.
-- Incluye Vege 1 con 12 bandejas. Requiere Croquis V3.26.69.
begin;
alter table public.palestina_semillero drop constraint if exists palestina_semillero_check;
alter table public.palestina_semillero drop constraint if exists palestina_semillero_distribucion_check;
alter table public.palestina_semillero add constraint palestina_semillero_distribucion_check check(
 (sala='Vege 1' and bandeja between 1 and 12 and posicion between 1 and 9 and cantidad=1)
 or (sala='Vege 2' and bandeja between 1 and 11 and posicion between 1 and 9 and cantidad=1)
 or (sala='Esquejes' and bandeja between 1 and 26 and posicion=1 and cantidad between 1 and 36)
);
create or replace function public.completar_bandeja_croquis(p_sala text,p_bandeja integer,p_posicion integer,p_genetica_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare v_n integer;
begin
 if not public.usuario_rainbows_operativo() then raise exception 'Sin permisos para completar bandejas.';end if;
 perform public.bloquear_croquis_salas();
 if p_sala is null or p_sala not in ('Vege 1','Vege 2') or p_bandeja is null or p_bandeja<1 or p_bandeja>(case when p_sala='Vege 1' then 12 else 11 end) or p_posicion is null or p_posicion not between 1 and 9 then raise exception 'Bandeja o posición inválida.';end if;
 if not exists(select 1 from public.geneticas where id=p_genetica_id and activa is true) then raise exception 'Elegí una genética activa.';end if;
 insert into public.palestina_semillero as actual(sala,bandeja,posicion,genetica_id,cantidad)
 select p_sala,p_bandeja,n,p_genetica_id,1 from generate_series(1,9)n
 on conflict(sala,bandeja,posicion) do update set genetica_id=excluded.genetica_id,cantidad=1 where actual.posicion=p_posicion;
 get diagnostics v_n=row_count;
 return v_n;
end; $$;
revoke all on function public.completar_bandeja_croquis(text,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.completar_bandeja_croquis(text,integer,integer,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
