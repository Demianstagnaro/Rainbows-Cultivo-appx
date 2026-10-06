import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('Medrano actualiza módulos independientes sin volver a cargar toda la app',()=>{
  assert.match(app,/async function refreshMedranoModules\(\.\.\.requested\)/);
  for(const scope of ['orders','inventory','laboratory','cash','patients','catalog','transfers']){
    assert.match(app,new RegExp(`scopes\\.has\\('${scope}'\\)`));
  }
  assert.match(app,/Falló la actualización parcial de Medrano; se usa la carga completa/);
});

test('las operaciones recargan solamente sus dependencias',()=>{
  assert.match(app,/guardar_comanda_multiproducto[\s\S]*?refreshMedranoModules\('orders'\)/);
  assert.match(app,/pagar_comanda_multiproducto[\s\S]*?refreshMedranoModules\('orders','cash','patients'\)/);
  assert.match(app,/cerrar_comanda_multiproducto[\s\S]*?refreshMedranoModules\('orders','inventory','cash','patients'\)/);
  assert.match(app,/finalizar_produccion_laboratorio[\s\S]*?refreshMedranoModules\('laboratory','inventory','catalog'\)/);
  assert.match(app,/cambiar_preparacion_item_comanda[\s\S]*?refreshMedranoModules\('orders'\)/);
});

test('Realtime evita duplicar inmediatamente una recarga local',()=>{
  assert.match(app,/medranoLocalRefreshUntil=Date\.now\(\)\+1500/);
  assert.match(app,/Date\.now\(\)<medranoLocalRefreshUntil/);
  assert.match(app,/medranoLocalRefreshTables\.has\(String\(payload\?\.table\|\|''\)\)/);
  assert.match(app,/payload=>scheduleRealtimeRefresh\(payload\)/);
});
