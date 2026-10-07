import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('los historiales de Medrano comparten navegación por año, mes y día',()=>{
  assert.match(app,/function renderMedranoDateHistory\(/);
  assert.match(app,/data-medrano-history-year/);
  assert.match(app,/data-medrano-history-month/);
  assert.match(app,/data-medrano-history-day/);
  for(const key of ['stock','dispensario','laboratorio','caja','comandas-eliminadas']){
    assert.match(app,new RegExp(`key:'${key}'`));
  }
});

test('cada historial reinicia su ruta al abrirse y muestra el detalle recién al elegir el día',()=>{
  for(const key of ['stock','dispensario','laboratorio','caja','comandas-eliminadas']){
    assert.match(app,new RegExp(`resetMedranoDateHistory\\('${key}'\\)`));
  }
  assert.match(app,/dayRows===null\?/);
  assert.match(app,/:dayContent\(`/);
});

test('la mejora no activa el control físico de stock que quedó pausado',()=>{
  assert.doesNotMatch(app,/renderMedranoStockControl/);
});
