import {
  clamp,
  speedOf,
  stallAmountOf,
  verticalSpeedOf,
} from './engineTargets.js';
import { resolveSoundProfile } from './profiles.js';

export const WARNING_PRIORITY = Object.freeze({
  pull_up: 4,
  terrain: 3,
  low_speed: 2,
  stress: 1,
  none: 0,
});

export const WARNING_QUALIFY_SECONDS = Object.freeze({
  pull_up: 0.12,
  terrain: 0.18,
  low_speed: 0.34,
  stress: 0.48,
});

export const WARNING_REPEAT_SECONDS = Object.freeze({
  pull_up: 2.2,
  terrain: 3.0,
  low_speed: 4.2,
  stress: 5.0,
});

function sampleHeightSafe(sampleHeight, x, z) {
  if (typeof sampleHeight !== 'function') return 0;
  try {
    const value = sampleHeight(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function sampleTerrainApproach(flight, sampleHeight) {
  const position = flight?.position;
  if (!position || !Number.isFinite(position.y)) {
    return {
      available: false,
      currentTerrain: 0,
      agl: Infinity,
      minClearance: Infinity,
      projectedImpactSeconds: Infinity,
      terrainRiseRate: 0,
    };
  }

  const vx = Number.isFinite(flight?.velocity?.x) ? flight.velocity.x : 0;
  const vz = Number.isFinite(flight?.velocity?.z) ? flight.velocity.z : 0;
  const vy = verticalSpeedOf(flight);
  const currentTerrain = sampleHeightSafe(sampleHeight, position.x, position.z);
  const agl = position.y - currentTerrain;
  let minClearance = agl;
  let projectedImpactSeconds = Infinity;
  let previousTerrain = currentTerrain;
  let previousSeconds = 0;
  let terrainRiseRate = 0;

  for (const seconds of [0.4, 0.8, 1.2, 1.6, 2, 2.5, 3, 3.5, 4]) {
    const terrain = sampleHeightSafe(
      sampleHeight,
      position.x + vx * seconds,
      position.z + vz * seconds,
    );
    const predictedY = position.y + vy * seconds;
    const clearance = predictedY - terrain;
    minClearance = Math.min(minClearance, clearance);
    terrainRiseRate = Math.max(
      terrainRiseRate,
      (terrain - previousTerrain) / Math.max(0.4, seconds - previousSeconds),
    );
    previousTerrain = terrain;
    previousSeconds = seconds;
    if (clearance <= 0 && !Number.isFinite(projectedImpactSeconds)) {
      projectedImpactSeconds = seconds;
    }
  }

  return {
    available: true,
    currentTerrain,
    agl,
    minClearance,
    projectedImpactSeconds,
    terrainRiseRate,
  };
}

export function computeWarningConditions(profileValue, flight, sampleHeight, phase = 'flying') {
  const profile = resolveSoundProfile(profileValue);
  const terrain = sampleTerrainApproach(flight, sampleHeight);
  const speed = speedOf(flight);
  const verticalSpeed = verticalSpeedOf(flight);
  const descentRate = Math.max(0, -verticalSpeed);
  const stall = stallAmountOf(flight);
  const loadFactor = Math.max(0, Number(
    flight?.loadFactor ??
    flight?.gForce ??
    flight?.currentG ??
    1,
  ) || 1);
  const active = phase === 'flying' && terrain.available;
  const closingRate = descentRate + Math.max(0, terrain.terrainRiseRate);
  const pullAltitude = Math.max(52, closingRate * 3.0, speed * 0.14);
  const terrainAltitude = Math.max(105, closingRate * 5.1, speed * 0.25);

  const pullUp = active &&
    descentRate > 8 &&
    terrain.agl < pullAltitude &&
    terrain.projectedImpactSeconds <= 2.5;

  const terrainWarning = active &&
    !pullUp &&
    descentRate > 5 &&
    terrain.agl < terrainAltitude &&
    terrain.projectedImpactSeconds <= 4.0;

  const lowSpeed = active &&
    terrain.agl < 82 &&
    speed < profile.lowSpeedOn &&
    verticalSpeed < 2.5 &&
    (descentRate > 2.5 || stall > 0.42);

  const stress = phase === 'flying' && (
    speed > (profile.id === 'glider' ? 150 : profile.id === 'scout' ? 220 : 250) ||
    loadFactor > (profile.id === 'glider' ? 4.2 : 5.2)
  );

  return {
    profile,
    terrain,
    speed,
    verticalSpeed,
    descentRate,
    stall,
    loadFactor,
    pull_up: pullUp,
    terrain_warning: terrainWarning,
    low_speed: lowSpeed,
    stress,
  };
}

export function selectWarning(conditions) {
  const candidates = [
    conditions.pull_up ? 'pull_up' : null,
    conditions.terrain_warning ? 'terrain' : null,
    conditions.low_speed ? 'low_speed' : null,
    conditions.stress ? 'stress' : null,
  ].filter(Boolean);
  return candidates.sort((a, b) => WARNING_PRIORITY[b] - WARNING_PRIORITY[a])[0] || 'none';
}

function shouldClear(active, conditions) {
  if (active === 'pull_up') {
    return !conditions.pull_up && (
      conditions.terrain.agl > 78 ||
      conditions.verticalSpeed > -4 ||
      conditions.terrain.projectedImpactSeconds > 3.2
    );
  }
  if (active === 'terrain') {
    return !conditions.terrain_warning && !conditions.pull_up && (
      conditions.terrain.agl > 145 ||
      conditions.verticalSpeed > -2 ||
      conditions.terrain.projectedImpactSeconds > 5
    );
  }
  if (active === 'low_speed') {
    return conditions.speed > conditions.profile.lowSpeedOff ||
      conditions.terrain.agl > 118 ||
      conditions.verticalSpeed > 4;
  }
  if (active === 'stress') {
    return conditions.speed < (conditions.profile.id === 'glider' ? 132 : 218) &&
      conditions.loadFactor < (conditions.profile.id === 'glider' ? 3.5 : 4.2);
  }
  return true;
}

export class WarningController {
  constructor() {
    this.fixedStep = 1 / 120;
    this.accumulator = 0;
    this.time = 0;
    this.qualifying = 'none';
    this.qualifyingTime = 0;
    this.active = 'none';
    this.clearTime = 0;
    this.lastEmit = new Map();
  }

  reset() {
    this.accumulator = 0;
    this.time = 0;
    this.qualifying = 'none';
    this.qualifyingTime = 0;
    this.active = 'none';
    this.clearTime = 0;
    this.lastEmit.clear();
  }

  update(dt, profileValue, flight, sampleHeight, phase = 'flying') {
    const events = [];
    this.accumulator += clamp(dt, 0, 0.25);
    while (this.accumulator + 1e-12 >= this.fixedStep) {
      this.accumulator -= this.fixedStep;
      this.time += this.fixedStep;
      const conditions = computeWarningConditions(
        profileValue,
        flight,
        sampleHeight,
        phase,
      );
      const desired = selectWarning(conditions);

      if (this.active !== 'none') {
        if (shouldClear(this.active, conditions)) {
          this.clearTime += this.fixedStep;
          if (this.clearTime >= 0.28) {
            this.active = 'none';
            this.clearTime = 0;
          }
        } else {
          this.clearTime = 0;
        }
      }

      if (desired === 'none') {
        this.qualifying = 'none';
        this.qualifyingTime = 0;
        continue;
      }

      if (this.qualifying !== desired) {
        this.qualifying = desired;
        this.qualifyingTime = 0;
      }
      this.qualifyingTime += this.fixedStep;

      const last = this.lastEmit.get(desired) ?? -Infinity;
      const cooldownReady = this.time - last >= WARNING_REPEAT_SECONDS[desired];
      const priorityUpgrade = WARNING_PRIORITY[desired] > WARNING_PRIORITY[this.active];
      const canEmit = this.qualifyingTime >= WARNING_QUALIFY_SECONDS[desired] &&
        cooldownReady &&
        (this.active === 'none' || this.active === desired || priorityUpgrade);

      if (canEmit) {
        this.active = desired;
        this.clearTime = 0;
        this.lastEmit.set(desired, this.time);
        events.push({ id: desired, time: this.time, conditions });
      }
    }
    return events;
  }
}
