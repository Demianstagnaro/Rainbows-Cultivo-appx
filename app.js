import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/+esm';

const APP_VERSION='3.13.7';
const db=createClient('https://fplbxirsbwruazvygciu.supabase.co','sb_publishable_y7EwYjE0W5SEIlumNdQpzw_PBlnkWOt');
const rules=[
{name:'Flora 1',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:true},
{name:'Flora 2',type:'flora',transplant:'2026-06-10',floraStart:'2026-07-01',automaticIrrigation:false},
{name:'Flora 3',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:false},
{name:'Veges',type:'vege'},{name:'Madres',type:'madres'},{name:'Esquejes',type:'esquejes'},{name:'Sala de trabajo',type:'trabajo'}];
const $=id=>document.getElementById(id),app=$('app');
const state={view:'today',month:new Date(new Date().getFullYear(),new Date().getMonth(),1),day:null,room:null,roomDay:null,tab:'summary',session:null,profile:null,perfiles:[],salas:[],camas:[],plantas:[],geneticas:[],empleados:[],tareas:[],realizaciones:[],joins:[],generalTasks:[],generalJoins:[],pending:null,pendingKind:'dated',selected:new Set(),editTask:null,editGeneralTask:null,menuTask:null,menuRoom:null,editBed:null,editPlant:null,editGenetic:null,cosechas:[],cosechaDetalles:[],editHarvest:null,selectedHarvest:null,harvestYear:'todos',harvestRoom:'todas',stockCycles:[],stockItems:[],stockMovements:[],stockRoom:null,stockCycle:null,stockOverviewExpanded:false,todayDay:null,channel:null,backups:[],backupRuns:[],backupLoading:false};
function today(){const d=new Date();d.setHours(0,0,0,0);return d}function sd(d){const x=new Date(d);x.setHours(0,0,0,0);return x}function add(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x}function diff(a,b){return Math.round((sd(a)-sd(b))/86400000)}function parse(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}function same(a,b){return ymd(a)===ymd(b)}function shortRoomDate(d){const wd=d.toLocaleDateString('es-AR',{weekday:'short'}).replace('.','');const cap=wd.charAt(0).toUpperCase()+wd.slice(1);return `${cap} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
function nice(d){return d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}function monthName(d){return d.toLocaleDateString('es-AR',{month:'long',year:'numeric'})}function dow(d){return['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()]}function rr(n){return rules.find(r=>r.name===n)}function sr(n){return state.salas.find(r=>r.nombre===n)}
function cycle(r,date){if(r.type!=='flora')return{label:'Permanente',stage:'permanente'};const days=77,bt=parse(r.transplant),bf=parse(r.floraStart);let c=Math.floor(diff(date,bt)/days);if(diff(date,bt)<0)c=-1;const tr=add(bt,c*days),fl=add(bf,c*days),day=diff(date,tr);if(day<0)return{label:'Pendiente',stage:'pendiente',tr,fl};if(diff(date,fl)<0){const w=Math.min(Math.floor(day/7)+1,3);return{label:`Vege S${w}`,stage:'vege',week:w,tr,fl}}const fd=diff(date,fl),w=Math.min(Math.floor(fd/7)+1,8);return{label:`Flora S${w}`,stage:'flora',week:w,tr,fl}}
function cut(date){const groups=[{dest:['Flora 1','Flora 3'],start:parse('2026-05-20'),opp:parse('2026-07-01')},{dest:['Flora 2'],start:parse('2026-07-01'),opp:parse('2026-05-20')}],active=[];for(const g of groups){const approx=Math.floor(diff(date,g.start)/77);for(let o=-2;o<=2;o++){const fl=add(g.start,(approx+o)*77),intake=add(fl,-1);/* Esquejes: Día 1 = día anterior a Flora S1 */const harvestBase=add(g.opp,56);const harvestOffset=Math.ceil(diff(intake,harvestBase)/77);let h=add(harvestBase,harvestOffset*77);while(diff(h,intake)<=0)h=add(h,77);const exit=add(h,2);if(diff(date,intake)>=0&&diff(date,exit)<0)active.push({dest:g.dest,intake,exit})}}if(!active.length)return{active:false,label:'Vacía'};active.sort((a,b)=>b.intake-a.intake);const x=active[0];return{active:true,label:`Día ${diff(date,x.intake)+1}`,dest:x.dest,exit:x.exit}}
function cloneTransfer(date){
  const groups=[
    {start:parse('2026-05-20'),opp:parse('2026-07-01')},
    {start:parse('2026-07-01'),opp:parse('2026-05-20')}
  ];
  for(const g of groups){
    const approx=Math.floor(diff(date,g.start)/77);
    for(let o=-2;o<=2;o++){
      const fl=add(g.start,(approx+o)*77),intake=add(fl,-1);
      const harvestBase=add(g.opp,56);
      const harvestOffset=Math.ceil(diff(intake,harvestBase)/77);
      let h=add(harvestBase,harvestOffset*77);
      while(diff(h,intake)<=0)h=add(h,77);
      if(same(date,add(h,2)))return true;
    }
  }
  return false;
}
function vegesOccupied(date){
  let lastTransfer=null;
  for(let i=0;i<77;i++){
    const candidate=add(date,-i);
    if(cloneTransfer(candidate)){lastTransfer=candidate;break}
  }
  if(!lastTransfer)return false;
  const emptiedAfterTransfer=rules
    .filter(r=>r.type==='flora')
    .some(r=>{
      const c=cycle(r,date);
      return diff(c.tr,lastTransfer)>0&&diff(date,c.tr)>=0;
    });
  return !emptiedAfterTransfer;
}
function cycleNumber(r,d){
  if(r.type!=='flora')return null;
  const synchronized=r.name==='Flora 1'||r.name==='Flora 3';
  const referenceDate=synchronized?parse('2026-07-16'):parse('2026-06-10');
  const referenceCycle=synchronized?10:9;
  return referenceCycle+Math.floor(diff(d,referenceDate)/77);
}function roomStatus(r,d){const n=cycleNumber(r,d);return n?`Ciclo ${n} · ${stage(r,d)}`:stage(r,d)}
function stage(r,d){if(r.type==='trabajo')return'Área operativa';return r.type==='esquejes'?cut(d).label:(cycle(r,d).week?`Semana ${cycle(r,d).week}`:cycle(r,d).label)}function startWeek(r,d,w){const c=cycle(r,d);return c.stage==='flora'&&c.week===w&&diff(d,c.fl)%7===0}function transplant(r,d){const c=cycle(r,d);return r.type==='flora'&&diff(d,c.tr)===0}function harvest(r,d){const c=cycle(r,d);return r.type==='flora'&&diff(d,c.fl)===56}
function routine(date){const out=[],day=dow(date),push=(room,name,detail)=>out.push({id:`${ymd(date)}|${room}|${name}`,key:`${ymd(date)}|${room}|${name}`,date:ymd(date),room,task:name,detail,type:'rutina',custom:false});for(const r of rules){const c=r.type==='esquejes'?{cut:cut(date)}:cycle(r,date);if(r.type==='vege'&&!vegesOccupied(date))continue;if(!['esquejes','trabajo'].includes(r.type)&&!(r.name==='Flora 1'&&r.automaticIrrigation))push(r.name,'Riego','');if(r.type==='esquejes'&&c.cut.active)push(r.name,'Mantenimiento',c.cut.label);if(r.name==='Flora 1'){if(transplant(r,date))push(r.name,'Calibrar riego','');if(startWeek(r,date,1))push(r.name,'Calibrar riego','');if(startWeek(r,date,7))push(r.name,'Calibrar riego','')}if(['lunes','miercoles','viernes'].includes(day)){if(['vege','madres'].includes(r.type))push(r.name,'Fumigacion',day==='miercoles'?'ABA + OIL + Nissorun':'ABA + OIL');if(r.type==='flora'&&(c.stage==='vege'||(c.stage==='flora'&&c.week<=3)))push(r.name,'Fumigacion',day==='miercoles'?'ABA + OIL + Nissorun':'ABA + OIL')}if(day==='jueves'){if(['vege','madres'].includes(r.type))push(r.name,'KNF','');if(r.type==='flora'&&(c.stage==='vege'||(c.stage==='flora'&&c.week<=6)))push(r.name,'KNF','')}if(r.type==='flora'){if(transplant(r,date)){push(r.name,'Enmienda','');push(r.name,'Trasplante','')}if(startWeek(r,date,1)){push(r.name,'Enmienda','');push(r.name,'Inicio flora','')}if(startWeek(r,date,4))push(r.name,'Enmienda','');if(same(date,add(c.fl,-1))){push(r.name,'Esquejes','');push(r.name,'Poda bajos','')}if(startWeek(r,date,3))push(r.name,'Schwazzing','');if(same(date,add(c.tr,1)))push(r.name,'Redes','');if(harvest(r,date))push(r.name,'Cosecha','')}
if(r.type==='vege'){
  if(cloneTransfer(date))push(r.name,'Trasplante','Esquejes → Veges');
  const transferDate=new Date(date);
  transferDate.setDate(transferDate.getDate()-21);
  if(cloneTransfer(transferDate))push(r.name,'Enmienda','');
}
if(r.type==='madres'){
  const motherAmendmentStart=parse('2026-07-28');
  const daysSinceStart=diff(date,motherAmendmentStart);
  if(daysSinceStart>=0&&daysSinceStart%14===0&&date.getDay()===2)push(r.name,'Enmienda','');
}
}
if(date.getDay()===1){
  const harvestDate=add(date,-12);
  for(const flora of rules.filter(x=>x.type==='flora')){
    if(harvest(flora,harvestDate)){
      const harvestedCycle=cycleNumber(flora,harvestDate);
      push(
        'Sala de trabajo',
        `Trimming - ${flora.name}`,
        `Cosecha: ${harvestDate.toLocaleDateString('es-AR')} · Ciclo ${harvestedCycle}`
      );
    }
  }
}
return out}
const CONTINUE_MARKER='__RAINBOWS_CONTINUA__';
function cleanContinuationDetail(value){return String(value||'').replace(CONTINUE_MARKER,'').replace(/\s*·\s*$/,'').trim()}
function rowContinues(t){return String(t?.detalle||'').includes(CONTINUE_MARKER)}
function uiTask(t){const s=state.salas.find(x=>x.id===t.sala_id);return{id:t.id,date:t.fecha,room:s?.nombre||'',task:t.nombre,detail:cleanContinuationDetail(t.detalle),type:t.tipo,custom:true,db:t,chain:t.clave_externa?.startsWith('CONT|')?decodeURIComponent(t.clave_externa.split('|')[1]):null}}
const HISTORICAL_COMPLETION_CUTOFF='2026-07-21';
const CONTINUABLE_FROM='2026-07-22';
const CONTINUABLE_TASKS=new Set(['Trasplante','Esquejes','Poda bajos','Schwazzing']);
function isContinuable(t){return CONTINUABLE_TASKS.has(t.task)||t.task.startsWith('Trimming - ')}
function taskChain(t){return t.chain||t.key||(t.db?.clave_externa&&!t.db.clave_externa.startsWith('CONT|')?t.db.clave_externa:null)||(t.custom?`CUSTOM:${t.id}`:null)}
function continuationPrefix(chain){return `CONT|${encodeURIComponent(chain)}|`}
function chainRows(chain){
  if(!chain)return[];
  const prefix=continuationPrefix(chain);
  return state.tareas.filter(x=>x.clave_externa===chain||x.clave_externa?.startsWith(prefix)||(chain.startsWith('CUSTOM:')&&String(x.id)===chain.slice(7)));
}
function directRealByTaskId(id){return state.realizaciones.find(r=>String(r.tarea_id)===String(id))}
function real(t){return directRealByTaskId(t.db?.id||t.id)}
function chainFinishedDate(chain){
  const finals=chainRows(chain)
    .filter(x=>x.estado==='realizada'&&directRealByTaskId(x.id)&&!rowContinues(x))
    .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
  return finals.length?finals[0].fecha:null;
}
function withContinuationDay(t,dayNumber){
  const parts=String(t.detail||'').split(' · ').filter(Boolean).filter(x=>!/^Día \d+$/.test(x));
  parts.push(`Día ${dayNumber}`);
  return{...t,detail:parts.join(' · '),continuationDay:dayNumber};
}
function baseTasks(date){
  const day=ymd(date),rows=state.tareas.filter(t=>t.fecha===day),map=new Map(rows.filter(t=>t.clave_externa).map(t=>[t.clave_externa,t]));
  const rt=routine(date).filter(t=>map.get(t.key)?.estado!=='cancelada').map(t=>map.get(t.key)?{...t,id:map.get(t.key).id,detail:cleanContinuationDetail(map.get(t.key).detalle||t.detail),db:map.get(t.key)}:t);
  const custom=rows.filter(t=>!t.clave_externa).filter(t=>t.estado!=='cancelada').map(uiTask);
  return[...rt,...custom];
}
function continuationOrigins(untilDate){
  const origins=[];
  const start=parse(CONTINUABLE_FROM);
  for(let d=start;diff(d,untilDate)<=0;d=add(d,1)){
    for(const t of baseTasks(d)){
      if(isContinuable(t)&&!t.chain)origins.push({...t,chain:taskChain(t),originDate:t.date});
    }
  }
  return origins;
}
function tasks(date){
  let result=baseTasks(date).map(t=>isContinuable(t)?withContinuationDay({...t,chain:taskChain(t),originDate:t.date},1):t);
  const day=ymd(date);
  if(day<CONTINUABLE_FROM||diff(date,today())>0)return result;
  for(const origin of continuationOrigins(add(date,-1))){
    const chain=origin.chain;
    const finished=chainFinishedDate(chain);
    if(finished&&day>finished)continue;
    const dayNumber=diff(date,parse(origin.originDate))+1;
    if(dayNumber<2)continue;
    const key=`${continuationPrefix(chain)}${day}`;
    const stored=state.tareas.find(x=>x.clave_externa===key);
    if(stored?.estado==='cancelada')continue;
    const task=withContinuationDay({
      id:stored?.id||key,key,date:day,room:origin.room,task:origin.task,
      detail:origin.detail||'',type:'rutina',custom:false,db:stored||null,
      chain,originDate:origin.originDate
    },dayNumber);
    if(!result.some(x=>x.key===key||String(x.id)===String(task.id)))result.push(task);
  }
  return result;
}
function historicalDone(t){return!!t.date&&t.date<=HISTORICAL_COMPLETION_CUTOFF}
function done(t){return historicalDone(t)||!!real(t)}
function names(t){const r=real(t);if(!r)return[];const ids=state.joins.filter(j=>j.realizacion_id===r.id).map(j=>j.empleado_id);return state.empleados.filter(e=>ids.includes(e.id)).map(e=>e.nombre)}
function actor(t){const r=real(t);if(!r?.registrada_por)return'';const p=state.perfiles.find(x=>x.id===r.registrada_por);return p?.nombre||p?.email||'Usuario'}
async function ensure(t){
  if(t.db?.id)return t.db;
  const payload={clave_externa:t.key,sala_id:sr(t.room)?.id||null,fecha:t.date,nombre:t.task,detalle:cleanContinuationDetail(t.detail),tipo:'rutina',estado:'pendiente'};
  const q=await db.from('tareas').upsert(payload,{onConflict:'clave_externa'}).select().single();
  if(q.error)throw q.error;
  return q.data;
}
async function complete(t,ids,continueTomorrow=false){
  const row=t.custom&&!t.chain?t.db:await ensure(t);
  const baseDetail=cleanContinuationDetail(row.detalle||t.detail);
  const storedDetail=isContinuable(t)&&continueTomorrow
    ? `${baseDetail}${baseDetail?' · ':''}${CONTINUE_MARKER}`
    : baseDetail;
  const update=await db.from('tareas').update({estado:'realizada',detalle:storedDetail}).eq('id',row.id);
  if(update.error)throw update.error;
  const q=await db.from('realizaciones_tarea').upsert({tarea_id:row.id,realizada_at:new Date().toISOString(),registrada_por:state.session.user.id},{onConflict:'tarea_id'}).select().single();
  if(q.error)throw q.error;
  await db.from('realizacion_empleados').delete().eq('realizacion_id',q.data.id);
  if(ids.length){
    const j=await db.from('realizacion_empleados').insert(ids.map(id=>({realizacion_id:q.data.id,empleado_id:id})));
    if(j.error)throw j.error;
  }
  await refresh();
}
async function undo(t){
  const row=t.db||await ensure(t);
  const realization=directRealByTaskId(row.id);
  if(realization)await db.from('realizaciones_tarea').delete().eq('id',realization.id);
  const update=await db.from('tareas').update({estado:'pendiente',detalle:cleanContinuationDetail(row.detalle||t.detail)}).eq('id',row.id);
  if(update.error)throw update.error;
  await refresh();
}
async function load(){const qs=await Promise.all([
db.from('salas').select('*'),
db.from('camas').select('*'),
db.from('plantas').select('*'),
db.from('geneticas').select('*').order('nombre'),
db.from('cosechas').select('*').order('fecha',{ascending:false}),
db.from('cosecha_geneticas').select('*'),
db.from('stock_ciclos').select('*').order('sala').order('ciclo',{ascending:false}),
db.from('stock_existencias').select('*').order('orden'),
db.from('stock_movimientos').select('*').order('fecha',{ascending:false}).order('created_at',{ascending:false}),
db.from('empleados').select('*').eq('activo',true).order('nombre'),
db.from('tareas').select('*'),
db.from('realizaciones_tarea').select('*'),
db.from('realizacion_empleados').select('*'),
db.from('perfiles').select('*').order('nombre'),
db.from('perfiles').select('*').eq('id',state.session.user.id).maybeSingle(),
db.from('tareas_generales').select('*').order('created_at',{ascending:false}),
db.from('tarea_general_empleados').select('*')
]);for(const q of qs)if(q.error)throw q.error;
[state.salas,state.camas,state.plantas,state.geneticas,state.cosechas,state.cosechaDetalles,state.stockCycles,state.stockItems,state.stockMovements,state.empleados,state.tareas,state.realizaciones,state.joins,state.perfiles]=qs.slice(0,14).map(q=>q.data||[]);
state.profile=qs[14].data||state.perfiles.find(p=>p.id===state.session?.user?.id)||null;
state.generalTasks=qs[15].data||[];
state.generalJoins=qs[16].data||[]
}async function refresh(){try{await load();render()}catch(e){console.error(e);app.innerHTML=`<section class="panel error-panel"><strong>Error</strong><p>${e.message}</p></section>`}}
function subscribe(){if(state.channel)db.removeChannel(state.channel);state.channel=db.channel('rainbows-shared').on('postgres_changes',{event:'*',schema:'public'},refresh).subscribe()}
function progress(r,d){const x=tasks(d).filter(t=>t.room===r.name),n=x.filter(done).length;return{total:x.length,done:n,pct:x.length?Math.round(n/x.length*100):100}}
function taskCounter(doneCount,totalCount){const complete=totalCount>0&&doneCount===totalCount;return `<span class="task-counter ${complete?'is-complete':''}">Tareas ${doneCount}/${totalCount}</span>`}
function taskPriority(t){const critical=['Cosecha','Trasplante','Esquejes','Inicio flora'];const important=['Enmienda','Schwazzing','Calibrar riego','Poda bajos','Redes'];if(critical.includes(t.task))return{rank:0,cls:'priority-critical',label:'Crítica'};if(important.includes(t.task)||t.task.startsWith('Trimming - '))return{rank:1,cls:'priority-important',label:'Importante'};return{rank:2,cls:'priority-routine',label:'Rutina'}}
function orderedTasks(list){return [...list].sort((a,b)=>taskPriority(a).rank-taskPriority(b).rank||a.task.localeCompare(b.task,'es'))}
function row(t){const r=real(t),historic=historicalDone(t)&&!r,label=t.type==='extraordinaria'?'Extraordinaria':t.type==='reprogramada'?'Reprogramada':'',priority=taskPriority(t),meta=historic?'<span class="historical-complete">Completada</span>':r?`${names(t).join(', ')}<br>${new Date(r.realizada_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}<div class="actor-line">Registrado por: ${actor(t)}</div>`:'';return`<div class="task-row ${priority.cls} ${done(t)?'done':''}"><input type="checkbox" data-task-id="${t.id}" ${done(t)?'checked':''} ${historic?'disabled':''}><label><strong>${t.task}</strong><div class="task-subline">${label?`<span class="task-category">${label}</span>`:`<span class="priority-badge">${priority.label}</span>`}${t.detail?`<span class="stage">${t.detail}</span>`:''}</div></label><div class="task-meta">${meta}</div><button class="task-menu" data-menu="${t.id}">⋮</button></div>`}
function findTask(id,d){return tasks(d).find(t=>String(t.id)===String(id))}

function normalizeRole(value){
  return String(value||'').trim().toLowerCase();
}

function currentProfile(){
  if(state.profile) return state.profile;
  const userId=state.session?.user?.id;
  return state.perfiles.find(profile=>profile.id===userId)||null;
}

function currentRole(){
  const profile=currentProfile();
  const metadataRole=state.session?.user?.user_metadata?.rol;
  return normalizeRole(profile?.rol||metadataRole||'empleado');
}

function canViewOperations(){
  return ['administrador','encargado','empleado','lectura'].includes(currentRole());
}

function canComplete(){
  return ['administrador','encargado','empleado'].includes(currentRole());
}

function canEditTasks(){
  return ['administrador','encargado'].includes(currentRole());
}

function canModify(){
  return canComplete();
}

function closeDialog(id){
  const dialog=$(id);
  if(dialog?.open) dialog.close();
}

function openWorker(t,kind='dated',preselected=[]){
  if(!canComplete()){
    alert('Tu usuario tiene permiso de solo lectura.');
    render();
    return;
  }

  state.pending=t;
  state.pendingKind=kind;
  state.selected=new Set(preselected);
  const container=$('worker-options');
  container.innerHTML='';

  if(!state.empleados.length){
    const empty=document.createElement('p');
    empty.className='worker-empty';
    empty.textContent='No hay empleados activos. Agregalos desde Configuración y guardá los cambios.';
    container.appendChild(empty);
  }else{
    state.empleados.forEach(employee=>{
      const button=document.createElement('button');
      button.type='button';
      button.dataset.employeeId=employee.id;
      button.textContent=employee.nombre;
      if(state.selected.has(employee.id)) button.classList.add('selected');
      button.onclick=()=>{
        if(state.selected.has(employee.id)){
          state.selected.delete(employee.id);
          button.classList.remove('selected');
        }else{
          state.selected.add(employee.id);
          button.classList.add('selected');
        }
      };
      container.appendChild(button);
    });
  }

  const isContinuation=isContinuable(t);
  const dayNo=t.continuationDay||1;
  const normalButton=$('confirm-worker');
  const continueButton=$('continue-worker');
  normalButton.textContent=isContinuation?'Finalizar tarea':'Guardar';
  continueButton.hidden=!isContinuation;
  continueButton.textContent=`Completar Día ${dayNo} y continuar mañana`;
  const dialog=$('worker-dialog');
  if(typeof dialog.showModal==='function') dialog.showModal();
  else dialog.setAttribute('open','');
}

function bind(d){
  app.querySelectorAll('input[data-task-id]').forEach(input=>{
    const task=findTask(input.dataset.taskId,d);
    if(!task) return;

    if(!canComplete()||(historicalDone(task)&&!real(task))) input.disabled=true;

    input.onchange=async()=>{
      if(historicalDone(task)&&!real(task)){
        input.checked=true;
        return;
      }
      if(!canComplete()){
        input.checked=done(task);
        return;
      }

      if(real(task)){
        input.disabled=true;
        try{
          await undo(task);
        }catch(error){
          console.error(error);
          alert(error.message||'No se pudo desmarcar la tarea.');
          input.checked=true;
        }finally{
          input.disabled=false;
        }
      }else{
        input.checked=false;
        openWorker(task);
      }
    };
  });

  app.querySelectorAll('[data-new]').forEach(button=>{
    button.onclick=()=>openTask(button.dataset.new,null);
  });

  app.querySelectorAll('[data-menu]').forEach(button=>{
    button.onclick=()=>{
      const task=findTask(button.dataset.menu,d);
      if(task) openTaskMenu(task,d);
    };
  });

  app.querySelectorAll('[data-room-menu]').forEach(button=>{
    button.onclick=event=>{
      event.stopPropagation();
      openRoomMenu(button.dataset.roomMenu,button.dataset.roomDate||ymd(d));
    };
  });
}


function showDialog(id){
  const dialog=$(id);
  if(!dialog) throw new Error(`No se encontró el diálogo ${id}.`);
  if(dialog.open) dialog.close();
  if(typeof dialog.showModal==='function') dialog.showModal();
  else dialog.setAttribute('open','');
}

async function deleteTask(task){
  const hasCompletion=!!real(task);
  const message=hasCompletion
    ? `Esta tarea ya fue completada.\n\nSi la eliminás, también se eliminará el registro de realización y los responsables asignados.\n\n¿Querés continuar?`
    : `¿Eliminar esta tarea?\n\nEsta acción no se puede deshacer.`;
  if(!confirm(message))return false;

  let row=task.db||null;

  // Las tareas automáticas y las continuaciones se cancelan solo en esa fecha.
  if(!task.custom){
    row=row||await ensure(task);
    const realization=directRealByTaskId(row.id);
    if(realization){
      const joinsDelete=await db.from('realizacion_empleados').delete().eq('realizacion_id',realization.id);
      if(joinsDelete.error)throw joinsDelete.error;
      const realizationDelete=await db.from('realizaciones_tarea').delete().eq('id',realization.id);
      if(realizationDelete.error)throw realizationDelete.error;
    }
    const cancel=await db.from('tareas').update({estado:'cancelada'}).eq('id',row.id);
    if(cancel.error)throw cancel.error;
    await refresh();
    return true;
  }

  // Las tareas creadas manualmente se eliminan definitivamente.
  if(row?.id){
    const realization=directRealByTaskId(row.id);
    if(realization){
      const joinsDelete=await db.from('realizacion_empleados').delete().eq('realizacion_id',realization.id);
      if(joinsDelete.error)throw joinsDelete.error;
      const realizationDelete=await db.from('realizaciones_tarea').delete().eq('id',realization.id);
      if(realizationDelete.error)throw realizationDelete.error;
    }
    const remove=await db.from('tareas').delete().eq('id',row.id);
    if(remove.error)throw remove.error;
  }
  await refresh();
  return true;
}

function openTaskMenu(task,d){
  state.menuTask=task;
  const canEdit=canEditTasks();
  const hasReal=!!real(task);
  $('task-menu-title').textContent=task.task;
  $('menu-edit-task').hidden=!canEdit;
  $('menu-edit-task').style.display=canEdit?'block':'none';
  $('menu-add-room-task').hidden=!canEdit;
  $('menu-add-room-task').style.display=canEdit?'block':'none';
  $('menu-correct-workers').hidden=!hasReal||!canComplete();
  $('menu-correct-workers').style.display=hasReal&&canComplete()?'block':'none';
  $('menu-undo-task').hidden=!hasReal||!canComplete();
  $('menu-undo-task').style.display=hasReal&&canComplete()?'block':'none';
  $('menu-delete-task').hidden=!canEdit;
  $('menu-delete-task').style.display=canEdit?'block':'none';
  $('menu-add-room-task').textContent=`Agregar tarea en ${task.room}`;
  $('menu-edit-task').onclick=()=>{closeDialog('task-menu-dialog');openTask(task.date||ymd(d),task)};
  $('menu-add-room-task').onclick=()=>{closeDialog('task-menu-dialog');openTask(task.date||ymd(d),null,task.room)};
  $('menu-correct-workers').onclick=()=>{
    closeDialog('task-menu-dialog');
    const r=real(task);
    const ids=r?state.joins.filter(j=>j.realizacion_id===r.id).map(j=>j.empleado_id):[];
    openWorker(task,'dated',ids);
  };
  $('menu-undo-task').onclick=async()=>{
    if(!confirm(`¿Desmarcar "${task.task}" como realizada? Volverá a quedar pendiente.`))return;
    closeDialog('task-menu-dialog');
    try{
      await undo(task);
    }catch(error){
      console.error(error);
      alert(error.message||'No se pudo desmarcar la tarea.');
    }
  };
  $('menu-delete-task').onclick=async()=>{
    try{
      const deleted=await deleteTask(task);
      if(deleted)closeDialog('task-menu-dialog');
    }catch(error){
      console.error(error);
      alert(error.message||'No se pudo eliminar la tarea.');
    }
  };
  showDialog('task-menu-dialog');
}

function openRoomMenu(roomName,dateString){
  if(!canEditTasks()){
    alert('Solo administradores y encargados pueden agregar tareas.');
    return;
  }
  state.menuRoom=roomName;
  $('room-menu-title').textContent=roomName;
  $('room-add-task').onclick=()=>{closeDialog('room-menu-dialog');openTask(dateString,null,roomName)};
  showDialog('room-menu-dialog');
}

function generalTaskNames(t){
  const ids=state.generalJoins.filter(j=>j.tarea_general_id===t.id).map(j=>j.empleado_id);
  return state.empleados.filter(e=>ids.includes(e.id)).map(e=>e.nombre);
}

function generalDone(t){return t.estado==='realizada'}
function generalTasksForDate(d){
  return state.generalTasks.filter(t=>{
    if(!generalDone(t)||!t.realizada_at)return false;
    return ymd(new Date(t.realizada_at))===ymd(d);
  });
}

function generalTaskRow(t){
  const names=generalTaskNames(t);
  const actorProfile=state.perfiles.find(p=>p.id===t.registrada_por);
  const meta=generalDone(t)
    ? `${names.join(', ')}${t.realizada_at?`<br>${new Date(t.realizada_at).toLocaleDateString('es-AR')} ${new Date(t.realizada_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`:''}${actorProfile?`<div class="actor-line">Registrado por: ${actorProfile.nombre||actorProfile.email}</div>`:''}`
    : '';
  return `<div class="task-row general-task-row ${generalDone(t)?'done':''}">
    <input type="checkbox" data-general-check="${t.id}" ${generalDone(t)?'checked':''} ${canComplete()?'':'disabled'}>
    <label><strong>${t.nombre}</strong>${t.detalle?`<div class="stage">${t.detalle}</div>`:''}</label>
    <div class="task-meta">${meta}</div>
    ${canEditTasks()?`<button class="task-menu" type="button" data-general-menu="${t.id}" aria-label="Editar tarea general">⋮</button>`:''}
  </div>`;
}

function bindGeneralTasks(){
  app.querySelectorAll('[data-general-check]').forEach(input=>{
    const task=state.generalTasks.find(t=>String(t.id)===String(input.dataset.generalCheck));
    if(!task)return;
    input.onchange=async()=>{
      input.disabled=true;
      try{
        if(generalDone(task)){
          await undoGeneralTask(task);
        }else{
          input.checked=false;
          openWorker(task,'general');
        }
      }catch(error){
        console.error(error);
        alert(error.message||'No se pudo modificar la tarea general.');
        input.disabled=false;
        input.checked=generalDone(task);
      }
    };
  });
  app.querySelectorAll('[data-general-menu]').forEach(button=>{
    button.onclick=()=>{
      const task=state.generalTasks.find(t=>String(t.id)===String(button.dataset.generalMenu));
      if(task) openGeneralTask(task);
    };
  });
  const add=$('add-general-task');
  if(add){
    add.disabled=false;
    add.onclick=event=>{
      event.preventDefault();
      event.stopPropagation();
      openGeneralTask(null);
    };
  }
}

function openGeneralTask(task){
  if(!canEditTasks()){
    alert('Solo administradores y encargados pueden crear o editar tareas generales.');
    return;
  }
  state.editGeneralTask=task||null;
  $('general-task-dialog-title').textContent=task?'Editar tarea general':'Nueva tarea general';
  $('general-task-name').value=task?.nombre||'';
  $('general-task-detail').value=task?.detalle||'';
  $('delete-general-task').hidden=!task;
  showDialog('general-task-dialog');
}

async function saveGeneralTask(){
  if(!canEditTasks())return;
  const nombre=$('general-task-name').value.trim();
  const detalle=$('general-task-detail').value.trim();
  if(!nombre){alert('Escribí el nombre de la tarea.');return}
  const button=$('save-general-task');
  button.disabled=true;
  try{
    if(state.editGeneralTask){
      const q=await db.from('tareas_generales').update({nombre,detalle}).eq('id',state.editGeneralTask.id);
      if(q.error)throw q.error;
    }else{
      const q=await db.from('tareas_generales').insert({nombre,detalle,estado:'pendiente',creada_por:state.session.user.id});
      if(q.error)throw q.error;
    }
    closeDialog('general-task-dialog');
    state.editGeneralTask=null;
    await refresh();
  }catch(error){
    console.error(error);
    alert(error.message||'No se pudo guardar la tarea general.');
  }finally{button.disabled=false}
}

async function deleteGeneralTask(){
  if(!state.editGeneralTask||!canEditTasks())return;
  if(!confirm(`¿Eliminar "${state.editGeneralTask.nombre}"?`))return;
  const q=await db.from('tareas_generales').delete().eq('id',state.editGeneralTask.id);
  if(q.error){alert(q.error.message);return}
  closeDialog('general-task-dialog');
  state.editGeneralTask=null;
  await refresh();
}

async function completeGeneralTask(t,ids){
  const q=await db.from('tareas_generales').update({
    estado:'realizada',
    realizada_at:new Date().toISOString(),
    registrada_por:state.session.user.id
  }).eq('id',t.id);
  if(q.error)throw q.error;
  await db.from('tarea_general_empleados').delete().eq('tarea_general_id',t.id);
  if(ids.length){
    const j=await db.from('tarea_general_empleados').insert(ids.map(id=>({tarea_general_id:t.id,empleado_id:id})));
    if(j.error)throw j.error;
  }
  await refresh();
}

async function undoGeneralTask(t){
  const q=await db.from('tareas_generales').update({
    estado:'pendiente',realizada_at:null,registrada_por:null
  }).eq('id',t.id);
  if(q.error)throw q.error;
  await db.from('tarea_general_empleados').delete().eq('tarea_general_id',t.id);
  await refresh();
}

function fillRoomSelect(selectedRoom=''){
  const select=$('task-room');
  select.innerHTML='';
  rules.forEach(room=>{
    const option=document.createElement('option');
    option.value=room.name;
    option.textContent=room.name;
    option.selected=room.name===selectedRoom;
    select.appendChild(option);
  });
}

function openTask(dateString,t,roomName=''){
  if(!canEditTasks()){
    alert('Solo administradores y encargados pueden crear o editar tareas.');
    return;
  }

  state.editTask=t||null;
  $('task-dialog-title').textContent=t?'Editar tarea':'Nueva tarea';
  $('task-date').value=t?.date||dateString||ymd(today());
  fillRoomSelect(t?.room||roomName||'Flora 1');
  $('task-name').value=t?.task||'';
  $('task-detail').value=t?.detail||'';

  const dialog=$('task-dialog');
  if(typeof dialog.showModal==='function') dialog.showModal();
  else dialog.setAttribute('open','');
}

async function saveTaskDialog(){
  const date=$('task-date').value;
  const room=$('task-room').value;
  const name=$('task-name').value.trim();
  const detail=$('task-detail').value.trim();

  if(!date||!room||!name){
    alert('Completá fecha, sala y tarea.');
    return;
  }

  const button=$('save-task');
  button.disabled=true;
  try{
    let row=null;
    if(state.editTask){
      const originalDate=state.editTask.date;
      const moved=date!==originalDate;

      if(!state.editTask.custom&&moved){
        row=state.editTask.db||await ensure(state.editTask);

        const cancelOriginal=await db.from('tareas')
          .update({estado:'cancelada'})
          .eq('id',row.id);
        if(cancelOriginal.error) throw cancelOriginal.error;

        const createMoved=await db.from('tareas').insert({
          sala_id:sr(room)?.id||null,
          fecha:date,
          nombre:name,
          detalle:detail,
          tipo:'reprogramada',
          estado:done(state.editTask)?'realizada':'pendiente'
        });
        if(createMoved.error) throw createMoved.error;
      }else{
        row=state.editTask.db||await ensure(state.editTask);
        const preservedType=state.editTask.custom
          ? (state.editTask.type||'extraordinaria')
          : 'rutina';

        const q=await db.from('tareas').update({
          sala_id:sr(room)?.id||null,
          fecha:date,
          nombre:name,
          detalle:detail,
          tipo:preservedType,
          estado:done(state.editTask)?'realizada':'pendiente'
        }).eq('id',row.id);
        if(q.error) throw q.error;
      }
    }else{
      const q=await db.from('tareas').insert({
        sala_id:sr(room)?.id||null,
        fecha:date,
        nombre:name,
        detalle:detail,
        tipo:'extraordinaria',
        estado:'pendiente'
      });
      if(q.error) throw q.error;
    }
    closeDialog('task-dialog');
    state.editTask=null;
    await refresh();
  }catch(error){
    console.error(error);
    alert(error.message||'No se pudo guardar la tarea.');
  }finally{
    button.disabled=false;
  }
}

function openBed(id){
  const bed=state.camas.find(x=>String(x.id)===String(id));
  if(!bed) return;
  state.editBed=bed;
  $('bed-dialog-title').textContent=`Editar cama ${bed.numero}`;
  $('bed-capacity').value=String(bed.capacidad||9);
  $('bed-notes').value=bed.observaciones||bed.notas||'';
  $('bed-dialog').showModal();
}

async function saveBedDialog(){
  if(!state.editBed) return;
  const payload={capacidad:Number($('bed-capacity').value)};
  if(Object.prototype.hasOwnProperty.call(state.editBed,'observaciones')) payload.observaciones=$('bed-notes').value.trim();
  else if(Object.prototype.hasOwnProperty.call(state.editBed,'notas')) payload.notas=$('bed-notes').value.trim();

  const q=await db.from('camas').update(payload).eq('id',state.editBed.id);
  if(q.error) throw q.error;
  closeDialog('bed-dialog');
  state.editBed=null;
  await refresh();
}

function openPlant(id){
  const plant=state.plantas.find(x=>String(x.id)===String(id));
  if(!plant) return;
  state.editPlant=plant;
  $('plant-dialog-title').textContent=`Editar planta ${plant.posicion}`;
  $('plant-status').value=plant.ocupada?'occupied':'empty';

  const select=$('plant-genetics');
  select.innerHTML='<option value="">Sin genética</option>';
  state.geneticas.filter(genetic=>genetic.activa!==false||String(genetic.id)===String(plant.genetica_id||'')).forEach(genetic=>{
    const option=document.createElement('option');
    option.value=genetic.id;
    option.textContent=genetic.nomenclatura?`${genetic.nomenclatura} — ${genetic.nombre}`:genetic.nombre;
    option.selected=String(genetic.id)===String(plant.genetica_id||'');
    select.appendChild(option);
  });
  $('plant-notes').value=plant.observaciones||plant.notas||'';
  $('plant-dialog').showModal();
}

async function savePlantDialog(){
  if(!state.editPlant) return;
  const occupied=$('plant-status').value==='occupied';
  const payload={
    ocupada:occupied,
    genetica_id:occupied&&$('plant-genetics').value?$('plant-genetics').value:null
  };
  if(Object.prototype.hasOwnProperty.call(state.editPlant,'observaciones')) payload.observaciones=$('plant-notes').value.trim();
  else if(Object.prototype.hasOwnProperty.call(state.editPlant,'notas')) payload.notas=$('plant-notes').value.trim();

  const q=await db.from('plantas').update(payload).eq('id',state.editPlant.id);
  if(q.error) throw q.error;
  closeDialog('plant-dialog');
  state.editPlant=null;
  await refresh();
}

$('cancel-worker').onclick=()=>{
  state.pending=null;
  state.selected.clear();
  closeDialog('worker-dialog');
  render();
};

async function saveWorkerCompletion(continueTomorrow=false){
  if(!state.pending)return;
  if(!state.selected.size){
    alert('Elegí al menos una persona que realizó la tarea.');
    return;
  }
  const button=continueTomorrow?$('continue-worker'):$('confirm-worker');
  button.disabled=true;
  try{
    if(state.pendingKind==='general')await completeGeneralTask(state.pending,[...state.selected]);
    else await complete(state.pending,[...state.selected],continueTomorrow);
    state.pending=null;
    state.selected.clear();
    closeDialog('worker-dialog');
  }catch(error){
    console.error(error);
    alert(error.message||'No se pudo completar la tarea.');
  }finally{button.disabled=false;}
}
$('confirm-worker').onclick=()=>saveWorkerCompletion(false);
$('continue-worker').onclick=()=>saveWorkerCompletion(true);

$('cancel-task').onclick=()=>{
  state.editTask=null;
  closeDialog('task-dialog');
};
$('save-task').onclick=saveTaskDialog;
$('cancel-general-task').onclick=()=>{state.editGeneralTask=null;closeDialog('general-task-dialog')};
$('save-general-task').onclick=saveGeneralTask;
$('delete-general-task').onclick=deleteGeneralTask;


$('cancel-bed').onclick=()=>{
  state.editBed=null;
  closeDialog('bed-dialog');
};
$('save-bed').onclick=async()=>{
  try{await saveBedDialog()}catch(error){console.error(error);alert(error.message||'No se pudo guardar la cama.')}
};

$('cancel-plant').onclick=()=>{
  state.editPlant=null;
  closeDialog('plant-dialog');
};
$('save-plant').onclick=async()=>{
  try{await savePlantDialog()}catch(error){console.error(error);alert(error.message||'No se pudo guardar la planta.')}
};

$('cancel-genetic').onclick=()=>{
  state.editGenetic=null;
  closeDialog('genetic-dialog');
};
$('genetic-unknown').onchange=updateGenotypeFields;
$('genetic-indica').oninput=()=>{const v=Number($('genetic-indica').value);if(Number.isFinite(v)&&v>=0&&v<=100)$('genetic-sativa').value=100-v};
$('genetic-sativa').oninput=()=>{const v=Number($('genetic-sativa').value);if(Number.isFinite(v)&&v>=0&&v<=100)$('genetic-indica').value=100-v};
$('save-genetic').onclick=async()=>{
  const button=$('save-genetic');
  button.disabled=true;
  try{await saveGeneticDialog()}catch(error){console.error(error);alert(error.message||'No se pudo guardar la genética.')}finally{button.disabled=false}
};


function render(){const cb=$('header-config');if(cb){const ok=currentRole()==='administrador';cb.hidden=!ok;cb.style.display=ok?'inline-flex':'none';cb.onclick=()=>{state.view='settings';render()}} $('today-label').textContent=nice(today());
$('cancel-stock-movement').onclick=()=>closeDialog('stock-movement-dialog');
$('stock-movement-cycle').onchange=updateStockMovementItems;
$('save-stock-movement').onclick=async()=>{const b=$('save-stock-movement');b.disabled=true;try{await saveStockMovement()}catch(e){console.error(e);alert(e.message||'No se pudo registrar el movimiento.')}finally{b.disabled=false}};
$('cancel-harvest').onclick=()=>closeDialog('harvest-dialog');
$('add-harvest-line').onclick=()=>{$('harvest-lines').insertAdjacentHTML('beforeend',harvestLineTemplate());bindHarvestLines()};
$('harvest-total').oninput=updateHarvestLineTotal;
$('save-harvest').onclick=async()=>{try{await saveHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo guardar la cosecha.')}};
$('delete-harvest').onclick=async()=>{try{await deleteHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo eliminar la cosecha.')}};

document.querySelectorAll('.top-nav button').forEach(b=>{const allowed=canViewOperations();b.hidden=!allowed;b.style.display=allowed?'':'none';b.classList.toggle('active',b.dataset.view===state.view)});if(!canViewOperations()){app.innerHTML='<section class="panel error-panel"><strong>Sin permisos</strong><p>Tu usuario no tiene acceso a la información operativa.</p></section>';return}if(state.view==='today')renderToday();if(state.view==='calendar')renderCalendar();if(state.view==='rooms')renderRooms();if(state.view==='genetics')renderGenetics();if(state.view==='harvests')renderHarvests();if(state.view==='stock')renderStock();if(state.view==='history')renderHistory();if(state.view==='settings')renderSettings();renderVoiceHelp()}
function renderToday(){
  $('screen-title').textContent='Hoy';
  const d=state.todayDay||today(),ts=tasks(d),n=ts.filter(done).length,p=ts.length?Math.round(n/ts.length*100):100;
  const pendingGeneral=state.generalTasks.filter(t=>t.estado!=='realizada');
  app.innerHTML=`<div class="today-date-controls"><button id="today-back" class="secondary" ${same(d,today())?'disabled':''}>Volver a hoy</button><div class="day-navigator"><button id="today-prev" class="secondary nav-day" aria-label="Día anterior">◀</button><div class="room-date-label">${shortRoomDate(d)}</div><button id="today-next" class="secondary nav-day" aria-label="Día siguiente">▶</button></div></div><div class="today-layout">
    <div class="today-main">
      <section class="panel daily-summary"><div class="daily-summary-head"><div>${taskCounter(n,ts.length)}</div></div><div class="progress"><span style="width:${p}%"></span></div></section>
      <div class="today-room-list">${rules.map(r=>{
        const rt=orderedTasks(ts.filter(t=>t.room===r.name)),pr=progress(r,d);
        return`<section class="room-card"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${roomStatus(r,d)}</div></div><div class="room-head-actions">${taskCounter(pr.done,pr.total)}${canEditTasks()?`<button class="task-menu room-options-button" type="button" data-room-menu="${r.name}" data-room-date="${ymd(d)}" aria-label="Opciones de ${r.name}" title="Opciones de sala">⋮</button>`:''}</div></div><div class="progress"><span style="width:${pr.pct}%"></span></div><div class="room-tasks">${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}</div></section>`}).join('')}</div>
    </div>
    <aside class="general-tasks-panel panel">
      <div class="general-tasks-head"><h2>Tareas generales</h2>${canEditTasks()?'<button id="add-general-task" class="primary compact-button" type="button">+ Agregar tarea</button>':''}</div>
      <div class="general-task-section">${pendingGeneral.length?pendingGeneral.map(generalTaskRow).join(''):'<div class="empty-room-tasks">No hay tareas generales pendientes</div>'}</div>
    </aside>
  </div>`;
  $('today-prev').onclick=()=>{state.todayDay=add(d,-1);render()};
  $('today-next').onclick=()=>{state.todayDay=add(d,1);render()};
  $('today-back').onclick=()=>{state.todayDay=today();render()};
  bind(d);
  bindGeneralTasks();
}
function renderCalendar(){ $('screen-title').textContent='Calendario';if(state.day){renderDay(state.day);return}const m=state.month,now=today(),currentMonth=m.getFullYear()===now.getFullYear()&&m.getMonth()===now.getMonth(),first=new Date(m.getFullYear(),m.getMonth(),1),start=add(first,-((first.getDay()+6)%7)),days=Array.from({length:42},(_,i)=>add(start,i));app.innerHTML=`<div class="calendar-today-action"><button id="back-today" class="secondary" ${currentMonth?'disabled':''}>Volver a hoy</button></div><div class="toolbar"><button id="prev">‹</button><strong>${monthName(m)}</strong><button id="next">›</button></div><div class="calendar">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${days.map(d=>{const x=tasks(d),n=x.filter(done).length,hasPastPending=diff(d,now)<0&&x.some(t=>!done(t));return`<div class="day-cell ${same(d,now)?'today':''} ${hasPastPending?'past-pending':''} ${d.getMonth()===m.getMonth()?'':'dim'}" data-date="${ymd(d)}"><div class="day-num">${d.getDate()}</div><div class="day-state">${rules.filter(r=>r.type==='flora').map(r=>`${r.name.replace('Flora ','F')}: C${cycleNumber(r,d)} · ${cycle(r,d).label}`).join('<br>')}</div><div class="day-done">${taskCounter(n,x.length)}</div></div>`}).join('')}</div>`;$('back-today').onclick=()=>{state.day=null;state.month=new Date(now.getFullYear(),now.getMonth(),1);render()};$('prev').onclick=()=>{state.month=new Date(m.getFullYear(),m.getMonth()-1,1);render()};$('next').onclick=()=>{state.month=new Date(m.getFullYear(),m.getMonth()+1,1);render()};app.querySelectorAll('[data-date]').forEach(x=>x.onclick=()=>{state.day=parse(x.dataset.date);render()})}
function renderDay(d){
  const ts=tasks(d),n=ts.filter(done).length;
  const completedGeneral=generalTasksForDate(d);
  app.innerHTML=`<div class="calendar-day-top"><button id="back-cal" class="secondary">← Volver</button><button id="calendar-day-today" class="secondary" ${same(d,today())?'disabled':''}>Volver a hoy</button></div><section class="panel"><div class="daily-summary-head calendar-day-summary"><button id="calendar-day-prev" class="secondary nav-day" aria-label="Día anterior">◀</button><div class="calendar-day-title"><h2>${nice(d)}</h2>${taskCounter(n,ts.length)}</div><button id="calendar-day-next" class="secondary nav-day" aria-label="Día siguiente">▶</button>${canEditTasks()?`<button class="primary compact-button" data-new="${ymd(d)}">+ Nueva tarea</button>`:''}</div></section><div class="today-room-list">${rules.map(r=>{const rt=orderedTasks(ts.filter(t=>t.room===r.name)),pr=progress(r,d);return`<section class="room-card"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${stage(r,d)}</div></div><div class="room-head-actions">${taskCounter(pr.done,pr.total)}${canEditTasks()?`<button class="task-menu room-options-button" type="button" data-room-menu="${r.name}" data-room-date="${ymd(d)}" aria-label="Opciones de ${r.name}" title="Opciones de sala">⋮</button>`:''}</div></div><div class="progress"><span style="width:${pr.pct}%"></span></div><div class="room-tasks">${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}</div></section>`}).join('')}</div>${completedGeneral.length?`<section class="panel general-history-day"><h3>Tareas generales realizadas</h3><div class="general-task-section">${completedGeneral.map(generalTaskRow).join('')}</div></section>`:''}`;
  $('back-cal').onclick=()=>{state.day=null;state.month=new Date(d.getFullYear(),d.getMonth(),1);render()};
  $('calendar-day-prev').onclick=()=>{state.day=add(d,-1);render()};
  $('calendar-day-next').onclick=()=>{state.day=add(d,1);render()};
  $('calendar-day-today').onclick=()=>{state.day=today();render()};
  bind(d);
  bindGeneralTasks();
}
function beds(name){const s=sr(name);return state.camas.filter(c=>c.sala_id===s?.id).sort((a,b)=>a.numero-b.numero)}function plants(b){return state.plantas.filter(p=>p.cama_id===b.id&&p.habilitada).sort((a,b)=>a.posicion-b.posicion)}
function croquisGeneticCode(genetic){
  if(!genetic)return'S/G';
  const nomenclature=String(genetic.nomenclatura||'').trim();
  if(nomenclature)return nomenclature.slice(0,7).toUpperCase();
  const words=String(genetic.nombre||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return'S/G';
  if(words.length===1)return words[0].slice(0,5).toUpperCase();
  return words.slice(0,5).map(word=>word[0]).join('').toUpperCase();
}
function croquisGeneticColor(genetic){
  const palette=['#f97316','#22c55e','#3b82f6','#a855f7','#eab308','#06b6d4','#ec4899','#84cc16','#f43f5e','#14b8a6'];
  const key=String(genetic?.id||genetic?.nombre||'sin-genetica');
  let hash=0;
  for(const character of key)hash=((hash<<5)-hash)+character.charCodeAt(0);
  return palette[Math.abs(hash)%palette.length];
}
function renderRooms(){ $('screen-title').textContent='Salas';if(!state.room){app.innerHTML=`<div class="list">${rules.map(r=>{const pr=progress(r,today());return`<section class="room-card" data-room="${r.name}"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${roomStatus(r,today())}</div></div><div class="room-head-actions">${taskCounter(pr.done,pr.total)}${canEditTasks()?`<button class="task-menu room-options-button" type="button" data-room-menu="${r.name}" data-room-date="${ymd(today())}" aria-label="Opciones de ${r.name}" title="Opciones de sala">⋮</button>`:''}</div></div></section>`}).join('')}</div>`;app.querySelectorAll('[data-room]').forEach(x=>x.onclick=()=>{state.room=x.dataset.room;state.roomDay=today();render()});app.querySelectorAll('[data-room-menu]').forEach(button=>button.onclick=event=>{event.stopPropagation();openRoomMenu(button.dataset.roomMenu,button.dataset.roomDate)});return}const r=rr(state.room),cro=r.type==='flora',d=state.roomDay||today(),rt=orderedTasks(tasks(d).filter(t=>t.room===r.name)),pr=progress(r,d);app.innerHTML=`<button id="back-room" class="secondary">← Volver</button><section class="panel room-detail-header"><div class="room-head"><div><h2>${r.name}</h2><p class="muted">${roomStatus(r,d)}</p></div><div class="room-head-actions">${taskCounter(pr.done,pr.total)}${canEditTasks()?`<button class="task-menu room-options-button" type="button" data-room-menu="${r.name}" data-room-date="${ymd(d)}" aria-label="Opciones de ${r.name}" title="Opciones de sala">⋮</button>`:''}</div></div><div class="room-date-controls"><button id="room-today" class="secondary room-back-today" ${same(d,today())?'disabled':''}>${same(d,today())?'Hoy':'Volver a hoy'}</button><div class="day-navigator"><button id="room-prev" class="secondary nav-day" aria-label="Día anterior">◀</button><div class="room-date-label">${shortRoomDate(d)}</div><button id="room-next" class="secondary nav-day" aria-label="Día siguiente">▶</button></div></div></section>${cro?`<div class="room-tabs"><button data-tab="summary" class="${state.tab==='summary'?'active':''}">Resumen</button><button data-tab="croquis" class="${state.tab==='croquis'?'active':''}">Croquis</button></div>`:''}${state.tab==='croquis'&&cro?renderCroquis(r):`<div class="section-title">Tareas del ${nice(d)}</div>${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}`}`;$('back-room').onclick=()=>{state.room=null;state.roomDay=null;state.tab='summary';render()};$('room-prev').onclick=()=>{state.roomDay=add(d,-1);render()};$('room-next').onclick=()=>{state.roomDay=add(d,1);render()};$('room-today').onclick=()=>{state.roomDay=today();render()};app.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{state.tab=x.dataset.tab;render()});app.querySelectorAll('[data-bed]').forEach(x=>x.onclick=()=>openBed(x.dataset.bed));app.querySelectorAll('[data-plant]').forEach(x=>x.onclick=()=>openPlant(x.dataset.plant));bind(d);app.querySelectorAll('[data-room-menu]').forEach(button=>button.onclick=event=>{event.stopPropagation();openRoomMenu(button.dataset.roomMenu,button.dataset.roomDate||ymd(d))})}
function renderCroquis(r){const bs=beds(r.name),ps=bs.flatMap(plants),occ=ps.filter(p=>p.ocupada),cols=r.name==='Flora 3'?4:3;return`<section class="panel"><div class="croquis-metrics"><div><span>Plantas</span><strong>${occ.length}</strong></div><div><span>Capacidad</span><strong>${ps.length}</strong></div><div><span>Camas</span><strong>${bs.length}</strong></div></div></section><section class="croquis-shell"><div class="side-aisle"><span>Pasillo lateral</span></div><div class="beds-grid" style="--bed-columns:${cols}">${bs.map(b=>{const pp=plants(b),n=pp.filter(p=>p.ocupada).length;return`<article class="bed-card"><button class="bed-edit-button" data-bed="${b.id}"><div class="bed-card-head"><strong>Cama ${String(b.numero).padStart(2,'0')}</strong><span>${n}/${b.capacidad}</span></div></button><div class="plant-grid">${Array.from({length:9},(_,i)=>{const p=pp.find(x=>x.posicion===i+1);if(!p)return'<span class="plant-position plant-spacer"></span>';const genetic=state.geneticas.find(x=>String(x.id)===String(p.genetica_id));const g=genetic?(genetic.nomenclatura?`${genetic.nomenclatura} — ${genetic.nombre}`:genetic.nombre):'Sin genética asignada';const code=croquisGeneticCode(genetic);const style=p.ocupada?` style="--plant-color:${croquisGeneticColor(genetic)}"`:'';return`<button class="plant-position ${p.ocupada?'occupied':''}" data-plant="${p.id}" title="${p.ocupada?g:'Vacía'}" aria-label="${p.ocupada?`Planta ${p.posicion}: ${g}`:`Posición ${p.posicion} vacía`}"${style}>${p.ocupada?`<span class="plant-code">${code}</span>`:''}</button>`}).join('')}</div></article>`}).join('')}</div><div class="side-aisle"><span>Pasillo lateral</span></div></section>`}


function escapeHtml(value){
  return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}


function formatGenotype(genetic){
  const indica=Number(genetic?.porcentaje_indica);
  const sativa=Number(genetic?.porcentaje_sativa);
  if(Number.isFinite(indica)&&Number.isFinite(sativa))return `${indica}% Índica / ${sativa}% Sativa`;
  return genetic?.genotipo||'Genotipo desconocido';
}

function renderGenetics(){
  $('screen-title').textContent='Genéticas';
  const canManage=currentRole()==='administrador';
  const rows=[...state.geneticas].sort((a,b)=>{
    const activeDiff=Number(b.activa!==false)-Number(a.activa!==false);
    return activeDiff||String(a.nombre||'').localeCompare(String(b.nombre||''),'es',{sensitivity:'base'});
  });
  app.innerHTML=`
    <section class="panel genetics-page-head">
      <div><h2>Genéticas</h2><p class="muted">Listado central de variedades, nomenclaturas, linajes, cannabinoides y genotipos.</p></div>
      ${canManage?'<button id="add-genetic" class="primary compact-button" type="button">+ Nueva genética</button>':''}
    </section>
    <section class="panel genetics-table-panel">
      ${rows.length?`<div class="genetics-table-wrap"><table class="genetics-table"><thead><tr><th>Genética</th><th>Nomenclatura</th><th>Linaje</th><th>Cannabinoides</th><th>Genotipo</th><th>Estado</th>${canManage?'<th></th>':''}</tr></thead><tbody>${rows.map(g=>`<tr class="${g.activa===false?'genetic-archived':''}"><td data-label="Genética"><strong>${escapeHtml(g.nombre||'—')}</strong></td><td data-label="Nomenclatura">${escapeHtml(g.nomenclatura||'—')}</td><td data-label="Linaje">${escapeHtml(g.linaje||'—')}</td><td data-label="Cannabinoides">${escapeHtml(g.cannabinoides||'—')}</td><td data-label="Genotipo">${escapeHtml(formatGenotype(g))}</td><td data-label="Estado"><span class="genetic-status ${g.activa===false?'archived':'active'}">${g.activa===false?'Archivada':'Activa'}</span></td>${canManage?`<td class="genetic-actions"><button class="secondary compact-button" type="button" data-edit-genetic="${g.id}">Editar</button></td>`:''}</tr>`).join('')}</tbody></table></div>`:'<div class="empty-room-tasks">Todavía no hay genéticas cargadas.</div>'}
    </section>`;
  if(canManage){
    $('add-genetic').onclick=()=>openGenetic();
    app.querySelectorAll('[data-edit-genetic]').forEach(button=>button.onclick=()=>openGenetic(button.dataset.editGenetic));
  }
}

function openGenetic(id=null){
  if(currentRole()!=='administrador')return;
  const genetic=id?state.geneticas.find(g=>String(g.id)===String(id)):null;
  state.editGenetic=genetic||null;
  $('genetic-dialog-title').textContent=genetic?'Editar genética':'Nueva genética';
  $('genetic-name').value=genetic?.nombre||'';
  $('genetic-code').value=genetic?.nomenclatura||'';
  $('genetic-lineage').value=genetic?.linaje||'';
  $('genetic-cannabinoids').value=genetic?.cannabinoides||'';
  const hasPercentages=genetic?.porcentaje_indica!=null&&genetic?.porcentaje_sativa!=null;
  $('genetic-unknown').checked=!hasPercentages;
  $('genetic-indica').value=hasPercentages?genetic.porcentaje_indica:'';
  $('genetic-sativa').value=hasPercentages?genetic.porcentaje_sativa:'';
  updateGenotypeFields();
  $('genetic-active').value=String(genetic?.activa!==false);
  $('genetic-dialog').showModal();
  setTimeout(()=>$('genetic-name').focus(),0);
}

function updateGenotypeFields(){
  const disabled=$('genetic-unknown').checked;
  $('genetic-indica').disabled=disabled;
  $('genetic-sativa').disabled=disabled;
  if(disabled){$('genetic-indica').value='';$('genetic-sativa').value='';}
}

async function saveGeneticDialog(){
  if(currentRole()!=='administrador')throw new Error('Solo un administrador puede modificar genéticas.');
  const nombre=$('genetic-name').value.trim();
  if(!nombre)throw new Error('Completá el nombre de la genética.');
  const payload={
    nombre,
    nomenclatura:$('genetic-code').value.trim()||null,
    linaje:$('genetic-lineage').value.trim()||null,
    cannabinoides:$('genetic-cannabinoids').value.trim()||null,
    porcentaje_indica:null,
    porcentaje_sativa:null,
    genotipo:null,
    activa:$('genetic-active').value==='true'
  };
  const unknown=$('genetic-unknown').checked;
  if(!unknown){
    const indica=Number($('genetic-indica').value);
    const sativa=Number($('genetic-sativa').value);
    if(!Number.isFinite(indica)||!Number.isFinite(sativa))throw new Error('Completá los porcentajes de Índica y Sativa.');
    if(indica<0||indica>100||sativa<0||sativa>100)throw new Error('Los porcentajes deben estar entre 0 y 100.');
    if(indica+sativa!==100)throw new Error('Los porcentajes de Índica y Sativa deben sumar 100.');
    payload.porcentaje_indica=indica;
    payload.porcentaje_sativa=sativa;
    payload.genotipo=`${indica}% Índica / ${sativa}% Sativa`;
  }
  const duplicate=state.geneticas.find(g=>String(g.nombre||'').trim().toLowerCase()===nombre.toLowerCase()&&String(g.id)!==String(state.editGenetic?.id||''));
  if(duplicate)throw new Error('Ya existe una genética con ese nombre.');
  const q=state.editGenetic
    ?await db.from('geneticas').update(payload).eq('id',state.editGenetic.id)
    :await db.from('geneticas').insert(payload);
  if(q.error)throw q.error;
  closeDialog('genetic-dialog');
  state.editGenetic=null;
  await refresh();
}


function formatGrams(value){return `${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(Number(value)||0)} g`}
function harvestDetails(id){return state.cosechaDetalles.filter(x=>String(x.cosecha_id)===String(id))}
function harvestDeviation(h){const goal=Number(h.meta_gramos)||0;return goal?((Number(h.total_gramos)-goal)/goal)*100:null}
function harvestGeneticName(row){return row.nombre_historico||state.geneticas.find(g=>String(g.id)===String(row.genetica_id))?.nombre||'Sin identificar'}
function groupedHarvestDetails(id){
  const grouped=[];
  const byGenetic=new Map();
  harvestDetails(id).forEach((row,index)=>{
    if(row.genetica_id){
      const key=String(row.genetica_id);
      const existing=byGenetic.get(key);
      if(existing)existing.gramos=Number(existing.gramos||0)+Number(row.gramos||0);
      else{
        const copy={...row,gramos:Number(row.gramos)||0};
        byGenetic.set(key,copy);
        grouped.push(copy);
      }
    }else{
      grouped.push({...row,gramos:Number(row.gramos)||0,_historicalOrder:index});
    }
  });
  return grouped;
}
function renderHarvests(){
  $('screen-title').textContent='Cosechas';
  const canManage=canEditTasks();
  const rooms=['Flora 1','Flora 2','Flora 3'];
  const selectedRoom=rooms.includes(state.harvestRoom)?state.harvestRoom:null;
  const roomHarvests=selectedRoom?state.cosechas.filter(h=>h.sala===selectedRoom):[];
  const years=[...new Set(roomHarvests.map(h=>String(h.fecha||'').slice(0,4)).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  const selectedYear=years.includes(String(state.harvestYear))?String(state.harvestYear):null;

  if(!selectedRoom){
    state.harvestYear='todos';
    state.selectedHarvest=null;
    app.innerHTML=`<section class="panel harvest-page-head"><div><h2>Cosechas</h2><p class="muted">Elegí una sala para consultar sus resultados.</p></div>${canManage?'<button id="add-harvest" class="primary compact-button">+ Nueva cosecha</button>':''}</section>
    <section class="harvest-room-selector">${rooms.map(room=>{const count=state.cosechas.filter(h=>h.sala===room).length;return `<button class="panel harvest-room-button" data-harvest-room="${room}"><span>${room}</span><strong>${count} cosecha${count===1?'':'s'}</strong></button>`}).join('')}</section>`;
    app.querySelectorAll('[data-harvest-room]').forEach(b=>b.onclick=()=>{state.harvestRoom=b.dataset.harvestRoom;state.harvestYear='todos';state.selectedHarvest=null;renderHarvests()});
    if(canManage)$('add-harvest').onclick=()=>openHarvest();
    return;
  }

  if(!selectedYear){
    state.selectedHarvest=null;
    app.innerHTML=`<section class="panel harvest-page-head"><div><button id="harvest-back-rooms" class="secondary compact-button">← Salas</button><h2>${escapeHtml(selectedRoom)}</h2><p class="muted">Elegí el año que querés consultar.</p></div>${canManage?'<button id="add-harvest" class="primary compact-button">+ Nueva cosecha</button>':''}</section>
    <section class="harvest-year-selector">${years.length?years.map(year=>{const count=roomHarvests.filter(h=>String(h.fecha).startsWith(year)).length;return `<button class="panel harvest-year-button" data-harvest-year="${year}"><span>${year}</span><strong>${count} cosecha${count===1?'':'s'}</strong></button>`}).join(''):'<section class="panel empty-room-tasks">Todavía no hay cosechas cargadas para esta sala.</section>'}</section>`;
    $('harvest-back-rooms').onclick=()=>{state.harvestRoom='todas';state.harvestYear='todos';state.selectedHarvest=null;renderHarvests()};
    app.querySelectorAll('[data-harvest-year]').forEach(b=>b.onclick=()=>{state.harvestYear=b.dataset.harvestYear;state.selectedHarvest=null;renderHarvests()});
    if(canManage)$('add-harvest').onclick=()=>openHarvest();
    return;
  }

  const harvests=roomHarvests.filter(h=>String(h.fecha).startsWith(selectedYear)).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)||Number(a.ciclo)-Number(b.ciclo));
  const selected=harvests.find(h=>String(h.id)===String(state.selectedHarvest))||null;
  app.innerHTML=`<section class="panel harvest-page-head"><div><div class="harvest-breadcrumb-actions"><button id="harvest-back-years" class="secondary compact-button">← Años</button><button id="harvest-back-rooms" class="secondary compact-button">Cambiar sala</button></div><h2>${escapeHtml(selectedRoom)} · ${selectedYear}</h2><p class="muted">Seleccioná un ciclo en la tabla para ver su detalle debajo.</p></div>${canManage?'<button id="add-harvest" class="primary compact-button">+ Nueva cosecha</button>':''}</section>
  <section class="panel harvest-summary-panel"><div class="harvest-summary-wrap"><table class="harvest-summary-table"><thead><tr><th>Fecha</th><th>Ciclo</th><th>Total</th><th>Meta</th><th>Desvío</th></tr></thead><tbody>${harvests.length?harvests.map(h=>{const dev=harvestDeviation(h);const active=selected&&String(selected.id)===String(h.id);return `<tr class="${active?'selected':''}" data-harvest-select="${h.id}"><td data-label="Fecha">${parse(h.fecha).toLocaleDateString('es-AR')}</td><td data-label="Ciclo">Ciclo ${h.ciclo}</td><td data-label="Total"><strong>${formatGrams(h.total_gramos)}</strong></td><td data-label="Meta">${h.meta_gramos?formatGrams(h.meta_gramos):'—'}</td><td data-label="Desvío"><span class="${dev==null?'':dev>=0?'positive':'negative'}">${dev==null?'—':`${dev>=0?'+':''}${dev.toFixed(1)}%`}</span></td></tr>`}).join(''):'<tr><td colspan="5">No hay cosechas cargadas para este año.</td></tr>'}</tbody></table></div></section>
  ${selected?renderSelectedHarvestDetail(selected,canManage):'<section class="panel harvest-detail-placeholder">Elegí un ciclo de la tabla para ver el resultado de cada genética.</section>'}`;
  $('harvest-back-years').onclick=()=>{state.harvestYear='todos';state.selectedHarvest=null;renderHarvests()};
  $('harvest-back-rooms').onclick=()=>{state.harvestRoom='todas';state.harvestYear='todos';state.selectedHarvest=null;renderHarvests()};
  app.querySelectorAll('[data-harvest-select]').forEach(row=>row.onclick=()=>{state.selectedHarvest=row.dataset.harvestSelect;renderHarvests()});
  if(canManage){$('add-harvest').onclick=()=>openHarvest();const edit=app.querySelector('[data-edit-selected-harvest]');if(edit)edit.onclick=()=>openHarvest(edit.dataset.editSelectedHarvest)}
}
function renderSelectedHarvestDetail(h,canManage){
  const rows=groupedHarvestDetails(h.id);
  const gpp=Number(h.cantidad_plantas)>0?Number(h.total_gramos)/Number(h.cantidad_plantas):null;
  return `<section class="panel selected-harvest-detail"><div class="selected-harvest-head"><div><h3>${escapeHtml(h.sala)} · Ciclo ${h.ciclo}</h3><p class="muted">${parse(h.fecha).toLocaleDateString('es-AR')} · Total ${formatGrams(h.total_gramos)}${gpp?` · ${gpp.toFixed(2)} g/planta`:''}</p></div>${canManage?`<button class="secondary compact-button" data-edit-selected-harvest="${h.id}">Editar cosecha</button>`:''}</div>${rows.length?`<div class="harvest-detail-table"><div class="harvest-detail-row header"><span>Genética</span><span>Gramos</span><span>%</span></div>${rows.map(r=>`<div class="harvest-detail-row"><span>${escapeHtml(harvestGeneticName(r))}</span><strong>${formatGrams(r.gramos)}</strong><span>${Number(h.total_gramos)?(Number(r.gramos)/Number(h.total_gramos)*100).toFixed(1):'0'}%</span></div>`).join('')}<div class="harvest-detail-row total-row"><strong>Total</strong><strong>${formatGrams(h.total_gramos)}</strong><strong>100%</strong></div></div>`:'<p class="muted">Esta cosecha no tiene desglose por genética cargado.</p>'}${h.observaciones?`<p class="harvest-notes"><strong>Observaciones:</strong> ${escapeHtml(h.observaciones)}</p>`:''}</section>`;
}
function harvestLineTemplate(detail=null){
  const selected=detail?.genetica_id||'';
  const historical=detail&&!detail.genetica_id;
  return `<div class="harvest-line" data-existing-id="${detail?.id||''}" data-historical="${historical?'true':'false'}">${historical?`<label class="field-label">Nombre histórico<input class="text-input harvest-line-name" value="${escapeHtml(detail.nombre_historico||'')}" readonly></label>`:`<label class="field-label">Genética<select class="text-input harvest-line-genetic"><option value="">Seleccionar…</option>${state.geneticas.filter(g=>g.activa!==false||String(g.id)===String(selected)).map(g=>`<option value="${g.id}" ${String(g.id)===String(selected)?'selected':''}>${escapeHtml(g.nombre)}</option>`).join('')}</select></label>`}<label class="field-label">Gramos<input class="text-input harvest-line-grams" type="number" min="0" step="0.01" value="${detail?.gramos??''}"></label><button type="button" class="danger compact-button remove-harvest-line">Quitar</button></div>`;
}
function refreshHarvestGeneticOptions(){
  // Las mismas genéticas pueden cargarse en varias filas para registrar bolsas separadas.
  // Al guardar, la app las agrupa y suma automáticamente por genética.
}
function bindHarvestLines(){
  $('harvest-lines').querySelectorAll('.remove-harvest-line').forEach(b=>b.onclick=()=>{b.closest('.harvest-line').remove();updateHarvestLineTotal()});
  $('harvest-lines').querySelectorAll('.harvest-line-grams').forEach(i=>i.oninput=updateHarvestLineTotal);
  updateHarvestLineTotal();
}
function updateHarvestLineTotal(){
  const rows=[...$('harvest-lines').querySelectorAll('.harvest-line')];
  const sum=rows.reduce((total,row)=>total+(Number(row.querySelector('.harvest-line-grams')?.value)||0),0);
  const totalInput=$('harvest-total');
  const shouldCalculate=!state.editHarvest||rows.length>0;
  if(shouldCalculate&&totalInput){
    totalInput.value=Number(sum.toFixed(2));
    totalInput.readOnly=true;
    totalInput.title='Se calcula automáticamente con la suma de los resultados por genética.';
  }else if(totalInput){
    totalInput.readOnly=false;
    totalInput.title='';
  }
  $('harvest-line-total').textContent=shouldCalculate
    ?`Total calculado automáticamente: ${formatGrams(sum)}`
    :'Agregá el detalle por genética para calcular el total automáticamente.';
}
function openHarvest(id=null){
  if(!canEditTasks())return;
  const h=id?state.cosechas.find(x=>String(x.id)===String(id)):null;state.editHarvest=h||null;
  $('harvest-dialog-title').textContent=h?'Editar cosecha':'Nueva cosecha';$('harvest-date').value=h?.fecha||ymd(today());$('harvest-room').value=h?.sala||'Flora 1';$('harvest-cycle').value=h?.ciclo||'';$('harvest-goal').value=h?.meta_gramos??'';$('harvest-total').value=h?.total_gramos??'';$('harvest-plants').value=h?.cantidad_plantas??'';$('harvest-notes').value=h?.observaciones||'';$('delete-harvest').hidden=!h;
  $('harvest-lines').innerHTML=(h?harvestDetails(h.id):[]).map(harvestLineTemplate).join('');bindHarvestLines();$('harvest-dialog').showModal();
}
async function saveHarvestDialog(){
  if(!canEditTasks())throw new Error('No tenés permiso para editar cosechas.');
  const detailRows=[...$('harvest-lines').querySelectorAll('.harvest-line')];
  const calculatedTotal=detailRows.reduce((total,row)=>total+(Number(row.querySelector('.harvest-line-grams')?.value)||0),0);
  const useCalculatedTotal=!state.editHarvest||detailRows.length>0;
  const payload={fecha:$('harvest-date').value,sala:$('harvest-room').value,ciclo:Number($('harvest-cycle').value),meta_gramos:$('harvest-goal').value===''?null:Number($('harvest-goal').value),total_gramos:useCalculatedTotal?Number(calculatedTotal.toFixed(2)):Number($('harvest-total').value),cantidad_plantas:$('harvest-plants').value===''?null:Number($('harvest-plants').value),observaciones:$('harvest-notes').value.trim()||null,origen:state.editHarvest?.origen||'app'};
  if(!payload.fecha||!payload.ciclo||payload.total_gramos<0)throw new Error('Completá fecha, sala, ciclo y total cosechado.');
  const rawLines=[...$('harvest-lines').querySelectorAll('.harvest-line')].map((row,index)=>{const historical=row.dataset.historical==='true';const geneticId=historical?null:row.querySelector('.harvest-line-genetic')?.value||null;const genetic=state.geneticas.find(g=>String(g.id)===String(geneticId));return{id:row.dataset.existingId||null,genetica_id:geneticId,nombre_historico:historical?row.querySelector('.harvest-line-name').value:(genetic?.nombre||null),gramos:Number(row.querySelector('.harvest-line-grams').value),_index:index}}).filter(x=>x.gramos>0);
  if(rawLines.some(x=>!x.nombre_historico))throw new Error('Seleccioná una genética en cada fila cargada.');
  const lines=[];
  const groupedByGenetic=new Map();
  rawLines.forEach(line=>{
    if(!line.genetica_id){
      lines.push(line);
      return;
    }
    const key=String(line.genetica_id);
    const existing=groupedByGenetic.get(key);
    if(existing){
      existing.gramos=Number((Number(existing.gramos)+Number(line.gramos)).toFixed(2));
      if(!existing.id&&line.id)existing.id=line.id;
    }else{
      const grouped={...line};
      groupedByGenetic.set(key,grouped);
      lines.push(grouped);
    }
  });
  let harvestId=state.editHarvest?.id;
  if(harvestId){
    const q=await db.from('cosechas').update(payload).eq('id',harvestId);if(q.error)throw q.error;
    const previous=harvestDetails(harvestId);
    const keptIds=lines.filter(x=>x.id).map(x=>x.id);
    const removedIds=previous.filter(x=>!keptIds.includes(String(x.id))).map(x=>x.id);
    if(removedIds.length){const del=await db.from('cosecha_geneticas').delete().in('id',removedIds);if(del.error)throw del.error}
    for(const line of lines){
      const detailPayload={genetica_id:line.genetica_id,nombre_historico:line.nombre_historico,gramos:line.gramos};
      if(line.id){const u=await db.from('cosecha_geneticas').update(detailPayload).eq('id',line.id).eq('cosecha_id',harvestId);if(u.error)throw u.error}
      else{const i=await db.from('cosecha_geneticas').insert({...detailPayload,cosecha_id:harvestId});if(i.error)throw i.error}
    }
  }else{
    const q=await db.from('cosechas').insert(payload).select('id').single();if(q.error)throw q.error;harvestId=q.data.id;
    if(lines.length){
      const detailPayloads=lines.map(line=>({
        cosecha_id:harvestId,
        genetica_id:line.genetica_id,
        nombre_historico:line.nombre_historico,
        gramos:line.gramos
      }));
      const q2=await db.from('cosecha_geneticas').insert(detailPayloads);
      if(q2.error){
        await db.from('cosechas').delete().eq('id',harvestId);
        throw q2.error;
      }
    }
  }
  closeDialog('harvest-dialog');
  const linkedCycle=state.stockCycles.find(c=>String(c.cosecha_id||'')===String(harvestId));
  const syncMessage=linkedCycle
    ?`La cosecha quedó guardada. Ya está vinculada al Stock Palestina.\n\n¿Actualizar su stock sin duplicar el ingreso? Los cambios se registrarán como ajustes.`
    :`La cosecha quedó guardada.\n\n¿Crear automáticamente la planilla de Stock Palestina con el detalle por genética?`;
  if(confirm(syncMessage)){
    const sync=await db.rpc('sincronizar_cosecha_stock',{p_cosecha_id:harvestId});
    if(sync.error)throw new Error(`La cosecha se guardó, pero no se pudo sincronizar el stock: ${sync.error.message}`);
  }
  state.editHarvest=null;await refresh();state.view='harvests';render();
}
async function deleteHarvestDialog(){if(!state.editHarvest||!confirm(`¿Eliminar ${state.editHarvest.sala} · Ciclo ${state.editHarvest.ciclo}?`))return;const q=await db.from('cosechas').delete().eq('id',state.editHarvest.id);if(q.error)throw q.error;closeDialog('harvest-dialog');state.editHarvest=null;state.selectedHarvest=null;await refresh();state.view='harvests';render()}


function stockCycleItems(cycleId){return state.stockItems.filter(x=>String(x.ciclo_id)===String(cycleId))}
function stockCycleMovements(cycleId){return state.stockMovements.filter(x=>String(x.ciclo_id)===String(cycleId))}
function stockItemCurrent(item){
  const delta=state.stockMovements.filter(m=>m.afecta_stock&&String(m.existencia_id)===String(item.id)).reduce((sum,m)=>{
    const grams=Number(m.gramos)||0;
    return sum+(m.tipo==='entrada'?grams:m.tipo==='salida'?-grams:Number(m.ajuste_delta)||0);
  },0);
  return Math.max(0,(Number(item.stock_actual_base)||0)+delta);
}
function stockCycleCurrent(cycle){return stockCycleItems(cycle.id).reduce((sum,item)=>sum+stockItemCurrent(item),0)}
function stockMovementTitle(m){
  const item=state.stockItems.find(x=>String(x.id)===String(m.existencia_id));
  return m.nombre_historico||item?.nombre_historico||state.geneticas.find(g=>String(g.id)===String(m.genetica_id))?.nombre||'Sin identificar';
}
function stockMovementDate(m){if(m.fecha)return parse(m.fecha).toLocaleDateString('es-AR');return m.fecha_text||'Sin fecha'}
function renderStock(){
  $('screen-title').textContent='Stock Palestina';
  const canManage=canEditTasks();
  const rooms=['Flora 1','Flora 2','Flora 3'];
  const total=state.stockCycles.reduce((sum,c)=>sum+stockCycleCurrent(c),0);
  const available=[];
  state.stockCycles.forEach(c=>stockCycleItems(c.id).forEach(item=>{
    const current=stockItemCurrent(item);
    if(current>0)available.push({cycle:c,item,current});
  }));
  available.sort((a,b)=>b.current-a.current);

  if(!state.stockRoom){
    app.innerHTML=`<section class="panel stock-page-head"><div><h2>Stock Palestina</h2><p class="muted">Stock disponible actualmente en el edificio Palestina.</p></div>${canManage?'<button id="stock-add-movement" class="primary compact-button">+ Registrar movimiento</button>':''}</section>
    <section class="stock-room-selector">${rooms.map(room=>{const cycles=state.stockCycles.filter(c=>c.sala===room);const roomTotal=cycles.reduce((s,c)=>s+stockCycleCurrent(c),0);return `<button class="panel stock-room-button" data-stock-room="${room}"><span>${room}</span><strong>${formatGrams(roomTotal)}</strong><small>${cycles.length} ciclos</small></button>`}).join('')}</section>
    <button id="stock-current-toggle" class="panel stock-current-summary stock-current-toggle" type="button" aria-expanded="${state.stockOverviewExpanded?'true':'false'}" aria-controls="stock-current-detail"><span>Stock actual disponible</span><strong>${formatGrams(total)}</strong><small>${available.length} partida${available.length===1?'':'s'} con saldo · ${state.stockOverviewExpanded?'Ocultar detalle':'Ver detalle'}</small><span class="stock-toggle-icon" aria-hidden="true">${state.stockOverviewExpanded?'▲':'▼'}</span></button>
    <section id="stock-current-detail" class="panel stock-overview-panel ${state.stockOverviewExpanded?'':'stock-overview-collapsed'}"><div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>Sala</th><th>Ciclo</th><th>Genética</th><th>Disponible</th></tr></thead><tbody>${available.length?available.map(x=>`<tr><td>${escapeHtml(x.cycle.sala)}</td><td>Ciclo ${x.cycle.ciclo}</td><td>${escapeHtml(x.item.nombre_historico)}</td><td><strong>${formatGrams(x.current)}</strong></td></tr>`).join(''):'<tr><td colspan="4">No hay stock disponible cargado.</td></tr>'}</tbody></table></div></section>`;
    $('stock-current-toggle').onclick=()=>{state.stockOverviewExpanded=!state.stockOverviewExpanded;renderStock()};
    app.querySelectorAll('[data-stock-room]').forEach(b=>b.onclick=()=>{state.stockRoom=b.dataset.stockRoom;state.stockCycle=null;renderStock()});
    if(canManage)$('stock-add-movement').onclick=()=>openStockMovement();
    return;
  }

  const cycles=state.stockCycles.filter(c=>c.sala===state.stockRoom).sort((a,b)=>Number(b.ciclo)-Number(a.ciclo));
  const selected=cycles.find(c=>String(c.id)===String(state.stockCycle))||null;
  app.innerHTML=`<section class="panel stock-page-head"><div><button id="stock-back-home" class="secondary compact-button">← Stock general</button><h2>${escapeHtml(state.stockRoom)}</h2><p class="muted">Elegí un ciclo para consultar su stock y movimientos.</p></div>${canManage?'<button id="stock-add-movement" class="primary compact-button">+ Registrar movimiento</button>':''}</section>
  <section class="stock-cycle-selector">${cycles.map(c=>`<button class="panel stock-cycle-button ${selected&&String(selected.id)===String(c.id)?'active':''}" data-stock-cycle="${c.id}"><span>Ciclo ${c.ciclo}</span><strong>${formatGrams(stockCycleCurrent(c))}</strong><small>Inicial: ${formatGrams(c.stock_inicial)}</small></button>`).join('')}</section>
  ${selected?renderStockCycleDetail(selected,canManage):'<section class="panel stock-placeholder">Seleccioná un ciclo para ver el detalle.</section>'}`;
  $('stock-back-home').onclick=()=>{state.stockRoom=null;state.stockCycle=null;renderStock()};
  app.querySelectorAll('[data-stock-cycle]').forEach(b=>b.onclick=()=>{state.stockCycle=b.dataset.stockCycle;renderStock()});
  if(canManage){
    $('stock-add-movement').onclick=()=>openStockMovement(selected?.id||null);
    const addCycle=app.querySelector('[data-stock-add-cycle]');
    if(addCycle)addCycle.onclick=()=>openStockMovement(addCycle.dataset.stockAddCycle);
  }
}
function renderStockCycleDetail(cycle,canManage){
  const items=stockCycleItems(cycle.id);
  const movements=stockCycleMovements(cycle.id);
  return `<section class="stock-kpis"><div class="panel"><span>Stock inicial</span><strong>${formatGrams(cycle.stock_inicial)}</strong></div><div class="panel"><span>Stock actual</span><strong>${formatGrams(stockCycleCurrent(cycle))}</strong></div><div class="panel"><span>Genéticas</span><strong>${items.length}</strong></div><div class="panel"><span>Movimientos</span><strong>${movements.length}</strong></div></section>
  <section class="panel stock-detail-panel"><h3>Stock por genética</h3><div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>Genética</th><th>Stock inicial</th><th>Stock actual</th></tr></thead><tbody>${items.length?items.map(item=>`<tr><td>${escapeHtml(item.nombre_historico)}</td><td>${formatGrams(Number(item.stock_inicial)||0)}</td><td><strong>${formatGrams(stockItemCurrent(item))}</strong></td></tr>`).join(''):'<tr><td colspan="3">Sin detalle cargado.</td></tr>'}</tbody></table></div></section>
  <section class="panel stock-detail-panel"><div class="stock-section-head"><div><h3>Registro de movimientos</h3><p class="muted">Los movimientos históricos se conservan tal como estaban registrados en el Excel.</p></div>${canManage?`<button class="primary compact-button" data-stock-add-cycle="${cycle.id}">+ Movimiento</button>`:''}</div><div class="stock-table-wrap"><table class="stock-table movements"><thead><tr><th>Fecha</th><th>Genética / detalle</th><th>Tipo</th><th>Destino</th><th>Gramos</th></tr></thead><tbody>${movements.length?movements.map(m=>`<tr><td>${escapeHtml(stockMovementDate(m))}</td><td>${escapeHtml(stockMovementTitle(m))}</td><td><span class="stock-movement-type ${m.tipo}">${escapeHtml(m.tipo)}</span></td><td>${escapeHtml(m.destino||'—')}</td><td><strong>${formatGrams(m.gramos)}</strong></td></tr>`).join(''):'<tr><td colspan="5">No hay movimientos registrados.</td></tr>'}</tbody></table></div></section>`;
}
function openStockMovement(preselectedCycleId=null){
  const cycles=state.stockCycles.filter(c=>!state.stockRoom||c.sala===state.stockRoom).sort((a,b)=>a.sala.localeCompare(b.sala)||Number(b.ciclo)-Number(a.ciclo));
  const cycleId=preselectedCycleId||state.stockCycle||cycles[0]?.id||'';
  $('stock-movement-cycle').innerHTML=cycles.map(c=>`<option value="${c.id}" ${String(c.id)===String(cycleId)?'selected':''}>${escapeHtml(c.sala)} · Ciclo ${c.ciclo}</option>`).join('');
  $('stock-movement-date').value=ymd(today());
  $('stock-movement-type').value='salida';
  $('stock-movement-grams').value='';
  $('stock-movement-destination').value='Medrano';
  $('stock-movement-notes').value='';
  updateStockMovementItems();
  $('stock-movement-dialog').showModal();
}
function updateStockMovementItems(){
  const cycleId=$('stock-movement-cycle').value;
  const items=stockCycleItems(cycleId);
  $('stock-movement-item').innerHTML=items.map(i=>`<option value="${i.id}">${escapeHtml(i.nombre_historico)} · ${formatGrams(stockItemCurrent(i))}</option>`).join('');
}
async function saveStockMovement(){
  const cycleId=$('stock-movement-cycle').value;
  const itemId=$('stock-movement-item').value;
  const type=$('stock-movement-type').value;
  const grams=Number($('stock-movement-grams').value);
  if(!cycleId||!itemId)throw new Error('Seleccioná el ciclo y la genética.');
  if(!Number.isFinite(grams)||grams<=0)throw new Error('Ingresá una cantidad válida.');
  const item=state.stockItems.find(x=>String(x.id)===String(itemId));
  if(type==='salida'&&grams>stockItemCurrent(item))throw new Error('La salida supera el stock disponible de esa genética.');
  const payload={ciclo_id:cycleId,existencia_id:itemId,genetica_id:item?.genetica_id||null,nombre_historico:item?.nombre_historico||null,fecha:$('stock-movement-date').value||ymd(today()),fecha_text:null,tipo:type,destino:$('stock-movement-destination').value.trim()||null,gramos:grams,observaciones:$('stock-movement-notes').value.trim()||null,afecta_stock:true,origen:'app'};
  const q=await db.from('stock_movimientos').insert(payload);
  if(q.error)throw q.error;
  closeDialog('stock-movement-dialog');
  state.stockRoom=state.stockCycles.find(c=>String(c.id)===String(cycleId))?.sala||state.stockRoom;
  state.stockCycle=cycleId;
  await refresh();
}

function renderHistory(){
  $('screen-title').textContent='Historial';
  if(state.day){
    renderDay(state.day);
    return;
  }
  const end=add(today(),-1);
  const days=Array.from({length:60},(_,i)=>add(end,-i));
  app.innerHTML=`<section class="panel history-intro"><h3>Últimos 60 días</h3><p class="muted">Seleccioná una fecha para ver las tareas, responsables y estado de cada sala.</p></section><div class="history-list">${days.map(d=>{const ts=tasks(d),completed=ts.filter(done).length,generalCompleted=generalTasksForDate(d).length;return`<button class="history-day" data-history-date="${ymd(d)}"><div><strong>${nice(d)}</strong><div class="history-room-status">${rules.filter(r=>r.type==='flora').map(r=>`${r.name.replace('Flora ','F')}: C${cycleNumber(r,d)} · ${cycle(r,d).label}`).join(' · ')}</div>${generalCompleted?`<div class="history-room-status">${generalCompleted} tarea${generalCompleted===1?'':'s'} general${generalCompleted===1?'':'es'} realizada${generalCompleted===1?'':'s'}</div>`:''}</div>${taskCounter(completed,ts.length)}</button>`}).join('')}</div>`;
  app.querySelectorAll('[data-history-date]').forEach(button=>button.onclick=()=>{
    state.day=parse(button.dataset.historyDate);
    render();
  });
}


const BACKUP_FUNCTION='rainbows-backups';
function backupDate(value){
  if(!value)return'—';
  return new Date(value).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
}
function backupSize(bytes){
  const n=Number(bytes||0);
  if(n<1024)return`${n} B`;
  if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;
  return`${(n/1024/1024).toFixed(1)} MB`;
}
async function backupApi(action,payload={}){
  const {data,error}=await db.functions.invoke(BACKUP_FUNCTION,{body:{action,...payload}});
  if(error){
    let message=error.message||'No se pudo conectar con el sistema de backups.';
    try{
      const body=await error.context?.json?.();
      if(body?.error)message=body.error;
    }catch(_){/* respuesta no JSON */}
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data||{};
}
function setBackupStatus(message,kind=''){
  const el=$('backup-status');
  if(!el)return;
  el.textContent=message;
  el.className=`backup-status ${kind}`.trim();
}
function selectedBackupId(){
  return $('backup-select')?.value||state.backups[0]?.id||'';
}
async function loadBackups(){
  if(currentRole()!=='administrador'||state.backupLoading)return;
  state.backupLoading=true;
  setBackupStatus('Consultando copias guardadas…');
  try{
    const data=await backupApi('list');
    state.backups=data.backups||[];
    state.backupRuns=data.runs||[];
    const select=$('backup-select');
    if(select){
      select.innerHTML=state.backups.length
        ?state.backups.map(b=>`<option value="${b.id}">${backupDate(b.created_at)} · ${backupSize(b.size_in_bytes)}</option>`).join('')
        :'<option value="">Todavía no hay backups disponibles</option>';
      select.disabled=!state.backups.length;
    }
    const latest=state.backups[0];
    const running=state.backupRuns.find(r=>['queued','in_progress','waiting','pending','requested'].includes(r.status));
    if(running)setBackupStatus(`Proceso en curso: ${running.name||'backup'} (${running.status}).`,'working');
    else if(latest)setBackupStatus(`Último backup: ${backupDate(latest.created_at)} · vence ${backupDate(latest.expires_at)}.`,'ok');
    else setBackupStatus('No hay copias todavía. Podés crear la primera ahora.');
    const download=$('download-backup'),restore=$('restore-backup');
    if(download)download.disabled=!latest;
    if(restore)restore.disabled=!latest;
  }catch(error){
    console.error(error);
    setBackupStatus(error.message,'error');
  }finally{
    state.backupLoading=false;
  }
}
async function createManualBackup(){
  if(!confirm('¿Crear ahora una copia completa de Rainbows?'))return;
  const btn=$('create-backup');
  if(btn)btn.disabled=true;
  setBackupStatus('Solicitando backup manual…','working');
  try{
    await backupApi('create');
    setBackupStatus('Backup solicitado. GitHub lo está generando; puede tardar unos minutos.','working');
    setTimeout(loadBackups,12000);
    setTimeout(loadBackups,30000);
  }catch(error){
    console.error(error);
    setBackupStatus(error.message,'error');
  }finally{
    if(btn)btn.disabled=false;
  }
}
async function downloadBackup(){
  const artifactId=selectedBackupId();
  if(!artifactId)return;
  const btn=$('download-backup');
  if(btn)btn.disabled=true;
  setBackupStatus('Preparando descarga…','working');
  try{
    const data=await backupApi('download',{artifact_id:artifactId});
    if(!data.url)throw new Error('GitHub no devolvió un enlace de descarga.');
    window.location.assign(data.url);
    setBackupStatus('Descarga iniciada.','ok');
  }catch(error){
    console.error(error);
    setBackupStatus(error.message,'error');
  }finally{
    if(btn)btn.disabled=false;
  }
}
async function restoreBackup(){
  const artifactId=selectedBackupId();
  if(!artifactId)return;
  const text=prompt('La restauración reemplazará la información del proyecto de recuperación configurado. Escribí RESTAURAR para continuar.');
  if(text!=='RESTAURAR')return;
  if(!confirm('Última confirmación: ¿iniciar la restauración del backup seleccionado?'))return;
  const btn=$('restore-backup');
  if(btn)btn.disabled=true;
  setBackupStatus('Solicitando restauración…','working');
  try{
    await backupApi('restore',{artifact_id:artifactId,confirmation:'RESTAURAR'});
    setBackupStatus('Restauración solicitada. El proceso se ejecuta de forma segura en GitHub Actions.','working');
    setTimeout(loadBackups,12000);
  }catch(error){
    console.error(error);
    setBackupStatus(error.message,'error');
  }finally{
    if(btn)btn.disabled=false;
  }
}
function renderSettings(){
  if(currentRole()!=='administrador'){state.view='today';render();return}
  $('screen-title').textContent='Config';
  const permissions={administrador:'Acceso total: puede gestionar usuarios, roles, empleados, genéticas, tareas, configuración y backups.',encargado:'Puede crear, editar, completar y reprogramar tareas, además de consultar Hoy, Salas y Calendario.',empleado:'Puede consultar Hoy, Salas y Calendario, y completar tareas indicando quiénes las realizaron.',lectura:'Puede consultar Hoy, Salas y Calendario; no puede modificar información.'};
  app.innerHTML=`
    <section class="panel backup-panel">
      <div class="backup-panel-head"><div><h3>Copias de seguridad</h3><p class="muted">Backup completo diario, conservación por 30 días y descarga local.</p></div><button id="refresh-backups" class="secondary compact-button">Actualizar</button></div>
      <label class="field-label">Copia guardada<select id="backup-select" class="text-input"><option>Consultando…</option></select></label>
      <div class="backup-actions"><button id="create-backup" class="primary">Crear backup manual</button><button id="download-backup" class="secondary" disabled>Descargar backup</button><button id="restore-backup" class="danger" disabled>Restaurar backup</button></div>
      <p id="backup-status" class="backup-status" aria-live="polite">Consultando copias guardadas…</p>
      <p class="backup-warning">La restauración requiere doble confirmación y se ejecuta del lado del servidor. Ninguna clave privada queda dentro de la app.</p>
    </section>
    <section class="panel"><h3>Empleados compartidos</h3><textarea id="emps" class="text-input" style="min-height:150px">${state.empleados.map(e=>e.nombre).join('\n')}</textarea></section>
    <button id="save-conf" class="primary">Guardar configuración</button>
    <section class="panel"><h3>Usuarios</h3><div class="user-list">${state.perfiles.map(p=>`<div class="user-row"><div><strong>${p.nombre||'Sin nombre'}</strong><div class="user-email">${p.email||''}</div></div><select class="text-input user-role" data-role="${p.id}">${['administrador','encargado','empleado','lectura'].map(r=>`<option value="${r}" ${p.rol===r?'selected':''}>${r}</option>`).join('')}</select><label class="user-active"><input type="checkbox" data-active="${p.id}" ${p.activo?'checked':''}> Activo</label>${p.id!==state.session.user.id?`<button class="danger user-delete" data-delete-user="${p.id}" data-delete-name="${p.nombre||p.email||'este usuario'}">Eliminar cuenta</button>`:'<span class="self-account">Tu cuenta</span>'}</div>`).join('')}</div><p><button id="save-users" class="primary">Guardar usuarios</button></p></section>
    <section class="panel"><h3>Permisos por rol</h3><div class="role-permissions">${Object.entries(permissions).map(([role,text])=>`<div class="role-permission"><strong>${role}</strong><p>${text}</p></div>`).join('')}</div></section>
    <section class="panel account-summary"><p><strong>Usuario:</strong> ${state.session.user.email}</p><p><strong>Rol:</strong> ${state.profile?.rol||'empleado'}</p><p><strong>Tus permisos:</strong> ${permissions[state.profile?.rol||'empleado']}</p><p><strong>Versión:</strong> ${APP_VERSION}</p></section>`;
  $('save-conf').onclick=saveConfig;
  $('create-backup').onclick=createManualBackup;
  $('download-backup').onclick=downloadBackup;
  $('restore-backup').onclick=restoreBackup;
  $('refresh-backups').onclick=loadBackups;
  $('save-users').onclick=async()=>{try{for(const p of state.perfiles){const q=await db.rpc('admin_actualizar_perfil',{objetivo_id:p.id,nuevo_rol:document.querySelector(`[data-role="${p.id}"]`).value,nuevo_activo:document.querySelector(`[data-active="${p.id}"]`).checked});if(q.error)throw q.error}await refresh();alert('Usuarios actualizados.')}catch(e){console.error(e);alert(e.message||'No se pudieron actualizar los usuarios.')}};
  app.querySelectorAll('[data-delete-user]').forEach(btn=>btn.onclick=async()=>{const name=btn.dataset.deleteName;if(!confirm(`¿Eliminar definitivamente la cuenta de ${name}? Esta acción no se puede deshacer.`))return;btn.disabled=true;try{const q=await db.rpc('admin_eliminar_usuario',{objetivo_id:btn.dataset.deleteUser});if(q.error)throw q.error;await refresh();alert('Cuenta eliminada.')}catch(e){console.error(e);btn.disabled=false;alert(e.message||'No se pudo eliminar la cuenta. Verificá que hayas ejecutado el SQL de V3.2.1.')}});
  loadBackups();
}
async function saveConfig(){const emp=[...new Set($('emps').value.split('\n').map(x=>x.trim()).filter(Boolean))];for(const n of emp)await db.from('empleados').upsert({nombre:n,activo:true},{onConflict:'nombre'});for(const e of state.empleados.filter(e=>!emp.includes(e.nombre)))await db.from('empleados').update({activo:false}).eq('id',e.id);await refresh();alert('Configuración guardada.')}

$('cancel-harvest').onclick=()=>closeDialog('harvest-dialog');
$('add-harvest-line').onclick=()=>{$('harvest-lines').insertAdjacentHTML('beforeend',harvestLineTemplate());bindHarvestLines()};
$('harvest-total').oninput=updateHarvestLineTotal;
$('save-harvest').onclick=async()=>{try{await saveHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo guardar la cosecha.')}};
$('delete-harvest').onclick=async()=>{try{await deleteHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo eliminar la cosecha.')}};

document.querySelectorAll('.top-nav button').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.room=null;state.roomDay=null;state.day=null;if(state.view!=='stock'){state.stockRoom=null;state.stockCycle=null}render()});$('sign-out').onclick=()=>db.auth.signOut();$('sign-in').onclick=async()=>{
  const message=$('auth-message');
  message.textContent='Ingresando…';
  try{
    const q=await db.auth.signInWithPassword({
      email:$('auth-email').value.trim(),
      password:$('auth-password').value
    });
    if(q.error) throw q.error;
    message.textContent='Ingreso correcto. Cargando datos…';
    if(q.data.session) scheduleStart(q.data.session);
  }catch(error){
    console.error(error);
    message.textContent=error.message||'No se pudo iniciar sesión.';
  }
};
$('forgot-password').onclick=async()=>{
  const message=$('auth-message');
  const button=$('forgot-password');
  const email=$('auth-email').value.trim();
  if(!email){
    message.textContent='Ingresá tu correo para recibir el enlace de recuperación.';
    $('auth-email').focus();
    return;
  }
  button.disabled=true;
  message.textContent='Enviando enlace de recuperación…';
  try{
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const q=await db.auth.resetPasswordForEmail(email,{redirectTo});
    if(q.error) throw q.error;
    message.textContent='Te enviamos un enlace para recuperar la contraseña. Revisá también la carpeta de spam.';
  }catch(error){
    console.error(error);
    message.textContent=error.message||'No se pudo enviar el enlace de recuperación.';
  }finally{
    button.disabled=false;
  }
};
$('save-reset-password').onclick=async()=>{
  const message=$('reset-password-message');
  const password=$('reset-password').value;
  const confirmation=$('reset-password-confirm').value;
  if(password.length<6){message.textContent='La contraseña debe tener al menos 6 caracteres.';return}
  if(password!==confirmation){message.textContent='Las contraseñas no coinciden.';return}
  message.textContent='Guardando contraseña…';
  try{
    const q=await db.auth.updateUser({password});
    if(q.error) throw q.error;
    message.textContent='Contraseña actualizada correctamente.';
    setTimeout(()=>{
      closeDialog('reset-password-dialog');
      $('reset-password').value='';
      $('reset-password-confirm').value='';
      if(state.session) scheduleStart(state.session);
    },500);
  }catch(error){
    console.error(error);
    message.textContent=error.message||'No se pudo actualizar la contraseña.';
  }
};
$('sign-up').onclick=async()=>{
  const message=$('auth-message');
  message.textContent='Creando cuenta…';
  try{
    const q=await db.auth.signUp({
      email:$('auth-email').value.trim(),
      password:$('auth-password').value,
      options:{
        data:{nombre:$('auth-name').value.trim()},
        emailRedirectTo:'https://demianstagnaro.github.io/Rainbows-Cultivo-appx/'
      }
    });
    if(q.error) throw q.error;
    message.textContent=q.data.session
      ? 'Cuenta creada. Cargando datos…'
      : 'Cuenta creada. Revisá el correo de confirmación.';
    if(q.data.session) scheduleStart(q.data.session);
  }catch(error){
    console.error(error);
    message.textContent=error.message||'No se pudo crear la cuenta.';
  }
};
let startingSessionId=null;

function scheduleStart(session){
  if(!session?.user?.id) return;
  if(startingSessionId===session.user.id) return;
  startingSessionId=session.user.id;
  setTimeout(()=>start(session),0);
}

async function start(session){
  state.session=session;
  $('auth-screen').hidden=true;$('auth-screen').style.display='none';
  $('app-shell').hidden=false;
  $('app').innerHTML='<section class="panel">Cargando información compartida…</section>';

  try{
    await load();
    if(state.profile&&!state.profile.activo){await db.auth.signOut();throw new Error('Tu usuario está desactivado.');}
    subscribe();
    render();
  }catch(error){
    console.error(error);
    $('app').innerHTML=`<section class="panel error-panel">
      <strong>No se pudieron cargar los datos</strong>
      <p>${error.message||'Error desconocido'}</p>
      <button type="button" id="retry-load" class="primary">Reintentar</button>
    </section>`;
    const retry=$('retry-load');
    if(retry) retry.onclick=()=>{startingSessionId=null;scheduleStart(session)};
  }finally{
    startingSessionId=null;
  }
}

db.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session){
    state.session=session;
    $('auth-screen').hidden=true;$('auth-screen').style.display='none';
    $('app-shell').hidden=true;
    $('reset-password-message').textContent='';
    $('reset-password').value='';
    $('reset-password-confirm').value='';
    $('reset-password-dialog').showModal();
    return;
  }
  if(session){
    scheduleStart(session);
  }else{
    state.session=null;
    startingSessionId=null;
    $('auth-screen').hidden=false;$('auth-screen').style.display='grid';
    $('app-shell').hidden=true;
  }
});

try{
  const {data,error}=await db.auth.getSession();
  if(error) throw error;
  if(data.session) scheduleStart(data.session);
}catch(error){
  console.error(error);
  $('auth-message').textContent=error.message||'No se pudo recuperar la sesión.';
}


// V3.13.1 — Voz: consultas con respuesta persistente separada del estado de escucha.
const VoiceRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let voiceRecognition=null;
let voiceListening=false;
let voiceContinuousMode=false;
let voiceRestartTimer=null;
let voiceFatalError=false;

function normalizeVoiceText(value=''){
  let clean=value.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  // El reconocimiento puede devolver números hablados o romanos. Normalizamos las variantes
  // más habituales antes de interpretar comandos/consultas para que, por ejemplo,
  // “Flora tres”, “Flora III” y “Flora 3” sean equivalentes.
  const words={
    uno:'1',una:'1',dos:'2',tres:'3',cuatro:'4',cinco:'5',seis:'6',siete:'7',ocho:'8',nueve:'9',diez:'10',
    once:'11',doce:'12',trece:'13',catorce:'14',quince:'15',dieciseis:'16',diecisiete:'17',dieciocho:'18',diecinueve:'19',
    veinte:'20',veintiuno:'21',veintidos:'22',veintitres:'23',veinticuatro:'24',veinticinco:'25',veintiseis:'26',veintisiete:'27',veintiocho:'28',veintinueve:'29',treinta:'30',treintaiuno:'31'
  };
  clean=clean.replace(/\b(flora)\s+(iii|ii|i)\b/g,(_,name,roman)=>`${name} ${{i:'1',ii:'2',iii:'3'}[roman]}`);
  clean=clean.replace(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|treintaiuno)\b/g,m=>words[m]||m);
  return clean;
}
function showVoicePanel(status='Micrófono apagado',message=''){
  const panel=$('voice-panel');
  if(!panel)return;
  panel.hidden=false;
  $('voice-status').textContent=status;
  if(message)$('voice-transcript').textContent=message;
}
function showVoiceResponse(message=''){
  const box=$('voice-response'), text=$('voice-response-text');
  if(!box||!text)return;
  text.textContent=message;
  box.hidden=!message;
}
function closeVoiceResponse(){const box=$('voice-response');if(box)box.hidden=true;}
function setVoiceButtonActive(active){
  const button=$('voice-button');
  if(!button)return;
  button.classList.toggle('listening',active);
  button.setAttribute('aria-pressed',active?'true':'false');
  button.title=active?'Micrófono activo · tocar para apagar':'Comandos de voz';
}
function stopVoiceRecognition({hidePanel=false,message='Micrófono cerrado.'}={}){
  voiceContinuousMode=false;
  voiceFatalError=false;
  if(voiceRestartTimer){clearTimeout(voiceRestartTimer);voiceRestartTimer=null;}
  if(voiceRecognition){try{voiceRecognition.onend=null;voiceRecognition.stop()}catch(_){} voiceRecognition=null;}
  voiceListening=false;
  setVoiceButtonActive(false);
  const panel=$('voice-panel');
  if(panel){
    if(hidePanel)panel.hidden=true;
    else showVoicePanel('Micrófono apagado',message);
  }
}
function closeVoicePanel(){stopVoiceRecognition({hidePanel:true});}
function setVoiceView(view){
  if(!canViewOperations())return false;
  state.view=view;state.room=null;state.roomDay=null;state.day=null;
  if(view!=='stock'){state.stockRoom=null;state.stockCycle=null}
  render();
  return true;
}
function voiceCurrentDate(){
  if(state.view==='calendar'&&state.day)return state.day;
  if(state.view==='rooms'&&state.room)return state.roomDay||today();
  if(state.view==='today')return state.todayDay||today();
  return today();
}
function voiceDateFromText(text){
  const clean=normalizeVoiceText(text);
  const base=today();
  if(clean.includes('pasado manana'))return add(base,2);
  if(clean.includes('anteayer'))return add(base,-2);
  if(clean.includes('manana'))return add(base,1);
  if(clean.includes('ayer'))return add(base,-1);
  if(clean.includes('hoy'))return base;

  const months={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
  let m=clean.match(/(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/);
  if(m){
    const day=Number(m[1]),month=months[m[2]],year=m[3]?Number(m[3]):base.getFullYear();
    const d=new Date(year,month,day);d.setHours(0,0,0,0);
    if(d.getDate()===day&&d.getMonth()===month)return d;
  }
  m=clean.match(/(?:el\s+)?(\d{1,2})\s+(?:del\s+)?(\d{1,2})(?:\s+(?:del\s+)?(\d{2,4}))?/);
  if(m){
    const day=Number(m[1]),month=Number(m[2])-1;let year=m[3]?Number(m[3]):base.getFullYear();
    if(year<100)year+=2000;
    const d=new Date(year,month,day);d.setHours(0,0,0,0);
    if(d.getDate()===day&&d.getMonth()===month)return d;
  }

  const weekdays={domingo:0,lunes:1,martes:2,miercoles:3,jueves:4,viernes:5,sabado:6};
  const weekdayName=Object.keys(weekdays).find(name=>new RegExp(`(^|\s)${name}(\s|$)`).test(clean));
  if(weekdayName){
    const target=weekdays[weekdayName];
    const explicitPast=/(pasado|anterior|ultimo|ultima|habia|hubo|hicieron|hizo|realizadas?)/.test(clean);
    const explicitNext=/(proximo|proxima|que viene|siguiente)/.test(clean);
    let delta=(target-base.getDay()+7)%7;
    if(explicitPast){delta=-((base.getDay()-target+7)%7||7)}
    else if(explicitNext){delta=delta||7}
    else if(delta===0){delta=0}
    return add(base,delta);
  }
  return voiceCurrentDate();
}
function voiceRoomFromText(text,{allowContext=false}={}){
  const match=text.match(/flora\s*(1|2|3)|veges|madres|esquejes|sala de trabajo/);
  if(!match){
    // Las consultas son globales. La sala abierta solo se usa como contexto opcional
    // cuando el usuario omite el nombre de la sala.
    if(allowContext&&state.view==='rooms'&&state.room)return state.room;
    return null;
  }
  const token=match[0];
  if(token.startsWith('flora'))return `Flora ${match[1]}`;
  if(token==='sala de trabajo')return 'Sala de trabajo';
  return token.charAt(0).toUpperCase()+token.slice(1);
}
function voiceEmployeeFromText(text){
  const normalized=normalizeVoiceText(text);
  return state.empleados.find(e=>{
    const name=normalizeVoiceText(e.nombre||'');
    return name&&new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(\\s|$)`).test(normalized);
  })||null;
}
function voiceTaskLabel(t){
  return `${t.task}${t.room?` en ${t.room}`:''}`;
}
function voiceList(items,limit=8){
  if(!items.length)return '';
  const shown=items.slice(0,limit);
  const text=shown.join(', ');
  return items.length>limit?`${text}, y ${items.length-limit} más`:text;
}
function voiceBedNumberFromText(text){
  const m=normalizeVoiceText(text).match(/cama\s*(?:numero\s*)?(\d{1,2})/);
  return m?Number(m[1]):null;
}
function voiceGeneticSummaryForBed(roomName,bedNumber){
  const room=sr(roomName);
  if(!room)return {message:`No encontré ${roomName} en la base de salas.`};
  const bed=state.camas.find(c=>String(c.sala_id)===String(room.id)&&Number(c.numero)===Number(bedNumber));
  if(!bed)return {message:`No encontré la cama ${bedNumber} de ${roomName}.`};
  const occupied=plants(bed).filter(p=>p.ocupada);
  if(!occupied.length)return {message:`La cama ${bedNumber} de ${roomName} está vacía.`};
  const counts=new Map();
  let noGenetic=0;
  for(const plant of occupied){
    const genetic=state.geneticas.find(g=>String(g.id)===String(plant.genetica_id));
    if(!genetic){noGenetic++;continue;}
    const label=genetic.nomenclatura?`${genetic.nomenclatura} (${genetic.nombre})`:genetic.nombre;
    counts.set(label,(counts.get(label)||0)+1);
  }
  const parts=[...counts.entries()].map(([name,count])=>`${name}: ${count} planta${count===1?'':'s'}`);
  if(noGenetic)parts.push(`sin genética asignada: ${noGenetic}`);
  return {message:`En la cama ${bedNumber} de ${roomName} hay ${occupied.length} planta${occupied.length===1?'':'s'}: ${parts.join(', ')}.`};
}
function voiceNextHarvestDate(r,baseDate){
  let c=cycle(r,baseDate);
  let harvestDate=add(c.fl,56);
  if(diff(baseDate,harvestDate)>0)harvestDate=add(harvestDate,77);
  return harvestDate;
}
function executeVoiceRoomQuery(rawText){
  const text=normalizeVoiceText(rawText);
  const room=voiceRoomFromText(text,{allowContext:true});
  if(!room)return null;
  const r=rr(room);
  if(!r)return null;
  const bedNumber=voiceBedNumberFromText(text);

  if(bedNumber!==null&&(text.includes('genetica')||text.includes('que hay')||text.includes('plantas hay')||text.includes('tiene la cama'))){
    if(r.type!=='flora')return {ok:true,message:`${room} no usa el croquis de camas de las salas de flora.`};
    return {ok:true,...voiceGeneticSummaryForBed(room,bedNumber)};
  }

  if((text.includes('cuantas plantas')||text.includes('cantidad de plantas'))&&r.type==='flora'){
    const bs=beds(room),all=bs.flatMap(plants),occupied=all.filter(p=>p.ocupada);
    return {ok:true,message:`Actualmente ${room} tiene ${occupied.length} planta${occupied.length===1?'':'s'} ocupando ${bs.filter(b=>plants(b).some(p=>p.ocupada)).length} de ${bs.length} camas.`};
  }
  if((text.includes('cuantas camas')||text.includes('cantidad de camas'))&&r.type==='flora'){
    const bs=beds(room),used=bs.filter(b=>plants(b).some(p=>p.ocupada)).length;
    return {ok:true,message:`${room} tiene ${bs.length} camas en total y actualmente ${used} tienen plantas.`};
  }

  const d=voiceDateFromText(text);
  if(text.includes('cuando')&&(text.includes('cosecha')||text.includes('cosechar'))&&r.type==='flora'){
    const h=voiceNextHarvestDate(r,today());
    return {ok:true,message:`La próxima cosecha programada de ${room} es el ${nice(h)}, correspondiente al ciclo ${cycleNumber(r,h)}.`};
  }
  if(text.includes('cuando')&&(text.includes('empieza flora')||text.includes('inicio flora')||text.includes('pasa a flora'))&&r.type==='flora'){
    let fl=cycle(r,today()).fl;if(diff(today(),fl)>0)fl=add(fl,77);
    return {ok:true,message:`El próximo inicio de floración de ${room} es el ${nice(fl)}, ciclo ${cycleNumber(r,fl)}.`};
  }
  if(text.includes('cuando')&&(text.includes('trasplante')||text.includes('entra a la sala'))&&r.type==='flora'){
    let tr=cycle(r,today()).tr;if(diff(today(),tr)>0)tr=add(tr,77);
    return {ok:true,message:`El próximo trasplante a ${room} es el ${nice(tr)}, ciclo ${cycleNumber(r,tr)}.`};
  }
  if(text.includes('semana')||text.includes('ciclo')||text.includes('estado')||text.includes('en que esta')||text.includes('como esta')){
    if(r.type==='flora')return {ok:true,message:`El ${nice(d)}, ${room} está en ${roomStatus(r,d)}.`};
    return {ok:true,message:`El ${nice(d)}, ${room} está en estado: ${roomStatus(r,d)}.`};
  }
  return null;
}
function executeVoiceTaskQuery(rawText){
  const text=normalizeVoiceText(rawText);
  const queryWords=['que tarea','que tareas','tareas hay','tareas tengo','tareas estan','pendiente','pendientes','que hizo','que hizo hoy','que hizo ayer','quien hizo','quienes hicieron','que tiene','que hay'];
  const looksLikeQuery=queryWords.some(x=>text.includes(x))||text.startsWith('cuantas tareas')||text.startsWith('cuantos pendientes');
  if(!looksLikeQuery)return null;
  const d=voiceDateFromText(text);
  const room=voiceRoomFromText(text);
  const employee=voiceEmployeeFromText(text);
  let ts=tasks(d);
  if(room)ts=ts.filter(t=>t.room===room);
  const wantsPending=text.includes('pendiente')||text.includes('faltan')||text.includes('falta hacer');
  const wantsWho=text.includes('quien hizo')||text.includes('quienes hicieron')||text.includes('quien realizo')||text.includes('quienes realizaron');
  const wantsDone=text.includes('realizada')||text.includes('realizadas')||text.includes('completada')||text.includes('completadas')||text.includes('que hizo');
  if(employee){
    const byEmployee=ts.filter(t=>done(t)&&names(t).some(n=>normalizeVoiceText(n)===normalizeVoiceText(employee.nombre)));
    if(!byEmployee.length)return {ok:true,message:`${employee.nombre} no figura como responsable de tareas realizadas el ${nice(d)}${room?` en ${room}`:''}.`};
    return {ok:true,message:`${employee.nombre} realizó ${byEmployee.length} tarea${byEmployee.length===1?'':'s'} el ${nice(d)}${room?` en ${room}`:''}: ${voiceList(byEmployee.map(voiceTaskLabel))}.`};
  }
  if(wantsWho){
    const completed=ts.filter(done);
    if(!completed.length)return {ok:true,message:`No hay tareas realizadas registradas el ${nice(d)}${room?` en ${room}`:''}.`};
    const detail=completed.map(t=>{
      const responsible=names(t);
      return `${voiceTaskLabel(t)}: ${responsible.length?voiceList(responsible,6):'sin responsable registrado'}`;
    });
    return {ok:true,message:`Responsables de las tareas realizadas el ${nice(d)}${room?` en ${room}`:''}: ${voiceList(detail,10)}.`};
  }
  if(wantsPending){
    const pending=ts.filter(t=>!done(t));
    if(!pending.length)return {ok:true,message:`No hay tareas pendientes el ${nice(d)}${room?` en ${room}`:''}.`};
    return {ok:true,message:`Hay ${pending.length} tarea${pending.length===1?'':'s'} pendiente${pending.length===1?'':'s'} el ${nice(d)}${room?` en ${room}`:''}: ${voiceList(pending.map(voiceTaskLabel))}.`};
  }
  if(wantsDone){
    const completed=ts.filter(done);
    if(!completed.length)return {ok:true,message:`No hay tareas realizadas registradas el ${nice(d)}${room?` en ${room}`:''}.`};
    return {ok:true,message:`Hay ${completed.length} tarea${completed.length===1?'':'s'} realizada${completed.length===1?'':'s'} el ${nice(d)}${room?` en ${room}`:''}: ${voiceList(completed.map(voiceTaskLabel))}.`};
  }
  if(!ts.length)return {ok:true,message:`No hay tareas programadas el ${nice(d)}${room?` en ${room}`:''}.`};
  const completed=ts.filter(done).length;
  const pending=ts.length-completed;
  return {ok:true,message:`El ${nice(d)}${room?` en ${room}`:''} hay ${ts.length} tarea${ts.length===1?'':'s'}: ${completed} realizada${completed===1?'':'s'} y ${pending} pendiente${pending===1?'':'s'}. ${voiceList(ts.map(voiceTaskLabel))}.`};
}
function voiceHelpExamples(){
  // Las consultas de este bloque funcionan desde cualquier ventana.
  return {
    queries:[
      '¿Qué tareas hay hoy?',
      '¿Qué tareas están pendientes mañana en Flora 2?',
      '¿Qué hizo Cone ayer?',
      '¿En qué semana está Flora 1?',
      '¿Cuándo se cosecha Flora 2?',
      '¿Qué genética hay en la cama 4 de Flora 3?',
      '¿Cuántas plantas hay en Flora 1?'
    ],
    navigation:['Abrir Calendario','Ir a Flora 2','Ir a mañana','Volver a hoy']
  };
}
function renderVoiceHelp(){
  const help=$('voice-help');
  if(!help||help.hidden)return;
  const examples=voiceHelpExamples();
  help.innerHTML=`<strong>Consultas · desde cualquier sección</strong><ul>${examples.queries.map(x=>`<li>${x}</li>`).join('')}</ul><strong>Navegación</strong><ul>${examples.navigation.map(x=>`<li>${x}</li>`).join('')}</ul>`;
}
function toggleVoiceHelp(){
  const help=$('voice-help');
  if(!help)return;
  const opening=help.hidden;
  help.hidden=!opening;
  if(opening)renderVoiceHelp();
}
function executeGlobalVoiceQuery(rawText){
  // Toda consulta es global: no depende de la ventana activa.
  // Los futuros comandos que MODIFIQUEN datos se resolverán aparte y sí deberán
  // validar la sección activa antes de ofrecer una confirmación.
  const handlers=[executeVoiceRoomQuery,executeVoiceTaskQuery];
  for(const handler of handlers){
    const result=handler(rawText);
    if(result)return result;
  }
  return null;
}
function executeVoiceCommand(rawText){
  const globalQuery=executeGlobalVoiceQuery(rawText);
  if(globalQuery)return globalQuery;
  return executeVoiceNavigation(rawText);
}
function executeVoiceNavigation(rawText){
  const text=normalizeVoiceText(rawText);
  if(text.includes('volver a hoy')){
    state.todayDay=today();state.day=null;state.roomDay=state.room?today():null;setVoiceView('today');
    return {ok:true,message:'Listo. Volví a hoy.'};
  }
  if(text.includes('manana')||text.includes('dia siguiente')){
    if(state.view==='calendar'&&state.day){state.day=add(state.day,1);render();}
    else if(state.view==='rooms'&&state.room){state.roomDay=add(state.roomDay||today(),1);render();}
    else {state.todayDay=add(state.todayDay||today(),1);setVoiceView('today');}
    return {ok:true,message:'Listo. Mostré el día siguiente.'};
  }
  if(text.includes('ayer')||text.includes('dia anterior')){
    if(state.view==='calendar'&&state.day){state.day=add(state.day,-1);render();}
    else if(state.view==='rooms'&&state.room){state.roomDay=add(state.roomDay||today(),-1);render();}
    else {state.todayDay=add(state.todayDay||today(),-1);setVoiceView('today');}
    return {ok:true,message:'Listo. Mostré el día anterior.'};
  }
  const roomMatch=text.match(/flora\s*(1|2|3)|veges|madres|esquejes/);
  if(roomMatch&&(text.includes('abrir')||text.includes('ir a')||text.includes('mostrar'))){
    const token=roomMatch[0];
    const roomName=token.startsWith('flora')?`Flora ${roomMatch[1]}`:token.charAt(0).toUpperCase()+token.slice(1);
    if(!rules.some(r=>r.name===roomName))return {ok:false,message:`No encontré la sala ${roomName}.`};
    state.view='rooms';state.room=roomName;state.roomDay=today();state.day=null;state.tab='summary';render();
    return {ok:true,message:`Listo. Abrí ${roomName}.`};
  }
  const destinations=[
    {view:'today',name:'Hoy',labels:['hoy','inicio']},
    {view:'calendar',name:'Calendario',labels:['calendario']},
    {view:'rooms',name:'Salas',labels:['salas','sala']},
    {view:'genetics',name:'Genéticas',labels:['geneticas','genetica']},
    {view:'harvests',name:'Cosechas',labels:['cosechas','cosecha']},
    {view:'stock',name:'Stock Palestina',labels:['stock palestina','stock']},
    {view:'settings',name:'Configuración',labels:['configuracion','config']}
  ];
  const destination=destinations.find(item=>item.labels.some(label=>text.includes(label)));
  if(destination&&(text.includes('abrir')||text.includes('ir a')||text.includes('mostrar')||destination.labels.some(label=>text===label))){
    if(destination.view==='settings'&&currentRole()!=='administrador')return {ok:false,message:'La configuración solo está disponible para administradores.'};
    setVoiceView(destination.view);
    return {ok:true,message:`Listo. Abrí ${destination.name}.`};
  }
  return {ok:false,message:`Entendí: “${rawText}”, pero todavía no reconozco ese comando. Probá “Abrir Calendario”, “Ir a Flora 2”, “Ir a mañana” o “Volver a hoy”.`};
}
function isVoiceStopCommand(text=''){
  const clean=normalizeVoiceText(text);
  return ['cerrar microfono','cerrar el microfono','apagar microfono','apagar el microfono','dejar de escuchar','para de escuchar','parar de escuchar','detener microfono','detener el microfono'].some(command=>clean.includes(command));
}
function scheduleVoiceRestart(){
  if(!voiceContinuousMode||voiceFatalError||voiceRestartTimer)return;
  voiceRestartTimer=setTimeout(()=>{
    voiceRestartTimer=null;
    if(voiceContinuousMode&&!voiceListening)beginVoiceRecognition({continuous:true});
  },300);
}
function beginVoiceRecognition(options={}){
  if(!VoiceRecognition){showVoicePanel('Voz no disponible','Este navegador no ofrece reconocimiento de voz. La app sigue funcionando normalmente de forma manual.');return;}
  if(voiceListening)return;
  if(!state.session){showVoicePanel('Iniciá sesión','Los comandos de voz están disponibles después de ingresar.');return;}
  const continuous=Boolean(options.continuous);
  voiceFatalError=false;
  voiceRecognition=new VoiceRecognition();
  voiceRecognition.lang='es-AR';voiceRecognition.interimResults=true;voiceRecognition.continuous=false;voiceRecognition.maxAlternatives=1;
  voiceRecognition.onstart=()=>{
    voiceListening=true;
    if(continuous){voiceContinuousMode=true;setVoiceButtonActive(true);showVoicePanel('Escuchando…','Podés hablar cuando quieras.');}
  };
  voiceRecognition.onresult=event=>{
    let transcript='';let finalText='';
    for(let i=event.resultIndex;i<event.results.length;i++){transcript+=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=event.results[i][0].transcript;}
    $('voice-transcript').textContent=transcript?`Escuché: “${transcript}”`:'Escuchando…';
    if(finalText){
      const clean=finalText.trim();
      if(isVoiceStopCommand(clean)){
        $('voice-status').textContent='Micrófono apagado';$('voice-transcript').textContent='Listo. Dejé de escuchar.';
        stopVoiceRecognition({hidePanel:false,message:'Listo. Dejé de escuchar.'});
        return;
      }
      const result=executeVoiceCommand(clean);$('voice-status').textContent=voiceContinuousMode?'Escuchando…':'Micrófono apagado'; $('voice-transcript').textContent=voiceContinuousMode?'Podés decir otro comando.':''; showVoiceResponse(result.message);
    }
  };
  voiceRecognition.onerror=event=>{
    const messages={'not-allowed':'No se concedió permiso para usar el micrófono.','service-not-allowed':'El navegador bloqueó el servicio de reconocimiento de voz.','no-speech':'No escuché ninguna instrucción. Sigo escuchando…','audio-capture':'No se encontró un micrófono disponible.','network':'El reconocimiento de voz no pudo conectarse.'};
    if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)){
      voiceFatalError=true;voiceContinuousMode=false;setVoiceButtonActive(false);
    }
    showVoicePanel(event.error==='no-speech'&&voiceContinuousMode?'Escuchando…':'No se pudo escuchar',messages[event.error]||`Error de reconocimiento: ${event.error}.`);
  };
  voiceRecognition.onend=()=>{
    voiceListening=false;voiceRecognition=null;
      if(voiceContinuousMode&&!voiceFatalError){setVoiceButtonActive(true);scheduleVoiceRestart();}
    else{setVoiceButtonActive(false);}
  };
  try{voiceRecognition.start()}catch(error){console.error(error);voiceListening=false;if(continuous)scheduleVoiceRestart();else showVoicePanel('No se pudo iniciar','Cerrá cualquier otra escucha activa y probá nuevamente.');}
}
function startVoiceRecognition(){
  if(voiceContinuousMode||voiceListening){stopVoiceRecognition({hidePanel:false,message:'Micrófono cerrado. Tocá el botón cuando quieras volver a activarlo.'});return;}
  voiceContinuousMode=true;
  beginVoiceRecognition({continuous:true});
}

$('voice-button')?.setAttribute('aria-pressed','false');
$('voice-button')?.addEventListener('click',()=>startVoiceRecognition());
$('voice-retry')?.addEventListener('click',()=>{if(voiceContinuousMode)stopVoiceRecognition({hidePanel:false});startVoiceRecognition();});
$('voice-close')?.addEventListener('click',closeVoicePanel);
$('voice-cancel')?.addEventListener('click',closeVoicePanel);
$('voice-help-button')?.addEventListener('click',toggleVoiceHelp);
$('voice-response-close')?.addEventListener('click',closeVoiceResponse);
if(!VoiceRecognition){const button=$('voice-button');if(button){button.classList.add('unsupported');button.title='Reconocimiento de voz no disponible en este navegador';}}

if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=3.13.7').catch(console.error));
}
