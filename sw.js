const SHELL_CACHE = 'skyline-shell-v5-1-20260715';

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './src/main.js',
  './src/config.js',
  './src/input.js',
  './src/flightModel.js',
  './src/collision.js',
  './src/camera.js',
  './src/effects.js',
  './src/aircraftVisuals.js',
  './src/skyDecor.js',
  './src/atmosphere.js',
  './src/windAudio.js',
  './src/routeSystem.js',
  './src/sandboxDynamics.js',
  './src/aiTraffic.js',
  './src/cloudField.js',
  './src/contrails.js',
  './src/worldPolish.js',
  './src/aircraft/a6mZeroShared.js',
  './src/aircraft/a6mZeroExternal.js',
  './src/aircraft/a6mZeroCockpit.js',
  './src/optionalWorld/safeSystem.js',
  './src/optionalWorld/math.js',
  './src/optionalWorld/boostHoops.js',
  './src/optionalWorld/cloudField.js',
  './src/optionalWorld/distantCity.js',
  './src/optionalWorld/aiAircraft.js',
  './src/optionalWorld/audio.js',
  './src/optionalWorld/index.js',
  './src/performanceRuntime.js',
  './src/stereo.js',
  './src/menu.js',
  './src/hud.js',
  './src/world/world.js',
  './vendor/three.module.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallback = null) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : Response.error());
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.includes('/assets/world/') ||
    url.pathname.endsWith('.wpk')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || networkFirst(request)),
  );
});
