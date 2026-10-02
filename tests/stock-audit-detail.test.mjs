import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.25.12_movimientos_auditables.sql');

test('dispensar registra paciente, producto, cantidad y responsable en el historial',()=>{
  assert.match(sql,/create or replace function public\.dispensar_comanda_multiproducto\(p_id uuid\)/i);
  assert.match(sql,/v_accion := 'Dispensa a paciente · Detalle: '[\s\S]*v_line\.cantidad[\s\S]*v_line\.unidad[\s\S]*v_line\.nombre[\s\S]*v_c\.paciente_nombre/i);
  assert.match(sql,/set_config\('rainbows\.stock_accion',v_accion,true\)/i);
  assert.match(app,/split\(' · Detalle: '\)/);
  assert.match(app,/<th>Hora<\/th>[\s\S]*Movimiento y detalle[\s\S]*Realizado por/);
});

test('los traslados informan cantidad, origen, destino, envío y recepción',()=>{
  assert.match(app,/accion:'Traslado Dispensario → Laboratorio'/);
  assert.match(app,/Origen Dispensario · Destino Laboratorio/);
  assert.match(app,/Recibido \$\{receivedTime\}/);
  assert.match(app,/Recibió: \$\{receipt\.usuario_nombre\}/);
  assert.match(app,/Traslado Dispensario → Laboratorio/);
});

test('solo los cambios manuales conservan el nombre Ajuste manual de stock',()=>{
  assert.match(app,/clean==='Ajuste de stock'\?'Ajuste manual de stock'/);
  assert.match(sql,/where h\.accion in \('Ajuste de stock','Ajuste manual de stock'\)/);
  assert.match(sql,/set accion = 'Dispensa a paciente · Detalle: '/);
});
