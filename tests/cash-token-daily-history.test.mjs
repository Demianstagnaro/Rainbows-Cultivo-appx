import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('Caja de hoy filtra los movimientos de Tokens por la fecha local',()=>{
  const start=app.indexOf('function medranoTokenMovementDay(');
  const end=app.indexOf('function medranoCashSigned(',start);
  const state={medranoTokenMovements:[
    {id:'ayer',created_at:'2026-10-07T15:00:00Z'},
    {id:'hoy-1',created_at:'2026-10-08T12:00:00Z'},
    {id:'hoy-2',created_at:'2026-10-08T18:00:00Z'},
  ]};
  const context={state,medranoJobDay:value=>String(value).slice(0,10)};
  vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.forDay=medranoTokenMovementsForDay;`,context);
  assert.deepEqual(Array.from(context.forDay('2026-10-08'),row=>row.id),['hoy-1','hoy-2']);
});

test('la pantalla diaria y el historial usan su propia tabla de Tokens',()=>{
  assert.match(app,/Movimientos de Tokens de hoy/);
  assert.match(app,/medranoTokenMovementTable\(tokenRows\)/);
  assert.match(app,/Movimientos de Tokens del día/);
  assert.match(app,/\.\.\.\(state\.medranoTokenMovements\|\|\[\]\)\.map\(medranoTokenMovementDay\)/);
});

test('los Tokens también se cargan al entrar al historial de Caja',()=>{
  assert.match(app,/const cashPage=String\(state\.medranoView\|\|''\)\.startsWith\('administracion-caja'\)/);
  assert.match(app,/medranoPage&&cashPage\?loadMedranoStockTable\('medrano_tokens_movimientos'\)/);
  assert.match(app,/if\(cashView\)add\('tokenMovements',loadMedranoStockTable\('medrano_tokens_movimientos'\)\)/);
});
