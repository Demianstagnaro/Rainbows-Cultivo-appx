import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.24.5_lista_precios.sql');

test('Administración incorpora una ventana independiente de Lista de precios',()=>{
  assert.match(app,/id="medrano-open-prices"[\s\S]*?<strong>Lista de precios<\/strong>/);
  assert.match(app,/medranoView='administracion-precios'/);
  assert.match(app,/renderMedranoPriceList\(medranoNav,bindModuleNav\)/);
  assert.doesNotMatch(app,/Valores fijos de productos/);
});

test('las flores se agrupan por tamaño y no por genética',()=>{
  assert.match(app,/Object\.entries\(stockLotSizes\).*name:`Flores \$\{label\}`/);
  assert.match(app,/tokens:medranoFlowerTokenPrice\(x\.tamano\)/);
  assert.doesNotMatch(app,/name:`Flores · \$\{g\.nombre\}`/);
  assert.match(sql,/join public\.medrano_precios_flores p on p\.tamano=l\.tamano/i);
});

test('la lista reúne productos de Laboratorio y Mostrador',()=>{
  assert.match(app,/state\.medranoLabItems\.filter\(i=>i\.categoria!=='resina'&&!i\.es_aceite_base&&medranoLabOrderTypes\.has\(i\.categoria\)\)/);
  assert.match(app,/const counter=state\.medranoCounterItems\.map/);
  assert.match(app,/Categoría[\s\S]*?Producto[\s\S]*?Tokens por unidad[\s\S]*?Equivalente/);
});

test('los precios se guardan de forma protegida y recalculan comandas pendientes',()=>{
  assert.match(sql,/create table if not exists public\.medrano_precios_flores/i);
  assert.match(sql,/create policy medrano_precios_flores_select/i);
  assert.match(sql,/create or replace function public\.guardar_precio_lista_medrano/i);
  assert.match(sql,/c\.estado='pendiente'[\s\S]*?c\.pago_estado<>'pagada'/i);
  assert.match(app,/db\.rpc\('guardar_precio_lista_medrano'/);
});
