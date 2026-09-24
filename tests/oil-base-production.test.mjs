import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.25.0_perfiles_y_aceites_base.sql'),mixSql=read('Rainbows_V3.25.2_mezclas_aceites.sql'),catalogSql=read('Rainbows_V3.25.1_catalogo_central_productos.sql');

test('la producción se llama Aceite y calcula concentración por resina equivalente',()=>{
  assert.match(html,/value="aceite_base">Aceite<\/option>/);
  assert.doesNotMatch(html,/Preparar aceite base|>Aceite base</);
  assert.match(app,/const equivalent=material\.cantidad\/Number\(item\.concentracion_denominador\)/);
  assert.match(app,/concentration=totalVolume\/resinEquivalent/);
  assert.match(app,/Resina equivalente[\s\S]*?Concentración 1:/);
  assert.match(app,/type==='aceite_base'\?'ml'/);
});

test('Aceite admite resina, aceite preparado y aceite puro',()=>{
  assert.match(html,/id="lab-production-add-resin"[\s\S]*?id="lab-production-add-prepared-oil"[\s\S]*?id="lab-production-add-pure-oil"/);
  assert.match(app,/category==='aceites'&&i\.unidad==='ml'&&i\.es_aceite_base/);
  assert.match(mixSql,/v_stock\.categoria not in \('flores','resina','insumos','aceites'\)/i);
  assert.match(mixSql,/v_cantidad\/v_stock\.concentracion_denominador/i);
  assert.match(mixSql,/v_count<2 or v_fuentes<1 or v_flores<>0/i);
});

test('finalizar crea un lote trazable a granel y descuenta los insumos',()=>{
  assert.match(sql,/add column if not exists es_aceite_base boolean not null default false/i);
  assert.match(sql,/'AB-'\|\|upper\(substr\(replace\(v_destino::text/i);
  assert.match(sql,/base_aceite,concentracion_denominador,es_aceite_base,cantidad,unidad/i);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad=cantidad-v_material\.cantidad/i);
  assert.match(app,/category\.key==='aceites'\?[\s\S]*?Base[\s\S]*?Perfil de cannabinoides[\s\S]*?Concentración[\s\S]*?Disponible/);
});

test('los aceites base no se ofrecen para precio ni dispensa',()=>{
  assert.match(app,/!x\.es_aceite_base\|\|include\(x\.id\)/);
  assert.match(catalogSql,/not coalesce\(s\.es_aceite_base,false\)/i);
});
