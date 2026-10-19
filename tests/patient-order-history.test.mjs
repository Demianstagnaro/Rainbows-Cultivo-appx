import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('Historial de pacientes es una pantalla separada del registro general',()=>{
  assert.match(app,/id="medrano-open-patient-history"[^>]*><strong>Historial de pacientes<\/strong>/);
  assert.match(app,/openMedranoDataView\('administracion-pacientes-historial'\)/);
  assert.match(app,/if\(mv==='administracion-pacientes-historial'\)\{renderMedranoPatientHistory/);
  const patientList=app.slice(app.indexOf('function renderMedranoPatients('),app.indexOf('const medranoOrderCategories='));
  assert.doesNotMatch(patientList,/Historial de pacientes|medrano-open-patient-history/);
});

test('la selección permite buscar por paciente, socio o DNI',()=>{
  const history=app.slice(app.indexOf('function renderMedranoPatientHistory('),app.indexOf('function medranoReserved('));
  assert.match(history,/Buscar por nombre, apellido, número de socio o DNI/);
  assert.match(history,/data-patient-history-select/);
  assert.match(history,/medranoSortedPatients\(\)/);
  assert.match(styles,/\.patient-history-picker/);
});

test('cada paciente reúne sus pedidos sin duplicados y en orden reciente',()=>{
  const start=app.indexOf('function medranoPatientOrderStatus(');
  const end=app.indexOf('function medranoPatientOrderProducts(',start);
  const code=app.slice(start,end);
  const state={
    medranoOrders:[
      {id:'pendiente',paciente_id:'p1',fecha:'2026-10-18',created_at:'2026-10-18T10:00:00Z'},
      {id:'otro',paciente_id:'p2',fecha:'2026-10-19',created_at:'2026-10-19T10:00:00Z'}
    ],
    medranoDispensedOrders:[
      {id:'entregada',multiple:true,paciente_id:'p1',fecha:'2026-10-10',dispensada_at:'2026-10-19T12:00:00Z'},
      {id:'entregada',multiple:true,paciente_id:'p1',fecha:'2026-10-10',dispensada_at:'2026-10-19T12:00:00Z'}
    ],
    medranoDeletedOrders:[{id:'borrada',paciente_id:'p1',eliminada_at:'2026-10-17T09:00:00Z'}]
  };
  const context={state,Set,String};
  vm.runInNewContext(`${code}\nglobalThis.patientOrders=medranoPatientOrders;globalThis.status=medranoPatientOrderStatus;`,context);
  const rows=Array.from(context.patientOrders('p1'));
  assert.deepEqual(rows.map(row=>row.id),['entregada','pendiente','borrada']);
  assert.equal(context.status(rows[0]).label,'Dispensada');
  assert.equal(context.status(rows[2]).label,'Eliminada');
});

test('el detalle conserva productos, trazabilidad, tokens, pago y entrega',()=>{
  assert.match(app,/function medranoPatientOrderProducts\(order\)[\s\S]*?medranoOrderItemTable\(order\)/);
  assert.match(app,/Pedidos del paciente/);
  assert.match(app,/Tokens registrados/);
  assert.match(app,/<dt>Pago<\/dt>/);
  assert.match(app,/<dt>Entrega<\/dt>/);
  assert.match(app,/<dt>Entregada por<\/dt>/);
  assert.match(app,/incluye pendientes, dispensados y eliminados/);
});

test('el historial completo se descarga sólo al abrir esta pantalla',()=>{
  assert.match(app,/orderHistoryPage=dashboardPage\|\|state\.medranoView==='administracion-pacientes-historial'/);
  assert.match(app,/loadMedranoStockTable\('medrano_comandas',orderHistoryPage\?Infinity:1000\)/);
  assert.match(app,/loadMedranoStockTable\('medrano_comandas_multiproducto',orderHistoryPage\?Infinity:1000\)/);
  assert.match(app,/loadMedranoStockTable\('medrano_comandas_multiproducto_items',orderHistoryPage\?Infinity:4000\)/);
});
