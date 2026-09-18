import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const app=read('app.js'),sql=read('Rainbows_V3.23.0_produccion_laboratorio.sql'),html=read('index.html');

test('la extracción toma un lote de flores y muestra materias primas y retorno por separado',()=>{
  const code=app.slice(app.indexOf('const medranoJobTypes='),app.indexOf('function renderMedrano(){'));
  const state={medranoLabItems:[{id:'lote',categoria:'flores',nombre:'MC',lote:'F1C9',cantidad:100,unidad:'g',activo:true}],medranoLabMaterials:[{trabajo_id:'trabajo',categoria:'flores',nombre:'MC',cantidad:100,unidad:'g'}],perfiles:[]};
  const context={state,escapeHtml:x=>String(x).replaceAll('<','&lt;').replaceAll('>','&gt;'),canManageMedrano:()=>false,medranoLabCategoryName:x=>x,parse:x=>new Date(`${x}T12:00:00Z`),Date};
  vm.runInNewContext(`${code}\nglobalThis.renderRow=medranoLabJobRows;globalThis.materialRow=labProductionMaterialRow;`,context);
  assert.match(context.materialRow('flores'),/MC · F1C9 \(100 g\)/);
  const row=context.renderRow([{id:'trabajo',tipo:'resina',producto:'Resina MC',estado:'finalizado',produccion_controlada:true,resultado_cantidad:20,resultado_unidad:'g'}]);
  assert.match(row,/MC · 100 g/);
  assert.match(row,/Obtenido: 20 g/);
  assert.match(row,/Resina MC/);
  assert.doesNotMatch(row,/Reabrir/);
});

test('la producción exige cierre transaccional y bloquea reapertura tras afectar stock',()=>{
  assert.match(html,/id="lab-production-return"/);
  assert.match(app,/db\.rpc\('guardar_produccion_laboratorio'/);
  assert.match(app,/db\.rpc\('finalizar_produccion_laboratorio'/);
  assert.match(sql,/select \* into v_job from public\.medrano_laboratorio_trabajos where id=p_id for update/);
  assert.match(sql,/v_stock\.cantidad<v_material\.cantidad/);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad=cantidad-v_material\.cantidad/);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad=cantidad\+p_retorno/);
  assert.match(sql,/if v_controlada and \(p_estado='finalizado' or v_estado='finalizado'\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/grant select on public\.medrano_laboratorio_trabajos_materiales to authenticated/);
});
