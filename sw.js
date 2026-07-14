const CACHE_PREFIX = 'skyline-vr-';
const VERSION = `${CACHE_PREFIX}iteration-3-open-world-1`;

const CORE = Object.freeze([
  './',
  './index.html',
  './styles.css',
  './bundle.js',
  './game.js',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './vendor/three.module.min.js',
  './vendor/three.core.min.js',
  './src/main.js',
  './src/config.js',
  './src/input.js',
  './src/flightModel.js',
  './src/collision.js',
  './src/camera.js',
  './src/effects.js',
  './src/stereo.js',
  './src/menu.js',
  './src/hud.js',
  './src/world/world.js',
  './src/world/runtime/index.js',
  './src/world/runtime/packFormat.js',
  './src/world/runtime/packLoader.js',
  './src/world/runtime/terrainGeometry.js',
  './src/world/runtime/terrainRuntime.js',
  './src/world/features/city.js',
  './src/world/features/props.js',
  './src/world/features/structures.js',
  './src/world/features/water.js',
  './assets/world/manifest.json',
  './assets/world/features.json',
]);

// These are exactly the packs containing chunks inside the spawn render radius,
// including its one-chunk fog buffer. They make a first offline launch playable
// without forcing iPhone Safari to install the full 40 MB world up front.
const SPAWN_PACKS = Object.freeze([
  './assets/world/packs/r02_05.wpk',
  './assets/world/packs/r02_06.wpk',
  './assets/world/packs/r02_07.wpk',
  './assets/world/packs/r03_05.wpk',
  './assets/world/packs/r03_04.wpk',
  './assets/world/packs/r03_06.wpk',
  './assets/world/packs/r03_07.wpk',
  './assets/world/packs/r04_05.wpk',
  './assets/world/packs/r04_04.wpk',
  './assets/world/packs/r04_06.wpk',
  './assets/world/packs/r04_07.wpk',
  './assets/world/packs/r05_05.wpk',
  './assets/world/packs/r05_06.wpk',
  './assets/world/packs/r05_07.wpk',
]);

const PRECACHE = Object.freeze([...CORE, ...SPAWN_PACKS]);
const WORLD_PACK_PATH = /\/assets\/world\/packs\/r\d{2}_\d{2}\.wpk$/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== VERSION)
          .map(key => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isWorldPackRequest(url) {
  return url.origin === self.location.origin && WORLD_PACK_PATH.test(url.pathname);
}

async function cacheSuccessfulResponse(request, response) {
  if (!response.ok) return;
  try {
    const cache = await caches.open(VERSION);
    await cache.put(request, response.clone());
  } catch {
    // A cache quota failure must not discard a world pack that was fetched
    // successfully; the live network response remains usable for this flight.
  }
}

async function offlineFallback(request, navigation) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (!navigation) return Response.error();
  return (await caches.match('./index.html', { ignoreSearch: true }))
    || (await caches.match('./', { ignoreSearch: true }))
    || new Response('Skyline VR is offline and its app shell is unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

async function networkFirst(request, navigation = false) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheSuccessfulResponse(request, response);
      return response;
    }
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || response;
  } catch {
    return offlineFallback(request, navigation);
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, true));
    return;
  }

  // Packs outside SPAWN_PACKS are fetched and added to this same cache as the
  // player explores. Network-first ensures regenerated packs are not trapped
  // behind an older cached world while still allowing revisited areas offline.
  if (isWorldPackRequest(url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
