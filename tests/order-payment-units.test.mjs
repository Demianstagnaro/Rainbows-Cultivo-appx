import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.6_cobro_dispensa_y_unidades.sql',import.meta.url),'utf8');

test('Administración cobra y Administración o Dispensario confirman la entrega',()=>{
  assert.match(app,/function medranoOrderActionsHtml\(order,area='administracion'\)/);
  assert.match(app,/const canCharge=area==='administracion',canDispense=\['administracion','dispensario'\]\.includes\(area\)/);
  assert.match(app,/medranoOrderActionsHtml\(o,'dispensario'\)/);
  assert.match(app,/Administración debe confirmar primero el cobro de la comanda/);
  assert.doesNotMatch(app,/Cobrar y dispensar comanda/);
  assert.match(sql,/if v_pago <> 'pagada' then[\s\S]*Administración debe confirmar primero el cobro/i);
  assert.doesNotMatch(sql,/perform public\.pagar_comanda_multiproducto/i);
});

test('los productos por unidades usan contadores y validación enteros',()=>{
  assert.match(app,/function configureWholeUnitInput\(input,unit,allowZero=false\)/);
  assert.match(app,/input\.step=whole\?'1':'0\.01'/);
  assert.match(app,/input\.inputMode=whole\?'numeric':'decimal'/);
  assert.match(app,/product\.unit==='unidades'&&!Number\.isInteger\(item\.cantidad\)/);
  assert.match(sql,/new\.unidad = 'unidades' and new\.cantidad <> trunc\(new\.cantidad\)/i);
  assert.match(sql,/before insert or update of cantidad,unidad/i);
});
