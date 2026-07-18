import {
  safeDisconnect,
  safeSetTarget,
  safeStop,
} from './audioMath.js';

const SIREN_URL = new URL(
  '../../assets/audio/stuka-siren.mp3',
  import.meta.url,
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp(
    (value - edge0) / Math.max(0.0001, edge1 - edge0),
    0,
    1,
  );
  return amount * amount * (3 - 2 * amount);
}

export function stukaSirenDemand(
  profile,
  flight,
  phase = 'flying',
) {
  if (profile !== 'stuka' || phase !== 'flying') return 0;

  const speed = Math.max(0, Number(flight?.speed) || 0);
  const diveAngle = Math.max(0, -(Number(flight?.pathAngle) || 0));
  const explicitVertical = Number(flight?.verticalSpeed);
  const velocityY = Number(flight?.velocity?.y);

  const verticalSpeed =
    Number.isFinite(explicitVertical)
      ? Math.max(0, -explicitVertical)
      : Number.isFinite(velocityY)
        ? Math.max(0, -velocityY)
        : speed * Math.sin(diveAngle);

  return (
    smoothstep(42, 76, speed) *
    smoothstep(0.24, 0.62, diveAngle) *
    smoothstep(10, 38, verticalSpeed)
  );
}

export class StukaDiveSiren {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.demand = 0;
    this.disposed = false;
    this.buffer = null;
    this.source = null;
    this.loading = null;
    this.loadFailed = false;
    this.wasStuka = false;
    this.failedReason = '';

    this.highpass = context.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 180;
    this.highpass.Q.value = 0.55;

    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 6200;
    this.lowpass.Q.value = 0.55;

    this.outputGain = context.createGain();
    this.outputGain.gain.value = 0.0001;

    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.outputGain);
    this.outputGain.connect(output);
  }

  _beginLoad(forceRetry = false) {
    if (
      this.disposed ||
      this.buffer ||
      this.loading ||
      (this.loadFailed && !forceRetry)
    ) {
      return this.loading;
    }

    this.loadFailed = false;
    this.loading = this._load()
      .then(success => {
        this.loadFailed = !success;
        return success;
      })
      .finally(() => {
        this.loading = null;
      });

    return this.loading;
  }

  async _load() {
    try {
      const response = await fetch(
        SIREN_URL,
        { cache: 'force-cache' },
      );
      if (!response.ok) throw new Error(`Stuka siren HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(bytes.slice(0));
      this.failedReason = '';
      return true;
    } catch (error) {
      this.failedReason = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  _ensureSource() {
    if (this.disposed || this.source || !this.buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.playbackRate.value = 1;
    source.connect(this.highpass);
    source.start();
    source.onended = () => {
      if (this.source === source) this.source = null;
      safeDisconnect(source);
    };
    this.source = source;
  }

  update(profile, flight, phase) {
    if (this.disposed) return;

    const stukaActive = profile === 'stuka' && phase === 'flying';
    if (stukaActive && !this.wasStuka) void this._beginLoad(true);
    this.wasStuka = stukaActive;

    this.demand = stukaSirenDemand(profile, flight, phase);
    this._ensureSource();

    const now = this.context.currentTime;
    safeSetTarget(
      this.outputGain.gain,
      0.0001 + this.demand * 0.42,
      now,
      this.demand > 0.02 ? 0.16 : 0.30,
    );

    if (this.source?.playbackRate) {
      safeSetTarget(
        this.source.playbackRate,
        0.98 + this.demand * 0.06,
        now,
        0.30,
      );
    }
  }

  getStatus() {
    return {
      active: this.demand > 0.05,
      demand: this.demand,
      loaded: Boolean(this.buffer),
      loading: Boolean(this.loading),
      failedReason: this.failedReason,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    safeStop(this.source, this.context.currentTime + 0.02);
    safeDisconnect(this.source);
    safeDisconnect(this.highpass);
    safeDisconnect(this.lowpass);
    safeDisconnect(this.outputGain);
    this.source = null;
    this.buffer = null;
    this.loading = null;
  }
}
