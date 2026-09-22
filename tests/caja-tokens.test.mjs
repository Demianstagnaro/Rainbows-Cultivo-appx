import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.24.0_caja_tokens.sql');

test('Caja aparece dentro de Administración y separa efectivo de digital',()=>{
  assert.match(app,/id="medrano-open-caja"/);
  assert.match(app,/function renderMedranoCaja\(/);
  assert.match(app,/medranoCashBalance\('efectivo'\)/);
  assert.match(app,/medranoCashBalance\('digital'\)/);
  assert.match(html,/id="medrano-cash-dialog"/);
});

test('los productos tienen valor fijo y la comanda calcula Tokens por cantidad',()=>{
  assert.match(sql,/medrano_tokens_por_unidad/);
  assert.match(sql,/tokens_por_unidad/);
  assert.match(sql,/new\.tokens_total:=round\(v_precio\*new\.cantidad,2\)/);
  assert.match(app,/function updateMedranoMultiTotal\(/);
  assert.match(app,/Configurá el valor en Tokens/);
});

test('pagar consume Tokens y sólo cobra el faltante a 1000 pesos',()=>{
  assert.match(sql,/v_faltan:=greatest\(v_c\.tokens_total-v_saldo,0\)/);
  assert.match(sql,/v_faltan\*1000/);
  assert.match(sql,/'consumo',-v_c\.tokens_total/);
  assert.match(sql,/set pago_estado='pagada'/);
  assert.match(sql,/revoke insert,update on public\.medrano_pacientes from authenticated/);
  assert.doesNotMatch(sql,/grant update\([^)]*saldo_tokens/);
});

test('dispensar una comanda usa el cierre atómico de pago y stock',()=>{
  assert.match(sql,/perform public\.pagar_comanda_multiproducto\(p_id,p_medio\)/);
  assert.match(sql,/perform public\.dispensar_comanda_multiproducto\(p_id\)/);
  assert.match(sql,/revoke execute on function public\.dispensar_comanda_multiproducto\(uuid\) from authenticated/);
  assert.match(app,/db\.rpc\('cerrar_comanda_multiproducto'/);
});

test('la compra anticipada acredita saldo y registra Caja',()=>{
  assert.match(sql,/create or replace function public\.acreditar_tokens_paciente/);
  assert.match(sql,/p_tokens\*1000/);
  assert.match(app,/id="medrano-credit-open"/);
  assert.match(html,/id="medrano-credit-dialog"/);
});

test('una comanda pagada no se edita y al cancelarla reintegra Tokens',()=>{
  assert.match(sql,/Una comanda pagada no se puede editar/);
  assert.match(sql,/'reintegro',v_c\.tokens_total/);
  assert.match(app,/order\.pago_estado!=='pagada'/);
  assert.match(app,/eliminar_comanda_tokens/);
});
