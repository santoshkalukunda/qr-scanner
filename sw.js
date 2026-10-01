// Bump VERSION whenever you change any app file, so users get the update
const VERSION = 'v1';
const CACHE = `qr-scanner-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Scan engine libraries (main + fallback CDNs) so scanning works offline
const LIBS = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js',
  'https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled: one failed file (e.g. a CDN being down) won't break the install
    await Promise.allSettled([...APP_SHELL, ...LIBS].map(url => cache.add(url)));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('qr-scanner-') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Page sends this when the user clicks "Update"
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req));          // fresh HTML when online
  } else if (url.origin === location.origin || LIBS.includes(req.url)) {
    e.respondWith(cacheFirst(req));            // instant icons, libs, manifest
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) ||
           (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 504 });
  }
}