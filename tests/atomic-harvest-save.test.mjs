import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.48_cosecha_stock_atomicos.sql');

test('el frontend guarda cosecha, detalle y stock con una única RPC',()=>{
  assert.match(app,/db\.rpc\('guardar_cosecha_completa'/);
  assert.doesNotMatch(app,/db\.from\('cosechas'\)\.insert\(payload\)/);
  assert.doesNotMatch(app,/db\.from\('cosecha_geneticas'\)\.insert\(detailPayloads\)/);
  assert.doesNotMatch(app,/db\.rpc\('sincronizar_cosecha_stock'/);
});

test('cada apertura genera una clave idempotente y los reintentos la reutilizan',()=>{
  assert.match(app,/let harvestSaveRequestKey=null/);
  assert.match(app,/harvestSaveRequestKey=crypto\.randomUUID\(\)/);
  assert.match(app,/p_idempotency_key:harvestSaveRequestKey/);
  assert.match(sql,/cosecha_operaciones[\s\S]*?idempotency_key uuid primary key/i);
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('rainbows-cosecha-op-'/i);
  assert.match(sql,/payload_hash is distinct from v_payload_hash/i);
});

test('la base serializa sala y ciclo e impide duplicados',()=>{
  assert.match(sql,/cosechas_sala_ciclo_uidx on public\.cosechas\(sala,ciclo\)/i);
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\('rainbows-cosecha-'\|\|p_sala\|\|'-'\|\|p_ciclo::text/i);
  assert.match(sql,/Ya existe una cosecha de % · Ciclo %/i);
});

test('stock se sincroniza dentro de la misma transacción protegida',()=>{
  assert.match(sql,/perform public\.sincronizar_cosecha_stock\(v_cosecha_id\)/i);
  assert.match(sql,/insert into public\.cosecha_operaciones[\s\S]*?return jsonb_build_object/i);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/i);
  assert.match(sql,/revoke all on function public\.guardar_cosecha_completa/i);
});

test('la RPC valida genéticas, tamaños y pesos antes de confirmar',()=>{
  assert.match(sql,/d->>'tamano' not in \('grande','mediano','chico'\)/i);
  assert.match(sql,/coalesce\(\(d->>'gramos'\)::numeric,0\) <= 0/i);
  assert.match(sql,/Una genética está repetida/i);
});
