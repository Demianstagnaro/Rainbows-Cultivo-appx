import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.26.0_trazabilidad_medrano.sql');

test('el stock de cremas muestra perfil, ratio, presentación, lote y unidades',()=>{
  assert.match(app,/function labCreamInventoryMarkup\(items\)/);
  for(const label of ['Perfil de cannabinoides','Ratio','Presentación','Lote','Disponible'])assert.match(app,new RegExp(label));
  assert.match(html,/id="lab-item-presentation"/);
  assert.match(sql,/add column if not exists presentacion_cantidad/);
});

test('la producción de crema hereda la trazabilidad de una única resina',()=>{
  assert.match(app,/function labCreamDraft\(\)/);
  assert.match(app,/guardar_produccion_crema/);
  assert.match(sql,/v_resinas<>1[\s\S]*?v_envases<>1/);
  assert.match(sql,/jsonb_build_object\('perfil',v_resina\.perfil_cannabinoide,'proporcion',v_resina\.proporcion_cannabinoides/);
  assert.match(sql,/when v_job\.tipo='crema' then 'CR-'/);
});

test('el rendimiento final de crema se registra en frascos enteros',()=>{
  assert.match(app,/job\.tipo==='crema'\?'Frascos obtenidos'/);
  assert.match(sql,/v_job\.tipo='crema'[\s\S]*?resultado_unidad<>'unidades'/);
  assert.match(sql,/v_job\.resultado_unidad='unidades' and p_retorno<>trunc\(p_retorno\)/);
});
