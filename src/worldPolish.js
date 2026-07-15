// SKYLINE_V5_1_PHYSICS_PERFORMANCE
import {
  OptionalWorldSystem,
} from './optionalWorld/index.js';

import {
  PerformanceRuntime,
} from './performanceRuntime.js';

export class WorldPolishSystem {
  constructor(
    scene,
    options = {},
  ) {
    this.optionalWorld =
      new OptionalWorldSystem(
        scene,
        options,
      );

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
    };
  }

  dispose() {
    this.performance.dispose();
    this.optionalWorld.dispose();
  }
}
