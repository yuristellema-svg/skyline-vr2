import {
  makeNoiseBuffer,
  safeDisconnect,
  safeStop,
} from './audioMath.js';

const PHRASES = Object.freeze({
  pull_up: Object.freeze([
    Object.freeze({ d: 0.07, f: [450, 1200, 2500], n: 0.16, v: 0.08 }),
    Object.freeze({ d: 0.14, f: [680, 1180, 2450], n: 0.02, v: 0.12 }),
    Object.freeze({ d: 0.08, f: [390, 2350, 3000], n: 0.03, v: 0.09 }),
    Object.freeze({ d: 0.05, f: [500, 1350, 2550], n: 0.12, v: 0.06 }),
    Object.freeze({ d: 0.15, f: [650, 1100, 2400], n: 0.02, v: 0.12 }),
  ]),
  terrain: Object.freeze([
    Object.freeze({ d: 0.06, f: [520, 1500, 2600], n: 0.14, v: 0.07 }),
    Object.freeze({ d: 0.12, f: [590, 1450, 2500], n: 0.02, v: 0.10 }),
    Object.freeze({ d: 0.12, f: [730, 1200, 2450], n: 0.02, v: 0.10 }),
    Object.freeze({ d: 0.10, f: [520, 1750, 2700], n: 0.03, v: 0.09 }),
    Object.freeze({ d: 0.12, f: [400, 2050, 2800], n: 0.02, v: 0.09 }),
  ]),
  low_speed: Object.freeze([
    Object.freeze({ d: 0.12, f: [420, 900, 2450], n: 0.02, v: 0.09 }),
    Object.freeze({ d: 0.12, f: [540, 980, 2500], n: 0.02, v: 0.10 }),
    Object.freeze({ d: 0.07, f: [500, 1600, 2650], n: 0.13, v: 0.06 }),
    Object.freeze({ d: 0.12, f: [510, 1700, 2700], n: 0.02, v: 0.10 }),
    Object.freeze({ d: 0.12, f: [390, 2100, 2850], n: 0.02, v: 0.09 }),
  ]),
});

function schedule(parameter, value, when) {
  if (!parameter) return;
  try {
    parameter.setValueAtTime(value, when);
  } catch {
    try { parameter.value = value; } catch {}
  }
}

export class ProceduralWarningVoice {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.active = new Set();
    this.disposed = false;
  }

  play(id, intensity = 1) {
    if (this.disposed || !PHRASES[id]) return;
    const context = this.context;
    const now = context.currentTime;
    const frames = PHRASES[id];
    const phraseGain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = id === 'pull_up' ? 104 : 92;
    const sourceGain = context.createGain();
    sourceGain.gain.value = 0.35;
    oscillator.connect(sourceGain);

    const noise = context.createBufferSource();
    noise.buffer = makeNoiseBuffer(context, 0.8, id.length * 7919);
    const noiseGain = context.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseGain);

    const filters = [0, 1, 2].map(index => {
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = index === 0 ? 4.2 : 7.0;
      const gain = context.createGain();
      gain.gain.value = 0;
      sourceGain.connect(filter);
      noiseGain.connect(filter);
      filter.connect(gain);
      gain.connect(phraseGain);
      return { filter, gain };
    });

    phraseGain.gain.value = 0.0001;
    phraseGain.connect(this.output);
    phraseGain.gain.setValueAtTime(0.0001, now);
    phraseGain.gain.exponentialRampToValueAtTime(0.075 * Math.max(0.6, Math.min(1.25, intensity)), now + 0.018);

    let cursor = now + 0.02;
    for (const frame of frames) {
      for (let index = 0; index < filters.length; index += 1) {
        schedule(filters[index].filter.frequency, frame.f[index], cursor);
        schedule(filters[index].gain.gain, frame.v * [1, 0.68, 0.42][index], cursor);
      }
      schedule(noiseGain.gain, frame.n, cursor);
      cursor += frame.d;
    }

    phraseGain.gain.setValueAtTime(0.075, Math.max(now + 0.02, cursor - 0.04));
    phraseGain.gain.exponentialRampToValueAtTime(0.0001, cursor + 0.08);
    oscillator.start(now);
    noise.start(now);
    oscillator.stop(cursor + 0.10);
    noise.stop(cursor + 0.10);

    const bundle = { oscillator, noise, sourceGain, noiseGain, phraseGain, filters };
    this.active.add(bundle);
    const cleanupMs = Math.max(200, (cursor + 0.16 - now) * 1000);
    globalThis.setTimeout?.(() => this._cleanup(bundle), cleanupMs);
  }

  _cleanup(bundle) {
    if (!this.active.has(bundle)) return;
    this.active.delete(bundle);
    safeStop(bundle.oscillator);
    safeStop(bundle.noise);
    safeDisconnect(bundle.oscillator);
    safeDisconnect(bundle.noise);
    safeDisconnect(bundle.sourceGain);
    safeDisconnect(bundle.noiseGain);
    safeDisconnect(bundle.phraseGain);
    for (const item of bundle.filters) {
      safeDisconnect(item.filter);
      safeDisconnect(item.gain);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const bundle of [...this.active]) this._cleanup(bundle);
  }
}
