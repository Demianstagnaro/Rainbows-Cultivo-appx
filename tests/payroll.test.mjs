import test from 'node:test';import assert from 'node:assert/strict';import {payrollEstimate,payrollSummary,payrollDates} from '../palestina-payroll.js';
const tariff={jornada:900,horas:9,sabado:300,domingo:400};
test('sueldos calcula jornada, media jornada, horas, guardias y ausencia',()=>{
 for(const [type,hours,amount]of [['completa',0,900],['media',0,450],['horas',2,200],['sabado',0,300],['domingo',0,400],['ausente',0,0]])assert.equal(payrollEstimate(tariff,type,hours).amount,amount);
 assert.equal(payrollEstimate({...tariff,sabado:null},'sabado',0).amount,300);
 assert.equal(payrollEstimate({...tariff,domingo:null},'domingo',0).amount,400);
 assert.equal(payrollEstimate({jornada:1000,horas:9},'horas',1).amount,111.11);
});
test('sueldos arrastra saldo, cuenta presencias y ausencias, resta pagos y excluye anulados',()=>{
 const employees=[{id:'a',saldo_anterior:100},{id:'b',saldo_anterior:0}],records=[{empleado_id:'a',clase:'asistencia',tipo:'media',importe:450},{empleado_id:'a',clase:'asistencia',tipo:'ausente',importe:0},{empleado_id:'a',clase:'pago',importe:200},{empleado_id:'a',clase:'ajuste',importe:-50},{empleado_id:'a',clase:'pago',importe:999,anulado_at:'2026-01-01'},{empleado_id:'b',clase:'pago',importe:500}];
 const [a,b]=payrollSummary(employees,records);assert.equal(a.balance,300);assert.equal(a.days,1);assert.equal(a.absences,1);assert.equal(a.accrued,450);assert.equal(b.balance,-500);
});
test('grilla respeta meses cortos y años bisiestos',()=>{
 assert.equal(payrollDates('2026-02').length,28);assert.equal(payrollDates('2028-02').length,29);assert.equal(payrollDates('2026-11').at(-1),'2026-11-30');
});

test('sueldo mensual se suma una sola vez y no cuenta como día trabajado',()=>{
 const t={jornada:1200,horas:1,modalidad:'mensual'};
 assert.deepEqual(payrollEstimate(t,'mensual',0),{hours:0,amount:1200});
 const [e]=payrollSummary([{id:'n',saldo_anterior:0}],[{empleado_id:'n',clase:'asistencia',tipo:'mensual',importe:1200},{empleado_id:'n',clase:'pago',importe:300},{empleado_id:'n',clase:'pago',importe:400}]);
 assert.equal(e.accrued,1200);assert.equal(e.days,0);assert.equal(e.balance,500);
});
