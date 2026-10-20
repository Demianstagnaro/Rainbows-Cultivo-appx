import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.45_preparacion_solo_aceites_a_pedido.sql',import.meta.url),'utf8');

test('solamente los aceites personalizados tienen estado de preparación',()=>{
  assert.match(sql,/if coalesce\(new\.pedido_laboratorio,false\) then/i);
  assert.match(sql,/new\.preparacion_estado:=null/i);
  assert.match(sql,/where not coalesce\(pedido_laboratorio,false\)/i);
  assert.match(app,/function medranoPreparationState\(item\)\{return item\?\.pedido_laboratorio\?/);
  assert.match(app,/if\(!item\?\.pedido_laboratorio\)return '—'/);
});

test('el aceite personalizado queda listo únicamente al terminar su producción',()=>{
  assert.match(sql,/La preparación se actualiza automáticamente al finalizar el aceite personalizado/);
  assert.doesNotMatch(app,/data-lab-preparation-item/);
  assert.doesNotMatch(app,/Marcar listo/);
  assert.match(app,/data-prepare-custom-oil/);
});
