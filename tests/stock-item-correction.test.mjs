import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.47_correccion_stock_por_genetica.sql');

test('cada genética permite corregir cantidades o eliminarla por separado',()=>{
  assert.match(app,/data-stock-correct-item=/);
  assert.match(app,/data-stock-delete-item=/);
  assert.match(app,/db\.rpc\('corregir_existencia_stock_palestina'/);
  assert.match(app,/db\.rpc\('eliminar_existencia_stock_palestina'/);
});

test('las correcciones son administrativas y conservan auditoría',()=>{
  assert.match(sql,/create table if not exists public\.stock_correcciones_admin/i);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/i);
  assert.match(sql,/accion,ciclo_id,existencia_id,motivo,antes,despues/i);
  assert.match(sql,/realizado_por uuid not null default auth\.uid\(\)/i);
});

test('los ingresos automáticos no bloquean borrar un duplicado pero las salidas sí',()=>{
  assert.match(sql,/coalesce\(tipo,''\) <> 'entrada'/i);
  assert.match(sql,/delete from public\.stock_movimientos where existencia_id = p_existencia_id/i);
  assert.match(sql,/delete from public\.stock_existencias where id = p_existencia_id/i);
  assert.match(sql,/recalcular_stock_inicial_ciclo\(v_item\.ciclo_id\)/i);
});

test('corregir stock actual respeta movimientos que afectan el saldo',()=>{
  assert.match(sql,/m\.afecta_stock is true/i);
  assert.match(sql,/v_base_actual := p_stock_actual - v_delta/i);
  assert.match(sql,/stock_actual_base = v_base_actual/i);
});
