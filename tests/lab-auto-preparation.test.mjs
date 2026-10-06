import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.7_preparacion_automatica_laboratorio.sql',import.meta.url),'utf8');

test('los productos de Laboratorio nacen En preparación',()=>{
  assert.match(sql,/set preparacion_estado='en_proceso'/i);
  assert.match(sql,/coalesce\(new\.preparacion_estado,'en_proceso'\)/i);
  assert.match(app,/item\.preparacion_estado\|\|'en_proceso'/);
});

test('Laboratorio solamente confirma listo o reabre la preparación',()=>{
  assert.match(sql,/p_estado not in \('en_proceso','listo'\)/i);
  assert.match(app,/next=status==='listo'\?'en_proceso':'listo'/);
  assert.match(app,/label=status==='listo'\?'Reabrir':'Marcar listo'/);
  assert.doesNotMatch(app,/status==='pendiente'\?'Iniciar'/);
});
