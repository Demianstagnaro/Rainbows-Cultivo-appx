import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.25.0_perfiles_y_aceites_base.sql');

test('Resina registra perfil predominante full spectrum y proporción estimada',()=>{
  assert.match(html,/id="lab-item-resin-profile"[\s\S]*?THC-CBD-CBN/);
  assert.match(html,/id="lab-item-resin-ratio"/);
  assert.match(app,/const fullSpectrumProfiles=\['THC','CBD','CBN'/);
  assert.match(app,/function medranoCannabinoidProfile\(item\)/);
  assert.match(app,/Perfil predominante[\s\S]*?Genética[\s\S]*?Lote[\s\S]*?Disponible/);
});

test('la extracción exige el perfil y lo envía protegido a Supabase',()=>{
  assert.match(html,/id="lab-production-resin-meta"/);
  assert.match(app,/type==='resina'\?\{perfil:\$\('lab-production-resin-profile'\)\.value/);
  assert.match(app,/p_metadata:metadata/);
  assert.match(sql,/add column if not exists perfil_cannabinoide text/i);
  assert.match(sql,/p_metadata->>'perfil' not in \('THC','CBD','CBN'/i);
});

test('el stock protegido conserva perfil, genética y lote',()=>{
  assert.match(sql,/p_perfil_cannabinoide text,p_proporcion_cannabinoides text/i);
  assert.match(sql,/perfil_cannabinoide=p_perfil_cannabinoide/i);
  assert.match(sql,/and perfil_cannabinoide is not distinct from v_perfil/i);
});
