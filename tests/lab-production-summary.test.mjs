import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('el resumen de producción usa un contenedor visual accesible',()=>{
  assert.match(html,/id="lab-production-oil-summary" class="lab-recipe-summary" hidden aria-live="polite"/);
  assert.match(app,/function labRecipeSummaryMarkup/);
  assert.match(app,/Materias primas/);
  assert.match(app,/Resultado esperado/);
  assert.match(app,/function labRecipePendingMarkup/);
});

test('aceites, cápsulas y cremas muestran la receta por bloques',()=>{
  assert.ok((app.match(/labRecipeSummaryMarkup\(\{/g)||[]).length>=4);
  assert.match(app,/Receta para \$\{draft\.count\} gotero/);
  assert.match(app,/Producción de cápsulas/);
  assert.match(app,/Producción de cremas/);
  assert.match(app,/Aceite base a granel/);
});

test('la ficha de receta tiene estilos para cabecera, datos, insumos y resultado',()=>{
  for(const selector of ['.lab-recipe-card','.lab-recipe-head','.lab-recipe-metrics','.lab-recipe-materials','.lab-recipe-result','.lab-recipe-pending'])assert.match(css,new RegExp(selector.replace('.','\\.')));
});
