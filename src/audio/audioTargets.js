import {
  clamp,
  loadOf,
  pathAngleOf,
  smoothstep,
  speedOf,
  stallOf,
  verticalSpeedOf,
} from './audioMath.js';
import {
  resolveAircraftAudioProfile,
} from './aircraftAudioProfiles.js';

export function computeStukaSirenTarget(profileId, flight, phase = 'flying') {
  const profile = resolveAircraftAudioProfile(profileId);
  if (profile.id !== 'stuka' || !profile.sirenAllowed || phase !== 'flying') return 0;

  const speed = speedOf(flight);
  const pathAngle = pathAngleOf(flight);
  const descentRate = Math.max(0, -verticalSpeedOf(flight));
  const steepness = Math.max(0, -pathAngle);

  const speedGate = smoothstep(84, 126, speed);
  const angleGate = smoothstep(0.40, 0.72, steepness);
  const descentGate = smoothstep(20, 66, descentRate);

  return clamp(speedGate * angleGate * descentGate);
}

export function computeAircraftAudioTargets(profileId, flight, phase = 'flying') {
  const profile = resolveAircraftAudioProfile(profileId);
  const active = phase === 'flying' ? 1 : 0;
  const speed = speedOf(flight);
  const load = loadOf(flight);
  const stall = stallOf(flight);
  const speedAmount = smoothstep(8, 240, speed);
  const extreme = smoothstep(210, 1050, speed);
  const highExtreme = smoothstep(850, 4200, speed);
  const loadAmount = smoothstep(1.05, 4.8, load);

  const baseFrequency = Math.max(
    1,
    profile.baseHz +
      speedAmount * profile.speedHz +
      loadAmount * profile.loadPitchHz,
  );

  const harmonicFrequencies = profile.harmonicRatios.map(
    ratio => baseFrequency * ratio,
  );

  const loadDarkening = 1 - loadAmount * 0.18;
  const engineFilter =
    (profile.lowpassBaseHz + speedAmount * profile.lowpassRangeHz) *
    loadDarkening;

  const propellerPulseFrequency = profile.propellerBlades > 0
    ? baseFrequency * 0.54 * profile.propellerBlades
    : 0;

  return {
    active,
    profile,
    speed,
    load,
    stall,
    speedAmount,
    extreme,
    highExtreme,
    loadAmount,
    masterGain: active * 0.46,
    engineGain:
      active *
      profile.engineGain *
      (0.54 + speedAmount * 0.31 + loadAmount * 0.24),
    subharmonicFrequency: baseFrequency * profile.subharmonicRatio,
    subharmonicGain:
      active *
      profile.subharmonicGain *
      (0.64 + loadAmount * 0.42),
    harmonicFrequencies,
    harmonicGains: profile.harmonicGains.map(
      gain => active * gain * (0.72 + speedAmount * 0.20 + loadAmount * 0.12),
    ),
    engineFilter,
    engineLowShelfDb:
      profile.lowShelfDb + loadAmount * (profile.id === 'zero' ? 1.7 : 0.9),
    mechanicalNoiseGain:
      active *
      profile.mechanicalNoiseGain *
      (0.32 + speedAmount * 0.44 + loadAmount * 0.46),
    mechanicalNoiseFrequency: 420 + speedAmount * 980 + loadAmount * 180,
    propellerPulseFrequency,
    propellerPulseGain:
      active *
      profile.propellerGain *
      (0.34 + speedAmount * 0.50 + loadAmount * 0.16),
    windBodyGain:
      active *
      profile.windGain *
      (0.08 + speedAmount * 0.54 + extreme * 0.44 + highExtreme * 0.24),
    windBodyFrequency: 230 + speedAmount * 1350 + extreme * 1850,
    windHissGain:
      active *
      (0.012 + speedAmount * 0.045 + extreme * 0.13 + highExtreme * 0.12),
    windHissFrequency: 1700 + speedAmount * 2100 + extreme * 2500,
    buffetGain:
      active *
      stall * stall *
      (0.12 + speedAmount * 0.12),
    buffetFrequency: 62 + stall * 118 + speedAmount * 45,
    sirenTarget: computeStukaSirenTarget(profile.id, flight, phase),
  };
}

export function computeSirenFrequencies(targets, sirenMix) {
  const base =
    525 +
    targets.speedAmount * 250 +
    targets.extreme * 110 +
    clamp(sirenMix) * 80;

  return {
    primary: base,
    secondary: base * 1.0185,
    bandpass: 980 + targets.speedAmount * 520 + clamp(sirenMix) * 240,
    modulation: 7.2 + targets.speedAmount * 3.8,
  };
}

export function computeTrafficVoiceTarget(source, active = 1) {
  const speed = Math.max(0, Number(source?.speed) || 0);
  const speedAmount = smoothstep(0, 90, speed);

  return {
    fundamental: 47 + speedAmount * 42,
    harmonic: 94 + speedAmount * 82,
    gain: active * (0.032 + speedAmount * 0.035),
    filter: 420 + speedAmount * 720,
  };
}

export function computeBoostParameters(chain = 1) {
  const safeChain = clamp(chain, 1, 12);
  return {
    lowStart: 72 + safeChain * 3,
    lowEnd: 168 + safeChain * 10,
    midStart: 260 + safeChain * 12,
    midEnd: 980 + safeChain * 42,
    peakGain: Math.min(0.30, 0.19 + safeChain * 0.009),
    duration: 0.58 + Math.min(0.18, safeChain * 0.012),
  };
}
