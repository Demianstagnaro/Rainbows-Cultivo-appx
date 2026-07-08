/* Rainbows OS V2 - GitHub Pages / Vanilla JS / localStorage */
const MS_DAY = 86400000;
const STORAGE_KEY = 'rainbows_os_v2_completions';
const EMPLOYEES_KEY = 'rainbows_os_v2_employees';

const state = { view:'today', selectedDate: todayISO(), calendarDate: new Date(), pendingTask:null };

const rooms = [
  { name:'Flora 1', type:'flora', transplant:'2026-04-30', autoWater:true },
  { name:'Flora 2', type:'flora', transplant:'2026-06-10', autoWater:false },
  { name:'Flora 3', type:'flora', transplant:'2026-05-20', autoWater:false },
  { name:'Veges', type:'vege' },
  { name:'Madres', type:'madres' }
];

function defaultEmployees(){ return ['Demian','Empleado 1','Empleado 2','Empleado 3','Otro']; }
function getEmployees(){ return JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || JSON.stringify(defaultEmployees())); }
function setEmployees(list){ localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(list)); }
function getCompletions(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
function setCompletions(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function taskKey(dateISO, room, task){ return `${dateISO}__${room}__${task}`; }
function getCompletion(dateISO, room, task){ return getCompletions()[taskKey(dateISO, room, task)] || null; }
function saveTaskCompletion({dateISO, room, task, done, worker, notes=''}){
  // Punto preparado para reemplazar localStorage por Google Sheets más adelante.
  const data = getCompletions();
  const key = taskKey(dateISO, room, task);
  if(done){ data[key] = {done:true, worker, notes, doneAt:new Date().toISOString()}; }
  else { delete data[key]; }
  setCompletions(data);
}

function parseISO(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function toISO(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function todayISO(){ return toISO(new Date()); }
function addDays(date, n){ const d=new Date(date); d.setDate(d.getDate()+n); return d; }
function diffDays(a,b){ return Math.floor((parseISO(a)-parseISO(b))/MS_DAY); }
function dayName(dateISO){ return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][parseISO(dateISO).getDay()]; }
function prettyDate(dateISO){ return parseISO(dateISO).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }

function cycleInfo(room, dateISO){
  if(room.type !== 'flora') return {label: room.name, stage:'permanente', week:null, dayInCycle:null};
  const cycleLen = 77; // 11 semanas: 3 vegetación + 8 flora
  let day = diffDays(dateISO, room.transplant);
  day = ((day % cycleLen) + cycleLen) % cycleLen;
  const week = Math.floor(day/7) + 1;
  if(day < 21) return {stage:'vege', week, dayInCycle:day, label:`Vege S${week}`};
  const floraWeek = Math.floor((day-21)/7) + 1;
  return {stage:'flora', week:floraWeek, dayInCycle:day, label:`Flora S${floraWeek}`};
}
function isStartOfWeek(room, dateISO, stage, week){ const i=cycleInfo(room,dateISO); return i.stage===stage && i.week===week && i.dayInCycle % 7 === 0; }
function isTransplantDay(room,dateISO){ const i=cycleInfo(room,dateISO); return room.type==='flora' && i.dayInCycle===0; }
function isDayAfterTransplant(room,dateISO){ const i=cycleInfo(room,dateISO); return room.type==='flora' && i.dayInCycle===1; }
function isStartFlora(room,dateISO){ const i=cycleInfo(room,dateISO); return room.type==='flora' && i.dayInCycle===21; }
function isTuesdayBeforeFlora(room,dateISO){
  if(room.type !== 'flora') return false;
  const target = addDays(parseISO(dateISO), 1);
  return dayName(dateISO)==='martes' && isStartFlora(room, toISO(target));
}

function tasksForRoom(room, dateISO){
  const tasks=[]; const dname=dayName(dateISO); const info=cycleInfo(room,dateISO);
  const add=(name, kind='normal')=>tasks.push({room:room.name, task:name, kind});

  if(room.type==='flora'){
    if(isTransplantDay(room,dateISO)) { add('Trasplante','event'); add('Enmienda','important'); }
    if(isDayAfterTransplant(room,dateISO)) add('Redes','important');
    if(isTuesdayBeforeFlora(room,dateISO)) { add('Esquejes','important'); add('Poda bajos','important'); }
    if(isStartFlora(room,dateISO)) { add('Inicio flora','event'); add('Enmienda','important'); }
    if(isStartOfWeek(room,dateISO,'flora',3)) add('Schwazzing','important');
    if(isStartOfWeek(room,dateISO,'flora',4)) add('Enmienda','important');
    if(room.name==='Flora 1'){
      if(isTransplantDay(room,dateISO) || isStartFlora(room,dateISO) || isStartOfWeek(room,dateISO,'flora',7)) add('Calibrar riego','important');
    } else add('Riego');
    if(['lunes','miercoles','viernes'].includes(dname) && info.stage==='flora' && info.week<=3) add('Fumigacion');
    if(dname==='jueves' && info.stage==='flora' && info.week<=6) add('KNF');
  } else {
    add('Riego');
    if(['lunes','miercoles','viernes'].includes(dname)) add('Fumigacion');
    if(dname==='jueves') add('KNF');
  }
  return tasks;
}
function allTasks(dateISO){ return rooms.flatMap(r => tasksForRoom(r,dateISO)); }
function eventsForRoom(room,dateISO){ return tasksForRoom(room,dateISO).filter(t=>['event','important'].includes(t.kind)).map(t=>t.task); }
function progressForRoom(room,dateISO){
  const tasks=tasksForRoom(room,dateISO); const done=tasks.filter(t=>getCompletion(dateISO,t.room,t.task)?.done).length;
  return {total:tasks.length, done, pct:tasks.length ? Math.round(done/tasks.length*100) : 100};
}

function render(){
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===state.view));
  document.getElementById('today-label').textContent = prettyDate(state.selectedDate);
  const title = {today:'Hoy',calendar:'Calendario',rooms:'Salas',settings:'Configuración'}[state.view];
  document.getElementById('screen-title').textContent=title;
  if(state.view==='today') renderToday();
  if(state.view==='calendar') renderCalendar();
  if(state.view==='rooms') renderRooms();
  if(state.view==='settings') renderSettings();
}
function renderToday(){
  const app=document.getElementById('app'); const dateISO=state.selectedDate; const tasks=allTasks(dateISO);
  const done=tasks.filter(t=>getCompletion(dateISO,t.room,t.task)?.done).length;
  app.innerHTML = `<section class="summary"><div class="card"><div class="muted">Tareas</div><div class="big">${tasks.length}</div></div><div class="card"><div class="muted">Realizadas</div><div class="big">${done}</div></div><div class="card"><div class="muted">Pendientes</div><div class="big">${tasks.length-done}</div></div><div class="card"><div class="muted">Fecha</div><div class="big">${parseISO(dateISO).getDate()}</div></div></section><section class="grid rooms">${rooms.map(r=>roomCard(r,dateISO,true)).join('')}</section>`;
  bindTaskChecks();
}
function roomCard(room,dateISO,showTasks=false){
  const info=cycleInfo(room,dateISO); const progress=progressForRoom(room,dateISO); const tasks=tasksForRoom(room,dateISO);
  return `<article class="card"><div class="room-head"><div><div class="room-title">${room.name}</div><div class="stage">${info.label}${room.autoWater?' · riego automático':''}</div></div><span class="pill ${progress.total-progress.done?'important':''}">${progress.done}/${progress.total}</span></div><div class="progress-wrap"><div class="progress-meta"><span>Progreso</span><span>${progress.pct}%</span></div><div class="progress"><div class="progress-bar" style="width:${progress.pct}%"></div></div></div>${showTasks?`<div class="task-list">${tasks.map(t=>taskItem(t,dateISO)).join('') || '<p class="muted">Sin tareas para hoy.</p>'}</div>`:''}</article>`;
}
function taskItem(t,dateISO){
  const c=getCompletion(dateISO,t.room,t.task); const checked=c?.done?'checked':''; const done=c?.done?'done':'';
  const sub=c?.done ? `Hecha por ${escapeHtml(c.worker || 'sin nombre')} · ${new Date(c.doneAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : t.kind==='important'?'Tarea importante':t.kind==='event'?'Evento del ciclo':'Pendiente';
  return `<label class="task ${done}"><input type="checkbox" ${checked} data-date="${dateISO}" data-room="${escapeAttr(t.room)}" data-task="${escapeAttr(t.task)}"><div><div class="task-name">${t.task}</div><div class="task-sub">${sub}</div></div></label>`;
}
function renderCalendar(){
  const app=document.getElementById('app'); const base=new Date(state.calendarDate.getFullYear(),state.calendarDate.getMonth(),1);
  const monthLabel=base.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
  const firstDay=(base.getDay()+6)%7; const daysInMonth=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
  let cells=[]; for(let i=0;i<firstDay;i++) cells.push('<div class="day empty"></div>');
  for(let d=1; d<=daysInMonth; d++){
    const iso=toISO(new Date(base.getFullYear(),base.getMonth(),d)); const today=iso===todayISO()?'today':'';
    const roomLines=rooms.filter(r=>r.type==='flora').map(r=>`${r.name.replace('Flora ','F')}: ${cycleInfo(r,iso).label.replace('Flora ','Fl ')}`).join('<br>');
    const taskNames=[...new Set(allTasks(iso).map(t=>t.task))].slice(0,5).join(', ');
    cells.push(`<button class="day ${today}" data-date="${iso}"><div class="day-num">${d}</div><div class="day-lines">${roomLines}<div class="tasks">${taskNames}</div></div></button>`);
  }
  app.innerHTML=`<div class="toolbar"><button class="secondary" id="prev-month">Anterior</button><strong>${capitalize(monthLabel)}</strong><button class="secondary" id="next-month">Siguiente</button></div><div class="calendar"><div class="dow">Lun</div><div class="dow">Mar</div><div class="dow">Mié</div><div class="dow">Jue</div><div class="dow">Vie</div><div class="dow">Sáb</div><div class="dow">Dom</div>${cells.join('')}</div>`;
  document.getElementById('prev-month').onclick=()=>{state.calendarDate=new Date(base.getFullYear(),base.getMonth()-1,1);render();};
  document.getElementById('next-month').onclick=()=>{state.calendarDate=new Date(base.getFullYear(),base.getMonth()+1,1);render();};
  document.querySelectorAll('.day[data-date]').forEach(btn=>btn.onclick=()=>{state.selectedDate=btn.dataset.date; state.view='today'; render();});
}
function renderRooms(){
  const app=document.getElementById('app'); const dateISO=state.selectedDate;
  app.innerHTML=`<section class="grid rooms">${rooms.map(r=>`<article class="card room-detail">${roomCard(r,dateISO,false)}<h3>Próximas tareas</h3><div class="task-list">${nextTasks(r,dateISO).map(x=>`<div class="task"><div><div class="task-name">${x.task}</div><div class="task-sub">${prettyDate(x.date)}</div></div></div>`).join('')}</div></article>`).join('')}</section>`;
}
function nextTasks(room,fromISO){
  const out=[]; for(let i=0;i<80 && out.length<5;i++){ const iso=toISO(addDays(parseISO(fromISO),i)); const tasks=tasksForRoom(room,iso).filter(t=>t.kind==='important'||t.kind==='event'||t.task==='KNF'||t.task==='Fumigacion'); tasks.forEach(t=>out.push({date:iso,task:t.task})); }
  return out;
}
function renderSettings(){
  const employees=getEmployees();
  document.getElementById('app').innerHTML=`<section class="card"><h2>Empleados</h2><p class="muted">Un nombre por línea. Se usan al marcar tareas.</p><textarea id="employees-box" rows="7">${employees.join('\n')}</textarea><button class="primary" id="save-employees">Guardar empleados</button></section><section class="card"><h2>Datos locales</h2><p class="muted">Los checks de esta V1 se guardan en este navegador. Más adelante se conecta Google Sheets.</p><button class="secondary" id="clear-local">Borrar checks locales</button></section>`;
  document.getElementById('save-employees').onclick=()=>{setEmployees(document.getElementById('employees-box').value.split('\n').map(x=>x.trim()).filter(Boolean)); alert('Empleados guardados');};
  document.getElementById('clear-local').onclick=()=>{ if(confirm('¿Borrar todos los checks locales?')){ localStorage.removeItem(STORAGE_KEY); render(); }};
}
function bindTaskChecks(){ document.querySelectorAll('.task input[type=checkbox]').forEach(cb=>cb.onchange=(e)=>handleTaskToggle(e.target)); }
function handleTaskToggle(cb){
  const data={dateISO:cb.dataset.date, room:cb.dataset.room, task:cb.dataset.task};
  if(cb.checked){ state.pendingTask={...data, cb}; openWorkerDialog(); }
  else { saveTaskCompletion({...data, done:false}); render(); }
}
function openWorkerDialog(){
  const dialog=document.getElementById('worker-dialog'); const box=document.getElementById('worker-options'); const employees=getEmployees();
  box.innerHTML=employees.map((e,i)=>`<label><input type="radio" name="worker" value="${escapeAttr(e)}" ${i===0?'checked':''}> ${escapeHtml(e)}</label>`).join('');
  document.getElementById('worker-other').value=''; dialog.showModal();
}
document.getElementById('confirm-worker').addEventListener('click',(ev)=>{
  ev.preventDefault(); const pending=state.pendingTask; if(!pending) return;
  const selected=document.querySelector('input[name="worker"]:checked')?.value || ''; const other=document.getElementById('worker-other').value.trim(); const worker=other || selected;
  saveTaskCompletion({...pending, done:true, worker}); state.pendingTask=null; document.getElementById('worker-dialog').close(); render();
});
document.getElementById('worker-dialog').addEventListener('close',()=>{ if(state.pendingTask){ state.pendingTask.cb.checked=false; state.pendingTask=null; render(); }});
document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render();});
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,'&#39;'); }
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }
render();
