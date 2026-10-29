import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../Rainbows_V3.26.56_control_fisico_stock.sql',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('el control conserva conteo, reservas, disponible, diferencia y resultado',()=>{
  for(const field of ['cantidad_sistema','cantidad_reservada','cantidad_disponible','cantidad_real','diferencia','estado','ajuste_aplicado']){
    assert.match(sql,new RegExp(field));
  }
  assert.match(sql,/estado in \('coincide','ajustado','requiere_revision'\)/);
  assert.match(app,/Registrado<\/th><th>Reservado<\/th><th>Disponible<\/th><th>Conteo físico<\/th><th>Diferencia/);
});

test('solamente administración puede consultar y registrar controles',()=>{
  assert.match(sql,/using \(public\.usuario_rainbows_admin\(\)\)/);
  assert.match(sql,/if not public\.usuario_rainbows_admin\(\) then/);
  assert.match(app,/currentRole\(\)==='administrador'\?'<button class="medrano-stock-card stock-control-card"/);
  assert.match(app,/Solamente Administración puede registrar controles físicos/);
});

test('el servidor recalcula reservas y bloquea cada fila antes de ajustar',()=>{
  assert.match(sql,/for update of l/i);
  assert.match(sql,/for update of s/i);
  assert.match(sql,/medrano_comandas_multiproducto_items/);
  assert.match(sql,/medrano_laboratorio_trabajos_materiales/);
  assert.match(sql,/v_reservado:=coalesce\(v_reservado_comandas,0\)\+coalesce\(v_reservado_produccion,0\)/);
});

test('un conteo menor que lo reservado no rompe comandas ni producciones',()=>{
  assert.match(sql,/elsif v_real<v_reservado then\s+v_estado:='requiere_revision'/);
  assert.match(sql,/if v_ajuste then[\s\S]*update public\.medrano_laboratorio_stock/);
  assert.match(app,/se registra para revisión sin afectar comandas ni producciones/);
});

test('las diferencias seguras generan ajuste auditable y requieren motivo',()=>{
  assert.match(sql,/length\(v_notas\)<5/);
  assert.match(sql,/set_config\(\s*'rainbows\.stock_accion',[\s\S]*'Control físico de stock/);
  assert.match(sql,/insert into public\.medrano_operaciones/);
  assert.match(sql,/'ajuste'/);
  assert.match(app,/Observaciones.*Obligatorias si hay diferencias/);
});

test('la pantalla prioriza materias primas y carga el historial solo al abrirla',()=>{
  assert.match(app,/Materias primas críticas/);
  assert.match(app,/loadMedranoPhysicalControlData/);
  assert.match(app,/loadMedranoStockTable\('medrano_stock_controles',Infinity\)/);
  assert.match(app,/key:'control-fisico'/);
  assert.match(styles,/stock-control-status-review/);
});
