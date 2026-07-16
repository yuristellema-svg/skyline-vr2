const finite = value => Number.isFinite(value);

export const WORKER_AIRFRAME_PROFILES = Object.freeze({
  zero: Object.freeze({
    id: 'zero',
    name: 'A6M ZERO · WHITE 872',
    audioIdentity: 'zero',
    aiIdentity: 'zero-fighter',
    powered: true,
    propeller: true,
    hardSpeedCap: null,
    energyBias: 0.11,
    dragScale: 0.96,
    turnDragScale: 0.88,
    misalignmentDragScale: 0.92,
    pitchRateScale: 1.08,
    rollRateScale: 1.16,
    angularResponseScale: 1.08,
    angularReleaseScale: 1.10,
    coordinatedTurnScale: 1.08,
    liftScale: 1.06,
    stallSpeedScale: 0.93,
    lowSpeedAuthority: 0.78,
    rotationalInertia: 0.78,
    climbRetentionScale: 1.08,
    highSpeedControlStart: 105,
    highSpeedControlFull: 440,
    highSpeedControlFloor: 0.52,
    recoveryNoseDownScale: 0.92,
    overspeedStart: 205,
    overspeedDrag: 0.00082,
    maxOverspeedDrag: 14,
    structuralPositiveG: 10.5,
    structuralNegativeG: -4.8,
    stressRateScale: 1.0,
  }),

  stuka: Object.freeze({
    id: 'stuka',
    name: 'JU 87 STUKA',
    audioIdentity: 'stuka',
    aiIdentity: 'stuka-dive-bomber',
    powered: true,
    propeller: true,
    hardSpeedCap: null,
    energyBias: 0.07,
    dragScale: 1.10,
    turnDragScale: 1.22,
    misalignmentDragScale: 1.14,
    pitchRateScale: 0.76,
    rollRateScale: 0.68,
    angularResponseScale: 0.78,
    angularReleaseScale: 0.84,
    coordinatedTurnScale: 0.82,
    liftScale: 0.96,
    stallSpeedScale: 1.08,
    lowSpeedAuthority: 0.60,
    rotationalInertia: 1.30,
    climbRetentionScale: 0.88,
    highSpeedControlStart: 92,
    highSpeedControlFull: 390,
    highSpeedControlFloor: 0.46,
    recoveryNoseDownScale: 1.06,
    overspeedStart: 235,
    overspeedDrag: 0.00092,
    maxOverspeedDrag: 16,
    structuralPositiveG: 8.5,
    structuralNegativeG: -4.0,
    stressRateScale: 1.15,
  }),

  scout: Object.freeze({
    id: 'scout',
    name: 'ALPINE SCOUT',
    audioIdentity: 'scout',
    aiIdentity: 'alpine-scout',
    powered: true,
    propeller: true,
    hardSpeedCap: null,
    energyBias: 0.13,
    dragScale: 0.84,
    turnDragScale: 0.80,
    misalignmentDragScale: 0.86,
    pitchRateScale: 1.20,
    rollRateScale: 1.28,
    angularResponseScale: 1.18,
    angularReleaseScale: 1.16,
    coordinatedTurnScale: 1.12,
    liftScale: 1.04,
    stallSpeedScale: 0.88,
    lowSpeedAuthority: 0.82,
    rotationalInertia: 0.67,
    climbRetentionScale: 1.02,
    highSpeedControlStart: 88,
    highSpeedControlFull: 350,
    highSpeedControlFloor: 0.50,
    recoveryNoseDownScale: 0.96,
    overspeedStart: 165,
    overspeedDrag: 0.00110,
    maxOverspeedDrag: 15,
    structuralPositiveG: 7.6,
    structuralNegativeG: -3.6,
    stressRateScale: 1.08,
  }),

  glider: Object.freeze({
    id: 'glider',
    name: 'SKYLINE GLIDER',
    audioIdentity: 'glider',
    aiIdentity: 'skyline-sailplane',
    powered: false,
    propeller: false,
    hardSpeedCap: null,
    energyBias: 0,
    engineEnergyScale: 0,
    dragScale: 0.36,
    turnDragScale: 0.72,
    misalignmentDragScale: 0.70,
    pitchRateScale: 0.88,
    rollRateScale: 0.86,
    angularResponseScale: 0.86,
    angularReleaseScale: 0.90,
    coordinatedTurnScale: 0.98,
    liftScale: 1.36,
    stallSpeedScale: 0.68,
    lowSpeedAuthority: 0.70,
    rotationalInertia: 1.12,
    climbRetentionScale: 1.22,
    glideEfficiency: 0.94,
    highSpeedControlStart: 72,
    highSpeedControlFull: 250,
    highSpeedControlFloor: 0.42,
    recoveryNoseDownScale: 1.18,
    overspeedStart: 118,
    overspeedDrag: 0.00072,
    maxOverspeedDrag: 10,
    structuralPositiveG: 5.8,
    structuralNegativeG: -2.6,
    stressRateScale: 1.30,
  }),
});

export const AIRFRAME_PROFILE_IDS = Object.freeze(Object.keys(WORKER_AIRFRAME_PROFILES));

export function resolveAirframeProfile(value) {
  const id = typeof value === 'string' ? value : value?.id;
  return WORKER_AIRFRAME_PROFILES[id] ?? WORKER_AIRFRAME_PROFILES.zero;
}

export function validateAirframeProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') return ['profile missing'];
  if (!profile.id) errors.push('id missing');
  if (!profile.name) errors.push('name missing');
  if (!profile.audioIdentity) errors.push('audio identity missing');
  if (!profile.aiIdentity) errors.push('AI identity missing');
  if (profile.hardSpeedCap !== null) errors.push('hard speed cap must remain null');

  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'number' && !finite(value)) errors.push(`${key} is not finite`);
  }

  if (!profile.powered && (profile.energyBias > 0 || (profile.engineEnergyScale ?? 0) > 0)) {
    errors.push('unpowered aircraft has positive engine energy');
  }
  return errors;
}

export function softControlScale(profile, speed) {
  const start = profile.highSpeedControlStart;
  const full = Math.max(start + 1, profile.highSpeedControlFull);
  const t = Math.max(0, Math.min(1, (Math.max(0, speed) - start) / (full - start)));
  const smooth = t * t * (3 - 2 * t);
  return 1 + (profile.highSpeedControlFloor - 1) * smooth;
}

export function structuralWarningData(profile, { speed = 0, gLoad = 1 } = {}) {
  const overSpeed = Math.max(0, (speed - profile.overspeedStart) / Math.max(1, profile.overspeedStart));
  const positive = Math.max(0, gLoad / profile.structuralPositiveG - 1);
  const negative = Math.max(0, Math.abs(Math.min(0, gLoad)) / Math.abs(profile.structuralNegativeG) - 1);
  const stress = Math.max(overSpeed * 0.72, positive, negative) * profile.stressRateScale;
  return Object.freeze({
    overspeedRatio: overSpeed,
    structuralStress: Math.max(0, Math.min(1, stress)),
    warning: stress > 0.08,
    softOnly: true,
  });
}
