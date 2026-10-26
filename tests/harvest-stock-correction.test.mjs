import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.46_eliminar_stock_y_evitar_doble_cosecha.sql');

test('la cosecha bloquea aperturas y guardados simultáneos',()=>{
  assert.match(app,/let harvestSaveInFlight=false/);
  assert.match(app,/if\(harvestSaveInFlight\|\|dialog\.open\)return/);
  assert.match(app,/if\(harvestSaveInFlight\)return/);
  assert.match(app,/button\.disabled=true/);
  assert.match(app,/button\.textContent='Guardando…'/);
  assert.match(app,/closeDialog\('harvest-dialog'\);[\s\S]*?db\.rpc\('guardar_cosecha_completa'/);
});

test('un error posterior al guardado no reabre el formulario',()=>{
  assert.match(app,/harvestSaveCommitted=true/);
  assert.match(app,/if\(!harvestSaveCommitted&&!dialog\.open\)dialog\.showModal\(\)/);
});

test('el administrador puede eliminar stock sin movimientos desde el ciclo',()=>{
  assert.match(app,/Eliminar registro de stock/);
  assert.match(app,/db\.rpc\('eliminar_registro_stock_palestina'/);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/i);
  assert.match(sql,/from public\.stock_movimientos[\s\S]*?where ciclo_id = p_ciclo_id/i);
  assert.match(sql,/delete from public\.stock_existencias[\s\S]*?delete from public\.stock_ciclos/i);
  assert.doesNotMatch(sql,/delete from public\.cosechas/i);
});
