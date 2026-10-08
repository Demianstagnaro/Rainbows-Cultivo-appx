import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('la comanda muestra la fecha y hora del pago en horario de Argentina',()=>{
  const start=app.indexOf('function medranoOrderPaidAt(');
  const end=app.indexOf('function medranoPatientName(',start);
  const context={Date};
  vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.paidAt=medranoOrderPaidAt;`,context);
  assert.match(context.paidAt({pago_estado:'pagada',pagada_at:'2026-10-08T18:23:00Z'}),/(3:23 p\. m\.|15:23)/);
  assert.equal(context.paidAt({pago_estado:'pendiente'}),'—');
  assert.equal(context.paidAt({pago_estado:'historica'}),'Histórica · sin fecha registrada');
});

test('Administración permite buscar y ordenar las comandas dispensadas hoy',()=>{
  const start=app.indexOf('function renderMedranoOrders(');
  const end=app.indexOf('function dispensaryEvents(',start);
  const code=app.slice(start,end);
  assert.match(code,/Comandas dispensadas hoy/);
  assert.match(code,/data-stock-table-tools/);
  assert.match(code,/data-sort-type="text">Producto/);
  assert.match(code,/data-sort-type="number">Tokens/);
  assert.match(code,/data-sort-type="date">Pagada el/);
  assert.match(code,/data-sort-value="\$\{escapeHtml\(o\.pagada_at\|\|''\)\}"/);
});

test('Dispensario permite ordenar entregas y movimientos por todas sus columnas',()=>{
  const start=app.indexOf('function dispensaryEventsTable(');
  const end=app.indexOf('function renderMedranoDispensary(',start);
  const code=app.slice(start,end);
  for(const type of ['date','text','number'])assert.match(code,new RegExp(`data-sort-type="${type}"`));
  assert.match(code,/data-sort-type="date">Pagada el/);
  assert.match(code,/medranoOrderPaidAt\(row\.order\)/);
  assert.match(app,/Comandas entregadas y movimientos de hoy[\s\S]*?stockTableToolbar\('Buscar por hora, tipo, producto, paciente o responsable/);
  assert.match(app,/bindMedranoLoadRetry\(\);bindStockTableTools\(app\)/);
});
