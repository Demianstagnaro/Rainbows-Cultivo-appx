import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8');
const app=read('app.js'),sql=read('Palestina_V32666_editar_mediciones.sql');
test('editar precarga todos los valores incluidos cero y fecha sin duplicar el registro',()=>{
 assert.ok(app.includes('data-edit-measurement'));
 assert.ok(app.includes('data-delete-measurement'));
 assert.ok(app.includes('localDateTimeValue(new Date(row.fecha))'));
 assert.ok(app.includes('row[key]===null||row[key]===undefined'));
 assert.ok(sql.includes('update public.cultivo_mediciones set'));
 assert.ok(!sql.includes('insert into public.cultivo_mediciones'));
 assert.ok(sql.includes('updated_by=auth.uid()'));
});
test('correcciones y borrados validan autor y permisos en servidor',()=>{
 assert.equal(sql.split('v_original.created_by is distinct from auth.uid()').length-1,2);
 assert.equal(sql.split('where id=p_id for update').length-1,2);
 assert.ok(sql.includes('usuario_rainbows_operativo()'));
 assert.ok(sql.includes('usuario_rainbows_palestina_gestion()'));
 assert.ok(sql.includes('revoke execute'));
 assert.ok(app.includes('if(!confirm('));
 assert.ok(!sql.includes('created_by=auth.uid()'));
});
