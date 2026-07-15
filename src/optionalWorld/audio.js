// SKYLINE_V5_1_PHYSICS_PERFORMANCE
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function flightSpeed(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  return flight?.velocity?.length?.() || 0;
}

function makeNoiseBuffer(context, seconds = 2) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;

  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = brown * 0.985 + white * 0.015;
    data[index] = white * 0.40 + brown * 1.15;
  }

  return buffer;
}

function setPosition(node, position, now) {
  if (node.positionX) {
    node.positionX.setTargetAtTime(position.x, now, 0.04);
    node.positionY.setTargetAtTime(position.y, now, 0.04);
    node.positionZ.setTargetAtTime(position.z, now, 0.04);
  } else {
    node.setPosition?.(position.x, position.y, position.z);
  }
}

export class OptionalWorldAudioSystem {
  constructor(options = {}) {
    this.context = null;
    this.ready = false;
    this.disabled = false;
    this.profile = 'zero';
    this.masterLevel = clamp(Number(options.masterLevel) || 0.40, 0.1, 0.58);
    this.trafficVoices = new Map();

    this._unlock = () => {
      try {
        this.unlock();
      } catch (error) {
        console.warn('[Skyline] Audio disabled', error);
        this.disabled = true;
      }
    };

    this._onAircraft = event => {
      this.profile = event?.detail?.id || this.profile;
    };

    this._onBoost = event => {
      try {
        this.playBoost(event?.detail?.chain || 1);
      } catch (error) {
        console.warn('[Skyline] Boost sound disabled', error);
      }
    };

    window.addEventListener('pointerdown', this._unlock, { passive: true });
    window.addEventListener('keydown', this._unlock);
    window.addEventListener('skyline:aircraft-changed', this._onAircraft);
    window.addEventListener('skyline:boost-fired', this._onBoost);
  }

  unlock() {
    if (this.disabled) return;

    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.disabled = true;
        return;
      }

      this.context = new AudioContextClass();
      this._buildGraph();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }

    this.ready = true;
  }

  _buildGraph() {
    const context = this.context;

    this.master = context.createGain();
    this.master.gain.value = 0.0001;

    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.22;

    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);

    const buffer = makeNoiseBuffer(context);

    this.windSource = context.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.48;
    this.windGain = context.createGain();
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();

    this.buffetSource = context.createBufferSource();
    this.buffetSource.buffer = buffer;
    this.buffetSource.loop = true;
    this.buffetFilter = context.createBiquadFilter();
    this.buffetFilter.type = 'bandpass';
    this.buffetFilter.frequency.value = 140;
    this.buffetFilter.Q.value = 1.2;
    this.buffetGain = context.createGain();
    this.buffetGain.gain.value = 0.0001;
    this.buffetSource.connect(this.buffetFilter);
    this.buffetFilter.connect(this.buffetGain);
    this.buffetGain.connect(this.master);
    this.buffetSource.start();

    this.engineFundamental = context.createOscillator();
    this.engineFundamental.type = 'sawtooth';
    this.engineHarmonic = context.createOscillator();
    this.engineHarmonic.type = 'triangle';
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineGain = context.createGain();
    this.engineFundamental.connect(this.engineFilter);
    this.engineHarmonic.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineFundamental.start();
    this.engineHarmonic.start();

    // Ju 87-only dive siren. The gain is always zero for every other aircraft.
    this.sirenOscillator = context.createOscillator();
    this.sirenOscillator.type = 'sawtooth';
    this.sirenFilter = context.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 720;
    this.sirenFilter.Q.value = 5.5;
    this.sirenGain = context.createGain();
    this.sirenGain.gain.value = 0.0001;
    this.sirenOscillator.connect(this.sirenFilter);
    this.sirenFilter.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOscillator.start();
  }

  _ensureTrafficVoice(source) {
    if (this.trafficVoices.has(source.id)) return this.trafficVoices.get(source.id);

    const context = this.context;
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 58;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 360;

    const gain = context.createGain();
    gain.gain.value = 0;

    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 25;
    panner.maxDistance = 1400;
    panner.rolloffFactor = 1.25;

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    oscillator.start();

    const voice = { oscillator, filter, gain, panner };
    this.trafficVoices.set(source.id, voice);
    return voice;
  }

  _updateListener(flight, now) {
    const position = flight?.position;
    if (!position) return;

    const listener = this.context.listener;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(position.x, now, 0.03);
      listener.positionY.setTargetAtTime(position.y, now, 0.03);
      listener.positionZ.setTargetAtTime(position.z, now, 0.03);
    } else {
      listener.setPosition?.(position.x, position.y, position.z);
    }
  }

  update(_dt, flight, _camera, phase = 'flying', trafficSources = []) {
    if (!this.ready || !this.context || this.disabled) return;

    const context = this.context;
    const now = context.currentTime;
    const active = phase === 'flying' ? 1 : 0;
    const speed = flightSpeed(flight);
    const logarithmicSpeed = clamp(Math.log2(1 + speed / 32) / 5, 0, 1);
    const stall = clamp(Number(flight?.stallAmount) || 0, 0, 1);
    const pathAngle = Number(flight?.pathAngle) || 0;

    const profiles = {
      zero: { base: 72, harmonic: 2.45, level: 0.145, filter: 1450 },
      stuka: { base: 56, harmonic: 2.0, level: 0.135, filter: 1250 },
      scout: { base: 88, harmonic: 2.15, level: 0.115, filter: 1550 },
      glider: { base: 0, harmonic: 1, level: 0, filter: 800 },
    };
    const profile = profiles[this.profile] ?? profiles.zero;

    this.master.gain.setTargetAtTime(active * this.masterLevel + 0.0001, now, 0.10);

    this.windGain.gain.setTargetAtTime(
      active * (0.035 + logarithmicSpeed * 0.26),
      now,
      0.08,
    );
    this.windFilter.frequency.setTargetAtTime(
      300 + logarithmicSpeed * 2350,
      now,
      0.08,
    );

    const engineFrequency = profile.base + Math.min(135, speed * 0.18);
    this.engineFundamental.frequency.setTargetAtTime(Math.max(1, engineFrequency), now, 0.08);
    this.engineHarmonic.frequency.setTargetAtTime(
      Math.max(1, engineFrequency * profile.harmonic),
      now,
      0.08,
    );
    this.engineFilter.frequency.setTargetAtTime(
      450 + logarithmicSpeed * profile.filter,
      now,
      0.10,
    );
    this.engineGain.gain.setTargetAtTime(
      active * (profile.level + logarithmicSpeed * 0.055),
      now,
      0.10,
    );

    const buffet = active * stall * stall;
    this.buffetGain.gain.setTargetAtTime(buffet * 0.19 + 0.0001, now, 0.06);
    this.buffetFilter.frequency.setTargetAtTime(100 + stall * 190, now, 0.06);

    const diveAmount = this.profile === 'stuka'
      ? clamp((speed - 78) / 68, 0, 1) * clamp((-pathAngle - 0.40) / 0.43, 0, 1)
      : 0;
    this.sirenOscillator.frequency.setTargetAtTime(520 + diveAmount * 330, now, 0.12);
    this.sirenGain.gain.setTargetAtTime(active * diveAmount * 0.23 + 0.0001, now, 0.16);

    this._updateListener(flight, now);

    const activeIds = new Set();
    for (const source of trafficSources.slice(0, 6)) {
      if (!source?.id || !source.position) continue;

      activeIds.add(source.id);
      const voice = this._ensureTrafficVoice(source);
      setPosition(voice.panner, source.position, now);
      voice.oscillator.frequency.setTargetAtTime(
        56 + Math.min(48, Number(source.speed) || 0),
        now,
        0.12,
      );
      voice.gain.gain.setTargetAtTime(active * 0.07, now, 0.12);
    }

    for (const [id, voice] of this.trafficVoices) {
      if (!activeIds.has(id)) voice.gain.gain.setTargetAtTime(0.0001, now, 0.12);
    }
  }

  playBoost(chain = 1) {
    if (!this.ready || !this.context || !this.master || this.disabled) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(105 + chain * 6, now);
    oscillator.frequency.exponentialRampToValueAtTime(360 + chain * 16, now + 0.34);
    filter.type = 'lowpass';
    filter.frequency.value = 1050;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.62);
  }

  dispose() {
    window.removeEventListener('pointerdown', this._unlock);
    window.removeEventListener('keydown', this._unlock);
    window.removeEventListener('skyline:aircraft-changed', this._onAircraft);
    window.removeEventListener('skyline:boost-fired', this._onBoost);

    if (this.context && this.context.state !== 'closed') {
      void this.context.close().catch(() => {});
    }

    this.trafficVoices.clear();
  }
}
