// SKYLINE_V5_1_PHYSICS_PERFORMANCE
import * as THREE from '../vendor/three.module.min.js';

const direction =
  new THREE.Vector3();

function clamp(
  value,
  min,
  max,
) {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function smoothstep(
  min,
  max,
  value,
) {
  const t =
    clamp(
      (
        value -
        min
      ) /
        Math.max(
          1e-6,
          max - min,
        ),
      0,
      1,
    );

  return (
    t *
    t *
    (
      3 -
      2 *
        t
    )
  );
}

export class SandboxDynamicsSystem {
  constructor() {
    this.pendingBoosts = 0;
    this.boostChain = 0;
    this.chainTimer = 0;

    this.boostRemaining = 0;
    this.boostRate = 0;
    this.boostVisual = 0;

    this.lastGate = '';

    this._onBoostRing =
      event => {
        this.pendingBoosts += 1;

        this.lastGate =
          event?.detail
            ?.name ||
          'BOOST GATE';
      };

    window.addEventListener(
      'skyline:boost-ring',
      this._onBoostRing,
    );
  }

  _setSpeed(
    flight,
    nextSpeed,
  ) {
    if (
      !flight?.velocity
        ?.isVector3
    ) {
      return;
    }

    direction.copy(
      flight.velocity,
    );

    if (
      direction.lengthSq() <
      1e-8
    ) {
      flight.getForward
        ?.(direction);

      if (
        direction.lengthSq() <
        1e-8
      ) {
        direction.set(
          0,
          0,
          -1,
        );
      }
    }

    direction.normalize();

    flight.speed =
      Math.max(
        0,
        nextSpeed,
      );

    flight.velocity
      .copy(direction)
      .multiplyScalar(
        flight.speed,
      );
  }

  _queueBoost(flight) {
    const speed =
      Math.max(
        0,
        Number(
          flight?.speed,
        ) ||
          flight?.velocity
            ?.length?.() ||
          0,
      );

    this.boostChain =
      this.chainTimer > 0
        ? Math.min(
            8,
            this.boostChain +
              1,
          )
        : 1;

    this.chainTimer = 7;

    /*
     * Noticeable at city speed,
     * progressively gentler at
     * extreme speed.
     *
     * No hard speed cap is added.
     */
    const highSpeedDamping =
      1 -
      0.58 *
        smoothstep(
          180,
          1100,
          speed,
        );

    const ratio =
      (
        0.095 +
        (
          this.boostChain -
          1
        ) *
          0.005
      ) *
      highSpeedDamping;

    const minimum =
      4.5 +
      Math.min(
        5,
        this.boostChain,
      ) *
        0.5;

    const deltaSpeed =
      Math.max(
        minimum,
        speed *
          ratio,
      );

    /*
     * The impulse is distributed across
     * fixed physics steps instead of one
     * render frame.
     */
    this.boostRemaining +=
      deltaSpeed;

    this.boostRate =
      Math.max(
        this.boostRate,
        deltaSpeed /
          0.62,
      );

    this.boostVisual = 1;

    flight.boostAmount = 1;
    flight.boostChain =
      this.boostChain;

    flight.boostJustTriggered =
      true;

    window.dispatchEvent(
      new CustomEvent(
        'skyline:boost-fired',
        {
          detail: {
            impulse:
              deltaSpeed,

            targetSpeed:
              speed +
              deltaSpeed,

            speed,

            chain:
              this.boostChain,

            name:
              this.lastGate,
          },
        },
      ),
    );
  }

  update(
    dt,
    flight,
    phase = 'flying',
  ) {
    const safeDt =
      clamp(
        Number(dt) || 0,
        0,
        1 / 30,
      );

    if (
      !flight ||
      phase !== 'flying'
    ) {
      return;
    }

    while (
      this.pendingBoosts > 0
    ) {
      this.pendingBoosts -= 1;
      this._queueBoost(
        flight,
      );
    }

    if (
      this.boostRemaining >
      1e-6
    ) {
      const addition =
        Math.min(
          this.boostRemaining,
          this.boostRate *
            safeDt,
        );

      this.boostRemaining -=
        addition;

      this._setSpeed(
        flight,
        Math.max(
          0,
          Number(
            flight.speed,
          ) || 0,
        ) +
          addition,
      );
    } else {
      this.boostRemaining = 0;
      this.boostRate = 0;
    }

    this.chainTimer =
      Math.max(
        0,
        this.chainTimer -
          safeDt,
      );

    if (
      this.chainTimer === 0
    ) {
      this.boostChain = 0;
    }

    this.boostVisual =
      Math.max(
        0,
        this.boostVisual -
          safeDt *
            1.35,
      );

    flight.boostAmount =
      Math.max(
        this.boostVisual,

        this.boostRemaining >
          0
          ? 0.18
          : 0,
      );

    flight.boostChain =
      this.boostChain;

    /*
     * FlightModel is now the sole owner
     * of stall and low-speed recovery.
     * The previous duplicate recovery
     * system has been removed.
     */
  }

  dispose() {
    window.removeEventListener(
      'skyline:boost-ring',
      this._onBoostRing,
    );
  }
}
