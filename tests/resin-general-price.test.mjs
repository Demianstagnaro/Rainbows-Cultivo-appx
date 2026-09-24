import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.24.6_precio_resina_general.sql')+read('Rainbows_V3.25.1_catalogo_central_productos.sql');

test('la lista muestra Rosin y Resina BHO con el mismo precio general por gramo',()=>{
  assert.match(sql,/values \('Rosin'\),\('Resina BHO'\)/i);
  assert.match(app,/product\.categoria==='resina'\?medranoCategoryTokenPrice\('resina'\)/);
  assert.match(app,/return \[\.\.\.flowers,\.\.\.catalog\]/);
});

test('todas las resinas del catálogo usan el precio central',()=>{
  assert.match(app,/tokens:tipo==='resina'\?medranoCategoryTokenPrice\('resina'\)/);
  assert.match(app,/function medranoCategoryTokenPrice\(category\)/);
  assert.match(app,/loadMedranoStockTable\('medrano_precios_categorias'\)/);
});

test('Supabase guarda un único precio y protege las comandas pagadas',()=>{
  assert.match(sql,/create table if not exists public\.medrano_precios_categorias/i);
  assert.match(sql,/insert into public\.medrano_precios_categorias/i);
  assert.match(sql,/elsif p_tipo='resina'[\s\S]*?on conflict\(categoria\) do update/i);
  assert.match(sql,/c\.estado='pendiente'[\s\S]*?c\.pago_estado<>'pagada'[\s\S]*?i\.tipo='resina'/i);
});
