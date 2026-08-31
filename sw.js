const CACHE='rainbows-v3-16-49';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./rainbows-logo.webp','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./rainbows-overrides.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin===self.location.origin&&url.pathname.endsWith('/app.js')){
    e.respondWith(fetch(e.request).then(r=>r.text().then(text=>new Response(text+'\nimport("./rainbows-overrides.js?v=3.16.49");',{status:r.status,statusText:r.statusText,headers:r.headers}))).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
