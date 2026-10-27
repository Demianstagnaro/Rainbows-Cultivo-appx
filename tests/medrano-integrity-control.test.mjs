import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const sql=read('Rainbows_V3.26.51_control_integridad_medrano.sql');
const app=read('app.js');
const styles=read('styles.css');

test('el control es de solo lectura y exclusivo para administradores',()=>{
  assert.match(sql,/create or replace function public\.revisar_integridad_medrano\(\)/);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/);
  assert.match(sql,/language plpgsql\s+stable\s+security definer/);
  const body=sql.match(/create or replace function public\.revisar_integridad_medrano\(\)[\s\S]*?\$\$;\n/)?.[0]||'';
  assert.doesNotMatch(body,/\b(update|delete|insert into)\s+public\./i);
  assert.match(sql,/revoke all on function public\.revisar_integridad_medrano\(\) from public,anon,authenticated/);
});

test('revisa stock, reservas, cobros, dispensas, producción y traslados',()=>{
  for(const code of ['stock_negativo','reserva_excedida','pago_sin_tokens','pago_sin_caja','dispensa_sin_stock','produccion_incompleta','traslado_demorado','producto_sin_catalogo','lote_incompleto','aceite_sin_produccion']){
    assert.match(sql,new RegExp(`'${code}'`));
  }
  assert.match(sql,/medrano_integridad_config/);
  assert.match(sql,/limit 200/);
});

test('el tablero carga el control bajo demanda y no corrige automáticamente',()=>{
  assert.match(app,/db\.rpc\('revisar_integridad_medrano'\)/);
  assert.match(app,/function medranoIntegrityMarkup\(\)/);
  assert.match(app,/if\(!state\.medranoIntegrity\.loaded&&!state\.medranoIntegrity\.loading\)queueMicrotask/);
  assert.match(app,/data-integrity-refresh/);
  assert.match(app,/data-integrity-target/);
  assert.match(styles,/\.medrano-integrity-card\.is-ok/);
  assert.match(styles,/\.medrano-integrity-card\.has-errors/);
});

test('cada aviso permite abrir el sector relacionado',()=>{
  assert.match(app,/function openMedranoIntegrityTarget\(target\)/);
  assert.match(app,/state\.medranoView=target/);
  assert.match(app,/Abrir sector/);
});
