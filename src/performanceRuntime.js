// SKYLINE_V5_1_PHYSICS_PERFORMANCE
// SKYLINE_BUNDLE_B_PHONE_PERFORMANCE

const LEVELS = Object.freeze([
  Object.freeze({
    id: 'full',
    name: 'FULL',
    cloudFraction: 1,
    cloudCadence: 1,
    aiCadence: 1,
    contrailCadence: 1,
    contrails: true,
  }),
  Object.freeze({
    id: 'balanced',
    name: 'BALANCED',
    cloudFraction: 0.78,
    cloudCadence: 2,
    aiCadence: 1,
    contrailCadence: 2,
    contrails: true,
  }),
  Object.freeze({
    id: 'reduced',
    name: 'REDUCED',
    cloudFraction: 0.52,
    cloudCadence: 3,
    aiCadence: 2,
    contrailCadence: 4,
    contrails: true,
  }),
  Object.freeze({
    id: 'minimal',
    name: 'MINIMAL',
    cloudFraction: 0.30,
    cloudCadence: 6,
    aiCadence: 3,
    contrailCadence: 12,
    contrails: false,
  }),
]);

function finite(value, fallback = 0) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function average(values) {
  if (!values.length) return 0;

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) /
    values.length
  );
}

function percentile(values, fraction) {
  if (!values.length) return 0;

  const sorted = [
    ...values,
  ].sort(
    (a, b) =>
      a - b,
  );

  const index =
    Math.min(
      sorted.length - 1,
      Math.max(
        0,
        Math.ceil(
          sorted.length *
            fraction,
        ) - 1,
      ),
    );

  return sorted[index];
}

function setVisible(object, visible) {
  if (
    object &&
    'visible' in object
  ) {
    object.visible =
      visible;
  }
}

function nowMilliseconds() {
  return (
    globalThis.performance
      ?.now?.() ??
    Date.now()
  );
}

export class PerformanceRuntime {
  constructor(
    optionalWorld,
    options = {},
  ) {
    this.optionalWorld =
      optionalWorld;

    this.registry =
      optionalWorld?.registry ??
      null;

    const coarsePointer =
      Boolean(
        globalThis.matchMedia
          ?.('(pointer: coarse)')
          ?.matches
      ) ||
      (
        Number(
          globalThis.navigator
            ?.maxTouchPoints
        ) || 0
      ) > 0;

    this.coarsePointer =
      coarsePointer;

    this.targetFps =
      coarsePointer
        ? 50
        : (
            options.targetFps ??
            60
          );

    this.maxDrawCalls =
      options.maxDrawCalls ??
      420;

    this.maxTriangles =
      options.maxTriangles ??
      1200000;

    this.levelIndex =
      this.coarsePointer
        ? 2
        : 0;

    this.frameIndex = 0;

    this.pressureTime = 0;
    this.severeTime = 0;
    this.headroomTime = 0;
    this.cooldown = 0;

    this.frameTimes = [];
    this.physicsPressure = [];
    this.droppedFrames = [];
    this.drawCalls = [];
    this.triangles = [];

    this.systemCosts =
      new Map();

    this.accumulatedDt =
      new Map();

    this.currentFrameDt = 0;

    this.originalInvoke =
      this.registry
        ?.invoke
        ?.bind(
          this.registry,
        ) ??
      null;

    if (
      this.registry &&
      this.originalInvoke
    ) {
      this.registry.invoke =
        (
          name,
          method,
          ...args
        ) =>
          this._invoke(
            name,
            method,
            ...args,
          );
    }
  }

  get level() {
    return LEVELS[
      this.levelIndex
    ];
  }

  _push(
    collection,
    value,
    limit = 180,
  ) {
    collection.push(
      Math.max(
        0,
        finite(value),
      ),
    );

    while (
      collection.length >
      limit
    ) {
      collection.shift();
    }
  }

  _cadence(name) {
    if (
      name === 'clouds'
    ) {
      return this.level
        .cloudCadence;
    }

    if (
      name ===
      'AI aircraft'
    ) {
      return this.level
        .aiCadence;
    }

    if (
      name ===
      'contrails'
    ) {
      return this.level
        .contrailCadence;
    }

    return 1;
  }

  _invoke(
    name,
    method,
    ...args
  ) {
    if (
      !this.originalInvoke
    ) {
      return undefined;
    }

    if (
      method === 'update'
    ) {
      const cadence =
        Math.max(
          1,
          this._cadence(
            name,
          ),
        );

      const accumulated =
        (
          this.accumulatedDt
            .get(name) ??
          0
        ) +
        Math.max(
          0,
          finite(
            args[0],
          ),
        );

      this.accumulatedDt
        .set(
          name,
          accumulated,
        );

      if (
        cadence > 1 &&
        this.frameIndex %
          cadence !==
          0
      ) {
        return undefined;
      }

      args[0] =
        accumulated;

      this.accumulatedDt
        .set(
          name,
          0,
        );
    }

    const started =
      nowMilliseconds();

    const result =
      this.originalInvoke(
        name,
        method,
        ...args,
      );

    const cost =
      nowMilliseconds() -
      started;

    if (
      !this.systemCosts
        .has(name)
    ) {
      this.systemCosts
        .set(
          name,
          [],
        );
    }

    this._push(
      this.systemCosts
        .get(name),
      cost,
      120,
    );

    return result;
  }

  _system(name) {
    return (
      this.registry
        ?.get?.(name) ??
      null
    );
  }

  _applyQuality() {
    const clouds =
      this._system(
        'clouds',
      );

    if (
      Array.isArray(
        clouds?.clouds,
      )
    ) {
      const visibleCount =
        Math.max(
          2,
          Math.ceil(
            clouds.clouds.length *
              this.level
                .cloudFraction,
          ),
        );

      clouds.clouds
        .forEach(
          (
            cloud,
            index,
          ) => {
            setVisible(
              cloud,
              index <
                visibleCount,
            );
          },
        );
    }

    /*
     * All AI silhouettes stay visible.
     * Only their update cadence changes,
     * preventing invisible collision targets.
     */
    const ai =
      this._system(
        'AI aircraft',
      );

    if (
      Array.isArray(
        ai?.aircraft,
      )
    ) {
      ai.aircraft.forEach(
        entry => {
          setVisible(
            entry?.model,
            true,
          );
        },
      );
    }

    const contrails =
      this._system(
        'contrails',
      );

    setVisible(
      contrails?.root,
      this.level
        .contrails,
    );

    setVisible(
      contrails
        ?.left?.line,
      this.level
        .contrails,
    );

    setVisible(
      contrails
        ?.right?.line,
      this.level
        .contrails,
    );

    /*
     * Terrain and distant-city visibility
     * are deliberately never changed.
     */
  }

  beginFrame(
    dt,
    details = {},
  ) {
    this.currentFrameDt =
      Math.max(
        0,
        finite(dt),
      );

    this.frameIndex += 1;

    this._push(
      this.frameTimes,
      this.currentFrameDt *
        1000,
    );

    const physicsSteps =
      Math.max(
        0,
        finite(
          details
            .physicsSteps,
        ),
      );

    const maxSubSteps =
      Math.max(
        1,
        finite(
          details
            .maxSubSteps,
          1,
        ),
      );

    this._push(
      this.physicsPressure,
      physicsSteps /
        maxSubSteps,
    );

    this._push(
      this.droppedFrames,
      details.dropped
        ? 1
        : 0,
    );
  }

  endFrame(
    render = {},
  ) {
    this._push(
      this.drawCalls,
      finite(
        render.calls,
      ),
    );

    this._push(
      this.triangles,
      finite(
        render.triangles,
      ),
    );

    const state =
      this.getState();

    const metrics =
      state.metrics;

    const targetMs =
      1000 /
      this.targetFps;

    const pressure =
      metrics.fps <
        this.targetFps *
          0.86 ||
      metrics.p95FrameMs >
        targetMs *
          1.22 ||
      metrics
        .physicsPressure >
        0.86 ||
      metrics.droppedRatio >
        0.018 ||
      metrics.drawCalls >
        this.maxDrawCalls ||
      metrics.triangles >
        this.maxTriangles;

    const severe =
      metrics.fps <
        this.targetFps *
          0.64 ||
      metrics.p95FrameMs >
        targetMs *
          1.75 ||
      metrics
        .physicsPressure >
        0.97 ||
      metrics.droppedRatio >
        0.06;

    const headroom =
      metrics.fps >
        this.targetFps *
          0.96 &&
      metrics.p95FrameMs <
        targetMs *
          1.08 &&
      metrics
        .physicsPressure <
        0.62 &&
      metrics.droppedRatio <
        0.005 &&
      metrics.drawCalls <
        this.maxDrawCalls *
          0.82 &&
      metrics.triangles <
        this.maxTriangles *
          0.82;

    const dt =
      Math.min(
        0.25,
        this.currentFrameDt,
      );

    this.cooldown =
      Math.max(
        0,
        this.cooldown -
          dt,
      );

    this.pressureTime =
      pressure
        ? this.pressureTime +
          dt
        : 0;

    this.severeTime =
      severe
        ? this.severeTime +
          dt
        : 0;

    this.headroomTime =
      headroom
        ? this.headroomTime +
          dt
        : 0;

    let changed = false;

    if (
      this.cooldown <= 0 &&
      this.levelIndex <
        LEVELS.length - 1 &&
      (
        this.pressureTime >=
          2.5 ||
        this.severeTime >=
          1.2
      )
    ) {
      this.levelIndex += 1;
      this.cooldown = 6;
      this.pressureTime = 0;
      this.severeTime = 0;
      this.headroomTime = 0;
      changed = true;
    } else if (
      this.cooldown <= 0 &&
      this.levelIndex > 0 &&
      this.headroomTime >=
        12
    ) {
      this.levelIndex -= 1;
      this.cooldown = 15;
      this.pressureTime = 0;
      this.severeTime = 0;
      this.headroomTime = 0;
      changed = true;
    }

    if (changed) {
      this._applyQuality();

      try {
        globalThis.window
          ?.dispatchEvent?.(
            new CustomEvent(
              'skyline:quality-changed',
              {
                detail: {
                  level:
                    this.level.id,
                  name:
                    this.level.name,
                  metrics,
                },
              },
            ),
          );
      } catch {
        /*
         * Diagnostics may never interrupt
         * physics or rendering.
         */
      }
    }
  }

  getState() {
    const averageFrame =
      average(
        this.frameTimes,
      );

    const systems = {};

    for (
      const [
        name,
        costs,
      ] of
      this.systemCosts
    ) {
      systems[name] = {
        averageMs:
          average(costs),
        p95Ms:
          percentile(
            costs,
            0.95,
          ),
        maximumMs:
          costs.length
            ? Math.max(
                ...costs,
              )
            : 0,
        lastMs:
          costs.at(-1) ??
          0,
      };
    }

    return {
      level:
        this.level.id,
      levelName:
        this.level.name,

      metrics: {
        fps:
          averageFrame > 0
            ? 1000 /
              averageFrame
            : 0,

        averageFrameMs:
          averageFrame,

        p95FrameMs:
          percentile(
            this.frameTimes,
            0.95,
          ),

        physicsPressure:
          average(
            this.physicsPressure,
          ),

        droppedRatio:
          average(
            this.droppedFrames,
          ),

        drawCalls:
          average(
            this.drawCalls,
          ),

        triangles:
          average(
            this.triangles,
          ),

        systems,
      },
    };
  }

  dispose() {
    if (
      this.registry &&
      this.originalInvoke
    ) {
      this.registry.invoke =
        this.originalInvoke;
    }

    this.levelIndex = 0;
    this._applyQuality();
  }
}
