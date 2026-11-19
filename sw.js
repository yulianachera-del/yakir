/* Service Worker: при установке кладёт все файлы приложения в кэш,
   дальше отвечает из кэша (cache-first) — приложение работает без сети.
   При обновлении файлов увеличьте номер версии в CACHE. */
const CACHE = 'anchor-v26'; // разом із APP_VERSION в app.js
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './privacy.html',
  './manifest.json',
  './manifest-bright.json',
  './manifest-calm.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-bright-192.png',
  './icons/icon-bright-512.png',
  './icons/icon-calm-192.png',
  './icons/icon-calm-512.png',
];

// «Оновити зараз» у Налаштуваннях: нова версія не чекає закриття застосунку
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

const fresh = (url) => new Request(url, { cache: 'reload' });

/* Записаний голос: якщо в audio/index.json перелічено MP3-файли, вони теж
   кешуються при встановленні, щоб звучати без інтернету. Помилка окремого
   файлу не зриває встановлення застосунку. */
async function cacheVoiceClips(cache) {
  try {
    const res = await fetch(fresh('./audio/index.json'));
    const { files = [] } = await res.clone().json();
    await cache.put('./audio/index.json', res);
    await Promise.all(files.map((f) => cache.add(fresh('./audio/' + f)).catch(() => {})));
  } catch (e) { /* голосових файлів немає */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map(fresh)).then(() => cacheVoiceClips(cache)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
