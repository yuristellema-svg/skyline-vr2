import {
  safeDisconnect,
  safeSetTarget,
  safeStop,
} from './audioMath.js';

const RADIO_URL = new URL(
  '../../assets/audio/zero-radio.mp3',
  import.meta.url,
);

export class ZeroRadioAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.enabled = false;
    this.disposed = false;
    this.buffer = null;
    this.source = null;
    this.failedReason = '';

    this.highpass = context.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 150;
    this.highpass.Q.value = 0.55;

    this.lowpass = context.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 5200;
    this.lowpass.Q.value = 0.45;

    this.gain = context.createGain();
    this.gain.gain.value = 0.0001;

    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.gain);
    this.gain.connect(output);

    this.loading = this._load();
  }

  async _load() {
    try {
      const response = await fetch(RADIO_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Radio sample HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(bytes.slice(0));
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
    source.connect(this.highpass);
    source.start();
    source.onended = () => {
      if (this.source === source) this.source = null;
      safeDisconnect(source);
    };
    this.source = source;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    return this.enabled;
  }

  update(profile, phase = 'flying') {
    if (this.disposed) return;
    this._ensureSource();
    const audible = this.enabled && profile === 'zero' && phase === 'flying';
    safeSetTarget(
      this.gain.gain,
      audible ? 0.30 : 0.0001,
      this.context.currentTime,
      audible ? 0.12 : 0.20,
    );
  }

  getStatus() {
    return {
      enabled: this.enabled,
      loaded: Boolean(this.buffer),
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
    safeDisconnect(this.gain);
    this.source = null;
    this.buffer = null;
  }
}
