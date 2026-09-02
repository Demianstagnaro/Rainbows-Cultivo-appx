const CACHE='rainbows-v3-16-51';
const FILES=['./','./index.html','./styles.css','./app.js','./manifest.json','./rainbows-logo.webp','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./favicon-48.png','./rainbows-overrides.js'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);

  if(url.origin===self.location.origin&&(e.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/Rainbows-Cultivo-appx/'))){
    e.respondWith(fetch(e.request).then(async r=>{
      const html=await r.text();
      const tag='<script defer src="rainbows-overrides.js?v=3.16.51"></script>';
      const out=html.includes('rainbows-overrides.js')?html:html.replace('</body>',tag+'\n</body>');
      return new Response(out,{status:r.status,statusText:r.statusText,headers:r.headers});
    }).catch(()=>caches.match(e.request)));
    return;
  }

  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
