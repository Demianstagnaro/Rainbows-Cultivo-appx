import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=app.indexOf('function medranoMoneyInputFormat(');
const end=app.indexOf('function medranoCashMovementDay(',start);
const context={};
vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.format=medranoMoneyInputFormat;globalThis.number=medranoMoneyInputNumber;`,context);

test('los importes se separan con puntos mientras se escriben',()=>{
  assert.equal(context.format('1'),'1');
  assert.equal(context.format('1000'),'1.000');
  assert.equal(context.format('1000000'),'1.000.000');
  assert.equal(context.format('1000000,50'),'1.000.000,50');
});

test('el valor visual vuelve al número exacto antes de guardarse',()=>{
  assert.equal(context.number('1.000.000'),1000000);
  assert.equal(context.number('1.000.000,50'),1000000.5);
  assert.ok(Number.isNaN(context.number('')));
});

test('movimientos y arqueo usan campos de dinero formateables',()=>{
  for(const id of ['medrano-cash-amount','medrano-cash-closing-cash','medrano-cash-closing-digital']){
    assert.match(html,new RegExp(`id="${id}"[^>]*type="text"[^>]*inputmode="decimal"`));
  }
  assert.match(app,/medrano-cash-amount'\)\.oninput=.*formatMedranoMoneyInput/);
  assert.match(app,/medranoMoneyInputNumber\(\$\('medrano-cash-amount'\)\.value\)/);
  assert.match(app,/medranoMoneyInputNumber\(\$\('medrano-cash-closing-cash'\)\.value\)/);
});
