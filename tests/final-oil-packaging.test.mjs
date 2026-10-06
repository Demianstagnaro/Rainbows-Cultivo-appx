import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),sql=read('Rainbows_V3.25.15_envases_y_aceite_final.sql');

test('los envases separan capacidad y cantidad física',()=>{
  assert.match(html,/id="lab-item-input-type"[\s\S]*?value="envase"/);
  assert.match(html,/id="lab-item-capacity"[\s\S]*?id="lab-item-capacity-unit"/);
  assert.match(app,/p_tipo_insumo:inputType/);
  assert.match(sql,/add column if not exists tipo_insumo/);
  assert.match(sql,/tipo_insumo='envase'[\s\S]*?capacidad_envase>0[\s\S]*?unidad='unidades'/);
});

test('aceite final calcula aceites base, diluyente y goteros por receta',()=>{
  assert.match(html,/value="aceite_final">Preparar aceite final/);
  assert.match(app,/function labFinalOilDraft\(\)/);
  assert.match(app,/function syncLabFinalOilSourceRows\(jobRows=\[\]\)/);
  assert.match(app,/names\.map\(name=>/);
  assert.match(app,/perfil_cannabinoide===requiredProfile/);
  assert.match(app,/RECETA PARA[\s\S]*RESULTADO ESPERADO:[\s\S]*Los números que figuran dentro de los selectores son sólo el stock disponible/);
  assert.match(app,/stock disponible:.*ml/);
  assert.match(app,/capacidad:.*ml · stock disponible:.*unidades/);
  assert.match(app,/String\(Number\(amounts\.get\(id\)\.toFixed\(6\)\)\)/);
  assert.doesNotMatch(app,/amounts\.get\(id\)\.toFixed\(3\)/);
  assert.doesNotMatch(app,/materials\.some\(m=>[^\n]*!m\.raw/);
  assert.match(app,/materials\.some\(m=>!m\.id\|\|!Number\.isFinite\(m\.cantidad\)\|\|m\.cantidad<=0\)/);
  assert.match(app,/totalEquivalent=totalVolume\/concentration/);
  assert.match(app,/pureVolume=totalVolume-cannabinoidVolume/);
  assert.match(app,/guardar_produccion_aceite_final/);
  assert.match(sql,/v_equivalente:=v_total_volumen\/p_concentracion/);
  assert.match(sql,/v_cantidad:=round\(v_equivalente\*\(v_ratios\[v_i\]\/v_total_ratio\)\*v_stock\.concentracion_denominador,6\)/);
  assert.match(sql,/La concentración solicitada es demasiado fuerte/);
});

test('el cierre descuenta cada componente y produce unidades trazables',()=>{
  assert.match(sql,/v_job\.tipo='aceite_final'.*resultado_unidad<>'unidades'/s);
  assert.match(sql,/update public\.medrano_laboratorio_stock set cantidad=cantidad-v_material\.cantidad/);
  assert.match(sql,/when 'aceite_final' then 'aceites'/);
  assert.match(sql,/'AF-'/);
});
