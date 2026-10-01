import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js');
const sql=read('Rainbows_V3.25.8_stock_al_iniciar_produccion.sql');

test('la app valida stock y reservas antes de iniciar producción',()=>{
  assert.match(app,/function medranoLabProductionStockIssue\(job\)/);
  assert.match(app,/other\.estado==='en_proceso'/);
  assert.match(app,/status==='en_proceso'&&job\.produccion_controlada/);
  assert.match(app,/stock insuficiente de “\$\{material\.nombre\}”/);
});

test('el aviso calcula el stock libre descontando otros trabajos iniciados',()=>{
  const code=app.slice(app.indexOf('function medranoLabProductionStockIssue('),app.indexOf('async function changeMedranoLabJobStatus('));
  const state={
    medranoLabItems:[{id:'flores',categoria:'flores',nombre:'MC',cantidad:100,unidad:'g',activo:true}],
    medranoLabJobs:[{id:'actual',produccion_controlada:true,estado:'pendiente'},{id:'otro',produccion_controlada:true,estado:'en_proceso'}],
    medranoLabMaterials:[
      {trabajo_id:'actual',stock_id:'flores',categoria:'flores',nombre:'MC',cantidad:60,unidad:'g'},
      {trabajo_id:'otro',stock_id:'flores',categoria:'flores',nombre:'MC',cantidad:50,unidad:'g'}
    ]
  };
  const context={state};
  vm.runInNewContext(`${code}\nglobalThis.check=medranoLabProductionStockIssue;`,context);
  const issue=context.check(state.medranoLabJobs[0]);
  assert.match(issue,/Disponible: 50 g/);
  assert.match(issue,/50 g reservados/);
  assert.match(issue,/Solicitado: 60 g/);
});

test('Supabase bloquea atómicamente un inicio sin stock libre',()=>{
  assert.match(sql,/create or replace function public\.cambiar_estado_trabajo_laboratorio\(p_id uuid,p_estado text\)/i);
  assert.match(sql,/medrano_laboratorio_stock where id=v_material\.stock_id for update/i);
  assert.match(sql,/trabajo\.estado='en_proceso'/i);
  assert.match(sql,/v_disponible:=v_stock\.cantidad-v_reservado/i);
  assert.match(sql,/if v_disponible<v_material\.cantidad then/i);
});

test('las materias primas no cambian mientras una producción está iniciada',()=>{
  assert.match(sql,/create trigger proteger_materiales_produccion_iniciada/i);
  assert.match(sql,/if v_controlada and v_estado='en_proceso'/i);
  assert.match(app,/const canEdit=job\.estado==='pendiente'\|\|job\.estado==='en_proceso'&&!job\.produccion_controlada/);
});
