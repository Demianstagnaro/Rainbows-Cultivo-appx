import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const sql=read('Rainbows_V3.25.9_proporcion_resinas.sql');

test('el stock muestra perfil y proporción de manera explícita',()=>{
  const start=app.indexOf('function medranoCannabinoidRatioRequired(');
  const end=app.indexOf('function renderLabInventory(',start);
  const context={};
  vm.runInNewContext(`${app.slice(start,end)}\nglobalThis.format=medranoCannabinoidProfile;`,context);
  assert.equal(context.format({perfil_cannabinoide:'THC-CBD',proporcion_cannabinoides:'1-2'}),'THC-CBD · Proporción 1-2');
  assert.equal(context.format({perfil_cannabinoide:'THC-CBD',proporcion_cannabinoides:null}),'THC-CBD · Proporción sin cargar');
  assert.equal(context.format({perfil_cannabinoide:'CBD',proporcion_cannabinoides:null}),'CBD');
});

test('la proporción deja de presentarse como opcional',()=>{
  assert.doesNotMatch(html,/Proporción estimada \(opcional\)/);
  assert.match(html,/Proporción de cannabinoides/);
  assert.match(app,/medranoCannabinoidRatioRequired\(profile\)&&!ratio/);
  assert.match(app,/medranoCannabinoidRatioRequired\(metadata\.perfil\)&&!metadata\.proporcion/);
});

test('Supabase exige proporción para perfiles con varios cannabinoides',()=>{
  assert.match(sql,/resina_perfil_multiple_requiere_proporcion/i);
  assert.match(sql,/produccion_resina_multiple_requiere_proporcion/i);
  assert.match(sql,/perfil_cannabinoide[\s\S]*?not like '%-%'[\s\S]*?proporcion_cannabinoides/i);
  assert.match(sql,/resultado_metadata->>'perfil'[\s\S]*?not like '%-%'[\s\S]*?resultado_metadata->>'proporcion'/i);
});
