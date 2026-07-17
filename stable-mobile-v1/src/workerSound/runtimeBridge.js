import * as THREE from '../../vendor/three.module.min.js';
import * as SoundModule from './skylineSoundSystem.js';

function exportedFunctions(namespace) {
  return Object.entries(namespace || {})
    .filter(([, value]) =>
      typeof value === 'function'
    )
    .sort(([nameA], [nameB]) => {
      const score = name => {
        const lower = name.toLowerCase();
        let value = 0;

        if (lower.includes('sound')) value += 20;
        if (lower.includes('audio')) value += 16;
        if (lower.includes('system')) value += 12;
        if (lower.includes('create')) value += 8;
        if (lower.includes('skyline')) value += 5;

        return value;
      };

      return score(nameB) - score(nameA);
    });
}

function createSystem(options) {
  for (const [, candidate] of
    exportedFunctions(SoundModule)) {
    const isClass =
      /^class\s/.test(
        Function.prototype.toString.call(
          candidate
        )
      );

    const attempts = isClass
      ? [
          () => new candidate(options),
          () => new candidate(
            options.scene,
            options
          ),
        ]
      : [
          () => candidate(options),
          () => candidate(
            options.scene,
            options
          ),
        ];

    for (const attempt of attempts) {
      try {
        const result = attempt();

        if (
          result &&
          (
            typeof result === 'object' ||
            typeof result === 'function'
          )
        ) {
          return result;
        }
      } catch {
        // Try another compatible export.
      }
    }
  }

  return null;
}

function callFrameMethod(
  target,
  names,
  dt,
  context,
) {
  if (!target) return;

  for (const name of names) {
    const fn = target[name];

    if (typeof fn !== 'function') continue;

    try {
      if (fn.length >= 4) {
        fn.call(
          target,
          dt,
          context.flight,
          context.camera,
          context
        );
      } else if (fn.length === 3) {
        fn.call(
          target,
          dt,
          context.flight,
          context
        );
      } else if (fn.length === 2) {
        fn.call(
          target,
          dt,
          context
        );
      } else if (fn.length === 1) {
        fn.call(
          target,
          context
        );
      } else {
        fn.call(target);
      }

      return;
    } catch (error) {
      console.warn(
        `[Skyline SOUND] ${name} failed`,
        error
      );
    }
  }
}

export function createWorkerSoundBridge(
  options = {},
) {
  const bridge = {
    options: {
      ...options,
      THREE,
      eventTarget:
        options.eventTarget ||
        globalThis.window ||
        null,
    },

    system: null,
    initialized: false,
    disabled: false,

    ensureStarted() {
      if (
        this.initialized ||
        this.disabled
      ) {
        return;
      }

      this.initialized = true;

      try {
        this.system =
          createSystem(this.options);

        if (!this.system) {
          this.disabled = true;

          console.warn(
            '[Skyline SOUND] Worker system did not expose a compatible factory. Existing stable sound remains active.'
          );

          return;
        }

        for (const name of [
          'unlock',
          'start',
          'resume',
          'enable',
        ]) {
          const fn = this.system?.[name];

          if (typeof fn !== 'function') {
            continue;
          }

          try {
            fn.call(this.system);
          } catch {
            // Existing gesture listeners may unlock it later.
          }
        }
      } catch (error) {
        this.disabled = true;

        console.warn(
          '[Skyline SOUND] Worker initialization failed. Existing stable sound remains active.',
          error
        );
      }
    },

    fixedStepUpdate(dt, context) {
      this.ensureStarted();

      callFrameMethod(
        this.system,
        [
          'fixedStepUpdate',
          'fixedUpdate',
        ],
        dt,
        context,
      );
    },

    update(dt, context) {
      this.ensureStarted();

      callFrameMethod(
        this.system,
        [
          'update',
          'frameUpdate',
          'tick',
        ],
        dt,
        context,
      );
    },

    dispose() {
      this.system?.dispose?.();
    },
  };

  const start = () =>
    bridge.ensureStarted();

  globalThis.window?.addEventListener(
    'pointerdown',
    start,
    { passive: true }
  );

  globalThis.window?.addEventListener(
    'touchend',
    start,
    { passive: true }
  );

  globalThis.window?.addEventListener(
    'keydown',
    start,
    { passive: true }
  );

  return bridge;
}
