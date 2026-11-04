import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8');
const app=read('app.js'), html=read('index.html'),css=read('styles.css');
const code=app.slice(app.indexOf('function parseMeasurementDecimal('),app.indexOf('function stepMeasurementTemperature('));
const parse=Function(code+';return parseMeasurementDecimal')();
test('mediciones aceptan coma y punto y preservan cero y blancos',()=>{
 assert.equal(parse('24,5',-10,60),24.5);
 assert.equal(parse('24.5',-10,60),24.5);
 assert.equal(parse('0',0,100),0);
 assert.equal(parse('',0,100),null);
 assert.equal(parse(' 6,25 ',0,14),6.25);
 assert.equal(parse('-2,5',-10,60),-2.5);
});
test('se rechazan separadores ambiguos, valores no finitos y fuera de rango',()=>{
 for(const value of ['1,2.3','Infinity','NaN','abc','61','-11'])assert.throws(()=>parse(value,-10,60));
 assert.throws(()=>parse('1500',0,50));
});
test('todos los decimales de mediciones usan teclado decimal sin bloqueo de coma',()=>{
 for(const field of ['temperatura','luz','humedad-ambiente','co2','humedad-sustrato','ec','ph','n','p','k']){
  const tag=html.match(new RegExp('<input id="cultivation-measurement-'+field+'"[^>]*>'))?.[0];
  assert.ok(tag);
  assert.ok(tag.includes('type="text"'));
  assert.ok(tag.includes('inputmode="decimal"'));
 }
 assert.ok(html.includes('data-temperature-step="-1"'));
 assert.ok(html.includes('data-temperature-step="1"'));
 assert.ok(app.includes('values[dataKey]=parseMeasurementDecimal'));
});
test('controles de temperatura no acumulan errores de redondeo',()=>{
 const input={value:'24,5',dispatchEvent(){}};
 const stepCode=app.slice(app.indexOf('function stepMeasurementTemperature('),app.indexOf('function openCultivationMeasurementDialog('));
 const step=Function('$','parseMeasurementDecimal','Event','alert',stepCode+';return stepMeasurementTemperature')(()=>input,parse,class{},()=>assert.fail('Valor válido'));
 step(1);assert.equal(input.value,'24,6');
 step(-1);assert.equal(input.value,'24,5');
 input.value='60';step(1);assert.equal(input.value,'60');
 input.value='-10';step(-1);assert.equal(input.value,'-10');
});
test('reglas móviles corrigen navegación, diálogos y controles sin cambiar escritorio',()=>{
 const mobile=css.slice(css.indexOf('/* V3.26.65'));
 for(const text of ['100dvh','font-size:16px','min-height:44px','grid-template-columns:repeat(5,minmax(0,1fr))','overscroll-behavior-x:contain'])assert.ok(mobile.includes(text));
});
