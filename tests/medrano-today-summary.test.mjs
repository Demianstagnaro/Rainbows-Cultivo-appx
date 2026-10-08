import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
test('Medrano precarga sus datos operativos para que las pestañas abran sin espera',()=>{
  assert.doesNotMatch(app,/db\.rpc\('resumen_medrano_hoy'\)/);
  assert.doesNotMatch(app,/medranoTodaySummaryOnly|todaySummaryOnly|medranoDataPage/);
  assert.match(app,/medranoPage\?loadMedranoStockTable\('medrano_comandas_multiproducto'/);
  assert.match(app,/medranoPage\?loadMedranoStockTable\('medrano_laboratorio_stock'\)/);
  assert.match(app,/medranoPage\?loadMedranoStockTable\('medrano_laboratorio_trabajos'/);
});

test('cambiar entre pestañas usa los datos ya cargados',()=>{
  assert.match(app,/if\(b\.dataset\.medranoModule==='dashboard'\)\{openMedranoDataView\('dashboard'\);return\}state\.medranoView=b\.dataset\.medranoModule;render\(\)/);
  assert.match(app,/const dashboardPage=state\.medranoView==='dashboard'&&admin/);
  assert.match(app,/state\.medranoView=button\.dataset\.medranoTodayTarget/);
  assert.doesNotMatch(app,/Cargando sección…/);
});
