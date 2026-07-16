import {
  clamp,
  safeDisconnect,
  safeSetTarget,
  safeStop,
} from './audioMath.js';

function setPosition(node, position, now) {
  if (!node || !position) return;
  try {
    if (node.positionX) {
      node.positionX.setTargetAtTime(position.x, now, 0.05);
      node.positionY.setTargetAtTime(position.y, now, 0.05);
      node.positionZ.setTargetAtTime(position.z, now, 0.05);
    } else {
      node.setPosition?.(position.x, position.y, position.z);
    }
  } catch {}
}

function setListener(listener, flight, camera, now) {
  const position = flight?.position;
  if (position) {
    try {
      if (listener.positionX) {
        listener.positionX.setTargetAtTime(position.x, now, 0.04);
        listener.positionY.setTargetAtTime(position.y, now, 0.04);
        listener.positionZ.setTargetAtTime(position.z, now, 0.04);
      } else {
        listener.setPosition?.(position.x, position.y, position.z);
      }
    } catch {}
  }

  const quaternion = camera?.quaternion;
  if (!quaternion?.isQuaternion) return;
  const { x, y, z, w } = quaternion;
  const forward = {
    x: -2 * (x * z + w * y),
    y: -2 * (y * z - w * x),
    z: -1 + 2 * (x * x + y * y),
  };
  const up = {
    x: 2 * (x * y - w * z),
    y: 1 - 2 * (x * x + z * z),
    z: 2 * (y * z + w * x),
  };
  try {
    if (listener.forwardX) {
      listener.forwardX.setTargetAtTime(forward.x, now, 0.05);
      listener.forwardY.setTargetAtTime(forward.y, now, 0.05);
      listener.forwardZ.setTargetAtTime(forward.z, now, 0.05);
      listener.upX.setTargetAtTime(up.x, now, 0.05);
      listener.upY.setTargetAtTime(up.y, now, 0.05);
      listener.upZ.setTargetAtTime(up.z, now, 0.05);
    } else {
      listener.setOrientation?.(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z,
      );
    }
  } catch {}
}

export class PositionalTrafficAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.voices = new Map();
    this.disposed = false;
  }

  _createVoice(id) {
    const context = this.context;
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 62;
    const harmonic = context.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = 126;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    const panner = context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 18;
    panner.maxDistance = 1600;
    panner.rolloffFactor = 1.35;
    oscillator.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.output);
    oscillator.start();
    harmonic.start();
    const voice = { id, oscillator, harmonic, filter, gain, panner, staleSeconds: 0 };
    this.voices.set(id, voice);
    return voice;
  }

  update(dt, flight, camera, phase = 'flying', sources = []) {
    if (this.disposed) return;
    const now = this.context.currentTime;
    setListener(this.context.listener, flight, camera, now);
    const active = phase === 'flying' ? 1 : 0;
    const seen = new Set();

    for (const source of sources.slice(0, 6)) {
      if (!source?.id || !source.position) continue;
      seen.add(source.id);
      const voice = this.voices.get(source.id) || this._createVoice(source.id);
      voice.staleSeconds = 0;
      const speed = Math.max(0, Number(source.speed) || 0);
      const base = 54 + Math.min(74, speed * 0.72);
      setPosition(voice.panner, source.position, now);
      safeSetTarget(voice.oscillator.frequency, base, now, 0.12);
      safeSetTarget(voice.harmonic.frequency, base * 2.04, now, 0.12);
      safeSetTarget(voice.filter.frequency, 520 + Math.min(920, speed * 7), now, 0.14);
      safeSetTarget(voice.gain.gain, active * clamp(0.025 + speed * 0.00018, 0, 0.052) + 0.0001, now, 0.14);
    }

    for (const [id, voice] of this.voices) {
      if (seen.has(id)) continue;
      voice.staleSeconds += Math.max(0, Number(dt) || 0);
      safeSetTarget(voice.gain.gain, 0.0001, now, 0.18);
      if (voice.staleSeconds > 8) this._disposeVoice(id, voice);
    }
  }

  _disposeVoice(id, voice) {
    safeStop(voice.oscillator, this.context.currentTime + 0.02);
    safeStop(voice.harmonic, this.context.currentTime + 0.02);
    for (const node of Object.values(voice)) safeDisconnect(node);
    this.voices.delete(id);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [id, voice] of [...this.voices]) this._disposeVoice(id, voice);
  }
}
