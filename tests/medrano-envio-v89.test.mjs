import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functions = app.slice(app.indexOf('function medranoTransferKey()'), app.indexOf('function openLabItemDialog('));

function form(storage, rpc) {
  const fields = {
    'lab-transfer-lot': { value: 'lote' },
    'lab-transfer-grams': { value: '10' },
    'save-lab-transfer': {}
  };
  const context = {
    state: { session: { user: { id: 'operador' } }, medranoDispensarioLots: [{ id: 'lote', gramos_actual: 25 }] },
    medranoTotalReserved: () => 15,
    $: key => fields[key],
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    crypto: { randomUUID: () => crypto.randomUUID() },
    db: { rpc },
    confirm: () => true, formatGrams: String, closeDialog() {}, async refreshMedranoModules() {}
  };
  vm.runInNewContext(functions, context);
  return { send: context.sendMedranoLabTransfer, fields };
}

test('el envío conserva la clave al perder la respuesta y reabrir la aplicación', async () => {
  const storage = new Map();
  const calls = [];
  async function rpc(name, args) {
    assert.equal(name, 'enviar_flores_laboratorio_v89');
    calls.push(JSON.stringify(args));
    if (calls.length === 1) throw new Error('Se perdió la respuesta');
    return { data: 'traslado', error: null };
  }
  await assert.rejects(form(storage, rpc).send(), /respuesta/);
  assert.equal(storage.size, 1);
  const reopened = form(storage, rpc);
  reopened.fields['lab-transfer-grams'].value = '15';
  await reopened.send();
  assert.equal(calls[0], calls[1]);
  assert.equal(storage.size, 0);
});

test('los gramos reservados tampoco se pueden enviar desde el formulario', async () => {
  const storage = new Map();
  const page = form(storage, () => assert.fail('La interfaz debió impedir el envío.'));
  page.fields['lab-transfer-grams'].value = '11';
  await assert.rejects(page.send(), /libres de reservas/);
  assert.equal(storage.size, 0);
});
