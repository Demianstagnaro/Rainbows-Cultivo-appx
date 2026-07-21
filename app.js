import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/+esm';

const APP_VERSION='3.3.1';
const db=createClient('https://fplbxirsbwruazvygciu.supabase.co','sb_publishable_y7EwYjE0W5SEIlumNdQpzw_PBlnkWOt');
const rules=[
{name:'Flora 1',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:true},
{name:'Flora 2',type:'flora',transplant:'2026-06-10',floraStart:'2026-07-01',automaticIrrigation:false},
{name:'Flora 3',type:'flora',transplant:'2026-04-30',floraStart:'2026-05-20',automaticIrrigation:false},
{name:'Veges',type:'vege'},{name:'Madres',type:'madres'},{name:'Esquejes',type:'esquejes'}];
const $=id=>document.getElementById(id),app=$('app');
const state={view:'today',month:new Date(new Date().getFullYear(),new Date().getMonth(),1),day:null,room:null,roomDay:null,tab:'summary',session:null,profile:null,perfiles:[],salas:[],camas:[],plantas:[],geneticas:[],empleados:[],tareas:[],realizaciones:[],joins:[],pending:null,selected:new Set(),editTask:null,editBed:null,editPlant:null,channel:null};
function today(){const d=new Date();d.setHours(0,0,0,0);return d}function sd(d){const x=new Date(d);x.setHours(0,0,0,0);return x}function add(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x}function diff(a,b){return Math.round((sd(a)-sd(b))/86400000)}function parse(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}function same(a,b){return ymd(a)===ymd(b)}function shortRoomDate(d){const wd=d.toLocaleDateString('es-AR',{weekday:'short'}).replace('.','');const cap=wd.charAt(0).toUpperCase()+wd.slice(1);return `${cap} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
function nice(d){return d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}function monthName(d){return d.toLocaleDateString('es-AR',{month:'long',year:'numeric'})}function dow(d){return['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()]}function rr(n){return rules.find(r=>r.name===n)}function sr(n){return state.salas.find(r=>r.nombre===n)}
function cycle(r,date){if(r.type!=='flora')return{label:'Permanente',stage:'permanente'};const days=77,bt=parse(r.transplant),bf=parse(r.floraStart);let c=Math.floor(diff(date,bt)/days);if(diff(date,bt)<0)c=-1;const tr=add(bt,c*days),fl=add(bf,c*days),day=diff(date,tr);if(day<0)return{label:'Pendiente',stage:'pendiente',tr,fl};if(diff(date,fl)<0){const w=Math.min(Math.floor(day/7)+1,3);return{label:`Vege S${w}`,stage:'vege',week:w,tr,fl}}const fd=diff(date,fl),w=Math.min(Math.floor(fd/7)+1,8);return{label:`Flora S${w}`,stage:'flora',week:w,tr,fl}}
function cut(date){const groups=[{dest:['Flora 1','Flora 3'],start:parse('2026-05-20'),opp:parse('2026-07-01')},{dest:['Flora 2'],start:parse('2026-07-01'),opp:parse('2026-05-20')}],active=[];for(const g of groups){const approx=Math.floor(diff(date,g.start)/77);for(let o=-2;o<=2;o++){const fl=add(g.start,(approx+o)*77),intake=add(fl,-1);/* Esquejes: Día 1 = día anterior a Flora S1 */let h=add(g.opp,56);while(diff(h,intake)<=0)h=add(h,77);const exit=add(h,2);if(diff(date,intake)>=0&&diff(date,exit)<0)active.push({dest:g.dest,intake,exit})}}if(!active.length)return{active:false,label:'Vacía'};active.sort((a,b)=>b.intake-a.intake);const x=active[0];return{active:true,label:`Día ${diff(date,x.intake)+1}`,dest:x.dest,exit:x.exit}}
function cycleNumber(r,d){if(r.type!=='flora')return null;return 9+Math.floor(diff(d,parse(r.transplant))/77)}function roomStatus(r,d){const n=cycleNumber(r,d);return n?`Ciclo ${n} · ${stage(r,d)}`:stage(r,d)}
function stage(r,d){return r.type==='esquejes'?cut(d).label:(cycle(r,d).week?`Semana ${cycle(r,d).week}`:cycle(r,d).label)}function startWeek(r,d,w){const c=cycle(r,d);return c.stage==='flora'&&c.week===w&&diff(d,c.fl)%7===0}function transplant(r,d){const c=cycle(r,d);return r.type==='flora'&&diff(d,c.tr)===0}function harvest(r,d){const c=cycle(r,d);return r.type==='flora'&&diff(d,c.fl)===56}
function routine(date){const out=[],day=dow(date),push=(room,name,detail)=>out.push({id:`${ymd(date)}|${room}|${name}`,key:`${ymd(date)}|${room}|${name}`,date:ymd(date),room,task:name,detail,type:'rutina',custom:false});for(const r of rules){const c=r.type==='esquejes'?{cut:cut(date)}:cycle(r,date);if(r.type!=='esquejes'&&!(r.name==='Flora 1'&&r.automaticIrrigation))push(r.name,'Riego','Riego diario manual');if(r.type==='esquejes'&&c.cut.active)push(r.name,'Mantenimiento',c.cut.label);if(r.name==='Flora 1'){if(transplant(r,date))push(r.name,'Calibrar riego','Trasplante / nuevo ciclo');if(startWeek(r,date,1))push(r.name,'Calibrar riego','Inicio Flora S1');if(startWeek(r,date,7))push(r.name,'Calibrar riego','Inicio Flora S7')}if(['lunes','miercoles','viernes'].includes(day)){if(['vege','madres'].includes(r.type))push(r.name,'Fumigacion','Lunes, miércoles y viernes');if(r.type==='flora'&&(c.stage==='vege'||(c.stage==='flora'&&c.week<=3)))push(r.name,'Fumigacion','Flora hasta S3')}if(day==='jueves'){if(['vege','madres'].includes(r.type))push(r.name,'KNF','Jueves');if(r.type==='flora'&&(c.stage==='vege'||(c.stage==='flora'&&c.week<=6)))push(r.name,'KNF','Flora hasta S6')}if(r.type==='flora'){if(transplant(r,date)){push(r.name,'Enmienda','Trasplante / inicio Vege S1');push(r.name,'Trasplante','Nuevo ciclo')}if(startWeek(r,date,1)){push(r.name,'Enmienda','Inicio Flora S1');push(r.name,'Inicio flora','Inicio Flora S1')}if(startWeek(r,date,4))push(r.name,'Enmienda','Inicio Flora S4');if(same(date,add(c.fl,-1))){push(r.name,'Esquejes','Día previo a floración');push(r.name,'Poda bajos','Día previo a floración')}if(startWeek(r,date,3))push(r.name,'Schwazzing','Inicio Flora S3');if(same(date,add(c.tr,1)))push(r.name,'Redes','Día siguiente al trasplante');if(harvest(r,date))push(r.name,'Cosecha','Final Flora S8')}}return out}
function uiTask(t){const s=state.salas.find(x=>x.id===t.sala_id);return{id:t.id,date:t.fecha,room:s?.nombre||'',task:t.nombre,detail:t.detalle||'',type:t.tipo,custom:true,db:t}}
function tasks(date){const day=ymd(date),rows=state.tareas.filter(t=>t.fecha===day),map=new Map(rows.filter(t=>t.clave_externa).map(t=>[t.clave_externa,t]));const rt=routine(date).filter(t=>map.get(t.key)?.estado!=='cancelada').map(t=>map.get(t.key)?{...t,id:map.get(t.key).id,db:map.get(t.key)}:t);const custom=rows.filter(t=>!t.clave_externa||t.tipo!=='rutina').filter(t=>t.estado!=='cancelada').map(uiTask);return[...rt,...custom]}
function real(t){const id=t.db?.id||t.id;return state.realizaciones.find(r=>r.tarea_id===id)}function done(t){return!!real(t)}function names(t){const r=real(t);if(!r)return[];const ids=state.joins.filter(j=>j.realizacion_id===r.id).map(j=>j.empleado_id);return state.empleados.filter(e=>ids.includes(e.id)).map(e=>e.nombre)}function actor(t){const r=real(t);if(!r?.registrada_por)return'';const p=state.perfiles.find(x=>x.id===r.registrada_por);return p?.nombre||p?.email||'Usuario'}
async function ensure(t){if(t.db?.id)return t.db;const payload={clave_externa:t.key,sala_id:sr(t.room)?.id||null,fecha:t.date,nombre:t.task,detalle:t.detail||'',tipo:'rutina',estado:'pendiente'};const q=await db.from('tareas').upsert(payload,{onConflict:'clave_externa'}).select().single();if(q.error)throw q.error;return q.data}
async function complete(t,ids){const row=t.custom?t.db:await ensure(t);await db.from('tareas').update({estado:'realizada'}).eq('id',row.id);const q=await db.from('realizaciones_tarea').upsert({tarea_id:row.id,realizada_at:new Date().toISOString(),registrada_por:state.session.user.id},{onConflict:'tarea_id'}).select().single();if(q.error)throw q.error;await db.from('realizacion_empleados').delete().eq('realizacion_id',q.data.id);if(ids.length)await db.from('realizacion_empleados').insert(ids.map(id=>({realizacion_id:q.data.id,empleado_id:id})));await refresh()}
async function undo(t){const r=real(t);if(r)await db.from('realizaciones_tarea').delete().eq('id',r.id);if(t.db?.id)await db.from('tareas').update({estado:'pendiente'}).eq('id',t.db.id);await refresh()}
async function load(){const qs=await Promise.all([db.from('salas').select('*'),db.from('camas').select('*'),db.from('plantas').select('*'),db.from('geneticas').select('*').eq('activa',true).order('nombre'),db.from('empleados').select('*').eq('activo',true).order('nombre'),db.from('tareas').select('*'),db.from('realizaciones_tarea').select('*'),db.from('realizacion_empleados').select('*'),db.from('perfiles').select('*').order('nombre'),db.from('perfiles').select('*').eq('id',state.session.user.id).maybeSingle()]);for(const q of qs)if(q.error)throw q.error;[state.salas,state.camas,state.plantas,state.geneticas,state.empleados,state.tareas,state.realizaciones,state.joins,state.perfiles]=qs.slice(0,9).map(q=>q.data||[]);state.profile=qs[9].data||null}async function refresh(){try{await load();render()}catch(e){console.error(e);app.innerHTML=`<section class="panel error-panel"><strong>Error</strong><p>${e.message}</p></section>`}}
function subscribe(){if(state.channel)db.removeChannel(state.channel);state.channel=db.channel('rainbows-shared').on('postgres_changes',{event:'*',schema:'public'},refresh).subscribe()}
function progress(r,d){const x=tasks(d).filter(t=>t.room===r.name),n=x.filter(done).length;return{total:x.length,done:n,pct:x.length?Math.round(n/x.length*100):100}}
function taskCounter(doneCount,totalCount){const complete=totalCount>0&&doneCount===totalCount;return `<span class="task-counter ${complete?'is-complete':''}">Tareas ${doneCount}/${totalCount}</span>`}
function taskPriority(t){const critical=['Cosecha','Trasplante','Esquejes','Inicio flora'];const important=['Enmienda','Schwazzing','Calibrar riego','Poda bajos','Redes'];if(critical.includes(t.task))return{rank:0,cls:'priority-critical',label:'Crítica'};if(important.includes(t.task))return{rank:1,cls:'priority-important',label:'Importante'};return{rank:2,cls:'priority-routine',label:'Rutina'}}
function orderedTasks(list){return [...list].sort((a,b)=>taskPriority(a).rank-taskPriority(b).rank||a.task.localeCompare(b.task,'es'))}
function row(t){const r=real(t),label=t.type==='extraordinaria'?'Extraordinaria':t.type==='reprogramada'?'Reprogramada':'',priority=taskPriority(t);return`<div class="task-row ${priority.cls} ${done(t)?'done':''}"><input type="checkbox" data-task-id="${t.id}" ${done(t)?'checked':''}><label><strong>${t.task}</strong><div class="task-subline"><span class="priority-badge">${priority.label}</span>${label?`<span class="task-category">${label}</span>`:''}${t.detail?`<span class="stage">${t.detail}</span>`:''}</div></label><div class="task-meta">${done(t)?`${names(t).join(', ')}<br>${new Date(r.realizada_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}<div class="actor-line">Registrado por: ${actor(t)}</div>`:''}</div><button class="task-menu" data-menu="${t.id}">⋮</button></div>`}
function findTask(id,d){return tasks(d).find(t=>String(t.id)===String(id))}
function render(){const cb=$('header-config');if(cb){const ok=state.profile?.rol==='administrador';cb.hidden=!ok;cb.style.display=ok?'inline-flex':'none';cb.onclick=()=>{state.view='settings';render()}} $('today-label').textContent=nice(today());document.querySelectorAll('.top-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));if(state.view==='today')renderToday();if(state.view==='calendar')renderCalendar();if(state.view==='rooms')renderRooms();if(state.view==='settings')renderSettings()}
function renderToday(){ $('screen-title').textContent='Hoy';const d=today(),ts=tasks(d),n=ts.filter(done).length,p=ts.length?Math.round(n/ts.length*100):100;app.innerHTML=`<section class="panel daily-summary"><div class="daily-summary-head"><div>${taskCounter(n,ts.length)}</div><button class="primary compact-button" data-new="${ymd(d)}">+ Nueva tarea</button></div><div class="progress"><span style="width:${p}%"></span></div></section><div class="today-room-list">${rules.map(r=>{const rt=orderedTasks(ts.filter(t=>t.room===r.name)),pr=progress(r,d);return`<section class="room-card"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${stage(r,d)}</div></div>${taskCounter(pr.done,pr.total)}</div><div class="progress"><span style="width:${pr.pct}%"></span></div><div class="room-tasks">${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}</div></section>`}).join('')}</div>`;bind(d)}
function renderCalendar(){ $('screen-title').textContent='Calendario';if(state.day){renderDay(state.day);return}const m=state.month,first=new Date(m.getFullYear(),m.getMonth(),1),start=add(first,-((first.getDay()+6)%7)),days=Array.from({length:42},(_,i)=>add(start,i));app.innerHTML=`<div class="toolbar"><button id="prev">‹</button><strong>${monthName(m)}</strong><button id="next">›</button></div><div class="calendar">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${days.map(d=>{const x=tasks(d),n=x.filter(done).length;return`<div class="day-cell ${same(d,today())?'today':''} ${d.getMonth()===m.getMonth()?'':'dim'}" data-date="${ymd(d)}"><div class="day-num">${d.getDate()}</div><div class="day-state">${rules.filter(r=>r.type==='flora').map(r=>`${r.name.replace('Flora ','F')}: ${cycle(r,d).label}`).join('<br>')}</div><div class="day-done">${taskCounter(n,x.length)}</div></div>`}).join('')}</div>`;$('prev').onclick=()=>{state.month=new Date(m.getFullYear(),m.getMonth()-1,1);render()};$('next').onclick=()=>{state.month=new Date(m.getFullYear(),m.getMonth()+1,1);render()};app.querySelectorAll('[data-date]').forEach(x=>x.onclick=()=>{state.day=parse(x.dataset.date);render()})}
function renderDay(d){const ts=tasks(d),n=ts.filter(done).length;app.innerHTML=`<button id="back-cal" class="secondary">← Volver</button><section class="panel"><div class="daily-summary-head"><div><h2>${nice(d)}</h2>${taskCounter(n,ts.length)}</div><button class="primary compact-button" data-new="${ymd(d)}">+ Nueva tarea</button></div></section><div class="today-room-list">${rules.map(r=>{const rt=orderedTasks(ts.filter(t=>t.room===r.name)),pr=progress(r,d);return`<section class="room-card"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${stage(r,d)}</div></div>${taskCounter(pr.done,pr.total)}</div><div class="progress"><span style="width:${pr.pct}%"></span></div><div class="room-tasks">${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}</div></section>`}).join('')}</div>`;$('back-cal').onclick=()=>{state.day=null;render()};bind(d)}
function beds(name){const s=sr(name);return state.camas.filter(c=>c.sala_id===s?.id).sort((a,b)=>a.numero-b.numero)}function plants(b){return state.plantas.filter(p=>p.cama_id===b.id&&p.habilitada).sort((a,b)=>a.posicion-b.posicion)}
function renderRooms(){ $('screen-title').textContent='Salas';if(!state.room){app.innerHTML=`<div class="list">${rules.map(r=>{const pr=progress(r,today());return`<section class="room-card" data-room="${r.name}"><div class="room-head"><div><div class="room-title">${r.name}</div><div class="stage">${roomStatus(r,today())}</div></div>${taskCounter(pr.done,pr.total)}</div></section>`}).join('')}</div>`;app.querySelectorAll('[data-room]').forEach(x=>x.onclick=()=>{state.room=x.dataset.room;state.roomDay=today();render()});return}const r=rr(state.room),cro=r.type==='flora',d=state.roomDay||today(),rt=orderedTasks(tasks(d).filter(t=>t.room===r.name)),pr=progress(r,d);app.innerHTML=`<button id="back-room" class="secondary">← Volver</button><section class="panel room-detail-header"><div class="room-head"><div><h2>${r.name}</h2><p class="muted">${roomStatus(r,d)}</p></div>${taskCounter(pr.done,pr.total)}</div><div class="room-date-controls"><button id="room-today" class="secondary room-back-today" ${same(d,today())?'disabled':''}>${same(d,today())?'Hoy':'Volver a hoy'}</button><div class="day-navigator"><button id="room-prev" class="secondary nav-day" aria-label="Día anterior">◀</button><div class="room-date-label">${shortRoomDate(d)}</div><button id="room-next" class="secondary nav-day" aria-label="Día siguiente">▶</button></div></div></section>${cro?`<div class="room-tabs"><button data-tab="summary" class="${state.tab==='summary'?'active':''}">Resumen</button><button data-tab="croquis" class="${state.tab==='croquis'?'active':''}">Croquis</button></div>`:''}${state.tab==='croquis'&&cro?renderCroquis(r):`<div class="section-title">Tareas del ${nice(d)}</div>${rt.length?rt.map(row).join(''):'<div class="empty-room-tasks">Sin tareas programadas</div>'}`}`;$('back-room').onclick=()=>{state.room=null;state.roomDay=null;state.tab='summary';render()};$('room-prev').onclick=()=>{state.roomDay=add(d,-1);render()};$('room-next').onclick=()=>{state.roomDay=add(d,1);render()};$('room-today').onclick=()=>{state.roomDay=today();render()};app.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{state.tab=x.dataset.tab;render()});app.querySelectorAll('[data-bed]').forEach(x=>x.onclick=()=>openBed(x.dataset.bed));app.querySelectorAll('[data-plant]').forEach(x=>x.onclick=()=>openPlant(x.dataset.plant));bind(d)}
function renderCroquis(r){const bs=beds(r.name),ps=bs.flatMap(plants),occ=ps.filter(p=>p.ocupada),cols=r.name==='Flora 3'?4:3;return`<section class="panel"><div class="croquis-metrics"><div><span>Plantas</span><strong>${occ.length}</strong></div><div><span>Capacidad</span><strong>${ps.length}</strong></div><div><span>Camas</span><strong>${bs.length}</strong></div></div></section><section class="croquis-shell"><div class="side-aisle"><span>Pasillo lateral</span></div><div class="beds-grid" style="--bed-columns:${cols}">${bs.map(b=>{const pp=plants(b),n=pp.filter(p=>p.ocupada).length;return`<article class="bed-card"><button class="bed-edit-button" data-bed="${b.id}"><div class="bed-card-head"><strong>Cama ${String(b.numero).padStart(2,'0')}</strong><span>${n}/${b.capacidad}</span></div></button><div class="plant-grid">${Array.from({length:9},(_,i)=>{const p=pp.find(x=>x.posicion===i+1);if(!p)return'<span class="plant-position plant-spacer"></span>';const g=state.geneticas.find(x=>x.id===p.genetica_id)?.nombre||'';return`<button class="plant-position ${p.ocupada?'occupied':''}" data-plant="${p.id}" title="${p.ocupada?g:'Vacía'}"></button>`}).join('')}</div></article>`}).join('')}</div><div class="side-aisle"><span>Pasillo lateral</span></div></section>`}
function renderSettings(){if(state.profile?.rol!=='administrador'){state.view='today';render();return} $('screen-title').textContent='Config';const permissions={administrador:'Acceso total: puede gestionar usuarios, roles, empleados, genéticas, tareas y configuración.',encargado:'Puede crear, editar, completar y reprogramar tareas, además de consultar salas, calendario e historial.',empleado:'Puede consultar el cultivo y completar tareas indicando quiénes las realizaron.',lectura:'Solo puede consultar Hoy, Calendario y Salas; no puede modificar información.'};app.innerHTML=`<section class="panel"><h3>Empleados compartidos</h3><textarea id="emps" class="text-input" style="min-height:150px">${state.empleados.map(e=>e.nombre).join('
')}</textarea></section><section class="panel"><h3>Genéticas compartidas</h3><textarea id="gens" class="text-input" style="min-height:180px">${state.geneticas.map(g=>g.nombre).join('
')}</textarea></section><button id="save-conf" class="primary">Guardar configuración</button><section class="panel"><h3>Usuarios</h3><div class="user-list">${state.perfiles.map(p=>`<div class="user-row"><div><strong>${p.nombre||'Sin nombre'}</strong><div class="user-email">${p.email||''}</div></div><select class="text-input user-role" data-role="${p.id}">${['administrador','encargado','empleado','lectura'].map(r=>`<option value="${r}" ${p.rol===r?'selected':''}>${r}</option>`).join('')}</select><label class="user-active"><input type="checkbox" data-active="${p.id}" ${p.activo?'checked':''}> Activo</label>${p.id!==state.session.user.id?`<button class="danger user-delete" data-delete-user="${p.id}" data-delete-name="${p.nombre||p.email||'este usuario'}">Eliminar cuenta</button>`:'<span class="self-account">Tu cuenta</span>'}</div>`).join('')}</div><p><button id="save-users" class="primary">Guardar usuarios</button></p></section><section class="panel"><h3>Permisos por rol</h3><div class="role-permissions">${Object.entries(permissions).map(([role,text])=>`<div class="role-permission"><strong>${role}</strong><p>${text}</p></div>`).join('')}</div></section><section class="panel account-summary"><p><strong>Usuario:</strong> ${state.session.user.email}</p><p><strong>Rol:</strong> ${state.profile?.rol||'empleado'}</p><p><strong>Tus permisos:</strong> ${permissions[state.profile?.rol||'empleado']}</p><p><strong>Versión:</strong> ${APP_VERSION}</p></section>`;$('save-conf').onclick=saveConfig;$('save-users').onclick=async()=>{try{for(const p of state.perfiles){const q=await db.rpc('admin_actualizar_perfil',{objetivo_id:p.id,nuevo_rol:document.querySelector(`[data-role="${p.id}"]`).value,nuevo_activo:document.querySelector(`[data-active="${p.id}"]`).checked});if(q.error)throw q.error}await refresh();alert('Usuarios actualizados.')}catch(e){console.error(e);alert(e.message||'No se pudieron actualizar los usuarios.')}};app.querySelectorAll('[data-delete-user]').forEach(btn=>btn.onclick=async()=>{const name=btn.dataset.deleteName;if(!confirm(`¿Eliminar definitivamente la cuenta de ${name}? Esta acción no se puede deshacer.`))return;btn.disabled=true;try{const q=await db.rpc('admin_eliminar_usuario',{objetivo_id:btn.dataset.deleteUser});if(q.error)throw q.error;await refresh();alert('Cuenta eliminada.')}catch(e){console.error(e);btn.disabled=false;alert(e.message||'No se pudo eliminar la cuenta. Verificá que hayas ejecutado el SQL de V3.2.1.')}})}
async function saveConfig(){const emp=[...new Set($('emps').value.split('\n').map(x=>x.trim()).filter(Boolean))],gen=[...new Set($('gens').value.split('\n').map(x=>x.trim()).filter(Boolean))];for(const n of emp)await db.from('empleados').upsert({nombre:n,activo:true},{onConflict:'nombre'});for(const e of state.empleados.filter(e=>!emp.includes(e.nombre)))await db.from('empleados').update({activo:false}).eq('id',e.id);for(const n of gen)await db.from('geneticas').upsert({nombre:n,activa:true},{onConflict:'nombre'});for(const g of state.geneticas.filter(g=>!gen.includes(g.nombre)))await db.from('geneticas').update({activa:false}).eq('id',g.id);await refresh();alert('Configuración guardada.')}
document.querySelectorAll('.top-nav button').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.room=null;state.roomDay=null;state.day=null;render()});$('sign-out').onclick=()=>db.auth.signOut();$('sign-in').onclick=async()=>{
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
};$('sign-up').onclick=async()=>{
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

db.auth.onAuthStateChange((_event,session)=>{
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

if('serviceWorker'in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=3.3.1').catch(console.error));
}
