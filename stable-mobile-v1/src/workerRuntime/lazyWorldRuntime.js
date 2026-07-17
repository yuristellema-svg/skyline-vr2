function safeMessage(error) {
  return (
    error?.message ||
    String(error || 'Unknown worker-world error')
  );
}

export function createLazyWorkerWorld({
  scene,
  THREE,
  eventTarget =
    globalThis.window || null,
  quality = 'balanced',
} = {}) {
  let state = 'idle';
  let error = '';
  let system = null;
  let activationPromise = null;

  function snapshot() {
    return Object.freeze({
      state,
      active:
        state === 'active',
      failed:
        state === 'failed',
      error,
      systems:
        system?.getStatus?.()
          ?.systems || null,
    });
  }

  function emitStatus() {
    try {
      const EventConstructor =
        globalThis.CustomEvent;

      if (
        typeof EventConstructor !==
          'function' ||
        typeof eventTarget?.dispatchEvent !==
          'function'
      ) {
        return;
      }

      eventTarget.dispatchEvent(
        new EventConstructor(
          'skyline:worker-world-status',
          {
            detail: snapshot(),
          },
        ),
      );
    } catch {
      // Diagnostics must never affect gameplay.
    }
  }

  function disable(runtimeError) {
    error =
      safeMessage(runtimeError);

    state = 'failed';

    try {
      system?.dispose?.();
    } catch {
      // Failure isolation.
    }

    system = null;
    emitStatus();

    console.warn(
      '[Skyline WORLD] Disabled safely:',
      runtimeError,
    );
  }

  async function activate() {
    if (state === 'active') {
      return snapshot();
    }

    if (activationPromise) {
      return activationPromise;
    }

    state = 'loading';
    error = '';
    emitStatus();

    activationPromise = (
      async () => {
        try {
          const module =
            await import(
              '../workerWorld/wiring/worldWiring.mjs'
            );

          const factory =
            module
              .createRecoveredWorldSystem;

          if (
            typeof factory !==
            'function'
          ) {
            throw new TypeError(
              'WORLD factory export is missing',
            );
          }

          const candidate =
            factory(
              scene,
              {
                THREE,
                eventTarget,
                quality,

                routeOptions: {
                  visuals: true,
                },

                wildlifeOptions: {
                  visuals: true,
                },

                sailplaneOptions: {
                  visuals: true,
                },

                aiOptions: {
                  visuals: true,
                },

                cityOptions: {
                  enabled: true,
                },

                /*
                 * Crown Mountain remains intentionally
                 * omitted. The worker explicitly rejects
                 * standalone cone geometry without an
                 * integrated terrain/collision sampler.
                 */
                crownMountainOptions: {
                  mode: 'omitted',
                },
              },
            );

          if (
            !candidate ||
            typeof candidate.update !==
              'function'
          ) {
            throw new TypeError(
              'WORLD system did not initialize',
            );
          }

          system = candidate;
          state = 'active';
          emitStatus();

          console.info(
            '[Skyline WORLD] Worker systems active',
            snapshot(),
          );

          return snapshot();
        } catch (runtimeError) {
          disable(runtimeError);
          return snapshot();
        } finally {
          activationPromise = null;
        }
      }
    )();

    return activationPromise;
  }

  function fixedStepUpdate(
    dt,
    flight,
    phase,
  ) {
    if (
      state !== 'active' ||
      !system
    ) {
      return;
    }

    try {
      system.fixedStepUpdate?.(
        dt,
        flight,
        phase,
      );
    } catch (runtimeError) {
      disable(runtimeError);
    }
  }

  function update(
    dt,
    flight,
    camera,
    phase,
  ) {
    if (
      state !== 'active' ||
      !system
    ) {
      return;
    }

    try {
      system.update(
        dt,
        flight,
        camera,
        phase,
      );
    } catch (runtimeError) {
      disable(runtimeError);
    }
  }

  function getAudioSources() {
    if (
      state !== 'active' ||
      !system
    ) {
      return [];
    }

    try {
      const sources =
        system.getAudioSources?.();

      return Array.isArray(sources)
        ? sources
        : [];
    } catch {
      return [];
    }
  }

  function dispose() {
    try {
      system?.dispose?.();
    } catch {
      // Cleanup must not throw.
    }

    system = null;
    state = 'disposed';
    emitStatus();
  }

  return Object.freeze({
    activate,
    fixedStepUpdate,
    update,
    getAudioSources,
    dispose,
    getStatus: snapshot,
  });
}
