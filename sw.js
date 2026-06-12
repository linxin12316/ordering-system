// sw.js — Service Worker（网络优先，离线回退缓存）
const CACHE_NAME = 'ordering-system-v6';

self.addEventListener('install', () => self.skipWaiting());

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

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).then(res => {
      // 网络成功 → 存入缓存供离线使用
      const clone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
