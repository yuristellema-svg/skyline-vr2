import {
  approach,
  cancelAndHold,
  clamp,
  setTarget,
  setValue,
} from './audioMath.js';
import {
  resolveAircraftAudioProfile,
} from './aircraftAudioProfiles.js';
import {
  computeAircraftAudioTargets,
  computeBoostParameters,
  computeSirenFrequencies,
  computeTrafficVoiceTarget,
} from './audioTargets.js';

const OWNER_KEY = '__SKYLINE_OPTIONAL_AIRCRAFT_AUDIO_OWNER__';
const SILENCE = 0.0001;
const MAX_TRAFFIC_VOICES = 6;

function createNoiseBuffer(context, seconds = 3) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let pink = 0;

  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = brown * 0.988 + white * 0.012;
    pink = pink * 0.86 + white * 0.14;
    data[index] = white * 0.30 + pink * 0.42 + brown * 0.58;
  }

  return buffer;
}

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch {
    // Cleanup is best effort.
  }
}

function safeStop(node, when = 0) {
  try {
    node?.stop?.(when);
  } catch {
    // A stopped or unsupported node must not affect the game.
  }
}

function setPannerPosition(panner, position, now) {
  if (!panner || !position) return;

  if (panner.positionX) {
    setTarget(panner.positionX, position.x, now, 0.035);
    setTarget(panner.positionY, position.y, now, 0.035);
    setTarget(panner.positionZ, position.z, now, 0.035);
  } else {
    panner.setPosition?.(position.x, position.y, position.z);
  }
}

function quaternionDirections(quaternion) {
  const x = Number(quaternion?.x) || 0;
  const y = Number(quaternion?.y) || 0;
  const z = Number(quaternion?.z) || 0;
  const w = Number.isFinite(quaternion?.w) ? quaternion.w : 1;

  return {
    forward: {
      x: -2 * (x * z + w * y),
      y: -2 * (y * z - w * x),
      z: -1 + 2 * (x * x + y * y),
    },
    up: {
      x: 2 * (x * y - w * z),
      y: 1 - 2 * (x * x + z * z),
      z: 2 * (y * z + w * x),
    },
  };
}

function disconnectGraph(nodes) {
  for (const node of nodes) safeDisconnect(node);
}

export class AircraftAudioEngine {
  constructor(options = {}) {
    this.contextFactory = options.contextFactory || (() => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context({ latencyHint: 'interactive' }) : null;
    });
    this.eventTarget = options.eventTarget || globalThis.window || null;
    this.ownerStore = options.ownerStore || globalThis;
    this.profile = resolveAircraftAudioProfile(options.initialProfile || 'zero');
    this.masterLevel = clamp(options.masterLevel ?? 0.50, 0.12, 0.62);

    this.context = null;
    this.ready = false;
    this.disabled = false;
    this.disposed = false;
    this.duplicateBlocked = false;
    this.failedReason = '';
    this.sirenMix = 0;
    this.trafficVoices = new Map();
    this.transientNodes = new Set();
    this.continuousNodes = [];

    this._onUnlock = () => {
      this.unlock();
    };
    this._onAircraftChanged = event => {
      this.setProfile(event?.detail?.id);
    };
    this._onBoost = event => {
      this.playBoost(event?.detail?.chain || 1);
    };

    this._listen('pointerdown', this._onUnlock, { passive: true });
    this._listen('keydown', this._onUnlock);
    this._listen('skyline:aircraft-changed', this._onAircraftChanged);
    this._listen('skyline:boost-fired', this._onBoost);
  }

  _listen(type, handler, options) {
    try {
      this.eventTarget?.addEventListener?.(type, handler, options);
    } catch {
      // Event wiring is optional and failure-safe.
    }
  }

  _removeListener(type, handler) {
    try {
      this.eventTarget?.removeEventListener?.(type, handler);
    } catch {
      // Cleanup is optional.
    }
  }

  _detachUnlockListeners() {
    this._removeListener('pointerdown', this._onUnlock);
    this._removeListener('keydown', this._onUnlock);
  }

  _claimOwnership() {
    const current = this.ownerStore?.[OWNER_KEY];
    if (current && current !== this && !current.disposed) {
      this.duplicateBlocked = true;
      return false;
    }

    if (this.ownerStore) this.ownerStore[OWNER_KEY] = this;
    this.duplicateBlocked = false;
    return true;
  }

  _releaseOwnership() {
    if (this.ownerStore?.[OWNER_KEY] === this) {
      try {
        delete this.ownerStore[OWNER_KEY];
      } catch {
        this.ownerStore[OWNER_KEY] = null;
      }
    }
  }

  _fail(error) {
    this.disabled = true;
    this.ready = false;
    this.failedReason = error instanceof Error
      ? error.message
      : String(error || 'Audio unavailable');

    try {
      this._disposeGraph();
    } catch {
      // Audio failure must remain isolated.
    }

    try {
      if (this.context && this.context.state !== 'closed') {
        void this.context.close?.().catch?.(() => {});
      }
    } catch {
      // Closing failure is ignored.
    }

    this.context = null;
    this._releaseOwnership();
  }

  unlock() {
    if (this.disposed || this.disabled) return false;
    if (this.ready && this.context) return true;
    if (!this._claimOwnership()) return false;

    try {
      if (!this.context) {
        this.context = this.contextFactory?.();
        if (!this.context) throw new Error('Web Audio is unavailable');
        this._buildGraph();
      }

      if (this.context.state === 'suspended') {
        const resume = this.context.resume?.();
        resume?.catch?.(error => this._fail(error));
      }

      this.ready = true;
      this._detachUnlockListeners();
      return true;
    } catch (error) {
      this._fail(error);
      return false;
    }
  }

  setProfile(profileId) {
    this.profile = resolveAircraftAudioProfile(profileId);

    if (this.profile.id !== 'stuka') {
      this.sirenMix = 0;
      if (this.context && this.sirenGain) {
        const now = this.context.currentTime;
        setTarget(this.sirenGain.gain, SILENCE, now, 0.035);
      }
    }

    return this.profile;
  }

  _buildGraph() {
    const context = this.context;
    this.noiseBuffer = createNoiseBuffer(context);

    this.master = context.createGain();
    this.master.gain.value = SILENCE;

    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4.5;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.18;

    this.limiter = context.createDynamicsCompressor();
    this.limiter.threshold.value = -4.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.0025;
    this.limiter.release.value = 0.11;

    this.master.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(context.destination);

    this._buildWindGraph();
    this._buildBuffetGraph();
    this._buildEngineGraph();
    this._buildSirenGraph();
  }

  _makeLoopingNoiseSource() {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.start();
    this.continuousNodes.push(source);
    return source;
  }

  _buildWindGraph() {
    const context = this.context;
    this.windSource = this._makeLoopingNoiseSource();

    this.windBodyFilter = context.createBiquadFilter();
    this.windBodyFilter.type = 'bandpass';
    this.windBodyFilter.Q.value = 0.45;
    this.windBodyGain = context.createGain();
    this.windBodyGain.gain.value = SILENCE;

    this.windHissFilter = context.createBiquadFilter();
    this.windHissFilter.type = 'highpass';
    this.windHissFilter.frequency.value = 1800;
    this.windHissGain = context.createGain();
    this.windHissGain.gain.value = SILENCE;

    this.windSource.connect(this.windBodyFilter);
    this.windBodyFilter.connect(this.windBodyGain);
    this.windBodyGain.connect(this.master);

    this.windSource.connect(this.windHissFilter);
    this.windHissFilter.connect(this.windHissGain);
    this.windHissGain.connect(this.master);
  }

  _buildBuffetGraph() {
    const context = this.context;
    this.buffetSource = this._makeLoopingNoiseSource();
    this.buffetFilter = context.createBiquadFilter();
    this.buffetFilter.type = 'bandpass';
    this.buffetFilter.Q.value = 1.35;
    this.buffetGain = context.createGain();
    this.buffetGain.gain.value = SILENCE;

    this.buffetLfo = context.createOscillator();
    this.buffetLfo.type = 'triangle';
    this.buffetLfo.frequency.value = 9;
    this.buffetLfoDepth = context.createGain();
    this.buffetLfoDepth.gain.value = 0.035;
    this.buffetLfo.connect(this.buffetLfoDepth);
    this.buffetLfoDepth.connect(this.buffetGain.gain);
    this.buffetLfo.start();
    this.continuousNodes.push(this.buffetLfo);

    this.buffetSource.connect(this.buffetFilter);
    this.buffetFilter.connect(this.buffetGain);
    this.buffetGain.connect(this.master);
  }

  _buildEngineGraph() {
    const context = this.context;

    this.engineHighpass = context.createBiquadFilter();
    this.engineHighpass.type = 'highpass';
    this.engineHighpass.frequency.value = 34;
    this.engineHighpass.Q.value = 0.72;

    this.engineLowShelf = context.createBiquadFilter();
    this.engineLowShelf.type = 'lowshelf';
    this.engineLowShelf.frequency.value = 115;
    this.engineLowShelf.gain.value = 2;

    this.engineLowpass = context.createBiquadFilter();
    this.engineLowpass.type = 'lowpass';
    this.engineLowpass.frequency.value = 1000;
    this.engineLowpass.Q.value = 0.58;

    this.engineGain = context.createGain();
    this.engineGain.gain.value = SILENCE;

    this.engineHighpass.connect(this.engineLowShelf);
    this.engineLowShelf.connect(this.engineLowpass);
    this.engineLowpass.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.engineFlutter = context.createOscillator();
    this.engineFlutter.type = 'sine';
    this.engineFlutter.frequency.value = 4.65;
    this.engineFlutterDepth = context.createGain();
    this.engineFlutterDepth.gain.value = 3.5;
    this.engineFlutter.connect(this.engineFlutterDepth);
    this.engineFlutter.start();
    this.continuousNodes.push(this.engineFlutter);

    this.subharmonic = context.createOscillator();
    this.subharmonic.type = 'triangle';
    this.subharmonic.frequency.value = 22;
    this.subharmonicGain = context.createGain();
    this.subharmonicGain.gain.value = SILENCE;
    this.subharmonic.connect(this.subharmonicGain);
    this.subharmonicGain.connect(this.engineHighpass);
    this.subharmonic.start();
    this.continuousNodes.push(this.subharmonic);

    this.enginePartials = [];
    const maxPartials = 6;
    for (let index = 0; index < maxPartials; index += 1) {
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 44 * (index + 1);
      const gain = context.createGain();
      gain.gain.value = SILENCE;
      oscillator.connect(gain);
      gain.connect(this.engineHighpass);
      this.engineFlutterDepth.connect(oscillator.detune);
      oscillator.start();
      this.continuousNodes.push(oscillator);
      this.enginePartials.push({ oscillator, gain });
    }

    this.engineNoiseSource = this._makeLoopingNoiseSource();
    this.engineNoiseFilter = context.createBiquadFilter();
    this.engineNoiseFilter.type = 'bandpass';
    this.engineNoiseFilter.frequency.value = 620;
    this.engineNoiseFilter.Q.value = 0.72;
    this.engineNoiseGain = context.createGain();
    this.engineNoiseGain.gain.value = SILENCE;
    this.engineNoiseSource.connect(this.engineNoiseFilter);
    this.engineNoiseFilter.connect(this.engineNoiseGain);
    this.engineNoiseGain.connect(this.engineHighpass);

    this.propellerPulse = context.createOscillator();
    this.propellerPulse.type = 'triangle';
    this.propellerPulse.frequency.value = 72;
    this.propellerFilter = context.createBiquadFilter();
    this.propellerFilter.type = 'bandpass';
    this.propellerFilter.frequency.value = 155;
    this.propellerFilter.Q.value = 0.85;
    this.propellerGain = context.createGain();
    this.propellerGain.gain.value = SILENCE;
    this.propellerPulse.connect(this.propellerFilter);
    this.propellerFilter.connect(this.propellerGain);
    this.propellerGain.connect(this.engineHighpass);
    this.propellerPulse.start();
    this.continuousNodes.push(this.propellerPulse);
  }

  _buildSirenGraph() {
    const context = this.context;

    this.sirenA = context.createOscillator();
    this.sirenA.type = 'sawtooth';
    this.sirenB = context.createOscillator();
    this.sirenB.type = 'triangle';
    this.sirenAGain = context.createGain();
    this.sirenBGain = context.createGain();
    this.sirenAGain.gain.value = 0.52;
    this.sirenBGain.gain.value = 0.42;

    this.sirenAM = context.createGain();
    this.sirenAM.gain.value = 0.80;
    this.sirenLfo = context.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 8;
    this.sirenLfoDepth = context.createGain();
    this.sirenLfoDepth.gain.value = 0.17;

    this.sirenNoiseSource = this._makeLoopingNoiseSource();
    this.sirenNoiseFilter = context.createBiquadFilter();
    this.sirenNoiseFilter.type = 'bandpass';
    this.sirenNoiseFilter.frequency.value = 1250;
    this.sirenNoiseFilter.Q.value = 2.4;
    this.sirenNoiseGain = context.createGain();
    this.sirenNoiseGain.gain.value = 0.07;

    this.sirenFilter = context.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 1100;
    this.sirenFilter.Q.value = 4.2;
    this.sirenPresence = context.createBiquadFilter();
    this.sirenPresence.type = 'peaking';
    this.sirenPresence.frequency.value = 1650;
    this.sirenPresence.Q.value = 0.9;
    this.sirenPresence.gain.value = 4.5;
    this.sirenGain = context.createGain();
    this.sirenGain.gain.value = SILENCE;

    this.sirenA.connect(this.sirenAGain);
    this.sirenB.connect(this.sirenBGain);
    this.sirenAGain.connect(this.sirenAM);
    this.sirenBGain.connect(this.sirenAM);
    this.sirenNoiseSource.connect(this.sirenNoiseFilter);
    this.sirenNoiseFilter.connect(this.sirenNoiseGain);
    this.sirenNoiseGain.connect(this.sirenAM);
    this.sirenLfo.connect(this.sirenLfoDepth);
    this.sirenLfoDepth.connect(this.sirenAM.gain);
    this.sirenAM.connect(this.sirenFilter);
    this.sirenFilter.connect(this.sirenPresence);
    this.sirenPresence.connect(this.sirenGain);
    this.sirenGain.connect(this.master);

    this.sirenA.start();
    this.sirenB.start();
    this.sirenLfo.start();
    this.continuousNodes.push(this.sirenA, this.sirenB, this.sirenLfo);
  }

  _updateListener(flight, camera, now) {
    const position = camera?.position || flight?.position;
    const listener = this.context?.listener;
    if (!position || !listener) return;

    if (listener.positionX) {
      setTarget(listener.positionX, position.x, now, 0.025);
      setTarget(listener.positionY, position.y, now, 0.025);
      setTarget(listener.positionZ, position.z, now, 0.025);
    } else {
      listener.setPosition?.(position.x, position.y, position.z);
    }

    const orientation = quaternionDirections(camera?.quaternion);
    if (listener.forwardX) {
      setTarget(listener.forwardX, orientation.forward.x, now, 0.025);
      setTarget(listener.forwardY, orientation.forward.y, now, 0.025);
      setTarget(listener.forwardZ, orientation.forward.z, now, 0.025);
      setTarget(listener.upX, orientation.up.x, now, 0.025);
      setTarget(listener.upY, orientation.up.y, now, 0.025);
      setTarget(listener.upZ, orientation.up.z, now, 0.025);
    } else {
      listener.setOrientation?.(
        orientation.forward.x,
        orientation.forward.y,
        orientation.forward.z,
        orientation.up.x,
        orientation.up.y,
        orientation.up.z,
      );
    }
  }

  _ensureTrafficVoice(source) {
    const existing = this.trafficVoices.get(source.id);
    if (existing) return existing;

    const context = this.context;
    const fundamental = context.createOscillator();
    fundamental.type = 'sawtooth';
    const harmonic = context.createOscillator();
    harmonic.type = 'triangle';
    const fundamentalGain = context.createGain();
    const harmonicGain = context.createGain();
    fundamentalGain.gain.value = 0.62;
    harmonicGain.gain.value = 0.28;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    const gain = context.createGain();
    gain.gain.value = SILENCE;
    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 18;
    panner.maxDistance = 1800;
    panner.rolloffFactor = 1.18;

    fundamental.connect(fundamentalGain);
    harmonic.connect(harmonicGain);
    fundamentalGain.connect(filter);
    harmonicGain.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    fundamental.start();
    harmonic.start();

    const voice = {
      fundamental,
      harmonic,
      filter,
      gain,
      panner,
      lastSeen: context.currentTime,
    };
    this.trafficVoices.set(source.id, voice);
    return voice;
  }

  _disposeTrafficVoice(id, voice) {
    safeStop(voice?.fundamental);
    safeStop(voice?.harmonic);
    disconnectGraph([
      voice?.fundamental,
      voice?.harmonic,
      voice?.filter,
      voice?.gain,
      voice?.panner,
    ]);
    this.trafficVoices.delete(id);
  }

  _updateTraffic(trafficSources, active, now) {
    const activeIds = new Set();

    for (const source of trafficSources.slice(0, MAX_TRAFFIC_VOICES)) {
      if (!source?.id || !source.position) continue;

      activeIds.add(source.id);
      const voice = this._ensureTrafficVoice(source);
      const target = computeTrafficVoiceTarget(source, active);
      voice.lastSeen = now;
      setPannerPosition(voice.panner, source.position, now);
      setTarget(voice.fundamental.frequency, target.fundamental, now, 0.09);
      setTarget(voice.harmonic.frequency, target.harmonic, now, 0.09);
      setTarget(voice.filter.frequency, target.filter, now, 0.10);
      setTarget(voice.gain.gain, target.gain, now, 0.10);
    }

    for (const [id, voice] of this.trafficVoices) {
      if (activeIds.has(id)) continue;
      setTarget(voice.gain.gain, SILENCE, now, 0.10);
      if (now - voice.lastSeen > 7) this._disposeTrafficVoice(id, voice);
    }
  }

  update(dt, flight, camera, phase = 'flying', trafficSources = []) {
    if (!this.ready || !this.context || this.disabled || this.disposed) return;

    try {
      const targets = computeAircraftAudioTargets(this.profile.id, flight, phase);
      const now = this.context.currentTime;
      const sirenRise = 0.72;
      const sirenRelease = this.profile.id === 'stuka' ? 0.30 : 0.055;
      this.sirenMix = approach(
        this.sirenMix,
        targets.sirenTarget,
        dt,
        targets.sirenTarget > this.sirenMix ? sirenRise : sirenRelease,
      );

      if (this.profile.id !== 'stuka') this.sirenMix = 0;

      setTarget(this.master.gain, targets.active * this.masterLevel + SILENCE, now, 0.08);

      setTarget(this.windBodyGain.gain, targets.windBodyGain + SILENCE, now, 0.075);
      setTarget(this.windBodyFilter.frequency, targets.windBodyFrequency, now, 0.08);
      setTarget(this.windHissGain.gain, targets.windHissGain + SILENCE, now, 0.075);
      setTarget(this.windHissFilter.frequency, targets.windHissFrequency, now, 0.08);

      setTarget(this.buffetGain.gain, targets.buffetGain + SILENCE, now, 0.045);
      setTarget(this.buffetFilter.frequency, targets.buffetFrequency, now, 0.055);
      setTarget(this.buffetLfo.frequency, 7 + targets.stall * 12, now, 0.06);
      setTarget(this.buffetLfoDepth.gain, targets.buffetGain * 0.38, now, 0.05);

      setTarget(this.engineGain.gain, targets.engineGain + SILENCE, now, 0.09);
      setTarget(this.engineLowpass.frequency, targets.engineFilter, now, 0.09);
      setTarget(this.engineLowShelf.frequency, this.profile.lowShelfHz, now, 0.12);
      setTarget(this.engineLowShelf.gain, targets.engineLowShelfDb, now, 0.12);
      setTarget(this.subharmonic.frequency, Math.max(1, targets.subharmonicFrequency), now, 0.08);
      setTarget(this.subharmonicGain.gain, targets.subharmonicGain + SILENCE, now, 0.09);
      setTarget(this.engineNoiseFilter.frequency, targets.mechanicalNoiseFrequency, now, 0.08);
      setTarget(this.engineNoiseGain.gain, targets.mechanicalNoiseGain + SILENCE, now, 0.08);
      setTarget(this.propellerPulse.frequency, Math.max(1, targets.propellerPulseFrequency), now, 0.07);
      setTarget(this.propellerFilter.frequency, Math.max(80, targets.propellerPulseFrequency * 1.7), now, 0.08);
      setTarget(this.propellerGain.gain, targets.propellerPulseGain + SILENCE, now, 0.08);

      for (let index = 0; index < this.enginePartials.length; index += 1) {
        const partial = this.enginePartials[index];
        const frequency = targets.harmonicFrequencies[index] || 1;
        const gain = targets.harmonicGains[index] || 0;
        const type = this.profile.harmonicTypes[index] || 'sine';
        partial.oscillator.type = type;
        setTarget(partial.oscillator.frequency, frequency, now, 0.075);
        setTarget(partial.oscillator.detune, this.profile.detuneCents[index] || 0, now, 0.12);
        setTarget(partial.gain.gain, gain + SILENCE, now, 0.09);
      }

      const siren = computeSirenFrequencies(targets, this.sirenMix);
      setTarget(this.sirenA.frequency, siren.primary, now, 0.075);
      setTarget(this.sirenB.frequency, siren.secondary, now, 0.075);
      setTarget(this.sirenFilter.frequency, siren.bandpass, now, 0.085);
      setTarget(this.sirenPresence.frequency, 1500 + this.sirenMix * 500, now, 0.09);
      setTarget(this.sirenLfo.frequency, siren.modulation, now, 0.10);
      setTarget(this.sirenLfoDepth.gain, 0.08 + this.sirenMix * 0.15, now, 0.08);
      setTarget(
        this.sirenGain.gain,
        this.profile.id === 'stuka'
          ? targets.active * this.sirenMix * 0.31 + SILENCE
          : SILENCE,
        now,
        targets.sirenTarget > this.sirenMix ? 0.10 : 0.075,
      );

      this._updateListener(flight, camera, now);
      this._updateTraffic(Array.isArray(trafficSources) ? trafficSources : [], targets.active, now);
    } catch (error) {
      this._fail(error);
    }
  }

  _trackTransient(nodes, stopAt) {
    const record = { nodes };
    this.transientNodes.add(record);

    const finalNode = nodes.find(node => 'onended' in (node || {}));
    if (finalNode) {
      finalNode.onended = () => {
        disconnectGraph(nodes);
        this.transientNodes.delete(record);
      };
    }

    for (const node of nodes) {
      if (typeof node?.stop === 'function') safeStop(node, stopAt);
    }
  }

  playBoost(chain = 1) {
    if (!this.ready || !this.context || !this.master || this.disabled || this.disposed) return;

    try {
      const context = this.context;
      const now = context.currentTime;
      const parameters = computeBoostParameters(chain);
      const transientGain = context.createGain();
      const low = context.createOscillator();
      const mid = context.createOscillator();
      const lowFilter = context.createBiquadFilter();
      const midFilter = context.createBiquadFilter();
      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGain = context.createGain();

      low.type = 'triangle';
      mid.type = 'sawtooth';
      lowFilter.type = 'lowpass';
      midFilter.type = 'bandpass';
      midFilter.Q.value = 1.25;
      noise.buffer = this.noiseBuffer;
      noiseFilter.type = 'bandpass';
      noiseFilter.Q.value = 0.8;

      setValue(low.frequency, parameters.lowStart, now);
      low.frequency.exponentialRampToValueAtTime?.(parameters.lowEnd, now + 0.34);
      setValue(mid.frequency, parameters.midStart, now);
      mid.frequency.exponentialRampToValueAtTime?.(parameters.midEnd, now + 0.28);
      setValue(lowFilter.frequency, 430, now);
      lowFilter.frequency.exponentialRampToValueAtTime?.(880, now + 0.34);
      setValue(midFilter.frequency, 620, now);
      midFilter.frequency.exponentialRampToValueAtTime?.(1850, now + 0.28);
      setValue(noiseFilter.frequency, 520, now);
      noiseFilter.frequency.exponentialRampToValueAtTime?.(2400, now + 0.24);

      transientGain.gain.value = SILENCE;
      noiseGain.gain.value = 0.12;
      cancelAndHold(transientGain.gain, now);
      setValue(transientGain.gain, SILENCE, now);
      transientGain.gain.exponentialRampToValueAtTime?.(parameters.peakGain, now + 0.018);
      transientGain.gain.exponentialRampToValueAtTime?.(0.07, now + 0.16);
      transientGain.gain.exponentialRampToValueAtTime?.(SILENCE, now + parameters.duration);

      low.connect(lowFilter);
      lowFilter.connect(transientGain);
      mid.connect(midFilter);
      midFilter.connect(transientGain);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(transientGain);
      transientGain.connect(this.master);

      low.start(now);
      mid.start(now);
      noise.start(now);
      this._trackTransient(
        [low, mid, noise, lowFilter, midFilter, noiseFilter, noiseGain, transientGain],
        now + parameters.duration + 0.04,
      );
    } catch (error) {
      // A transient effect failure should not disable continuous engine audio.
      console.warn?.('[Skyline] Boost audio skipped', error);
    }
  }

  _disposeGraph() {
    for (const node of this.continuousNodes) safeStop(node);
    this.continuousNodes.length = 0;

    for (const [id, voice] of this.trafficVoices) {
      this._disposeTrafficVoice(id, voice);
    }

    for (const record of this.transientNodes) {
      for (const node of record.nodes) safeStop(node);
      disconnectGraph(record.nodes);
    }
    this.transientNodes.clear();

    disconnectGraph([
      this.master,
      this.compressor,
      this.limiter,
      this.windBodyFilter,
      this.windBodyGain,
      this.windHissFilter,
      this.windHissGain,
      this.buffetFilter,
      this.buffetGain,
      this.buffetLfoDepth,
      this.engineHighpass,
      this.engineLowShelf,
      this.engineLowpass,
      this.engineGain,
      this.engineFlutterDepth,
      this.subharmonicGain,
      this.engineNoiseFilter,
      this.engineNoiseGain,
      this.propellerFilter,
      this.propellerGain,
      this.sirenAGain,
      this.sirenBGain,
      this.sirenAM,
      this.sirenLfoDepth,
      this.sirenNoiseFilter,
      this.sirenNoiseGain,
      this.sirenFilter,
      this.sirenPresence,
      this.sirenGain,
    ]);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    this._removeListener('pointerdown', this._onUnlock);
    this._removeListener('keydown', this._onUnlock);
    this._removeListener('skyline:aircraft-changed', this._onAircraftChanged);
    this._removeListener('skyline:boost-fired', this._onBoost);

    try {
      this._disposeGraph();
    } catch {
      // Cleanup failure must remain isolated.
    }

    try {
      if (this.context && this.context.state !== 'closed') {
        void this.context.close?.().catch?.(() => {});
      }
    } catch {
      // Context close failure is ignored.
    }

    this.ready = false;
    this.context = null;
    this._releaseOwnership();
  }
}

export { OWNER_KEY as AUDIO_OWNER_KEY };
