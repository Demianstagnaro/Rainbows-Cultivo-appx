import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.25.13_capsulas_trazables.sql');

test('la producción de cápsulas calcula producto, presentación y trazabilidad desde los insumos',()=>{
  assert.match(app,/function labCapsuleDraft\(\)/);
  assert.match(app,/tamano_gramos:size/);
  assert.match(app,/capsulas_previstas:capsule\.material\.cantidad/);
  assert.match(app,/resina_gramos:resin\.material\.cantidad/);
  assert.match(app,/type==='capsulas'\?capsuleDraft\?\.name/);
  assert.match(app,/Genética \$\{escapeHtml\(medranoLabGeneticName\(i\)\)\}.*Lote/s);
});

test('al finalizar sólo pide cápsulas obtenidas y mantiene separado el consumo real',()=>{
  assert.match(html,/id="lab-production-return-label"/);
  assert.match(app,/job\.tipo==='capsulas'\?'Cápsulas obtenidas':'Rendimiento real'/);
  assert.match(sql,/v_job\.tipo = 'capsulas'.*v_resinas <> 1/s);
  assert.match(sql,/v_job\.tipo in \('resina','aceite_base','capsulas'\).*v_stock\.categoria in \('flores','resina'\)/s);
  assert.match(sql,/categoria = 'capsulas'.*genetica_id is not distinct from v_genetica.*lote is not distinct from v_lote/s);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad = cantidad - v_material\.cantidad/);
  assert.match(sql,/resultado_cantidad = p_retorno/);
});
