import { computeEngineTargets } from './engineTargets.js';

function setTarget(parameter, value, now, timeConstant = 0.08) {
  if (!parameter || !Number.isFinite(value)) return;
  try {
    parameter.setTargetAtTime?.(value, now, Math.max(0.001, timeConstant));
    if (typeof parameter.setTargetAtTime !== 'function') parameter.value = value;
  } catch {
    try { parameter.value = value; } catch {}
  }
}

function makeNoiseBuffer(context, seconds = 2.5, seed = 0x51f15e) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  let brown = 0;
  for (let index = 0; index < data.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = state / 4294967296 * 2 - 1;
    brown = brown * 0.986 + white * 0.014;
    data[index] = Math.max(-1, Math.min(1, white * 0.31 + brown * 1.18));
  }
  return buffer;
}

function stop(node, when = 0) {
  try { node?.stop?.(when); } catch {}
}

function disconnect(node) {
  try { node?.disconnect?.(); } catch {}
}

export class EngineAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.disposed = false;
    this.sources = [];
    this.nodes = [];
    this.lastTargets = null;

    this.bus = context.createGain();
    this.bus.gain.value = 0.0001;
    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 680;
    this.localHighpass = context.createBiquadFilter();
    this.localHighpass.type = 'highpass';
    this.localHighpass.frequency.value = 42;
    this.localHighpass.Q.value = 0.5;
    this.bus.connect(this.lowpass);
    this.lowpass.connect(this.localHighpass);
    this.localHighpass.connect(output);
    this.nodes.push(this.bus, this.lowpass, this.localHighpass);

    this.sub = context.createOscillator();
    this.sub.type = 'triangle';
    this.subGain = context.createGain();
    this.subGain.gain.value = 0;
    this.sub.connect(this.subGain);
    this.subGain.connect(this.bus);
    this.sub.start();
    this.sources.push(this.sub);
    this.nodes.push(this.subGain);

    this.harmonics = [];
    for (let index = 0; index < 5; index += 1) {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sawtooth' : index % 2 ? 'triangle' : 'sine';
      oscillator.detune && (oscillator.detune.value = [-5, 3, -2, 6, -4][index]);
      const gain = context.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(this.bus);
      oscillator.start();
      this.harmonics.push({ oscillator, gain });
      this.sources.push(oscillator);
      this.nodes.push(gain);
    }

    this.noise = context.createBufferSource();
    this.noise.buffer = makeNoiseBuffer(context, 2.8, 0x7a11c0de);
    this.noise.loop = true;
    this.noiseFilter = context.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 620;
    this.noiseFilter.Q.value = 0.75;
    this.noiseGain = context.createGain();
    this.noiseGain.gain.value = 0;
    this.noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.bus);
    this.noise.start();
    this.sources.push(this.noise);
    this.nodes.push(this.noiseFilter, this.noiseGain);

    this.pulse = context.createOscillator();
    this.pulse.type = 'triangle';
    this.pulseFilter = context.createBiquadFilter();
    this.pulseFilter.type = 'bandpass';
    this.pulseFilter.frequency.value = 310;
    this.pulseFilter.Q.value = 1.15;
    this.pulseGain = context.createGain();
    this.pulseGain.gain.value = 0;
    this.pulse.connect(this.pulseFilter);
    this.pulseFilter.connect(this.pulseGain);
    this.pulseGain.connect(this.bus);
    this.pulse.start();
    this.sources.push(this.pulse);
    this.nodes.push(this.pulseFilter, this.pulseGain);

    this.sirenBus = context.createGain();
    this.sirenBus.gain.value = 0.0001;
    this.sirenFilter = context.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 820;
    this.sirenFilter.Q.value = 3.2;
    this.sirenBus.connect(this.sirenFilter);
    this.sirenFilter.connect(output);
    this.nodes.push(this.sirenBus, this.sirenFilter);

    this.sirenVoices = [0, 1].map(index => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sawtooth' : 'triangle';
      const gain = context.createGain();
      gain.gain.value = index === 0 ? 0.52 : 0.42;
      oscillator.connect(gain);
      gain.connect(this.sirenBus);
      oscillator.start();
      this.sources.push(oscillator);
      this.nodes.push(gain);
      return oscillator;
    });

    this.sirenNoise = context.createBufferSource();
    this.sirenNoise.buffer = makeNoiseBuffer(context, 2.2, 0x87a5);
    this.sirenNoise.loop = true;
    this.sirenNoiseFilter = context.createBiquadFilter();
    this.sirenNoiseFilter.type = 'bandpass';
    this.sirenNoiseFilter.frequency.value = 900;
    this.sirenNoiseFilter.Q.value = 2.4;
    this.sirenNoiseGain = context.createGain();
    this.sirenNoiseGain.gain.value = 0;
    this.sirenNoise.connect(this.sirenNoiseFilter);
    this.sirenNoiseFilter.connect(this.sirenNoiseGain);
    this.sirenNoiseGain.connect(this.sirenBus);
    this.sirenNoise.start();
    this.sources.push(this.sirenNoise);
    this.nodes.push(this.sirenNoiseFilter, this.sirenNoiseGain);

    this.sirenModulator = context.createOscillator();
    this.sirenModulator.type = 'sine';
    this.sirenModulator.frequency.value = 9.2;
    this.sirenModDepth = context.createGain();
    this.sirenModDepth.gain.value = 0;
    this.sirenModulator.connect(this.sirenModDepth);
    this.sirenModDepth.connect(this.sirenBus.gain);
    this.sirenModulator.start();
    this.sources.push(this.sirenModulator);
    this.nodes.push(this.sirenModDepth);
  }

  update(profileValue, flight, phase = 'flying') {
    if (this.disposed) return null;
    const now = this.context.currentTime;
    const targets = computeEngineTargets(profileValue, flight, phase);
    this.lastTargets = targets;

    setTarget(this.bus.gain, targets.engineGain + 0.0001, now, 0.10);
    setTarget(this.lowpass.frequency, Math.max(320, targets.filterFrequency || 320), now, 0.11);
    setTarget(this.sub.frequency, Math.max(1, targets.subFrequency || 1), now, 0.09);
    setTarget(this.subGain.gain, targets.subGain, now, 0.12);

    for (let index = 0; index < this.harmonics.length; index += 1) {
      setTarget(this.harmonics[index].oscillator.frequency, Math.max(1, targets.harmonicFrequencies[index] || 1), now, 0.08);
      setTarget(this.harmonics[index].gain.gain, targets.harmonicGains[index] || 0, now, 0.10);
    }

    setTarget(this.noiseGain.gain, targets.mechanicalGain, now, 0.08);
    setTarget(this.noiseFilter.frequency, 420 + targets.medium * 620 + targets.high * 510 + targets.load * 260, now, 0.10);
    setTarget(this.pulse.frequency, Math.max(1, targets.pulseFrequency || 1), now, 0.08);
    setTarget(this.pulseGain.gain, targets.pulseGain, now, 0.08);
    setTarget(this.pulseFilter.frequency, 235 + targets.medium * 380 + targets.high * 260, now, 0.10);

    setTarget(this.sirenVoices[0].frequency, Math.max(1, targets.sirenFrequencies[0] || 1), now, 0.14);
    setTarget(this.sirenVoices[1].frequency, Math.max(1, targets.sirenFrequencies[1] || 1), now, 0.14);
    setTarget(this.sirenFilter.frequency, 720 + targets.sirenTarget * 310, now, 0.12);
    setTarget(this.sirenBus.gain, targets.sirenGain + 0.0001, now, targets.sirenTarget > 0 ? 0.24 : 0.38);
    setTarget(this.sirenNoiseGain.gain, targets.sirenTarget * 0.055, now, 0.20);
    setTarget(this.sirenModDepth.gain, targets.sirenTarget * 0.060, now, 0.18);
    return targets;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const when = this.context.currentTime + 0.02;
    for (const source of this.sources) stop(source, when);
    for (const node of [...this.sources, ...this.nodes]) disconnect(node);
    this.sources.length = 0;
    this.nodes.length = 0;
  }
}
