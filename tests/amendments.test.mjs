import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source=fs.readFileSync(new URL('../rainbows-overrides.js',import.meta.url),'utf8');
const match=source.match(/const floraAmendmentHeaders=[\s\S]*?\n};\n\nfunction amendmentTable/);
assert.ok(match,'No se encontró la configuración de Enmienda Orgánica');
const declarations=match[0].replace(/\n\nfunction amendmentTable$/,'');
const amendments=Function(`${declarations}\nreturn amendments;`)();

test('Enmienda Orgánica incluye Floración, Veges y Madres',()=>{
  assert.match(source,/<h2>Enmienda Orgánica<\/h2>/);
  assert.doesNotMatch(source,/Enmienda completa/i);
  assert.deepEqual(Object.keys(amendments),['Flora 1 y 2','Flora 3','Veges','Madres']);
});

test('cada fila de enmiendas coincide con las columnas de su sala',()=>{
  for(const [name,section] of Object.entries(amendments)){
    assert.equal(section.rows.length,15,`${name} debe contener los 15 productos de la planilla`);
    for(const row of section.rows)assert.equal(row.length,section.headers.length,`${name}: fila inválida para ${row[0]}`);
  }
});

test('Veges y Madres conservan las dosis nuevas de la planilla',()=>{
  assert.deepEqual(amendments.Veges.headers,['Producto','Trasplante','Semana 3','Semana 5']);
  assert.deepEqual(amendments.Madres.headers,['Producto','Enmienda 1','Enmienda 2','Enmienda 3']);
  for(const section of [amendments.Veges,amendments.Madres]){
    assert.deepEqual(section.rows.find(row=>row[0]==='Compost'),['Compost','20L','20L','20L']);
    assert.deepEqual(section.rows.find(row=>row[0]==='Harina de pescado'),['Harina de pescado','800g','800g','800g']);
    assert.deepEqual(section.rows.find(row=>row[0]==='Bokashi'),['Bokashi','200g','150g','150g']);
    assert.deepEqual(section.rows.find(row=>row[0]==='FPJ'),['FPJ','5ml x L','2,5ml x L','2,5ml x L']);
  }
});

test('las dosis semanales de Floración coinciden con la planilla actualizada',()=>{
  for(const section of [amendments['Flora 1 y 2'],amendments['Flora 3']]){
    assert.deepEqual(section.rows.find(row=>row[0]==='FPJ').slice(4),['2,5ml x L','2,5ml x L','-','-','-','-','-','-']);
    assert.deepEqual(section.rows.find(row=>row[0]==='FFJ').slice(4),['-','-','5ml x L','2,5ml x L','5ml x L','-','-','-']);
    assert.deepEqual(section.rows.find(row=>row[0]==='FRJ').slice(4),['-','-','-','2,5ml x L','5ml x L','-','-','-']);
  }
});
