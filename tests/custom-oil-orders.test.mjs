import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.40_precio_automatico_aceites.sql');

test('la comanda ofrece aceites valorizados para preparar a pedido',()=>{
  assert.match(app,/function parseMedranoOilRecipeName/);
  assert.match(app,/function medranoCustomOilCatalog/);
  assert.match(app,/Preparar a pedido/);
  assert.match(app,/data-custom-oil-profile/);
  assert.match(app,/data-custom-oil-ratio/);
  assert.match(app,/data-custom-oil-concentration/);
  assert.match(app,/data-custom-oil-presentation/);
  assert.match(app,/data-custom-oil-base/);
  assert.match(app,/catalogo_producto_id:null,pedido_laboratorio/);
  assert.match(app,/\[5,10,20,30,/);
  assert.match(app,/\[10,20,30,/);
  assert.match(sql,/add column if not exists pedido_laboratorio boolean/i);
  assert.match(sql,/add column if not exists receta jsonb/i);
  assert.match(sql,/create or replace function public\.precio_tokens_aceite/i);
  assert.match(sql,/El ratio debe tener un valor por cada cannabinoide del perfil/);
  assert.match(sql,/Aceite a pedido · /);
});

test('Laboratorio abre la receta y vincula la producción a la comanda',()=>{
  assert.match(app,/data-prepare-custom-oil/);
  assert.match(app,/Preparar aceite de comanda/);
  assert.match(app,/vincular_produccion_aceite_comanda/);
  assert.match(sql,/create or replace function public\.vincular_produccion_aceite_comanda/i);
  assert.match(sql,/create trigger completar_aceite_comanda_desde_produccion/i);
  assert.match(sql,/set origen_id=v_stock\.id,catalogo_producto_id=v_stock\.catalogo_producto_id,nombre=v_stock\.nombre,preparacion_estado='listo'/i);
});

test('el precio de cada aceite es proporcional a los gramos de resina',()=>{
  assert.match(app,/const resinGrams=recipe\.presentacion_ml\/recipe\.concentracion/);
  assert.match(app,/resinTokens\*resinGrams/);
  assert.match(app,/const concentration=\[\.\.\.parts\]\.reverse\(\)\.find/);
  assert.match(app,/return denominator>1\?/);
  assert.match(app,/Ratio de cannabinoides/);
  assert.match(app,/Concentración del aceite/);
  assert.match(sql,/return round\(v_resina\*p_presentacion_ml\/p_concentracion,2\)/i);
  assert.match(sql,/actualizar_precios_aceites_desde_resina/i);
});

test('se puede dispensar sin confirmación manual pero no sin producto físico',()=>{
  assert.doesNotMatch(sql,/preparacion_estado is distinct from 'listo'/i);
  assert.match(sql,/where comanda_id=p_id and origen_id is null/i);
  assert.match(sql,/El aceite a pedido todavía no fue producido por Laboratorio/);
  assert.match(app,/Aceite a pedido pendiente de producción/);
  assert.match(app,/entrega habilitada/);
});
