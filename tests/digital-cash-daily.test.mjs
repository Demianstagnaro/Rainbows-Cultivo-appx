import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const jobDay=Function('return ('+app.match(/^function medranoJobDay.*$/m)[0]+')')();
const code=app.slice(app.indexOf('function medranoCashMovementDay('),app.indexOf('function openMedranoCashDialog('));
const state={medranoCajaMovements:[
 {created_at:'2026-11-10T12:00:00Z',medio:'digital',tipo:'ingreso',monto:1000,origen:'comanda'},
 {created_at:'2026-11-10T20:00:00Z',medio:'digital',tipo:'ingreso',monto:500,origen:'arqueo'},
 {created_at:'2026-11-11T02:59:59Z',medio:'digital',tipo:'ingreso',monto:200,origen:'manual'},
 {created_at:'2026-11-11T03:00:00Z',medio:'digital',tipo:'ingreso',monto:100,origen:'comanda'},
 {created_at:'2026-11-11T12:00:00Z',medio:'digital',tipo:'egreso',monto:20,origen:'manual'},
 {created_at:'2026-11-11T13:00:00Z',medio:'digital',tipo:'ingreso',monto:7,origen:'arqueo'},
 {created_at:'2026-11-10T12:00:00Z',medio:'efectivo',tipo:'ingreso',monto:500},
 {created_at:'2026-11-11T12:00:00Z',medio:'efectivo',tipo:'ingreso',monto:200},
 {created_at:'2026-11-11T18:00:00Z',medio:'efectivo',tipo:'egreso',monto:50,origen:'arqueo'},
]};
const context={state,medranoJobDay:jobDay,medranoCashTodayKey:()=> '2026-11-11'};
vm.runInNewContext(code+';globalThis.cash={summary:medranoCashDaySummary,balance:medranoCashBalance};',context);
test('Digital sólo usa el día de Buenos Aires, sin arrastre ni ajustes históricos',()=>{
 const today=context.cash.summary('2026-11-11');
 assert.equal(today.digital.initial,0);assert.equal(today.digital.income,100);assert.equal(today.digital.expense,20);assert.equal(today.digital.final,80);
 assert.equal(context.cash.summary('2026-11-10').digital.final,1200);
 assert.equal(context.cash.summary('2026-11-12').digital.final,0);
 assert.equal(context.cash.balance('digital'),80);
});
test('Efectivo acumula el saldo y sus ajustes; el historial conserva todos los movimientos',()=>{
 const today=context.cash.summary('2026-11-11');assert.equal(today.efectivo.initial,500);assert.equal(today.efectivo.final,650);
 assert.equal(context.cash.summary('2026-11-12').efectivo.initial,650);
 assert.equal(today.rows.filter(x=>x.medio==='digital').length,3);
 assert.ok(today.rows.some(x=>x.monto===7&&x.origen==='arqueo'));
});
