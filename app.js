// Rainbows OS V2.2
// App web/PWA sin dependencias. Estado local en localStorage.

const VERSION = '2.2.0';
const MS_DAY = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 77; // 3 semanas vege + 8 semanas flora

const ROOMS = [
  { name: 'Flora 1', type: 'flora', referenceDate: '2026-07-01', referenceCycleDay: 63, autoWater: true }, // Inicio Flora S7
  { name: 'Flora 2', type: 'flora', referenceDate: '2026-07-01', referenceCycleDay: 21, autoWater: false }, // Inicio Flora S1
  { name: 'Flora 3', type: 'flora', referenceDate: '2026-07-01', referenceCycleDay: 63, autoWater: false }, // Sincronizada con Flora 1
  { name: 'Veges', type: 'vege' },
  { name: 'Madres', type: 'madres' },
  { name: 'Esquejes', type: 'esquejes' },
];

const DEFAULT_WORKERS = ['Demian', 'Empleado 1', 'Empleado 2', 'Empleado 3', 'Otro'];
let currentView = 'today';
let calendarCursor = startOfMonth(todayLocal());
let pendingTask = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function dateKey(date){ return toLocalISO(date); }
function parseDate(str){ const [y,m,d] = str.split('-').map(Number); return new Date(y, m-1, d); }
function toLocalISO(date){ const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function todayLocal(){ const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(date, days){ const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function diffDays(a,b){ return Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate()) - new Date(b.getFullYear(),b.getMonth(),b.getDate())) / MS_DAY); }
function mod(n,m){ return ((n % m) + m) % m; }
function startOfMonth(date){ return new Date(date.getFullYear(), date.getMonth(), 1); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function dayName(date){ return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][date.getDay()]; }
function formatLong(date){ return new Intl.DateTimeFormat('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(date); }
function formatMonth(date){ return new Intl.DateTimeFormat('es-AR', { month:'long', year:'numeric' }).format(date); }

function getFloraState(room, date){
  const ref = parseDate(room.referenceDate);
  const delta = diffDays(date, ref);
  const cycleDay = mod(room.referenceCycleDay + delta, CYCLE_DAYS);
  let etapa, week, label, short;
  if (cycleDay < 21){
    etapa = 'vege';
    week = Math.floor(cycleDay/7)+1;
    label = `Vegetación - Semana ${week}`;
    short = `V S${week}`;
  } else {
    etapa = 'flora';
    week = Math.floor((cycleDay-21)/7)+1;
    label = `Floración - Semana ${week}`;
    short = `F S${week}`;
  }
  const dayInWeek = cycleDay % 7;
  return { cycleDay, etapa, week, label, short, dayInWeek, isWeekStart: dayInWeek === 0 };
}

function getRoomState(room, date){
  if (room.type === 'flora') return getFloraState(room, date);
  if (room.type === 'vege') return { etapa:'vege', week:null, label:'Sala de vegetación', short:'Veges' };
  if (room.type === 'madres') return { etapa:'madres', week:null, label:'Sala de madres', short:'Madres' };
  if (room.type === 'esquejes') return { etapa:'esquejes', week:null, label:'Sala de esquejes', short:'Esquejes' };
  return { etapa:'', week:null, label:'', short:'' };
}

function makeTask(room, name, type='operativa', important=false){
  return { id: `${dateKey(activeDate)}|${room.name}|${name}`, room: room.name, task: name, type, important };
}
let activeDate = todayLocal();

function tasksForDate(date){
  activeDate = date;
  const tasks = [];
  const dow = dayName(date);

  for (const room of ROOMS){
    const state = getRoomState(room, date);

    // Riego manual diario. Flora 1 tiene riego automático y no aparece como riego manual.
    if (!room.autoWater){
      tasks.push(makeTask(room, 'Riego', 'riego'));
    }

    // Calibración de riego automático de Flora 1.
    if (room.name === 'Flora 1'){
      if ([0, 21, 63].includes(state.cycleDay)){
        tasks.push(makeTask(room, 'Calibrar riego', 'riego', true));
      }
    }

    // Reglas para floras.
    if (room.type === 'flora'){
      const s = state;
      // Eventos de ciclo.
      if (s.cycleDay === 0) tasks.push(makeTask(room, 'Trasplante', 'evento', true));
      if (s.cycleDay === 21) tasks.push(makeTask(room, 'Inicio floración', 'evento', true));
      if (s.cycleDay === 76) tasks.push(makeTask(room, 'Cosecha', 'evento', true));

      // Enmiendas.
      if ([0, 21, 42].includes(s.cycleDay)) tasks.push(makeTask(room, 'Enmienda', 'enmienda', true));

      // Redes al día siguiente del trasplante.
      if (s.cycleDay === 1) tasks.push(makeTask(room, 'Colocar redes', 'redes', true));

      // Esquejes y poda bajos el martes previo al inicio de floración.
      if (s.cycleDay === 20 && dow === 'martes'){
        tasks.push(makeTask(room, 'Sacar esquejes', 'esquejes', true));
        tasks.push(makeTask(room, 'Poda bajos', 'poda', true));
      }

      // Schwazzing inicio Flora S3.
      if (s.cycleDay === 35) tasks.push(makeTask(room, 'Schwazzing', 'poda', true));

      // Fumigación: lunes, miércoles, viernes hasta Flora S3.
      if (['lunes','miercoles','viernes'].includes(dow) && s.etapa === 'flora' && s.week <= 3){
        tasks.push(makeTask(room, 'Fumigación', 'fumigacion'));
      }

      // KNF: jueves hasta Flora S6.
      if (dow === 'jueves' && s.etapa === 'flora' && s.week <= 6){
        tasks.push(makeTask(room, 'KNF', 'knf'));
      }
    }

    // Veges y Madres.
    if (['vege','madres'].includes(room.type)){
      if (['lunes','miercoles','viernes'].includes(dow)) tasks.push(makeTask(room, 'Fumigación', 'fumigacion'));
      if (dow === 'jueves') tasks.push(makeTask(room, 'KNF', 'knf'));
    }

    // Esquejes: por ahora solo riego diario. La sala se completa cuando se sacan esquejes de flora.
  }

  return tasks;
}

function storageKey(taskId){ return `rainbows:${VERSION}:task:${taskId}`; }
function getCompletion(taskId){ try { return JSON.parse(localStorage.getItem(storageKey(taskId)) || 'null'); } catch { return null; } }
function saveTaskCompletion(task, person, observations=''){
  const data = { taskId: task.id, fecha: dateKey(activeDate), sala: task.room, tarea: task.task, hecho_por: person, hecho_en: new Date().toISOString(), observaciones: observations };
  localStorage.setItem(storageKey(task.id), JSON.stringify(data));
  // Futuro: reemplazar este bloque por POST a Google Sheets / Apps Script.
  return data;
}
function clearTaskCompletion(task){ localStorage.removeItem(storageKey(task.id)); }

function workers(){
  const saved = localStorage.getItem('rainbows:workers');
  if (!saved) return DEFAULT_WORKERS;
  try { const arr = JSON.parse(saved); return Array.isArray(arr) && arr.length ? arr : DEFAULT_WORKERS; } catch { return DEFAULT_WORKERS; }
}
function saveWorkers(list){ localStorage.setItem('rainbows:workers', JSON.stringify(list)); }

function progressForRoom(roomName, date){
  const tasks = tasksForDate(date).filter(t => t.room === roomName);
  const done = tasks.filter(t => getCompletion(t.id)).length;
  return { total: tasks.length, done, pct: tasks.length ? Math.round(done/tasks.length*100) : 100 };
}

function render(){
  $('#todayText').textContent = formatLong(todayLocal());
  $$('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === currentView));
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#${currentView}View`).classList.add('active');
  if (currentView === 'today') renderToday();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'rooms') renderRooms();
  if (currentView === 'settings') renderSettings();
}

function renderToday(){
  const date = todayLocal();
  activeDate = date;
  const tasks = tasksForDate(date);
  const done = tasks.filter(t => getCompletion(t.id)).length;
  const pending = tasks.length - done;
  const byRoom = groupBy(tasks, 'room');
  const roomCards = ROOMS.map(room => roomCard(room, date, byRoom[room.name] || [])).join('');
  $('#todayView').innerHTML = `
    <div class="summary">
      <div class="panel"><div class="big">${tasks.length}</div><div class="muted">tareas</div></div>
      <div class="panel"><div class="big">${pending}</div><div class="muted">pendientes</div></div>
      <div class="panel"><div class="big">${done}</div><div class="muted">realizadas</div></div>
      <div class="panel"><div class="big">${VERSION}</div><div class="muted">versión</div></div>
    </div>
    <div class="grid rooms">${roomCards}</div>
  `;
  bindTaskEvents();
}

function roomCard(room, date, tasks){
  const state = getRoomState(room, date);
  const done = tasks.filter(t => getCompletion(t.id)).length;
  const pct = tasks.length ? Math.round(done/tasks.length*100) : 100;
  const labels = [];
  if (room.autoWater) labels.push('Riego automático');
  if (room.type === 'esquejes') labels.push('Enraizamiento');
  return `
    <article class="room-card">
      <div class="room-head">
        <div>
          <div class="room-title">${room.name}</div>
          <div class="room-stage">${state.label}</div>
        </div>
        ${labels.map(l => `<span class="badge">${l}</span>`).join('')}
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="progress-text">${done}/${tasks.length} tareas realizadas</div>
      <div class="task-list">
        ${tasks.length ? tasks.map(taskRow).join('') : '<p class="muted">Sin tareas operativas hoy.</p>'}
      </div>
    </article>
  `;
}

function taskRow(task){
  const completion = getCompletion(task.id);
  return `
    <label class="task-row ${completion ? 'done' : ''}" data-task-id="${escapeAttr(task.id)}">
      <input type="checkbox" ${completion ? 'checked' : ''} />
      <div class="task-main">
        <div class="task-name">${task.important ? 'Importante: ' : ''}${task.task}</div>
        <div class="task-meta">${task.room}${completion ? ` · Hecha por ${completion.hecho_por}` : ''}</div>
      </div>
    </label>
  `;
}

function renderCalendar(){
  const first = startOfMonth(calendarCursor);
  const start = addDays(first, -((first.getDay()+6)%7)); // lunes
  const days = Array.from({length:42}, (_,i)=>addDays(start,i));
  $('#calendarView').innerHTML = `
    <div class="calendar-controls">
      <button id="prevMonth">Anterior</button>
      <h2>${cap(formatMonth(first))}</h2>
      <button id="nextMonth">Siguiente</button>
    </div>
    <div class="calendar-grid">
      ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div class="dow">${d}</div>`).join('')}
      ${days.map(d => calendarDay(d, first)).join('')}
    </div>
  `;
  $('#prevMonth').onclick = () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth()-1, 1); renderCalendar(); };
  $('#nextMonth').onclick = () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth()+1, 1); renderCalendar(); };
}

function calendarDay(date, monthRef){
  const inMonth = date.getMonth() === monthRef.getMonth();
  const isToday = dateKey(date) === dateKey(todayLocal());
  const states = ROOMS.filter(r=>r.type==='flora').map(r => `${r.name.replace('Flora ','F')}: ${getRoomState(r,date).short}`).join('<br>');
  const tasks = tasksForDate(date);
  const important = tasks.filter(t=>t.important).map(t => `${t.task}: ${shortRoom(t.room)}`);
  const normal = summarizeTasks(tasks.filter(t=>!t.important));
  return `
    <div class="calendar-day ${inMonth?'':'out'} ${isToday?'today':''}">
      <div class="day-num">${date.getDate()}</div>
      <div class="day-state">${states}</div>
      <div class="day-items">
        ${important.length ? `<b>Eventos</b><br>${important.slice(0,4).join('<br>')}<br>` : ''}
        ${normal.length ? `<b>Tareas</b><br>${normal.join('<br>')}` : ''}
      </div>
    </div>`;
}

function summarizeTasks(tasks){
  const map = {};
  for (const t of tasks){ if (!map[t.task]) map[t.task] = []; map[t.task].push(shortRoom(t.room)); }
  return Object.entries(map).map(([task, rooms]) => `${task}: ${rooms.join(', ')}`).slice(0,5);
}
function shortRoom(name){ return name.replace('Flora ','F').replace('Veges','Veg').replace('Madres','Mad').replace('Esquejes','Esq'); }

function renderRooms(){
  const date = todayLocal();
  $('#roomsView').innerHTML = `
    <div id="roomsList" class="grid rooms">
      ${ROOMS.map(room => {
        const p = progressForRoom(room.name, date);
        const state = getRoomState(room, date);
        return `<button class="room-card room-button" data-room="${room.name}">
          <div class="room-head"><div><div class="room-title">${room.name}</div><div class="room-stage">${state.label}</div></div></div>
          <div class="progress"><span style="width:${p.pct}%"></span></div>
          <div class="progress-text">${p.done}/${p.total} tareas hoy</div>
        </button>`;
      }).join('')}
    </div>
    <div id="roomDetail" class="room-detail"></div>
  `;
  $$('.room-button').forEach(btn => btn.onclick = () => showRoomDetail(btn.dataset.room));
}

function showRoomDetail(roomName){
  const room = ROOMS.find(r=>r.name===roomName);
  const date = todayLocal();
  const state = getRoomState(room, date);
  const next = nextImportantEvents(room, date, 5);
  $('#roomsList').style.display = 'none';
  $('#roomDetail').classList.add('active');
  $('#roomDetail').innerHTML = `
    <button class="back secondary" id="backRooms">Volver</button>
    <article class="room-card">
      <div class="room-title">${room.name}</div>
      <div class="room-stage">${state.label}</div>
      ${room.autoWater ? '<p><span class="badge">Riego automático</span></p>' : ''}
      <div class="section-title">Tareas de hoy</div>
      <div class="task-list">${tasksForDate(date).filter(t=>t.room===room.name).map(taskRow).join('') || '<p class="muted">Sin tareas hoy.</p>'}</div>
      <div class="section-title">Próximos eventos</div>
      <div class="task-list">${next.map(e=>`<div class="task-row"><div class="task-main"><div class="task-name">${e.task}</div><div class="task-meta">${formatLong(e.date)}</div></div></div>`).join('')}</div>
    </article>
  `;
  $('#backRooms').onclick = () => { $('#roomDetail').classList.remove('active'); $('#roomsList').style.display = ''; };
  bindTaskEvents();
}

function nextImportantEvents(room, fromDate, limit){
  const events = [];
  for (let i=0;i<180 && events.length<limit;i++){
    const d = addDays(fromDate, i);
    for (const t of tasksForDate(d).filter(t=>t.room===room.name && t.important)){
      events.push({ date:d, task:t.task });
      if (events.length>=limit) break;
    }
  }
  return events;
}

function renderSettings(){
  const list = workers();
  $('#settingsView').innerHTML = `
    <article class="panel">
      <h2>Configuración</h2>
      <p class="muted">V1 guarda datos localmente en este navegador. Más adelante esta función se reemplaza por Google Sheets.</p>
      <div class="section-title">Empleados</div>
      <textarea id="workersInput">${list.join('\n')}</textarea>
      <button id="saveWorkers" class="primary">Guardar empleados</button>
      <div class="section-title">Datos locales</div>
      <button id="clearLocal" class="secondary">Borrar tareas marcadas en este dispositivo</button>
    </article>
  `;
  $('#saveWorkers').onclick = () => { saveWorkers($('#workersInput').value.split('\n').map(x=>x.trim()).filter(Boolean)); alert('Empleados guardados.'); renderSettings(); };
  $('#clearLocal').onclick = () => { if (confirm('¿Borrar todas las tareas marcadas en este dispositivo?')) { Object.keys(localStorage).filter(k=>k.startsWith('rainbows:')).forEach(k=>localStorage.removeItem(k)); render(); } };
}

function bindTaskEvents(){
  $$('.task-row input').forEach(input => {
    input.onchange = (ev) => {
      const row = ev.target.closest('.task-row');
      const taskId = row.dataset.taskId;
      const task = tasksForDate(activeDate).find(t=>t.id===taskId);
      if (!task) return;
      if (ev.target.checked){
        ev.preventDefault();
        ev.target.checked = false;
        pendingTask = task;
        openDoneDialog(task);
      } else {
        clearTaskCompletion(task);
        render();
      }
    };
  });
}

function openDoneDialog(task){
  $('#dialogTask').textContent = `${task.task} · ${task.room}`;
  $('#workerSelect').innerHTML = workers().map(w=>`<option value="${escapeAttr(w)}">${w}</option>`).join('');
  $('#obsInput').value = '';
  $('#doneDialog').showModal();
}

$('#confirmDoneBtn').addEventListener('click', (ev) => {
  ev.preventDefault();
  if (!pendingTask) return;
  saveTaskCompletion(pendingTask, $('#workerSelect').value, $('#obsInput').value);
  pendingTask = null;
  $('#doneDialog').close();
  render();
});

function groupBy(arr, key){ return arr.reduce((acc,x)=>{ const k=x[key]; (acc[k] ||= []).push(x); return acc; },{}); }
function escapeAttr(s){ return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

$$('.tab').forEach(btn => btn.onclick = () => { currentView = btn.dataset.view; render(); });

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt = null; $('#installBtn').classList.add('hidden'); };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

render();
