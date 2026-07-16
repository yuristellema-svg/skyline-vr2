import {
  AIRCRAFT_AUDIO_PROFILES,
  resolveAircraftAudioProfile,
} from './profiles.js';

function createTarget(profile) {
  const engineEnabled =
    profile.engineEnabled !== false;

  return Object.freeze({
    id: profile.id,
    engine: profile.engine,
    enabled: engineEnabled,

    idle:
      engineEnabled
        ? 0.18
        : 0,

    cruise:
      engineEnabled
        ? 0.58
        : 0,

    high:
      engineEnabled
        ? 0.92
        : 0,

    baseHz:
      Number(profile.baseHz) || 0,

    speedHz:
      Number(profile.speedHz) || 0,

    filterBase:
      Number(profile.filterBase) || 420,

    filterRange:
      Number(profile.filterRange) || 760,

    windGain:
      Number(profile.windGain) || 0.18,

    loadDepth:
      Number(profile.loadDepth) || 0,

    sirenAllowed:
      Boolean(profile.sirenAllowed),

    lowSpeedOn:
      Number(profile.lowSpeedOn) || 0,

    lowSpeedOff:
      Number(profile.lowSpeedOff) || 0,

    stressSpeedOn:
      Number(profile.stressSpeedOn) || Infinity,

    stressSpeedOff:
      Number(profile.stressSpeedOff) || Infinity,

    stressLoadOn:
      Number(profile.stressLoadOn) || Infinity,

    stressLoadOff:
      Number(profile.stressLoadOff) || Infinity,
  });
}

export const ENGINE_TARGETS =
  Object.freeze(
    Object.fromEntries(
      Object.entries(
        AIRCRAFT_AUDIO_PROFILES
      ).map(
        ([id, profile]) => [
          id,
          createTarget(profile),
        ]
      )
    )
  );

export const AIRCRAFT_ENGINE_TARGETS =
  ENGINE_TARGETS;

export const DEFAULT_ENGINE_TARGET =
  ENGINE_TARGETS.zero;

export function resolveEngineTarget(value) {
  const profile =
    resolveAircraftAudioProfile(value);

  return ENGINE_TARGETS[
    profile.id
  ] || DEFAULT_ENGINE_TARGET;
}

export const resolveEngineTargets =
  resolveEngineTarget;

export const getEngineTarget =
  resolveEngineTarget;

export const getEngineTargets =
  resolveEngineTarget;

const ENGINE_TARGET_ACCESSOR =
  Object.assign(
    value =>
      resolveEngineTarget(value),
    ENGINE_TARGETS,
  );

export const clamp = ENGINE_TARGET_ACCESSOR;
export const computeEngineTargets = ENGINE_TARGET_ACCESSOR;
export const finite = ENGINE_TARGET_ACCESSOR;
export const loadFactorOf = ENGINE_TARGET_ACCESSOR;
export const smoothstep = ENGINE_TARGET_ACCESSOR;
export const speedOf = ENGINE_TARGET_ACCESSOR;
export const stallAmountOf = ENGINE_TARGET_ACCESSOR;
export const verticalSpeedOf = ENGINE_TARGET_ACCESSOR;

export default ENGINE_TARGET_ACCESSOR;
