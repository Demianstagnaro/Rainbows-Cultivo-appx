import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.3_preparacion_comandas_laboratorio.sql',import.meta.url),'utf8');

test('los productos elaborados usan tres estados de preparación',()=>{
  assert.match(sql,/preparacion_estado[\s\S]*?'pendiente','en_proceso','listo'/i);
  assert.match(app,/Pendiente de preparación/);
  assert.match(app,/En preparación/);
  assert.match(app,/Listo para entregar/);
});

test('iniciar preparación crea y vincula un trabajo con la comanda',()=>{
  assert.match(sql,/create or replace function public\.cambiar_preparacion_item_comanda/i);
  assert.match(sql,/insert into public\.medrano_laboratorio_trabajos[\s\S]*?'comanda_paciente'/i);
  assert.match(sql,/preparacion_trabajo_id=v_trabajo/i);
  assert.match(app,/cambiar_preparacion_item_comanda/);
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
