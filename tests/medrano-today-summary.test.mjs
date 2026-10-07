import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.26.17_resumen_hoy_medrano.sql');

test('Hoy consulta un único resumen y omite las tablas operativas',()=>{
  assert.match(app,/db\.rpc\('resumen_medrano_hoy'\)/);
  assert.match(app,/const medranoDataPage=medranoPage&&!todaySummaryOnly/);
  assert.match(app,/state\.medranoTodaySummaryOnly=todaySummaryOnly/);
  assert.match(app,/medranoDataPage\?loadMedranoStockTable\('medrano_comandas_multiproducto'/);
  assert.match(app,/todaySummaryOnly\?empty\(\):db\.from\('geneticas'\)/);
});

test('el resumen conserva los nueve indicadores de Hoy',()=>{
  for(const key of [
    'comandas_pendientes_cobro','productos_preparacion','comandas_listas',
    'producciones_activas','recepciones_palestina','recepciones_laboratorio',
    'comandas_entregadas_hoy','producciones_cerradas_hoy','movimientos_caja_hoy'
  ]){
    assert.match(app,new RegExp(`summary\\.${key}`));
    assert.match(sql,new RegExp(`'${key}'`));
  }
});

test('el resumen está protegido para Administración y tiene fallback compatible',()=>{
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\)/);
  assert.match(sql,/security definer/);
  assert.match(sql,/revoke all on function public\.resumen_medrano_hoy\(\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.resumen_medrano_hoy\(\) to authenticated/);
  assert.match(app,/\['42883','PGRST202'\]\.includes\(summaryQuery\.error\.code\)/);
});

test('al salir de Hoy se carga recién el módulo solicitado',()=>{
  assert.match(app,/function openMedranoView\(view,section=null,message='Cargando sección…'\)/);
  assert.match(app,/if\(target==='today'\|\|state\.medranoTodaySummaryOnly\)openMedranoView\(target\)/);
  assert.match(app,/if\(state\.medranoTodaySummaryOnly\)openMedranoView\(target,section\)/);
});
