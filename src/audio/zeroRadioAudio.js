import {
  safeDisconnect,
  safeSetTarget,
  safeStop,
} from './audioMath.js';

const RADIO_URL = new URL(
  '../../assets/audio/zero-radio.mp3',
  import.meta.url,
);

function decodeSample(context, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const done = buffer => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };

    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    try {
      const result = context.decodeAudioData(
        bytes.slice(0),
        done,
        fail,
      );

      result?.then?.(done, fail);
    } catch (error) {
      fail(error);
    }
  });
}

export class ZeroRadioAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.enabled = false;
    this.disposed = false;
    this.buffer = null;
    this.source = null;
    this.loading = null;
    this.loadFailed = false;
    this.failedReason = '';
    this.playbackOffset = 0;
    this.startedAt = 0;

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
  }

  preload(forceRetry = false) {
    return this._beginLoad(forceRetry);
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
        RADIO_URL,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error(
          `Radio sample HTTP ${response.status}`,
        );
      }

      const bytes = await response.arrayBuffer();

      this.buffer = await decodeSample(
        this.context,
        bytes,
      );

      this.failedReason = '';
      return true;
    } catch (error) {
      this.failedReason =
        error instanceof Error
          ? error.message
          : String(error);

      return false;
    }
  }

  _normalizedOffset() {
    const duration =
      Number(this.buffer?.duration) || 0;

    if (duration <= 0) return 0;

    return (
      (this.playbackOffset % duration) +
      duration
    ) % duration;
  }

  _startSource() {
    if (
      this.disposed ||
      this.source ||
      !this.buffer
    ) {
      return;
    }

    const source =
      this.context.createBufferSource();

    const offset =
      this._normalizedOffset();

    source.buffer = this.buffer;
    source.loop = true;
    source.connect(this.highpass);

    source.onended = () => {
      if (this.source === source) {
        this.source = null;
      }

      safeDisconnect(source);
    };

    try {
      source.start(0, offset);

      this.startedAt =
        this.context.currentTime - offset;

      this.source = source;
    } catch (error) {
      safeDisconnect(source);

      this.failedReason =
        error instanceof Error
          ? error.message
          : String(error);
    }
  }

  _pauseSource(reset = false) {
    const source = this.source;

    if (
      source &&
      !reset &&
      this.buffer
    ) {
      const duration =
        Number(this.buffer.duration) || 0;

      if (duration > 0) {
        const elapsed = Math.max(
          0,
          this.context.currentTime -
            this.startedAt,
        );

        this.playbackOffset =
          elapsed % duration;
      }
    }

    this.source = null;

    if (source) {
      safeStop(
        source,
        this.context.currentTime + 0.01,
      );

      safeDisconnect(source);
    }

    if (reset) {
      this.playbackOffset = 0;
      this.startedAt = 0;
    }
  }

  setEnabled(enabled) {
    const next = Boolean(enabled);
    const changed = next !== this.enabled;

    this.enabled = next;

    if (this.enabled && changed) {
      void this._beginLoad(true);
    }

    if (!this.enabled) {
      this._pauseSource(true);
    }

    return this.enabled;
  }

  update(profile, phase = 'flying') {
    if (this.disposed) return;

    const isZero =
      profile === 'zero';

    const audible =
      this.enabled &&
      isZero &&
      phase === 'flying';

    if (audible) {
      if (!this.buffer) {
        void this._beginLoad(false);
      }

      this._startSource();
    } else {
      this._pauseSource(
        !this.enabled || !isZero,
      );
    }

    safeSetTarget(
      this.gain.gain,
      audible ? 0.34 : 0.0001,
      this.context.currentTime,
      audible ? 0.08 : 0.06,
    );
  }

  getStatus() {
    return {
      enabled: this.enabled,
      loaded: Boolean(this.buffer),
      loading: Boolean(this.loading),
      playing: Boolean(this.source),
      playbackOffset: this.playbackOffset,
      failedReason: this.failedReason,
    };
  }

  dispose() {
    if (this.disposed) return;

    this.disposed = true;
    this._pauseSource(true);
    safeDisconnect(this.highpass);
    safeDisconnect(this.lowpass);
    safeDisconnect(this.gain);
    this.buffer = null;
    this.loading = null;
  }
}
