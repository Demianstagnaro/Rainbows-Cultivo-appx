import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.20.0_dispensario.sql',import.meta.url),'utf8');

test('el cierre diario mueve entregas y traslados al historial sin perder pendientes',()=>{
  const code=app.slice(app.indexOf('function dispensaryEvents('),app.indexOf('function renderMedranoDispensary('));
  const state={medranoOrders:[
    {id:'pending',producto:'Pendiente',fecha:'2026-09-16'},
    {id:'today',producto:'Aceite',cantidad:1,nombre_paciente:'Ana',dispensada_at:'2026-09-17T14:00:00Z',dispensada_fecha:'2026-09-17'},
  ],medranoDispensedOrders:[
    {id:'yesterday',producto:'Flor',cantidad:2,dispensada_at:'2026-09-16T16:00:00Z',dispensada_fecha:'2026-09-16'},
  ],medranoLabDispMovements:[
    {fecha:'2026-09-17',producto:'Crema',categoria:'cremas',cantidad:2,unidad:'unidades',created_at:'2026-09-17T18:00:00Z'},
    {fecha:'2026-09-16',producto:'Resina',categoria:'resina',cantidad:3,unidad:'g',created_at:'2026-09-16T18:00:00Z'},
  ],medranoLabTransfers:[
    {created_at:'2026-09-17T18:00:00Z',nombre:'Flores',gramos:5,codigo_lote:'F1',estado:'en_viaje'},
    {created_at:'2026-09-16T18:00:00Z',nombre:'Flores de ayer',gramos:4,codigo_lote:'F2',estado:'recibido'},
  ],perfiles:[]};
  const context={state,medranoOrderHistoryDate:o=>o.dispensada_fecha||o.fecha,medranoTransferDate:o=>o.created_at.slice(0,10),medranoLabCategoryName:x=>x,formatGrams:x=>`${x} g`,escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),canManageMedrano:()=>false};
  vm.runInNewContext(`${code}\nglobalThis.events=dispensaryEvents;globalThis.table=dispensaryEventsTable;`,context);
  assert.deepEqual(Array.from(context.events('2026-09-17'),x=>x.product),['Crema','Flores','Aceite']);
  assert.deepEqual(Array.from(context.events('2026-09-16'),x=>x.product),['Resina','Flores de ayer','Flor']);
  assert.match(context.events('2026-09-17')[1].kind,/Dispensario → Laboratorio/);
  assert.equal(state.medranoOrders[0].producto,'Pendiente');
  assert.doesNotMatch(context.table([{kind:'Comanda',product:'<img>',quantity:'1',detail:'<script>',actor:'<svg>',timestamp:'2026-09-17T12:00:00Z'}]),/<img|<script|<svg/);
});

test('la interfaz solo permite iniciar el traslado desde Dispensario hacia Laboratorio',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(app.includes("$('dispensary-new-movement');if(move)move.onclick=openMedranoLabTransfer"));
  assert.doesNotMatch(app,/id="send-lab-stock"|openLabDispensaryMovement|mover_laboratorio_a_dispensario/);
  assert.doesNotMatch(html,/id="lab-dispensary-dialog"/);
  const correction=fs.readFileSync(new URL('../Rainbows_V3.20.1_direccion_traslados.sql',import.meta.url),'utf8');
  assert.match(correction,/revoke execute on function public\.mover_laboratorio_a_dispensario\(uuid,numeric\) from authenticated/);
  assert.match(app,/medranoDailyHistory\('laboratorio',category\.key,'today'\)/);
  assert.match(app,/medranoDailyHistory\('dispensario','flores','today'\)/);
});

test('el traslado valida permisos, stock y graba ambos lados atómicamente',()=>{
  assert.match(sql,/begin;[\s\S]*create or replace function public\.mover_laboratorio_a_dispensario/);
  assert.match(sql,/usuario_rainbows_medrano\(\)/);
  assert.match(sql,/from public\.medrano_laboratorio_stock where id=p_item_id for update/);
  assert.match(sql,/if v_item\.cantidad < p_cantidad then/);
  assert.match(sql,/set cantidad=cantidad-p_cantidad/);
  assert.match(sql,/set gramos_actual=gramos_actual\+p_cantidad/);
  assert.match(sql,/on conflict \(origen_item_id\) do update/);
  assert.match(sql,/insert into public\.medrano_laboratorio_dispensario_movimientos/);
  assert.match(sql,/revoke all on public\.medrano_dispensario_laboratorio_stock, public\.medrano_laboratorio_dispensario_movimientos from public, anon, authenticated/);
  assert.match(sql,/commit;/);
});
