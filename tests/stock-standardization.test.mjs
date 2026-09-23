import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.24.1_stock_lotes_tamano.sql');

const standardHeaders='<th data-sort-type="text">Lote</th><th data-sort-type="text">Genética</th><th data-sort-type="date">Fecha</th><th data-sort-type="number">Stock inicial</th><th data-sort-type="number">Stock actual</th><th data-sort-type="text">Tamaño</th>';

test('Palestina y Medrano usan las mismas columnas de lote',()=>{
  assert.ok(app.split(standardHeaders).length-1>=4);
  assert.match(app,/stockLotSizeHtml\('palestina'/);
  assert.match(app,/stockLotSizeHtml\('medrano'/);
  assert.doesNotMatch(app,/<th data-sort-type="text">Sala<\/th><th data-sort-type="text">Lote<\/th><th data-sort-type="text">Genética<\/th><th data-sort-type="date">Fecha<\/th><th data-sort-type="number">Disponible<\/th>/);
});

test('el tamaño admite solamente Grande, Mediano o Chico y se guarda en el stock correcto',()=>{
  assert.match(app,/const stockLotSizes=\{grande:'Grande',mediano:'Mediano',chico:'Chico'\}/);
  assert.match(app,/medrano_dispensario_lotes':'stock_existencias'/);
  assert.match(html,/id="medrano-lot-size"[\s\S]*?value="grande">Grande<[\s\S]*?value="mediano">Mediano<[\s\S]*?value="chico">Chico</);
});

test('la migración agrega fecha y tamaño y los traslados heredan esos datos',()=>{
  assert.match(sql,/alter table public\.stock_existencias[\s\S]*?fecha_ingreso date[\s\S]*?tamano text check \(tamano in \('grande','mediano','chico'\)\)/i);
  assert.match(sql,/alter table public\.medrano_dispensario_lotes[\s\S]*?tamano text check \(tamano in \('grande','mediano','chico'\)\)/i);
  assert.match(sql,/create trigger completar_fecha_stock_palestina[\s\S]*?before insert or update of ciclo_id,fecha_ingreso/i);
  assert.match(sql,/create trigger completar_datos_lote_medrano[\s\S]*?before insert on public\.medrano_dispensario_lotes/i);
});
