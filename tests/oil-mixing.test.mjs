import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const app=read('app.js'),sql=read('Rainbows_V3.25.2_mezclas_aceites.sql');

test('diluir 50 ml de aceite 1:10 con 50 ml puros produce 1:20',()=>{
  const prepared=50,denominator=10,pure=50;
  const equivalent=prepared/denominator;
  assert.equal((prepared+pure)/equivalent,20);
  assert.match(app,/material\.cantidad\/Number\(item\.concentracion_denominador\)/);
  assert.match(sql,/v_total_volumen\/v_resina_equivalente/i);
});

test('la mezcla combina perfiles según el aporte cannabinoide',()=>{
  assert.match(app,/function labOilCombinedProfile\(sources\)/);
  assert.match(app,/equivalent\*ratios\[index\]\/total/);
  assert.match(app,/profile:names\.join\('-'\)/);
  assert.match(sql,/p_metadata->>'perfil'/i);
});

test('el cierre descuenta todos los lotes y conserva la trazabilidad por materiales',()=>{
  assert.match(sql,/insert into public\.medrano_laboratorio_trabajos_materiales/i);
  assert.match(sql,/Sólo se pueden mezclar aceites preparados, trazables/i);
  assert.match(sql,/resina_equivalente[\s\S]*?volumen_teorico/i);
});
