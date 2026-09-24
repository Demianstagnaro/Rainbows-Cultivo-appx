import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.24.8_produccion_resina.sql');

test('Extracción ofrece únicamente Rosin y Resina BHO como resultado',()=>{
  assert.match(app,/if\(type==='resina'\)[\s\S]*?\['Rosin','Resina BHO'\]\.map/);
  assert.match(app,/const name=type==='resina'\?output/);
  assert.match(app,/p_producto_id:type==='resina'\?null/);
  assert.doesNotMatch(html,/placeholder="Ej\.: Resina MC"/);
});

test('el resultado de Resina queda fijo en gramos',()=>{
  assert.match(html,/id="lab-production-unit-field"/);
  assert.match(app,/\$\('lab-production-unit-field'\)\.hidden=true/);
  assert.match(app,/const name=type==='resina'\?output:item\?\.nombre\|\|\$\('lab-production-name'\)\.value\.trim\(\),unit=type==='resina'\?'g'/);
  assert.match(sql,/if p_tipo='resina'[\s\S]*?p_unidad:='g'/i);
});

test('el resultado hereda genética y lote de las flores utilizadas',()=>{
  assert.match(sql,/v_genetica:=v_stock\.genetica_id;[\s\S]*?v_lote:=v_stock\.lote/i);
  assert.match(sql,/nombre=v_job\.producto and unidad='g'[\s\S]*?genetica_id is not distinct from v_genetica[\s\S]*?lote is not distinct from v_lote/i);
  assert.match(sql,/insert into public\.medrano_laboratorio_stock\(categoria,nombre,genetica_id,lote,cantidad,unidad\)/i);
});
