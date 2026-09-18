import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.19.0_stock_medrano.sql',import.meta.url),'utf8');
test('historial diario separa los inventarios y escapa productos y usuarios',()=>{
  const code=app.slice(app.indexOf('function medranoDailyHistory('),app.indexOf('function openMedranoLabTransfer('));
  const escape=app.slice(app.indexOf('function escapeHtml(value){'),app.indexOf('function formatGenotype('));
  const row={sector:'laboratorio',categoria:'flores',fecha:'2026-09-15',created_at:'2026-09-15T15:00:00Z',producto:'<img src=x>',usuario_nombre:'<svg>',cantidad_anterior:0,cantidad_nueva:40,unidad:'g',accion:'Recepción',lote:'TEST'};
  const context={state:{medranoStockReady:true,medranoStockHistory:[row,{...row,sector:'dispensario',producto:'No mostrar'}]},parse:s=>new Date(s+'T12:00:00Z'),Date,ymd:()=>'2026-09-18',today:()=>new Date('2026-09-18T12:00:00Z')};
  vm.runInNewContext(`${escape}\n${code}\nglobalThis.history=medranoDailyHistory;`,context);
  const html=context.history('laboratorio','flores');
  assert.match(html,/stock-day-group/);
  assert.match(html,/&lt;img/);
  assert.match(html,/&lt;svg/);
  assert.doesNotMatch(html,/<img|<svg|No mostrar/);
});
test('envío y recepción de flores se muestran como un único traslado',()=>{
  const code=app.slice(app.indexOf('function medranoDailyHistory('),app.indexOf('function medranoStockHistoryButton('));
  const state={medranoStockReady:true,perfiles:[{id:'sender',nombre:'Ana'}],medranoStockHistory:[
    {id:'receipt',sector:'laboratorio',categoria:'flores',fecha:'2026-09-18',created_at:'2026-09-18T15:01:00Z',producto:'Flores',lote:'F1',cantidad_anterior:10,cantidad_nueva:15,unidad:'g',accion:'Recepción confirmada · Dispensario → Laboratorio',usuario_nombre:'Luis'},
    {id:'unrelated',sector:'laboratorio',categoria:'resina',fecha:'2026-09-18',created_at:'2026-09-18T12:00:00Z',producto:'Resina',cantidad_anterior:1,cantidad_nueva:2,unidad:'g',accion:'Ajuste',usuario_nombre:'Luis'},
  ],medranoLabTransfers:[{created_at:'2026-09-18T14:00:00Z',recibido_at:'2026-09-18T15:01:01Z',nombre:'Flores',codigo_lote:'F1',gramos:5,estado:'recibido',enviado_por:'sender'}]};
  const context={state,ymd:()=> '2026-09-18',today:()=>new Date('2026-09-18T12:00:00Z'),medranoTransferDate:()=> '2026-09-18',formatGrams:n=>`${n} g`,parse:s=>new Date(s+'T12:00:00Z'),escapeHtml:s=>String(s),Date};
  vm.runInNewContext(`${code}\nglobalThis.history=medranoDailyHistory;`,context);
  const html=context.history('laboratorio','flores','today');
  assert.equal((html.match(/<tr>/g)||[]).length,2); // Encabezado y un solo traslado.
  assert.match(html,/<td>Dispensario → Laboratorio<\/td><td>\+5 g<\/td>/);
  assert.doesNotMatch(html,/Confirmado|En viaje/);
  assert.match(html,/10 → 15 g/);
  assert.doesNotMatch(html,/Recepción confirmada · Dispensario/);
  assert.doesNotMatch(html,/Resina/);
  state.medranoLabTransfers[0].estado='en_viaje';
  state.medranoLabTransfers[0].recibido_at=null;
  state.medranoStockHistory=state.medranoStockHistory.filter(row=>row.id!=='receipt');
  const pending=context.history('laboratorio','flores','today');
  assert.match(pending,/<td>Dispensario → Laboratorio<\/td><td>5 g<\/td><td>Pendiente de recepción<\/td>/);
});
test('traslados usan bloqueo, descuento atómico y una sola recepción',()=>{
  assert.match(sql,/for update/g);
  assert.match(sql,/gramos_actual = gramos_actual - \$1/);
  assert.match(sql,/v_t\.estado <> 'en_viaje'/);
  assert.match(sql,/on conflict \(origen_lote_id\) do update/);
  assert.match(app,/enviar_flores_laboratorio/);
  assert.match(app,/recibir_flores_laboratorio/);
});
test('todos los inventarios tienen historial automático protegido',()=>{
  for(const table of ['medrano_dispensario_lotes','medrano_mostrador_productos','medrano_laboratorio_stock'])assert.match(sql,new RegExp(`after insert or update on public\\.${table}`));
  assert.match(sql,/revoke all on public\.medrano_laboratorio_stock, public\.medrano_traslados_laboratorio, public\.medrano_stock_historial from anon, authenticated/);
  assert.match(app,/medranoDailyHistory\('dispensario','mostrador','today'\)/);
  assert.match(app,/medranoDailyHistory\('dispensario','flores','today'\)/);
  assert.match(app,/medranoDailyHistory\('laboratorio',category\.key,'today'\)/);
});
