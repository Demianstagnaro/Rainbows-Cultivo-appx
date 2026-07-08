const CACHE_NAME = 'rainbows-os-v2-3';
const ASSETS = ['./?v=2.1','./index.html','./styles.css','./app.js?v=2.1','./manifest.json'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { event.respondWith(fetch(event.request).then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return res; }).catch(() => caches.match(event.request))); });
