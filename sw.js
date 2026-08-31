const CACHE='rainbows-v3-16-47';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./rainbows-logo.webp','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png'];

const HARVEST_CALENDAR_JS=`
const __rainbowsHarvestStarts={F1:'2026-05-20',F2:'2026-07-01',F3:'2026-05-20'};
function __rainbowsUtcDay(value){const [y,m,d]=String(value).split('-').map(Number);return Date.UTC(y,m-1,d)/86400000}
function __rainbowsRoomHarvest(room,date){const days=__rainbowsUtcDay(date)-__rainbowsUtcDay(__rainbowsHarvestStarts[room]);return days>=56&&(days-56)%77===0}
function __rainbowsMarkCalendarHarvests(){
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    if(cell.dataset.harvestRoomLabels==='1')return;
    const stateEl=cell.querySelector('.day-state');
    if(!stateEl)return;
    cell.dataset.harvestRoomLabels='1';
    cell.querySelectorAll('.calendar-harvest-badge').forEach(el=>el.remove());
    const date=cell.dataset.date;
    const lines=(stateEl.innerText||stateEl.textContent||'').split(/\\n+/).map(x=>x.trim()).filter(Boolean);
    stateEl.innerHTML=lines.map(line=>{
      const match=line.match(/^F([123]):/);
      const room=match?'F'+match[1]:null;
      const badge=room&&__rainbowsRoomHarvest(room,date)?'<span class="calendar-room-harvest-badge">COSECHA</span>':'';
      return '<span class="calendar-room-state"><span>'+line+'</span>'+badge+'</span>';
    }).join('');
  });
}
setTimeout(__rainbowsMarkCalendarHarvests,0);
const __rainbowsCalendarObserver=new MutationObserver(()=>__rainbowsMarkCalendarHarvests());
const __rainbowsCalendarRoot=document.getElementById('app');
if(__rainbowsCalendarRoot)__rainbowsCalendarObserver.observe(__rainbowsCalendarRoot,{childList:true,subtree:true});
`;

const HARVEST_CALENDAR_CSS=`
.calendar-harvest-badge{display:none!important}
.day-cell.harvest-day:not(.today){box-shadow:0 10px 30px rgba(0,0,0,.18)}
.calendar-room-state{display:flex;align-items:center;justify-content:space-between;gap:3px;min-width:0;white-space:nowrap}
.calendar-room-state>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
.calendar-room-harvest-badge{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;margin-left:3px;padding:1px 4px;border-radius:999px;background:rgba(196,35,35,.10);border:1px solid rgba(196,35,35,.34);color:#ef4444;font-size:.50rem;font-weight:850;line-height:1.15;letter-spacing:.015em}
@media(max-width:700px){.calendar-room-harvest-badge{font-size:.44rem;padding:1px 3px;margin-left:2px}.calendar-room-state{gap:2px}}
`;

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin===self.location.origin&&url.pathname.endsWith('/app.js')){
    e.respondWith(fetch(e.request).then(r=>r.text().then(text=>new Response(text+'\n'+HARVEST_CALENDAR_JS,{status:r.status,statusText:r.statusText,headers:r.headers}))).catch(()=>caches.match(e.request)));
    return;
  }
  if(url.origin===self.location.origin&&url.pathname.endsWith('/styles.css')){
    e.respondWith(fetch(e.request).then(r=>r.text().then(text=>new Response(text+'\n'+HARVEST_CALENDAR_CSS,{status:r.status,statusText:r.statusText,headers:r.headers}))).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
