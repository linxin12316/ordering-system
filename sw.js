// sw.js — Service Worker
const CACHE_NAME = 'ordering-system-v1';
const urlsToCache = [
  'index.html',
  'css/style.css',
  'js/db.js',
  'js/utils.js',
  'js/app.js',
  'js/components/MenuManage.js',
  'js/components/NewOrder.js',
  'js/components/DailyReport.js',
  'https://unpkg.com/vue@3/dist/vue.global.js'
];

self.addEventListener('install', (e) => {
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
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
});
