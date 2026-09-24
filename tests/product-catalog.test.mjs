import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.25.1_catalogo_central_productos.sql');

test('el catálogo central existe y siempre incluye Rosin y Resina BHO',()=>{
  assert.match(sql,/create table if not exists public\.medrano_catalogo_productos/i);
  assert.match(sql,/values \('Rosin'\),\('Resina BHO'\)/i);
  assert.match(app,/state\.medranoProductCatalog\.map/);
  assert.match(app,/Rosin y Resina BHO comparten el precio por gramo/);
});

test('crear un catálogo no inventa stock y los stocks eligen productos del catálogo',()=>{
  assert.match(html,/id="medrano-catalog-dialog"/);
  assert.match(html,/no crea stock físico/i);
  assert.match(app,/id="medrano-catalog-add"/);
  assert.match(app,/p_catalogo_producto_id:catalogId/);
  assert.match(app,/guardar_stock_mostrador_catalogo/);
  assert.match(sql,/add column if not exists catalogo_producto_id/i);
});

test('los aceites base intermedios no se incorporan al catálogo comercial',()=>{
  assert.match(sql,/not coalesce\(s\.es_aceite_base,false\)/i);
  assert.match(app,/!x\.es_aceite_base\|\|include\(x\.id\)/);
});
