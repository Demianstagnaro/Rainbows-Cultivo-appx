import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const styles=read('styles.css');

test('Medrano abre con una vista Hoy propia',()=>{
  assert.match(app,/medranoView:'today'/);
  assert.match(app,/function renderMedranoToday\(medranoNav,bindModuleNav\)/);
  assert.match(app,/data-medrano-module="today"/);
  assert.match(app,/if\(mv==='today'\)\{renderMedranoToday\(medranoNav,bindModuleNav\);return\}/);
});

test('Hoy en Medrano está reservado a administradores',()=>{
  assert.match(app,/const canViewToday=currentRole\(\)==='administrador'/);
  assert.match(app,/if\(mv==='today'&&!canViewToday\)mv='stock'/);
  assert.match(app,/\$\{canViewToday\?`<button type="button" data-medrano-module="today"/);
  assert.match(app,/medrano-top-nav \$\{canViewToday\?'':'without-today'\}/);
});

test('Hoy reúne cobros, preparación, entregas, producción y recepciones',()=>{
  for(const label of [
    'Comandas pendientes de cobro',
    'Productos en preparación',
    'Comandas listas para entregar',
    'Producciones activas',
    'Recepciones desde Palestina',
    'Recepciones en Laboratorio'
  ])assert.match(app,new RegExp(label));
  assert.match(app,/order\.pago_estado==='pagada'&&medranoOrderLabReady\(order\)/);
  assert.match(app,/medranoPreparationState\(item\)==='en_proceso'/);
});

test('las tarjetas llevan al módulo correspondiente sin ejecutar acciones sensibles',()=>{
  assert.match(app,/data-medrano-today-target/);
  assert.match(app,/const target=button\.dataset\.medranoTodayTarget/);
  assert.match(app,/state\.medranoTodaySummaryOnly\)openMedranoView\(target,section\)/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderMedranoToday('),app.indexOf('function renderMedrano(){')),/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});

test('Hoy marca pendientes en rojo y estado al día en verde',()=>{
  assert.match(styles,/\.medrano-today-status\.has-pending/);
  assert.match(styles,/\.medrano-today-status\.is-clear/);
  assert.match(styles,/\.medrano-today-card\.has-pending/);
  assert.match(styles,/\.medrano-today-card\.is-clear/);
});
