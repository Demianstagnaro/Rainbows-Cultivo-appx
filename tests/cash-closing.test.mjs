import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.22_arqueo_caja.sql',import.meta.url),'utf8');

test('el arqueo conserva esperado, real, diferencia y responsable por día',()=>{
  assert.match(sql,/create table if not exists public\.medrano_caja_arqueos/i);
  assert.match(sql,/fecha date not null unique/i);
  for(const column of ['efectivo_esperado','efectivo_real','diferencia_efectivo','digital_esperado','digital_real','diferencia_digital','cerrado_por'])assert.match(sql,new RegExp(column,'i'));
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/grant select on public\.medrano_caja_arqueos to authenticated/i);
});

test('solamente Administración cierra y las diferencias generan ajustes trazables',()=>{
  assert.match(sql,/create or replace function public\.cerrar_caja_medrano/i);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/i);
  assert.match(sql,/p_efectivo_real-v_efectivo_esperado/i);
  assert.match(sql,/p_digital_real-v_digital_esperado/i);
  assert.match(sql,/Ajuste por arqueo diario · Efectivo/i);
  assert.match(sql,/Ajuste por arqueo diario · Digital/i);
  assert.match(sql,/'arqueo',auth\.uid\(\)/i);
});

test('el cierre y los movimientos del día comparten un bloqueo transaccional',()=>{
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('rainbows-caja-'/i);
  assert.match(sql,/create trigger bloquear_movimiento_caja_cerrada/i);
  assert.match(sql,/before insert on public\.medrano_caja_movimientos/i);
  assert.match(sql,/La Caja del % ya fue cerrada/i);
  assert.match(sql,/from public\.medrano_caja_arqueos where fecha=v_fecha/i);
});

test('la interfaz permite arquear, muestra diferencias y bloquea acciones tras cerrar',()=>{
  assert.match(html,/id="medrano-cash-closing-dialog"/);
  assert.match(html,/id="medrano-cash-closing-cash"/);
  assert.match(html,/id="medrano-cash-closing-digital"/);
  assert.match(app,/function openMedranoCashClosingDialog\(/);
  assert.match(app,/function saveMedranoCashClosing\(/);
  assert.match(app,/db\.rpc\('cerrar_caja_medrano'/);
  assert.match(app,/currentRole\(\)!=='administrador'/);
  assert.match(app,/closing\?'<span class="preparation-badge preparation-listo">Caja cerrada<\/span>'/);
  assert.match(app,/medranoCashClosingMarkup\(closing\)/);
});

test('los arqueos se cargan y actualizan junto con Caja',()=>{
  assert.match(app,/loadMedranoStockTable\('medrano_caja_arqueos'\)/);
  assert.match(app,/state\.medranoCashClosings=qs\[37\]\.data\|\|\[\]/);
  assert.match(app,/add\('cashClosings',loadMedranoStockTable\('medrano_caja_arqueos'\)\)/);
  assert.match(app,/state\.medranoCashClosings=result\.cashClosings\.data\|\|\[\]/);
});
