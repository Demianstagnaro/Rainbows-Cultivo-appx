import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function loadCalendar(){
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const prefix=source.slice(0,source.indexOf("const CONTINUE_MARKER="))
    .replace(/^import .*;$/m,'const createClient=()=>({});');
  const context={
    console,Date,Intl,Map,Set,Math,
    document:{getElementById:()=>({})},
    localStorage:{getItem:()=>null,setItem:()=>{}}
  };
  vm.runInNewContext(`${prefix}\nglobalThis.calendar={rules,parse,ymd,add,cycle,cycleNumber,harvest,harvestCycleNumber,routine,cloneTransfer,vegesOccupied};`,context);
  return context.calendar;
}

const calendar=loadCalendar();
const room=name=>calendar.rules.find(rule=>rule.name===name);
const taskNames=date=>calendar.routine(calendar.parse(date)).map(task=>`${task.room}|${task.task}`);

test('Flora 2 cosecha el 26/08/2026 y avanza de ciclo',()=>{
  const date=calendar.parse('2026-08-26');
  const flora2=room('Flora 2');
  assert.equal(calendar.harvest(flora2,date),true);
  assert.equal(calendar.harvestCycleNumber(flora2,date),9);
  assert.equal(calendar.cycleNumber(flora2,date),10);
  assert.ok(taskNames('2026-08-26').includes('Flora 2|Cosecha'));
});

test('las cosechas mantienen una separación de 77 días',()=>{
  const cases=[
    ['Flora 1','2026-07-15','2026-09-30'],
    ['Flora 2','2026-08-26','2026-11-11'],
    ['Flora 3','2026-07-15','2026-09-30']
  ];
  for(const [name,first,second] of cases){
    assert.equal(calendar.harvest(room(name),calendar.parse(first)),true);
    assert.equal(calendar.harvest(room(name),calendar.parse(second)),true);
    assert.equal((calendar.parse(second)-calendar.parse(first))/86400000,77);
  }
});

test('el día de cosecha incluye cosecha, trasplante y enmienda',()=>{
  const tasks=taskNames('2026-09-30');
  for(const flora of ['Flora 1','Flora 3']){
    assert.ok(tasks.includes(`${flora}|Cosecha`));
    assert.ok(tasks.includes(`${flora}|Trasplante`));
    assert.ok(tasks.includes(`${flora}|Enmienda`));
  }
});

test('la transferencia de esquejes ocupa Vege dos días después de cosecha',()=>{
  const transfer=calendar.parse('2026-08-28');
  assert.equal(calendar.cloneTransfer(transfer),true);
  assert.equal(calendar.vegesOccupied(transfer),true);
  const tasks=taskNames('2026-08-28');
  assert.ok(tasks.includes('Vege 1|Trasplante'));
  assert.ok(tasks.includes('Vege 2|Trasplante'));
});
