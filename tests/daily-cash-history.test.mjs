import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('Caja separa apertura, ingresos, egresos y cierre por medio',()=>{
  assert.match(app,/function medranoCashDaySummary\(day\)/);
  assert.match(app,/initial\+income-expense/);
  assert.match(app,/Saldo inicial/);
  assert.match(app,/Ingresos/);
  assert.match(app,/Egresos/);
  assert.match(app,/Saldo final/);
  assert.match(app,/medranoCashBalanceCard\('Efectivo'/);
  assert.match(app,/medranoCashBalanceCard\('Digital'/);
});

test('el cierre anterior pasa sin duplicarse a la apertura siguiente',()=>{
  const start=app.indexOf('function medranoCashMovementDay(');
  const end=app.indexOf('function openMedranoCashDialog(',start);
  const code=app.slice(start,end);
  const state={medranoCajaMovements:[
    {created_at:'2026-10-06T12:00:00Z',medio:'efectivo',tipo:'ingreso',monto:1000},
    {created_at:'2026-10-06T15:00:00Z',medio:'digital',tipo:'ingreso',monto:3000},
    {created_at:'2026-10-07T13:00:00Z',medio:'efectivo',tipo:'egreso',monto:250},
  ]};
  const context={state,medranoJobDay:value=>String(value).slice(0,10)};
  vm.runInNewContext(`${code}\nglobalThis.summary=medranoCashDaySummary;`,context);
  const previous=context.summary('2026-10-06'),next=context.summary('2026-10-07');
  assert.equal(previous.efectivo.final,1000);
  assert.equal(previous.digital.final,3000);
  assert.equal(next.efectivo.initial,previous.efectivo.final);
  assert.equal(next.digital.initial,previous.digital.final);
  assert.equal(next.efectivo.final,750);
});

test('la pantalla principal muestra sólo los movimientos del día actual',()=>{
  assert.match(app,/const todayKey=ymd\(today\(\)\),summary=medranoCashDaySummary\(todayKey\)/);
  assert.match(app,/Caja de hoy/);
  assert.match(app,/medranoCashMovementTable\(summary\.rows\)/);
  assert.match(app,/El saldo inicial continúa automáticamente el cierre anterior/);
});

test('el historial agrupa por año, mes y día y conserva el responsable',()=>{
  assert.match(app,/function renderMedranoCajaHistory\(/);
  assert.match(app,/administracion-caja-historial/);
  assert.match(app,/const years=\[\.\.\.new Set\(days\.map\(day=>day\.slice\(0,4\)\)\)\]/);
  assert.match(app,/const months=\[\.\.\.new Set\(yearDays\.map\(day=>day\.slice\(0,7\)\)\)\]/);
  assert.match(app,/Registrado por/);
  assert.match(app,/m\.creado_por/);
  assert.match(styles,/\.caja-balance-card/);
  assert.match(styles,/\.caja-history-level/);
});
