const rooms = [
  { name: 'Flora 1', short: 'F1', firstFlowerStart: '2026-05-20' },
  { name: 'Flora 2', short: 'F2', firstFlowerStart: '2026-07-01' },
  { name: 'Flora 3', short: 'F3', firstFlowerStart: '2026-05-20' },
];

const cycleDays = 77;
const vegDays = 21;
const floraDays = 56;
const startMonth = new Date(2026, 6, 1); // julio 2026
const endMonth = new Date(2027, 5, 1);   // junio 2027
const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const weekDays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
let currentMonth = new Date(startMonth);
let selectedDateKey = null;

function parseLocal(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function daysBetween(a, b) {
  const ms = parseLocal(dateKey(a)) - parseLocal(dateKey(b));
  return Math.floor(ms / 86400000);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function mod(n, m) { return ((n % m) + m) % m; }
function isSameDate(a, b) { return dateKey(a) === dateKey(b); }
function getMondayIndex(date) { return (date.getDay() + 6) % 7; }
function noteKey(key) { return `rainbows_note_${key}`; }
function getNote(key) { return localStorage.getItem(noteKey(key)) || ''; }
function setNote(key, value) { localStorage.setItem(noteKey(key), value); }

function roomInfo(room, date) {
  const firstFlower = parseLocal(room.firstFlowerStart);
  const deltaFlower = daysBetween(date, firstFlower);
  const cyclePosFromFlower = mod(deltaFlower, cycleDays);
  const transplantDate = addDays(firstFlower, -vegDays + Math.floor((deltaFlower + vegDays) / cycleDays) * cycleDays);
  let pos = daysBetween(date, transplantDate);
  pos = mod(pos, cycleDays);
  const currentFlowerStart = addDays(transplantDate, vegDays);
  const nextFlowerStart = pos < vegDays ? currentFlowerStart : addDays(currentFlowerStart, cycleDays);

  let state;
  let vegWeek = null;
  let floraWeek = null;
  if (pos < vegDays) {
    vegWeek = Math.floor(pos / 7) + 1;
    state = pos === 0 ? 'Inicio V S1' : `V S${vegWeek}`;
  } else {
    const fpos = pos - vegDays;
    floraWeek = Math.floor(fpos / 7) + 1;
    state = fpos === 0 ? 'Inicio Flora S1' : `Flora S${floraWeek}`;
  }

  return { room, pos, state, vegWeek, floraWeek, transplantDate, currentFlowerStart, nextFlowerStart };
}

function buildDay(date) {
  const infos = rooms.map(r => roomInfo(r, date));
  const events = [];
  const tasks = [];
  const dow = date.getDay(); // 0 domingo, 1 lunes...

  for (const info of infos) {
    const r = info.room;
    if (info.pos === 0) {
      events.push(`Cosecha/Trasplante: ${r.short}`);
      tasks.push(`Enmienda: ${r.short}`);
    }
    if (info.pos === 1) tasks.push(`Redes: ${r.short}`);
    if (isSameDate(date, info.currentFlowerStart)) {
      events.push(`Inicio Flora: ${r.short}`);
      tasks.push(`Enmienda: ${r.short}`);
    }
    if (isSameDate(date, addDays(info.currentFlowerStart, -1)) && dow === 2) {
      tasks.push(`Esquejes: ${r.short}`);
      tasks.push(`Poda bajos: ${r.short}`);
    }
    if (isSameDate(date, addDays(info.currentFlowerStart, 14))) tasks.push(`Schwazzing: ${r.short}`);
    if (isSameDate(date, addDays(info.currentFlowerStart, 21))) tasks.push(`Enmienda: ${r.short}`);
  }

  // KNF jueves: Veg/Mad siempre; salas de flora en V o hasta Flora S6.
  if (dow === 4) {
    const knfRooms = infos
      .filter(i => i.vegWeek !== null || (i.floraWeek !== null && i.floraWeek <= 6))
      .map(i => i.room.short);
    knfRooms.push('Veg', 'Mad');
    tasks.push(`KNF: ${knfRooms.join(', ')}`);
  }

  // Fum lunes, miércoles, viernes: Veg/Mad siempre; salas de flora en V o hasta Flora S3.
  if ([1,3,5].includes(dow)) {
    const fumRooms = infos
      .filter(i => i.vegWeek !== null || (i.floraWeek !== null && i.floraWeek <= 3))
      .map(i => i.room.short);
    fumRooms.push('Veg', 'Mad');
    tasks.push(`Fum: ${fumRooms.join(', ')}`);
  }

  tasks.push('Riego: Todas');

  return { infos, events: unique(events), tasks: unique(tasks) };
}
function unique(arr) { return [...new Set(arr)]; }

function renderMonth() {
  const title = document.getElementById('monthTitle');
  const cal = document.getElementById('calendar');
  title.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  cal.innerHTML = '';

  for (const wd of weekDays) {
    const el = document.createElement('div');
    el.className = 'weekday';
    el.textContent = wd;
    cal.appendChild(el);
  }

  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const last = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const blanks = getMondayIndex(first);
  for (let i = 0; i < blanks; i++) {
    const blank = document.createElement('div');
    blank.className = 'day empty';
    cal.appendChild(blank);
  }

  const today = new Date();
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
    const key = dateKey(date);
    const data = buildDay(date);
    const note = getNote(key);
    const cell = document.createElement('article');
    cell.className = 'day';
    if (isSameDate(date, today)) cell.classList.add('today');
    if (note.trim()) cell.classList.add('has-note');

    const states = data.infos.map(i => `${i.room.name}: ${i.state}`).join('\n');
    const events = data.events.length ? `\n\nEVENTOS\n${data.events.map(e => `• ${e}`).join('\n')}` : '';
    const tasks = `\n\nTAREAS\n${data.tasks.map(t => `• ${t}`).join('\n')}`;
    const noteLine = note.trim() ? `\n\nNOTA\n${note.trim().slice(0, 90)}${note.trim().length > 90 ? '…' : ''}` : '';
    const fullText = `${states}${events}${tasks}${noteLine}`;

    cell.innerHTML = `<div class="day-number">${d}</div><div class="cell-text">${escapeHtml(fullText)}</div>`;
    cell.addEventListener('click', () => openDay(date));
    cal.appendChild(cell);
  }
}

function openDay(date) {
  selectedDateKey = dateKey(date);
  const data = buildDay(date);
  const dayName = weekDays[getMondayIndex(date)];
  document.getElementById('dialogTitle').textContent = `${dayName} ${date.getDate()} de ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  const states = data.infos.map(i => `${i.room.name}: ${i.state}`).join('\n');
  const events = data.events.length ? `\n\nEVENTOS\n${data.events.map(e => `• ${e}`).join('\n')}` : '';
  const tasks = `\n\nTAREAS\n${data.tasks.map(t => `• ${t}`).join('\n')}`;
  document.getElementById('dialogContent').textContent = `${states}${events}${tasks}`;
  document.getElementById('noteInput').value = getNote(selectedDateKey);
  document.getElementById('dayDialog').showModal();
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function shiftMonth(n) {
  const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + n, 1);
  if (next < startMonth || next > endMonth) return;
  currentMonth = next;
  renderMonth();
}
function goToday() {
  const today = new Date();
  if (today >= startMonth && today <= new Date(2027, 5, 30)) {
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    currentMonth = new Date(startMonth);
  }
  renderMonth();
}

document.getElementById('prevBtn').addEventListener('click', () => shiftMonth(-1));
document.getElementById('nextBtn').addEventListener('click', () => shiftMonth(1));
document.getElementById('todayBtn').addEventListener('click', goToday);
document.getElementById('saveNoteBtn').addEventListener('click', (e) => {
  e.preventDefault();
  if (selectedDateKey) setNote(selectedDateKey, document.getElementById('noteInput').value);
  document.getElementById('dayDialog').close();
  renderMonth();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

renderMonth();
