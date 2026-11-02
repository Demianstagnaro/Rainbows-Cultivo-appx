import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.26.58_parametros_cultivo.sql');

test('Parámetros cubre Vege y las ocho semanas de Flora',()=>{
  assert.match(app,/\{id:'vege',label:'Vege'\}/);
  assert.match(app,/Array\.from\(\{length:8\}/);
  for(const field of ['temperatura','luz','humedad_ambiente','co2','humedad_sustrato','ec','ph','n','p','k']){
    assert.match(sql,new RegExp(`\\b${field}\\b`));
  }
  assert.match(app,/Parámetros objetivo por etapa/);
  assert.match(app,/Luz PPFD/);
});

test('las mediciones admiten sala completa o una cama y calculan la etapa',()=>{
  assert.match(html,/id="cultivation-measurement-bed"[\s\S]*Toda la sala/);
  assert.match(app,/state\.camas\.filter\(bed=>String\(bed\.sala_id\)===String\(room\?\.id\)\)/);
  assert.match(app,/parameterStageForRoom/);
  assert.match(app,/db\.rpc\('registrar_medicion_cultivo'/);
  assert.match(sql,/v_cama public\.camas%rowtype/);
  assert.match(sql,/v_cama\.numero/);
});

test('el historial es mensual, trazable y no se carga al abrir toda la app',()=>{
  assert.match(app,/cultivationMonthRange/);
  assert.match(app,/\.gte\('fecha',range\.start\.toISOString\(\)\)\.lt\('fecha',range\.end\.toISOString\(\)\)/);
  assert.match(app,/created_by/);
  assert.doesNotMatch(app.slice(app.indexOf('async function load(){'),app.indexOf('async function refresh')),/from\('cultivo_mediciones'\)/);
  assert.match(sql,/created_by uuid not null references public\.perfiles/);
  assert.match(sql,/revoke insert,update,delete on table public\.cultivo_mediciones from authenticated/);
});

test('los permisos separan objetivos y registros operativos',()=>{
  assert.match(sql,/guardar_parametros_cultivo[\s\S]*usuario_rainbows_palestina_gestion\(\)/);
  assert.match(sql,/registrar_medicion_cultivo[\s\S]*usuario_rainbows_operativo\(\)/);
  assert.match(app,/const canSetTargets=canManagePalestina\(\)/);
  assert.match(app,/const canRecord=canEditTasks\(\)/);
});
