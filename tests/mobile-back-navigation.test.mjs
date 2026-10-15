import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function appNavigationSnapshot(){');
const end=app.indexOf('function scheduleDayChangeRefresh(){',start);
const navigationCode=app.slice(start,end);

function navigationContext(){
  const pushed=[],replaced=[];
  let popstate=null,renderCount=0,backCount=0,confirmResult=false;
  const state={
    session:{user:{id:'usuario'}},site:'palestina',view:'today',medranoView:'today',
    month:new Date(2026,9,1),day:null,room:null,roomDay:null,tab:'summary',todayDay:null,
    selectedHarvest:null,harvestYear:'todos',harvestRoom:'todas',stockRoom:null,stockCycle:null,
    medranoDispensarioSection:null,medranoDispensarioRoom:null,medranoOrderHistoryYear:null,
    medranoOrderHistoryMonth:null,medranoDashboardPeriod:'month',medranoDashboardMonth:'',
    medranoDateHistory:{},medranoStockHistoryScope:null
  };
  const history={
    state:null,
    replaceState(value){this.state=value;replaced.push(value)},
    pushState(value){this.state=value;pushed.push(value)},
    back(){backCount++}
  };
  const context=vm.createContext({
    state,history,Date,JSON,
    ymd(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`},
    parse(value){const [year,month,day]=value.split('-').map(Number);return new Date(year,month-1,day)},
    today(){return new Date(2026,9,15)},
    localStorage:{setItem(){}},
    window:{addEventListener(name,handler){if(name==='popstate')popstate=handler}},
    confirm(){return confirmResult},
    render(){renderCount++}
  });
  vm.runInContext(navigationCode,context);
  return {
    context,state,history,pushed,replaced,
    pop:state=>popstate({state}),
    setConfirm:value=>{confirmResult=value},
    renderCount:()=>renderCount,
    backCount:()=>backCount
  };
}

test('el historial móvil conserva las pantallas internas y evita entradas duplicadas',()=>{
  const nav=navigationContext();
  vm.runInContext('syncAppNavigationHistory()',nav.context);
  assert.equal(nav.replaced.length,1);
  assert.equal(nav.replaced[0].rainbowsBoundary,true);
  assert.equal(nav.pushed.length,1);
  const homeEntry=nav.pushed[0];

  nav.state.view='calendar';
  nav.state.day=new Date(2026,9,20);
  vm.runInContext('syncAppNavigationHistory()',nav.context);
  assert.equal(nav.pushed.length,2);
  assert.equal(nav.pushed[1].snapshot.day,'2026-10-20');

  vm.runInContext('syncAppNavigationHistory()',nav.context);
  assert.equal(nav.pushed.length,2,'un refresco no debe crear otro paso de navegación');

  nav.pop(homeEntry);
  assert.equal(nav.state.view,'today');
  assert.equal(nav.state.day,null);
  assert.equal(nav.renderCount(),1);
});

test('al llegar al inicio pregunta antes de salir de la aplicación',()=>{
  const nav=navigationContext();
  vm.runInContext('syncAppNavigationHistory()',nav.context);

  nav.setConfirm(false);
  nav.pop({rainbowsBoundary:true});
  assert.equal(nav.backCount(),0);
  assert.equal(nav.history.state.rainbowsApp,true);

  nav.setConfirm(true);
  nav.pop({rainbowsBoundary:true});
  assert.equal(nav.backCount(),1);
});

test('las vistas internas que se redibujan solas también sincronizan la navegación',()=>{
  assert.match(app,/function renderHarvests\(\)\{\s*syncAppNavigationHistory\(\)/);
  assert.match(app,/function renderStock\(\)\{\s*syncAppNavigationHistory\(\)/);
  assert.match(app,/function render\(\)\{[^}]*syncAppNavigationHistory\(\)/);
});
