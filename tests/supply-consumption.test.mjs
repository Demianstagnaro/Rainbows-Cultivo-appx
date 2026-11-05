import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {supplyNumber,supplyName,convertSupply,recipeMaterials,consumptionPayload} from '../supply-consumption.js';
const source=fs.readFileSync(new URL('../rainbows-overrides.js',import.meta.url),'utf8');
const declarations=source.match(/const floraAmendmentHeaders=[\s\S]*?\n};\n\nfunction amendmentTable/)[0].replace(/\n\nfunction amendmentTable$/,'');
const recipes=Function(`${declarations};return amendments`)();
const supplies=[{id:'fish',nombre:'Harina de pescado',unidad:'kg',stock:20,categoria:'Cultivo'},{id:'compost',nombre:'Compost',unidad:'litros',stock:100,categoria:'Cultivo'}];
test('acepta coma o punto; no interpreta separadores de miles ni vacíos',()=>{
 assert.equal(supplyNumber('2,5'),2.5);assert.equal(supplyNumber('0.2'),.2);
 for(const input of ['', '-1','1.000,5','1e3','Infinity'])assert.ok(Number.isNaN(supplyNumber(input)));
});
test('convierte masa y volumen sin inventar densidades',()=>{
 assert.equal(convertSupply(4500,'g','kg'),4.5);assert.equal(convertSupply(2.5,'L','ml'),2500);
 assert.equal(convertSupply(20,'L','kg'),null);assert.equal(convertSupply(1,'bolsa','kg'),null);
 assert.equal(supplyName('Harina de dolomita'),'dolomita');
 assert.equal(supplyName('Harina de alfalfa (top dress)'),'alfalfa');
});
test('precarga exactamente las dosis por sala y separa KNF',()=>{
 const f12=recipeMaterials(recipes['Flora 1 y 2'],1);
 assert.equal(f12.find(x=>x.name==='Harina de pescado').quantity,4500);
 assert.equal(f12.find(x=>x.name==='Compost').quantity,105);
 assert.ok(!f12.some(x=>x.name==='FPJ'));
 assert.equal(recipeMaterials(recipes['Flora 3'],7).find(x=>x.name==='Harina de pescado').quantity,5500);
 assert.equal(recipeMaterials(recipes.Madres,2).find(x=>x.name==='Bokashi').quantity,150);
 assert.ok(!recipeMaterials(recipes.Veges,2).some(x=>x.name==='Harina de hueso'));
 const knf=recipeMaterials(recipes['Flora 1 y 2'],4,true,100);
 assert.equal(knf.find(x=>x.name==='FPJ').quantity,250);
 assert.equal(knf.find(x=>x.name==='LAB').quantity,500);
 assert.ok(!knf.some(x=>x.name==='Compost'));
});
test('suma consumos del mismo insumo antes de controlar stock',()=>{
 const rows=[{id:'fish',name:'Pescado',unit:'g',quantity:'4500'},{id:'fish',name:'Pescado',unit:'g',quantity:'5000'}];
 assert.deepEqual(consumptionPayload(rows,supplies),[{insumo_id:'fish',cantidad:9.5,unidad:'kg'}]);
 assert.throws(()=>consumptionPayload([...rows,...rows,...rows],supplies),/Stock insuficiente/);
});
test('cero omite productos; errores de vínculo o unidades impiden guardar',()=>{
 assert.deepEqual(consumptionPayload([{name:'Sin uso',unit:'g',quantity:'0'}],supplies),[]);
 assert.throws(()=>consumptionPayload([{name:'Falta',unit:'g',quantity:'1'}],supplies),/Vinculá/);
 assert.throws(()=>consumptionPayload([{id:'fish',name:'Pescado',unit:'L',quantity:'1'}],supplies),/no son compatibles/);
 assert.throws(()=>consumptionPayload([{id:'fish',name:'Pescado',unit:'g',quantity:'.1'}],supplies),/precisión/);
});
