import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.24.3_tamano_desde_cosecha.sql');

test('cada resultado de cosecha permite elegir y guarda el tamaño',()=>{
  assert.match(app,/class="text-input harvest-line-size"/);
  assert.match(app,/Object\.entries\(stockLotSizes\)/);
  assert.match(app,/tamano:row\.querySelector\('\.harvest-line-size'\)/);
  assert.match(app,/detailPayload=\{genetica_id:line\.genetica_id,nombre_historico:line\.nombre_historico,tamano:line\.tamano,gramos:line\.gramos\}/);
  assert.match(app,/Seleccioná el tamaño de cada genética cargada/);
});

test('no mezcla tamaños diferentes dentro del mismo lote genético',()=>{
  assert.match(app,/existing\.tamano!==line\.tamano/);
  assert.match(app,/deben tener el mismo tamaño para formar un único lote/);
});

test('el detalle de cosecha muestra el tamaño',()=>{
  assert.match(app,/<span>Tamaño<\/span><span>Gramos<\/span>/);
  assert.match(app,/stockLotSizes\[r\.tamano\]\|\|'Sin definir'/);
});

test('la migración conserva la trazabilidad desde cosecha hasta Medrano',()=>{
  assert.match(sql,/alter table public\.cosecha_geneticas[\s\S]*?add column if not exists tamano text check \(tamano in \('grande','mediano','chico'\)\)/i);
  assert.match(sql,/create trigger zy_completar_tamano_stock_desde_cosecha[\s\S]*?before insert or update on public\.stock_existencias/i);
  assert.match(sql,/create trigger propagar_tamano_cosecha_a_stock[\s\S]*?after insert or update of tamano,genetica_id,nombre_historico,cosecha_id on public\.cosecha_geneticas/i);
  assert.match(sql,/create trigger propagar_tamano_stock_a_medrano[\s\S]*?after update of tamano on public\.stock_existencias/i);
  assert.match(sql,/create trigger propagar_tamano_medrano_a_stock[\s\S]*?after update of tamano on public\.medrano_dispensario_lotes/i);
});
