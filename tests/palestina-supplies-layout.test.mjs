import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('Insumos se abre desde Info cultivo y no desde Parámetros',()=>{
 assert.ok(app.includes('data-cultivo-info-view="insumos"'));
 assert.ok(app.includes("'parameters','insumos'"));
 const parameters=app.slice(app.indexOf('function renderParameters(){'),app.indexOf('function cultivationParameterStages'));
 assert.ok(!parameters.includes("supplies.textContent='Insumos'"));
});
test('Insumos tiene tabla, filtros y estado de reposición',()=>{
 for(const text of ['supplies-table','Stock actual','Mínimo','supply-search','supply-category','supply-status','Editar / stock'])assert.ok(app.includes(text));
});
test('Vege reutiliza macetas de Flora y Esquejes separa genética y conteo',()=>{
 const code=app.slice(app.indexOf('async function renderSemillero'),app.indexOf('async function renderInsumos'));
 assert.ok(code.includes("'plant-position'"));
 assert.ok(code.includes('bed-card-head'));
 assert.ok(code.includes('clone-genetic'));
 assert.ok(code.includes('clone-count'));
 assert.ok(!code.includes("clone?'Vacío'"));
 assert.ok(css.includes('.clone-tray-slot{display:flex;flex-direction:column;'));
});
