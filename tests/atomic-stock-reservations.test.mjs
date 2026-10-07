import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql=fs.readFileSync(new URL('../Rainbows_V3.26.20_reservas_atomicas.sql',import.meta.url),'utf8');

test('las comandas bloquean el stock y descuentan todas las reservas operativas',()=>{
  assert.match(sql,/create or replace function public\.validar_reserva_comanda_operativa\(\)/i);
  assert.match(sql,/from public\.medrano_dispensario_lotes[\s\S]*?for update/i);
  assert.match(sql,/from public\.medrano_mostrador_productos[\s\S]*?for update/i);
  assert.match(sql,/from public\.medrano_laboratorio_stock[\s\S]*?for update/i);
  assert.match(sql,/c\.estado='pendiente'/i);
  assert.match(sql,/t\.estado='en_proceso'/i);
  assert.match(sql,/v_disponible:=v_fisico-v_reservado_comandas-v_reservado_produccion/i);
  assert.match(sql,/before insert or update of tipo,origen_id,cantidad/i);
});

test('iniciar producción descuenta las reservas de comandas y otros trabajos',()=>{
  assert.match(sql,/create or replace function public\.validar_inicio_produccion_operativa\(\)/i);
  assert.match(sql,/new\.estado<>'en_proceso'/i);
  assert.match(sql,/i\.tipo=v_stock\.categoria/i);
  assert.match(sql,/i\.origen_id=v_stock\.id/i);
  assert.match(sql,/m\.trabajo_id<>new\.id/i);
  assert.match(sql,/before update of estado[\s\S]*?on public\.medrano_laboratorio_trabajos/i);
});

test('las funciones de los triggers no quedan ejecutables desde el cliente',()=>{
  assert.match(sql,/revoke all on function public\.validar_reserva_comanda_operativa\(\) from public,anon,authenticated/i);
  assert.match(sql,/revoke all on function public\.validar_inicio_produccion_operativa\(\) from public,anon,authenticated/i);
  assert.match(sql,/begin;[\s\S]*commit;/i);
});
