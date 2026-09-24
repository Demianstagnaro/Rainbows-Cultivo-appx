import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.25.0_perfiles_y_aceites_base.sql');

test('Preparar aceite base calcula la concentración desde resina y aceite',()=>{
  assert.match(html,/value="aceite_base">Preparar aceite base/);
  assert.match(app,/const concentration=\(resin\.cantidad\+carrier\.cantidad\)\/resin\.cantidad/);
  assert.match(app,/g de resina \+ [\s\S]*?ml de aceite[\s\S]*?Concentración 1:/);
  assert.match(app,/type==='aceite_base'\?'ml'/);
});

test('aceite base exige una resina en gramos y un aceite en mililitros',()=>{
  assert.match(app,/type!=='aceite_base'\|\|category!=='insumos'\|\|i\.unidad==='ml'/);
  assert.match(app,/materials\.length!==2/);
  assert.match(app,/fullSpectrumProfiles\.includes\(resinItem\.perfil_cannabinoide\)/);
  assert.match(sql,/v_count<>2 or v_resina<>1 or v_insumos<>1/i);
  assert.match(sql,/v_resina_stock\.unidad<>'g' or v_base_stock\.unidad<>'ml'/i);
  assert.match(sql,/Primero completá el perfil predominante de la resina/i);
});

test('finalizar crea un lote trazable a granel y descuenta los insumos',()=>{
  assert.match(sql,/add column if not exists es_aceite_base boolean not null default false/i);
  assert.match(sql,/'AB-'\|\|upper\(substr\(replace\(v_destino::text/i);
  assert.match(sql,/base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad/i);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad=cantidad-v_material\.cantidad/i);
  assert.match(app,/category\.key==='aceites'\?[\s\S]*?Base[\s\S]*?Perfil predominante[\s\S]*?Concentración[\s\S]*?Disponible/);
});

test('los aceites base no se ofrecen para precio ni dispensa',()=>{
  assert.match(app,/!x\.es_aceite_base\|\|include\(x\.id\)/);
  assert.match(app,/!i\.es_aceite_base&&medranoLabOrderTypes\.has/);
});
