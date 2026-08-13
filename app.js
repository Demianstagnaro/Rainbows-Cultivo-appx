import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/+esm';

const APP_VERSION='3.16.13';
const db=createClient('https://fplbxirsbwruazvygciu.supabase.co','sb_publishable_y7EwYjE0W5SEIlumNdQpzw_PBlnkWOt');
const rules=[
{name:'Flora 1',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:true},
{name:'Flora 2',type:'flora',transplant:'2026-06-10',floraStart:'2026-07-01',automaticIrrigation:false},
{name:'Flora 3',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:false},
{name:'Veges',type:'vege'},{name:'Madres',type:'madres'},{name:'Esquejes',type:'esquejes'},{name:'Sala de trabajo',type:'trabajo'}];
const $=id=>document.getElementById(id),app=$('app');
const state={view:'today',month:new Date(new Date().getFullYear(),new Date().getMonth(),1),day:null,room:null,roomDay:null,tab:'summary',session:null,profile:null,perfiles:[],salas:[],camas:[],plantas:[],geneticas:[],empleados:[],tareas:[],realizaciones:[],joins:[],generalTasks:[],generalJoins:[],pending:null,pendingKind:'dated',selected:new Set(),editTask:null,editGeneralTask:null,menuTask:null,menuRoom:null,editBed:null,editPlant:null,editGenetic:null,cosechas:[],cosechaDetalles:[],editHarvest:null,selectedHarvest:null,harvestYear:'todos',harvestRoom:'todas',stockCycles:[],stockItems:[],stockMovements:[],stockRoom:null,stockCycle:null,stockOverviewExpanded:false,todayDay:null,channel:null,backups:[],backupRuns:[],backupLoading:false,pendingVoiceRoomChange:null};
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
function isContinuable(t){const taskName=String(t?.task||'');return CONTINUABLE_TASKS.has(taskName)||taskName.startsWith('Trimming - ')}
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
  const summary=$('worker-task-summary');
  if(summary){
    const isGeneral=kind==='general';
    const taskLabel=isGeneral?(t?.nombre||'Tarea general'):(t?.task||t?.nombre||'Tarea');
    const taskDate=!isGeneral&&t?.date?parse(t.date):(!isGeneral?(state.todayDay||today()):null);
    summary.textContent=`${taskLabel}${t?.room?` · ${t.room}`:''}${taskDate?` · ${nice(taskDate)}`:''}`;
  }
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

  const isContinuation=kind!=='general'&&isContinuable(t);
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


function openVoiceRoomChange(change){
  state.pendingVoiceRoomChange=change;
  const summary=$('voice-room-change-summary');
  if(summary)summary.textContent=change.summary||'Revisá el cambio antes de aplicarlo.';
  showDialog('voice-room-change-dialog');
}

async function applyVoiceRoomChange(){
  const change=state.pendingVoiceRoomChange;
  if(!change)return;
  const button=$('confirm-voice-room-change');
  if(button)button.disabled=true;
  try{
    if(change.type==='bed-genetic'){
      const ids=(change.plantIds||[]).map(String);
      if(!ids.length)throw new Error('La cama no tiene plantas ocupadas para modificar.');
      const q=await db.from('plantas').update({genetica_id:change.geneticId}).in('id',ids);
      if(q.error)throw q.error;
    }else if(change.type==='empty-bed'){
      const ids=(change.plantIds||[]).map(String);
      if(!ids.length)throw new Error('No encontré posiciones habilitadas en esa cama.');
      const q=await db.from('plantas').update({ocupada:false,genetica_id:null}).in('id',ids);
      if(q.error)throw q.error;
    }else{
      throw new Error('Cambio de croquis no reconocido.');
    }
    closeDialog('voice-room-change-dialog');
    state.pendingVoiceRoomChange=null;
    await refresh();
  }finally{
    if(button)button.disabled=false;
  }
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


$('cancel-voice-room-change').onclick=()=>{
  state.pendingVoiceRoomChange=null;
  closeDialog('voice-room-change-dialog');
};
$('confirm-voice-room-change').onclick=async()=>{
  try{await applyVoiceRoomChange()}catch(error){console.error(error);alert(error.message||'No se pudo aplicar el cambio de croquis.')}
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


function render(){const cb=$('header-config');if(cb){const ok=currentRole()==='administrador';cb.hidden=!ok;cb.style.display=ok?'inline-flex':'none';cb.onclick=()=>{state.view='settings';state.room=null;state.roomDay=null;state.day=null;render()}}const hb=$('header-help');if(hb){hb.onclick=()=>{state.view='help';state.room=null;state.roomDay=null;state.day=null;render()}} $('today-label').textContent=nice(today());
$('cancel-stock-movement').onclick=()=>closeDialog('stock-movement-dialog');
$('stock-movement-cycle').onchange=updateStockMovementItems;
$('stock-movement-type').onchange=updateStockMovementItems;
$('stock-select-all').onclick=()=>selectAllStockMovementItems();
$('stock-clear-all').onclick=()=>clearStockMovementItems();
$('stock-use-all').onclick=()=>useAllAvailableStock();
$('save-stock-movement').onclick=async()=>{const b=$('save-stock-movement');b.disabled=true;try{await saveStockMovement()}catch(e){console.error(e);alert(e.message||'No se pudieron registrar los movimientos.')}finally{b.disabled=false}};
$('cancel-harvest').onclick=()=>closeDialog('harvest-dialog');
$('add-harvest-line').onclick=()=>{$('harvest-lines').insertAdjacentHTML('beforeend',harvestLineTemplate());bindHarvestLines()};
$('harvest-total').oninput=updateHarvestLineTotal;
$('save-harvest').onclick=async()=>{try{await saveHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo guardar la cosecha.')}};
$('delete-harvest').onclick=async()=>{try{await deleteHarvestDialog()}catch(e){console.error(e);alert(e.message||'No se pudo eliminar la cosecha.')}};

document.querySelectorAll('.top-nav button').forEach(b=>{const allowed=canViewOperations();b.hidden=!allowed;b.style.display=allowed?'':'none';b.classList.toggle('active',b.dataset.view===state.view)});if(!canViewOperations()){app.innerHTML='<section class="panel error-panel"><strong>Sin permisos</strong><p>Tu usuario no tiene acceso a la información operativa.</p></section>';return}if(state.view==='today')renderToday();if(state.view==='calendar')renderCalendar();if(state.view==='rooms')renderRooms();if(state.view==='genetics')renderGenetics();if(state.view==='harvests')renderHarvests();if(state.view==='stock')renderStock();if(state.view==='help')renderHelp();if(state.view==='history')renderHistory();if(state.view==='settings')renderSettings()}
function renderHelp(){
  $('screen-title').textContent='Ayuda';
  app.innerHTML=`
    <section class="panel help-hero help-hero-compact">
      <h2>Ayuda</h2>
      <p><strong>Para usar la voz:</strong> tocá 🎙️ una vez y hablá normalmente. El micrófono queda activo para varias órdenes seguidas. Para cerrarlo, tocá 🎙️ otra vez o decí <strong>“cerrar micrófono”</strong>.</p>
      <div class="help-rule"><strong>Regla:</strong> podés hacer consultas desde cualquier pantalla. Las modificaciones por voz solo funcionan en la sección correspondiente y siempre piden confirmación.</div>
    </section>

    <section class="help-quick-grid">
      <article class="panel help-card help-card-quick"><h3>Consultas</h3><ul>
        <li>“¿Qué tareas quedaron pendientes?”</li>
        <li>“¿Cuándo se cosecha Flora 2?”</li>
        <li>“¿Cuánto stock hay de GomuGomu?”</li>
        <li>“¿Cuánto produjo Flora 1 ciclo 8?”</li>
      </ul></article>
      <article class="panel help-card help-card-quick"><h3>Navegación</h3><ul>
        <li>“Abrir Calendario”</li>
        <li>“Ir a Stock”</li>
        <li>“Ir a Flora 3”</li>
        <li>“Volver a hoy”</li>
      </ul></article>
      <article class="panel help-card help-card-quick"><h3>Acciones disponibles</h3><ul>
        <li>Desde Hoy o Calendario: “Agregar fumigación mañana en Flora 2”.</li><li>También podés completar: “Completar fumigación de Flora 2”. Reprogramar: “Reprogramar fumigación de Flora 2 para mañana”. Cancelar: “Cancelar fumigación de Flora 2”.</li>
        <li>Podés agregar responsables: “La hicieron Cone y Pata”.</li>
        <li>En Cosechas: “Nueva cosecha de Flora 3 ciclo 10”; con el formulario abierto: “Gomu Gomu 850 gramos”.</li><li>En Stock: “Mover todo el stock de Flora 3 ciclo 9 a Medrano”; con la ventana abierta: “Gomu Gomu 850 gramos” o “Usar todo disponible”.</li><li>Nada se guarda hasta que confirmás.</li>
      </ul></article>
      <article class="panel help-card help-card-quick"><h3>Consejos</h3><ul>
        <li>Podés decir “Flora tres”, “Flora 3” o incluso si el teléfono escribe “Flora III”.</li>
        <li>Para genéticas, podés decir el nombre o la nomenclatura.</li>
        <li>Si hablás muy rápido y no entiende, repetí un poco más separado.</li>
      </ul></article>
    </section>

    <section class="panel help-voice-settings">
      <div class="help-section-head"><div><h3>Voz de Rainbows</h3><p>Elegí cómo querés escuchar las respuestas en este dispositivo.</p></div></div>
      <div class="help-voice-controls">
        <label class="help-field"><span>Voz</span><select id="help-voice-select"></select></label>
        <label class="help-field"><span>Velocidad <strong id="help-voice-rate-value">1×</strong></span><input id="help-voice-rate" type="range" min="0.75" max="1.35" step="0.05"></label>
        <label class="help-voice-check"><input id="help-voice-enabled" type="checkbox"> <span>Leer respuestas en voz alta</span></label>
        <label class="help-field"><span>Sensibilidad ambiente</span><select id="help-voice-sensitivity"><option value="high">Alta · como hasta ahora</option><option value="normal">Normal · filtra ruido ambiente</option><option value="low">Baja · más estricta</option></select></label>
        <button id="help-voice-test" class="secondary" type="button">Probar voz</button>
      </div>
      <p id="help-voice-note" class="muted small"></p>
    </section>

    <details class="panel help-all-commands">
      <summary>Ver todos los comandos</summary>
      <div class="help-grid help-grid-expanded">
        <article class="help-card"><h3>Generales · navegación</h3><ul>
          <li>“Abrir Hoy / Calendario / Salas / Genéticas / Cosechas / Stock Palestina / Ayuda”</li>
          <li>“Ir a Flora 1 / 2 / 3” · “Mostrar Veges / Madres / Esquejes”</li>
          <li>“Ir a mañana” · “Día anterior” · “Volver a hoy”</li>
        </ul></article>
        <article class="help-card"><h3>Tareas · consultas globales</h3><ul>
          <li>“¿Qué tareas hay hoy?”</li><li>“¿Qué tareas están pendientes mañana?”</li><li>“¿Qué tareas hay mañana en Flora 2?”</li><li>“¿Qué tareas se hicieron ayer?”</li><li>“¿Qué hizo Cone hoy?”</li><li>“¿Quién hizo las tareas del 10 de agosto?”</li>
        </ul></article>
        <article class="help-card"><h3>Tareas · crear, completar y reprogramar</h3><ul><li>Crear: “Agregar fumigación mañana en Flora 2”</li><li>Crear: “Crear tarea limpieza el viernes en Veges”</li><li>Reprogramar: “Reprogramar fumigación de Flora 2 para mañana”</li><li>Cancelar: “Cancelar fumigación de Flora 2”</li>
          <li>Disponible desde Hoy o desde un día abierto en Calendario.</li><li>“Completar fumigación de Flora 2”</li><li>“Marcar como hecha la poda de Flora 1”</li><li>“Completar riego de Flora 3, lo hicieron Cone y Pata”</li>
        </ul></article>
        <article class="help-card"><h3>Fechas</h3><ul>
          <li>Hoy, ayer, anteayer, mañana y pasado mañana.</li><li>“Lunes”, “martes pasado”, “próximo miércoles”.</li><li>“10 de agosto” o “5 de agosto de 2026”.</li>
        </ul></article>
        <article class="help-card"><h3>Salas · estado y ciclo</h3><ul>
          <li>“¿En qué semana está Flora 1?”</li><li>“¿En qué ciclo está Flora 2?”</li><li>“¿En qué semana estaba Flora 3 ayer?”</li><li>“¿Cuándo se cosecha Flora 2?”</li><li>“¿Cuándo empieza flora en Flora 1?”</li><li>“¿Cuándo es el próximo trasplante de Flora 3?”</li>
        </ul></article>
        <article class="help-card"><h3>Salas · croquis</h3><ul>
          <li>Consulta: “¿Qué genética hay en la cama 4 de Flora 1?”</li><li>Consulta: “¿Cuántas plantas hay en Flora 2?”</li><li>Modificar desde Salas: “En Flora 2 cama 4 poner Mandarin”.</li><li>Modificar una planta: “En Flora 2 cama 4 planta 3 poner Gomu Gomu”.</li><li>Vaciar: “Vaciar cama 8 de Flora 3” · “Vaciar planta 3 de cama 8”.</li><li>Capacidad: “Poner 5 plantas en cama 3 de Flora 1”.</li><li>Los cambios se preparan y siempre requieren Guardar o Confirmar.</li>
        </ul></article>
        <article class="help-card"><h3>Stock Palestina</h3><ul>
          <li>“¿Cuánto stock total hay?”</li><li>“¿Cuánto stock hay de GomuGomu?”</li><li>“¿Cuánto queda del ciclo 9 de Flora 2?”</li><li>“¿Qué salidas hubo a Medrano?”</li><li>“¿Cuánto consumo interno hubo?”</li><li>“¿Qué movimientos hubo hoy?”</li><li>Preparar movimiento: “Mover todo el stock de Flora 3 ciclo 9 a Medrano”.</li><li>Con la ventana abierta: “Gomu Gomu 850 gramos” · “Todo de Mandarin” · “Quitar Sugar Cane” · “Usar todo disponible” · “Seleccionar todas”.</li><li>Los movimientos nunca se guardan por voz: revisá y tocá Guardar movimientos.</li>
        </ul></article>
        <article class="help-card"><h3>Cosechas</h3><ul>
          <li>Consulta: “¿Cuánto produjo Flora 1 ciclo 8?”</li><li>Consulta: “¿Cuál fue la última cosecha de Flora 3?”</li><li>Cargar: “Nueva cosecha de Flora 3 ciclo 10”.</li><li>Con el formulario abierto, una pesada por frase: “Gomu Gomu 850 gramos” · “Mandarin 1 kilo 150”.</li><li>Podés repetir la misma genética: cada frase agrega otra pesada y el total se suma solo.</li><li>Correcciones: “Quitar última pesada/pasada” · “Corregir última pesada/pasada a 920 gramos”.</li><li>Opcional: “Meta 9 kilos” · “108 plantas”.</li><li>La cosecha nunca se guarda por voz: revisá y tocá Guardar.</li>
        </ul></article>
        <article class="help-card"><h3>Genéticas</h3><ul>
          <li>“¿Cuál es la nomenclatura de Mandarin Cookies?”</li><li>“¿Cuál es el linaje de GomuGomu?”</li><li>“¿Qué cannabinoides tiene GomuGomu?”</li><li>“¿Qué genéticas están activas?”</li><li>“¿Qué genéticas tienen CBD?”</li>
        </ul></article>
        <article class="help-card"><h3>Control del micrófono</h3><ul>
          <li>“Cerrar micrófono” · “Apagar micrófono” · “Dejar de escuchar”</li><li>También podés tocar nuevamente 🎙️.</li><li>Mientras Rainbows habla, podés tocar <strong>Detener voz</strong>.</li>
        </ul></article>
      </div>
    </details>`;
  setupHelpVoiceSettings();
}
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
  $('stock-movement-destination').value='Medrano';
  $('stock-movement-notes').value='';
  updateStockMovementItems();
  $('stock-movement-dialog').showModal();
}
function stockMovementSelectableItems(){
  const cycleId=$('stock-movement-cycle').value;
  return stockCycleItems(cycleId);
}
function updateStockMovementItems(){
  const type=$('stock-movement-type').value;
  const items=stockMovementSelectableItems();
  const container=$('stock-movement-items');
  container.innerHTML=items.length?items.map(item=>{
    const current=stockItemCurrent(item);
    const disabled=type==='salida'&&current<=0;
    return `<div class="stock-movement-item-row ${disabled?'disabled':''}" data-stock-movement-row data-item-id="${item.id}" data-current="${current}">
      <input class="stock-movement-check" type="checkbox" aria-label="Seleccionar ${escapeHtml(item.nombre_historico)}" ${disabled?'disabled':''}>
      <div class="stock-movement-item-name"><strong>${escapeHtml(item.nombre_historico)}</strong><span>${type==='salida'?`Disponible: ${formatGrams(current)}`:`Stock actual: ${formatGrams(current)}`}</span></div>
      <label class="stock-movement-grams-label">Cantidad (g)<input class="text-input stock-movement-item-grams" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0" disabled></label>
    </div>`;
  }).join(''):'<p class="muted">Este ciclo no tiene genéticas cargadas.</p>';
  container.querySelectorAll('[data-stock-movement-row]').forEach(row=>{
    const check=row.querySelector('.stock-movement-check');
    const grams=row.querySelector('.stock-movement-item-grams');
    check.onchange=()=>{
      grams.disabled=!check.checked;
      if(check.checked){setTimeout(()=>grams.focus(),0)}else grams.value='';
      updateStockMovementSummary();
    };
    grams.oninput=updateStockMovementSummary;
  });
  $('stock-use-all').hidden=type!=='salida';
  updateStockMovementSummary();
}
function selectAllStockMovementItems(){
  $('stock-movement-items').querySelectorAll('[data-stock-movement-row]').forEach(row=>{
    const check=row.querySelector('.stock-movement-check');
    const grams=row.querySelector('.stock-movement-item-grams');
    if(check.disabled)return;
    check.checked=true;
    grams.disabled=false;
  });
  updateStockMovementSummary();
}
function clearStockMovementItems(){
  $('stock-movement-items').querySelectorAll('[data-stock-movement-row]').forEach(row=>{
    const check=row.querySelector('.stock-movement-check');
    const grams=row.querySelector('.stock-movement-item-grams');
    check.checked=false;
    grams.value='';
    grams.disabled=true;
  });
  updateStockMovementSummary();
}
function useAllAvailableStock(){
  if($('stock-movement-type').value!=='salida')return;
  $('stock-movement-items').querySelectorAll('[data-stock-movement-row]').forEach(row=>{
    const current=Number(row.dataset.current)||0;
    const check=row.querySelector('.stock-movement-check');
    const grams=row.querySelector('.stock-movement-item-grams');
    if(check.disabled||current<=0)return;
    check.checked=true;
    grams.disabled=false;
    grams.value=String(Math.round(current*100)/100);
  });
  updateStockMovementSummary();
}
function selectedStockMovementRows(){
  return [...$('stock-movement-items').querySelectorAll('[data-stock-movement-row]')].filter(row=>row.querySelector('.stock-movement-check')?.checked);
}
function updateStockMovementSummary(){
  const rows=selectedStockMovementRows();
  const total=rows.reduce((sum,row)=>{
    const grams=Number(row.querySelector('.stock-movement-item-grams')?.value);
    return sum+(Number.isFinite(grams)&&grams>0?grams:0);
  },0);
  const summary=$('stock-movement-summary');
  if(!rows.length){summary.textContent='Ninguna genética seleccionada.';return}
  summary.textContent=`${rows.length} genética${rows.length===1?'':'s'} seleccionada${rows.length===1?'':'s'} · Total cargado: ${formatGrams(total)}`;
}
async function saveStockMovement(){
  const cycleId=$('stock-movement-cycle').value;
  const type=$('stock-movement-type').value;
  const rows=selectedStockMovementRows();
  if(!cycleId)throw new Error('Seleccioná la sala y el ciclo.');
  if(!rows.length)throw new Error('Seleccioná al menos una genética.');
  const date=$('stock-movement-date').value||ymd(today());
  const destination=$('stock-movement-destination').value.trim()||null;
  const notes=$('stock-movement-notes').value.trim()||null;
  const payloads=[];
  let total=0;
  for(const row of rows){
    const itemId=row.dataset.itemId;
    const item=state.stockItems.find(x=>String(x.id)===String(itemId));
    const grams=Number(row.querySelector('.stock-movement-item-grams')?.value);
    if(!item)throw new Error('No se encontró una de las genéticas seleccionadas.');
    if(!Number.isFinite(grams)||grams<=0)throw new Error(`Ingresá una cantidad válida para ${item.nombre_historico}.`);
    const available=stockItemCurrent(item);
    if(type==='salida'&&grams>available+0.0001)throw new Error(`La salida de ${item.nombre_historico} supera su stock disponible (${formatGrams(available)}).`);
    total+=grams;
    payloads.push({ciclo_id:cycleId,existencia_id:itemId,genetica_id:item.genetica_id||null,nombre_historico:item.nombre_historico||null,fecha:date,fecha_text:null,tipo:type,destino:destination,gramos:grams,observaciones:notes,afecta_stock:true,origen:'app'});
  }
  const cycle=state.stockCycles.find(c=>String(c.id)===String(cycleId));
  const typeLabel=type==='salida'?'salida':'entrada';
  const destinationLabel=destination?`\nDestino / origen: ${destination}`:'';
  const ok=confirm(`Se registrarán ${payloads.length} ${typeLabel}${payloads.length===1?'':'s'} por un total de ${formatGrams(total)}.\n${cycle?`${cycle.sala} · Ciclo ${cycle.ciclo}`:'Stock'}${destinationLabel}\n\n¿Confirmar movimientos?`);
  if(!ok)return;
  const q=await db.from('stock_movimientos').insert(payloads);
  if(q.error)throw q.error;
  closeDialog('stock-movement-dialog');
  state.stockRoom=cycle?.sala||state.stockRoom;
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
let voiceSpeaking=false;
let voiceSpeechEnabled=localStorage.getItem('rainbows_voice_speech')==='1';
let voiceSpeechVoiceURI=localStorage.getItem('rainbows_voice_uri')||'';
let voiceSpeechRate=Math.min(1.35,Math.max(0.75,Number(localStorage.getItem('rainbows_voice_rate')||1)||1));
let voiceAvailableVoices=[];
let voiceInputSensitivity=localStorage.getItem('rainbows_voice_input_sensitivity')||'high';
let voiceGateStream=null;
let voiceGateContext=null;
let voiceGateAnalyser=null;
let voiceGateFrame=null;
let voiceGateAmbient=0.012;
let voiceGateAmbientReady=false;
let voiceGateAboveSince=0;
let voiceGateCalibratingUntil=0;
let voiceGateWaiting=false;

function normalizeVoiceText(value=''){
  let clean=value.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  // Alias fonéticos de salas. “Veges” suele llegar desde el reconocimiento como “vejes”,
  // “vejez”, “veces” u otras variantes cercanas. Las unificamos antes de interpretar
  // navegación, consultas y acciones para que todas las funciones usen la misma sala.
  clean=clean.replace(/\b(veges|vejes|vejez|vegez|bejes|begez|veyes|beyes|veggies|veggie)\b/g,'veges');
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
function refreshVoiceList(){
  if(!('speechSynthesis' in window))return [];
  voiceAvailableVoices=window.speechSynthesis.getVoices()||[];
  return voiceAvailableVoices;
}
function spanishVoiceOptions(){
  const all=refreshVoiceList();
  const es=all.filter(v=>String(v.lang||'').toLowerCase().startsWith('es'));
  return es.length?es:all;
}
function selectedVoice(){
  const voices=refreshVoiceList();
  if(voiceSpeechVoiceURI){const saved=voices.find(v=>v.voiceURI===voiceSpeechVoiceURI);if(saved)return saved;}
  return voices.find(v=>String(v.lang||'').toLowerCase()==='es-ar')||voices.find(v=>String(v.lang||'').toLowerCase().startsWith('es'))||null;
}
function populateHelpVoiceSelect(){
  const select=$('help-voice-select');if(!select)return;
  const voices=spanishVoiceOptions();
  select.innerHTML='';
  if(!voices.length){select.innerHTML='<option value="">Voz predeterminada del dispositivo</option>';select.disabled=true;return;}
  select.disabled=false;
  for(const v of voices){const o=document.createElement('option');o.value=v.voiceURI;o.textContent=`${v.name}${v.lang?` · ${v.lang}`:''}${v.default?' · predeterminada':''}`;select.appendChild(o);}
  const current=selectedVoice();if(current)select.value=current.voiceURI;
}
function setupHelpVoiceSettings(){
  const enabled=$('help-voice-enabled'),rate=$('help-voice-rate'),rateValue=$('help-voice-rate-value'),select=$('help-voice-select'),sensitivity=$('help-voice-sensitivity'),test=$('help-voice-test'),note=$('help-voice-note');
  if(enabled)enabled.checked=voiceSpeechEnabled;
  if(rate){rate.value=String(voiceSpeechRate);if(rateValue)rateValue.textContent=`${Number(voiceSpeechRate).toFixed(2).replace(/\.00$/,'').replace(/0$/,'')}×`;}
  if(sensitivity)sensitivity.value=voiceInputSensitivity;
  populateHelpVoiceSelect();
  if(note)note.textContent=('speechSynthesis' in window)?'Las voces disponibles dependen del teléfono, sistema operativo y navegador. En celular, Normal/Baja mantienen la escucha lista y descartan ruido o frases dudosas sin obligarte a encontrar un timing. En computadora conservan el filtro por nivel ambiente. Todo se guarda solo en este dispositivo.':'Este navegador no ofrece lectura de voz.';
  enabled?.addEventListener('change',e=>{voiceSpeechEnabled=Boolean(e.target.checked);localStorage.setItem('rainbows_voice_speech',voiceSpeechEnabled?'1':'0');syncVoiceSpeechToggle();if(!voiceSpeechEnabled)stopVoiceSpeech();});
  rate?.addEventListener('input',e=>{voiceSpeechRate=Number(e.target.value)||1;localStorage.setItem('rainbows_voice_rate',String(voiceSpeechRate));if(rateValue)rateValue.textContent=`${voiceSpeechRate.toFixed(2).replace(/\.00$/,'').replace(/0$/,'')}×`;});
  select?.addEventListener('change',e=>{voiceSpeechVoiceURI=e.target.value||'';localStorage.setItem('rainbows_voice_uri',voiceSpeechVoiceURI);});
  sensitivity?.addEventListener('change',e=>setVoiceInputSensitivity(e.target.value));
  test?.addEventListener('click',()=>{const was=voiceSpeechEnabled;voiceSpeechEnabled=true;speakVoiceResponse('Hola. Esta es la voz de Rainbows.');voiceSpeechEnabled=was;});
}
function showVoicePanel(status='Micrófono apagado',message=''){
  const panel=$('voice-panel');
  if(!panel)return;
  panel.hidden=false;
  $('voice-status').textContent=status;
  if(message)$('voice-transcript').textContent=message;
}
function voiceSpeechText(message=''){
  const clean=String(message||'').trim();
  if(!clean)return '';
  const normalized=normalizeVoiceText(clean);
  // Si la respuesta pide desambiguar, no leemos una lista larga de opciones como
  // si fuera una respuesta definitiva. Las opciones completas quedan en pantalla.
  if(normalized.includes('no estoy seguro de que genetica quisiste decir')){
    return 'No estoy seguro de qué genética quisiste decir. Mirá las opciones en pantalla y decime el nombre o la nomenclatura.';
  }
  // Las respuestas normales (incluidas varias salas) se leen completas mientras
  // sigan siendo razonablemente breves.
  if(clean.length<=320)return clean;

  // Para respuestas extensas conservamos todo el detalle visualmente, pero leemos
  // solo una síntesis para que el modo continuo no resulte pesado.
  const sentences=clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if(sentences.length>1 && sentences[0].length<=230){
    return `${sentences[0]} Te dejo el detalle completo en pantalla.`;
  }
  const colon=clean.indexOf(':');
  if(colon>0 && colon<=180){
    return `${clean.slice(0,colon)}. Te dejo el detalle completo en pantalla.`;
  }
  const semicolon=clean.indexOf(';');
  if(semicolon>0 && semicolon<=220){
    return `${clean.slice(0,semicolon)}. Te dejo el detalle completo en pantalla.`;
  }
  const cut=clean.slice(0,220).replace(/\s+\S*$/,'').replace(/[,:;.-]+$/,'').trim();
  return `${cut}. Te dejo el detalle completo en pantalla.`;
}
function showVoiceResponse(message=''){
  const box=$('voice-response'), text=$('voice-response-text');
  if(!box||!text)return;
  text.textContent=message;
  box.hidden=!message;
  if(message&&voiceSpeechEnabled)speakVoiceResponse(voiceSpeechText(message));
}
function syncVoiceSpeechToggle(){
  const input=$('voice-speech-toggle');
  if(input)input.checked=voiceSpeechEnabled;
}
function stopVoiceSpeech({resume=true}={}){
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  const wasSpeaking=voiceSpeaking;
  voiceSpeaking=false;
  const stopBtn=$('voice-speech-stop');if(stopBtn)stopBtn.hidden=true;
  if(resume&&wasSpeaking&&voiceContinuousMode&&!voiceFatalError){$('voice-status').textContent='Escuchando…';scheduleVoiceRestart();}
}
function speakVoiceResponse(message=''){
  if(!voiceSpeechEnabled||!message||!('speechSynthesis' in window))return;
  if(window.speechSynthesis.speaking||window.speechSynthesis.pending)window.speechSynthesis.cancel();
  voiceSpeaking=true;
  if(voiceRestartTimer){clearTimeout(voiceRestartTimer);voiceRestartTimer=null;}
  if(voiceRecognition&&voiceListening){try{voiceRecognition.stop()}catch(_){}}
  const utterance=new SpeechSynthesisUtterance(message);
  const chosen=selectedVoice();
  if(chosen){utterance.voice=chosen;utterance.lang=chosen.lang||'es-AR';}
  else utterance.lang='es-AR';
  utterance.rate=voiceSpeechRate;
  utterance.onstart=()=>{
    voiceSpeaking=true;
    const stopBtn=$('voice-speech-stop');if(stopBtn)stopBtn.hidden=false;
    if(voiceContinuousMode){$('voice-status').textContent='Respondiendo…';setVoiceButtonActive(true);}
  };
  const finish=()=>{
    voiceSpeaking=false;
    const stopBtn=$('voice-speech-stop');if(stopBtn)stopBtn.hidden=true;
    if(voiceContinuousMode&&!voiceFatalError){$('voice-status').textContent='Escuchando…';scheduleVoiceRestart();}
  };
  utterance.onend=finish;
  utterance.onerror=finish;
  window.speechSynthesis.speak(utterance);
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
  stopVoiceSpeech({resume:false});
  voiceContinuousMode=false;
  voiceFatalError=false;
  if(voiceRestartTimer){clearTimeout(voiceRestartTimer);voiceRestartTimer=null;}
  stopVoiceGate({closeStream:true});
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
function voiceEmployeeAliasKeys(name=''){
  const key=normalizeVoiceText(name);
  const known={
    cone:['cone','coni','cony','kone'],
    chomi:['chomi','chomy','yomi','chommy'],
    pata:['pata'],
    lua:['lua'],
    mar:['mar'],
    eric:['eric','erik','erick'],
    tortu:['tortu','tortuga']
  };
  return [...new Set([key,...(known[key]||[])].map(normalizeVoiceText).filter(Boolean))];
}
function voiceEmployeeScore(text,employee){
  const clean=normalizeVoiceText(text);
  const tokens=clean.split(/\s+/).filter(Boolean);
  let best=0;
  for(const alias of voiceEmployeeAliasKeys(employee?.nombre||'')){
    const re=new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(\\s|$)`);
    if(re.test(clean))return 1;
    if(alias.length<4)continue;
    for(let size=1;size<=Math.min(2,tokens.length);size++){
      for(let i=0;i+size<=tokens.length;i++){
        const chunk=tokens.slice(i,i+size).join(' ');
        if(Math.abs(chunk.length-alias.length)>3)continue;
        best=Math.max(best,voiceSimilarity(alias,chunk));
      }
    }
  }
  return best;
}
function voiceEmployeeFromText(text){
  const scored=state.empleados.map(e=>({e,score:voiceEmployeeScore(text,e)})).sort((a,b)=>b.score-a.score);
  if(!scored.length||scored[0].score<0.72)return null;
  if(scored[1]&&scored[1].score>=0.72&&scored[0].score-scored[1].score<0.08)return null;
  return scored[0].e;
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

function voiceCycleNumberFromText(text){
  const m=normalizeVoiceText(text).match(/ciclo\s*(?:numero\s*)?(\d{1,3})/);
  return m?Number(m[1]):null;
}
function voiceHasExplicitDate(text){
  const clean=normalizeVoiceText(text);
  if(/\b(hoy|ayer|anteayer|manana|pasado manana)\b/.test(clean))return true;
  if(/\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/.test(clean))return true;
  if(/\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/.test(clean))return true;
  if(/\b\d{1,2}\s+(?:del\s+)?\d{1,2}(?:\s+(?:del\s+)?\d{2,4})?\b/.test(clean))return true;
  return false;
}
function voiceStockDateRange(text){
  const clean=normalizeVoiceText(text), base=today();
  if(clean.includes('esta semana')){
    const weekday=(base.getDay()+6)%7;
    return {start:add(base,-weekday),end:add(base,6-weekday),label:'esta semana'};
  }
  if(clean.includes('semana pasada')){
    const weekday=(base.getDay()+6)%7;
    return {start:add(base,-weekday-7),end:add(base,-weekday-1),label:'la semana pasada'};
  }
  if(voiceHasExplicitDate(clean)){
    const d=voiceDateFromText(clean);return {start:d,end:d,label:`el ${nice(d)}`};
  }
  return null;
}
function voiceMovementDateValue(m){
  if(!m.fecha)return null;
  try{return parse(m.fecha)}catch(_){return null}
}
function voiceLevenshtein(a='',b=''){
  a=String(a);b=String(b);
  if(a===b)return 0;
  if(!a.length)return b.length;if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
  for(let i=1;i<=a.length;i++){
    cur[0]=i;
    for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    for(let j=0;j<=b.length;j++)prev[j]=cur[j];
  }
  return prev[b.length];
}
function voiceSimilarity(a,b){
  const aa=normalizeVoiceText(a).replace(/\s+/g,''),bb=normalizeVoiceText(b).replace(/\s+/g,'');
  if(!aa||!bb)return 0;
  return 1-(voiceLevenshtein(aa,bb)/Math.max(aa.length,bb.length));
}
function voiceCodeSpokenAliases(code=''){
  const raw=String(code||'').trim();if(!raw)return[];
  const letterNames={a:'a',b:'be',c:'ce',d:'de',e:'e',f:'efe',g:'ge',h:'hache',i:'i',j:'jota',k:'ka',l:'ele',m:'eme',n:'ene',o:'o',p:'pe',q:'cu',r:'erre',s:'ese',t:'te',u:'u',v:'uve',w:'doble ve',x:'equis',y:'ye',z:'zeta'};
  const chars=[...raw.toLowerCase().replace(/[^a-z0-9]/g,'')];
  if(!chars.length)return[];
  const spoken=chars.map(ch=>/\d/.test(ch)?ch:(letterNames[ch]||ch)).join(' ');
  const separated=chars.join(' ');
  const aliases=[raw,spoken,separated,chars.join('')];
  if(/[v]/i.test(raw))aliases.push(spoken.replace(/\buve\b/g,'ve'));
  if(/[w]/i.test(raw))aliases.push(spoken.replace(/\bdoble ve\b/g,'doble u'));
  return aliases;
}
function voiceGeneticAliasKeys(name='',code=''){
  const aliases=[];
  const rawName=String(name||'').trim();
  if(rawName){
    aliases.push(rawName);
    aliases.push(rawName.replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,'$1 $2'));
    aliases.push(rawName.replace(/[\s_-]+/g,''));
  }
  aliases.push(...voiceCodeSpokenAliases(code));
  return [...new Set(aliases.map(normalizeVoiceText).filter(Boolean))];
}
function voiceGeneticResolver(text,{extraNames=[]}={}){
  const clean=normalizeVoiceText(text),queryTokens=clean.split(' ').filter(Boolean);
  const candidates=[];
  for(const g of state.geneticas){
    const keys=voiceGeneticAliasKeys(g.nombre,g.nomenclatura);
    if(keys.length)candidates.push({genetic:g,label:g.nombre||g.nomenclatura,key:normalizeVoiceText(g.nombre||g.nomenclatura),keys});
  }
  for(const name of extraNames){
    const label=String(name||'').trim();if(!label)continue;
    const key=normalizeVoiceText(label);
    if(!key)continue;
    const existing=candidates.find(c=>c.keys.includes(key));
    if(!existing)candidates.push({genetic:null,label,key,keys:voiceGeneticAliasKeys(label,'')});
  }
  // Coincidencia exacta primero: nombre, nomenclatura y nomenclatura deletreada.
  for(const c of candidates){
    const exact=c.keys.find(k=>new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(\\s|$)`).test(clean));
    if(exact)return {match:{...c,key:exact},ambiguous:false,score:1};
  }
  // Si no hay coincidencia exacta, toleramos pequeños errores del reconocimiento.
  const scored=[];
  for(const c of candidates){
    let best=0,bestKey=c.key;
    for(const key of c.keys){
      const n=Math.max(1,key.split(' ').length);
      for(let size=Math.max(1,n-1);size<=Math.min(queryTokens.length,n+1);size++){
        for(let i=0;i+size<=queryTokens.length;i++){
          const chunk=queryTokens.slice(i,i+size).join(' ');
          if(chunk.length<3)continue;
          const score=voiceSimilarity(key,chunk);
          if(score>best){best=score;bestKey=key;}
        }
      }
    }
    if(best>=0.72)scored.push({candidate:{...c,key:bestKey},score:best});
  }
  scored.sort((a,b)=>b.score-a.score);
  if(!scored.length)return {match:null,ambiguous:false,score:0};
  const best=scored[0],second=scored[1];
  if(second&&second.score>=0.72&&(best.score-second.score)<0.07&&String(best.candidate.genetic?.id||best.candidate.label)!==String(second.candidate.genetic?.id||second.candidate.label)){
    const suggestions=[...new Map(scored.slice(0,3).map(x=>[String(x.candidate.genetic?.id||x.candidate.label),x.candidate.label])).values()];
    return {match:null,ambiguous:true,score:best.score,suggestions};
  }
  return {match:best.candidate,ambiguous:false,score:best.score};
}
function voiceGeneticAmbiguityMessage(result){
  return result?.ambiguous?`No estoy seguro de qué genética quisiste decir. Las más parecidas son: ${voiceList(result.suggestions||[],3)}. Decime el nombre o la nomenclatura.`:null;
}
function voiceStockGeneticFromText(text){
  const extra=state.stockItems.map(i=>i.nombre_historico).filter(Boolean);
  return voiceGeneticResolver(text,{extraNames:extra});
}
function voiceStockItemMatches(item,genetic){
  if(!genetic)return true;
  const names=[item.nombre_historico,state.geneticas.find(g=>String(g.id)===String(item.genetica_id))?.nombre,state.geneticas.find(g=>String(g.id)===String(item.genetica_id))?.nomenclatura].filter(Boolean).map(normalizeVoiceText);
  return names.includes(genetic.key);
}
function executeVoiceStockQuery(rawText){
  const text=normalizeVoiceText(rawText);
  // Si la frase habla explícitamente de tareas, no debe caer nunca en Stock aunque diga 'queda/quedan'.
  const taskWords=['tarea','tareas','pendiente','pendientes','realizada','realizadas','completada','completadas','responsable','responsables','quien hizo','quienes hicieron'];
  if(taskWords.some(w=>text.includes(w)))return null;
  const stockWords=['stock','existencia','existencias','disponible','disponibles','queda','quedan','movimiento','movimientos','salida','salidas','entrada','entradas','ajuste','ajustes','medrano','consumo interno','descarte','descarto','descartado'];
  if(!stockWords.some(w=>text.includes(w)))return null;

  const room=voiceRoomFromText(text,{allowContext:false});
  const cycleNumber=voiceCycleNumberFromText(text);
  const geneticResult=voiceStockGeneticFromText(text);
  const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
  const genetic=geneticResult.match;
  const range=voiceStockDateRange(text);
  const wantsMovements=text.includes('movimiento')||text.includes('salida')||text.includes('entrada')||text.includes('ajuste')||text.includes('medrano')||text.includes('consumo interno')||text.includes('descarte')||text.includes('descarto')||text.includes('descartado');

  if(wantsMovements){
    let moves=[...state.stockMovements];
    if(room){const ids=new Set(state.stockCycles.filter(c=>c.sala===room).map(c=>String(c.id)));moves=moves.filter(m=>ids.has(String(m.ciclo_id)));}
    if(cycleNumber!==null){const ids=new Set(state.stockCycles.filter(c=>(!room||c.sala===room)&&Number(c.ciclo)===cycleNumber).map(c=>String(c.id)));moves=moves.filter(m=>ids.has(String(m.ciclo_id)));}
    if(genetic)moves=moves.filter(m=>{
      const item=state.stockItems.find(i=>String(i.id)===String(m.existencia_id));
      const key=normalizeVoiceText(m.nombre_historico||item?.nombre_historico||stockMovementTitle(m));
      return key===genetic.key||voiceStockItemMatches(item||{},genetic);
    });
    let type=null,destination=null;
    if(text.includes('salida'))type='salida';
    else if(text.includes('entrada'))type='entrada';
    else if(text.includes('ajuste'))type='ajuste';
    if(text.includes('medrano'))destination='medrano';
    else if(text.includes('consumo interno'))destination='consumo interno';
    else if(text.includes('descarte')||text.includes('descarto')||text.includes('descartado'))destination='descarte';
    if(type)moves=moves.filter(m=>normalizeVoiceText(m.tipo||'')===type);
    if(destination)moves=moves.filter(m=>normalizeVoiceText(m.destino||'').includes(destination));
    if(range)moves=moves.filter(m=>{const d=voiceMovementDateValue(m);return d&&diff(range.start,d)<=0&&diff(d,range.end)<=0;});
    moves.sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const total=moves.reduce((sum,m)=>sum+(Number(m.gramos)||0),0);
    const scope=[room,cycleNumber!==null?`ciclo ${cycleNumber}`:null,genetic?.label,range?.label].filter(Boolean).join(' · ');
    if(!moves.length)return {ok:true,message:`No encontré movimientos${scope?` para ${scope}`:''}${destination?` con destino ${destination}`:''}.`};
    const details=moves.slice(0,6).map(m=>{
      const c=state.stockCycles.find(x=>String(x.id)===String(m.ciclo_id));
      return `${stockMovementDate(m)} · ${c?`${c.sala} ciclo ${c.ciclo} · `:''}${stockMovementTitle(m)} · ${m.tipo}${m.destino?` a ${m.destino}`:''} · ${formatGrams(m.gramos)}`;
    });
    return {ok:true,message:`Encontré ${moves.length} movimiento${moves.length===1?'':'s'}${scope?` (${scope})`:''}, por ${formatGrams(total)} en total. ${voiceList(details,6)}.`};
  }

  let cycles=state.stockCycles.filter(c=>(!room||c.sala===room)&&(cycleNumber===null||Number(c.ciclo)===cycleNumber));
  if((room||cycleNumber!==null)&&!cycles.length)return {ok:true,message:`No encontré stock para ${[room,cycleNumber!==null?`ciclo ${cycleNumber}`:null].filter(Boolean).join(' · ')}.`};
  if(!room&&cycleNumber!==null){
    const byCycle=cycles.reduce((acc,c)=>{acc[c.sala]=(acc[c.sala]||0)+stockCycleCurrent(c);return acc;},{});
    const parts=Object.entries(byCycle).map(([sala,total])=>`${sala}: ${formatGrams(total)}`);
    if(!genetic)return {ok:true,message:`Stock actual del ciclo ${cycleNumber}: ${parts.join('; ')||'sin stock cargado'}.`};
  }
  const cycleIds=new Set(cycles.map(c=>String(c.id)));
  const items=state.stockItems.filter(i=>cycleIds.has(String(i.ciclo_id))&&voiceStockItemMatches(i,genetic));
  const total=items.reduce((sum,i)=>sum+stockItemCurrent(i),0);
  const scope=[genetic?.label,room,cycleNumber!==null?`ciclo ${cycleNumber}`:null].filter(Boolean).join(' · ');
  if(genetic){
    if(!items.length)return {ok:true,message:`No encontré stock cargado de ${genetic.label}${room?` en ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}.`};
    const breakdown=[];
    for(const i of items){const c=state.stockCycles.find(x=>String(x.id)===String(i.ciclo_id));const cur=stockItemCurrent(i);if(cur>0)breakdown.push(`${c?.sala||'Sala'} ciclo ${c?.ciclo??'—'}: ${formatGrams(cur)}`);}
    return {ok:true,message:`Stock actual de ${genetic.label}${room?` en ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}: ${formatGrams(total)}${breakdown.length?`. ${voiceList(breakdown,8)}`:''}.`};
  }
  if(room&&cycleNumber!==null)return {ok:true,message:`Stock actual de ${room}, ciclo ${cycleNumber}: ${formatGrams(total)}.`};
  if(room)return {ok:true,message:`Stock actual de ${room}: ${formatGrams(total)}.`};
  const grand=state.stockCycles.reduce((sum,c)=>sum+stockCycleCurrent(c),0);
  const byRoom=['Flora 1','Flora 2','Flora 3'].map(r=>`${r}: ${formatGrams(state.stockCycles.filter(c=>c.sala===r).reduce((sum,c)=>sum+stockCycleCurrent(c),0))}`);
  return {ok:true,message:`Stock total actual en Palestina: ${formatGrams(grand)}. ${byRoom.join('; ')}.`};
}



// V3.16.9 — Carga de cosechas por voz.
// La voz prepara el formulario y agrega pesadas, pero nunca guarda en Supabase automáticamente.
function voiceHarvestDialogOpen(){return Boolean($('harvest-dialog')?.open)}
function voicePlainText(value=''){
  return String(value||'').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/,/g,'.').replace(/[^a-z0-9.\s]/g,' ').replace(/\s+/g,' ').trim();
}
function voiceSpanishInteger(value=''){
  const clean=voicePlainText(value);
  if(!clean)return null;
  const direct=clean.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  if(direct)return Number(direct[1]);
  const units={un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9};
  const teens={diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19};
  const twenties={veinte:20,veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29};
  const tens={treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90};
  const hundreds={cien:100,ciento:100,doscientos:200,doscientas:200,trescientos:300,trescientas:300,cuatrocientos:400,cuatrocientas:400,quinientos:500,quinientas:500,seiscientos:600,seiscientas:600,setecientos:700,setecientas:700,ochocientos:800,ochocientas:800,novecientos:900,novecientas:900};
  let total=0,current=0,seen=false;
  for(const token of clean.split(' ')){
    if(token==='y')continue;
    if(token==='mil'){
      total+=(current||1)*1000;current=0;seen=true;continue;
    }
    if(token in hundreds){current+=hundreds[token];seen=true;continue;}
    if(token in teens){current+=teens[token];seen=true;continue;}
    if(token in twenties){current+=twenties[token];seen=true;continue;}
    if(token in tens){current+=tens[token];seen=true;continue;}
    if(token in units){current+=units[token];seen=true;continue;}
  }
  return seen?total+current:null;
}
function voiceNumberPhraseBeforeUnit(clean,unitPattern){
  const tokens=clean.split(' ');
  const idx=tokens.findIndex(t=>unitPattern.test(t));
  if(idx<0)return null;
  const numberWords=new Set(['un','uno','una','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintiuna','veintidos','veintitres','veinticuatro','veinticinco','veintiseis','veintisiete','veintiocho','veintinueve','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa','cien','ciento','doscientos','doscientas','trescientos','trescientas','cuatrocientos','cuatrocientas','quinientos','quinientas','seiscientos','seiscientas','setecientos','setecientas','ochocientos','ochocientas','novecientos','novecientas','mil','y']);
  const picked=[];
  for(let i=idx-1;i>=0;i--){
    const t=tokens[i];
    if(/^\d+(?:\.\d+)?$/.test(t)||numberWords.has(t)){picked.unshift(t);continue;}
    break;
  }
  return picked.length?voiceSpanishInteger(picked.join(' ')):null;
}
function voiceWeightFromText(rawText=''){
  const clean=voicePlainText(rawText);
  if(!clean)return null;
  // Casos naturales: “medio kilo” / “un kilo y medio”.
  if(/\bmedio\s+kilo(?:s|gramos?)?\b/.test(clean))return 500;
  const kiloMatch=clean.match(/\b(kilo|kilos|kg|kilogramo|kilogramos)\b/);
  if(kiloMatch){
    const unit=kiloMatch[1], before=clean.slice(0,kiloMatch.index+unit.length);
    let kilos=voiceNumberPhraseBeforeUnit(before,/^(kilo|kilos|kg|kilogramo|kilogramos)$/);
    if(kilos==null&&/\bun\s+(?:kilo|kg|kilogramo)/.test(clean))kilos=1;
    if(kilos==null)kilos=1;
    let grams=0;
    const after=clean.slice((kiloMatch.index||0)+unit.length).trim();
    if(/^y\s+medio\b/.test(after))grams=500;
    else{
      const gramsUnit=after.match(/\b(gramo|gramos|g)\b/);
      const segment=gramsUnit?after.slice(0,gramsUnit.index):after;
      const extra=voiceSpanishInteger(segment);
      if(extra!=null&&extra<1000)grams=extra;
    }
    return Math.round((Number(kilos)*1000+grams)*100)/100;
  }
  const gramUnit=clean.match(/\b(gramo|gramos|g)\b/);
  if(gramUnit){
    const before=clean.slice(0,gramUnit.index+gramUnit[1].length);
    const grams=voiceNumberPhraseBeforeUnit(before,/^(gramo|gramos|g)$/);
    if(grams!=null)return Math.round(Number(grams)*100)/100;
  }
  // Con el formulario de cosecha abierto permitimos “Gomu Gomu 850”.
  const trailing=clean.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*$/);
  return trailing?Number(trailing[1]):null;
}
function voiceHarvestFormPhraseLooksRelevant(rawText=''){
  if(!voiceHarvestDialogOpen())return false;
  const text=normalizeVoiceText(rawText);
  if(/\b(meta|plantas|pesada|pesadas|pasada|pasadas|pesaje|pesajes|cosecha|guardar|cancelar|quitar|sacar|borrar|eliminar|corregir|cambiar|modificar)\b/.test(text))return true;
  const weight=voiceWeightFromText(rawText);
  if(!(weight>0))return false;
  const geneticResult=voiceGeneticResolver(rawText);
  return Boolean(geneticResult?.match||geneticResult?.ambiguous);
}
function voiceHarvestAddLine(genetic,grams){
  const container=$('harvest-lines');if(!container||!genetic?.genetic)return false;
  container.insertAdjacentHTML('beforeend',harvestLineTemplate({genetica_id:genetic.genetic.id,gramos:Number(grams)}));
  bindHarvestLines();
  const row=container.lastElementChild;row?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  return true;
}
function voiceHarvestCurrentTotal(){
  return [...($('harvest-lines')?.querySelectorAll('.harvest-line')||[])].reduce((sum,row)=>sum+(Number(row.querySelector('.harvest-line-grams')?.value)||0),0);
}
function executeVoiceHarvestAction(rawText){
  const text=normalizeVoiceText(rawText);
  const dialogOpen=voiceHarvestDialogOpen();
  const createAction=/(^|\s)(nueva|nuevo|crear|crea|cargar|carga|registrar|registra|agregar|agrega)(\s|$)/.test(text)&&(text.includes('cosecha')||text.includes('cosechas'));

  if(!dialogOpen&&createAction){
    if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para cargar cosechas.'};
    if(state.view!=='harvests')return {ok:true,message:'Para cargar una cosecha por voz, abrí Cosechas y repetí la orden. Así Rainbows modifica únicamente esa sección.'};
    const room=voiceRoomFromText(text,{allowContext:false});
    if(!room||!/^Flora [123]$/.test(room))return {ok:true,message:'Entendí que querés cargar una cosecha, pero necesito la sala. Decime por ejemplo: “Nueva cosecha de Flora 3 ciclo 10”.'};
    const d=voiceHasExplicitDate(text)?voiceDateFromText(text):today();
    const rule=rr(room);
    const spokenCycle=voiceCycleNumberFromText(text);
    const inferredCycle=rule?cycleNumber(rule,d):null;
    const cycleValue=spokenCycle||inferredCycle;
    if(!cycleValue)return {ok:true,message:'No pude determinar el ciclo de la cosecha. Decime por ejemplo: “Nueva cosecha de Flora 3 ciclo 10”.'};
    openHarvest();
    $('harvest-date').value=ymd(d);$('harvest-room').value=room;$('harvest-cycle').value=String(cycleValue);
    return {ok:true,message:`Preparé una nueva cosecha de ${room}, ciclo ${cycleValue}, con fecha ${nice(d)}. Ahora podés decir cada pesada, por ejemplo: “Gomu Gomu 850 gramos”. Nada se guarda hasta que toques Guardar.`};
  }

  if(!dialogOpen)return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para editar cosechas.'};

  if(/\b(guardar|grabar|confirmar)\s+(?:la\s+)?cosecha\b/.test(text))return {ok:true,message:'Por seguridad no guardo la cosecha por voz. Revisá el formulario y tocá Guardar cuando esté correcto.'};
  if(/\b(quitar|quita|sacar|saca|borra|borrar|eliminar|elimina)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)){
    const rows=$('harvest-lines')?.querySelectorAll('.harvest-line');const last=rows?.[rows.length-1];
    if(!last)return {ok:true,message:'Todavía no hay pesadas para quitar.'};
    last.remove();updateHarvestLineTotal();
    return {ok:true,message:`Quité la última pesada. El total del formulario quedó en ${formatGrams(voiceHarvestCurrentTotal())}.`};
  }
  if(/\b(corregir|corregi|corrige|cambiar|cambia|modificar|modifica)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)){
    const grams=voiceWeightFromText(rawText);const rows=$('harvest-lines')?.querySelectorAll('.harvest-line');const last=rows?.[rows.length-1];
    if(!last)return {ok:true,message:'Todavía no hay una pesada para corregir.'};
    if(!(grams>0))return {ok:true,message:'Decime el nuevo peso, por ejemplo: “Corregir última pesada a 920 gramos”.'};
    const input=last.querySelector('.harvest-line-grams');if(input)input.value=String(grams);updateHarvestLineTotal();
    return {ok:true,message:`Corregí la última pesada a ${formatGrams(grams)}. El total quedó en ${formatGrams(voiceHarvestCurrentTotal())}.`};
  }
  if(/\bmeta\b/.test(text)){
    const grams=voiceWeightFromText(rawText);
    if(!(grams>=0))return {ok:true,message:'Entendí que querés cargar la meta, pero no pude identificar los gramos.'};
    $('harvest-goal').value=String(grams);
    return {ok:true,message:`Cargué una meta de ${formatGrams(grams)} en el formulario. Revisala antes de guardar.`};
  }
  if(/\bplantas?\b/.test(text)){
    const m=voicePlainText(rawText).match(/(?:^|\s)(\d{1,4})\s+plantas?\b/);const count=m?Number(m[1]):voiceSpanishInteger(voicePlainText(rawText).replace(/\bplantas?\b.*$/,''));
    if(!(count>=0))return {ok:true,message:'Entendí que querés cargar la cantidad de plantas, pero no pude identificar el número.'};
    $('harvest-plants').value=String(Math.round(count));
    return {ok:true,message:`Cargué ${Math.round(count)} plantas en el formulario. Revisalo antes de guardar.`};
  }

  const grams=voiceWeightFromText(rawText);
  if(grams>0){
    const geneticResult=voiceGeneticResolver(rawText);
    const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
    const genetic=geneticResult.match;
    if(!genetic?.genetic)return {ok:true,message:`Entendí ${formatGrams(grams)}, pero no pude identificar la genética. Decime nombre o nomenclatura junto con el peso.`};
    voiceHarvestAddLine(genetic,grams);
    return {ok:true,message:`Agregué ${genetic.label}: ${formatGrams(grams)}. Total actual: ${formatGrams(voiceHarvestCurrentTotal())}. Podés decir la siguiente pesada.`};
  }

  // Si estamos dentro del formulario pero la frase no parece una acción de cosecha,
  // dejamos que continúen funcionando las consultas/navegación globales.
  return null;
}


// V3.16.11 — Preparación de movimientos de Stock por voz.
// Nunca guarda automáticamente: la voz solo abre/completa el formulario existente.
function voiceStockMovementDialogOpen(){return Boolean($('stock-movement-dialog')?.open)}
function voiceStockMovementCycleContext(room=null,cycleNumber=null){
  let cycles=state.stockCycles.filter(c=>(!room||c.sala===room)&&(cycleNumber===null||Number(c.ciclo)===Number(cycleNumber)));
  if(state.stockCycle){
    const selected=cycles.find(c=>String(c.id)===String(state.stockCycle));
    if(selected)return {cycle:selected,ambiguous:false};
  }
  if(cycleNumber!==null){
    if(cycles.length===1)return {cycle:cycles[0],ambiguous:false};
    if(cycles.length>1)return {cycle:null,ambiguous:true,cycles};
    return {cycle:null,ambiguous:false,cycles:[]};
  }
  const withStock=cycles.filter(c=>stockCycleCurrent(c)>0.0001).sort((a,b)=>Number(b.ciclo)-Number(a.ciclo));
  if(withStock.length===1)return {cycle:withStock[0],ambiguous:false};
  if(withStock.length>1)return {cycle:null,ambiguous:true,cycles:withStock};
  if(cycles.length===1)return {cycle:cycles[0],ambiguous:false};
  return {cycle:null,ambiguous:cycles.length>1,cycles};
}
function voiceStockMovementRowForGenetic(genetic){
  if(!genetic)return null;
  return [...($('stock-movement-items')?.querySelectorAll('[data-stock-movement-row]')||[])].find(row=>{
    const item=state.stockItems.find(x=>String(x.id)===String(row.dataset.itemId));
    return item&&voiceStockItemMatches(item,genetic);
  })||null;
}
function voiceSetStockMovementRow(row,grams){
  if(!row)return false;
  const check=row.querySelector('.stock-movement-check');
  const input=row.querySelector('.stock-movement-item-grams');
  if(!check||!input||check.disabled)return false;
  check.checked=true;input.disabled=false;input.value=String(Math.round(Number(grams)*100)/100);updateStockMovementSummary();
  row.scrollIntoView?.({block:'nearest',behavior:'smooth'});return true;
}
function voiceStockMovementFormPhraseLooksRelevant(rawText=''){
  if(!voiceStockMovementDialogOpen())return false;
  const text=normalizeVoiceText(rawText);
  if(/\b(usar todo|todo disponible|seleccionar todas|selecciona todas|limpiar|borrar seleccion|destino|origen|salida|entrada|quitar|sacar|borrar|eliminar|cambiar|corregir|modificar)\b/.test(text))return true;
  const weight=voiceWeightFromText(rawText);
  const geneticResult=voiceStockGeneticFromText(rawText);
  if(weight>0&&(geneticResult?.match||geneticResult?.ambiguous))return true;
  if(/\btodo\b/.test(text)&&(geneticResult?.match||geneticResult?.ambiguous))return true;
  return false;
}
function executeVoiceStockMovementAction(rawText){
  const text=normalizeVoiceText(rawText),dialogOpen=voiceStockMovementDialogOpen();
  if(dialogOpen){
    if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para registrar movimientos de Stock.'};
    if(/\b(guardar|grabar|confirmar)\b/.test(text)&&(text.includes('stock')||text.includes('movimiento')))
      return {ok:true,message:'Por seguridad no guardo movimientos de Stock por voz. Revisá el formulario y tocá Guardar movimientos cuando esté correcto.'};
    if(/\b(usar|cargar|poner)\s+(?:todo\s+)?(?:el\s+)?(?:stock\s+)?disponible\b/.test(text)||text==='usar todo disponible'){
      if($('stock-movement-type').value!=='salida')return {ok:true,message:'“Usar todo disponible” solo corresponde a una salida. Cambiá el tipo a salida o decime “tipo salida”.'};
      useAllAvailableStock();
      return {ok:true,message:`Cargué todo el stock disponible de las genéticas con saldo. ${$('stock-movement-summary').textContent} Revisá antes de guardar.`};
    }
    if(/\b(seleccionar|selecciona|marcar|marca)\s+(?:a\s+)?todas\b/.test(text)){
      selectAllStockMovementItems();return {ok:true,message:`Seleccioné todas las genéticas disponibles. ${$('stock-movement-summary').textContent}`};
    }
    if(/\b(limpiar|limpia|borrar|borra)\s+(?:la\s+)?seleccion\b/.test(text)||text==='limpiar'){
      clearStockMovementItems();return {ok:true,message:'Limpié la selección de genéticas del movimiento.'};
    }
    if(/\btipo\s+entrada\b/.test(text)||text==='entrada'){$('stock-movement-type').value='entrada';updateStockMovementItems();return {ok:true,message:'Cambié el movimiento a entrada. Revisá las cantidades antes de guardar.'};}
    if(/\btipo\s+salida\b/.test(text)||text==='salida'){$('stock-movement-type').value='salida';updateStockMovementItems();return {ok:true,message:'Cambié el movimiento a salida. Revisá las cantidades antes de guardar.'};}
    if(/\bdestino\s+medrano\b/.test(text)||/\b(?:a|hacia)\s+medrano\b/.test(text)){$('stock-movement-destination').value='Medrano';return {ok:true,message:'Puse Medrano como destino del movimiento.'};}
    if(voiceHasExplicitDate(text)&&(/\bfecha\b/.test(text)||text.split(' ').length<=5)){
      const d=voiceDateFromText(text);$('stock-movement-date').value=ymd(d);return {ok:true,message:`Puse fecha ${nice(d)} en el movimiento.`};
    }
    const geneticResult=voiceStockGeneticFromText(rawText);
    const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
    const genetic=geneticResult.match;
    if(genetic){
      const row=voiceStockMovementRowForGenetic(genetic);
      if(!row)return {ok:true,message:`No encontré ${genetic.label} dentro del ciclo seleccionado para este movimiento.`};
      const remove=/\b(quitar|quita|sacar|saca|borrar|borra|eliminar|elimina)\b/.test(text);
      if(remove){const check=row.querySelector('.stock-movement-check'),input=row.querySelector('.stock-movement-item-grams');check.checked=false;input.value='';input.disabled=true;updateStockMovementSummary();return {ok:true,message:`Quité ${genetic.label} del movimiento.`};}
      const wantsAll=/\b(todo|toda|completo|completa)\b/.test(text);
      let grams=voiceWeightFromText(rawText);
      if(wantsAll&&$('stock-movement-type').value==='salida')grams=Number(row.dataset.current)||0;
      if(!(grams>0))return {ok:true,message:`Entendí ${genetic.label}, pero necesito la cantidad. Podés decir “${genetic.label} 850 gramos” o “todo de ${genetic.label}”.`};
      const available=Number(row.dataset.current)||0;
      if($('stock-movement-type').value==='salida'&&grams>available+0.0001)return {ok:true,message:`No puedo preparar ${formatGrams(grams)} de ${genetic.label}: hay ${formatGrams(available)} disponibles.`};
      if(!voiceSetStockMovementRow(row,grams))return {ok:true,message:`No pude seleccionar ${genetic.label} para este movimiento.`};
      return {ok:true,message:`Cargué ${genetic.label}: ${formatGrams(grams)}. ${$('stock-movement-summary').textContent}`};
    }
    return null;
  }

  const createAction=(/\b(mover|move|trasladar|traslada|transferir|transfiere|registrar|registra|crear|crea|cargar|carga)\b/.test(text)&&/\b(stock|movimiento|salida|entrada)\b/.test(text))||/\b(?:mover|trasladar)\s+todo\b/.test(text);
  if(!createAction)return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para registrar movimientos de Stock.'};
  if(state.view!=='stock')return {ok:true,message:'Para preparar un movimiento por voz, abrí Stock Palestina y repetí la orden. Así Rainbows modifica únicamente esa sección.'};
  const room=voiceRoomFromText(text,{allowContext:false})||state.stockRoom||null;
  const cycleNumber=voiceCycleNumberFromText(text);
  const context=voiceStockMovementCycleContext(room,cycleNumber);
  if(!context.cycle){
    if(!room)return {ok:true,message:'Entendí que querés registrar un movimiento, pero necesito la sala y el ciclo. Decime por ejemplo: “Mover todo el stock de Flora 3 ciclo 9 a Medrano”.'};
    if(context.ambiguous)return {ok:true,message:`Encontré más de un ciclo posible de ${room}. Decime el ciclo para evitar mover stock equivocado.`};
    return {ok:true,message:`No encontré un ciclo de Stock que coincida con ${room}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}.`};
  }
  const type=text.includes('entrada')?'entrada':'salida';
  const d=voiceHasExplicitDate(text)?voiceDateFromText(text):today();
  openStockMovement(context.cycle.id);
  $('stock-movement-type').value=type;updateStockMovementItems();
  $('stock-movement-date').value=ymd(d);
  if(text.includes('medrano'))$('stock-movement-destination').value='Medrano';
  const wantsAll=/\b(todo|todas|completo|completa)\b/.test(text)&&/\bstock\b/.test(text);
  if(wantsAll&&type==='salida')useAllAvailableStock();
  const dest=$('stock-movement-destination').value.trim();
  return {ok:true,message:`Preparé una ${type} de Stock de ${context.cycle.sala}, ciclo ${context.cycle.ciclo}${dest?` ${type==='salida'?'hacia':'desde'} ${dest}`:''}${wantsAll?`, usando todo el stock disponible`:''}. Revisá cantidades y tocá Guardar movimientos cuando esté correcto.`};
}

function voiceHarvestYearFromText(text){
  const clean=normalizeVoiceText(text),base=today();
  const m=clean.match(/\b(20\d{2})\b/);
  if(m)return Number(m[1]);
  if(clean.includes('este ano')||clean.includes('este año'))return base.getFullYear();
  if(clean.includes('ano pasado')||clean.includes('año pasado'))return base.getFullYear()-1;
  return null;
}
function voiceHarvestGeneticFromText(text){
  const extra=state.cosechaDetalles.map(d=>d.nombre_historico).filter(Boolean);
  return voiceGeneticResolver(text,{extraNames:extra});
}
function voiceHarvestDetailMatches(row,genetic){
  if(!genetic)return true;
  const g=state.geneticas.find(x=>String(x.id)===String(row.genetica_id));
  const names=[row.nombre_historico,g?.nombre,g?.nomenclatura].filter(Boolean).map(normalizeVoiceText);
  return names.includes(genetic.key);
}
function voiceHarvestLabel(h){
  return `${h.sala} ciclo ${h.ciclo} (${parse(h.fecha).toLocaleDateString('es-AR')}): ${formatGrams(h.total_gramos)}`;
}
function executeVoiceHarvestQuery(rawText){
  const text=normalizeVoiceText(rawText);
  // “¿Cuándo se cosecha...?” es una consulta de calendario de sala, no de resultados históricos.
  if(text.includes('cuando')&&(text.includes('cosecha')||text.includes('cosechar')))return null;
  const harvestWords=['cosecha','cosechas','cosecho','cosechado','produjo','produccion','produccion total','rindio','rinde','rendimiento','meta','desvio'];
  if(!harvestWords.some(w=>text.includes(w)))return null;

  const room=voiceRoomFromText(text,{allowContext:false});
  const cycleNumber=voiceCycleNumberFromText(text);
  const year=voiceHarvestYearFromText(text);
  const geneticResult=voiceHarvestGeneticFromText(text);
  const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
  const genetic=geneticResult.match;
  const wantsLast=text.includes('ultima cosecha')||text.includes('ultimo ciclo')||text.includes('cosecha mas reciente')||text.includes('ultima que se cosecho');
  const wantsTopGenetic=(text.includes('genetica')||text.includes('variedad'))&&(text.includes('mas produjo')||text.includes('produjo mas')||text.includes('mayor produccion')||text.includes('rindio mas'));
  const wantsDeviation=text.includes('desvio')||text.includes('respecto de la meta')||text.includes('contra la meta')||text.includes('sobre la meta');
  const wantsGoal=text.includes('meta')&&!wantsDeviation;

  let hs=state.cosechas.filter(h=>(!room||h.sala===room)&&(cycleNumber===null||Number(h.ciclo)===cycleNumber)&&(year===null||String(h.fecha).startsWith(String(year))));
  hs.sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))||Number(b.ciclo)-Number(a.ciclo));

  if(wantsLast){
    const h=hs[0]||null;
    if(!h)return {ok:true,message:`No encontré cosechas${room?` de ${room}`:''}${year?` en ${year}`:''}.`};
    const dev=harvestDeviation(h);
    return {ok:true,message:`La última cosecha${room?` de ${room}`:''} fue el ${parse(h.fecha).toLocaleDateString('es-AR')}, ciclo ${h.ciclo}: ${formatGrams(h.total_gramos)}${h.meta_gramos?`, meta ${formatGrams(h.meta_gramos)}`:''}${dev==null?'':`, desvío ${dev>=0?'+':''}${dev.toFixed(1)}%`}.`};
  }

  if((cycleNumber!==null||room)&&hs.length===1&&(wantsDeviation||wantsGoal)){
    const h=hs[0],dev=harvestDeviation(h);
    if(wantsGoal)return {ok:true,message:`La meta de ${h.sala}, ciclo ${h.ciclo}, fue ${h.meta_gramos?formatGrams(h.meta_gramos):'no registrada'}. La cosecha real fue ${formatGrams(h.total_gramos)}.`};
    return {ok:true,message:dev==null?`La cosecha de ${h.sala}, ciclo ${h.ciclo}, no tiene una meta registrada para calcular desvío.`:`${h.sala}, ciclo ${h.ciclo}: total ${formatGrams(h.total_gramos)}, meta ${formatGrams(h.meta_gramos)}, desvío ${dev>=0?'+':''}${dev.toFixed(1)}%.`};
  }

  if(wantsTopGenetic){
    if(!hs.length)return {ok:true,message:`No encontré cosechas con esos filtros.`};
    const ids=new Set(hs.map(h=>String(h.id))),totals=new Map();
    state.cosechaDetalles.filter(d=>ids.has(String(d.cosecha_id))).forEach(d=>{
      const name=harvestGeneticName(d);totals.set(name,(totals.get(name)||0)+(Number(d.gramos)||0));
    });
    const top=[...totals.entries()].sort((a,b)=>b[1]-a[1])[0];
    if(!top)return {ok:true,message:'Las cosechas encontradas no tienen desglose por genética cargado.'};
    const scope=[room,cycleNumber!==null?`ciclo ${cycleNumber}`:null,year].filter(Boolean).join(' · ');
    return {ok:true,message:`La genética con mayor producción${scope?` en ${scope}`:''} fue ${top[0]} con ${formatGrams(top[1])}.`};
  }

  if(genetic){
    if(!hs.length)return {ok:true,message:`No encontré cosechas${room?` de ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}${year?` en ${year}`:''}.`};
    const ids=new Set(hs.map(h=>String(h.id)));
    const rows=state.cosechaDetalles.filter(d=>ids.has(String(d.cosecha_id))&&voiceHarvestDetailMatches(d,genetic));
    const total=rows.reduce((sum,d)=>sum+(Number(d.gramos)||0),0);
    if(!rows.length)return {ok:true,message:`No encontré producción de ${genetic.label}${room?` en ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}${year?` durante ${year}`:''}.`};
    const byHarvest=rows.map(d=>{const h=state.cosechas.find(x=>String(x.id)===String(d.cosecha_id));return h?`${h.sala} ciclo ${h.ciclo}: ${formatGrams(d.gramos)}`:null}).filter(Boolean);
    return {ok:true,message:`Producción de ${genetic.label}${year?` en ${year}`:''}${room?` en ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}: ${formatGrams(total)}. ${voiceList(byHarvest,8)}.`};
  }

  if(!hs.length)return {ok:true,message:`No encontré cosechas${room?` de ${room}`:''}${cycleNumber!==null?` ciclo ${cycleNumber}`:''}${year?` en ${year}`:''}.`};

  if(hs.length===1){
    const h=hs[0],dev=harvestDeviation(h),details=harvestDetails(h.id).sort((a,b)=>(Number(b.gramos)||0)-(Number(a.gramos)||0));
    const geneticParts=details.slice(0,6).map(d=>`${harvestGeneticName(d)}: ${formatGrams(d.gramos)}`);
    return {ok:true,message:`${h.sala}, ciclo ${h.ciclo}, cosechado el ${parse(h.fecha).toLocaleDateString('es-AR')}: ${formatGrams(h.total_gramos)}${h.meta_gramos?`. Meta ${formatGrams(h.meta_gramos)}`:''}${dev==null?'':`. Desvío ${dev>=0?'+':''}${dev.toFixed(1)}%`}${geneticParts.length?`. ${voiceList(geneticParts,6)}`:''}.`};
  }

  const total=hs.reduce((sum,h)=>sum+(Number(h.total_gramos)||0),0);
  const scope=[room,year].filter(Boolean).join(' · ');
  const breakdown=hs.slice(0,8).map(voiceHarvestLabel);
  return {ok:true,message:`Encontré ${hs.length} cosecha${hs.length===1?'':'s'}${scope?` para ${scope}`:''}, con ${formatGrams(total)} en total. ${voiceList(breakdown,8)}.`};
}


function voiceGeneticFromText(text){
  return voiceGeneticResolver(text);
}
function voiceGeneticLabel(g){
  return g.nomenclatura?`${g.nombre} (${g.nomenclatura})`:g.nombre;
}
function executeVoiceGeneticQuery(rawText){
  const text=normalizeVoiceText(rawText);
  const geneticResult=voiceGeneticFromText(text);
  const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
  const genetic=geneticResult.match;
  const geneticWords=['genetica','geneticas','nomenclatura','linaje','cannabinoide','cannabinoides','indica','sativa','genotipo','variedad','variedades'];
  const looksLikeQuery=geneticWords.some(w=>text.includes(w))||Boolean(genetic);
  if(!looksLikeQuery)return null;

  // Evitamos tomar consultas ya pertenecientes al croquis o a cosechas.
  if(text.includes('cama')&&(text.includes('genetica')||text.includes('que hay')))return null;
  if((text.includes('produjo')||text.includes('produccion')||text.includes('cosecha'))&&(text.includes('genetica')||genetic))return null;

  const wantsActive=text.includes('activas')||text.includes('activa');
  const wantsArchived=text.includes('archivadas')||text.includes('archivada');
  const cannabinoidTokens=['thc','cbd','cbg'];
  const requestedCannabinoids=cannabinoidTokens.filter(c=>new RegExp(`(^|\\s)${c}(\\s|$)`).test(text));

  if(!genetic){
    let rows=[...state.geneticas];
    if(wantsActive)rows=rows.filter(g=>g.activa!==false);
    if(wantsArchived)rows=rows.filter(g=>g.activa===false);
    if(requestedCannabinoids.length){
      rows=rows.filter(g=>{const value=normalizeVoiceText(g.cannabinoides||'');return requestedCannabinoids.every(c=>value.includes(c));});
    }
    rows.sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es',{sensitivity:'base'}));
    if(!rows.length){
      const filter=[wantsActive?'activas':null,wantsArchived?'archivadas':null,requestedCannabinoids.length?`con ${requestedCannabinoids.join(' + ').toUpperCase()}`:null].filter(Boolean).join(' ');
      return {ok:true,message:`No encontré genéticas ${filter||'con esos filtros'}.`};
    }
    const labels=rows.map(voiceGeneticLabel);
    const scope=[wantsActive?'activas':null,wantsArchived?'archivadas':null,requestedCannabinoids.length?`con ${requestedCannabinoids.join(' + ').toUpperCase()}`:null].filter(Boolean).join(' ');
    return {ok:true,message:`Genéticas ${scope||'cargadas'}: ${voiceList(labels,12)}.`};
  }

  const g=genetic.genetic;
  const name=voiceGeneticLabel(g);
  if(text.includes('nomenclatura')||text.includes('codigo')||text.includes('abreviatura'))
    return {ok:true,message:`La nomenclatura de ${g.nombre} es ${g.nomenclatura||'no registrada'}.`};
  if(text.includes('linaje'))
    return {ok:true,message:`El linaje de ${name} es ${g.linaje||'no registrado'}.`};
  if(text.includes('cannabinoide')||text.includes('cannabinoides')||requestedCannabinoids.length)
    return {ok:true,message:`Los cannabinoides de ${name} son ${g.cannabinoides||'no registrados'}.`};
  if(text.includes('indica')||text.includes('sativa')||text.includes('genotipo'))
    return {ok:true,message:`El genotipo de ${name} es ${formatGenotype(g)}.`};
  if(text.includes('estado')||wantsActive||wantsArchived)
    return {ok:true,message:`${name} está ${g.activa===false?'archivada':'activa'}.`};

  const parts=[
    `nomenclatura ${g.nomenclatura||'no registrada'}`,
    `linaje ${g.linaje||'no registrado'}`,
    `cannabinoides ${g.cannabinoides||'no registrados'}`,
    `genotipo ${formatGenotype(g)}`,
    `estado ${g.activa===false?'archivada':'activa'}`
  ];
  return {ok:true,message:`${g.nombre}: ${parts.join('; ')}.`};
}

function executeVoiceRoomQuery(rawText){
  const text=normalizeVoiceText(rawText);
  const explicitRoom=voiceRoomFromText(text,{allowContext:false});
  const room=explicitRoom;
  const bedNumber=voiceBedNumberFromText(text);
  const floraRules=rules.filter(r=>r.type==='flora');

  const wantsBed=bedNumber!==null&&(text.includes('genetica')||text.includes('que hay')||text.includes('plantas hay')||text.includes('tiene la cama'));
  const wantsPlants=text.includes('cuantas plantas')||text.includes('cantidad de plantas');
  const wantsBeds=text.includes('cuantas camas')||text.includes('cantidad de camas');
  const wantsHarvest=text.includes('cuando')&&(text.includes('cosecha')||text.includes('cosechar'));
  const wantsFloraStart=text.includes('cuando')&&(text.includes('empieza flora')||text.includes('inicio flora')||text.includes('pasa a flora'));
  const wantsTransplant=text.includes('cuando')&&(text.includes('trasplante')||text.includes('entra a la sala'));
  const wantsStatus=text.includes('semana')||text.includes('ciclo')||text.includes('estado')||text.includes('en que esta')||text.includes('en que estan')||text.includes('como esta')||text.includes('como estan');
  const looksLikeRoomQuery=wantsBed||wantsPlants||wantsBeds||wantsHarvest||wantsFloraStart||wantsTransplant||wantsStatus;
  if(!looksLikeRoomQuery)return null;

  const selectedRules=room?[rr(room)].filter(Boolean):floraRules;
  if(room&&!selectedRules.length)return null;

  if(wantsBed){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no usa el croquis de camas de las salas de flora.`};
    const answers=targetRules.map(r=>voiceGeneticSummaryForBed(r.name,bedNumber).message);
    return {ok:true,message:answers.join(' ')};
  }

  if(wantsPlants){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no usa el croquis de plantas de las salas de flora.`};
    const answers=targetRules.map(r=>{
      const bs=beds(r.name),all=bs.flatMap(plants),occupied=all.filter(p=>p.ocupada),used=bs.filter(b=>plants(b).some(p=>p.ocupada)).length;
      return `${r.name}: ${occupied.length} planta${occupied.length===1?'':'s'} en ${used} de ${bs.length} camas`;
    });
    return {ok:true,message:`Actualmente, ${answers.join('; ')}.`};
  }

  if(wantsBeds){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no usa camas de las salas de flora.`};
    const answers=targetRules.map(r=>{
      const bs=beds(r.name),used=bs.filter(b=>plants(b).some(p=>p.ocupada)).length;
      return `${r.name}: ${bs.length} camas, ${used} con plantas`;
    });
    return {ok:true,message:answers.join('; ')+'.'};
  }

  const d=voiceDateFromText(text);
  if(wantsHarvest){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no tiene ciclos de cosecha de floración.`};
    const answers=targetRules.map(r=>{const h=voiceNextHarvestDate(r,today());return `${r.name}: ${nice(h)} (ciclo ${cycleNumber(r,h)})`;});
    return {ok:true,message:`Próxima cosecha programada: ${answers.join('; ')}.`};
  }
  if(wantsFloraStart){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no tiene inicio de floración por ciclo.`};
    const answers=targetRules.map(r=>{let fl=cycle(r,today()).fl;if(diff(today(),fl)>0)fl=add(fl,77);return `${r.name}: ${nice(fl)} (ciclo ${cycleNumber(r,fl)})`;});
    return {ok:true,message:`Próximo inicio de floración: ${answers.join('; ')}.`};
  }
  if(wantsTransplant){
    const targetRules=selectedRules.filter(r=>r.type==='flora');
    if(room&&targetRules.length===0)return {ok:true,message:`${room} no usa el trasplante cíclico de las salas de flora.`};
    const answers=targetRules.map(r=>{let tr=cycle(r,today()).tr;if(diff(today(),tr)>0)tr=add(tr,77);return `${r.name}: ${nice(tr)} (ciclo ${cycleNumber(r,tr)})`;});
    return {ok:true,message:`Próximo trasplante: ${answers.join('; ')}.`};
  }
  if(wantsStatus){
    const answers=selectedRules.map(r=>`${r.name}: ${roomStatus(r,d)}`);
    return {ok:true,message:`El ${nice(d)}, ${answers.join('; ')}.`};
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
function voiceTaskActionDate(){
  if(state.view==='today')return state.todayDay||today();
  if(state.view==='calendar'&&state.day)return state.day;
  return null;
}
function voiceEmployeesFromText(text){
  const scored=state.empleados.map(e=>({e,score:voiceEmployeeScore(text,e)})).filter(x=>x.score>=0.72).sort((a,b)=>b.score-a.score);
  // Un mismo fragmento no debería elegir dos personas casi idénticas. En caso de
  // duda dejamos que el usuario corrija responsables en el cuadro de confirmación.
  const selected=[];
  for(const item of scored){
    if(selected.some(x=>normalizeVoiceText(x.e.nombre)===normalizeVoiceText(item.e.nombre)))continue;
    selected.push(item);
  }
  return selected.map(x=>x.e);
}
function voiceTaskActionMatch(text,d,extraCommandWords=[]){
  const room=voiceRoomFromText(text,{allowContext:false});
  const pending=tasks(d).filter(t=>!done(t)&&(!room||t.room===room));
  if(!pending.length)return {matches:[],room};
  const commandWords=new Set(['completar','completa','complete','marcar','marca','como','hecha','hecho','realizada','realizado','terminar','termina','finalizar','finaliza','tarea','la','el','de','del','en','por','favor',...extraCommandWords]);
  const queryTokens=normalizeVoiceText(text).split(' ').filter(x=>x&&!commandWords.has(x)&&!/^flora$|^[123]$/.test(x));
  const scored=pending.map(t=>{
    const label=normalizeVoiceText(t.task||'');
    let score=0;
    if(label&&text.includes(label))score=1;
    else{
      const taskTokens=label.split(' ').filter(Boolean);
      if(taskTokens.length){
        const hits=taskTokens.filter(tok=>queryTokens.includes(tok)).length;
        score=Math.max(score,hits/taskTokens.length);
      }
      for(let size=Math.max(1,taskTokens.length-1);size<=Math.min(queryTokens.length,taskTokens.length+1);size++){
        for(let i=0;i+size<=queryTokens.length;i++)score=Math.max(score,voiceSimilarity(label,queryTokens.slice(i,i+size).join(' ')));
      }
    }
    return {task:t,score};
  }).filter(x=>x.score>=0.58).sort((a,b)=>b.score-a.score);
  if(!scored.length)return {matches:[],room};
  const best=scored[0].score;
  return {matches:scored.filter(x=>best-x.score<0.08).map(x=>x.task),room};
}

function voiceCreateTaskNameFromText(rawText){
  const text=normalizeVoiceText(rawText);
  const known=[
    ['calibrar riego','Calibrar riego'],['poda bajos','Poda bajos'],['inicio flora','Inicio flora'],
    ['fumigacion','Fumigacion'],['mantenimiento','Mantenimiento'],['enmienda','Enmienda'],
    ['trasplante','Trasplante'],['esquejes','Esquejes'],['schwazzing','Schwazzing'],
    ['redes','Redes'],['cosecha','Cosecha'],['riego','Riego'],['knf','KNF']
  ];
  for(const [key,label] of known)if(text.includes(key))return label;
  let candidate=text
    .replace(/\b(agregar|agrega|anadir|añadir|crear|crea|programar|programa|nueva|nuevo)\b/g,' ')
    .replace(/\b(tarea(s)?|general(es)?)\b/g,' ')
    .replace(/\b(hoy|ayer|anteayer|manana|pasado manana)\b/g,' ')
    .replace(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)( pasado| proximo| siguiente)?\b/g,' ')
    .replace(/\b(el|para|en|de|del|la|una|un)\b/g,' ')
    .replace(/flora\s*[123]|veges|madres|esquejes/g,' ')
    .replace(/\b\d{1,2}\s+de\s+[a-z]+(?:\s+de\s+20\d{2})?\b/g,' ')
    .replace(/\s+/g,' ').trim();
  if(!candidate)return '';
  return candidate.charAt(0).toUpperCase()+candidate.slice(1);
}
function executeVoiceCreateTaskAction(rawText){
  const text=normalizeVoiceText(rawText);
  const action=/(^|\s)(agregar|agrega|anadir|añadir|crear|crea|programar|programa|nueva tarea|nuevo tarea)(\s|$)/.test(text);
  if(!action)return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para crear tareas.'};

  const explicitGeneral=/\b(tarea\s+general|tareas\s+generales|general)\b/.test(text);
  if(explicitGeneral){
    if(state.view!=='today')return {ok:true,message:'Las tareas generales se administran desde Hoy. Abrí Hoy y repetí la orden para evitar crear algo en la sección equivocada.'};
    const name=voiceCreateTaskNameFromText(rawText);
    if(!name)return {ok:true,message:'Entendí que querés crear una tarea general, pero no pude identificar el nombre. Decime por ejemplo: “Crear tarea general revisar matafuegos”.'};
    openGeneralTask(null);
    $('general-task-name').value=name;
    return {ok:true,message:`Preparé la tarea general “${name}”. Revisá el nombre y el detalle y tocá Guardar para crearla.`};
  }

  if(!(state.view==='today'||state.view==='calendar'))return {ok:true,message:'Para crear una tarea por voz, abrí Hoy o Calendario. Las modificaciones se hacen desde la sección correspondiente para evitar errores.'};
  const room=voiceRoomFromText(text,{allowContext:false});
  if(!room)return {ok:true,message:'Entendí que querés crear una tarea, pero no indicaste una sala ni dijiste “tarea general”. Decime por ejemplo: “Agregar fumigación mañana en Flora 2” o “Crear tarea general revisar matafuegos”.'};
  const name=voiceCreateTaskNameFromText(rawText);
  if(!name)return {ok:true,message:'Entendí la sala, pero no pude identificar el nombre de la tarea. Decime por ejemplo: “Agregar limpieza mañana en Veges”.'};
  const d=voiceHasExplicitDate(text)?voiceDateFromText(text):(voiceTaskActionDate()||today());
  openTask(ymd(d),null,room);
  $('task-name').value=name;
  $('task-date').value=ymd(d);
  $('task-room').value=room;
  return {ok:true,message:`Preparé una nueva tarea “${name}” en ${room} para el ${nice(d)}. Revisá los datos y tocá Guardar para crearla.`};
}


function voiceReprogramTargetDate(rawText){
  const text=normalizeVoiceText(rawText);
  // Priorizamos la fecha que aparece después de "para", "al" o "a" porque
  // en órdenes como "reprogramar fumigación de hoy para mañana" esa es la fecha destino.
  const markers=[' para ',' al ',' a '];
  for(const marker of markers){
    const idx=text.lastIndexOf(marker);
    if(idx<0)continue;
    const tail=text.slice(idx+marker.length).trim();
    if(voiceHasExplicitDate(tail))return voiceDateFromText(tail);
  }
  // Si solo se mencionó una fecha, la tomamos como destino.
  return voiceHasExplicitDate(text)?voiceDateFromText(text):null;
}
function executeVoiceReprogramTaskAction(rawText){
  const text=normalizeVoiceText(rawText);
  const action=/(^|\s)(reprogramar|reprograma|mover|mueve|pasar|pasa|cambiar de dia|cambia de dia)(\s|$)/.test(text);
  if(!action)return null;
  if(!text.includes('tarea')&&!['riego','fumigacion','poda','enmienda','mantenimiento','calibrar','calibracion','schwazzing','redes','knf','esquejes','cosecha','trasplante'].some(w=>text.includes(w)))return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para reprogramar tareas.'};
  const sourceDate=voiceTaskActionDate();
  if(!sourceDate)return {ok:true,message:'Para reprogramar una tarea por voz, abrí Hoy o una fecha concreta del Calendario. Así Rainbows sabe qué día contiene la tarea que querés mover.'};
  const targetDate=voiceReprogramTargetDate(rawText);
  if(!targetDate)return {ok:true,message:'Entendí que querés reprogramar una tarea, pero no pude identificar la nueva fecha. Decime por ejemplo: “Reprogramar fumigación de Flora 2 para mañana”.'};
  if(same(sourceDate,targetDate))return {ok:true,message:`La nueva fecha que entendí es la misma que estás viendo: ${nice(sourceDate)}. Decime otra fecha para reprogramarla.`};
  const {matches}=voiceTaskActionMatch(text,sourceDate,['reprogramar','reprograma','mover','mueve','pasar','pasa','cambiar','cambia','dia','para','al','a']);
  if(!matches.length)return {ok:true,message:`No encontré una tarea pendiente que coincida con esa orden el ${nice(sourceDate)}.`};
  if(matches.length>1)return {ok:true,message:`Encontré más de una tarea posible el ${nice(sourceDate)}: ${voiceList(matches.map(voiceTaskLabel),6)}. Decime la tarea y la sala para evitar mover la equivocada.`};
  const task=matches[0];
  openTask(task.date||ymd(sourceDate),task);
  $('task-date').value=ymd(targetDate);
  return {ok:true,message:`Preparé para reprogramar ${task.task} de ${task.room} del ${nice(sourceDate)} al ${nice(targetDate)}. Revisá los datos y tocá Guardar para confirmar.`};
}
function executeVoiceCancelTaskAction(rawText){
  const text=normalizeVoiceText(rawText);
  const action=/(^|\s)(cancelar|cancela|cancelame|anular|anula)(\s|$)/.test(text);
  if(!action)return null;
  if(!text.includes('tarea')&&!['riego','fumigacion','poda','enmienda','mantenimiento','calibrar','calibracion','schwazzing','redes','knf','esquejes','cosecha','trasplante'].some(w=>text.includes(w)))return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para cancelar tareas.'};
  const d=voiceTaskActionDate();
  if(!d)return {ok:true,message:'Para cancelar una tarea por voz, abrí Hoy o una fecha concreta del Calendario. Las modificaciones se hacen desde la sección correspondiente para evitar errores.'};
  const spoken=voiceDateFromText(text);
  const hasDate=voiceHasExplicitDate(text);
  if(hasDate&&!same(spoken,d))return {ok:true,message:`Estás viendo ${nice(d)}, pero entendí una cancelación para ${nice(spoken)}. Abrí primero ese día y repetí la orden.`};
  const {matches}=voiceTaskActionMatch(text,d,['cancelar','cancela','cancelame','anular','anula']);
  if(!matches.length)return {ok:true,message:`No encontré una tarea pendiente que coincida con esa orden el ${nice(d)}.`};
  if(matches.length>1)return {ok:true,message:`Encontré más de una tarea posible el ${nice(d)}: ${voiceList(matches.map(voiceTaskLabel),6)}. Decime la tarea y la sala para evitar cancelar la equivocada.`};
  const task=matches[0];
  // Reutilizamos exactamente la confirmación y la lógica manual existentes.
  // No se modifica nada hasta que el usuario acepte el cuadro de confirmación.
  deleteTask(task).catch(error=>{console.error(error);alert(error.message||'No se pudo cancelar la tarea.');});
  return {ok:true,message:`Preparé la cancelación de ${task.task} de ${task.room} del ${nice(d)}. Confirmá el cuadro que aparece en pantalla para aplicar el cambio.`};
}

function executeVoiceTaskAction(rawText){
  const text=normalizeVoiceText(rawText);
  const action=/(^|\s)(completar|completa|complete|marcar como hecha|marcar como hecho|marcar realizada|marcar realizado|terminar|termina|finalizar|finaliza)(\s|$)/.test(text);
  if(!action)return null;
  if(!text.includes('tarea')&&!['riego','fumigacion','poda','enmienda','mantenimiento','calibrar','calibracion','schwazzing','redes','knf','esquejes'].some(w=>text.includes(w)))return null;
  if(!canComplete())return {ok:true,message:'Tu usuario no tiene permiso para completar tareas.'};
  const d=voiceTaskActionDate();
  if(!d)return {ok:true,message:'Para completar una tarea por voz, abrí Hoy o una fecha concreta del Calendario. Las modificaciones se hacen desde la sección correspondiente para evitar errores.'};
  const spoken=voiceDateFromText(text);
  const hasDate=/\b(hoy|ayer|anteayer|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|\d{1,2}\s+de\s+)/.test(text);
  if(hasDate&&!same(spoken,d))return {ok:true,message:`Estás viendo ${nice(d)}, pero entendí una orden para ${nice(spoken)}. Abrí primero ese día y volvé a dar la orden.`};
  const {matches}=voiceTaskActionMatch(text,d);
  if(!matches.length)return {ok:true,message:`No encontré una tarea pendiente que coincida con esa orden el ${nice(d)}.`};
  if(matches.length>1)return {ok:true,message:`Encontré más de una tarea posible el ${nice(d)}: ${voiceList(matches.map(voiceTaskLabel),6)}. Decime la tarea y la sala para evitar modificar la equivocada.`};
  const task=matches[0];
  const employees=voiceEmployeesFromText(text);
  openWorker(task,'dated',employees.map(e=>e.id));
  return {ok:true,message:`Preparé para completar ${task.task} de ${task.room} del ${nice(d)}${employees.length?` y seleccioné a ${voiceList(employees.map(e=>e.nombre),6)} como responsables`:''}. Revisá la confirmación y tocá Guardar para registrar el cambio.`};
}

// V3.16.12 — Modificaciones de Salas/croquis por voz.
// Las órdenes solo funcionan desde Salas y nunca escriben en Supabase sin una confirmación manual.
function voicePlantPositionFromText(text){
  const m=normalizeVoiceText(text).match(/(?:planta|posicion)\s*(?:numero\s*)?(\d{1,2})/);
  return m?Number(m[1]):null;
}
function voiceRoomActionLooksRelevant(rawText){
  const text=normalizeVoiceText(rawText);
  const hasTarget=text.includes('cama')||text.includes('planta')||text.includes('posicion');
  const hasAction=/(^|\s)(poner|pone|asignar|asigna|cambiar|cambia|modificar|modifica|vaciar|vacia|dejar vacia|dejar vacio)(\s|$)/.test(text);
  return hasTarget&&hasAction;
}
function executeVoiceRoomAction(rawText){
  const text=normalizeVoiceText(rawText);
  if(!voiceRoomActionLooksRelevant(rawText))return null;
  if(!canEditTasks())return {ok:true,message:'Tu usuario no tiene permiso para modificar el croquis.'};
  if(state.view!=='rooms')return {ok:true,message:'Para modificar el croquis por voz, abrí primero Salas. Así Rainbows mantiene los cambios dentro de la sección correcta.'};

  const roomName=voiceRoomFromText(text,{allowContext:true});
  if(!roomName)return {ok:true,message:'Entendí un cambio de croquis, pero me falta la sala. Decime por ejemplo: “En Flora 2 cama 4 poner Mandarin”.'};
  const roomRule=rr(roomName);
  if(!roomRule||roomRule.type!=='flora')return {ok:true,message:`${roomName} no usa el croquis de camas de las salas de flora.`};
  const bedNumber=voiceBedNumberFromText(text);
  if(bedNumber===null)return {ok:true,message:'Me falta el número de cama. Decime por ejemplo: “Cama 4 poner Mandarin”.'};
  const roomDb=sr(roomName);
  const bed=state.camas.find(c=>String(c.sala_id)===String(roomDb?.id)&&Number(c.numero)===Number(bedNumber));
  if(!bed)return {ok:true,message:`No encontré la cama ${bedNumber} de ${roomName}.`};
  const bedPlants=plants(bed);
  const plantPosition=voicePlantPositionFromText(text);
  const emptyAction=/(^|\s)(vaciar|vacia|dejar vacia|dejar vacio)(\s|$)/.test(text);

  // “Poner 5/9 plantas en cama X” modifica la capacidad de la cama, no inventa ocupación.
  const capacityMatch=text.match(/(?:poner|pone|cambiar|cambia|modificar|modifica)(?:\s+la)?(?:\s+capacidad)?(?:\s+a|\s+de)?\s*(5|9)\s*plantas?\b/);
  if(capacityMatch&&!plantPosition){
    const capacity=Number(capacityMatch[1]);
    openBed(bed.id);
    $('bed-capacity').value=String(capacity);
    return {ok:true,message:`Preparé la cama ${bedNumber} de ${roomName} con capacidad para ${capacity} plantas. Esto no ocupa ni vacía posiciones. Revisá el formulario y tocá Guardar.`};
  }

  if(plantPosition!==null){
    const plant=bedPlants.find(p=>Number(p.posicion)===Number(plantPosition));
    if(!plant)return {ok:true,message:`No encontré la posición ${plantPosition} en la cama ${bedNumber} de ${roomName}.`};
    if(emptyAction){
      openPlant(plant.id);
      $('plant-status').value='empty';
      $('plant-genetics').value='';
      return {ok:true,message:`Preparé para vaciar la planta ${plantPosition} de la cama ${bedNumber} de ${roomName}. Revisá el formulario y tocá Guardar.`};
    }
    const geneticResult=voiceGeneticResolver(text);
    const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
    const genetic=geneticResult.match?.genetic||null;
    if(!genetic)return {ok:true,message:'Entendí qué planta querés modificar, pero no pude identificar la genética. Decime el nombre o la nomenclatura.'};
    openPlant(plant.id);
    $('plant-status').value='occupied';
    $('plant-genetics').value=String(genetic.id);
    return {ok:true,message:`Preparé la planta ${plantPosition} de la cama ${bedNumber} de ${roomName} con ${genetic.nombre}. Revisá el formulario y tocá Guardar.`};
  }

  if(emptyAction){
    const occupied=bedPlants.filter(p=>p.ocupada);
    if(!occupied.length)return {ok:true,message:`La cama ${bedNumber} de ${roomName} ya está vacía.`};
    openVoiceRoomChange({
      type:'empty-bed',
      roomName,bedNumber,
      plantIds:bedPlants.map(p=>p.id),
      summary:`Vas a vaciar la cama ${bedNumber} de ${roomName}. Se marcarán como vacías sus ${occupied.length} planta${occupied.length===1?'':'s'} ocupada${occupied.length===1?'':'s'} y se quitarán sus genéticas. Nada cambia hasta que toques Confirmar.`
    });
    return {ok:true,message:`Preparé para vaciar la cama ${bedNumber} de ${roomName}. Confirmá el cuadro que aparece en pantalla para aplicar el cambio.`};
  }

  const geneticResult=voiceGeneticResolver(text);
  const ambiguity=voiceGeneticAmbiguityMessage(geneticResult);if(ambiguity)return {ok:true,message:ambiguity};
  const genetic=geneticResult.match?.genetic||null;
  if(!genetic)return {ok:true,message:'Entendí la cama que querés modificar, pero no pude identificar la genética. Decime el nombre o la nomenclatura.'};
  const occupied=bedPlants.filter(p=>p.ocupada);
  if(!occupied.length)return {ok:true,message:`La cama ${bedNumber} de ${roomName} está vacía. Para evitar inventar plantas, Rainbows no asignó ${genetic.nombre}.`};
  openVoiceRoomChange({
    type:'bed-genetic',
    roomName,bedNumber,
    geneticId:genetic.id,
    plantIds:occupied.map(p=>p.id),
    summary:`Vas a cambiar a ${genetic.nombre} la genética de las ${occupied.length} planta${occupied.length===1?'':'s'} ocupada${occupied.length===1?'':'s'} de la cama ${bedNumber} de ${roomName}. Las posiciones vacías no se modifican. Nada cambia hasta que toques Confirmar.`
  });
  return {ok:true,message:`Preparé el cambio de la cama ${bedNumber} de ${roomName} a ${genetic.nombre}. Confirmá el cuadro que aparece en pantalla para aplicarlo.`};
}

function executeGlobalVoiceQuery(rawText){
  // Toda consulta es global: no depende de la ventana activa.
  // Los futuros comandos que MODIFIQUEN datos se resolverán aparte y sí deberán
  // validar la sección activa antes de ofrecer una confirmación.
  const handlers=[executeVoiceTaskQuery,executeVoiceHarvestQuery,executeVoiceStockQuery,executeVoiceRoomQuery,executeVoiceGeneticQuery];
  for(const handler of handlers){
    const result=handler(rawText);
    if(result)return result;
  }
  return null;
}
function isExplicitVoiceNavigation(rawText){
  const text=normalizeVoiceText(rawText);
  // Los verbos explícitos de navegación tienen prioridad sobre las consultas.
  // Evitamos usar "mostrar" acá porque puede significar consulta (ej. "mostrar stock de Flora 1").
  const navVerb=/(^|\s)(ir a|abrir|abrime|entra a|entrar a|llevame a)(\s|$)/.test(text);
  if(!navVerb)return false;
  const destinations=['hoy','inicio','calendario','salas','sala','geneticas','genetica','cosechas','cosecha','stock palestina','stock','ayuda','instructivo','configuracion','config'];
  if(destinations.some(label=>text.includes(label)))return true;
  return /flora\s*(1|2|3)|veges|madres|esquejes/.test(text);
}
function executeVoiceCommand(rawText){
  if(isExplicitVoiceNavigation(rawText))return executeVoiceNavigation(rawText);
  const harvestAction=executeVoiceHarvestAction(rawText);
  if(harvestAction)return harvestAction;
  const stockMovementAction=executeVoiceStockMovementAction(rawText);
  if(stockMovementAction)return stockMovementAction;
  const roomAction=executeVoiceRoomAction(rawText);
  if(roomAction)return roomAction;
  const createTaskAction=executeVoiceCreateTaskAction(rawText);
  if(createTaskAction)return createTaskAction;
  const reprogramTaskAction=executeVoiceReprogramTaskAction(rawText);
  if(reprogramTaskAction)return reprogramTaskAction;
  const cancelTaskAction=executeVoiceCancelTaskAction(rawText);
  if(cancelTaskAction)return cancelTaskAction;
  const taskAction=executeVoiceTaskAction(rawText);
  if(taskAction)return taskAction;
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
    {view:'help',name:'Ayuda',labels:['ayuda','instructivo','comandos de voz']},
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
function stopVoiceGate({closeStream=false}={}){
  voiceGateWaiting=false;
  voiceGateAboveSince=0;
  if(voiceGateFrame){cancelAnimationFrame(voiceGateFrame);voiceGateFrame=null;}
  if(closeStream){
    if(voiceGateStream){for(const track of voiceGateStream.getTracks())track.stop();voiceGateStream=null;}
    if(voiceGateContext){try{voiceGateContext.close()}catch(_){} voiceGateContext=null;voiceGateAnalyser=null;}
  }
}
function isLikelyMobileVoiceDevice(){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'') || Math.min(window.innerWidth||9999,window.innerHeight||9999)<820;
}
function useMobileContinuousVoiceFilter(){
  return isLikelyMobileVoiceDevice() && voiceInputSensitivity!=='high';
}
function mobileVoiceLooksRelevant(rawText='',confidence=0){
  const text=normalizeVoiceText(rawText);
  if(!text||isVoiceStopCommand(text))return true;
  const harvestControlCommand=voiceHarvestDialogOpen()&&(
    /\b(quitar|quita|sacar|saca|borra|borrar|eliminar|elimina)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)||
    /\b(corregir|corregi|corrige|cambiar|cambia|modificar|modifica)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)
  );
  if(harvestControlCommand)return true;
  if(voiceHarvestFormPhraseLooksRelevant(rawText))return confidence===0||confidence>=0.24;
  if(voiceStockMovementFormPhraseLooksRelevant(rawText))return confidence===0||confidence>=0.24;
  if(state.view==='rooms'&&voiceRoomActionLooksRelevant(rawText))return confidence===0||confidence>=0.24;
  const words=text.split(/\s+/).filter(Boolean);
  if(words.length<2)return false;

  const domainTokens=[
    'tarea','tareas','pendiente','pendientes','realizada','realizadas','responsable','responsables',
    'flora','veges','madres','esquejes','stock','palestina','cosecha','cosechas','genetica','geneticas','calendario','salas','ayuda','config','configuracion',
    'cama','camas','planta','plantas','semana','ciclo','riego','fumigacion','poda','enmienda','mantenimiento','pesada','pesadas','pasada','pasadas','pesaje','pesajes',
    'medrano','consumo','descarte','nomenclatura','linaje','genotipo','cannabinoide','cannabinoides','thc','cbd','cbg'
  ];
  const intentTokens=[
    'abrir','abrime','entrar','llevame','mostrar','ir a','volver',
    'completar','crear','agregar','programar','reprogramar','mover','cancelar','anular','quitar','sacar','borrar','eliminar','corregir','cambiar','modificar',
    'cuando','cuanto','cuanta','cuantos','cuantas','quien','quienes','cual','cuales','que ','en que',
    'hizo','hicieron','queda','quedan','quedo','produjo','produccion','desvio','meta','salida','salidas','movimiento','movimientos'
  ];
  const temporalTokens=['hoy','ayer','manana','anteayer','pasado manana','lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const domainMatches=domainTokens.filter(token=>text.includes(token)).length;
  const hasIntent=intentTokens.some(token=>text.includes(token));
  const hasTemporal=temporalTokens.some(token=>text.includes(token));

  if(voiceInputSensitivity==='low'){
    // En móvil la escucha permanece abierta para no perder el inicio de la frase. Por eso
    // "Baja" filtra después de transcribir: exige una frase coherente, no una palabra suelta
    // captada desde lejos. Aceptamos intención + tema, o al menos dos señales claras del dominio.
    const exactShortCommand=[
      'abrir hoy','abrir inicio','abrir ayuda','abrir calendario','abrir salas','abrir cosechas','abrir stock','abrir geneticas','abrir configuracion',
      'ir a hoy','ir a inicio','ir a ayuda','ir a calendario','ir a salas','ir a cosechas','ir a stock','ir a geneticas','volver a hoy'
    ].some(command=>text===command);
    if(exactShortCommand)return true;
    if(words.length<3)return false;
    const coherent=(hasIntent&&domainMatches>=1)||(domainMatches>=2)||(domainMatches>=1&&hasTemporal&&words.length>=4);
    if(!coherent)return false;
    // Cuando Chrome informa una confianza real, usamos un piso algo mayor. Si devuelve 0,
    // cosa frecuente en Android, no bloqueamos por confianza para no rechazar frases correctas.
    return confidence===0||confidence>=0.32;
  }

  const hasDomain=domainMatches>0;
  return hasDomain||hasIntent||confidence>=0.48;
}
function mobileVoiceCandidateScore(rawText='',confidence=0){
  const text=normalizeVoiceText(rawText);
  if(!text)return -999;
  if(isVoiceStopCommand(text))return 100;
  const words=text.split(/\s+/).filter(Boolean);
  const exactCommands=[
    'abrir hoy','abrir inicio','abrir ayuda','abrir calendario','abrir salas','abrir cosechas','abrir stock','abrir geneticas','abrir configuracion',
    'ir a hoy','ir a inicio','ir a ayuda','ir a calendario','ir a salas','ir a cosechas','ir a stock','ir a geneticas','volver a hoy',
    'ir a manana','ir a ayer','dia anterior','dia siguiente'
  ];
  let score=exactCommands.includes(text)?30:0;
  const harvestControlCommand=voiceHarvestDialogOpen()&&(
    /\b(quitar|quita|sacar|saca|borra|borrar|eliminar|elimina)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)||
    /\b(corregir|corregi|corrige|cambiar|cambia|modificar|modifica)\s+(?:la\s+)?ultima\s+(?:pesada|pasada|pesaje|carga)\b/.test(text)
  );
  if(harvestControlCommand)score+=40;
  if(voiceHarvestFormPhraseLooksRelevant(rawText))score+=24;
  if(voiceStockMovementFormPhraseLooksRelevant(rawText))score+=24;
  if(state.view==='rooms'&&voiceRoomActionLooksRelevant(rawText))score+=24;
  const domainTokens=[
    'tarea','tareas','pendiente','pendientes','realizada','realizadas','responsable','responsables',
    'flora','veges','madres','esquejes','stock','palestina','cosecha','cosechas','genetica','geneticas','calendario','salas','ayuda','config','configuracion',
    'cama','camas','planta','plantas','semana','ciclo','riego','fumigacion','poda','enmienda','mantenimiento','pesada','pesadas','pasada','pasadas','pesaje','pesajes',
    'medrano','consumo','descarte','nomenclatura','linaje','genotipo','cannabinoide','cannabinoides','thc','cbd','cbg'
  ];
  const intentTokens=[
    'abrir','abrime','entrar','llevame','mostrar','ir a','volver','completar','crear','agregar','programar','reprogramar','mover','cancelar','anular','quitar','sacar','borrar','eliminar','corregir','cambiar','modificar',
    'cuando','cuanto','cuanta','cuantos','cuantas','quien','quienes','cual','cuales','que ','en que','hizo','hicieron','queda','quedan','quedo','produjo','produccion','desvio','meta'
  ];
  const temporalTokens=['hoy','ayer','manana','anteayer','pasado manana','lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  score+=domainTokens.filter(token=>text.includes(token)).length*4;
  if(intentTokens.some(token=>text.includes(token)))score+=4;
  if(temporalTokens.some(token=>text.includes(token)))score+=2;
  if(/\bflora\s*[123]\b/.test(text))score+=3;
  if(words.length>=2&&words.length<=10)score+=1;
  if(Number(confidence)>0)score+=Math.min(5,Number(confidence)*5);
  return score;
}
function voiceGateThreshold(){
  const mobile=isLikelyMobileVoiceDevice();
  if(voiceInputSensitivity==='low'){
    return mobile?Math.max(0.020,voiceGateAmbient*1.75+0.004):Math.max(0.045,voiceGateAmbient*2.6+0.010);
  }
  return mobile?Math.max(0.012,voiceGateAmbient*1.35+0.0025):Math.max(0.024,voiceGateAmbient*1.9+0.006);
}
function voiceGateSustainMs(){
  if(isLikelyMobileVoiceDevice())return voiceInputSensitivity==='low'?35:20;
  return voiceInputSensitivity==='low'?95:55;
}
async function ensureVoiceGate(){
  if(voiceGateAnalyser&&voiceGateStream)return true;
  if(!navigator.mediaDevices?.getUserMedia)return false;
  try{
    voiceGateStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return false;
    voiceGateContext=new AudioCtx();
    if(voiceGateContext.state==='suspended')await voiceGateContext.resume().catch(()=>{});
    const source=voiceGateContext.createMediaStreamSource(voiceGateStream);
    voiceGateAnalyser=voiceGateContext.createAnalyser();
    voiceGateAnalyser.fftSize=512;
    voiceGateAnalyser.smoothingTimeConstant=0.25;
    source.connect(voiceGateAnalyser);
    // Conservamos el piso de ruido aprendido entre frases. En móvil el stream
    // debe cerrarse antes de SpeechRecognition, pero recalibrar desde cero en
    // cada vuelta hacía lenta toda la experiencia.
    if(!voiceGateAmbientReady)voiceGateAmbient=0.012;
    return true;
  }catch(error){
    console.warn('No se pudo iniciar detector de voz',error);
    return false;
  }
}
function voiceGateRms(){
  if(!voiceGateAnalyser)return 0;
  const data=new Uint8Array(voiceGateAnalyser.fftSize);
  voiceGateAnalyser.getByteTimeDomainData(data);
  let sum=0;
  for(const v of data){const x=(v-128)/128;sum+=x*x;}
  return Math.sqrt(sum/data.length);
}
async function waitForVoiceActivity(){
  if(!voiceContinuousMode||voiceFatalError||voiceSpeaking||voiceListening)return;
  if(voiceInputSensitivity==='high'){scheduleVoiceRestart();return;}
  // En celular no usamos el gate previo de Web Audio: iniciar SpeechRecognition después
  // de detectar volumen recorta el comienzo de la frase y obliga a buscar el “timing”.
  // Mantenemos el reconocimiento listo y filtramos resultados dudosos después.
  if(useMobileContinuousVoiceFilter()){
    stopVoiceGate({closeStream:true});
    $('voice-status').textContent='Escuchando…';
    $('voice-transcript').textContent='Podés hablar cuando quieras.';
    beginVoiceRecognition({continuous:true,mobileFiltered:true});
    return;
  }
  const ready=await ensureVoiceGate();
  if(!ready){showVoicePanel('Escuchando…','No pude usar el filtro de ruido en este dispositivo; sigo con sensibilidad Alta.');scheduleVoiceRestart();return;}
  stopVoiceGate({closeStream:false});
  voiceGateWaiting=true;
  voiceGateAboveSince=0;
  const mobile=isLikelyMobileVoiceDevice();
  const calibrationMs=voiceGateAmbientReady?(mobile?35:90):(mobile?150:300);
  voiceGateCalibratingUntil=performance.now()+calibrationMs;
  $('voice-status').textContent='Esperando tu voz…';
  $('voice-transcript').textContent='El ruido ambiente no debería abrir una frase hasta que hables cerca del teléfono.';
  const tick=()=>{
    if(!voiceGateWaiting||!voiceContinuousMode||voiceSpeaking||voiceListening){voiceGateFrame=null;return;}
    const now=performance.now();
    const rms=voiceGateRms();
    const calibrating=now<voiceGateCalibratingUntil;
    if(!calibrating)voiceGateAmbientReady=true;
    const threshold=voiceGateThreshold();
    if(calibrating){
      voiceGateAmbient=voiceGateAmbient*0.88+rms*0.12;
      voiceGateAboveSince=0;
    }else if(rms>=threshold){
      if(!voiceGateAboveSince)voiceGateAboveSince=now;
      if(now-voiceGateAboveSince>=voiceGateSustainMs()){
        voiceGateWaiting=false;voiceGateAboveSince=0;voiceGateFrame=null;
        $('voice-status').textContent='Escuchando…';
        // En muchos móviles Web Audio y SpeechRecognition no pueden capturar el
        // micrófono al mismo tiempo. Soltamos el stream del detector antes de
        // iniciar el reconocimiento; en escritorio lo conservamos porque allí
        // la convivencia funciona bien y evita reabrir el micrófono cada frase.
        if(isLikelyMobileVoiceDevice()){
          stopVoiceGate({closeStream:true});
          setTimeout(()=>beginVoiceRecognition({continuous:true,gated:true}),10);
        }else{
          beginVoiceRecognition({continuous:true,gated:true});
        }
        return;
      }
    }else{
      voiceGateAboveSince=0;
      // Actualizamos lentamente el piso de ruido para adaptarnos a ventiladores constantes,
      // pero solo cuando estamos por debajo del umbral de activación.
      voiceGateAmbient=voiceGateAmbient*0.985+rms*0.015;
    }
    voiceGateFrame=requestAnimationFrame(tick);
  };
  voiceGateFrame=requestAnimationFrame(tick);
}
function setVoiceInputSensitivity(value='high'){
  const next=['high','normal','low'].includes(value)?value:'high';
  voiceInputSensitivity=next;
  localStorage.setItem('rainbows_voice_input_sensitivity',next);
  const select=$('help-voice-sensitivity');if(select)select.value=next;
  if(!voiceContinuousMode)return;
  if(voiceRecognition&&voiceListening){try{voiceRecognition.stop()}catch(_){} return;}
  stopVoiceGate({closeStream:next==='high'});
  if(next==='high')scheduleVoiceRestart();else waitForVoiceActivity();
}
function scheduleVoiceRestart(){
  if(!voiceContinuousMode||voiceFatalError||voiceRestartTimer||voiceSpeaking)return;
  if(useMobileContinuousVoiceFilter()){
    voiceRestartTimer=setTimeout(()=>{
      voiceRestartTimer=null;
      if(voiceContinuousMode&&!voiceListening)beginVoiceRecognition({continuous:true,mobileFiltered:true});
    },voiceInputSensitivity==='low'?7:12);
    return;
  }
  if(voiceInputSensitivity!=='high'){waitForVoiceActivity();return;}
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
  voiceRecognition.lang='es-AR';voiceRecognition.interimResults=true;voiceRecognition.continuous=false;voiceRecognition.maxAlternatives=options.mobileFiltered?3:1;
  // En Android, recognition.stop() puede tardar bastante en cerrar una sesión ya finalizada.
  // Para el modo móvil filtrado reciclamos con abort() DESPUÉS de recibir el resultado final:
  // el texto ya está capturado y el micrófono se libera mucho antes para la próxima frase.
  const sessionRecognition=voiceRecognition;
  let fastRecycle=false;
  const recycleMobileSession=()=>{
    if(!options.mobileFiltered)return;
    fastRecycle=true;
    try{
      if(typeof sessionRecognition.abort==='function')sessionRecognition.abort();
      else sessionRecognition.stop();
    }catch(_){try{sessionRecognition.stop()}catch(__){}}
  };
  voiceRecognition.onstart=()=>{
    voiceListening=true;
    if(continuous){voiceContinuousMode=true;setVoiceButtonActive(true);showVoicePanel('Escuchando…','Podés hablar cuando quieras.');}
  };
  voiceRecognition.onresult=event=>{
    let transcript='';let finalText='';let finalConfidence=0;
    for(let i=event.resultIndex;i<event.results.length;i++){
      const result=event.results[i];
      transcript+=result[0]?.transcript||'';
      if(result.isFinal){
        let bestText=result[0]?.transcript||'';
        let bestConfidence=Number(result[0]?.confidence)||0;
        if(options.mobileFiltered){
          let bestScore=mobileVoiceCandidateScore(bestText,bestConfidence);
          for(let j=1;j<Math.min(result.length,3);j++){
            const candidateText=result[j]?.transcript||'';
            const candidateConfidence=Number(result[j]?.confidence)||0;
            const candidateScore=mobileVoiceCandidateScore(candidateText,candidateConfidence);
            if(candidateScore>bestScore){bestText=candidateText;bestConfidence=candidateConfidence;bestScore=candidateScore;}
          }
        }
        finalText+=bestText;
        finalConfidence=Math.max(finalConfidence,bestConfidence);
      }
    }
    const interimLooksUseful=!options.mobileFiltered||voiceInputSensitivity!=='low'||mobileVoiceLooksRelevant(transcript,0);
    $('voice-transcript').textContent=transcript&&interimLooksUseful?`Escuché: “${transcript}”`:'Podés hablar cuando quieras.';
    if(finalText){
      const clean=finalText.trim();
      if(isVoiceStopCommand(clean)){
        $('voice-status').textContent='Micrófono apagado';$('voice-transcript').textContent='Listo. Dejé de escuchar.';
        stopVoiceRecognition({hidePanel:false,message:'Listo. Dejé de escuchar.'});
        return;
      }
      if(options.mobileFiltered&&!mobileVoiceLooksRelevant(clean,finalConfidence)){
        // Ruido o conversación lejana: se descarta y reciclamos esta sesión enseguida.
        // La siguiente escucha se abre automáticamente en onend, sin dejar al reconocedor
        // ocupado con una conversación de fondo durante varios segundos.
        $('voice-status').textContent='Escuchando…';
        $('voice-transcript').textContent='Podés hablar cuando quieras.';
        recycleMobileSession();
        return;
      }
      const result=executeVoiceCommand(clean);
      // En modo filtrado móvil, un resultado totalmente desconocido suele ser ruido o una
      // frase parcial. Lo ignoramos silenciosamente para que el usuario pueda seguir hablando
      // sin cancelar mensajes ni esperar reinicios.
      if(options.mobileFiltered&&result&&result.ok===false&&normalizeVoiceText(String(result.message||'')).includes('todavia no reconozco ese comando')){
        $('voice-status').textContent='Escuchando…';
        $('voice-transcript').textContent='Podés hablar cuando quieras.';
        recycleMobileSession();
        return;
      }
      $('voice-status').textContent=voiceContinuousMode?'Escuchando…':'Micrófono apagado';
      $('voice-transcript').textContent=voiceContinuousMode?'Podés decir otro comando.':'';
      showVoiceResponse(result.message);
      if(options.mobileFiltered&&!voiceSpeaking)recycleMobileSession();
    }
  };
  voiceRecognition.onerror=event=>{
    if(options.mobileFiltered&&fastRecycle&&event.error==='aborted'){
      $('voice-status').textContent='Escuchando…';
      $('voice-transcript').textContent='Podés hablar cuando quieras.';
      return;
    }
    const messages={'not-allowed':'No se concedió permiso para usar el micrófono.','service-not-allowed':'El navegador bloqueó el servicio de reconocimiento de voz.','no-speech':'No escuché ninguna instrucción. Sigo escuchando…','audio-capture':'No se encontró un micrófono disponible.','network':'El reconocimiento de voz no pudo conectarse.'};
    if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)){
      voiceFatalError=true;voiceContinuousMode=false;setVoiceButtonActive(false);
    }
    if(options.mobileFiltered&&event.error==='no-speech'&&voiceContinuousMode){
      $('voice-status').textContent='Escuchando…';
      $('voice-transcript').textContent='Podés hablar cuando quieras.';
      return;
    }
    showVoicePanel(event.error==='no-speech'&&voiceContinuousMode?'Escuchando…':'No se pudo escuchar',messages[event.error]||`Error de reconocimiento: ${event.error}.`);
  };
  voiceRecognition.onend=()=>{
    voiceListening=false;voiceRecognition=null;
      if(voiceContinuousMode&&!voiceFatalError&&!voiceSpeaking){setVoiceButtonActive(true);if(voiceInputSensitivity==='high'||useMobileContinuousVoiceFilter())scheduleVoiceRestart();else waitForVoiceActivity();}
      else if(voiceSpeaking){setVoiceButtonActive(true);}
    else{setVoiceButtonActive(false);}
  };
  try{voiceRecognition.start()}catch(error){console.error(error);voiceListening=false;if(continuous)scheduleVoiceRestart();else showVoicePanel('No se pudo iniciar','Cerrá cualquier otra escucha activa y probá nuevamente.');}
}
function startVoiceRecognition(){
  if(voiceContinuousMode||voiceListening||voiceGateWaiting){stopVoiceRecognition({hidePanel:false,message:'Micrófono cerrado. Tocá el botón cuando quieras volver a activarlo.'});return;}
  voiceContinuousMode=true;
  setVoiceButtonActive(true);
  const instant=voiceInputSensitivity==='high'||useMobileContinuousVoiceFilter();
  showVoicePanel(instant?'Escuchando…':'Preparando filtro de ruido…','Podés hablar cuando quieras.');
  if(voiceInputSensitivity==='high')beginVoiceRecognition({continuous:true});else waitForVoiceActivity();
}

$('voice-button')?.setAttribute('aria-pressed','false');
syncVoiceSpeechToggle();
refreshVoiceList();
if('speechSynthesis' in window)window.speechSynthesis.addEventListener?.('voiceschanged',()=>{refreshVoiceList();populateHelpVoiceSelect();});
$('voice-button')?.addEventListener('click',()=>startVoiceRecognition());
$('voice-retry')?.addEventListener('click',()=>{if(voiceContinuousMode)stopVoiceRecognition({hidePanel:false});startVoiceRecognition();});
$('voice-close')?.addEventListener('click',closeVoicePanel);
$('voice-speech-toggle')?.addEventListener('change',e=>{voiceSpeechEnabled=Boolean(e.target.checked);localStorage.setItem('rainbows_voice_speech',voiceSpeechEnabled?'1':'0');if(!voiceSpeechEnabled)stopVoiceSpeech();});
$('voice-cancel')?.addEventListener('click',closeVoicePanel);
$('voice-response-close')?.addEventListener('click',closeVoiceResponse);
$('voice-speech-stop')?.addEventListener('click',()=>stopVoiceSpeech({resume:true}));
if(!VoiceRecognition){const button=$('voice-button');if(button){button.classList.add('unsupported');button.title='Reconocimiento de voz no disponible en este navegador';}}

if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=3.16.13').catch(console.error));
}
