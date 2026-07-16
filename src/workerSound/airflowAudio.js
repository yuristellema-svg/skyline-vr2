import {
  PHONE_AUDIO_LIMITS,
  resolveSoundProfile,
} from './profiles.js';

export function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(Number(value), min)));
}

export function smoothstep(min, max, value) {
  if (!(max > min)) return value >= max ? 1 : 0;
  const x = clamp((value - min) / (max - min));
  return x * x * (3 - 2 * x);
}

export function speedOf(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  const velocity = flight?.velocity;
  if (typeof velocity?.length === 'function') return Math.max(0, finite(velocity.length()));
  return Math.hypot(finite(velocity?.x), finite(velocity?.y), finite(velocity?.z));
}

export function verticalSpeedOf(flight) {
  return finite(flight?.verticalSpeed, finite(flight?.velocity?.y));
}

export function pathAngleOf(flight) {
  if (Number.isFinite(flight?.pathAngle)) return flight.pathAngle;
  const speed = speedOf(flight);
  return speed > 1e-6
    ? Math.asin(clamp(verticalSpeedOf(flight) / speed, -1, 1))
    : 0;
}

export function loadFactorOf(flight) {
  for (const candidate of [
    flight?.loadFactor,
    flight?.gForce,
    flight?.currentG,
    flight?.gLoad,
  ]) {
    if (Number.isFinite(candidate)) return Math.max(0, candidate);
  }
  return 1;
}

export function stallAmountOf(flight) {
  return clamp(
    flight?.stallAmount ??
    flight?.stallSeverity ??
    flight?.stall ??
    0,
  );
}

export function computeEngineLoad(flight) {
  const turn = smoothstep(1.08, 5.8, loadFactorOf(flight));
  const climb = smoothstep(0.05, 0.42, Math.max(0, pathAngleOf(flight)));
  const vertical = smoothstep(4, 42, Math.max(0, verticalSpeedOf(flight)));
  return clamp(turn * 0.62 + climb * 0.27 + vertical * 0.11);
}

export function computeStukaSirenTarget(profileValue, flight, phase = 'flying') {
  const profile = resolveSoundProfile(profileValue);
  if (phase !== 'flying' || profile.id !== 'stuka' || !profile.sirenAllowed) return 0;

  const speedGate = smoothstep(80, 126, speedOf(flight));
  const angleGate = smoothstep(0.36, 0.72, Math.max(0, -pathAngleOf(flight)));
  const descentGate = smoothstep(18, 62, Math.max(0, -verticalSpeedOf(flight)));
  return clamp(speedGate * angleGate * descentGate);
}

export function computeEngineTargets(profileValue, flight, phase = 'flying') {
  const profile = resolveSoundProfile(profileValue);
  const active = phase === 'flying' ? 1 : 0;
  const speed = speedOf(flight);
  const idle = 1 - smoothstep(18, 50, speed);
  const medium = smoothstep(18, 90, speed) * (1 - smoothstep(150, 250, speed));
  const high = smoothstep(125, 320, speed);
  const extreme = smoothstep(260, 920, speed);
  const load = computeEngineLoad(flight);
  const stall = stallAmountOf(flight);

  if (!profile.engineEnabled) {
    return {
      profile,
      active,
      speed,
      idle,
      medium,
      high,
      extreme,
      load,
      stall,
      rpmHz: 0,
      engineGain: 0,
      subFrequency: 0,
      subGain: 0,
      harmonicFrequencies: profile.harmonicRatios.map(() => 0),
      harmonicGains: profile.harmonicGains.map(() => 0),
      mechanicalGain: 0,
      pulseFrequency: 0,
      pulseGain: 0,
      filterFrequency: 0,
      sirenTarget: 0,
      sirenGain: 0,
      sirenFrequencies: [0, 0],
    };
  }

  const rpmHz =
    profile.baseHz * (0.88 + idle * 0.12) +
    medium * profile.cruiseHz +
    high * profile.highHz +
    load * profile.cruiseHz * 0.16;

  const engineGain = active * clamp(
    0.095 + medium * 0.085 + high * 0.082 + load * profile.loadDepth * 0.18,
    0,
    0.30,
  );

  const subPresence = profile.id === 'zero'
    ? 0.34 + load * 0.12
    : profile.id === 'stuka'
      ? 0.22 + load * 0.07
      : 0.09 + load * 0.03;

  const sirenTarget = computeStukaSirenTarget(profile.id, flight, phase);
  const sirenBase = 625 + sirenTarget * 315;

  return {
    profile,
    active,
    speed,
    idle,
    medium,
    high,
    extreme,
    load,
    stall,
    rpmHz,
    engineGain,
    subFrequency: rpmHz * profile.subRatio,
    subGain: clamp(engineGain * subPresence, 0, 0.13),
    harmonicFrequencies: profile.harmonicRatios.map(ratio => rpmHz * ratio),
    harmonicGains: profile.harmonicGains.map((gain, index) => clamp(
      gain * (0.78 + load * (index < 3 ? 0.34 : 0.18)),
      0,
      PHONE_AUDIO_LIMITS.continuousComponentGain,
    )),
    mechanicalGain: active * clamp(
      profile.noiseGain * (0.34 + medium * 0.42 + high * 0.35 + load * 0.55),
      0,
      0.095,
    ),
    pulseFrequency: rpmHz * profile.pulseRatio,
    pulseGain: active * clamp(
      profile.pulseGain * (0.30 + medium * 0.42 + high * 0.28 + load * 0.40),
      0,
      0.105,
    ),
    filterFrequency: clamp(
      profile.filterBase + medium * 740 + high * 820 + extreme * 260 - load * 180,
      320,
      profile.filterHigh,
    ),
    sirenTarget,
    sirenGain: clamp(sirenTarget * 0.19, 0, 0.19),
    sirenFrequencies: [sirenBase, sirenBase * 1.0185],
  };
}
