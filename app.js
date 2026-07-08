'use strict';

const APP_VERSION = '2.1.0';
const STORAGE_KEY = 'rainbows_os_task_completions_v2_1';
const CONFIG_KEY = 'rainbows_os_config_v2_1';

const employeesDefault = ['Demian', 'Empleado 1', 'Empleado 2', 'Empleado 3', 'Otro'];

// Fechas fijadas según lo confirmado en la conversación:
// 01/07/2026: Flora 1 y Flora 3 inician Flora S7. Flora 2 inicia Flora S1.
const rooms = [
  { name: 'Flora 1', type: 'flora', transplant: '2026-04-30', floraStart: '2026-05-20', automaticIrrigation: true },
  { name: 'Flora 2', type: 'flora', transplant: '2026-06-10', floraStart: '2026-07-01', automaticIrrigation: false },
  { name: 'Flora 3', type: 'flora', transplant: '2026-04-30', floraStart: '2026-05-20', automaticIrrigation: false },
  { name: 'Veges', type: 'vege' },
  { name: 'Madres', type: 'madres' }
];

const app = document.getElementById('app');
const title = document.getElementById('screen-title');
const todayLabel = document.getElementById('today-label');
const workerDialog = document.getElementById('worker-dialog');
const workerOptions = document.getElementById('worker-options');
const workerOther = document.getElementById('worker-other');
const confirmWorker = document.getElementById('confirm-worker');

let state = {
  view: 'today',
  selectedMonth: startOfMonth(today()),
  selectedRoom: null,
  pendingTask: null,
  selectedWorker: null
};

function today(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); x.setHours(0,0,0,0); return x; }
function diffDays(a,b){ return Math.round((startDay(a)-startDay(b))/86400000); }
function startDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function sameDay(a,b){ return ymd(a)===ymd(b); }
function dayName(d){ return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()]; }
function monthName(d){ return d.toLocaleDateString('es-AR',{month:'long',year:'numeric'}); }
function niceDate(d){ return d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }

function roomCycle(room, date){
  if(room.type !== 'flora') return { label:'Permanente', stage:'permanente', week:null, cycleStart:null, floraStart:null, dayInCycle:null };
  const baseTransplant = parseDate(room.transplant);
  const baseFloraStart = parseDate(room.floraStart);
  const cycleDays = 77;
  let cycles = Math.floor(diffDays(date, baseTransplant) / cycleDays);
  if (diffDays(date, baseTransplant) < 0) cycles = -1;
  const transplant = addDays(baseTransplant, cycles * cycleDays);
  const floraStart = addDays(baseFloraStart, cycles * cycleDays);
  const nextTransplant = addDays(transplant, cycleDays);
  const d = startDay(date);
  const dayInCycle = diffDays(d, transplant);
  if(dayInCycle < 0){ return { label:'Pendiente', stage:'pendiente', week:null, cycleStart:transplant, floraStart, dayInCycle }; }
  if(dayInCycle >= cycleDays){ return roomCycle(room, addDays(d, -cycleDays)); }
  if(sameDay(d, nextTransplant) || dayInCycle === cycleDays) return { label:'Trasplante', stage:'trasplante', week:1, cycleStart:transplant, floraStart, dayInCycle };
  if(diffDays(d, floraStart) < 0){
    const wk = Math.floor(dayInCycle / 7) + 1;
    return { label:`Vege S${Math.min(wk,3)}`, stage:'vege', week:Math.min(wk,3), cycleStart:transplant, floraStart, dayInCycle };
  }
  const floraDay = diffDays(d, floraStart);
  if(floraDay >= 56){
    return { label:'Cosecha / Trasplante', stage:'cosecha', week:8, cycleStart:transplant, floraStart, dayInCycle };
  }
  const wk = Math.floor(floraDay / 7) + 1;
  const prefix = floraDay % 7 === 0 ? 'Inicio Flora' : 'Flora';
  return { label:`${prefix} S${wk}`, stage:'flora', week:wk, cycleStart:transplant, floraStart, dayInCycle };
}

function isStartFloraWeek(room, date, week){
  const c = roomCycle(room, date);
  if(c.stage !== 'flora') return false;
  return c.week === week && diffDays(date, c.floraStart) % 7 === 0;
}
function isTransplantDay(room, date){
  const c = roomCycle(room, date);
  return room.type === 'flora' && diffDays(date, c.cycleStart) === 0;
}
function isHarvestDay(room, date){
  if(room.type !== 'flora') return false;
  const c = roomCycle(room, date);
  return diffDays(date, c.floraStart) === 56;
}

function getTasksForDate(date){
  const tasks=[];
  const dow = dayName(date);
  rooms.forEach(room => {
    const c = roomCycle(room,date);
    // Riego manual diario: todas salvo Flora 1, porque tiene riego automático.
    if(!(room.name === 'Flora 1' && room.automaticIrrigation)) addTask(tasks,date,room.name,'Riego','Riego diario manual');

    // Flora 1: calibrar riego en trasplante, inicio de flora e inicio Flora S7.
    if(room.name === 'Flora 1'){
      if(isTransplantDay(room,date)) addTask(tasks,date,room.name,'Calibrar riego','Trasplante / nuevo ciclo');
      if(isStartFloraWeek(room,date,1)) addTask(tasks,date,room.name,'Calibrar riego','Inicio Flora S1');
      if(isStartFloraWeek(room,date,7)) addTask(tasks,date,room.name,'Calibrar riego','Inicio Flora S7');
    }

    if(['lunes','miercoles','viernes'].includes(dow)){
      if(room.type === 'vege' || room.type === 'madres') addTask(tasks,date,room.name,'Fumigacion','Lunes, miércoles y viernes');
      if(room.type === 'flora' && (c.stage === 'vege' || (c.stage === 'flora' && c.week <= 3))) addTask(tasks,date,room.name,'Fumigacion','Flora hasta S3');
    }
    if(dow === 'jueves'){
      if(room.type === 'vege' || room.type === 'madres') addTask(tasks,date,room.name,'KNF','Jueves');
      if(room.type === 'flora' && (c.stage === 'vege' || (c.stage === 'flora' && c.week <= 6))) addTask(tasks,date,room.name,'KNF','Flora hasta S6');
    }
    if(room.type === 'flora'){
      if(isTransplantDay(room,date)) addTask(tasks,date,room.name,'Enmienda','Trasplante / inicio Vege S1');
      if(isStartFloraWeek(room,date,1)) addTask(tasks,date,room.name,'Enmienda','Inicio Flora S1');
      if(isStartFloraWeek(room,date,4)) addTask(tasks,date,room.name,'Enmienda','Inicio Flora S4');
      if(sameDay(date, addDays(c.floraStart,-1))){
        addTask(tasks,date,room.name,'Esquejes','Martes previo a floración');
        addTask(tasks,date,room.name,'Poda bajos','Martes previo a floración');
      }
      if(isStartFloraWeek(room,date,3)) addTask(tasks,date,room.name,'Schwazzing','Inicio Flora S3');
      if(sameDay(date, addDays(c.cycleStart,1))) addTask(tasks,date,room.name,'Redes','Día siguiente al trasplante');
      if(isTransplantDay(room,date)) addTask(tasks,date,room.name,'Trasplante','Nuevo ciclo');
      if(isStartFloraWeek(room,date,1)) addTask(tasks,date,room.name,'Inicio flora','Inicio Flora S1');
      if(isHarvestDay(room,date)) addTask(tasks,date,room.name,'Cosecha','Final Flora S8');
    }
  });
  return tasks;
}
function addTask(tasks,date,room,task,detail){ tasks.push({ id:`${ymd(date)}|${room}|${task}`, date:ymd(date), room, task, detail }); }

function loadCompletions(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function saveCompletions(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function isDone(task){ return Boolean(loadCompletions()[task.id]); }
function getCompletion(task){ return loadCompletions()[task.id] || null; }

function saveTaskCompletion(task, worker, observations=''){
  // Punto preparado para futura conexión con Google Sheets.
  const data = loadCompletions();
  data[task.id] = { ...task, status:'realizada', worker, observations, completedAt:new Date().toISOString(), appVersion:APP_VERSION };
  saveCompletions(data);
}
function removeTaskCompletion(task){ const data=loadCompletions(); delete data[task.id]; saveCompletions(data); }

function tasksByRoom(tasks){ return rooms.map(r => ({ room:r, tasks:tasks.filter(t => t.room === r.name) })).filter(g => g.tasks.length); }
function roomProgress(room,date){ const tasks = getTasksForDate(date).filter(t => t.room === room.name); const done = tasks.filter(isDone).length; return { total:tasks.length, done, pct: tasks.length ? Math.round(done/tasks.length*100) : 100 }; }

function render(){
  todayLabel.textContent = niceDate(today());
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  if(state.view === 'today') renderToday();
  if(state.view === 'calendar') renderCalendar();
  if(state.view === 'rooms') renderRooms();
  if(state.view === 'settings') renderSettings();
}

function renderToday(){
  title.textContent = 'Hoy';
  const d = today();
  const tasks = getTasksForDate(d);
  const done = tasks.filter(isDone).length;
  app.innerHTML = `
    <div class="panel"><strong>${done}/${tasks.length}</strong> tareas realizadas hoy</div>
    <div class="section-title">Estado de salas</div>
    <div class="grid">${rooms.map(room => {
      const c = roomCycle(room,d); const p = roomProgress(room,d);
      return `<section class="room-card" data-room="${room.name}"><div class="room-head"><div><div class="room-title">${room.name}</div><div class="stage">${c.label}</div></div><span class="pill">${p.done}/${p.total}</span></div><div class="progress"><span style="width:${p.pct}%"></span></div><div class="progress-text">${p.total ? `${p.pct}% completado` : 'Sin tareas hoy'}</div></section>`;
    }).join('')}</div>
    <div class="section-title">Tareas de hoy</div>
    ${renderTaskGroups(tasks)}
  `;
  bindTaskInputs();
  app.querySelectorAll('.room-card').forEach(el => el.addEventListener('click', () => { state.selectedRoom = el.dataset.room; state.view='rooms'; render(); }));
}

function renderTaskGroups(tasks){
  const groups = tasksByRoom(tasks);
  if(!groups.length) return '<div class="panel">No hay tareas para este día.</div>';
  return groups.map(g => `<section class="task-group"><h3>${g.room.name} <span class="stage">${roomCycle(g.room, parseDate(g.tasks[0].date)).label}</span></h3>${g.tasks.map(renderTaskRow).join('')}</section>`).join('');
}
function renderTaskRow(task){
  const done = isDone(task); const c = getCompletion(task);
  return `<div class="task-row ${done?'done':''}"><input type="checkbox" ${done?'checked':''} data-task-id="${task.id}"><label><strong>${task.task}</strong><div class="stage">${task.detail || ''}</div></label><div class="task-meta">${done ? `${c.worker}<br>${new Date(c.completedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : ''}</div></div>`;
}
function bindTaskInputs(){
  app.querySelectorAll('input[type="checkbox"][data-task-id]').forEach(input => input.addEventListener('change', e => {
    const tasks = getTasksForDate(currentRenderedDate());
    const task = tasks.find(t => t.id === input.dataset.taskId);
    if(!task) return;
    if(input.checked){ input.checked = false; openWorkerDialog(task); }
    else { removeTaskCompletion(task); render(); }
  }));
}
function currentRenderedDate(){ return state.view === 'calendar' && state.calendarDay ? state.calendarDay : today(); }

function openWorkerDialog(task){
  state.pendingTask = task; state.selectedWorker = null; workerOther.value = '';
  const config = loadConfig();
  workerOptions.innerHTML = config.employees.map(name => `<button type="button" data-worker="${name}">${name}</button>`).join('');
  workerOptions.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { state.selectedWorker = b.dataset.worker; workerOther.value = b.dataset.worker === 'Otro' ? '' : b.dataset.worker; }));
  workerDialog.showModal();
}
confirmWorker.addEventListener('click', (e) => {
  const task = state.pendingTask; if(!task) return;
  const worker = (workerOther.value || state.selectedWorker || '').trim();
  if(!worker){ e.preventDefault(); alert('Elegí o escribí quién realizó la tarea.'); return; }
  saveTaskCompletion(task, worker);
  state.pendingTask = null;
  setTimeout(render, 0);
});

function renderCalendar(){
  title.textContent = 'Calendario';
  const month = state.selectedMonth;
  const first = startOfMonth(month);
  const start = addDays(first, -((first.getDay()+6)%7)); // lunes
  const days = Array.from({length:42},(_,i)=>addDays(start,i));
  app.innerHTML = `<div class="toolbar"><button id="prev-month">‹</button><strong>${monthName(month)}</strong><button id="next-month">›</button></div><div class="calendar">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div class="dow">${d}</div>`).join('')}${days.map(renderDayCell).join('')}</div>`;
  document.getElementById('prev-month').onclick = () => { state.selectedMonth = new Date(month.getFullYear(), month.getMonth()-1, 1); render(); };
  document.getElementById('next-month').onclick = () => { state.selectedMonth = new Date(month.getFullYear(), month.getMonth()+1, 1); render(); };
}
function renderDayCell(d){
  const inMonth = d.getMonth() === state.selectedMonth.getMonth();
  const tasks = getTasksForDate(d);
  const summary = summarizeTasks(tasks);
  return `<div class="day-cell ${sameDay(d,today())?'today':''} ${inMonth?'':'dim'}"><div class="day-num">${d.getDate()}</div><div class="day-state">${rooms.filter(r=>r.type==='flora').map(r=>`${shortRoom(r.name)}: ${roomCycle(r,d).label.replace('Inicio ','')}`).join('<br>')}</div><div class="day-tasks">${summary}</div></div>`;
}
function summarizeTasks(tasks){
  const important = ['Trasplante','Inicio flora','Cosecha','Enmienda','Schwazzing','Esquejes','Poda bajos','Redes','Calibrar riego','KNF','Fumigacion','Riego'];
  const ordered = important.filter(t => tasks.some(x=>x.task===t));
  return ordered.slice(0,6).join('<br>');
}
function shortRoom(name){ return name.replace('Flora ','F'); }

function renderRooms(){
  title.textContent = 'Salas';
  const d = today();
  if(state.selectedRoom){
    const room = rooms.find(r=>r.name===state.selectedRoom);
    const c = roomCycle(room,d);
    app.innerHTML = `<button class="secondary" id="back-rooms">← Volver</button><section class="panel"><h2 class="room-detail-title">${room.name}</h2><p class="muted">${c.label}</p>${renderRoomFacts(room,d)}</section><div class="section-title">Tareas de hoy</div>${renderTaskGroups(getTasksForDate(d).filter(t=>t.room===room.name))}`;
    document.getElementById('back-rooms').onclick = () => { state.selectedRoom=null; render(); };
    bindTaskInputs(); return;
  }
  app.innerHTML = `<div class="list">${rooms.map(room => `<section class="room-card" data-room="${room.name}"><div class="room-head"><div><div class="room-title">${room.name}</div><div class="stage">${roomCycle(room,d).label}</div></div><span class="pill">Ver</span></div></section>`).join('')}</div>`;
  app.querySelectorAll('.room-card').forEach(el => el.addEventListener('click', () => { state.selectedRoom = el.dataset.room; render(); }));
}
function renderRoomFacts(room,d){
  if(room.type !== 'flora') return `<div class="kv"><span>Tipo</span><strong>${room.type}</strong></div><div class="kv"><span>Estado</span><strong>Permanente</strong></div>`;
  const c = roomCycle(room,d);
  const nexts = nextImportantDates(room,d).map(x=>`<div class="kv"><span>${x.name}</span><strong>${x.date.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})}</strong></div>`).join('');
  return `<div class="kv"><span>Trasplante ciclo</span><strong>${c.cycleStart.toLocaleDateString('es-AR')}</strong></div><div class="kv"><span>Inicio flora</span><strong>${c.floraStart.toLocaleDateString('es-AR')}</strong></div>${nexts}`;
}
function nextImportantDates(room,d){
  const c = roomCycle(room,d);
  const candidates = [
    {name:'Próxima enmienda', date:c.cycleStart},
    {name:'Inicio flora / enmienda', date:c.floraStart},
    {name:'Schwazzing', date:addDays(c.floraStart,14)},
    {name:'Enmienda Flora S4', date:addDays(c.floraStart,21)},
    {name:'Calibrar riego S7', date:addDays(c.floraStart,42)},
    {name:'Cosecha', date:addDays(c.floraStart,56)}
  ];
  return candidates.filter(x => diffDays(x.date,d) >= 0).slice(0,4);
}

function loadConfig(){ try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { employees: employeesDefault }; } catch { return { employees: employeesDefault }; } }
function saveConfig(config){ localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
function renderSettings(){
  title.textContent = 'Config';
  const config = loadConfig();
  app.innerHTML = `<section class="panel"><h3>Empleados V1</h3><p class="muted">Un nombre por línea. Se usa cuando se marca una tarea.</p><textarea id="employees" class="text-input" style="min-height:150px">${config.employees.join('\n')}</textarea><p><button id="save-config" class="primary">Guardar empleados</button></p></section><section class="panel"><h3>Versión</h3><p>Rainbows OS ${APP_VERSION}</p><p class="muted">Guardado local. Preparado para reemplazar saveTaskCompletion por Google Sheets.</p></section>`;
  document.getElementById('save-config').onclick = () => { const employees = document.getElementById('employees').value.split('\n').map(x=>x.trim()).filter(Boolean); saveConfig({employees}); alert('Configuración guardada.'); render(); };
}

document.querySelectorAll('.bottom-nav button').forEach(btn => btn.addEventListener('click', () => { state.view = btn.dataset.view; state.selectedRoom=null; render(); }));
if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=2.1').catch(()=>{})); }
render();
