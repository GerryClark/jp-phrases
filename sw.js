const CACHE_NAME = 'jp-phrases-v3';

// Paths are relative to the service worker's location, so the same file works
// from Flask (served at /sw.js) and from GitHub Pages (served at /<repo>/sw.js).
const APP_SHELL = [
  './',
  'static/css/style.css',
  'static/js/config.js',
  'static/js/app.js',
  'static/js/phrases.js',
  'static/js/study.js',
  'static/js/quiz.js',
  'static/js/progress.js',
  'static/manifest.json',
  'static/icon-192.png',
  'static/icon-512.png',
  'phrases.json'        // only exists in the published (static) copy
];

const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Add individually so one missing file doesn't abort the whole install
      Promise.all(APP_SHELL.map(path => cache.add(path).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Try the network (with a timeout), update the cache, fall back to the cache.
function networkFirst(request, cacheKey) {
  const fromNetwork = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS);
    fetch(request).then(response => {
      clearTimeout(timer);
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(cacheKey || request, clone));
      }
      resolve(response);
    }, err => {
      clearTimeout(timer);
      reject(err);
    });
  });

  return fromNetwork.catch(() =>
    caches.match(cacheKey || request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      throw new Error('offline and not cached');
    })
  );
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Audio: cache-first (files never change for a given phrase id)
  if (url.pathname.includes('/static/audio/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Page loads always map to the cached app shell page
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, new URL('./', self.location).href));
    return;
  }

  // Everything else (JS/CSS, phrase data from phrases.json or /api/phrases)
  event.respondWith(networkFirst(request));
});

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'CACHE_AUDIO') return;

  const urls = event.data.urls.filter(Boolean);
  const work = caches.open(CACHE_NAME).then(async cache => {
    let failed = 0;
    await Promise.all(urls.map(async url => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.status);
        await cache.put(url, response);
      } catch (e) {
        failed++;
      }
    }));
    if (event.source) {
      event.source.postMessage({ type: 'CACHE_AUDIO_DONE', total: urls.length, failed });
    }
  });
  event.waitUntil(work);
});
