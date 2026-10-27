import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('Hoy agrupa sus controles automáticos en una sola carga paralela',()=>{
  const loader=app.slice(app.indexOf('async function loadMedranoTodayControls('),app.indexOf('function openMedranoStockMinimumDialog('));
  assert.match(loader,/Promise\.all\(\[/);
  assert.match(loader,/db\.rpc\('revisar_integridad_medrano'\)/);
  assert.match(loader,/db\.rpc\('listar_control_stock_medrano'\)/);
  assert.match(loader,/medranoTodayControlsLoading=true/);
  assert.match(loader,/medranoTodayControlsLoading=false/);
});

test('Hoy programa una sola microtarea aunque falten ambos controles',()=>{
  const today=app.slice(app.indexOf('function renderMedranoToday('),app.indexOf('function renderMedrano(){'));
  assert.equal((today.match(/queueMicrotask/g)||[]).length,1);
  assert.match(today,/queueMicrotask\(\(\)=>loadMedranoTodayControls\(\)\)/);
  assert.doesNotMatch(today,/queueMicrotask\(\(\)=>loadMedranoIntegrity/);
  assert.doesNotMatch(today,/queueMicrotask\(\(\)=>loadMedranoStockControl/);
});

test('la carga combinada evita redibujar otra pantalla al terminar',()=>{
  const loader=app.slice(app.indexOf('async function loadMedranoTodayControls('),app.indexOf('function openMedranoStockMinimumDialog('));
  assert.match(loader,/const visible=\(\)=>state\.site==='medrano'&&state\.medranoView==='today'/);
  assert.match(loader,/if\(visible\(\)\)render\(\)/);
});
