import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.24.4_tamano_lote_inmutable.sql');

test('los stocks muestran como texto un tamaño ya definido',()=>{
  assert.match(app,/if\(normalized\|\|!editable\)return escapeHtml\(stockLotSizes\[normalized\]\|\|'Sin definir'\)/);
  assert.match(app,/data-stock-size/);
});

test('una cosecha existente conserva bloqueado su tamaño',()=>{
  assert.match(app,/const sizeLocked=Boolean\(detail\?\.id&&size\)/);
  assert.match(app,/sizeLocked\?'disabled title="El tamaño queda fijo al ingresar la cosecha"'/);
});

test('la base impide cambiar un tamaño ya definido en toda la cadena',()=>{
  assert.match(sql,/old\.tamano is not null and old\.tamano is distinct from new\.tamano/);
  assert.match(sql,/El tamaño del lote ya fue definido y no se puede cambiar/);
  for(const trigger of [
    'aa_bloquear_tamano_cosecha',
    'aa_bloquear_tamano_stock_palestina',
    'aa_bloquear_tamano_stock_medrano'
  ]) assert.match(sql,new RegExp(`create trigger ${trigger}`,'i'));
});

test('los lotes históricos sin tamaño admiten una única clasificación',()=>{
  assert.doesNotMatch(sql,/old\.tamano is null[\s\S]*?raise exception/i);
  assert.match(sql,/where e\.tamano is null[\s\S]*?m\.tamano is not null/i);
});
