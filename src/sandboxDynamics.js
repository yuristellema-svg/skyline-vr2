import * as THREE from '../vendor/three.module.min.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const direction = new THREE.Vector3();
const recoveryDirection = new THREE.Vector3();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(min, max, value) {
  const x = clamp((value - min) / Math.max(1e-6, max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

export class SandboxDynamicsSystem {
  constructor() {
    this.pendingBoosts = 0;
    this.boostChain = 0;
    this.chainTimer = 0;
    this.boostGlow = 0;
    this.lastGate = '';

    this._onBoostRing = event => {
      this.pendingBoosts += 1;
      this.lastGate = event?.detail?.name || 'BOOST GATE';
    };

    window.addEventListener('skyline:boost-ring', this._onBoostRing);
  }

  _setSpeed(flight, nextSpeed) {
    if (!flight?.velocity?.isVector3) return;

    direction.copy(flight.velocity);
    if (direction.lengthSq() < 1e-8) {
      flight.getForward?.(direction);
      if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
    }
    direction.normalize();

    flight.speed = Math.max(0, nextSpeed);
    flight.velocity.copy(direction).multiplyScalar(flight.speed);
  }

  _applyBoost(flight) {
    const speed = Math.max(0, Number(flight?.speed) || flight?.velocity?.length?.() || 0);
    this.boostChain = this.chainTimer > 0 ? Math.min(12, this.boostChain + 1) : 1;
    this.chainTimer = 7;

    // Percentage-based impulse keeps every gate meaningful at any speed.
    // 50 km/s is only a numerical guardrail, not a normal gameplay cap.
    const impulse = Math.max(42, speed * (0.24 + this.boostChain * 0.012));
    this._setSpeed(flight, Math.min(50000, speed + impulse));

    this.boostGlow = 1;
    flight.boostAmount = 1;
    flight.boostChain = this.boostChain;
    flight.boostJustTriggered = true;

    window.dispatchEvent(new CustomEvent('skyline:boost-fired', {
      detail: {
        impulse,
        speed: flight.speed,
        chain: this.boostChain,
        name: this.lastGate,
      },
    }));
  }

  update(dt, flight, phase = 'flying') {
    const safeDt = clamp(dt || 0, 0, 0.1);
    if (!flight || phase !== 'flying') return;

    if (this.pendingBoosts > 0) {
      this.pendingBoosts -= 1;
      this._applyBoost(flight);
    }

    this.chainTimer = Math.max(0, this.chainTimer - safeDt);
    if (this.chainTimer === 0) this.boostChain = 0;
    this.boostGlow = Math.max(0, this.boostGlow - safeDt * 1.25);
    flight.boostAmount = this.boostGlow;
    flight.boostChain = this.boostChain;

    const speed = Math.max(0, Number(flight.speed) || flight.velocity?.length?.() || 0);
    const pathAngle = Number.isFinite(flight.pathAngle) ? flight.pathAngle : 0;

    // The base model intentionally reports its maneuver losses. Return most of
    // that energy at city speeds, progressively less at extreme speeds.
    const maneuverLoss = Math.max(0, Number(flight.maneuverDragAcceleration) || 0);
    const lowSpeedProtection = 1 - smoothstep(48, 185, speed);
    const refundedAcceleration = maneuverLoss * (0.84 * lowSpeedProtection + 0.18);

    // Mild low-speed energy recovery. It fades completely before normal cruise
    // and never helps a steep climb, so dives and altitude still matter.
    const recoveryWindow = 1 - smoothstep(24, 44, speed);
    const climbPenalty = smoothstep(0.08, 0.42, pathAngle);
    const lowSpeedAcceleration = 5.6 * recoveryWindow * (1 - climbPenalty);

    if (refundedAcceleration + lowSpeedAcceleration > 0) {
      this._setSpeed(
        flight,
        speed + (refundedAcceleration + lowSpeedAcceleration) * safeDt,
      );
    }

    const correctedSpeed = Math.max(0, Number(flight.speed) || 0);

    // At very low energy the craft cannot hang motionless. Lift fades, the
    // flight path settles downward and gravity rebuilds airspeed continuously.
    if (correctedSpeed < 14 && flight.velocity?.isVector3) {
      direction.copy(flight.velocity);
      if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
      direction.normalize();

      const recovery = 1 - smoothstep(4, 14, correctedSpeed);
      recoveryDirection
        .copy(direction)
        .lerp(DOWN, clamp(safeDt * (0.55 + recovery * 1.75), 0, 0.22))
        .normalize();

      const nextSpeed = Math.max(
        2.4,
        correctedSpeed + (3.2 + recovery * 7.8) * safeDt,
      );

      flight.speed = nextSpeed;
      flight.velocity.copy(recoveryDirection).multiplyScalar(nextSpeed);
      flight.lowSpeedRecoveryActive = true;
    }
  }

  dispose() {
    window.removeEventListener('skyline:boost-ring', this._onBoostRing);
  }
}
