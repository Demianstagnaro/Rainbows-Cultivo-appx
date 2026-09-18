import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.21.0_trabajos_laboratorio.sql',import.meta.url),'utf8');

test('la comanda de Laboratorio se crea desde Administración y se distingue de Dispensario',()=>{
  assert.match(app,/id="medrano-orders-lab"/);
  assert.match(app,/medrano-orders-lab'\);if\(lab\)lab\.onclick=\(\)=>openMedranoLabJobDialog\('comanda_paciente'\)/);
  assert.match(app,/data-medrano-module="laboratorio"/);
  assert.match(app,/renderMedranoLaboratory\(medranoNav,bindModuleNav/);
  assert.match(html,/id="lab-job-dialog"/);
});

test('la vista separa trabajos activos, cerrados del día e historial anterior',()=>{
  const code=app.slice(app.indexOf('const medranoJobTypes='),app.indexOf('function renderMedrano(){'));
  const state={medranoLabJobsReady:true,medranoPatients:[],perfiles:[],medranoLabJobs:[
    {id:'pending',tipo:'comanda_paciente',producto:'Aceite',paciente:'<script>',estado:'pendiente',created_at:'2026-09-16T12:00:00Z'},
    {id:'done',tipo:'crema',producto:'Crema',estado:'finalizado',finalizado_at:'2026-09-18T12:00:00Z'},
    {id:'old',tipo:'resina',producto:'Resina',estado:'finalizado',finalizado_at:'2026-09-16T12:00:00Z'},
  ]};
  const screen={innerHTML:'',querySelectorAll:()=>[]};
  const context={state,app:screen,ymd:()=> '2026-09-18',today:()=>new Date('2026-09-18T12:00:00Z'),parse:s=>new Date(`${s}T12:00:00Z`),escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),canManageMedrano:()=>false,bindMedranoLabJobActions:()=>{},$:()=>({onclick:null}),Date};
  vm.runInNewContext(`${code}\nglobalThis.view=renderMedranoLaboratory;`,context);
  context.view('',()=>{});
  assert.match(screen.innerHTML,/Aceite/);
  assert.match(screen.innerHTML,/Crema/);
  assert.doesNotMatch(screen.innerHTML,/Resina|<script>/);
  context.view('',()=>{},true);
  assert.match(screen.innerHTML,/Resina/);
  assert.doesNotMatch(screen.innerHTML,/Aceite|Crema/);
});

test('los trabajos quedan protegidos y tienen auditoría sin mutar stock',()=>{
  assert.match(sql,/enable row level security/g);
  assert.match(sql,/usuario_rainbows_medrano\(\)/g);
  assert.match(sql,/revoke all on public\.medrano_laboratorio_trabajos, public\.medrano_laboratorio_trabajos_eventos from public,anon,authenticated/);
  assert.match(sql,/for update;/g);
  assert.match(sql,/insert into public\.medrano_laboratorio_trabajos_eventos/g);
  assert.doesNotMatch(sql,/update public\.medrano_laboratorio_stock|update public\.medrano_dispensario_lotes/);
});
