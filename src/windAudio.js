function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function speedOf(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  return flight?.velocity?.length?.() || 0;
}

function noiseBuffer(context, seconds = 2) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    brown = brown * 0.984 + white * 0.016;
    data[index] = white * 0.48 + brown * 1.25;
  }
  return buffer;
}

export class WindAudioSystem {
  constructor() {
    this.context = null;
    this.ready = false;
    this.disabled = false;
    this.profile = 'zero';
    this.trafficDistance = Infinity;

    this._unlock = () => this.unlock();
    this._onAircraft = event => { this.profile = event?.detail?.id || this.profile; };
    this._onBoost = event => this.playBoost(event?.detail?.chain || 1);

    window.addEventListener('pointerdown', this._unlock, { passive: true });
    window.addEventListener('keydown', this._unlock);
    window.addEventListener('skyline:aircraft-changed', this._onAircraft);
    window.addEventListener('skyline:boost-fired', this._onBoost);
  }

  unlock() {
    if (this.disabled) return;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) { this.disabled = true; return; }
      try {
        this.context = new AudioContextClass();
        this._build();
      } catch {
        this.disabled = true;
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    this.ready = true;
  }

  _build() {
    const context = this.context;
    this.master = context.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(context.destination);

    const buffer = noiseBuffer(context);
    const wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 520;
    this.windFilter.Q.value = 0.55;
    this.windGain = context.createGain();
    wind.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    wind.start();

    const buffet = context.createBufferSource();
    buffet.buffer = buffer;
    buffet.loop = true;
    this.buffetFilter = context.createBiquadFilter();
    this.buffetFilter.type = 'lowpass';
    this.buffetFilter.frequency.value = 105;
    this.buffetGain = context.createGain();
    buffet.connect(this.buffetFilter);
    this.buffetFilter.connect(this.buffetGain);
    this.buffetGain.connect(this.master);
    buffet.start();

    this.engineFundamental = context.createOscillator();
    this.engineFundamental.type = 'sawtooth';
    this.engineHarmonic = context.createOscillator();
    this.engineHarmonic.type = 'triangle';
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 620;
    this.engineGain = context.createGain();
    this.engineGain.gain.value = 0;
    this.engineFundamental.connect(this.engineFilter);
    this.engineHarmonic.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineFundamental.start();
    this.engineHarmonic.start();

    this.trafficOscillator = context.createOscillator();
    this.trafficOscillator.type = 'sawtooth';
    this.trafficOscillator.frequency.value = 64;
    this.trafficFilter = context.createBiquadFilter();
    this.trafficFilter.type = 'lowpass';
    this.trafficFilter.frequency.value = 320;
    this.trafficGain = context.createGain();
    this.trafficGain.gain.value = 0;
    this.trafficOscillator.connect(this.trafficFilter);
    this.trafficFilter.connect(this.trafficGain);
    this.trafficGain.connect(this.master);
    this.trafficOscillator.start();
  }

  setTrafficDistance(distance) {
    this.trafficDistance = Number.isFinite(distance) ? distance : Infinity;
  }

  update(_dt, flight, phase) {
    if (!this.ready || !this.context) return;
    const now = this.context.currentTime;
    const active = phase === 'flying' ? 1 : 0;
    const speed = speedOf(flight);
    const speedAmount = clamp((speed - 18) / 210, 0, 1);
    const extreme = clamp((speed - 180) / 800, 0, 1);
    const stall = clamp(Number(flight?.stallAmount) || 0, 0, 1);

    const bases = { zero: 72, stuka: 58, scout: 83, glider: 0 };
    const base = bases[this.profile] ?? 72;
    const rpm = base + Math.min(95, speed * 0.22);
    const engineEnabled = this.profile === 'glider' ? 0 : 1;

    this.master.gain.setTargetAtTime(active * 0.36 + 0.0001, now, 0.1);
    this.windGain.gain.setTargetAtTime(active * (0.018 + speedAmount * 0.17 + extreme * 0.11), now, 0.07);
    this.windFilter.frequency.setTargetAtTime(320 + speedAmount * 1450 + extreme * 900, now, 0.08);
    this.buffetGain.gain.setTargetAtTime(active * stall * stall * 0.105, now, 0.045);
    this.buffetFilter.frequency.setTargetAtTime(72 + stall * 74, now, 0.08);

    this.engineFundamental.frequency.setTargetAtTime(rpm, now, 0.08);
    this.engineHarmonic.frequency.setTargetAtTime(rpm * (this.profile === 'zero' ? 2.5 : 2), now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(420 + speedAmount * 760, now, 0.12);
    this.engineGain.gain.setTargetAtTime(active * engineEnabled * (0.055 + speedAmount * 0.055), now, 0.1);

    const traffic = clamp(1 - (this.trafficDistance - 20) / 420, 0, 1);
    this.trafficGain.gain.setTargetAtTime(active * traffic * traffic * 0.09, now, 0.12);
  }

  playBoost(chain = 1) {
    if (!this.ready || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(92 + chain * 7, now);
    oscillator.frequency.exponentialRampToValueAtTime(340 + chain * 18, now + 0.38);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.65);
  }

  dispose() {
    window.removeEventListener('pointerdown', this._unlock);
    window.removeEventListener('keydown', this._unlock);
    window.removeEventListener('skyline:aircraft-changed', this._onAircraft);
    window.removeEventListener('skyline:boost-fired', this._onBoost);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}
