const CACHE_NAME = 'rainbows-os-v2-2';
const FILES = ['./','./index.html','./styles.css','./app.js','./manifest.json'];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => { event.respondWith(fetch(event.request).then(resp => { const copy = resp.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, copy)); return resp; }).catch(() => caches.match(event.request))); });
