import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const sql=read('Rainbows_V3.26.53_alertas_stock_minimo.sql');
const app=read('app.js');
const html=read('index.html');
const styles=read('styles.css');

test('los mínimos son configurables solamente por Administración',()=>{
  assert.match(sql,/create table if not exists public\.medrano_stock_minimos/);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/);
  assert.match(sql,/revoke all on table public\.medrano_stock_minimos from public,anon,authenticated/);
  assert.match(sql,/revoke all on function public\.guardar_minimos_stock_medrano\(jsonb\)/);
});

test('el control calcula saldo libre descontando comandas y producciones',()=>{
  assert.match(sql,/reservas_comandas as/);
  assert.match(sql,/reservas_produccion as/);
  assert.match(sql,/f\.stock_fisico-coalesce\(r\.cantidad,0\)/);
  assert.match(sql,/when f\.stock_fisico-coalesce\(r\.cantidad,0\)<=0 then 'sin_stock'/);
  assert.match(sql,/when f\.stock_fisico-coalesce\(r\.cantidad,0\)<=m\.minimo then 'bajo'/);
});

test('Hoy muestra alertas y permite abrir el stock relacionado',()=>{
  const today=app.slice(app.indexOf('function renderMedranoToday('),app.indexOf('function renderMedrano(){'));
  assert.match(app,/function medranoStockControlMarkup\(\)/);
  assert.match(app,/db\.rpc\('listar_control_stock_medrano'\)/);
  assert.match(today,/medranoStockControlMarkup\(\)/);
  assert.match(today,/loadMedranoTodayControls\(\)/);
  assert.match(today,/data-stock-control-target/);
  assert.match(styles,/\.medrano-stock-alert-card\.is-ok/);
});

test('el diálogo guarda mínimos por producto o lote y admite dejarlos sin control',()=>{
  assert.match(html,/id="medrano-stock-minimum-dialog"/);
  assert.match(html,/Dejá vacío un producto si no querés controlarlo/);
  assert.match(app,/function openMedranoStockMinimumDialog\(\)/);
  assert.match(app,/function saveMedranoStockMinimums\(\)/);
  assert.match(app,/db\.rpc\('guardar_minimos_stock_medrano'/);
  assert.match(app,/Los mínimos en unidades deben ser números enteros/);
});
