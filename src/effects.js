import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp, damp, smoothstep } from './config.js';
import { SkyDecorSystem } from './skyDecor.js';

const INTENSITY_LEVELS = Object.freeze([
  Object.freeze({ name: 'COMFORT', multiplier: 0.42, shake: 0.16 }),
  Object.freeze({ name: 'STANDARD', multiplier: 0.72, shake: 0.34 }),
  Object.freeze({ name: 'FULL', multiplier: 1, shake: 0.58 }),
  Object.freeze({ name: 'OFF', multiplier: 0, shake: 0 }),
]);

function flightSpeed(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  if (flight?.velocity?.isVector3) return flight.velocity.length();
  return 0;
}

function readLoadFactor(flight) {
  const candidates = [
    flight?.gLoad,
    flight?.loadFactor,
    flight?.gForce,
    flight?.currentG,
  ];
  for (const value of candidates) if (Number.isFinite(value)) return value;
  return 1;
}

function readStall(flight) {
  const candidates = [flight?.stallAmount, flight?.stallSeverity, flight?.stall];
  for (const value of candidates) if (Number.isFinite(value)) return clamp(value, 0, 1);
  return 0;
}

function readBoost(flight) {
  const candidates = [flight?.boostAmount, flight?.boostActive, flight?.boostTimer];
  for (const value of candidates) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (Number.isFinite(value)) return clamp(value, 0, 1);
  }
  return 0;
}

function makeStreakGeometry(count, depth, radius) {
  const positions = new Float32Array(count * 2 * 3);
  const seeds = new Float32Array(count * 4);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radial = radius * (0.25 + Math.random() * 0.75);
    const z = -2 - Math.random() * depth;
    const length = 0.15 + Math.random() * 0.55;
    const x = Math.cos(angle) * radial;
    const y = Math.sin(angle) * radial * 0.62;
    const index = i * 6;
    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
    positions[index + 3] = x;
    positions[index + 4] = y;
    positions[index + 5] = z - length;
    seeds[i * 4] = angle;
    seeds[i * 4 + 1] = radial;
    seeds[i * 4 + 2] = z;
    seeds[i * 4 + 3] = length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.userData.seeds = seeds;
  return geometry;
}

// SKYLINE_V5_INTEGRATION
// SKYLINE_BUNDLE_B_G_FORCE
export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.intensityIndex = 1;
    this.intensityName = INTENSITY_LEVELS[this.intensityIndex].name;

    this.vignette = 0;
    this.redTint = 0;
    this.viewSqueeze = 0;

    this.positiveGExposure = 0;
    this.negativeGExposure = 0;
    this.blackout = 0;
    this.redout = 0;

    this.shakePitch = 0;
    this.shakeYaw = 0;
    this.shakeRoll = 0;

    this.elapsed = 0;
    this.sessionElapsed = 0;
    this.camera = null;

    const count = Math.min(180, Math.max(48, CONFIG.effects?.streakCount || 120));
    this.streakDepth = CONFIG.effects?.streakDepth || 65;
    this.streakRadius = CONFIG.effects?.streakRadius || 10;
    this.streakGeometry = makeStreakGeometry(count, this.streakDepth, this.streakRadius);
    this.streakMaterial = new THREE.LineBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.streaks = new THREE.LineSegments(this.streakGeometry, this.streakMaterial);
    this.streaks.name = 'camera-local-speed-streaks';
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = 3;

    this.skyDecor = new SkyDecorSystem(scene);
  }

  beginSession() {
    this.sessionElapsed = 0;
    this.vignette = 0;
    this.redTint = 0;
    this.viewSqueeze = 0;

    this.positiveGExposure = 0;
    this.negativeGExposure = 0;
    this.blackout = 0;
    this.redout = 0;

    this.shakePitch = 0;
    this.shakeYaw = 0;
    this.shakeRoll = 0;
  }

  cycleIntensity() {
    this.intensityIndex = (this.intensityIndex + 1) % INTENSITY_LEVELS.length;
    this.intensityName = INTENSITY_LEVELS[this.intensityIndex].name;
    return this.intensityName;
  }

  _attachToCamera(camera) {
    if (!camera || this.camera === camera) return;
    if (this.streaks.parent) this.streaks.parent.remove(this.streaks);
    this.camera = camera;
    camera.add(this.streaks);
    this.streaks.position.set(0, 0, 0);
  }

  _updateStreaks(dt, speed, amount) {
    const positions = this.streakGeometry.attributes.position.array;
    const seeds = this.streakGeometry.userData.seeds;
    const movement = dt * (3 + speed * 0.54);

    for (let i = 0; i < seeds.length / 4; i += 1) {
      const seedIndex = i * 4;
      const angle = seeds[seedIndex];
      const radial = seeds[seedIndex + 1];
      let z = seeds[seedIndex + 2] + movement;
      const baseLength = seeds[seedIndex + 3];
      if (z > -0.35) z -= this.streakDepth;
      seeds[seedIndex + 2] = z;

      const spread = 0.72 + amount * 0.52;
      const x = Math.cos(angle) * radial * spread;
      const y = Math.sin(angle) * radial * 0.62 * spread;
      const length = baseLength * (0.8 + amount * 5.2);
      const positionIndex = i * 6;
      positions[positionIndex] = x;
      positions[positionIndex + 1] = y;
      positions[positionIndex + 2] = z;
      positions[positionIndex + 3] = x;
      positions[positionIndex + 4] = y;
      positions[positionIndex + 5] = z - length;
    }

    this.streakGeometry.attributes.position.needsUpdate = true;
  }

  update(dt, flight, camera) {
    const safeDt = clamp(dt || 0, 0, 0.1);
    this.elapsed += safeDt;
    this.sessionElapsed += safeDt;
    this._attachToCamera(camera);

    const level = INTENSITY_LEVELS[this.intensityIndex];
    const speed = flightSpeed(flight);
    const load = readLoadFactor(flight);
    const stall = readStall(flight);
    const boost = readBoost(flight);

    const positiveDose =
      clamp(
        (
          load -
          4.6
        ) /
          5.8,
        0,
        1,
      );

    const negativeDose =
      clamp(
        (
          -load -
          1.25
        ) /
          2.8,
        0,
        1,
      );

    this.positiveGExposure =
      clamp(
        this.positiveGExposure +
          (
            positiveDose > 0
              ? positiveDose *
                safeDt
              : -0.78 *
                safeDt
          ),

        0,
        2.4,
      );

    this.negativeGExposure =
      clamp(
        this.negativeGExposure +
          (
            negativeDose > 0
              ? negativeDose *
                safeDt
              : -1.00 *
                safeDt
          ),

        0,
        1.8,
      );

    const blackoutTarget =
      smoothstep(
        0.50,
        1.75,
        this.positiveGExposure,
      );

    const redoutTarget =
      smoothstep(
        0.32,
        1.15,
        this.negativeGExposure,
      );

    this.blackout =
      damp(
        this.blackout,
        blackoutTarget,
        blackoutTarget >
          this.blackout
          ? 3.4
          : 1.45,
        safeDt,
      );

    this.redout =
      damp(
        this.redout,
        redoutTarget,
        redoutTarget >
          this.redout
          ? 4.2
          : 1.65,
        safeDt,
      );

    if (flight) {
      flight.blackoutAmount =
        this.blackout;

      flight.redoutAmount =
        this.redout;
    }

    const structural =
      clamp(
        Number(
          flight
            ?.structuralStress,
        ) || 0,
        0,
        1,
      );

    const start = CONFIG.effects?.streakStartSpeed ?? 45;
    const full = Math.max(start + 1, CONFIG.effects?.streakFullSpeed ?? 115);
    const speedAmount = smoothstep(start, full, speed);
    const streakTarget = clamp((speedAmount * 0.72 + boost * 0.28) * level.multiplier, 0, 1);
    this.streakMaterial.opacity = damp(this.streakMaterial.opacity, streakTarget * 0.52, 8, safeDt);
    this.streaks.visible = this.streakMaterial.opacity > 0.008;
    if (this.streaks.visible) this._updateStreaks(safeDt, speed, streakTarget);

    const positiveG = smoothstep(
      CONFIG.effects?.gVignetteStart ?? 4,
      CONFIG.effects?.gVignetteFull ?? 7,
      load,
    );
    const negativeG = load < (CONFIG.effects?.negativeGTintStart ?? -0.35)
      ? clamp(Math.abs(load) / 2.2, 0, 1)
      : 0;

    this.vignette = damp(
      this.vignette,
      clamp(
        (
          positiveG * 0.42 +
          speedAmount * 0.05 +
          stall * 0.20 +
          this.blackout * 0.96 +
          structural * 0.10
        ) *
          level.multiplier,
        0,
        0.97,
      ),
      7,
      safeDt,
    );
    const stallWarningTint = stall * stall * 0.11;
    this.redTint = damp(
      this.redTint,
      (
        negativeG * 0.12 +
        this.redout * 0.78 +
        stallWarningTint
      ) *
        level.multiplier,
      6,
      safeDt,
    );
    this.viewSqueeze = damp(
      this.viewSqueeze,
      Math.max(
        positiveG *
          (
            CONFIG.effects
              ?.maxViewSqueeze ??
            0.02
          ),

        this.blackout *
          0.032
      ) *
        level.multiplier,
      8,
      safeDt,
    );

    // VR comfort rule: shake stays tiny and is driven mainly by severe stall.
    const shakeLimit = CONFIG.effects?.maxVrShake ?? (0.18 * Math.PI / 180);
    const shakeAmount = stall * stall * shakeLimit * level.shake;
    this.shakePitch = Math.sin(this.elapsed * 39.1) * shakeAmount;
    this.shakeYaw = Math.sin(this.elapsed * 31.7 + 1.9) * shakeAmount * 0.62;
    this.shakeRoll = Math.sin(this.elapsed * 35.3 + 0.7) * shakeAmount * 0.45;

    this.skyDecor.update(safeDt, camera);
  }

  dispose() {
    this.skyDecor.dispose();
    if (this.streaks.parent) this.streaks.parent.remove(this.streaks);
    this.streakGeometry.dispose();
    this.streakMaterial.dispose();
  }
}
