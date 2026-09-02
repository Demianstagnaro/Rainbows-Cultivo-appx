const CACHE='rainbows-v3-16-55';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./rainbows-logo.webp','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./rainbows-overrides.js'];

function optimizeAppJs(text){
  const marker='/* RAINBOWS_PERF_CACHE_V2 */';
  if(text.includes(marker))return text;

  const pureCacheCode=`${marker}\nconst __cyclePerfCache=new Map();\nconst __cutPerfCache=new Map();\nconst __cloneTransferPerfCache=new Map();\nconst __vegesOccupiedPerfCache=new Map();\nconst __rawCycle=cycle,__rawCut=cut,__rawCloneTransfer=cloneTransfer,__rawVegesOccupied=vegesOccupied;\ncycle=function(r,date){const k=r.name+'|'+ymd(date);if(__cyclePerfCache.has(k))return __cyclePerfCache.get(k);const v=__rawCycle(r,date);__cyclePerfCache.set(k,v);return v};\ncut=function(date){const k=ymd(date);if(__cutPerfCache.has(k))return __cutPerfCache.get(k);const v=__rawCut(date);__cutPerfCache.set(k,v);return v};\ncloneTransfer=function(date){const k=ymd(date);if(__cloneTransferPerfCache.has(k))return __cloneTransferPerfCache.get(k);const v=__rawCloneTransfer(date);__cloneTransferPerfCache.set(k,v);return v};\nvegesOccupied=function(date){const k=ymd(date);if(__vegesOccupiedPerfCache.has(k))return __vegesOccupiedPerfCache.get(k);const v=__rawVegesOccupied(date);__vegesOccupiedPerfCache.set(k,v);return v};\n`;
  text=text.replace('function routine(date){',pureCacheCode+'function routine(date){');

  const dataCacheCode=`\nconst __baseTasksPerfCache=new Map();\nconst __continuationOriginsPerfCache=new Map();\nconst __chainFinishedPerfCache=new Map();\nlet __taskRowsByDatePerf=null;\nlet __realByTaskPerf=null;\nfunction __resetDataPerfCaches(){__baseTasksPerfCache.clear();__continuationOriginsPerfCache.clear();__chainFinishedPerfCache.clear();__taskRowsByDatePerf=null;__realByTaskPerf=null}\nfunction __rowsForDatePerf(day){if(!__taskRowsByDatePerf){__taskRowsByDatePerf=new Map();for(const row of state.tareas){const k=row.fecha||'';if(!__taskRowsByDatePerf.has(k))__taskRowsByDatePerf.set(k,[]);__taskRowsByDatePerf.get(k).push(row)}}return __taskRowsByDatePerf.get(day)||[]}\nfunction __realForTaskPerf(id){if(!__realByTaskPerf){__realByTaskPerf=new Map();for(const row of state.realizaciones)__realByTaskPerf.set(String(row.tarea_id),row)}return __realByTaskPerf.get(String(id))}\n`;
  text=text.replace('function baseTasks(date){',dataCacheCode+'function baseTasks(date){\n  const __cacheKey=ymd(date);\n  if(__baseTasksPerfCache.has(__cacheKey))return __baseTasksPerfCache.get(__cacheKey);');
  text=text.replace('  const day=ymd(date),rows=state.tareas.filter(t=>t.fecha===day),map=new Map(rows.filter(t=>t.clave_externa).map(t=>[t.clave_externa,t]));','  const day=ymd(date),rows=__rowsForDatePerf(day),map=new Map(rows.filter(t=>t.clave_externa).map(t=>[t.clave_externa,t]));');
  text=text.replace('  return[...rt,...custom];\n}\nfunction continuationOrigins(untilDate){','  const __result=[...rt,...custom];\n  __baseTasksPerfCache.set(__cacheKey,__result);\n  return __result;\n}\nfunction continuationOrigins(untilDate){\n  const __key=ymd(untilDate);\n  if(__continuationOriginsPerfCache.has(__key))return __continuationOriginsPerfCache.get(__key);');
  text=text.replace('  return origins;\n}\nfunction tasks(date){','  __continuationOriginsPerfCache.set(__key,origins);\n  return origins;\n}\nfunction tasks(date){');

  text=text.replace('function directRealByTaskId(id){return state.realizaciones.find(r=>String(r.tarea_id)===String(id))}','function directRealByTaskId(id){return __realForTaskPerf(id)}');

  const rawChain=`function chainFinishedDate(chain){\n  const finals=chainRows(chain)\n    .filter(x=>x.estado==='realizada'&&directRealByTaskId(x.id)&&!rowContinues(x))\n    .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));\n  return finals.length?finals[0].fecha:null;\n}`;
  const fastChain=`function chainFinishedDate(chain){\n  if(__chainFinishedPerfCache.has(chain))return __chainFinishedPerfCache.get(chain);\n  const finals=chainRows(chain)\n    .filter(x=>x.estado==='realizada'&&directRealByTaskId(x.id)&&!rowContinues(x))\n    .sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));\n  const value=finals.length?finals[0].fecha:null;\n  __chainFinishedPerfCache.set(chain,value);\n  return value;\n}`;
  text=text.replace(rawChain,fastChain);

  text=text.replace('async function refresh(){try{await load();render()}catch(e){','async function refresh(){try{__resetDataPerfCaches();await load();__resetDataPerfCaches();render()}catch(e){');

  return text;
}

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  if(url.origin===self.location.origin&&url.pathname.endsWith('/app.js')){
    e.respondWith(fetch(e.request).then(async r=>{
      const text=await r.text();
      const headers=new Headers(r.headers);headers.delete('content-length');headers.delete('content-encoding');
      return new Response(optimizeAppJs(text),{status:r.status,statusText:r.statusText,headers});
    }).catch(()=>caches.match(e.request)));
    return;
  }

  if(url.origin===self.location.origin&&(e.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/Rainbows-Cultivo-appx/'))){
    e.respondWith(fetch(e.request).then(async r=>{
      const html=await r.text();
      const tag='<script defer src="rainbows-overrides.js?v=3.16.55"></script>';
      const out=html.includes('rainbows-overrides.js')?html.replace(/<script defer src="rainbows-overrides\.js\?v=[^"]+"><\/script>/,tag):html.replace('</body>',tag+'\n</body>');
      const headers=new Headers(r.headers);headers.delete('content-length');headers.delete('content-encoding');
      return new Response(out,{status:r.status,statusText:r.statusText,headers});
    }).catch(()=>caches.match(e.request)));
    return;
  }

  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
