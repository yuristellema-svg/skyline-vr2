import {
  PHONE_AUDIO_LIMITS,
  SOUND_OWNER_KEY,
} from './profiles.js';

function defaultContextFactory() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return null;
  try {
    return new Context({ latencyHint: 'interactive' });
  } catch {
    return new Context();
  }
}

function disconnect(node) {
  try { node?.disconnect?.(); } catch {}
}

export class AudioOwner {
  constructor(options = {}) {
    this.contextFactory = options.contextFactory || defaultContextFactory;
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.masterLevel = Math.max(0.10, Math.min(0.42, Number(options.masterLevel) || PHONE_AUDIO_LIMITS.masterLevel));
    this.context = null;
    this.output = null;
    this.ready = false;
    this.disabled = false;
    this.duplicate = false;
    this.disposed = false;
    this.failedReason = '';
    this.unlockCount = 0;
    this.onReady = typeof options.onReady === 'function' ? options.onReady : null;

    const existing = globalThis[SOUND_OWNER_KEY];
    if (existing && existing !== this && !existing.disposed) {
      this.disabled = true;
      this.duplicate = true;
      this.failedReason = 'Duplicate audio owner prevented';
      return;
    }
    globalThis[SOUND_OWNER_KEY] = this;

    this._unlock = () => { this.unlock(); };
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      try { this.eventTarget?.addEventListener?.(type, this._unlock, { passive: true }); } catch {}
    }
  }

  _buildOutput() {
    const context = this.context;
    this.mixBus = context.createGain();
    this.mixBus.gain.value = this.masterLevel;

    this.highpass = context.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = PHONE_AUDIO_LIMITS.highpassHz;
    this.highpass.Q.value = 0.45;

    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 4.5;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.20;

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = -4;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.0015;
    this.limiter.release.value = 0.085;

    this.mixBus.connect(this.highpass);
    this.highpass.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(context.destination);
    this.output = this.mixBus;
  }

  unlock() {
    if (this.disabled || this.disposed) return false;
    this.unlockCount += 1;
    try {
      if (!this.context) {
        this.context = this.contextFactory?.();
        if (!this.context) throw new Error('Web Audio unavailable');
        this._buildOutput();
        this.onReady?.(this.context, this.output);
      }
      if (this.context.state === 'suspended') {
        const resume = this.context.resume?.();
        resume?.catch?.(error => this.fail(error));
      }
      this.ready = true;
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  fail(error) {
    this.disabled = true;
    this.ready = false;
    this.failedReason = error instanceof Error ? error.message : String(error || 'Audio failed');
    for (const node of [this.mixBus, this.highpass, this.compressor, this.limiter]) {
      disconnect(node);
    }
    try { this.context?.close?.(); } catch {}
    this.context = null;
    this.output = null;
  }

  getStatus() {
    return {
      ready: this.ready,
      disabled: this.disabled,
      duplicate: this.duplicate,
      disposed: this.disposed,
      contextState: this.context?.state || 'none',
      failedReason: this.failedReason,
      unlockCount: this.unlockCount,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      try { this.eventTarget?.removeEventListener?.(type, this._unlock); } catch {}
    }
    for (const node of [this.mixBus, this.highpass, this.compressor, this.limiter]) disconnect(node);
    try {
      if (this.context && this.context.state !== 'closed') this.context.close?.();
    } catch {}
    this.context = null;
    this.output = null;
    this.ready = false;
    if (globalThis[SOUND_OWNER_KEY] === this) delete globalThis[SOUND_OWNER_KEY];
  }
}
