/* Rainbows OS V1
   - Sin frameworks.
   - Persistencia local con localStorage.
   - La función saveTaskCompletion queda separada para reemplazar luego por Google Sheets.
*/

const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "rainbows_os_v1_completions";
const EMPLOYEES_KEY = "rainbows_os_v1_employees";

const DEFAULT_EMPLOYEES = ["Demian", "Empleado 1", "Empleado 2", "Empleado 3", "Otro"];

const ROOMS = [
  { name: "Flora 1", type: "flora", floraStart: "2026-05-20" }, // 2026-07-01 = Flora S7
  { name: "Flora 2", type: "flora", floraStart: "2026-07-01" }, // 2026-07-01 = Flora S1
  { name: "Flora 3", type: "flora", floraStart: "2026-05-20" }, // 2026-07-01 = Flora S7
  { name: "Veges", type: "vege" },
  { name: "Madres", type: "madres" }
];

let state = {
  view: "today",
  calendarDate: startOfMonth(new Date()),
  selectedRoom: null,
  pendingCompletion: null
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupEvents();
  setupPwa();
  renderAll();
});

function cacheElements() {
  els.todayLabel = document.getElementById("todayLabel");
  els.todaySummary = document.getElementById("todaySummary");
  els.todayProgress = document.getElementById("todayProgress");
  els.roomSummaryCards = document.getElementById("roomSummaryCards");
  els.todayTasks = document.getElementById("todayTasks");
  els.calendarTitle = document.getElementById("calendarTitle");
  els.calendarGrid = document.getElementById("calendarGrid");
  els.roomsList = document.getElementById("roomsList");
  els.roomDetail = document.getElementById("roomDetail");
  els.employeeInput = document.getElementById("employeeInput");
  els.employeeSelect = document.getElementById("employeeSelect");
  els.modal = document.getElementById("completionModal");
  els.modalTaskText = document.getElementById("modalTaskText");
  els.completionNotes = document.getElementById("completionNotes");
  els.installButton = document.getElementById("installButton");
}

function setupEvents() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.getElementById("prevMonth").addEventListener("click", () => {
    state.calendarDate = addMonths(state.calendarDate, -1);
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    state.calendarDate = addMonths(state.calendarDate, 1);
    renderCalendar();
  });

  document.getElementById("saveEmployees").addEventListener("click", () => {
    const names = els.employeeInput.value.split("\n").map(s => s.trim()).filter(Boolean);
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(names.length ? names : DEFAULT_EMPLOYEES));
    alert("Empleados guardados.");
  });

  document.getElementById("exportData").addEventListener("click", exportLocalData);
  document.getElementById("clearData").addEventListener("click", () => {
    if (confirm("¿Borrar todos los tildes guardados en este navegador?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderAll();
    }
  });

  document.getElementById("cancelCompletion").addEventListener("click", closeCompletionModal);
  document.getElementById("confirmCompletion").addEventListener("click", confirmCompletion);
}

function setupPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker no registrado", err));
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    els.installButton.classList.remove("hidden");
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installButton.classList.add("hidden");
  });
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active-view"));
  document.getElementById(`view-${view}`).classList.add("active-view");
  renderAll();
}

function renderAll() {
  const today = todayLocal();
  els.todayLabel.textContent = formatLongDate(today);
  renderToday();
  renderCalendar();
  renderRooms();
  renderSettings();
}

function renderToday() {
  const date = todayLocal();
  const dayData = buildDayData(date);
  const tasks = dayData.tasks;
  const doneCount = tasks.filter(isTaskDone).length;

  els.todaySummary.textContent = `${tasks.length} tareas programadas. ${doneCount} realizadas, ${tasks.length - doneCount} pendientes.`;
  els.todayProgress.textContent = `${doneCount}/${tasks.length}`;

  els.roomSummaryCards.innerHTML = ROOMS.map(room => {
    const roomTasks = tasks.filter(t => t.sala === room.name);
    const roomDone = roomTasks.filter(isTaskDone).length;
    const percent = roomTasks.length ? Math.round((roomDone / roomTasks.length) * 100) : 100;
    const status = dayData.statuses.find(s => s.sala === room.name)?.estado || "Permanente";
    return `
      <article class="room-card" data-room="${escapeHtml(room.name)}">
        <div class="room-card-header">
          <h3>${escapeHtml(room.name)}</h3>
          <span class="badge">${escapeHtml(status)}</span>
        </div>
        <p class="muted small">${roomDone}/${roomTasks.length} tareas realizadas</p>
        <div class="progress-bar"><div style="width:${percent}%"></div></div>
      </article>
    `;
  }).join("");

  els.roomSummaryCards.querySelectorAll(".room-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedRoom = card.dataset.room;
      switchView("rooms");
    });
  });

  renderTaskList(els.todayTasks, tasks);
}

function renderTaskList(container, tasks) {
  if (!tasks.length) {
    container.innerHTML = `<p class="muted">No hay tareas programadas.</p>`;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const completion = getCompletion(task);
    const checked = completion ? "checked" : "";
    const doneClass = completion ? "done" : "";
    const doneInfo = completion ? `<div class="done-info">Realizada por ${escapeHtml(completion.hechoPor)} · ${escapeHtml(formatTime(new Date(completion.hechoEn)))}${completion.observaciones ? ` · ${escapeHtml(completion.observaciones)}` : ""}</div>` : "";
    return `
      <label class="task-card ${doneClass}">
        <input type="checkbox" data-task-id="${escapeHtml(task.id)}" ${checked} />
        <div>
          <strong>${escapeHtml(task.tarea)}</strong>
          <div class="task-meta">
            <span>${escapeHtml(task.sala)}</span>
            <span>${escapeHtml(task.tipo)}</span>
          </div>
          ${doneInfo}
        </div>
      </label>
    `;
  }).join("");

  container.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", () => {
      const task = tasks.find(t => t.id === input.dataset.taskId);
      if (!task) return;
      if (input.checked) {
        input.checked = false;
        openCompletionModal(task);
      } else {
        removeTaskCompletion(task);
        renderAll();
      }
    });
  });
}

function renderCalendar() {
  const month = state.calendarDate;
  els.calendarTitle.textContent = month.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const days = calendarDaysForMonth(month);

  els.calendarGrid.innerHTML = days.map(date => {
    const data = buildDayData(date);
    const isCurrentMonth = date.getMonth() === month.getMonth();
    const todayClass = isSameDate(date, todayLocal()) ? "today" : "";
    const otherClass = isCurrentMonth ? "" : "other-month";
    const floraStatuses = data.statuses.filter(s => s.tipo === "flora");
    const events = data.events;
    const groupedTasks = summarizeTasksForCalendar(data.tasks);
    return `
      <div class="day-cell ${todayClass} ${otherClass}">
        <div class="day-number">${date.getDate()}</div>
        <div class="day-section">
          ${floraStatuses.map(s => `<div class="day-line">${shortRoom(s.sala)}: ${escapeHtml(s.estado)}</div>`).join("")}
        </div>
        ${events.length ? `<div class="day-section"><strong>Eventos</strong>${events.slice(0, 4).map(e => `<div class="day-line">${escapeHtml(e)}</div>`).join("")}</div>` : ""}
        <div class="day-section"><strong>Tareas</strong>${groupedTasks.map(t => `<div class="day-line">${escapeHtml(t)}</div>`).join("")}</div>
      </div>
    `;
  }).join("");
}

function renderRooms() {
  const date = todayLocal();
  const dayData = buildDayData(date);
  const tasks = dayData.tasks;

  els.roomsList.innerHTML = ROOMS.map(room => {
    const status = dayData.statuses.find(s => s.sala === room.name)?.estado || "Permanente";
    const roomTasks = tasks.filter(t => t.sala === room.name);
    const done = roomTasks.filter(isTaskDone).length;
    return `
      <article class="room-card" data-room="${escapeHtml(room.name)}">
        <div class="room-card-header">
          <h3>${escapeHtml(room.name)}</h3>
          <span class="badge">${escapeHtml(status)}</span>
        </div>
        <p class="muted small">Hoy: ${done}/${roomTasks.length} tareas realizadas</p>
      </article>
    `;
  }).join("");

  els.roomsList.querySelectorAll(".room-card").forEach(card => {
    card.addEventListener("click", () => {
      state.selectedRoom = card.dataset.room;
      renderRoomDetail(state.selectedRoom);
    });
  });

  if (state.selectedRoom) renderRoomDetail(state.selectedRoom);
}

function renderRoomDetail(roomName) {
  const room = ROOMS.find(r => r.name === roomName);
  if (!room) return;
  const today = todayLocal();
  const status = getRoomStatus(room, today);
  const todayTasks = buildDayData(today).tasks.filter(t => t.sala === room.name);
  const nextTasks = findNextRelevantTasks(room, today, 45);

  els.roomDetail.classList.remove("hidden");
  els.roomDetail.innerHTML = `
    <h2>${escapeHtml(room.name)}</h2>
    <div class="detail-grid">
      <div class="detail-row"><span>Estado actual</span><strong>${escapeHtml(status.estado)}</strong></div>
      <div class="detail-row"><span>Tipo</span><strong>${escapeHtml(room.type)}</strong></div>
      <div class="detail-row"><span>Tareas de hoy</span><strong>${todayTasks.length}</strong></div>
    </div>
    <h3>Tareas de hoy</h3>
    <div id="roomTodayTasks" class="task-list"></div>
    <h3>Próximas tareas relevantes</h3>
    <div class="detail-grid">
      ${nextTasks.map(item => `<div class="detail-row"><span>${escapeHtml(formatShortDate(item.date))}</span><strong>${escapeHtml(item.tarea)}</strong></div>`).join("") || `<p class="muted">No se encontraron próximas tareas especiales.</p>`}
    </div>
  `;
  renderTaskList(document.getElementById("roomTodayTasks"), todayTasks);
}

function renderSettings() {
  els.employeeInput.value = getEmployees().join("\n");
}

function buildDayData(date) {
  const statuses = ROOMS.map(room => getRoomStatus(room, date));
  const tasks = [];
  const events = [];

  for (const room of ROOMS) {
    const status = getRoomStatus(room, date);
    const roomTasks = getTasksForRoom(room, status, date);
    tasks.push(...roomTasks);
    events.push(...getEventsForRoom(room, status, date));
  }

  return { date: toDateKey(date), statuses, tasks: dedupeTasks(tasks), events: [...new Set(events)] };
}

function getRoomStatus(room, date) {
  if (room.type !== "flora") {
    return { sala: room.name, tipo: room.type, etapa: room.type, semana: null, dayInCycle: null, estado: "Permanente" };
  }

  const floraStart = parseDate(room.floraStart);
  const transplantDate = addDays(floraStart, -21);
  const rawDay = diffDays(transplantDate, date);
  const dayInCycle = mod(rawDay, 77);

  let etapa, semana, estado;
  if (dayInCycle < 21) {
    etapa = "vege";
    semana = Math.floor(dayInCycle / 7) + 1;
    estado = `Vege S${semana}`;
  } else {
    etapa = "flora";
    semana = Math.floor((dayInCycle - 21) / 7) + 1;
    estado = `Flora S${semana}`;
  }

  const dayInWeek = dayInCycle % 7;
  const isWeekStart = dayInWeek === 0;
  const isTransplantDay = dayInCycle === 0;
  const isFloraStartDay = dayInCycle === 21;
  const isCycleLastDay = dayInCycle === 76;

  return { sala: room.name, tipo: room.type, etapa, semana, dayInCycle, dayInWeek, isWeekStart, isTransplantDay, isFloraStartDay, isCycleLastDay, estado };
}

function getTasksForRoom(room, status, date) {
  const dayName = getSpanishWeekday(date);
  const tasks = [];

  addTask(tasks, date, room.name, "Riego", "diaria");

  if (room.type === "vege" || room.type === "madres") {
    if (["lunes", "miercoles", "viernes"].includes(dayName)) addTask(tasks, date, room.name, "Fumigacion", "sanidad");
    if (dayName === "jueves") addTask(tasks, date, room.name, "KNF", "fertirriego");
    return tasks;
  }

  if (room.type !== "flora") return tasks;

  if (["lunes", "miercoles", "viernes"].includes(dayName) && status.etapa === "flora" && status.semana <= 3) {
    addTask(tasks, date, room.name, "Fumigacion", "sanidad");
  }

  if (dayName === "jueves" && status.etapa === "flora" && status.semana <= 6) {
    addTask(tasks, date, room.name, "KNF", "fertirriego");
  }

  if (status.isTransplantDay) {
    addTask(tasks, date, room.name, "Trasplante", "evento");
    addTask(tasks, date, room.name, "Enmienda", "nutricion");
  }

  if (status.dayInCycle === 1) {
    addTask(tasks, date, room.name, "Redes", "manejo");
  }

  if (status.isFloraStartDay) {
    addTask(tasks, date, room.name, "Inicio Flora", "evento");
    addTask(tasks, date, room.name, "Enmienda", "nutricion");
  }

  if (status.etapa === "flora" && status.semana === 3 && status.isWeekStart) {
    addTask(tasks, date, room.name, "Schwazzing", "poda");
  }

  if (status.etapa === "flora" && status.semana === 4 && status.isWeekStart) {
    addTask(tasks, date, room.name, "Enmienda", "nutricion");
  }

  // Martes previo al inicio de Flora S1: día 20 del ciclo, si cae martes según la regla definida.
  if (status.dayInCycle === 20 && dayName === "martes") {
    addTask(tasks, date, room.name, "Esquejes", "propagacion");
    addTask(tasks, date, room.name, "Poda bajos", "poda");
  }

  if (status.isCycleLastDay) {
    addTask(tasks, date, room.name, "Cosecha", "evento");
  }

  return tasks;
}

function getEventsForRoom(room, status, date) {
  if (room.type !== "flora") return [];
  const events = [];
  if (status.isTransplantDay) events.push(`Trasplante: ${shortRoom(room.name)}`);
  if (status.isFloraStartDay) events.push(`Inicio Flora: ${shortRoom(room.name)}`);
  if (status.isCycleLastDay) events.push(`Cosecha: ${shortRoom(room.name)}`);
  return events;
}

function addTask(tasks, date, sala, tarea, tipo) {
  const id = `${toDateKey(date)}|${sala}|${tarea}`;
  tasks.push({ id, fecha: toDateKey(date), sala, tarea, tipo });
}

function dedupeTasks(tasks) {
  const map = new Map();
  for (const task of tasks) map.set(task.id, task);
  return [...map.values()].sort((a, b) => {
    const roomOrder = ROOMS.findIndex(r => r.name === a.sala) - ROOMS.findIndex(r => r.name === b.sala);
    if (roomOrder !== 0) return roomOrder;
    return a.tarea.localeCompare(b.tarea, "es");
  });
}

function summarizeTasksForCalendar(tasks) {
  const byTask = new Map();
  for (const task of tasks) {
    if (!byTask.has(task.tarea)) byTask.set(task.tarea, []);
    byTask.get(task.tarea).push(shortRoom(task.sala));
  }
  return [...byTask.entries()].map(([name, rooms]) => `${name}: ${rooms.join(", ")}`);
}

function openCompletionModal(task) {
  state.pendingCompletion = task;
  els.modalTaskText.textContent = `${task.fecha} · ${task.sala} · ${task.tarea}`;
  els.completionNotes.value = "";
  els.employeeSelect.innerHTML = getEmployees().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  els.modal.classList.remove("hidden");
}

function closeCompletionModal() {
  state.pendingCompletion = null;
  els.modal.classList.add("hidden");
}

function confirmCompletion() {
  const task = state.pendingCompletion;
  if (!task) return;
  const hechoPor = els.employeeSelect.value;
  const observaciones = els.completionNotes.value.trim();
  saveTaskCompletion(task, { hechoPor, observaciones });
  closeCompletionModal();
  renderAll();
}

// Punto de reemplazo futuro: acá se conectará Google Sheets / Apps Script.
function saveTaskCompletion(task, { hechoPor, observaciones }) {
  const completions = loadCompletions();
  completions[task.id] = {
    taskId: task.id,
    fecha: task.fecha,
    sala: task.sala,
    tarea: task.tarea,
    estado: "realizada",
    hechoPor,
    hechoEn: new Date().toISOString(),
    observaciones: observaciones || ""
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

function removeTaskCompletion(task) {
  const completions = loadCompletions();
  delete completions[task.id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

function isTaskDone(task) {
  return Boolean(getCompletion(task));
}

function getCompletion(task) {
  return loadCompletions()[task.id] || null;
}

function loadCompletions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function getEmployees() {
  try {
    const stored = JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || "null");
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_EMPLOYEES;
  } catch {
    return DEFAULT_EMPLOYEES;
  }
}

function findNextRelevantTasks(room, fromDate, maxDays) {
  const relevant = new Set(["Enmienda", "Schwazzing", "Redes", "Esquejes", "Poda bajos", "Inicio Flora", "Trasplante", "Cosecha", "KNF", "Fumigacion"]);
  const found = [];
  for (let i = 1; i <= maxDays; i++) {
    const date = addDays(fromDate, i);
    const tasks = buildDayData(date).tasks.filter(t => t.sala === room.name && relevant.has(t.tarea));
    for (const task of tasks) found.push({ date, tarea: task.tarea });
    if (found.length >= 6) break;
  }
  return found.slice(0, 6);
}

function exportLocalData() {
  const data = loadCompletions();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rainbows-os-historial-${toDateKey(todayLocal())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function calendarDaysForMonth(monthDate) {
  const first = startOfMonth(monthDate);
  const firstWeekday = (first.getDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -firstWeekday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function todayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addMonths(date, months) { return new Date(date.getFullYear(), date.getMonth() + months, 1); }
function diffDays(start, end) { return Math.floor((stripTime(end) - stripTime(start)) / DAY_MS); }
function stripTime(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function mod(n, m) { return ((n % m) + m) % m; }
function isSameDate(a, b) { return toDateKey(a) === toDateKey(b); }
function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getSpanishWeekday(date) {
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][date.getDay()];
}
function formatLongDate(date) {
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatShortDate(date) {
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
function formatTime(date) {
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function shortRoom(name) {
  return name.replace("Flora ", "F").replace("Veges", "Veg").replace("Madres", "Mad");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
