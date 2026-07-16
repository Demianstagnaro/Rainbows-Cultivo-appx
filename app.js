'use strict';

const APP_VERSION = '2.11.0';
const STORAGE_KEY = 'rainbows_os_task_completions_v2_3';
const CONFIG_KEY = 'rainbows_os_config_v2_4';
const CUSTOM_TASKS_KEY = 'rainbows_custom_tasks_v2_9';
const TASK_OVERRIDES_KEY = 'rainbows_task_overrides_v2_9';
const CROQUIS_KEY = 'rainbows_croquis_v2_11';

const employeesDefault = ['Cone', 'Chomi', 'Pata', 'Lua', 'Mar', 'Eric', 'Tortu'];

// Fechas fijadas según lo confirmado en la conversación:
// 01/07/2026: Flora 1 y Flora 3 inician Flora S7. Flora 2 inicia Flora S1.
const rooms = [
  { name: 'Flora 1', type: 'flora', transplant: '2026-04-30', floraStart: '2026-05-20', automaticIrrigation: true },
  { name: 'Flora 2', type: 'flora', transplant: '2026-06-10', floraStart: '2026-07-01', automaticIrrigation: false },
  { name: 'Flora 3', type: 'flora', transplant: '2026-04-30', floraStart: '2026-05-20', automaticIrrigation: false },
  { name: 'Veges', type: 'vege' },
  { name: 'Madres', type: 'madres' },
  { name: 'Esquejes', type: 'esquejes' }
];

const app = document.getElementById('app');
const title = document.getElementById('screen-title');
const todayLabel = document.getElementById('today-label');
const workerDialog = document.getElementById('worker-dialog');
const workerOptions = document.getElementById('worker-options');
const workerOther = document.getElementById('worker-other');
const confirmWorker = document.getElementById('confirm-worker');
const taskDialog = document.getElementById('task-dialog');
const taskDialogTitle = document.getElementById('task-dialog-title');
const taskDateInput = document.getElementById('task-date');
const taskRoomInput = document.getElementById('task-room');
const taskNameInput = document.getElementById('task-name');
const taskDetailInput = document.getElementById('task-detail');
const saveTaskButton = document.getElementById('save-task');
const cancelWorkerDialogButton = document.getElementById('cancel-worker-dialog');
const cancelTaskButton = document.getElementById('cancel-task-dialog');
const bedDialog = document.getElementById('bed-dialog');
const bedDialogTitle = document.getElementById('bed-dialog-title');
const bedCapacityInput = document.getElementById('bed-capacity');
const bedCountInput = document.getElementById('bed-count');
const bedGeneticsInput = document.getElementById('bed-genetics');
const bedNotesInput = document.getElementById('bed-notes');
const cancelBedDialogButton = document.getElementById('cancel-bed-dialog');
const saveBedButton = document.getElementById('save-bed');

let state = {
  view: 'today',
  selectedMonth: startOfMonth(today()),
  selectedRoom: null,
  selectedRoomTab: 'summary',
  selectedBed: null,
  calendarDay: null,
  pendingTask: null,
  editingTask: null,
  selectedWorkers: []
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

function cuttingRoomState(date){
  const d = startDay(date);
  const cycleDays = 77;

  // Los dos grupos productivos alternan el uso de Veges:
  // Grupo A: Flora 1 y Flora 3, sincronizadas.
  // Grupo B: Flora 2.
  const groups = [
    {
      id:'flora_1_3',
      destinations:['Flora 1','Flora 3'],
      baseFloraStart:parseDate('2026-05-20'),
      oppositeBaseFloraStart:parseDate('2026-07-01')
    },
    {
      id:'flora_2',
      destinations:['Flora 2'],
      baseFloraStart:parseDate('2026-07-01'),
      oppositeBaseFloraStart:parseDate('2026-05-20')
    }
  ];

  function nextOppositeHarvestAfter(intake, oppositeBaseFloraStart){
    const baseHarvest = addDays(oppositeBaseFloraStart, 56);
    let cycle = Math.floor(diffDays(intake, baseHarvest) / cycleDays);
    let harvest = addDays(baseHarvest, cycle * cycleDays);

    while(diffDays(harvest, intake) <= 0){
      cycle += 1;
      harvest = addDays(baseHarvest, cycle * cycleDays);
    }

    return harvest;
  }

  const activeBatches = [];

  groups.forEach(group => {
    const approxCycle = Math.floor(diffDays(d, group.baseFloraStart) / cycleDays);

    for(let offset = -2; offset <= 2; offset += 1){
      const floraStart = addDays(group.baseFloraStart, (approxCycle + offset) * cycleDays);
      const intake = addDays(floraStart, -1);
      const oppositeHarvest = nextOppositeHarvestAfter(intake, group.oppositeBaseFloraStart);
      const transferToVeges = addDays(oppositeHarvest, 2);

      // El día del traslado a Veges la sala ya queda vacía.
      if(diffDays(d, intake) >= 0 && diffDays(d, transferToVeges) < 0){
        activeBatches.push({
          destinations:group.destinations,
          intake,
          floraStart,
          oppositeHarvest,
          transferToVeges
        });
      }
    }
  });

  if(!activeBatches.length){
    return {
      active:false,
      label:'Vacía',
      day:null,
      destinations:[],
      sources:[],
      intake:null,
      transferToVeges:null
    };
  }

  activeBatches.sort((a,b) => b.intake.getTime() - a.intake.getTime());
  const batch = activeBatches[0];
  const day = diffDays(d, batch.intake) + 1;

  return {
    active:true,
    label:`Día ${day}`,
    day,
    destinations:batch.destinations,
    sources:batch.destinations,
    intake:batch.intake,
    floraStart:batch.floraStart,
    transferToVeges:batch.transferToVeges
  };
}

function roomCycle(room, date){
  if(room.type === 'esquejes'){
    const state = cuttingRoomState(date);
    return { label:state.label, stage:'esquejes', week:null, cycleStart:state.intake, floraStart:null, dayInCycle:state.day, cuttingState:state };
  }
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

function getRoutineTasksForDate(date){
  const tasks=[];
  const dow = dayName(date);
  rooms.forEach(room => {
    const c = roomCycle(room,date);
    // Riego manual diario: todas salvo Flora 1 y Esquejes.
    if(room.type !== 'esquejes' && !(room.name === 'Flora 1' && room.automaticIrrigation)){
      addTask(tasks,date,room.name,'Riego','Riego diario manual');
    }

    // Esquejes: por ahora solo mantenimiento durante los días en que la sala está ocupada.
    if(room.type === 'esquejes' && c.cuttingState?.active){
      addTask(tasks,date,room.name,'Mantenimiento',`${c.label} desde el ingreso`);
    }

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
function addTask(tasks,date,room,task,detail){
  tasks.push({
    id:`${ymd(date)}|${room}|${task}`,
    date:ymd(date),
    room,
    task,
    detail,
    category:'Rutina',
    custom:false
  });
}

function loadCustomTasks(){
  try { return JSON.parse(localStorage.getItem(CUSTOM_TASKS_KEY)) || []; }
  catch { return []; }
}
function saveCustomTasks(tasks){ localStorage.setItem(CUSTOM_TASKS_KEY, JSON.stringify(tasks)); }

function loadTaskOverrides(){
  try { return JSON.parse(localStorage.getItem(TASK_OVERRIDES_KEY)) || {}; }
  catch { return {}; }
}
function saveTaskOverrides(overrides){ localStorage.setItem(TASK_OVERRIDES_KEY, JSON.stringify(overrides)); }

function makeCustomTask({date, room, task, detail='', category='Extraordinaria', originTaskId=null, originDate=null}){
  return {
    id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    date,
    room,
    task,
    detail,
    category,
    custom:true,
    originTaskId,
    originDate
  };
}

function getTasksForDate(date){
  const day = ymd(startDay(date));
  const overrides = loadTaskOverrides();

  const routineTasks = getRoutineTasksForDate(date)
    .filter(task => !overrides[task.id]?.hidden);

  const customTasks = loadCustomTasks()
    .filter(task => task.date === day);

  return [...routineTasks, ...customTasks];
}

function addCustomTask(task){
  const tasks = loadCustomTasks();
  tasks.push(task);
  saveCustomTasks(tasks);
}

function updateCustomTask(taskId, changes){
  const tasks = loadCustomTasks();
  const index = tasks.findIndex(task => task.id === taskId);
  if(index < 0) return null;

  const previous = tasks[index];
  const updated = {...previous, ...changes};

  if(changes.date && changes.date !== previous.date){
    updated.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    transferCompletion(previous.id, updated.id, updated);
  }

  tasks[index] = updated;
  saveCustomTasks(tasks);
  return updated;
}

function removeCustomTask(taskId){
  const tasks = loadCustomTasks().filter(task => task.id !== taskId);
  saveCustomTasks(tasks);
  const completions = loadCompletions();
  delete completions[taskId];
  saveCompletions(completions);
}

function hideRoutineTask(task){
  const overrides = loadTaskOverrides();
  overrides[task.id] = {hidden:true, updatedAt:new Date().toISOString()};
  saveTaskOverrides(overrides);
}

function transferCompletion(oldId, newId, newTask){
  const completions = loadCompletions();
  if(!completions[oldId]) return;
  completions[newId] = {...completions[oldId], ...newTask, id:newId};
  delete completions[oldId];
  saveCompletions(completions);
}

function loadCompletions(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function saveCompletions(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function isDone(task){ return Boolean(loadCompletions()[task.id]); }
function getCompletion(task){ return loadCompletions()[task.id] || null; }

function saveTaskCompletion(task, workers, observations=''){
  // Punto preparado para futura conexión con Google Sheets.
  // Acepta una o varias personas y mantiene `worker` por compatibilidad con registros anteriores.
  const workerList = Array.isArray(workers) ? workers : [workers];
  const data = loadCompletions();
  data[task.id] = {
    ...task,
    status:'realizada',
    workers:workerList,
    worker:workerList.join(', '),
    observations,
    completedAt:new Date().toISOString(),
    appVersion:APP_VERSION
  };
  saveCompletions(data);
}
function removeTaskCompletion(task){ const data=loadCompletions(); delete data[task.id]; saveCompletions(data); }

function tasksByRoom(tasks){ return rooms.map(r => ({ room:r, tasks:tasks.filter(t => t.room === r.name) })).filter(g => g.tasks.length); }
function displayStage(room, date){
  const c = roomCycle(room, date);
  if(room.type === 'flora'){
    if(c.stage === 'flora') return `Floración - Semana ${c.week}`;
    if(c.stage === 'vege') return `Vegetación - Semana ${c.week}`;
    return c.label;
  }
  return c.label;
}
function compactStage(room, date){
  const c = roomCycle(room, date);
  if(room.type === 'flora' && (c.stage === 'flora' || c.stage === 'vege')) return `Semana ${c.week}`;
  return c.label;
}
function roomProgress(room,date){ const tasks = getTasksForDate(date).filter(t => t.room === room.name); const done = tasks.filter(isDone).length; return { total:tasks.length, done, pct: tasks.length ? Math.round(done/tasks.length*100) : 100 }; }

function render(){
  todayLabel.textContent = niceDate(today());
  document.querySelectorAll('.top-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
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
    <section class="panel daily-summary">
      <div class="daily-summary-head">
        <div><strong>${done}/${tasks.length}</strong> tareas realizadas hoy</div>
        <button class="primary compact-button" data-new-task="${ymd(d)}">+ Nueva tarea</button>
      </div>
      <div class="progress"><span style="width:${tasks.length ? Math.round(done/tasks.length*100) : 100}%"></span></div>
      <div class="progress-text">${tasks.length ? `${Math.round(done/tasks.length*100)}% completado` : 'Sin tareas hoy'}</div>
    </section>
    <div class="today-room-list">
      ${rooms.map(room => {
        const roomTasks = tasks.filter(task => task.room === room.name);
        const p = roomProgress(room,d);

        return `
          <section class="room-card today-room-card" data-room="${room.name}">
            <div class="room-head room-open-area">
              <div>
                <div class="room-title">${room.name}</div>
                <div class="stage">${compactStage(room,d)}</div>
              </div>
              <span class="pill">${p.done}/${p.total}</span>
            </div>

            <div class="progress"><span style="width:${p.pct}%"></span></div>
            <div class="progress-text">${p.total ? `${p.pct}% completado` : 'Sin tareas hoy'}</div>

            <div class="room-tasks">
              ${roomTasks.length
                ? roomTasks.map(renderTaskRow).join('')
                : '<div class="empty-room-tasks">Sin tareas programadas</div>'}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;

  bindTaskInputs();

  app.querySelectorAll('.today-room-card').forEach(card => {
    card.addEventListener('click', event => {
      if(event.target.closest('.task-row') || event.target.closest('input') || event.target.closest('button')) return;
      state.selectedRoom = card.dataset.room;
      state.view = 'rooms';
      render();
    });
  });
}

function renderTaskGroups(tasks){
  const groups = tasksByRoom(tasks);
  if(!groups.length) return '<div class="panel">No hay tareas para este día.</div>';
  return groups.map(g => `<section class="task-group"><h3>${g.room.name} <span class="stage">${displayStage(g.room, parseDate(g.tasks[0].date))}</span></h3>${g.tasks.map(renderTaskRow).join('')}</section>`).join('');
}
function renderTaskRow(task){
  const done = isDone(task);
  const c = getCompletion(task);
  const category = task.category || (task.custom ? 'Extraordinaria' : 'Rutina');

  return `
    <div class="task-row ${done?'done':''}" data-task-row="${task.id}">
      <input type="checkbox" ${done?'checked':''} data-task-id="${task.id}">
      <label>
        <strong>${task.task}</strong>
        <div class="task-subline">
          ${category === 'Extraordinaria' || category === 'Reprogramada'
            ? `<span class="task-category">${category}</span>`
            : ''}
          ${task.detail ? `<span class="stage">${task.detail}</span>` : ''}
        </div>
      </label>
      <div class="task-meta">
        ${done ? `${(c.workers || [c.worker]).filter(Boolean).join(', ')}<br>${new Date(c.completedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}` : ''}
      </div>
      <button type="button" class="task-menu" data-task-menu="${task.id}" aria-label="Opciones de tarea">⋮</button>
    </div>
  `;
}
function bindTaskInputs(){
  app.querySelectorAll('input[type="checkbox"][data-task-id]').forEach(input => input.addEventListener('change', () => {
    const tasks = getTasksForDate(currentRenderedDate());
    const task = tasks.find(item => item.id === input.dataset.taskId);
    if(!task) return;

    if(input.checked){
      input.checked = false;
      openWorkerDialog(task);
    } else {
      removeTaskCompletion(task);
      render();
    }
  }));

  app.querySelectorAll('[data-new-task]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openTaskDialog(null, button.dataset.newTask);
    });
  });

  app.querySelectorAll('[data-task-menu]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const task = getTasksForDate(currentRenderedDate()).find(item => item.id === button.dataset.taskMenu);
      if(task) openTaskActions(task);
    });
  });
}
function currentRenderedDate(){ return state.view === 'calendar' && state.calendarDay ? state.calendarDay : today(); }

function openTaskDialog(task=null, defaultDate=ymd(currentRenderedDate())){
  state.editingTask = task;
  taskDialogTitle.textContent = task ? 'Editar tarea' : 'Nueva tarea';
  taskDateInput.value = task?.date || defaultDate;
  taskRoomInput.innerHTML = rooms.map(room => `<option value="${room.name}">${room.name}</option>`).join('');
  taskRoomInput.value = task?.room || rooms[0].name;
  taskNameInput.value = task?.task || '';
  taskDetailInput.value = task?.detail || '';
  taskDialog.showModal();
}

cancelTaskButton.addEventListener('click', () => {
  state.editingTask = null;
  taskDialog.close();
});

saveTaskButton.addEventListener('click', event => {
  const date = taskDateInput.value;
  const room = taskRoomInput.value;
  const taskName = taskNameInput.value.trim();
  const detail = taskDetailInput.value.trim();

  if(!date || !room || !taskName){
    event.preventDefault();
    alert('Completá fecha, sala y tarea.');
    return;
  }

  const editing = state.editingTask;

  if(!editing){
    addCustomTask(makeCustomTask({
      date,
      room,
      task:taskName,
      detail,
      category:'Extraordinaria'
    }));
  } else if(editing.custom){
    updateCustomTask(editing.id, {
      date,
      room,
      task:taskName,
      detail
    });
  } else {
    hideRoutineTask(editing);
    const replacement = makeCustomTask({
      date,
      room,
      task:taskName,
      detail,
      category:'Rutina',
      originTaskId:editing.id,
      originDate:editing.date
    });
    addCustomTask(replacement);
    transferCompletion(editing.id, replacement.id, replacement);
  }

  state.editingTask = null;
  setTimeout(render, 0);
});

function openTaskActions(task){
  const action = prompt(
    `Tarea: ${task.task}\n\nEscribí una opción:\n1 = Editar\n2 = Mover\n3 = Eliminar`
  );

  if(action === null) return;

  const normalized = action.trim().toLowerCase();

  if(normalized === '1' || normalized === 'editar'){
    openTaskDialog(task, task.date);
    return;
  }

  if(normalized === '2' || normalized === 'mover'){
    moveTask(task);
    return;
  }

  if(normalized === '3' || normalized === 'eliminar' || normalized === 'borrar'){
    deleteTask(task);
    return;
  }

  alert('Opción no reconocida.');
}

function moveTask(task){
  const newDate = prompt('Nueva fecha (AAAA-MM-DD):', task.date);
  if(!newDate) return;

  if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)){
    alert('Usá el formato AAAA-MM-DD.');
    return;
  }

  if(newDate === task.date) return;

  if(task.custom){
    updateCustomTask(task.id, {
      date:newDate,
      category:'Reprogramada',
      originDate:task.originDate || task.date
    });
  } else {
    hideRoutineTask(task);
    const moved = makeCustomTask({
      date:newDate,
      room:task.room,
      task:task.task,
      detail:`Reprogramada desde ${task.date}${task.detail ? ` · ${task.detail}` : ''}`,
      category:'Reprogramada',
      originTaskId:task.id,
      originDate:task.date
    });
    addCustomTask(moved);
    transferCompletion(task.id, moved.id, moved);
  }

  render();
}

function deleteTask(task){
  if(!confirm(`¿Eliminar "${task.task}" de ${task.date}?`)) return;

  if(task.custom) removeCustomTask(task.id);
  else {
    hideRoutineTask(task);
    removeTaskCompletion(task);
  }

  render();
}

function openWorkerDialog(task){
  state.pendingTask = task;
  state.selectedWorkers = [];
  workerOther.value = '';

  const config = loadConfig();
  workerOptions.innerHTML = config.employees
    .map(name => `<button type="button" data-worker="${name}" aria-pressed="false">${name}</button>`)
    .join('');

  workerOptions.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      const worker = button.dataset.worker;
      const index = state.selectedWorkers.indexOf(worker);

      if(index >= 0){
        state.selectedWorkers.splice(index, 1);
        button.classList.remove('selected');
        button.setAttribute('aria-pressed', 'false');
      } else {
        state.selectedWorkers.push(worker);
        button.classList.add('selected');
        button.setAttribute('aria-pressed', 'true');
      }
    });
  });

  workerDialog.showModal();
}

confirmWorker.addEventListener('click', (e) => {
  const task = state.pendingTask;
  if(!task) return;

  const workers = [...state.selectedWorkers];
  const otherWorker = workerOther.value.trim();
  if(otherWorker) workers.push(otherWorker);

  const uniqueWorkers = [...new Set(workers)];
  if(!uniqueWorkers.length){
    e.preventDefault();
    alert('Elegí al menos una persona que realizó la tarea.');
    return;
  }

  saveTaskCompletion(task, uniqueWorkers);
  state.pendingTask = null;
  state.selectedWorkers = [];
  setTimeout(render, 0);
});

function renderCalendar(){
  title.textContent = 'Calendario';

  if(state.calendarDay){
    renderCalendarDayDetail(state.calendarDay);
    return;
  }

  const month = state.selectedMonth;
  const first = startOfMonth(month);
  const start = addDays(first, -((first.getDay()+6)%7)); // lunes
  const days = Array.from({length:42},(_,i)=>addDays(start,i));

  app.innerHTML = `
    <div class="toolbar">
      <button id="prev-month">‹</button>
      <strong>${monthName(month)}</strong>
      <button id="next-month">›</button>
    </div>
    <div class="calendar">
      ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div class="dow">${d}</div>`).join('')}
      ${days.map(renderDayCell).join('')}
    </div>
  `;

  document.getElementById('prev-month').onclick = () => {
    state.selectedMonth = new Date(month.getFullYear(), month.getMonth()-1, 1);
    render();
  };

  document.getElementById('next-month').onclick = () => {
    state.selectedMonth = new Date(month.getFullYear(), month.getMonth()+1, 1);
    render();
  };

  app.querySelectorAll('.day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      state.calendarDay = parseDate(cell.dataset.date);
      render();
    });
  });
}

function renderCalendarDayDetail(date){
  const d = startDay(date);
  const tasks = getTasksForDate(d);
  const done = tasks.filter(isDone).length;

  app.innerHTML = `
    <button class="secondary calendar-back" id="back-calendar">← Volver al calendario</button>
    <section class="panel calendar-day-heading">
      <div class="daily-summary-head">
        <div>
          <h2>${niceDate(d)}</h2>
          <div><strong>${done}/${tasks.length}</strong> tareas realizadas</div>
        </div>
        <button class="primary compact-button" data-new-task="${ymd(d)}">+ Nueva tarea</button>
      </div>
      <div class="progress"><span style="width:${tasks.length ? Math.round(done/tasks.length*100) : 100}%"></span></div>
      <div class="progress-text">${tasks.length ? `${Math.round(done/tasks.length*100)}% completado` : 'Sin tareas ese día'}</div>
    </section>

    <div class="today-room-list">
      ${rooms.map(room => {
        const roomTasks = tasks.filter(task => task.room === room.name);
        const p = roomProgress(room,d);

        return `
          <section class="room-card calendar-detail-card">
            <div class="room-head">
              <div>
                <div class="room-title">${room.name}</div>
                <div class="stage">${compactStage(room,d)}</div>
              </div>
              <span class="pill">${p.done}/${p.total}</span>
            </div>

            <div class="progress"><span style="width:${p.pct}%"></span></div>
            <div class="progress-text">${p.total ? `${p.pct}% completado` : 'Sin tareas ese día'}</div>

            <div class="room-tasks">
              ${roomTasks.length
                ? roomTasks.map(renderTaskRow).join('')
                : '<div class="empty-room-tasks">Sin tareas programadas</div>'}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('back-calendar').onclick = () => {
    state.calendarDay = null;
    render();
  };

  bindTaskInputs();
}

function renderDayCell(d){
  const inMonth = d.getMonth() === state.selectedMonth.getMonth();
  const tasks = getTasksForDate(d);
  const summary = summarizeTasks(tasks);
  const done = tasks.filter(isDone).length;

  return `
    <div class="day-cell ${sameDay(d,today())?'today':''} ${inMonth?'':'dim'}" data-date="${ymd(d)}">
      <div class="day-num">${d.getDate()}</div>
      <div class="day-state">
        ${rooms.filter(r=>r.type==='flora').map(r=>`${shortRoom(r.name)}: ${roomCycle(r,d).label.replace('Inicio ','')}`).join('<br>')}
      </div>
      <div class="day-tasks">${summary}</div>
      <div class="day-done">${done} hechas · ${Math.max(tasks.length - done, 0)} pendientes</div>
    </div>
  `;
}
function summarizeTasks(tasks){
  const important = ['Trasplante','Inicio flora','Cosecha','Enmienda','Schwazzing','Esquejes','Poda bajos','Redes','Calibrar riego','Mantenimiento','KNF','Fumigacion','Riego'];
  const ordered = important.filter(t => tasks.some(x=>x.task===t));
  return ordered.slice(0,6).join('<br>');
}
function shortRoom(name){ return name.replace('Flora ','F'); }


const croquisLayouts = {
  'Flora 1': {beds:15, columns:3, rows:5, exact:true, roomWidth:'6,35 m', roomLength:'8,30 m'},
  'Flora 2': {beds:15, columns:3, rows:5, exact:true, roomWidth:'6,35 m', roomLength:'8,30 m'},
  'Flora 3': {beds:8, columns:2, rows:4, exact:false, roomWidth:'', roomLength:''}
};

function defaultBed(roomName, index){
  return {
    id:`${roomName}-bed-${index + 1}`,
    number:index + 1,
    capacity:9,
    count:0,
    genetics:'',
    notes:''
  };
}

function loadCroquis(){
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(CROQUIS_KEY)) || {}; }
  catch { stored = {}; }

  Object.entries(croquisLayouts).forEach(([roomName, layout]) => {
    if(!Array.isArray(stored[roomName])) stored[roomName] = [];
    for(let index = 0; index < layout.beds; index += 1){
      if(!stored[roomName][index]){
        stored[roomName][index] = defaultBed(roomName, index);
      }
    }
    stored[roomName] = stored[roomName].slice(0, layout.beds);
  });

  return stored;
}

function saveCroquis(data){
  localStorage.setItem(CROQUIS_KEY, JSON.stringify(data));
}

function geneticsColor(value){
  if(!value) return 'var(--viz-empty-bed, #334155)';
  let hash = 0;
  for(let index = 0; index < value.length; index += 1){
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 48%)`;
}

function renderPlantPositions(bed){
  return Array.from({length:bed.capacity}, (_, index) => {
    const occupied = index < bed.count;
    const color = occupied ? geneticsColor(bed.genetics) : 'transparent';
    const title = occupied
      ? `${bed.genetics || 'Planta'} · posición ${index + 1}`
      : `Posición ${index + 1} vacía`;

    return `<span class="plant-position ${occupied?'occupied':''}" style="--plant-color:${color}" title="${title}"></span>`;
  }).join('');
}

function croquisSummary(roomName){
  const beds = loadCroquis()[roomName] || [];
  const total = beds.reduce((sum, bed) => sum + Number(bed.count || 0), 0);
  const capacity = beds.reduce((sum, bed) => sum + Number(bed.capacity || 0), 0);
  const genetics = {};

  beds.forEach(bed => {
    const name = bed.genetics.trim() || 'Sin identificar';
    if(bed.count > 0) genetics[name] = (genetics[name] || 0) + Number(bed.count);
  });

  return {beds, total, capacity, genetics};
}

function renderCroquis(room){
  const layout = croquisLayouts[room.name];
  if(!layout) return '<section class="panel">El croquis todavía no está configurado para esta sala.</section>';

  const summary = croquisSummary(room.name);
  const geneticsRows = Object.entries(summary.genetics)
    .map(([name, count]) => `<div class="genetics-row"><span><i style="background:${geneticsColor(name)}"></i>${name}</span><strong>${count}</strong></div>`)
    .join('');

  return `
    <section class="panel croquis-summary">
      <div class="croquis-metrics">
        <div><span>Plantas</span><strong>${summary.total}</strong></div>
        <div><span>Capacidad</span><strong>${summary.capacity}</strong></div>
        <div><span>Camas</span><strong>${layout.beds}</strong></div>
      </div>
      ${layout.exact
        ? `<p class="muted">Sala ${layout.roomWidth} × ${layout.roomLength}. Camas en 3 columnas × 5 filas, sin pasillos entre camas y con circulación lateral.</p>`
        : '<p class="muted">Disposición provisional de 2 × 4 hasta cargar el croquis real de Flora 3.</p>'}
      ${geneticsRows ? `<div class="genetics-summary">${geneticsRows}</div>` : '<p class="muted">Todavía no hay plantas cargadas.</p>'}
    </section>

    <section class="croquis-shell">
      <div class="side-aisle"><span>Pasillo lateral</span></div>
      <div class="beds-grid" style="--bed-columns:${layout.columns}">
        ${summary.beds.map(bed => `
          <button type="button" class="bed-card" data-bed-number="${bed.number}">
            <div class="bed-card-head">
              <strong>Cama ${String(bed.number).padStart(2,'0')}</strong>
              <span>${bed.count}/${bed.capacity}</span>
            </div>
            <div class="plant-grid ${bed.capacity === 5 ? 'five-plants' : 'nine-plants'}">
              ${renderPlantPositions(bed)}
            </div>
            <div class="bed-genetics">${bed.genetics || 'Sin genética'}</div>
          </button>
        `).join('')}
      </div>
      <div class="side-aisle"><span>Pasillo lateral</span></div>
    </section>
  `;
}

function openBedDialog(roomName, bedNumber){
  const data = loadCroquis();
  const bed = data[roomName][bedNumber - 1];

  state.selectedBed = {roomName, bedNumber};
  bedDialogTitle.textContent = `${roomName} · Cama ${String(bedNumber).padStart(2,'0')}`;
  bedCapacityInput.value = String(bed.capacity);
  bedCountInput.value = String(bed.count);
  bedCountInput.max = String(bed.capacity);
  bedGeneticsInput.value = bed.genetics;
  bedNotesInput.value = bed.notes;
  bedDialog.showModal();
}

bedCapacityInput.addEventListener('change', () => {
  bedCountInput.max = bedCapacityInput.value;
  if(Number(bedCountInput.value) > Number(bedCapacityInput.value)){
    bedCountInput.value = bedCapacityInput.value;
  }
});

cancelBedDialogButton.addEventListener('click', () => {
  state.selectedBed = null;
  bedDialog.close();
});

saveBedButton.addEventListener('click', event => {
  if(!state.selectedBed) return;

  const capacity = Number(bedCapacityInput.value);
  const count = Number(bedCountInput.value);

  if(!Number.isInteger(count) || count < 0 || count > capacity){
    event.preventDefault();
    alert(`La cantidad debe estar entre 0 y ${capacity}.`);
    return;
  }

  const data = loadCroquis();
  const {roomName, bedNumber} = state.selectedBed;
  data[roomName][bedNumber - 1] = {
    ...data[roomName][bedNumber - 1],
    capacity,
    count,
    genetics:bedGeneticsInput.value.trim(),
    notes:bedNotesInput.value.trim()
  };

  saveCroquis(data);
  state.selectedBed = null;
  setTimeout(render, 0);
});

function renderRooms(){
  title.textContent = 'Salas';
  const d = today();

  if(state.selectedRoom){
    const room = rooms.find(item => item.name === state.selectedRoom);
    const c = roomCycle(room,d);
    const hasCroquis = Boolean(croquisLayouts[room.name]);

    app.innerHTML = `
      <button class="secondary" id="back-rooms">← Volver</button>

      <section class="panel room-detail-header">
        <h2 class="room-detail-title">${room.name}</h2>
        <p class="muted">${c.label}</p>
      </section>

      ${hasCroquis ? `
        <div class="room-tabs">
          <button type="button" data-room-tab="summary" class="${state.selectedRoomTab === 'summary' ? 'active' : ''}">Resumen</button>
          <button type="button" data-room-tab="croquis" class="${state.selectedRoomTab === 'croquis' ? 'active' : ''}">Croquis</button>
        </div>
      ` : ''}

      ${state.selectedRoomTab === 'croquis' && hasCroquis
        ? renderCroquis(room)
        : `
          <section class="panel">${renderRoomFacts(room,d)}</section>
          <div class="section-title">Tareas de hoy</div>
          ${renderTaskGroups(getTasksForDate(d).filter(task => task.room === room.name))}
        `}
    `;

    document.getElementById('back-rooms').onclick = () => {
      state.selectedRoom = null;
      state.selectedRoomTab = 'summary';
      render();
    };

    app.querySelectorAll('[data-room-tab]').forEach(button => {
      button.addEventListener('click', () => {
        state.selectedRoomTab = button.dataset.roomTab;
        render();
      });
    });

    app.querySelectorAll('[data-bed-number]').forEach(button => {
      button.addEventListener('click', () => {
        openBedDialog(room.name, Number(button.dataset.bedNumber));
      });
    });

    bindTaskInputs();
    return;
  }

  app.innerHTML = `
    <div class="list">
      ${rooms.map(room => `
        <section class="room-card" data-room="${room.name}">
          <div class="room-head">
            <div>
              <div class="room-title">${room.name}</div>
              <div class="stage">${roomCycle(room,d).label}</div>
            </div>
            <span class="pill">Ver</span>
          </div>
        </section>
      `).join('')}
    </div>
  `;

  app.querySelectorAll('.room-card').forEach(element => {
    element.addEventListener('click', () => {
      state.selectedRoom = element.dataset.room;
      state.selectedRoomTab = 'summary';
      render();
    });
  });
}
function renderRoomFacts(room,d){
  if(room.type === 'esquejes'){
    const state = cuttingRoomState(d);
    if(!state.active){
      return `<div class="kv"><span>Estado</span><strong>Vacía</strong></div>`;
    }
    return `<div class="kv"><span>Estado</span><strong>${state.label}</strong></div><div class="kv"><span>Destino</span><strong>${(state.destinations || state.sources).join(', ')}</strong></div><div class="kv"><span>Pasa a Veges</span><strong>${state.transferToVeges.toLocaleDateString('es-AR')}</strong></div>`;
  }
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

document.querySelectorAll('.top-nav button').forEach(btn => btn.addEventListener('click', () => { state.view = btn.dataset.view; state.selectedRoom=null; render(); }));
if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=2.11').catch(()=>{})); }
render();
