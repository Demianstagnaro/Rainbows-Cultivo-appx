import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.57_rol_encargado_palestina.sql');
const edge=read('supabase/functions/rainbows-create-user/index.ts');

test('Encargado P es un rol visible y asignable por Administración',()=>{
  assert.match(app,/encargado_p:'Encargado P'/);
  assert.match(app,/<option value="encargado_p">Encargado P<\/option>/);
  assert.match(app,/\['administrador','encargado_p','cultivo','medrano'\]/);
  assert.match(edge,/\['administrador', 'encargado_p', 'cultivo', 'medrano'\]/);
  assert.match(sql,/rol_normalizado not in \('administrador','encargado_p','cultivo','medrano'\)/);
});

test('Encargado P administra Palestina completa',()=>{
  assert.match(app,/function canManagePalestina\(\)[\s\S]*\['administrador','encargado_p'\]/);
  assert.match(app,/function canViewHarvests\(\)[\s\S]*return canManagePalestina\(\)/);
  assert.match(app,/const stockAccess=\['administrador','encargado_p','medrano'\]/);
  assert.match(app,/const canManage=canManagePalestina\(\)/);
  assert.match(app,/if\(!canManagePalestina\(\)\)throw new Error\('No tenés permiso para registrar movimientos de Stock Palestina\.'/);
  for(const table of ['geneticas','cosechas','cosecha_geneticas','stock_ciclos','stock_existencias','stock_movimientos']){
    assert.match(sql,new RegExp(`create policy [\\s\\S]*? on public\\.${table}[\\s\\S]*?usuario_rainbows_palestina_gestion`,'i'));
  }
});

test('la base amplía las RPC de cosechas y stock sin copiar su lógica',()=>{
  assert.match(sql,/pg_get_functiondef/);
  assert.match(sql,/guardar_cosecha_completa\(uuid,uuid,date,text,integer,numeric,numeric,integer,text,text,jsonb\)/);
  assert.match(sql,/corregir_existencia_stock_palestina/);
  assert.match(sql,/eliminar_existencia_stock_palestina/);
  assert.match(sql,/crear_transferencia_medrano/);
  assert.match(sql,/replace\([\s\S]*public\.usuario_rainbows_admin\(\)[\s\S]*public\.usuario_rainbows_palestina_gestion\(\)/);
});

test('Encargado P no obtiene Config ni Medrano',()=>{
  assert.match(app,/function canAccessMedrano\(\)[\s\S]*\['administrador','medrano'\]/);
  assert.doesNotMatch(app,/function canAccessMedrano\(\)[\s\S]{0,120}encargado_p/);
  assert.match(app,/const ok=currentRole\(\)==='administrador';cb\.hidden=!ok/);
  assert.match(app,/if\(state\.view==='settings'&&currentRole\(\)!=='administrador'\)state\.view='today'/);
  assert.match(sql,/pg_get_functiondef\('public\.usuario_rainbows_medrano\(\)'::regprocedure\)/);
  assert.match(sql,/tablename='configuracion'[\s\S]*usuario_rainbows_admin/);
  assert.doesNotMatch(sql,/create policy configuracion_admin[\s\S]*usuario_rainbows_palestina_gestion/);
});
