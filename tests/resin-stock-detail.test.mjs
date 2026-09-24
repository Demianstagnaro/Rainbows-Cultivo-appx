import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.24.7_detalle_stock_resina.sql');

test('Resina muestra producto, genética, lote y disponible en gramos',()=>{
  assert.match(app,/category\.key==='resina'\?[\s\S]*?Producto[\s\S]*?Genética[\s\S]*?Lote[\s\S]*?Disponible/);
  assert.match(app,/toLocaleString\('es-AR'\)\} g<\/strong>/);
  assert.match(app,/function medranoLabGeneticName\(item\)/);
});

test('agregar y editar Resina comparten todos los campos',()=>{
  assert.match(html,/id="lab-item-resin-product"[\s\S]*?value="Rosin">Rosin<[\s\S]*?value="Resina BHO">Resina BHO</);
  assert.match(html,/id="lab-item-resin-genetic"/);
  assert.match(html,/id="lab-item-resin-lot"/);
  assert.match(app,/\$\('lab-item-resin-product'\)\.value=\['Rosin','Resina BHO'\]/);
  assert.match(app,/p_genetica_id:geneticId,p_lote:lot,p_cantidad:quantity/);
  assert.match(app,/\$\('lab-item-unit-field'\)\.hidden=resin/);
});

test('la función protegida fija gramos y guarda la trazabilidad de Resina',()=>{
  assert.match(sql,/drop function if exists public\.guardar_stock_laboratorio\(uuid,text,text,numeric,text,boolean\)/i);
  assert.match(sql,/p_nombre not in \('Rosin','Resina BHO'\)/i);
  assert.match(sql,/p_unidad := 'g'/i);
  assert.match(sql,/genetica_id=p_genetica_id,[\s\S]*?lote=nullif\(btrim\(p_lote\),''\)/i);
  assert.match(sql,/grant execute on function public\.guardar_stock_laboratorio\(uuid,text,text,uuid,text,numeric,text,boolean\) to authenticated/i);
});
