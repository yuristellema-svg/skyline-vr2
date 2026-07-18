import { AircraftEngineAudio } from './audio/aircraftEngineAudio.js';
import { AirflowAudio } from './audio/airflowAudio.js';
import { BoostAudio } from './audio/boostAudio.js';
import { FlightWarningAudio } from './audio/flightWarningAudio.js';
import { PositionalTrafficAudio } from './audio/positionalTrafficAudio.js';
import { StukaDiveSiren } from './audio/stukaDiveSiren.js?v=biplane-mobile-audio-controls-v3';
import { ZeroRadioAudio } from './audio/zeroRadioAudio.js?v=biplane-mobile-audio-controls-v3';
import { LandingAudio } from './expansion/landingAudio.js';
import {
  safeDisconnect,
  safeSetTarget,
} from './audio/audioMath.js';

const OWNER_KEY = Symbol.for('skyline-vr2.aircraft-warning-audio.owner');

function contextFactory() {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) return null;
  try {
    return new Context({ latencyHint: 'interactive' });
  } catch {
    return new Context();
  }
}

export class WindAudioSystem {
  constructor(options = {}) {
    this.contextFactory = options.contextFactory || contextFactory;
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.sampleHeight = options.sampleHeight || null;
    this.masterLevel = Math.max(0.12, Math.min(0.50, Number(options.masterLevel) || 0.36));
    this.profile = options.initialProfile || 'zero';
    this.radioEnabled = false;
    this.context = null;
    this.ready = false;
    this.disabled = false;
    this.disposed = false;
    this.failedReason = '';
    this.duplicate = false;
    this.legacyTrafficDistance = Infinity;

    const owner = globalThis[OWNER_KEY];
    if (owner && owner !== this && !owner.disposed) {
      this.duplicate = true;
      this.disabled = true;
      this.failedReason = 'Duplicate audio engine prevented';
      return;
    }
    globalThis[OWNER_KEY] = this;

    this._unlock = () => {
      void this.unlockFromGesture(false);
    };
    this._onAircraft = event => {
      this.profile = event?.detail?.id || this.profile;
    };
    this._onRadio = event => {
      this.radioEnabled = Boolean(event?.detail?.enabled);
      this.zeroRadio?.setEnabled(this.radioEnabled);
    };
    this._onBoost = event => {
      try { this.boost?.playActivation(event?.detail?.chain || 1); } catch {}
    };

    this._listen('pointerdown', this._unlock, { passive: true });
    this._listen('click', this._unlock, { passive: true });
    this._listen('touchend', this._unlock, { passive: true });
    this._listen('keydown', this._unlock);
    this._listen('skyline:aircraft-changed', this._onAircraft);
    this._listen('skyline:radio-changed', this._onRadio);
    this._listen('skyline:boost-fired', this._onBoost);
  }

  _listen(type, handler, options) {
    try { this.eventTarget?.addEventListener?.(type, handler, options); } catch {}
  }

  _unlisten(type, handler) {
    try { this.eventTarget?.removeEventListener?.(type, handler); } catch {}
  }

  _fail(error) {
    this.disabled = true;
    this.ready = false;
    this.failedReason = error instanceof Error ? error.message : String(error || 'Audio unavailable');
    try { this._disposeGraph(); } catch {}
    try {
      if (this.context && this.context.state !== 'closed') {
        void this.context.close?.().catch?.(() => {});
      }
    } catch {}
    this.context = null;
  }

  _playUnlockTone() {
    const context =
      this.context;

    if (!context) {
      return;
    }

    const now =
      context.currentTime;

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type =
      'sine';

    oscillator.frequency
      .setValueAtTime(
        420,
        now,
      );

    gain.gain
      .setValueAtTime(
        0.0001,
        now,
      );

    gain.gain
      .exponentialRampToValueAtTime(
        0.018,
        now + 0.012,
      );

    gain.gain
      .exponentialRampToValueAtTime(
        0.0001,
        now + 0.09,
      );

    oscillator.connect(gain);
    gain.connect(
      context.destination,
    );

    oscillator.start(now);
    oscillator.stop(
      now + 0.10,
    );

    oscillator.onended =
      () => {
        safeDisconnect(
          oscillator,
        );

        safeDisconnect(gain);
      };
  }

  _discardContextForRetryNow() {
    const oldContext =
      this.context;

    try {
      this._disposeGraph();
    } catch {}

    this.context = null;
    this.ready = false;
    this.disabled = false;
    this.failedReason = '';

    /*
     * Do not await close here. On iPhone, creating and
     * resuming the replacement context must still occur
     * inside the original tap call stack.
     */
    try {
      if (
        oldContext &&
        oldContext.state !==
          'closed'
      ) {
        const closing =
          oldContext.close?.();

        closing?.catch?.(
          () => {},
        );
      }
    } catch {}
  }

  async unlockFromGesture(
    forceRebuild = false,
  ) {
    if (this.disposed) {
      return false;
    }

    try {
      const state =
        this.context
          ?.state ||
        'none';

      if (
        forceRebuild ||
        this.disabled ||
        state === 'closed' ||
        state === 'interrupted'
      ) {
        this._discardContextForRetryNow();
      }

      /*
       * These calls happen synchronously before the
       * first await, preserving Safari's user gesture.
       */
      if (!this.context) {
        this.context =
          this.contextFactory?.();

        if (!this.context) {
          throw new Error(
            'Web Audio is unavailable',
          );
        }

        this._buildGraph();
      }

      const resumePromise =
        this.context.state !==
          'running'
          ? this.context.resume?.()
          : null;

      this._playUnlockTone();

      if (
        resumePromise &&
        typeof resumePromise.then ===
          'function'
      ) {
        await resumePromise;
      }

      if (
        this.context.state !==
        'running'
      ) {
        throw new Error(
          `AudioContext remained ${this.context.state}`,
        );
      }

      this.ready = true;
      this.disabled = false;
      this.failedReason = '';

      return true;
    } catch (error) {
      this._fail(error);
      return false;
    }
  }

  unlock() {
    if (this.disposed) {
      return false;
    }

    void this
      .unlockFromGesture(false);

    return true;
  }

  _buildGraph() {
    const context = this.context;
    this.mixBus = context.createGain();
    this.mixBus.gain.value = 0.0001;

    this.phoneHighpass = context.createBiquadFilter();
    this.phoneHighpass.type = 'highpass';
    this.phoneHighpass.frequency.value = 38;
    this.phoneHighpass.Q.value = 0.45;

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

    this.mixBus.connect(this.phoneHighpass);
    this.phoneHighpass.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(context.destination);

    this.engine = new AircraftEngineAudio(context, this.mixBus);
    this.airflow = new AirflowAudio(context, this.mixBus);
    this.warnings = new FlightWarningAudio(context, this.mixBus, {
      sampleHeight: this.sampleHeight,
    });
    this.boost = new BoostAudio(context, this.mixBus);
    this.traffic = new PositionalTrafficAudio(context, this.mixBus);
    this.stukaSiren = new StukaDiveSiren(context, this.mixBus);
    this.zeroRadio = new ZeroRadioAudio(context, this.mixBus);
    this.zeroRadio.setEnabled(this.radioEnabled);
    this.landing = new LandingAudio(context, this.mixBus, this.eventTarget);
  }

  setTrafficDistance(distance) {
    this.legacyTrafficDistance = Number.isFinite(distance) ? distance : Infinity;
  }

  update(dt, flight, cameraOrPhase, phaseOrSources, maybeSources) {
    if (!this.ready || !this.context || this.disabled || this.disposed) return;
    let camera = cameraOrPhase;
    let phase = phaseOrSources;
    let trafficSources = maybeSources;
    if (typeof cameraOrPhase === 'string') {
      camera = null;
      phase = cameraOrPhase;
      trafficSources = Array.isArray(phaseOrSources) ? phaseOrSources : [];
    }
    if (typeof phase !== 'string') phase = 'flying';
    if (!Array.isArray(trafficSources)) trafficSources = [];

    try {
      const now = this.context.currentTime;
      safeSetTarget(
        this.mixBus.gain,
        (phase === 'flying' ? this.masterLevel : this.masterLevel * 0.16) + 0.0001,
        now,
        0.12,
      );
      this.engine.update(this.profile, flight, phase);
      this.airflow.update(this.profile, flight, phase);
      this.warnings.update(dt, this.profile, flight, phase);
      this.boost.update(flight);
      this.traffic.update(dt, flight, camera, phase, trafficSources);
      this.stukaSiren.update(this.profile, flight, phase);
      this.zeroRadio.update(this.profile, phase);
    } catch (error) {
      this._fail(error);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      disabled: this.disabled,
      duplicate: this.duplicate,
      profile: this.profile,
      failedReason: this.failedReason,
      contextState: this.context?.state || 'none',
      radioEnabled: this.radioEnabled,
    };
  }

  _disposeGraph() {
    for (const system of [
      this.engine,
      this.airflow,
      this.warnings,
      this.boost,
      this.traffic,
      this.stukaSiren,
      this.zeroRadio,
      this.landing,
    ]) {
      try { system?.dispose?.(); } catch {}
    }
    this.engine = null;
    this.airflow = null;
    this.warnings = null;
    this.boost = null;
    this.traffic = null;
    this.stukaSiren = null;
    this.zeroRadio = null;
    this.landing = null;
    for (const node of [this.mixBus, this.phoneHighpass, this.compressor, this.limiter]) {
      safeDisconnect(node);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._unlisten('pointerdown', this._unlock);
    this._unlisten('click', this._unlock);
    this._unlisten('touchend', this._unlock);
    this._unlisten('keydown', this._unlock);
    this._unlisten('skyline:aircraft-changed', this._onAircraft);
    this._unlisten('skyline:radio-changed', this._onRadio);
    this._unlisten('skyline:boost-fired', this._onBoost);
    this._disposeGraph();
    try {
      if (this.context && this.context.state !== 'closed') {
        void this.context.close?.().catch?.(() => {});
      }
    } catch {}
    this.context = null;
    this.ready = false;
    if (globalThis[OWNER_KEY] === this) delete globalThis[OWNER_KEY];
  }
}
