import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const styles=read('styles.css');
const sql=read('Rainbows_V3.26.58_parametros_cultivo.sql');

test('Parámetros cubre Vege y las ocho semanas de Flora',()=>{
  assert.match(app,/\{id:'vege',label:'Vege'\}/);
  assert.match(app,/Array\.from\(\{length:8\}/);
  for(const field of ['temperatura','luz','humedad_ambiente','co2','humedad_sustrato','ec','ph','n','p','k']){
    assert.match(sql,new RegExp(`\\b${field}\\b`));
  }
  assert.match(app,/Parámetros objetivo por etapa/);
  assert.match(app,/Luz[\s\S]*lux/);
});

test('las mediciones admiten sala completa o una cama y calculan la etapa',()=>{
  assert.match(html,/id="cultivation-measurement-bed"[\s\S]*Toda la sala/);
  assert.match(app,/state\.camas\.filter\(bed=>String\(bed\.sala_id\)===String\(room\?\.id\)\)/);
  assert.match(app,/parameterStageForRoom/);
  assert.ok(app.includes("editing?'editar_medicion_cultivo':'registrar_medicion_cultivo'"));
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

test('objetivos e historial conservan la comparación completa sin desplazamiento lateral',()=>{
  assert.match(app,/class="parameter-matrix parameter-responsive-table"/);
  assert.match(app,/class="parameter-history-table parameter-responsive-table"/);
  assert.match(styles,/\.parameter-table-wrap\{[^}]*overflow:hidden/);
  assert.match(styles,/\.parameter-matrix,.parameter-history-table\{[^}]*table-layout:fixed/);
  assert.match(styles,/@media\(max-width:900px\)[\s\S]*\.parameter-responsive-table tr\{display:grid/);
  const parameterStyles=styles.slice(styles.indexOf('/* Parámetros y mediciones de cultivo */'));
  assert.doesNotMatch(parameterStyles,/min-width:1180px/);
});


test('luz admite 90000 lux al registrar y editar sin convertir el valor',()=>{
  const input=html.match(/<input id="cultivation-measurement-luz"[^>]*>/)[0];
  const min=Number(input.match(/min="([^" ]+)"/)[1]);
  const max=Number(input.match(/max="([^" ]+)"/)[1]);
  const code=app.slice(app.indexOf('function parseMeasurementDecimal('),app.indexOf('function stepMeasurementTemperature('));
  const parse=Function(code+';return parseMeasurementDecimal')();
  assert.equal(parse('90000',min,max),90000);
  assert.equal(parse('200000',min,max),200000);
  assert.throws(()=>parse('200001',min,max));
  assert.throws(()=>parse('-1',min,max));
  assert.equal(parse('',min,max),null);
  assert.doesNotMatch(app+html,/PPFD|PPDF/);
  assert.ok(app.includes("formatCultivationValue(row.luz,'lux')"));
  const migration=read('Palestina_V32667_luz_lux.sql');
  assert.match(migration,/luz between 0 and 200000/);
  assert.match(migration,/public\.cultivo_parametros_objetivo\.luz/);
  assert.doesNotMatch(migration,/update\s+public\./i);
});
