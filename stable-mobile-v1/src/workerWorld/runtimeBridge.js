import * as THREE from '../../vendor/three.module.min.js';

import {
  createRecoveredWorldSystem,
} from './wiring/worldWiring.mjs';

function callFixedMethod(
  target,
  dt,
  flight,
  phase,
) {
  if (!target) return;

  for (const name of [
    'fixedStepUpdate',
    'fixedUpdate',
    'step',
  ]) {
    const fn = target[name];

    if (typeof fn !== 'function') continue;

    try {
      if (fn.length >= 3) {
        fn.call(
          target,
          dt,
          flight,
          phase
        );
      } else if (fn.length === 2) {
        fn.call(
          target,
          dt,
          {
            flight,
            phase,
          }
        );
      } else if (fn.length === 1) {
        fn.call(target, {
          dt,
          flight,
          phase,
        });
      } else {
        fn.call(target);
      }

      return;
    } catch (error) {
      console.warn(
        `[Skyline WORLD] ${name} failed`,
        error
      );
    }
  }
}

function callUpdateMethod(
  target,
  dt,
  context,
) {
  if (!target) return;

  for (const name of [
    'update',
    'frameUpdate',
    'tick',
  ]) {
    const fn = target[name];

    if (typeof fn !== 'function') continue;

    try {
      if (fn.length >= 4) {
        fn.call(
          target,
          dt,
          context.flight,
          context.camera,
          context.phase
        );
      } else if (fn.length === 3) {
        fn.call(
          target,
          dt,
          context.flight,
          context.camera
        );
      } else if (fn.length === 2) {
        fn.call(
          target,
          dt,
          context
        );
      } else if (fn.length === 1) {
        fn.call(target, {
          dt,
          ...context,
        });
      } else {
        fn.call(target);
      }

      return;
    } catch (error) {
      console.warn(
        `[Skyline WORLD] ${name} failed`,
        error
      );
    }
  }
}

export function createWorkerWorldBridge(
  scene,
  options = {},
) {
  let system = null;
  let disabled = false;

  try {
    system =
      createRecoveredWorldSystem(
        scene,
        {
          ...options,
          THREE,

          eventTarget:
            options.eventTarget ||
            globalThis.window ||
            null,

          quality:
            options.quality ||
            'balanced',

          collision:
            options.collision,

          collisionSystem:
            options.collision,

          sampleHeight:
            options.sampleHeight,

          routeOptions:
            options.routeOptions || {},

          wildlifeOptions:
            options.wildlifeOptions || {},

          sailplaneOptions:
            options.sailplaneOptions || {},

          aiOptions:
            options.aiOptions || {},

          cityOptions:
            options.cityOptions || {},

          crownMountainOptions:
            {
              enabled: false,
              ...(
                options
                  .crownMountainOptions ||
                {}
              ),
            },
        }
      );
  } catch (error) {
    disabled = true;

    console.warn(
      '[Skyline WORLD] Worker initialization failed. Stable world remains active.',
      error
    );
  }

  return {
    system,

    fixedStepUpdate(
      dt,
      flight,
      phase,
    ) {
      if (disabled) return;

      callFixedMethod(
        system,
        dt,
        flight,
        phase,
      );
    },

    update(dt, context) {
      if (disabled) return;

      callUpdateMethod(
        system,
        dt,
        context,
      );
    },

    getAudioSources() {
      if (
        disabled ||
        !system
      ) {
        return [];
      }

      for (const name of [
        'getAudioSources',
        'getPositionalAudioSources',
        'getTrafficAudioSources',
      ]) {
        const fn = system[name];

        if (typeof fn !== 'function') {
          continue;
        }

        try {
          const value =
            fn.call(system);

          if (Array.isArray(value)) {
            return value;
          }
        } catch {
          // Try the next contract.
        }
      }

      for (const name of [
        'audioSources',
        'positionalAudioSources',
        'trafficAudioSources',
      ]) {
        if (Array.isArray(system[name])) {
          return system[name];
        }
      }

      return [];
    },

    dispose() {
      system?.dispose?.();
    },
  };
}
