import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.17.0_seguridad_integral.sql',import.meta.url),'utf8');

function between(source,start,end){
  const from=source.indexOf(start);
  const to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`No se encontró ${start}`);
  return source.slice(from,to);
}

function escapeFunction(){
  const code=between(app,'function escapeHtml(value){','function formatGenotype');
  const context={};
  vm.runInNewContext(`${code}\nglobalThis.escapeHtmlForTest=escapeHtml;`,context);
  return context.escapeHtmlForTest;
}

test('escapeHtml neutraliza etiquetas y atributos',()=>{
  const escapeHtml=escapeFunction();
  const value='<img src=x onerror="alert(1)">\'&';
  const escaped=escapeHtml(value);
  assert.equal(escaped,'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;');
});

test('las filas de tareas no renderizan HTML aportado por usuarios',()=>{
  const escapeCode=between(app,'function escapeHtml(value){','function formatGenotype');
  const rowCode=between(app,'function row(t){','function findTask');
  const context={Date};
  vm.runInNewContext(`${escapeCode}
    const real=()=>null;
    const historicalDone=()=>false;
    const taskPriority=()=>({cls:'priority-routine',label:'Rutina'});
    const done=()=>false;
    const names=()=>[];
    const actor=()=>'';
    ${rowCode}
    globalThis.renderRow=row;`,context);
  const html=context.renderRow({id:'id-1',task:'<img src=x onerror=alert(1)>',detail:'<svg onload=alert(2)>',type:'extraordinaria'});
  assert.doesNotMatch(html,/<img|<svg/);
  assert.match(html,/&lt;img/);
  assert.match(html,/&lt;svg/);
});

test('las filas de tareas generales escapan nombres, detalle y responsables',()=>{
  const escapeCode=between(app,'function escapeHtml(value){','function formatGenotype');
  const rowCode=between(app,'function generalTaskRow(t){','function bindGeneralTasks');
  const context={Date};
  vm.runInNewContext(`${escapeCode}
    const state={perfiles:[{id:'actor',nombre:'<img src=x onerror=alert(3)>'}]};
    const generalTaskNames=()=>['<svg onload=alert(4)>'];
    const generalDone=()=>true;
    const canComplete=()=>true;
    const canEditTasks=()=>true;
    ${rowCode}
    globalThis.renderGeneralTask=generalTaskRow;`,context);
  const html=context.renderGeneralTask({id:'id-2',nombre:'<b>Tarea</b>',detalle:'<iframe src=x>',registrada_por:'actor',realizada_at:'2026-09-02T12:00:00Z'});
  assert.doesNotMatch(html,/<img|<svg|<iframe|<b>/);
  assert.match(html,/&lt;b&gt;Tarea/);
  assert.match(html,/&lt;iframe/);
});

test('la configuración escapa empleados, nombres, correos y usuario actual',()=>{
  assert.match(app,/escapeHtml\(state\.empleados\.map\(e=>e\.nombre\)\.join\('\\n'\)\)/);
  assert.match(app,/safeName=escapeHtml\(p\.nombre\|\|'Sin nombre'\)/);
  assert.match(app,/safeEmail=escapeHtml\(p\.email\|\|''\)/);
  assert.match(app,/escapeHtml\(state\.session\.user\.email\)/);
});

test('la interfaz impide cambiar el rol o desactivar la cuenta propia',()=>{
  const settings=between(app,'function renderSettings(){','async function saveConfig');
  assert.match(settings,/self=p\.id===state\.session\.user\.id/);
  assert.match(settings,/self\?'disabled aria-label="El rol de tu propia cuenta está protegido"'/);
  assert.match(settings,/data-active="\$\{safeId\}"[^>]*\$\{self\?'disabled'/);
  assert.match(settings,/Tu propia cuenta no puede cambiar de rol ni desactivarse/);
});

test('el frontend no concede permisos por roles históricos ni metadatos de Auth',()=>{
  const roleCode=between(app,'function normalizeRole(value){','function currentProfile');
  assert.doesNotMatch(roleCode,/encargado|empleado|lectura/);
  assert.doesNotMatch(app,/user_metadata.*rol|app_metadata.*rol/);
  assert.match(app,/profile\?\.activo===true\?normalizeRole\(profile\.rol\):''/);
});

test('la migración elimina políticas abiertas y bloquea escalamiento de rol',()=>{
  assert.match(sql,/drop policy if exists %I on public\.%I/i);
  assert.doesNotMatch(sql,/create policy[\s\S]*?using\s*\(true\)/i);
  assert.match(sql,/revoke all on public\.perfiles from authenticated/i);
  assert.match(sql,/create policy perfiles_select[\s\S]*?id = auth\.uid\(\) or public\.usuario_rainbows_admin\(\)/i);
  assert.doesNotMatch(sql,/create policy perfiles_(insert|update)/i);
});

test('roles, altas y bajas respetan el modelo definitivo',()=>{
  assert.match(sql,/in \('administrador', 'cultivo', 'medrano'\)/);
  assert.match(sql,/values\(new\.id, new\.email, v_nombre, 'cultivo', false\)/);
  assert.match(sql,/create trigger rainbows_auth_user_created[\s\S]*?after insert on auth\.users/i);
  assert.match(sql,/delete from auth\.users where id = objetivo_id/i);
  assert.match(sql,/Rainbows debe conservar al menos un administrador activo/);
  assert.equal((sql.match(/pg_advisory_xact_lock\(871640217\)/g)||[]).length,2);
});

test('la migración prueba su matriz y recalcula ambos lados de una cosecha movida',()=>{
  assert.match(sql,/v_policy_count <> 47/);
  assert.match(sql,/has_table_privilege\([\s\S]*?'anon'/i);
  assert.match(sql,/old\.cosecha_id is distinct from new\.cosecha_id/i);
  assert.match(sql,/alter function public\.confirmar_transferencia_medrano[\s\S]*?set search_path = ''/i);
});
