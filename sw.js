const CACHE='rainbows-v3-16-54';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./rainbows-logo.webp','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./rainbows-overrides.js'];

function optimizeAppJs(text){
  const marker='/* RAINBOWS_RENDER_CACHE_V1 */';
  if(text.includes(marker))return text;

  const cacheCode=`${marker}\nconst __baseTasksRenderCache=new Map();\nconst __continuationOriginsRenderCache=new Map();\nfunction __resetTaskRenderCaches(){__baseTasksRenderCache.clear();__continuationOriginsRenderCache.clear()}\n`;
  text=text.replace('function baseTasks(date){',cacheCode+'function baseTasks(date){\n  const __cacheKey=ymd(date);\n  if(__baseTasksRenderCache.has(__cacheKey))return __baseTasksRenderCache.get(__cacheKey);');

  text=text.replace(
    '  return[...rt,...custom];\n}\nfunction continuationOrigins(untilDate){\n  const origins=[];\n  const start=parse(CONTINUABLE_FROM);\n  for(let d=start;diff(d,untilDate)<=0;d=add(d,1)){\n    for(const t of baseTasks(d)){\n      if(isContinuable(t)&&!t.chain)origins.push({...t,chain:taskChain(t),originDate:t.date});\n    }\n  }\n  return origins;\n}',
    '  const __result=[...rt,...custom];\n  __baseTasksRenderCache.set(__cacheKey,__result);\n  return __result;\n}\nfunction continuationOrigins(untilDate){\n  const __key=ymd(untilDate);\n  if(__continuationOriginsRenderCache.has(__key))return __continuationOriginsRenderCache.get(__key);\n  const start=parse(CONTINUABLE_FROM);\n  if(diff(start,untilDate)>0){__continuationOriginsRenderCache.set(__key,[]);return [];}\n  const prev=add(untilDate,-1),prevKey=ymd(prev);\n  let origins=[];\n  if(prevKey>=CONTINUABLE_FROM&&__continuationOriginsRenderCache.has(prevKey)){origins=[...__continuationOriginsRenderCache.get(prevKey)];}\n  else{\n    for(let d=start;diff(d,prev)<=0;d=add(d,1)){\n      for(const t of baseTasks(d)){if(isContinuable(t)&&!t.chain)origins.push({...t,chain:taskChain(t),originDate:t.date});}\n    }\n  }\n  for(const t of baseTasks(untilDate)){if(isContinuable(t)&&!t.chain)origins.push({...t,chain:taskChain(t),originDate:t.date});}\n  __continuationOriginsRenderCache.set(__key,origins);\n  return origins;\n}'
  );

  text=text.replace('function render(){const isPalestina=', 'function render(){__resetTaskRenderCaches();const isPalestina=');
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
      return new Response(optimizeAppJs(text),{status:r.status,statusText:r.statusText,headers:r.headers});
    }).catch(()=>caches.match(e.request)));
    return;
  }

  if(url.origin===self.location.origin&&(e.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/Rainbows-Cultivo-appx/'))){
    e.respondWith(fetch(e.request).then(async r=>{
      const html=await r.text();
      const tag='<script defer src="rainbows-overrides.js?v=3.16.54"></script>';
      const out=html.includes('rainbows-overrides.js')?html.replace(/<script defer src="rainbows-overrides\.js\?v=[^"]+"><\/script>/,tag):html.replace('</body>',tag+'\n</body>');
      return new Response(out,{status:r.status,statusText:r.statusText,headers:r.headers});
    }).catch(()=>caches.match(e.request)));
    return;
  }

  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
