import {
  clamp,
  loadFactorOf,
  smoothstep,
  speedOf,
  stallAmountOf,
} from './engineTargets.js';
import { resolveSoundProfile } from './profiles.js';

function setTarget(parameter, value, now, timeConstant = 0.08) {
  if (!parameter || !Number.isFinite(value)) return;
  try {
    parameter.setTargetAtTime?.(value, now, Math.max(0.001, timeConstant));
    if (typeof parameter.setTargetAtTime !== 'function') parameter.value = value;
  } catch {
    try { parameter.value = value; } catch {}
  }
}

function makeNoiseBuffer(context, seconds, seed) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  let brown = 0;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const white = state / 4294967296 * 2 - 1;
    brown = brown * 0.985 + white * 0.015;
    data[index] = Math.max(-1, Math.min(1, white * 0.34 + brown));
  }
  return buffer;
}

function disconnect(node) { try { node?.disconnect?.(); } catch {} }
function stop(node, when = 0) { try { node?.stop?.(when); } catch {} }

export function computeAirflowTargets(profileValue, flight, phase = 'flying') {
  const profile = resolveSoundProfile(profileValue);
  const active = phase === 'flying' ? 1 : 0;
  const speed = speedOf(flight);
  const low = smoothstep(8, 70, speed);
  const cruise = smoothstep(35, 210, speed);
  const extreme = smoothstep(180, 900, speed);
  const stall = stallAmountOf(flight);
  const load = smoothstep(1.15, 6.0, loadFactorOf(flight));
  const glider = profile.id === 'glider' ? 1 : 0;

  return {
    profile,
    bodyGain: active * clamp(profile.windGain * (0.05 + low * 0.42 + cruise * 0.45 + extreme * 0.25), 0, 0.30),
    bodyFrequency: 210 + cruise * 1050 + extreme * 650,
    hissGain: active * clamp(profile.windGain * (cruise * 0.30 + extreme * 0.44), 0, 0.20),
    hissFrequency: 1300 + cruise * 2200 + extreme * 1800,
    canopyGain: active * glider * clamp(0.015 + cruise * 0.11 + extreme * 0.07, 0, 0.18),
    canopyFrequency: 620 + cruise * 1250 + extreme * 850,
    buffetGain: active * clamp(stall * stall * 0.16 + load * stall * 0.055, 0, 0.20),
    buffetFrequency: 68 + stall * 165 + load * 36,
    creakGain: active * glider * clamp(cruise * 0.032 + extreme * 0.042 + load * 0.052, 0, 0.10),
    creakFrequency: 105 + cruise * 90 + load * 68,
    tensionGain: active * glider * clamp(load * 0.075 + extreme * 0.030, 0, 0.09),
    quietFactor: glider ? 1 - smoothstep(16, 34, speed) : 0,
  };
}

export class AirflowAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.disposed = false;
    this.sources = [];
    this.nodes = [];
    this.lastTargets = null;
    const buffer = makeNoiseBuffer(context, 3.2, 0x91af10);

    const makeBand = (type, frequency, q = 0.5) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      source.start();
      this.sources.push(source);
      this.nodes.push(filter, gain);
      return { source, filter, gain };
    };

    this.body = makeBand('bandpass', 420, 0.46);
    this.hiss = makeBand('highpass', 1600, 0.38);
    this.canopy = makeBand('bandpass', 900, 0.85);
    this.buffet = makeBand('bandpass', 110, 1.15);

    this.creak = context.createOscillator();
    this.creak.type = 'triangle';
    this.creakFilter = context.createBiquadFilter();
    this.creakFilter.type = 'bandpass';
    this.creakFilter.frequency.value = 340;
    this.creakFilter.Q.value = 3.0;
    this.creakGain = context.createGain();
    this.creakGain.gain.value = 0;
    this.creak.connect(this.creakFilter);
    this.creakFilter.connect(this.creakGain);
    this.creakGain.connect(output);
    this.creak.start();
    this.sources.push(this.creak);
    this.nodes.push(this.creakFilter, this.creakGain);

    this.tension = context.createOscillator();
    this.tension.type = 'sine';
    this.tensionGain = context.createGain();
    this.tensionGain.gain.value = 0;
    this.tension.connect(this.tensionGain);
    this.tensionGain.connect(output);
    this.tension.start();
    this.sources.push(this.tension);
    this.nodes.push(this.tensionGain);
  }

  update(profileValue, flight, phase = 'flying') {
    if (this.disposed) return null;
    const targets = computeAirflowTargets(profileValue, flight, phase);
    this.lastTargets = targets;
    const now = this.context.currentTime;
    setTarget(this.body.gain.gain, targets.bodyGain + 0.0001, now, 0.09);
    setTarget(this.body.filter.frequency, targets.bodyFrequency, now, 0.09);
    setTarget(this.hiss.gain.gain, targets.hissGain + 0.0001, now, 0.10);
    setTarget(this.hiss.filter.frequency, targets.hissFrequency, now, 0.10);
    setTarget(this.canopy.gain.gain, targets.canopyGain + 0.0001, now, 0.10);
    setTarget(this.canopy.filter.frequency, targets.canopyFrequency, now, 0.10);
    setTarget(this.buffet.gain.gain, targets.buffetGain + 0.0001, now, 0.055);
    setTarget(this.buffet.filter.frequency, targets.buffetFrequency, now, 0.065);
    setTarget(this.creak.frequency, targets.creakFrequency, now, 0.12);
    setTarget(this.creakFilter.frequency, targets.creakFrequency * 2.25, now, 0.12);
    setTarget(this.creakGain.gain, targets.creakGain + 0.0001, now, 0.13);
    setTarget(this.tension.frequency, 44 + targets.tensionGain * 840, now, 0.16);
    setTarget(this.tensionGain.gain, targets.tensionGain + 0.0001, now, 0.15);
    return targets;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const when = this.context.currentTime + 0.02;
    for (const source of this.sources) stop(source, when);
    for (const node of [...this.sources, ...this.nodes]) disconnect(node);
  }
}
