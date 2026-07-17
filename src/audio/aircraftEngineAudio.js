import {
  clamp,
  loadFactorOf,
  makeNoiseBuffer,
  pathAngleOf,
  safeDisconnect,
  safeSetTarget,
  safeStop,
  smoothstep,
  speedOf,
  stallAmountOf,
  verticalSpeedOf,
} from './audioMath.js';
import {
  resolveAircraftAudioProfile,
} from './aircraftProfiles.js';

export function computeStukaSirenTarget(profileValue, flight, phase = 'flying') {
  const profile = resolveAircraftAudioProfile(profileValue);
  if (phase !== 'flying' || profile.id !== 'stuka' || !profile.sirenAllowed) return 0;

  const speed = speedOf(flight);
  const pathAngle = pathAngleOf(flight);
  const descentRate = Math.max(0, -verticalSpeedOf(flight));

  const speedGate = smoothstep(78, 124, speed);
  const angleGate = smoothstep(0.34, 0.70, Math.max(0, -pathAngle));
  const descentGate = smoothstep(15, 58, descentRate);

  return clamp(speedGate * angleGate * descentGate);
}

export function computeEngineLoad(flight) {
  const load = loadFactorOf(flight);
  const climb = Math.max(0, pathAngleOf(flight));
  const vertical = Math.max(0, verticalSpeedOf(flight));
  const turnLoad = smoothstep(1.05, 5.8, load);
  const climbLoad = smoothstep(0.06, 0.42, climb);
  const verticalLoad = smoothstep(4, 38, vertical);
  return clamp(turnLoad * 0.62 + climbLoad * 0.27 + verticalLoad * 0.11);
}

export function computeAircraftEngineTargets(profileValue, flight, phase = 'flying') {
  const profile = resolveAircraftAudioProfile(profileValue);
  const active = phase === 'flying' ? 1 : 0;
  const speed = speedOf(flight);
  const speedAmount = smoothstep(6, 190, speed);
  const extreme = smoothstep(175, 920, speed);
  const load = computeEngineLoad(flight);
  const stall = stallAmountOf(flight);
  const throttle = Math.max(
    0,
    Math.min(
      1,
      flight?.engineOn === false
        ? 0
        : Number(flight?.throttle) || 0,
    ),
  );
  const rpmAmount = Math.max(
    0,
    Math.min(1, throttle * 0.82 + speedAmount * 0.18),
  );
  const rpmHz =
    profile.baseHz * (0.72 + rpmAmount * 0.42) +
    rpmAmount * profile.speedHz +
    load * profile.speedHz * 0.18;
  const engineLevel = profile.engineEnabled
    ? active * Math.max(
        0,
        Math.min(
          0.33,
          throttle > 0
            ? 0.055 + throttle * 0.17 + load * profile.loadDepth * 0.18
            : 0,
        ),
      )
    : 0;

  return {
    profile,
    active,
    speed,
    speedAmount,
    extreme,
    load,
    stall,
    throttle,
    rpmHz,
    engineLevel,
    subFrequency: Math.max(1, rpmHz * profile.subRatio),
    harmonicFrequencies: profile.harmonicRatios.map(ratio => Math.max(1, rpmHz * ratio)),
    harmonicGains: profile.harmonicGains.map(gain => gain * (0.80 + load * 0.32)),
    engineFilter: profile.filterBase + speedAmount * profile.filterRange + load * 220,
    mechanicalNoiseGain: active * profile.noiseGain * (0.35 + speedAmount * 0.45 + load * 0.55),
    pulseFrequency: Math.max(1, rpmHz * profile.pulseRatio),
    pulseGain: active * profile.pulseGain * (0.35 + speedAmount * 0.45 + load * 0.40),
    sirenTarget: computeStukaSirenTarget(profile.id, flight, phase),
  };
}

function makePeriodicWave(context, phaseOffset = 0) {
  if (typeof context.createPeriodicWave !== 'function') return null;
  const real = new Float32Array([0, 0, 0.08, 0.02, 0.025, 0.01]);
  const imag = new Float32Array([
    0,
    1,
    0.31 + phaseOffset,
    0.18,
    0.09,
    0.055,
  ]);
  return context.createPeriodicWave(real, imag, { disableNormalization: false });
}

export class AircraftEngineAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.disposed = false;
    this.nodes = [];
    this.sources = [];

    const noiseBuffer = makeNoiseBuffer(context, 2.8, 0x7a11c0de);

    this.engineBus = context.createGain();
    this.engineBus.gain.value = 0.0001;
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 680;
    this.engineHighpass = context.createBiquadFilter();
    this.engineHighpass.type = 'highpass';
    this.engineHighpass.frequency.value = 42;
    this.engineHighpass.Q.value = 0.5;
    this.engineBus.connect(this.engineFilter);
    this.engineFilter.connect(this.engineHighpass);
    this.engineHighpass.connect(output);
    this.nodes.push(this.engineBus, this.engineFilter, this.engineHighpass);

    this.subOscillator = context.createOscillator();
    this.subOscillator.type = 'sine';
    this.subGain = context.createGain();
    this.subGain.gain.value = 0;
    this.subOscillator.connect(this.subGain);
    this.subGain.connect(this.engineBus);
    this.subOscillator.start();
    this.sources.push(this.subOscillator);
    this.nodes.push(this.subGain);

    const wave = makePeriodicWave(context, 0.03);
    this.harmonicVoices = [];
    for (let index = 0; index < 5; index += 1) {
      const oscillator = context.createOscillator();
      if (wave && typeof oscillator.setPeriodicWave === 'function') {
        oscillator.setPeriodicWave(wave);
      } else {
        oscillator.type = index === 0 ? 'sawtooth' : index % 2 ? 'triangle' : 'sine';
      }
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(this.engineBus);
      oscillator.start();
      this.harmonicVoices.push({ oscillator, gain });
      this.sources.push(oscillator);
      this.nodes.push(gain);
    }

    this.mechanicalNoise = context.createBufferSource();
    this.mechanicalNoise.buffer = noiseBuffer;
    this.mechanicalNoise.loop = true;
    this.mechanicalFilter = context.createBiquadFilter();
    this.mechanicalFilter.type = 'bandpass';
    this.mechanicalFilter.frequency.value = 620;
    this.mechanicalFilter.Q.value = 0.72;
    this.mechanicalGain = context.createGain();
    this.mechanicalGain.gain.value = 0;
    this.mechanicalNoise.connect(this.mechanicalFilter);
    this.mechanicalFilter.connect(this.mechanicalGain);
    this.mechanicalGain.connect(this.engineBus);
    this.mechanicalNoise.start();
    this.sources.push(this.mechanicalNoise);
    this.nodes.push(this.mechanicalFilter, this.mechanicalGain);

    this.pulseCarrier = context.createOscillator();
    this.pulseCarrier.type = 'triangle';
    this.pulseCarrier.frequency.value = 70;
    this.pulseGain = context.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseFilter = context.createBiquadFilter();
    this.pulseFilter.type = 'bandpass';
    this.pulseFilter.frequency.value = 310;
    this.pulseFilter.Q.value = 1.1;
    this.pulseCarrier.connect(this.pulseFilter);
    this.pulseFilter.connect(this.pulseGain);
    this.pulseGain.connect(this.engineBus);
    this.pulseCarrier.start();
    this.sources.push(this.pulseCarrier);
    this.nodes.push(this.pulseFilter, this.pulseGain);

    this.sirenBus = context.createGain();
    this.sirenBus.gain.value = 0.0001;
    this.sirenFilter = context.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 820;
    this.sirenFilter.Q.value = 3.5;
    this.sirenBus.connect(this.sirenFilter);
    this.sirenFilter.connect(output);
    this.nodes.push(this.sirenBus, this.sirenFilter);

    this.sirenVoices = [0, 1].map(index => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sawtooth' : 'triangle';
      oscillator.frequency.value = 680 + index * 13;
      const gain = context.createGain();
      gain.gain.value = index === 0 ? 0.52 : 0.42;
      oscillator.connect(gain);
      gain.connect(this.sirenBus);
      oscillator.start();
      this.sources.push(oscillator);
      this.nodes.push(gain);
      return oscillator;
    });

    this.sirenModulator = context.createOscillator();
    this.sirenModulator.type = 'sine';
    this.sirenModulator.frequency.value = 10.5;
    this.sirenModDepth = context.createGain();
    this.sirenModDepth.gain.value = 0.05;
    this.sirenModulator.connect(this.sirenModDepth);
    this.sirenModDepth.connect(this.sirenBus.gain);
    this.sirenModulator.start();
    this.sources.push(this.sirenModulator);
    this.nodes.push(this.sirenModDepth);
  }

  update(profileValue, flight, phase = 'flying') {
    if (this.disposed) return;
    const now = this.context.currentTime;
    const targets = computeAircraftEngineTargets(profileValue, flight, phase);

    safeSetTarget(this.engineBus.gain, targets.engineLevel + 0.0001, now, 0.10);
    safeSetTarget(this.engineFilter.frequency, targets.engineFilter, now, 0.11);
    safeSetTarget(this.subOscillator.frequency, targets.subFrequency, now, 0.09);
    safeSetTarget(
      this.subGain.gain,
      targets.profile.engineEnabled
        ? targets.engineLevel * (targets.profile.id === 'zero' ? 0.36 : targets.profile.id === 'stuka' ? 0.22 : 0.10)
        : 0,
      now,
      0.12,
    );

    for (let index = 0; index < this.harmonicVoices.length; index += 1) {
      const voice = this.harmonicVoices[index];
      safeSetTarget(voice.oscillator.frequency, targets.harmonicFrequencies[index], now, 0.08);
      safeSetTarget(
        voice.gain.gain,
        targets.profile.engineEnabled ? targets.harmonicGains[index] : 0,
        now,
        0.10,
      );
    }

    safeSetTarget(this.mechanicalGain.gain, targets.mechanicalNoiseGain, now, 0.08);
    safeSetTarget(
      this.mechanicalFilter.frequency,
      420 + targets.speedAmount * 720 + targets.load * 280,
      now,
      0.10,
    );
    safeSetTarget(this.pulseCarrier.frequency, targets.pulseFrequency, now, 0.08);
    safeSetTarget(this.pulseGain.gain, targets.pulseGain, now, 0.08);
    safeSetTarget(this.pulseFilter.frequency, 240 + targets.speedAmount * 540, now, 0.10);

    const sirenFrequency = 610 + targets.sirenTarget * 330;
    safeSetTarget(this.sirenVoices[0].frequency, sirenFrequency, now, 0.14);
    safeSetTarget(this.sirenVoices[1].frequency, sirenFrequency * 1.021, now, 0.14);
    safeSetTarget(this.sirenFilter.frequency, 720 + targets.sirenTarget * 260, now, 0.12);
    safeSetTarget(this.sirenBus.gain, 0.0001, now, 0.18);
    safeSetTarget(this.sirenModDepth.gain, targets.sirenTarget * 0.064, now, 0.16);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.context.currentTime;
    for (const source of this.sources) safeStop(source, now + 0.02);
    for (const node of [...this.sources, ...this.nodes]) safeDisconnect(node);
    this.sources.length = 0;
    this.nodes.length = 0;
  }
}
