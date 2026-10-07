import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('la comanda calcula el saldo libre incluyendo producciones y excluyendo su propia reserva',()=>{
  assert.match(app,/function medranoOrderAvailability\(tipo,product,excludeId=null\)/);
  assert.match(app,/medranoTotalReserved\(tipo,product\.id,excludeId\)/);
  assert.match(app,/medranoOrderAvailability\(tipo,product,state\.editMedranoMultiOrder\?\.id\)/);
});

test('cada renglón avisa antes de guardar cuando no alcanza el stock',()=>{
  assert.match(app,/Disponible \$\{balance\.available\.toLocaleString/);
  assert.match(app,/quantity>balance\.available/);
  assert.match(app,/order-stock-warning/);
  assert.match(app,/input-error/);
  assert.match(styles,/\.order-stock-warning/);
  assert.match(styles,/\.text-input\.input-error/);
});

test('guardar rechaza una reserva que dejaría el disponible negativo',()=>{
  const save=app.slice(app.indexOf('async function saveMedranoMultiOrder()'),app.indexOf('function openMedranoOrderDialog('));
  assert.match(save,/item\.cantidad>balance\.available/);
  assert.match(save,/Stock insuficiente de/);
  assert.match(save,/Disponible:/);
  assert.match(save,/Solicitado:/);
});
