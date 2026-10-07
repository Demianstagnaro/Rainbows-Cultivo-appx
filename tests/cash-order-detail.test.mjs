import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.24_detalle_comandas_caja.sql',import.meta.url),'utf8');
const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');

test('Caja conserva un detalle independiente para cada cobro de comanda',()=>{
  assert.match(sql,/alter table public\.medrano_caja_movimientos[\s\S]*add column if not exists detalle text/i);
  assert.match(sql,/create or replace function public\.detalle_comanda_caja\(p_comanda_id uuid\)/i);
  assert.match(sql,/string_agg\(/i);
  for(const field of ['i.cantidad','i.unidad','i.nombre','i.genetica_nombre','i.numero_lote'])assert.match(sql,new RegExp(field.replace('.','\\.'),'i'));
});

test('los cobros históricos se completan sin alterar dinero ni Tokens',()=>{
  assert.match(sql,/update public\.medrano_caja_movimientos m[\s\S]*set detalle=public\.detalle_comanda_caja\(m\.comanda_id\)/i);
  assert.match(sql,/where m\.origen='comanda'/i);
  assert.doesNotMatch(sql,/set monto=/i);
  assert.match(readme,/No modifica montos, Tokens ni saldos existentes/i);
});

test('los cobros nuevos guardan el detalle junto con el movimiento',()=>{
  assert.match(sql,/create or replace function public\.pagar_comanda_multiproducto/i);
  assert.match(sql,/v_detalle:=public\.detalle_comanda_caja\(v_c\.id\)/i);
  assert.match(sql,/tipo,medio,monto,concepto,detalle,tokens,paciente_id,comanda_id,origen,creado_por/i);
  assert.match(sql,/'Cobro de comanda · '\|\|v_c\.paciente_nombre,v_detalle/i);
});

test('Caja muestra los productos en una columna propia y escapa el contenido',()=>{
  assert.match(app,/function medranoCashMovementDetail\(movement\)/);
  assert.match(app,/Detalle de la comanda/);
  assert.match(app,/escapeHtml\(formatMeasurementText\(line\)\)/);
  assert.match(app,/medranoCashMovementDetail\(m\)/);
  assert.match(app,/colspan="8"/);
});

test('la versión no incluye ni requiere el control físico pausado',()=>{
  assert.match(readme,/no incluye ni requiere el Control de stock V3\.26\.23 que quedó en pausa/i);
  assert.doesNotMatch(app,/renderMedranoStockControl|registrar_control_stock_medrano/);
});
