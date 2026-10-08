import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const load=app.slice(app.indexOf('async function load(){'),app.indexOf('\nlet refreshInFlight='));

test('la carga normal limita registros históricos de Medrano',()=>{
  assert.match(load,/medrano_comandas',orderHistoryPage\?Infinity:1000/);
  assert.match(load,/medrano_comandas_multiproducto',orderHistoryPage\?Infinity:1000/);
  assert.match(load,/medrano_comandas_multiproducto_items',orderHistoryPage\?Infinity:4000/);
  assert.match(load,/medrano_laboratorio_trabajos',laboratoryHistoryPage\?Infinity:1000/);
  assert.match(load,/medrano_laboratorio_trabajos_materiales',laboratoryHistoryPage\?Infinity:4000/);
});

test('los historiales completos se cargan solamente al abrirlos',()=>{
  assert.match(app,/function openMedranoDataView\(view\)/);
  assert.match(app,/openMedranoDataView\('administracion-comandas-historial'\)/);
  assert.match(app,/openMedranoDataView\('dispensario-historial'\)/);
  assert.match(app,/openMedranoDataView\('laboratorio-historial'\)/);
  assert.match(load,/orderHistoryPage\?Infinity/);
  assert.match(load,/laboratoryHistoryPage\?Infinity/);
  assert.match(load,/dispensaryHistoryPage\?Infinity/);
});

test('las cargas sin consumidor dejan de ejecutarse y Tokens se abre con Caja',()=>{
  assert.doesNotMatch(load,/loadMedranoStockTable\('medrano_dispensario_laboratorio_stock'/);
  assert.doesNotMatch(load,/loadMedranoStockTable\('medrano_laboratorio_trabajos_eventos'/);
  assert.match(load,/medranoPage&&cashPage\?loadMedranoStockTable\('medrano_tokens_movimientos'\):empty\(\)/);
});
