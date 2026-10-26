import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const sql=read('Rainbows_V3.26.49_movimientos_stock_estructurados.sql');
const app=read('app.js');

test('el historial guarda una clasificación estructurada y auditable',()=>{
  for(const column of ['tipo_movimiento','cantidad_movida','origen','destino','paciente_id','paciente_nombre']){
    assert.match(sql,new RegExp(`add column if not exists ${column}`));
  }
  for(const type of ['ingreso','dispensa','produccion_consumo','produccion_resultado','traslado_salida','traslado_recepcion','control_fisico','correccion','baja','reactivacion']){
    assert.match(sql,new RegExp(`'${type}'`));
  }
});

test('la normalización cubre movimientos nuevos y el historial existente',()=>{
  assert.match(sql,/before insert or update of accion,cantidad_anterior,cantidad_nueva,operacion_id,operacion_tipo,referencia_id/);
  assert.match(sql,/update public\.medrano_stock_historial\s+set accion=accion/);
  assert.match(sql,/from public\.medrano_comandas_multiproducto c/);
  assert.match(sql,/from public\.medrano_traslados_laboratorio t/);
});

test('la interfaz muestra el tipo y recorrido del movimiento',()=>{
  assert.match(app,/function medranoMovementTypeLabel\(type\)/);
  assert.match(app,/row\.tipo_movimiento/);
  assert.match(app,/row\.origen&&row\.destino/);
  assert.match(app,/Consumo de producción/);
  assert.match(app,/Recepción de traslado/);
});
