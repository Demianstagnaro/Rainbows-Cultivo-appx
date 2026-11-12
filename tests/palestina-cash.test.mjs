import test from 'node:test';import assert from 'node:assert/strict';
import {palestinaCashSummary,palestinaCashMonthShift} from '../palestina-cash.js';
test('Caja Palestina conserva el efectivo y agrupa todos los gastos, incluido Sueldo Cosecha',()=>{
 const categories=[{id:'s',nombre:'Sueldo Cosecha',tipo:'egreso'},{id:'p',nombre:'Producción',tipo:'egreso'}];
 const rows=[{tipo:'ingreso',medio:'efectivo',monto:500},{tipo:'egreso',medio:'efectivo',monto:200,categoria_id:'s'},{tipo:'egreso',medio:'transferencia',monto:90,categoria_id:'p'},{tipo:'ingreso',medio:'transferencia',monto:70},{tipo:'egreso',medio:'efectivo',monto:999,anulado_at:'2026-01-01'}];
 const result=palestinaCashSummary(rows,100,categories);
 assert.equal(result.final,400);assert.equal(result.expenses,290);assert.equal(result.transferIncome,70);assert.equal(result.categories[0].amount,200);assert.equal(result.categories[1].amount,90);
});
test('cantidad no multiplica el costo total y la suma respeta centavos',()=>{
 const result=palestinaCashSummary([{tipo:'egreso',medio:'efectivo',cantidad:100,monto:.1},{tipo:'egreso',medio:'efectivo',cantidad:2,monto:.2}],1);
 assert.equal(result.expenses,.3);assert.equal(result.final,.7);
});
test('selector mensual cambia de año en ambos sentidos',()=>{
 assert.equal(palestinaCashMonthShift('2026-12',1),'2027-01');assert.equal(palestinaCashMonthShift('2026-01',-1),'2025-12');
});
