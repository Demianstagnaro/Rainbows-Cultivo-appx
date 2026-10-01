import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.25.11_detalle_movimientos_resina.sql',import.meta.url),'utf8');

test('el historial oculta el UUID técnico de las producciones',()=>{
  const start=app.indexOf('function medranoMovementAction('),end=app.indexOf('\n',start);
  const context={};vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.clean=medranoMovementAction;`,context);
  assert.equal(context.clean('Producción laboratorio · resultado · 0d4811fd-7547-4d12-b2a8-0cd0ac6a07a9'),'Producción laboratorio · resultado');
  assert.equal(context.clean('Producción laboratorio · consumo · 0d4811fd-7547-4d12-b2a8-0cd0ac6a07a9'),'Producción laboratorio · consumo');
  assert.equal(context.clean('Recepción confirmada · Dispensario → Laboratorio'),'Recepción confirmada · Dispensario → Laboratorio');
  assert.match(app,/escapeHtml\(medranoMovementAction\(row\.accion\)\)/);
});

test('los movimientos de Resina explican producto, perfil, ratio, genética y lote',()=>{
  assert.match(app,/Movimiento y detalle/);
  assert.match(app,/detail=medranoMovementDetail\(row\)/);
  assert.match(app,/`Ratio \$\{ratio\}`/);
  assert.match(app,/`Genética \$\{genetic\}`/);
  assert.match(sql,/add column if not exists detalle text/i);
  assert.match(sql,/Ratio '\|\|replace\(btrim\(v_new->>'proporcion_cannabinoides'\),'-',':'\)/i);
  assert.match(sql,/Genética '\|\|btrim\(v_genetica\)/i);
  assert.match(sql,/Lote '\|\|btrim\(v_new->>'lote'\)/i);
  assert.match(sql,/update public\.medrano_stock_historial h[\s\S]*h\.categoria = 'resina'/i);
});
