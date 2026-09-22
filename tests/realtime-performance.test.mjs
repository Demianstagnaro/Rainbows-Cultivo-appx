import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('la misma fecha reutiliza el cálculo de tareas hasta invalidar el caché',()=>{
  const code=app.slice(app.indexOf('function tasks(date){'),app.indexOf('function historicalDone('));
  const taskCache=new Map();
  let calculations=0;
  const context={
    __tasksPerfCache:taskCache,ymd:()=> '2026-09-22',CONTINUABLE_FROM:'2026-10-01',
    baseTasks:()=>{calculations++;return [{id:'riego',task:'Riego'}]},isContinuable:()=>false,
    today:()=>new Date('2026-09-22T12:00:00Z'),diff:()=>0
  };
  vm.runInNewContext(`${code}\nglobalThis.tasksForDay=tasks;`,context);
  assert.equal(context.tasksForDay(new Date()).length,1);
  assert.equal(context.tasksForDay(new Date()).length,1);
  assert.equal(calculations,1);
  taskCache.clear();
  context.tasksForDay(new Date());
  assert.equal(calculations,2);
});

test('una ráfaga de cambios comparte una recarga y procesa cambios llegados durante ella',async()=>{
  const code=app.slice(app.indexOf('let refreshInFlight='),app.indexOf('function progress('));
  const timers=new Map();
  let nextId=0,loads=0,renders=0,finishLoad;
  const context={
    state:{session:{user:{id:'test'}}},
    setTimeout:callback=>{const id=++nextId;timers.set(id,callback);return id},
    clearTimeout:id=>timers.delete(id),
    load:()=>{loads++;return new Promise(resolve=>{finishLoad=resolve})},
    render:()=>{renders++},__resetDataPerfCaches:()=>{},app:{},console,Promise
  };
  const flush=()=>{const [id,callback]=timers.entries().next().value;timers.delete(id);callback()};
  vm.runInNewContext(`${code}\nglobalThis.schedule=scheduleRealtimeRefresh;`,context);
  context.schedule();context.schedule();context.schedule();
  assert.equal(timers.size,1);
  flush();
  assert.equal(loads,1);
  context.schedule();flush();
  assert.equal(loads,1);
  finishLoad();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(renders,1);
  assert.equal(timers.size,1);
  flush();
  assert.equal(loads,2);
  finishLoad();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(renders,2);
  assert.equal(timers.size,0);
});
