import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('la carga separa los datos de Palestina y Medrano',()=>{
  assert.match(app,/const medranoPage=state\.site==='medrano'&&canAccessMedrano\(\)/);
  assert.match(app,/const palestinaPage=!medranoPage/);
  assert.match(app,/palestinaPage\?db\.from\('tareas'\)\.select\('\*'\):empty\(\)/);
  assert.match(app,/medranoDataPage\?loadMedranoStockTable\('medrano_laboratorio_stock'\):empty\(\)/);
  assert.match(app,/admin&&palestinaPage\?db\.from\('cosechas'\)/);
  assert.match(app,/medranoDataPage\?db\.from\('medrano_pacientes'\)/);
});

test('cambiar de sede muestra carga y trae únicamente sus datos',()=>{
  const code=app.slice(app.indexOf('function setSite('),app.indexOf('function renderSiteShell('));
  assert.match(code,/Cargando la sede…/);
  assert.match(code,/refresh\(\)/);
  assert.match(code,/renderSiteShell\(\)/);
});

test('las transferencias se conservan en ambas sedes',()=>{
  assert.match(app,/!todaySummaryOnly&&\(stockAccess\|\|canAccessMedrano\(\)\)\?db\.from\('stock_transferencias'\)/);
  assert.match(app,/!todaySummaryOnly&&\(stockAccess\|\|canAccessMedrano\(\)\)\?db\.from\('stock_transferencia_items'\)/);
});
