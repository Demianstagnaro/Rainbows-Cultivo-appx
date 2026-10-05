import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),sql=read('Rainbows_V3.26.0_trazabilidad_medrano.sql');

test('los movimientos de Medrano comparten una operación estructurada',()=>{
  assert.match(sql,/create table if not exists public\.medrano_operaciones/);
  assert.match(sql,/add column if not exists operacion_id uuid references public\.medrano_operaciones/);
  assert.match(sql,/current_setting\('rainbows\.operacion_id',true\)/);
  assert.match(sql,/values\(p_id,'produccion',p_id,'finalizada'/);
  assert.match(sql,/values\(v_id,'traslado',v_id,'en_viaje'/);
  assert.match(sql,/values\(p_id,'dispensa',p_id,'dispensada'/);
});

test('el historial usa la relación real y no muestra UUID técnicos',()=>{
  assert.match(app,/String\(row\.operacion_id\|\|''\)===String\(transfer\.id\)/);
  assert.match(app,/function medranoOperationLabel\(type\)/);
  assert.match(app,/movimientos relacionados/);
});

test('el historial completo se carga sólo al abrirlo',()=>{
  assert.match(app,/loadMedranoStockTable\('medrano_stock_historial',state\.medranoView==='stock-historial'\?Infinity:500\)/);
  assert.match(app,/if\(!state\.medranoStockHistoryComplete\)/);
});
