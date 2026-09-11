const VERSION='3.18.4';
const CACHE=`rainbows-v${VERSION.replaceAll('.','-')}`;
const SUPABASE_MODULE='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/+esm';
const APP_SHELL='./index.html';
const FILES=[
  APP_SHELL,
  `./styles.css?v=${VERSION}`,
  `./app.js?v=${VERSION}`,
  `./rainbows-overrides.js?v=${VERSION}`,
  `./manifest.json?v=${VERSION}`,
  `./rainbows-logo.webp?v=${VERSION}`,
  `./favicon-48.png?v=${VERSION}`,
  `./apple-touch-icon.png?v=${VERSION}`,
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(FILES);
    try{await cache.add(SUPABASE_MODULE)}catch(_){/* La app online podrá descargarlo después. */}
  }).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith('rainbows-')&&key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function cacheResponse(request,response){
  if(response?.ok||response?.type==='opaque'){
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  }
  return response;
}

async function cachedFallback(request){
  return (await caches.match(request))||(await caches.match(request,{ignoreSearch:true}));
}

async function networkFirst(request,fallback=APP_SHELL){
  try{
    return await cacheResponse(request,await fetch(request));
  }catch(_){
    const cached=await cachedFallback(request);
    if(cached)return cached;
    if(fallback){
      const shell=await caches.match(fallback,{ignoreSearch:true});
      if(shell)return shell;
    }
    return new Response('Rainbows no está disponible sin conexión.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);

  if(url.href===SUPABASE_MODULE){
    event.respondWith(caches.match(event.request).then(cached=>cached||networkFirst(event.request,null)));
    return;
  }

  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,APP_SHELL));
    return;
  }

  if(['script','style','image','manifest','font'].includes(event.request.destination)){
    event.respondWith(networkFirst(event.request,null));
  }
});
