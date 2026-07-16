import { clamp } from './engineTargets.js';
import { PHONE_AUDIO_LIMITS } from './profiles.js';

export function computeBoostImpactTargets(chain = 1) {
  const safeChain = Math.max(1, Math.min(12, Number(chain) || 1));
  const chainAmount = (safeChain - 1) / 11;
  return {
    chain: safeChain,
    thumpHz: 72 + safeChain * 3.5,
    sweepStartHz: 150 + safeChain * 5,
    sweepEndHz: 420 + safeChain * 15,
    impactGain: clamp(0.085 + chainAmount * 0.045, 0, PHONE_AUDIO_LIMITS.transientPeakGain),
    noiseGain: clamp(0.040 + chainAmount * 0.025, 0, 0.075),
    duration: 0.48 + chainAmount * 0.10,
  };
}

function makeNoise(context, seconds, seed) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    data[index] = state / 4294967296 * 2 - 1;
  }
  return buffer;
}

function cleanup(bundle) {
  for (const node of bundle) {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  }
}

export class BoostAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.active = new Set();
    this.disposed = false;
    this.lastTargets = null;
  }

  play(chain = 1) {
    if (this.disposed) return null;
    const targets = computeBoostImpactTargets(chain);
    this.lastTargets = targets;
    const context = this.context;
    const now = context.currentTime;
    const thump = context.createOscillator();
    const sweep = context.createOscillator();
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const noiseGain = context.createGain();

    thump.type = 'sine';
    thump.frequency.setValueAtTime?.(targets.thumpHz, now);
    thump.frequency.exponentialRampToValueAtTime?.(48, now + 0.16);
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime?.(targets.sweepStartHz, now);
    sweep.frequency.exponentialRampToValueAtTime?.(targets.sweepEndHz, now + 0.30);
    noise.buffer = makeNoise(context, 0.7, 0xb0057 + targets.chain);
    filter.type = 'bandpass';
    filter.frequency.value = 820 + targets.chain * 18;
    filter.Q.value = 0.8;
    gain.gain.setValueAtTime?.(0.0001, now);
    gain.gain.exponentialRampToValueAtTime?.(targets.impactGain, now + 0.022);
    gain.gain.exponentialRampToValueAtTime?.(0.0001, now + targets.duration);
    noiseGain.gain.setValueAtTime?.(targets.noiseGain, now);
    noiseGain.gain.exponentialRampToValueAtTime?.(0.0001, now + targets.duration * 0.72);

    thump.connect(gain);
    sweep.connect(filter);
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    thump.start(now);
    sweep.start(now);
    noise.start(now);
    thump.stop(now + targets.duration + 0.04);
    sweep.stop(now + targets.duration + 0.04);
    noise.stop(now + targets.duration + 0.04);

    const bundle = [thump, sweep, noise, filter, gain, noiseGain];
    if (this.active.size >= 5) {
      const oldest = this.active.values().next().value;
      if (oldest) {
        cleanup(oldest);
        this.active.delete(oldest);
      }
    }
    this.active.add(bundle);
    globalThis.setTimeout?.(() => {
      if (!this.active.delete(bundle)) return;
      cleanup(bundle);
    }, Math.ceil((targets.duration + 0.15) * 1000));
    return targets;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const bundle of this.active) cleanup(bundle);
    this.active.clear();
  }
}
