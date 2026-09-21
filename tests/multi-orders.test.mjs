import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.22.0_comandas_multiproducto.sql',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('una sola comanda elige paciente primero y múltiples productos del stock',()=>{
  const dialog=html.match(/<dialog id="medrano-multi-dialog"[\s\S]*?<\/dialog>/)?.[0]||'';
  assert.ok(dialog.indexOf('id="medrano-multi-patient"')<dialog.indexOf('id="medrano-multi-lines"'));
  assert.match(dialog,/id="medrano-multi-add"/);
  assert.doesNotMatch(app,/id="medrano-orders-lab"|id="lab-new-order"/);
  for(const category of ['flores','resina','aceites','cremas','capsulas','mostrador'])assert.match(app,new RegExp(`${category}:'`));
  assert.match(app,/medranoCatalog\(tipo,editing=null\)/);
  assert.match(app,/guardar_comanda_multiproducto/);
});

test('las reservas reducen el saldo libre sin modificar el stock físico al guardar',()=>{
  const code=app.slice(app.indexOf('function medranoReserved('),app.indexOf('function medranoCatalog('));
  const state={medranoMultiOrders:[{id:'a',estado:'pendiente'},{id:'b',estado:'dispensada'},{id:'c',estado:'pendiente'}],medranoMultiItems:[
    {comanda_id:'a',tipo:'flores',origen_id:'lot',cantidad:7},
    {comanda_id:'b',tipo:'flores',origen_id:'lot',cantidad:10},
    {comanda_id:'c',tipo:'flores',origen_id:'lot',cantidad:5},
  ]};
  const context={state,escapeHtml:s=>String(s)};
  vm.runInNewContext(`${code}\nglobalThis.reserved=medranoReserved;globalThis.availability=medranoAvailabilityHtml;`,context);
  assert.equal(context.reserved('flores','lot'),12);
  assert.equal(context.reserved('flores','lot','a'),5);
  assert.match(context.availability('flores','lot',3,'g'),/Libre: -9 g/);
});

test('el detalle muestra tipo, genética y cantidad en filas separadas sin exponer los códigos de lote',()=>{
  const categories=app.slice(app.indexOf('const medranoOrderCategories='),app.indexOf('function medranoMultiOrderView('));
  const itemHelpers=app.slice(app.indexOf('function medranoOrderItemName('),app.indexOf('function medranoReserved('));
  const state={medranoDispensarioLots:[{id:'one',genetica_id:'g1',nombre_historico:'MCxCCC',codigo_lote:'F1C9MCXCCC110826'}],geneticas:[{id:'g1',nombre:'MCxCCC'}]};
  const context={state,escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;')};
  vm.runInNewContext(`${categories}\n${itemHelpers}\nglobalThis.cell=medranoOrderProductCell;globalThis.qty=medranoOrderQuantityCell;`,context);
  const html=context.cell({multiple:true,items:[
    {tipo:'flores',origen_id:'one',nombre:'MCxCCC · F1C9MCXCCC110826',cantidad:50,unidad:'g'},
    {tipo:'aceites',origen_id:'two',nombre:'Aceite base <p>',cantidad:100,unidad:'ml'},
  ]});
  assert.match(html,/<details class="medrano-order-details"><summary>Ver productos<\/summary>/);
  assert.match(html,/<td>Flores<\/td><td>MCxCCC<\/td><td>50 g<\/td>/);
  assert.match(html,/<td>Aceites<\/td><td>Aceite base &lt;p&gt;<\/td><td>100 ml<\/td>/);
  assert.doesNotMatch(html,/F1C9MCXCCC110826|<p>|2 productos/);
  assert.equal(context.qty({multiple:true,items:[]}), '');
});

test('Laboratorio recibe solo sus renglones de una comanda mixta y Dispensario conserva todos',()=>{
  const code=app.slice(app.indexOf('const medranoOrderCategories='),app.indexOf('function medranoMultiOrderView('));
  const items=[
    {comanda_id:'mix',tipo:'flores',nombre:'Flores',cantidad:10,unidad:'g'},
    {comanda_id:'mix',tipo:'aceites',nombre:'Aceite',cantidad:1,unidad:'unidades'},
    {comanda_id:'mix',tipo:'resina',nombre:'Resina',cantidad:2,unidad:'g'},
    {comanda_id:'mix',tipo:'mostrador',nombre:'Picador',cantidad:1,unidad:'unidades'},
  ];
  const context={escapeHtml:s=>String(s),medranoOrderItemName:item=>item.nombre,parse:s=>new Date(`${s}T12:00:00Z`)};
  vm.runInNewContext(`${code}\nglobalThis.labOrders=medranoLabOrders;globalThis.labRows=medranoLabOrderRows;`,context);
  const orders=context.labOrders([{id:'mix',estado:'pendiente',fecha:'2026-09-21',paciente_nombre:'Ana'},{id:'other',estado:'pendiente'}],items);
  assert.equal(orders.length,1);
  assert.equal(orders[0].items.length,2);
  assert.equal(items.length,4);
  const output=context.labRows(orders);
  assert.match(output,/Aceite.*Resina/s);
  assert.doesNotMatch(output,/Flores|Picador|Ver comandas/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderMedranoLaboratory('),app.indexOf('function renderMedrano(){')),/lab-go-orders/);
});

test('la operación SQL admite saldos negativos y hace la dispensa atómica',()=>{
  assert.match(sql,/permitir_negativo boolean not null default true/);
  assert.match(sql,/drop constraint %I/);
  assert.match(sql,/create trigger proteger_reservas_flores/);
  assert.match(sql,/create trigger proteger_reservas_mostrador/);
  assert.match(sql,/create trigger proteger_reservas_laboratorio/);
  assert.match(sql,/estado='dispensada',dispensada_por=auth\.uid\(\),dispensada_at=now\(\)/);
  assert.match(sql,/set gramos_actual=gramos_actual-v_line\.cantidad/);
  assert.match(sql,/set cantidad=cantidad-v_line\.cantidad/);
  assert.doesNotMatch(sql,/where id=v_line\.origen_id and (?:cantidad|gramos_actual)>=v_line\.cantidad/);
  assert.match(sql,/estado='pendiente',dispensada_at=null/);
  assert.match(sql,/revoke all on public\.medrano_comandas_multiproducto,public\.medrano_comandas_multiproducto_items from public,anon,authenticated/);
});
