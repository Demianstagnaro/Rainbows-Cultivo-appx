import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function medranoReserved(');
const end=app.indexOf('function configureWholeUnitInput(',start);
const code=app.slice(start,end);

function context(){
  const state={
    medranoMultiOrders:[{id:'comanda',estado:'pendiente'}],
    medranoMultiItems:[{comanda_id:'comanda',tipo:'aceites',origen_id:'aceite',cantidad:10}],
    medranoLabJobs:[{id:'produccion',produccion_controlada:true,estado:'en_proceso'}],
    medranoLabMaterials:[{trabajo_id:'produccion',stock_id:'aceite',cantidad:25}]
  };
  const sandbox={state,escapeHtml:value=>String(value)};
  vm.runInNewContext(`${code}\nglobalThis.orderReserved=medranoReserved;globalThis.productionReserved=medranoProductionReserved;globalThis.totalReserved=medranoTotalReserved;globalThis.balance=medranoAvailabilityHtml;`,sandbox);
  return sandbox;
}

test('el stock suma reservas de comandas y producciones iniciadas',()=>{
  const sandbox=context();
  assert.equal(sandbox.orderReserved('aceites','aceite'),10);
  assert.equal(sandbox.productionReserved('aceite'),25);
  assert.equal(sandbox.totalReserved('aceites','aceite'),35);
});

test('el detalle separa físico, reservado y disponible',()=>{
  const html=context().balance('aceites','aceite',100,'ml');
  assert.match(html,/Reservado: 35 ml/);
  assert.match(html,/10 en comandas/);
  assert.match(html,/25 en producción/);
  assert.match(html,/Disponible: 65 ml/);
});

test('aceites conserva el desglose aun al mostrar productos finales',()=>{
  assert.match(app,/Stock físico \/ reservado \/ disponible/);
  assert.match(app,/row\.cells\[5\]\.innerHTML=.*medranoAvailabilityHtml\(category\.key,item\.id,item\.cantidad/);
  assert.match(app,/disponible \$\{Number\(p\.qty-medranoTotalReserved/);
});
