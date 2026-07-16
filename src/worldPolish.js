// SKYLINE_RECOVERED_WORLD_FEATURES_V1
import {
  OptionalWorldSystem,
} from './optionalWorld/index.js';

import {
  PerformanceRuntime,
} from './performanceRuntime.js';

import {
  WindAudioSystem,
} from './windAudio.js';

import {
  CrownMountainSystem,
} from './crownMountain.js';

import {
  RouteSystem,
} from './routeSystem.js';

import {
  WildlifeSystem,
} from './wildlife.js';

function safeCreate(
  label,
  factory,
) {
  try {
    return factory();
  } catch (error) {
    console.warn(
      `[Skyline] ${label} unavailable`,
      error,
    );

    return null;
  }
}

function safeUpdate(
  system,
  method,
  ...args
) {
  try {
    system?.[method]?.(
      ...args
    );
  } catch (error) {
    console.warn(
      `[Skyline] ${method} failed`,
      error,
    );
  }
}

export class WorldPolishSystem {
  constructor(
    scene,
    options = {},
  ) {
    const sampleHeight =
      options.sampleHeight ||
      null;

    /*
     * Keep the current optional systems:
     * atmosphere, clouds, city, AI aircraft and contrails.
     *
     * RouteSystem replaces the older anonymous hoop system.
     * The advanced WindAudioSystem remains the only audio owner.
     */
    this.optionalWorld =
      new OptionalWorldSystem(
        scene,
        {
          ...options,
          audio: false,
          routes: false,
          wildlife: false,
        },
      );

    this.crownMountain =
      options.crownMountain === false
        ? null
        : safeCreate(
            'Crown Mountain',
            () =>
              new CrownMountainSystem(
                scene,
              ),
          );

    this.routes =
      options.routes === false
        ? null
        : safeCreate(
            'route gates',
            () =>
              new RouteSystem(
                scene,
              ),
          );

    this.wildlife =
      options.wildlife === false
        ? null
        : safeCreate(
            'wildlife and sailplanes',
            () =>
              new WildlifeSystem(
                scene,
              ),
          );

    this.audio =
      safeCreate(
        'aircraft audio',
        () =>
          new WindAudioSystem({
            sampleHeight,
            masterLevel: 0.42,
          }),
      );

    this.audioFailureReported =
      false;

    this.performance =
      new PerformanceRuntime(
        this.optionalWorld,
        {
          targetFps: 60,
          maxDrawCalls: 460,
          maxTriangles:
            1250000,
        },
      );
  }

  fixedStepUpdate(
    dt,
    flight,
    phase = 'flying',
  ) {
    safeUpdate(
      this.optionalWorld,
      'fixedStepUpdate',
      dt,
      flight,
      phase,
    );
  }

  beginPerformanceFrame(
    dt,
    details = {},
  ) {
    safeUpdate(
      this.performance,
      'beginFrame',
      dt,
      details,
    );
  }

  update(
    dt,
    flight,
    camera,
    phase = 'flying',
  ) {
    safeUpdate(
      this.optionalWorld,
      'update',
      dt,
      flight,
      camera,
      phase,
    );

    safeUpdate(
      this.crownMountain,
      'update',
      dt,
      camera,
    );

    safeUpdate(
      this.routes,
      'update',
      dt,
      flight,
      camera,
      phase === 'flying',
    );

    safeUpdate(
      this.wildlife,
      'update',
      dt,
    );

    try {
      const trafficSources =
        this.optionalWorld
          ?.registry
          ?.get?.(
            'AI aircraft'
          )
          ?.getAudioSources?.() ??
        [];

      this.audio?.update(
        dt,
        flight,
        camera,
        phase,
        trafficSources,
      );
    } catch (error) {
      if (
        !this.audioFailureReported
      ) {
        this.audioFailureReported =
          true;

        console.warn(
          '[Skyline] Aircraft audio disabled',
          error,
        );
      }

      try {
        this.audio
          ?.dispose?.();
      } catch {}

      this.audio = null;
    }
  }

  endPerformanceFrame(
    renderMetrics = {},
  ) {
    safeUpdate(
      this.performance,
      'endFrame',
      renderMetrics,
    );
  }

  getStatus() {
    return {
      systems:
        this.optionalWorld
          ?.getStatus?.() ??
        {},

      performance:
        this.performance
          ?.getState?.() ??
        {},

      audio:
        this.audio
          ?.getStatus?.() ?? {
            ready: false,
            disabled: true,
          },

      recovered: {
        crownMountain:
          Boolean(
            this.crownMountain
          ),

        routeGates:
          Boolean(
            this.routes
          ),

        wildlife:
          Boolean(
            this.wildlife
          ),

        sailplanes:
          Boolean(
            this.wildlife
          ),
      },
    };
  }

  dispose() {
    for (
      const system of [
        this.audio,
        this.crownMountain,
        this.routes,
        this.wildlife,
        this.performance,
        this.optionalWorld,
      ]
    ) {
      try {
        system
          ?.dispose?.();
      } catch {}
    }
  }
}
