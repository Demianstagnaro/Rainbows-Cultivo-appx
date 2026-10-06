import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.3_preparacion_comandas_laboratorio.sql',import.meta.url),'utf8');
const sqlStock=fs.readFileSync(new URL('../Rainbows_V3.26.4_comandas_desde_stock.sql',import.meta.url),'utf8');

test('los productos elaborados usan tres estados de preparación',()=>{
  assert.match(sql,/preparacion_estado[\s\S]*?'pendiente','en_proceso','listo'/i);
  assert.match(app,/Pendiente de preparación/);
  assert.match(app,/En preparación/);
  assert.match(app,/Listo para entregar/);
});

test('iniciar preparación usa el lote reservado sin crear otra producción',()=>{
  assert.match(sqlStock,/add column if not exists preparacion_estado text/);
  assert.match(sqlStock,/add column if not exists preparacion_trabajo_id uuid/);
  assert.match(sqlStock,/create trigger normalizar_preparacion_item_comanda/i);
  assert.match(sqlStock,/create or replace function public\.cambiar_preparacion_item_comanda/i);
  assert.doesNotMatch(sqlStock,/insert into public\.medrano_laboratorio_trabajos\s*\(/i);
  assert.match(sqlStock,/set preparacion_estado=p_estado,preparacion_trabajo_id=null/i);
  assert.match(sqlStock,/origen_id del ítem ya identifica el lote físico reservado/i);
  assert.match(app,/cambiar_preparacion_item_comanda/);
});

test('Resinas y Cápsulas muestran genética y lote',()=>{
  assert.match(app,/function medranoLabOrderTrace\(item\)/);
  assert.match(app,/\['resina','capsulas'\]\.includes\(item\?\.tipo\)/);
  assert.match(app,/`Genética: \$\{genetic\}`/);
  assert.match(app,/`Lote: \$\{lot\}`/);
  assert.match(app,/\['resina','capsulas'\]\.includes\(tipo\)/);
});

test('la comanda no se dispensa hasta que Laboratorio termina',()=>{
  assert.match(sql,/tipo in \('resina','aceites','cremas','capsulas'\)[\s\S]*?preparacion_estado is distinct from 'listo'/i);
  assert.match(sql,/Laboratorio todavía tiene productos pendientes de preparación/);
  assert.match(app,/function medranoOrderLabReady/);
  assert.match(app,/Esperando Laboratorio/);
  assert.match(app,/data-dispense-medrano-order[\s\S]*?!labReady\?'disabled/i);
});

test('flores y mostrador quedan fuera de la preparación',()=>{
  assert.match(sql,/set preparacion_estado=null,preparacion_trabajo_id=null[\s\S]*?tipo not in \('resina','aceites','cremas','capsulas'\)/i);
  assert.match(app,/const medranoLabOrderTypes=new Set\(\['resina','aceites','cremas','capsulas'\]\)/);
});
