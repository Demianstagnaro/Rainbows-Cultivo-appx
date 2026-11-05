import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const summary=Function(app.slice(app.indexOf('function croquisInventorySummary('),app.indexOf('async function bindCroquisSalaControls('))+';return croquisInventorySummary')();
test('el resumen de vaciado agrupa cantidades por genética y Madres muestra sólo nombres',()=>{
 const rows=[{genetica_id:'a',genetica:'Mandarin',cantidad:2},{genetica_id:'a',genetica:'Mandarin',cantidad:3},{genetica_id:'b',genetica:'Sugar',cantidad:1}];
 assert.equal(summary(rows,'Flora 1'),'Mandarin (5) · Sugar (1)');
 assert.equal(summary(rows,'Madres'),'Mandarin · Sugar');
 assert.equal(summary([],'Madres'),'Sala vacía');
});

test('el resumen reúne las plantas sin genética sin inventar una variedad',()=>{
 assert.equal(summary([{cantidad:2},{cantidad:1}], 'Vege 1'),'Sin genética (3)');
});
