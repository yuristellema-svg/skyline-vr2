import { DEG, clamp } from './navContracts.js';

export const PHONE_CONTROL_CONFIG = Object.freeze({
  pitchDeadzone: 2.5 * DEG,
  rollDeadzone: 3.0 * DEG,
  pitchFullDeflection: 23 * DEG,
  rollFullDeflection: 27 * DEG,
  responseExponent: 1.4,
  inputSlewSeconds: 0.14,
  pitchMaxRate: 64 * DEG,
  rollMaxRate: 86 * DEG,
  headLookMaxYaw: 88 * DEG,
  headLookResponse: 10,
});

export function shapePhoneAxis(
  deflection,
  {
    deadzone,
    fullDeflection,
    maxRate,
    exponent = PHONE_CONTROL_CONFIG.responseExponent,
  },
) {
  const finite = Number.isFinite(deflection) ? deflection : 0;
  const magnitude = Math.abs(finite);
  if (magnitude <= deadzone) return 0;

  const normalized = clamp(
    (magnitude - deadzone) / Math.max(1e-8, fullDeflection - deadzone),
    0,
    1,
  );

  return Math.sign(finite) * maxRate * Math.pow(normalized, exponent);
}

export function targetPhoneRates(pitchDeflection, rollDeflection) {
  return {
    pitchRate: shapePhoneAxis(pitchDeflection, {
      deadzone: PHONE_CONTROL_CONFIG.pitchDeadzone,
      fullDeflection: PHONE_CONTROL_CONFIG.pitchFullDeflection,
      maxRate: PHONE_CONTROL_CONFIG.pitchMaxRate,
    }),
    rollRate: shapePhoneAxis(rollDeflection, {
      deadzone: PHONE_CONTROL_CONFIG.rollDeadzone,
      fullDeflection: PHONE_CONTROL_CONFIG.rollFullDeflection,
      maxRate: PHONE_CONTROL_CONFIG.rollMaxRate,
    }),
  };
}

export function slewPhoneValue(current, target, dt) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTarget = Number.isFinite(target) ? target : 0;
  const safeDt = clamp(Number(dt) || 0, 0, 0.1);
  const tau = Math.max(1e-4, PHONE_CONTROL_CONFIG.inputSlewSeconds);
  const blend = 1 - Math.exp(-safeDt / tau);
  return safeCurrent + (safeTarget - safeCurrent) * blend;
}

export function updatePhoneRates(state, deflection, dt) {
  const target = targetPhoneRates(
    deflection?.pitchDeflection,
    deflection?.rollDeflection,
  );

  return {
    pitchRate: slewPhoneValue(state?.pitchRate, target.pitchRate, dt),
    rollRate: slewPhoneValue(state?.rollRate, target.rollRate, dt),
    targetPitchRate: target.pitchRate,
    targetRollRate: target.rollRate,
  };
}
