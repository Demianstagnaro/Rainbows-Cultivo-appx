import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

function dashboardContext(){
  const start=app.indexOf('const medranoDashboardCategoryOrder=');
  const end=app.indexOf('function renderMedranoDashboard(',start);
  const state={medranoDashboardPeriod:'month',medranoDashboardMonth:'',medranoMultiOrders:[
    {id:'o1',paciente_id:'p1',estado:'dispensada',dispensada_at:'2026-10-02T12:00:00Z'},
    {id:'o2',paciente_id:'p1',estado:'dispensada',dispensada_at:'2026-10-07T12:00:00Z'},
    {id:'o3',paciente_id:'p2',estado:'dispensada',dispensada_at:'2026-09-20T12:00:00Z'},
    {id:'o4',paciente_id:'p3',estado:'pendiente',dispensada_at:null},
  ],medranoMultiItems:[
    {comanda_id:'o1',tipo:'flores',nombre:'Genética A',cantidad:10,unidad:'g',tokens_total:20},
    {comanda_id:'o1',tipo:'resina',nombre:'Rosin · Genética A',cantidad:2,unidad:'g',tokens_total:8},
    {comanda_id:'o2',tipo:'flores',nombre:'Genética B',cantidad:5,unidad:'g',tokens_total:10},
    {comanda_id:'o2',tipo:'mostrador',nombre:'Armador',cantidad:2,unidad:'unidades',tokens_total:3},
    {comanda_id:'o3',tipo:'cremas',nombre:'Crema 50 g',cantidad:1,unidad:'unidades',tokens_total:6},
  ],medranoCajaMovements:[
    {tipo:'ingreso',medio:'efectivo',monto:10000,created_at:'2026-10-02T12:00:00Z'},
    {tipo:'ingreso',medio:'digital',monto:5000,created_at:'2026-10-07T12:00:00Z'},
    {tipo:'egreso',medio:'efectivo',monto:2000,created_at:'2026-10-07T14:00:00Z'},
    {tipo:'ingreso',medio:'efectivo',monto:999,origen:'arqueo',created_at:'2026-10-07T15:00:00Z'},
    {tipo:'ingreso',medio:'efectivo',monto:9000,created_at:'2026-09-20T12:00:00Z'},
  ]};
  const context={state,Date,today:()=>new Date(2026,9,8),ymd:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,medranoJobDay:value=>String(value||'').slice(0,10),medranoOrderCategories:{flores:'Flores',resina:'Resina',cremas:'Cremas',aceites:'Aceites',capsulas:'Cápsulas',mostrador:'Mostrador'},formatMeasurementText:value=>String(value)};
  vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.summary=medranoDashboardSummary;`,context);
  return context;
}

test('el tablero calcula asociados, ingresos, comandas y Tokens del período',()=>{
  const summary=dashboardContext().summary('month');
  assert.equal(summary.associates,1);
  assert.equal(summary.orders.length,2);
  assert.equal(summary.income,15000);
  assert.equal(summary.efectivo,10000);
  assert.equal(summary.digital,5000);
  assert.equal(summary.tokens,41);
});

test('flores ignora genética y los demás productos se agrupan por nombre',()=>{
  const summary=dashboardContext().summary('month');
  const flowers=summary.productRows.find(row=>row.category==='flores');
  assert.equal(flowers.name,'Flores');
  assert.equal(flowers.quantity,15);
  assert.equal(flowers.tokens,30);
  assert.equal(summary.productRows.find(row=>row.category==='resina').name,'Rosin');
  assert.equal(summary.productRows.find(row=>row.category==='mostrador').name,'Armador');
});

test('el selector permite consultar un mes anterior completo',()=>{
  const context=dashboardContext();
  context.state.medranoDashboardMonth='2026-09';
  const summary=context.summary('month');
  assert.equal(summary.range.start,'2026-09-01');
  assert.equal(summary.range.end,'2026-09-30');
  assert.equal(summary.associates,1);
  assert.equal(summary.income,9000);
  assert.equal(summary.tokens,6);
  assert.equal(summary.productRows[0].name,'Crema 50 g');
});

test('Medrano es un tablero exclusivo para administradores y se carga bajo demanda',()=>{
  assert.match(app,/data-medrano-module="dashboard"[^>]*>Medrano</);
  assert.match(app,/\['today','dashboard'\]\.includes\(mv\)&&!isAdmin/);
  assert.match(app,/function renderMedranoDashboard[\s\S]*?currentRole\(\)!=='administrador'/);
  assert.match(app,/const dashboardPage=state\.medranoView==='dashboard'&&admin/);
  assert.match(app,/orderHistoryPage=dashboardPage\|\|/);
  assert.match(app,/openMedranoDataView\('dashboard'\)/);
  assert.match(app,/id="medrano-dashboard-month"[^>]*type="month"/);
  assert.match(styles,/\.medrano-dashboard-kpis/);
  assert.match(styles,/\.medrano-dashboard-categories/);
});
