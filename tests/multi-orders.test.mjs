import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.22.0_comandas_multiproducto.sql',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('una sola comanda elige paciente primero y múltiples productos del stock',()=>{
  const dialog=html.match(/<dialog id="medrano-multi-dialog"[\s\S]*?<\/dialog>/)?.[0]||'';
  assert.ok(dialog.indexOf('id="medrano-multi-patient"')<dialog.indexOf('id="medrano-multi-lines"'));
  assert.match(dialog,/id="medrano-multi-add"/);
  assert.doesNotMatch(app,/id="medrano-orders-lab"|id="lab-new-order"/);
  for(const category of ['flores','resina','aceites','cremas','capsulas','mostrador'])assert.match(app,new RegExp(`${category}:'`));
  assert.match(app,/medranoCatalog\(tipo,editing=null\)/);
  assert.match(app,/guardar_comanda_multiproducto/);
});

test('las reservas reducen el saldo libre sin modificar el stock físico al guardar',()=>{
  const code=app.slice(app.indexOf('function medranoReserved('),app.indexOf('function medranoCatalog('));
  const state={medranoMultiOrders:[{id:'a',estado:'pendiente'},{id:'b',estado:'dispensada'},{id:'c',estado:'pendiente'}],medranoMultiItems:[
    {comanda_id:'a',tipo:'flores',origen_id:'lot',cantidad:7},
    {comanda_id:'b',tipo:'flores',origen_id:'lot',cantidad:10},
    {comanda_id:'c',tipo:'flores',origen_id:'lot',cantidad:5},
  ]};
  const context={state,escapeHtml:s=>String(s)};
  vm.runInNewContext(`${code}\nglobalThis.reserved=medranoReserved;globalThis.availability=medranoAvailabilityHtml;`,context);
  assert.equal(context.reserved('flores','lot'),12);
  assert.equal(context.reserved('flores','lot','a'),5);
  assert.match(context.availability('flores','lot',3,'g'),/Libre: -9 g/);
});

test('la operación SQL admite saldos negativos y hace la dispensa atómica',()=>{
  assert.match(sql,/permitir_negativo boolean not null default true/);
  assert.match(sql,/drop constraint %I/);
  assert.match(sql,/create trigger proteger_reservas_flores/);
  assert.match(sql,/create trigger proteger_reservas_mostrador/);
  assert.match(sql,/create trigger proteger_reservas_laboratorio/);
  assert.match(sql,/estado='dispensada',dispensada_por=auth\.uid\(\),dispensada_at=now\(\)/);
  assert.match(sql,/set gramos_actual=gramos_actual-v_line\.cantidad/);
  assert.match(sql,/set cantidad=cantidad-v_line\.cantidad/);
  assert.doesNotMatch(sql,/where id=v_line\.origen_id and (?:cantidad|gramos_actual)>=v_line\.cantidad/);
  assert.match(sql,/estado='pendiente',dispensada_at=null/);
  assert.match(sql,/revoke all on public\.medrano_comandas_multiproducto,public\.medrano_comandas_multiproducto_items from public,anon,authenticated/);
});
