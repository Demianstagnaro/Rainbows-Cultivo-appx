import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('el historial oculta el UUID técnico de las producciones',()=>{
  const start=app.indexOf('function medranoMovementAction('),end=app.indexOf('\n',start);
  const context={};vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.clean=medranoMovementAction;`,context);
  assert.equal(context.clean('Producción laboratorio · resultado · 0d4811fd-7547-4d12-b2a8-0cd0ac6a07a9'),'Producción laboratorio · resultado');
  assert.equal(context.clean('Producción laboratorio · consumo · 0d4811fd-7547-4d12-b2a8-0cd0ac6a07a9'),'Producción laboratorio · consumo');
  assert.equal(context.clean('Recepción confirmada · Dispensario → Laboratorio'),'Recepción confirmada · Dispensario → Laboratorio');
  assert.match(app,/escapeHtml\(medranoMovementAction\(row\.accion\)\)/);
});
