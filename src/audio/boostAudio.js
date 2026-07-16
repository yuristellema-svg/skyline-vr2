import {
  clamp,
  makeNoiseBuffer,
  safeDisconnect,
  safeStop,
} from './audioMath.js';

export class BoostTransitionTracker {
  constructor() {
    this.wasActive = false;
    this.seenActivation = false;
  }

  reset() {
    this.wasActive = false;
    this.seenActivation = false;
  }

  update(level) {
    const safeLevel = clamp(level, 0, 1);
    const active = safeLevel > 0.22;
    const exited = this.wasActive && safeLevel < 0.06 && this.seenActivation;
    if (active) this.seenActivation = true;
    this.wasActive = active || (this.wasActive && safeLevel >= 0.06);
    if (exited) {
      this.wasActive = false;
      this.seenActivation = false;
    }
    return { active, exited };
  }
}

export function boostLevelOf(flight) {
  return clamp(
    flight?.boostAmount ??
    flight?.boostCharge ??
    flight?.boostLevel ??
    0,
  );
}

export class BoostAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.tracker = new BoostTransitionTracker();
    this.disposed = false;
    this.active = new Set();
  }

  playActivation(chain = 1) {
    if (this.disposed) return;
    const context = this.context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(84 + Math.min(12, chain) * 5, now);
    oscillator.frequency.exponentialRampToValueAtTime(420 + Math.min(12, chain) * 14, now + 0.34);
    noise.buffer = makeNoiseBuffer(context, 0.7, 0xb0057 + chain);
    filter.type = 'bandpass';
    filter.frequency.value = 860;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.105, now + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
    oscillator.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    oscillator.start(now);
    noise.start(now);
    oscillator.stop(now + 0.60);
    noise.stop(now + 0.60);
    this._track({ oscillator, noise, filter, gain }, 700);
  }

  playExit() {
    if (this.disposed) return;
    const context = this.context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.30);
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 1.1;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.048, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    oscillator.start(now);
    oscillator.stop(now + 0.40);
    this._track({ oscillator, filter, gain }, 500);
  }

  update(flight) {
    const transition = this.tracker.update(boostLevelOf(flight));
    if (transition.exited) this.playExit();
    return transition;
  }

  _track(bundle, cleanupMs) {
    if (this.active.size >= 5) {
      const oldest = this.active.values().next().value;
      if (oldest) this._cleanup(oldest);
    }
    this.active.add(bundle);
    globalThis.setTimeout?.(() => this._cleanup(bundle), cleanupMs);
  }

  _cleanup(bundle) {
    if (!this.active.has(bundle)) return;
    this.active.delete(bundle);
    for (const node of Object.values(bundle)) {
      safeStop(node);
      safeDisconnect(node);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const bundle of [...this.active]) this._cleanup(bundle);
  }
}
