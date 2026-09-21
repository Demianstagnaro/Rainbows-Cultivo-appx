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

test('si falta solo la migración nueva, Dispensario y comandas existentes siguen habilitados',async()=>{
  const code=app.slice(app.indexOf('async function load(){'),app.indexOf('}async function refresh(){')+1);
  const state={session:{user:{id:'admin'}},perfiles:[]};
  const query={select(){return this},eq(){return this},order(){return this},maybeSingle(){return Promise.resolve({data:{id:'admin',rol:'administrador',activo:true},error:null})},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};
  const context={state,db:{from(){return Object.create(query)},rpc(){return Promise.resolve({data:[],error:null})}},
    normalizeRole:x=>x,canAccessMedrano:()=>true,canViewOperations:()=>true,
    loadMedranoCounterItems:()=>Promise.resolve({data:[],error:null}),
    loadMedranoStockTable:table=>Promise.resolve({data:[],error:null,missing:table==='medrano_laboratorio_trabajos_materiales'}),
    ymd:()=> '2026-09-18',today:()=>new Date('2026-09-18T12:00:00Z'),medranoMultiOrderView:x=>x,Promise};
  vm.runInNewContext(`${code}\nglobalThis.runLoad=load;`,context);
  await context.runLoad();
  assert.equal(state.medranoStockReady,true);
  assert.equal(state.medranoMultiReady,true);
  assert.equal(state.medranoProductionReady,false);
});

test('una respuesta momentánea de tabla no encontrada se reintenta y conserva el stock',async()=>{
  const code=app.slice(app.indexOf('async function loadMedranoStockTable('),app.indexOf('async function load(){'));
  let reads=0;
  const context={canAccessMedrano:()=>true,setTimeout:callback=>callback(),Promise,
    db:{from:()=>({select(){return this},order(){return this},range(){reads++;return Promise.resolve(reads===1?{error:{code:'PGRST205',message:'Schema cache'}}:{data:[{id:'stock'}],error:null})}})}};
  vm.runInNewContext(`${code}\nglobalThis.loadTable=loadMedranoStockTable;`,context);
  const result=await context.loadTable('medrano_laboratorio_stock');
  assert.equal(reads,2);
  assert.equal(result.missing,undefined);
  assert.equal(result.data[0].id,'stock');
});

test('la carga de materiales usa su clave compuesta y no una columna id inexistente',async()=>{
  const code=app.slice(app.indexOf('async function loadMedranoStockTable('),app.indexOf('async function load(){'));
  const orders=[];
  const context={canAccessMedrano:()=>true,Promise,
    db:{from:()=>({select(){return this},order(column){orders.push(column);return this},range(){
      return Promise.resolve(orders.includes('id')?{error:{code:'42703',message:'column medrano_laboratorio_trabajos_materiales.id does not exist'}}:{data:[{trabajo_id:'t',stock_id:'s'}],error:null});
    }})}};
  vm.runInNewContext(`${code}\nglobalThis.loadTable=loadMedranoStockTable;`,context);
  const result=await context.loadTable('medrano_laboratorio_trabajos_materiales');
  assert.equal(result.error,null);
  assert.equal(result.data.length,1);
  assert.deepEqual(orders,['created_at','trabajo_id','stock_id']);
});
