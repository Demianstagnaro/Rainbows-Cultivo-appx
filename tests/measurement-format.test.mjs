import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.2_medidas_sin_ceros.sql');

function sourceBetween(start,end){
  const from=app.indexOf(start),to=app.indexOf(end,from);
  assert.ok(from>=0&&to>from,`No se encontró ${start}`);
  return app.slice(from,to);
}

test('las medidas visibles eliminan solamente los ceros decimales finales',()=>{
  const context={};
  vm.createContext(context);
  vm.runInContext(`${sourceBetween('function formatMeasurementText','function labStockItemLabel')}globalThis.formatMeasurementText=formatMeasurementText;`,context);
  assert.equal(context.formatMeasurementText('Cápsulas · 1.000 g'),'Cápsulas · 1 g');
  assert.equal(context.formatMeasurementText('Crema · THC · 50.00 g'),'Crema · THC · 50 g');
  assert.equal(context.formatMeasurementText('Aceite · 10.50 ml'),'Aceite · 10,5 ml');
  assert.equal(context.formatMeasurementText('Concentración 1:12.25'),'Concentración 1:12,25');
});

test('Supabase corrige datos anteriores y normaliza las producciones futuras',()=>{
  assert.match(sql,/function public\.normalizar_medidas_medrano\(p_texto text\)/);
  assert.match(sql,/before insert or update of nombre,nombre_comercial on public\.medrano_laboratorio_stock/);
  assert.match(sql,/before insert or update of producto on public\.medrano_laboratorio_trabajos/);
  assert.match(sql,/before insert or update of nombre on public\.medrano_catalogo_productos/);
  assert.match(sql,/update public\.medrano_laboratorio_stock/);
  assert.match(sql,/update public\.medrano_stock_historial/);
  assert.match(sql,/update public\.medrano_comandas_multiproducto_items/);
  assert.doesNotMatch(sql,/set cantidad=/);
});

test('la normalización no duplica precios equivalentes',()=>{
  assert.match(sql,/create temporary table catalogo_medidas_merge/);
  assert.match(sql,/set catalogo_producto_id=m\.canonical_id/);
  assert.match(sql,/max\(origen\.tokens_por_unidad\)/);
  assert.match(sql,/delete from public\.medrano_catalogo_productos/);
});
