import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const manifest=JSON.parse(read('manifest.json'));
const overrides=read('rainbows-overrides.js');
const sw=read('sw.js');

test('todos los componentes declaran la versión 3.18.1',()=>{
  assert.match(app,/const APP_VERSION='3\.18\.1'/);
  assert.match(overrides,/RAINBOWS_OVERRIDES_VERSION='3\.18\.1'/);
  assert.match(sw,/const VERSION='3\.18\.1'/);
  assert.equal(manifest.start_url,'./?v=3.18.1');
  for(const asset of ['styles.css','app.js','rainbows-overrides.js','manifest.json']){
    assert.match(html,new RegExp(`${asset.replace('.','\\.')}\\?v=3\\.18\\.1`));
  }
});

test('las mejoras se cargan en la primera visita sin reescribir respuestas',()=>{
  assert.match(html,/<script defer src="rainbows-overrides\.js\?v=3\.18\.1"><\/script>/);
  assert.doesNotMatch(sw,/optimizeAppJs|html\.replace|new Response\(out/);
  assert.match(app,/RAINBOWS_PERF_CACHE_V2/);
});

test('Info cultivo agrupa Enmiendas, Genéticas, Salas y Parámetros',()=>{
  assert.match(html,/<button data-view="cultivo-info">Info cultivo<\/button>/);
  assert.doesNotMatch(html,/<button data-view="(?:rooms|genetics|amendments)">/);
  for(const view of ['amendments','genetics','rooms','parameters']){
    assert.match(app,new RegExp(`data-cultivo-info-view="${view}"`));
  }
  assert.match(app,/function renderParameters\(\)/);
  assert.match(overrides,/window\.renderAmendments=renderAmendments/);
  assert.doesNotMatch(overrides,/ensureAmendmentsNav/);
});

test('el caché usa las mismas URLs versionadas que el HTML',()=>{
  for(const asset of ['styles.css','app.js','rainbows-overrides.js','manifest.json','rainbows-logo.webp']){
    assert.match(sw,new RegExp(`${asset.replace('.','\\.')}\\?v=\\$\\{VERSION\\}`));
  }
  assert.match(sw,/caches\.match\(request,\{ignoreSearch:true\}\)/);
  assert.match(sw,/event\.request\.mode==='navigate'/);
  assert.match(sw,/key\.startsWith\('rainbows-'\)/);
});

test('HTML no repite IDs, no usa handlers inline y tiene CSP',()=>{
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  assert.doesNotMatch(html,/\son[a-z]+\s*=/i);
  assert.match(html,/http-equiv="Content-Security-Policy"/);
});

test('registro público queda oculto y el buscador tiene nombre accesible',()=>{
  assert.match(html,/id="sign-up"[^>]*hidden/);
  assert.match(html,/id="stock-movement-search"[^>]*aria-label=/);
});
