do $$
declare v_article jsonb;v_count int;v_rows int;v_cat uuid;v_id uuid;v_date date;v_open jsonb;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 select count(*) into v_rows from public.palestina_caja_movimientos;
 select to_jsonb(a) into v_open from public.palestina_caja_apertura a;
 v_article:=public.crear_articulo_caja_palestina('  Artículo   especial de prueba  ');
 if v_article->>'nombre'<>'Artículo especial de prueba' then raise exception 'No normalizó espacios'; end if;
 if (select count(*) from public.palestina_caja_movimientos)<>v_rows or (select to_jsonb(a) from public.palestina_caja_apertura a)<>v_open then raise exception 'Crear artículo modificó la caja'; end if;
 select count(*) into v_count from public.palestina_caja_articulos;
 begin
  perform public.crear_articulo_caja_palestina('ARTICULO ESPECIAL DE PRUEBA');raise exception 'Duplicó artículo';
 exception when others then if sqlerrm='Duplicó artículo' then raise; end if; end;
 begin
  perform public.crear_articulo_caja_palestina('  ');raise exception 'Aceptó nombre vacío';
 exception when others then if sqlerrm='Aceptó nombre vacío' then raise; end if; end;
 select id into v_cat from public.palestina_caja_categorias where nombre='Producción';
 select fecha into v_date from public.palestina_caja_apertura;
 begin
  perform public.guardar_movimiento_caja_palestina(null,0,gen_random_uuid(),v_date,'egreso','efectivo','Artculo mal escrito',1,5,v_cat);
  raise exception 'Creó artículo automáticamente';
 exception when others then if sqlerrm='Creó artículo automáticamente' then raise; end if; end;
 if (select count(*) from public.palestina_caja_articulos)<>v_count then raise exception 'Agregó artículo por error al escribir'; end if;
 if (select count(*) from public.palestina_caja_movimientos)<>v_rows then raise exception 'Guardó movimiento inválido'; end if;
 v_id:=public.guardar_movimiento_caja_palestina(null,0,gen_random_uuid(),v_date,'egreso','efectivo','artículo especial de prueba',2,7.50,v_cat);
 if (select articulo_id from public.palestina_caja_movimientos where id=v_id)<>(v_article->>'id')::uuid then raise exception 'No usó el artículo existente'; end if;
 if (select articulo from public.palestina_caja_movimientos where id=v_id)<>v_article->>'nombre' then raise exception 'Cambió el nombre del catálogo'; end if;
 begin
  perform public.guardar_movimiento_caja_palestina(v_id,1,null,v_date,'egreso','efectivo','Artculo mal escrito',2,7.5,v_cat,'','Error al editar');
  raise exception 'Editó con artículo inexistente';
 exception when others then if sqlerrm='Editó con artículo inexistente' then raise; end if; end;
 if (select version from public.palestina_caja_movimientos where id=v_id)<>1 then raise exception 'La edición rechazada modificó el movimiento'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 perform public.crear_articulo_caja_palestina('Artículo del encargado');
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
 begin
  perform public.crear_articulo_caja_palestina('No autorizado');raise exception 'Cultivo creó artículo';
 exception when others then if sqlerrm='Cultivo creó artículo' then raise; end if; end;
 if has_table_privilege('authenticated','public.palestina_caja_articulos','INSERT') or has_function_privilege('anon','public.crear_articulo_caja_palestina(text)','EXECUTE') then raise exception 'Alta de artículos expuesta'; end if;
end; $$;
