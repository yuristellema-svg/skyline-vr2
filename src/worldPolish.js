// SKYLINE_V5_1_PHYSICS_PERFORMANCE
import {
  OptionalWorldSystem,
} from './optionalWorld/index.js';

import {
  PerformanceRuntime,
} from './performanceRuntime.js';

import {
  WindAudioSystem,
} from './windAudio.js';

export class WorldPolishSystem {
  constructor(
    scene,
    options = {},
  ) {
    const sampleHeight =
      options.sampleHeight || null;

    // Disable the older optional-world audio engine so only one Web Audio
    // graph can exist. All other optional-world systems remain unchanged.
    this.optionalWorld =
      new OptionalWorldSystem(
        scene,
        {
          ...options,
          audio: false,
        },
      );

    this.audio = null;
    this.audioFailureReported = false;

    try {
      this.audio =
        new WindAudioSystem({
          sampleHeight,
        });
    } catch (error) {
      console.warn(
        '[Skyline] Aircraft audio unavailable',
        error,
      );
    }

    this.performance =
      new PerformanceRuntime(
        this.optionalWorld,
        {
          targetFps: 60,
          maxDrawCalls: 420,
          maxTriangles: 1200000,
        },
      );
  }

  fixedStepUpdate(
    dt,
    flight,
    phase = 'flying',
  ) {
    this.optionalWorld
      .fixedStepUpdate?.(
        dt,
        flight,
        phase,
      );
  }

  beginPerformanceFrame(
    dt,
    details = {},
  ) {
    this.performance
      .beginFrame(
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
    this.optionalWorld
      .update(
        dt,
        flight,
        camera,
        phase,
      );

    try {
      const trafficSources =
        this.optionalWorld
          .registry
          ?.get?.('AI aircraft')
          ?.getAudioSources?.() ?? [];

      this.audio?.update(
        dt,
        flight,
        camera,
        phase,
        trafficSources,
      );
    } catch (error) {
      if (!this.audioFailureReported) {
        this.audioFailureReported = true;
        console.warn(
          '[Skyline] Aircraft audio disabled',
          error,
        );
      }

      try {
        this.audio?.dispose?.();
      } catch {}

      this.audio = null;
    }
  }

  endPerformanceFrame(
    renderMetrics = {},
  ) {
    this.performance
      .endFrame(
        renderMetrics,
      );
  }

  getStatus() {
    return {
      systems:
        this.optionalWorld
          .getStatus(),

      performance:
        this.performance
          .getState(),

      audio:
        this.audio
          ?.getStatus?.() ?? {
            ready: false,
            disabled: true,
          },
    };
  }

  dispose() {
    try {
      this.audio?.dispose?.();
    } catch {}

    this.performance.dispose();
    this.optionalWorld.dispose();
  }
}
