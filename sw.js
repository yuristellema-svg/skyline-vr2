const SHELL_CACHE = 'skyline-shell-v8';

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',

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
  './src/wildlife.js',
  './src/contrails.js',
  './src/worldPolish.js',
  './src/stereo.js',
  './src/menu.js',
  './src/hud.js',
  './src/world/world.js',

  './src/sandboxDynamics.js',
  './src/aiTraffic.js',
  './src/cloudField.js',
  './src/citySilhouette.js',
  './vendor/three.module.min.js',
];

self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches
        .open(SHELL_CACHE)
        .then((cache) =>
          cache.addAll(
            SHELL_FILES,
          ),
        )
        .then(() =>
          self.skipWaiting(),
        ),
    );
  },
);

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key !==
                  SHELL_CACHE,
              )
              .map((key) =>
                caches.delete(key),
              ),
          ),
        )
        .then(() =>
          self.clients.claim(),
        ),
    );
  },
);

self.addEventListener(
  'fetch',
  (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
      return;
    }

    const url = new URL(
      request.url,
    );

    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    if (
      url.pathname.includes(
        '/assets/world/',
      ) ||
      url.pathname.endsWith('.wpk')
    ) {
      event.respondWith(
        fetch(request),
      );

      return;
    }

    if (
      request.mode === 'navigate'
    ) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy =
              response.clone();

            caches
              .open(SHELL_CACHE)
              .then((cache) =>
                cache.put(
                  './index.html',
                  copy,
                ),
              );

            return response;
          })
          .catch(() =>
            caches.match(
              './index.html',
            ),
          ),
      );

      return;
    }

    event.respondWith(
      caches
        .match(request)
        .then((cached) => {
          const network =
            fetch(request)
              .then(
                (response) => {
                  if (response.ok) {
                    const copy =
                      response.clone();

                    caches
                      .open(
                        SHELL_CACHE,
                      )
                      .then(
                        (cache) =>
                          cache.put(
                            request,
                            copy,
                          ),
                      );
                  }

                  return response;
                },
              )
              .catch(() => cached);

          return cached || network;
        }),
    );
  },
);
