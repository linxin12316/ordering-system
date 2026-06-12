// sw.js — Service Worker
const CACHE_NAME = 'ordering-system-v3';
const urlsToCache = [
  'index.html',
  'css/style.css',
  'js/vue.global.js',
  'js/db.js',
  'js/utils.js',
  'js/app.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(names => Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      )),
      self.clients.claim()
    ])
  );
});
