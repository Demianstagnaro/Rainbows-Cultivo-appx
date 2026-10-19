import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.38_aceites_a_pedido.sql');

test('la comanda ofrece aceites valorizados para preparar a pedido',()=>{
  assert.match(app,/function parseMedranoOilRecipeName/);
  assert.match(app,/function medranoCustomOilCatalog/);
  assert.match(app,/Preparar a pedido/);
  assert.match(app,/catalogo_producto_id:product\?\.custom\?product\.catalogId:null/);
  assert.match(sql,/add column if not exists pedido_laboratorio boolean/i);
  assert.match(sql,/add column if not exists receta jsonb/i);
  assert.match(sql,/from public\.medrano_catalogo_productos[\s\S]*categoria='aceites'/i);
});

test('Laboratorio abre la receta y vincula la producción a la comanda',()=>{
  assert.match(app,/data-prepare-custom-oil/);
  assert.match(app,/Preparar aceite de comanda/);
  assert.match(app,/vincular_produccion_aceite_comanda/);
  assert.match(sql,/create or replace function public\.vincular_produccion_aceite_comanda/i);
  assert.match(sql,/create trigger completar_aceite_comanda_desde_produccion/i);
  assert.match(sql,/set origen_id=v_stock\.id,nombre=v_stock\.nombre,preparacion_estado='listo'/i);
});

test('se puede dispensar sin confirmación manual pero no sin producto físico',()=>{
  assert.doesNotMatch(sql,/preparacion_estado is distinct from 'listo'/i);
  assert.match(sql,/where comanda_id=p_id and origen_id is null/i);
  assert.match(sql,/El aceite a pedido todavía no fue producido por Laboratorio/);
  assert.match(app,/Aceite a pedido pendiente de producción/);
  assert.match(app,/entrega habilitada/);
});
