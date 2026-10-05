import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),sql=read('Rainbows_V3.26.1_concentracion_cremas_y_catalogo.sql');

test('los productos terminados nuevos se incorporan automáticamente al catálogo',()=>{
  assert.match(sql,/add column if not exists nombre_comercial text/);
  assert.match(sql,/function public\.catalogar_producto_terminado_medrano\(\)/);
  assert.match(sql,/new\.categoria not in \('resina','aceites','cremas','capsulas'\)/);
  assert.match(sql,/new\.es_aceite_base/);
  assert.match(sql,/insert into public\.medrano_catalogo_productos/);
  assert.match(sql,/new\.catalogo_producto_id:=v_catalogo\.id/);
});

test('genética y lote identifican la partida pero no duplican el precio',()=>{
  assert.match(sql,/insert into public\.medrano_laboratorio_stock\(id,categoria,nombre,nombre_comercial,genetica_id,lote/);
  assert.match(sql,/when v_job\.tipo='capsulas' then left\('Cápsulas · '/);
  assert.match(sql,/elsif v_job\.tipo in \('aceite_final','crema','capsulas'\) then v_destino:=null/);
  assert.match(sql,/coalesce\(nullif\(btrim\(s\.nombre_comercial\),''\),s\.nombre\)/);
});

test('los productos existentes se vinculan sin perder stock',()=>{
  assert.match(sql,/select distinct s\.categoria,coalesce\(nullif\(btrim\(s\.nombre_comercial\),''\),s\.nombre\),s\.unidad,0,true/);
  assert.match(sql,/set catalogo_producto_id=c\.id,tokens_por_unidad=c\.tokens_por_unidad/);
  assert.doesNotMatch(sql,/delete from public\.medrano_laboratorio_stock/);
});

test('la Lista de precios diferencia productos activos sin precio',()=>{
  assert.match(app,/productos nuevos elaborados aparecen automáticamente como “Sin precio”/);
  assert.match(app,/p\.active\?\(p\.tokens>0\?'Activo':'Sin precio'\):'Inactivo'/);
  assert.match(app,/Configurá el valor en Tokens/);
});
