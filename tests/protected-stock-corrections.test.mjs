import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const sql=read('Rainbows_V3.26.50_correcciones_stock_protegidas.sql');
const app=read('app.js');
const html=read('index.html');

test('toda corrección exige motivo y bloquea la fila antes de calcular',()=>{
  assert.match(sql,/create or replace function public\.corregir_stock_medrano/);
  assert.match(sql,/length\(v_motivo\)<5/);
  assert.match(sql,/for update/);
  assert.match(sql,/if p_cantidad=v_anterior then/);
  assert.match(sql,/Corrección manual de stock · Motivo:/);
});

test('Laboratorio guarda descripción y corrección dentro de una transacción protegida',()=>{
  assert.match(sql,/create or replace function public\.guardar_stock_laboratorio_v4/);
  assert.match(sql,/perform public\.guardar_stock_laboratorio_v3\(/);
  assert.match(sql,/perform public\.corregir_stock_medrano\(/);
  assert.match(sql,/revoke execute on function public\.guardar_stock_laboratorio_v3[\s\S]*from authenticated/);
  assert.match(app,/db\.rpc\('guardar_stock_laboratorio_v4'/);
  assert.match(html,/id="lab-item-correction-reason"/);
});

test('Mostrador deja de modificar cantidades directamente desde el navegador',()=>{
  assert.doesNotMatch(app,/from\('medrano_mostrador_productos'\)\.update/);
  assert.match(app,/db\.rpc\('corregir_stock_medrano'/);
  assert.match(app,/db\.rpc\('retirar_stock_mostrador'/);
  assert.match(sql,/revoke update on table public\.medrano_mostrador_productos from authenticated/);
});

test('cada corrección conserva cantidad anterior, nueva y responsable',()=>{
  assert.match(sql,/v_anterior\|\|' → '\|\|p_cantidad/);
  assert.match(sql,/insert into public\.medrano_operaciones/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/set_config\('rainbows\.operacion_tipo','correccion'/);
});
