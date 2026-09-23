import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql=fs.readFileSync(new URL('../Rainbows_V3.24.2_codigos_lote_sin_fecha.sql',import.meta.url),'utf8');

test('la migración quita solamente una fecha DDMMYY válida al final',()=>{
  assert.ok(sql.includes("'([0-2][0-9]|3[01])(0[1-9]|1[0-2])[0-9]{2}$'"));
  assert.match(sql,/regexp_replace\([\s\S]*?valor[\s\S]*?''/);
});

test('los códigos existentes se corrigen en todo el recorrido del lote',()=>{
  for(const target of [
    'stock_existencias',
    'stock_movimientos',
    'stock_transferencia_items',
    'medrano_dispensario_lotes',
    'medrano_traslados_laboratorio',
    'medrano_laboratorio_stock',
    'medrano_stock_historial'
  ]) assert.match(sql,new RegExp(`update public\\.${target}`,'i'));
});

test('los lotes futuros se normalizan después de los generadores actuales',()=>{
  assert.equal((sql.match(/returns trigger language plpgsql security definer set search_path = ''/g)||[]).length,3);
  assert.match(sql,/create trigger zz_quitar_fecha_lote_existencia[\s\S]*?before insert or update on public\.stock_existencias/i);
  assert.match(sql,/create trigger zz_quitar_fecha_lote_medrano[\s\S]*?before insert or update on public\.medrano_dispensario_lotes/i);
  assert.match(sql,/create trigger zz_quitar_fecha_lote_laboratorio[\s\S]*?before insert or update on public\.medrano_laboratorio_stock/i);
});
