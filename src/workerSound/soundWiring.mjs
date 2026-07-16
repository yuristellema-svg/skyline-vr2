import { clamp, finite } from './engineTargets.js';
import {
  PHONE_AUDIO_LIMITS,
  resolveSoundProfile,
} from './profiles.js';

function distanceSquared(a, b) {
  const dx = finite(a?.x) - finite(b?.x);
  const dy = finite(a?.y) - finite(b?.y);
  const dz = finite(a?.z) - finite(b?.z);
  return dx * dx + dy * dy + dz * dz;
}

function velocitySpeed(velocity) {
  return Math.hypot(
    finite(velocity?.x),
    finite(velocity?.y),
    finite(velocity?.z),
  );
}

export function normalizeTrafficSource(source) {
  const position = source?.position;
  const velocity = source?.velocity;
  const finiteVector = value =>
    value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z);

  if (
    !source?.id ||
    !finiteVector(position) ||
    !finiteVector(velocity) ||
    !Number.isFinite(source.engineLevel) ||
    typeof source.aircraftId !== 'string' ||
    typeof source.active !== 'boolean'
  ) {
    return null;
  }

  return {
    id: String(source.id),
    position,
    velocity,
    engineLevel: clamp(source.engineLevel, 0, 1),
    aircraftId: resolveSoundProfile(source.aircraftId).id,
    active: source.active,
  };
}

export function rankTrafficSources(
  sources,
  listenerPosition,
  maxSources = PHONE_AUDIO_LIMITS.positionalVoices,
  maxDistance = PHONE_AUDIO_LIMITS.positionalMaxDistance,
) {
  const maxDistanceSquared = maxDistance * maxDistance;
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeTrafficSource)
    .filter(Boolean)
    .filter(source => source.active && distanceSquared(source.position, listenerPosition) <= maxDistanceSquared)
    .map(source => {
      const d2 = distanceSquared(source.position, listenerPosition);
      const distance = Math.sqrt(d2);
      const relevance = source.engineLevel * 1.25 + 1 / (1 + distance / 220);
      return { ...source, distance, relevance };
    })
    .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance)
    .slice(0, Math.max(0, maxSources));
}

function setTarget(parameter, value, now, timeConstant = 0.08) {
  try {
    parameter?.setTargetAtTime?.(value, now, Math.max(0.001, timeConstant));
    if (parameter && typeof parameter.setTargetAtTime !== 'function') parameter.value = value;
  } catch {}
}

function setPosition(panner, position, now) {
  try {
    if (panner.positionX) {
      setTarget(panner.positionX, finite(position.x), now, 0.05);
      setTarget(panner.positionY, finite(position.y), now, 0.05);
      setTarget(panner.positionZ, finite(position.z), now, 0.05);
    } else {
      panner.setPosition?.(finite(position.x), finite(position.y), finite(position.z));
    }
  } catch {}
}

function setListener(listener, flight, camera, now) {
  const position = flight?.position;
  if (position) {
    if (listener.positionX) {
      setTarget(listener.positionX, finite(position.x), now, 0.04);
      setTarget(listener.positionY, finite(position.y), now, 0.04);
      setTarget(listener.positionZ, finite(position.z), now, 0.04);
    } else {
      listener.setPosition?.(finite(position.x), finite(position.y), finite(position.z));
    }
  }

  const quaternion = camera?.quaternion;
  if (!quaternion || !Number.isFinite(quaternion.w)) return;
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
  if (listener.forwardX) {
    setTarget(listener.forwardX, forward.x, now, 0.05);
    setTarget(listener.forwardY, forward.y, now, 0.05);
    setTarget(listener.forwardZ, forward.z, now, 0.05);
    setTarget(listener.upX, up.x, now, 0.05);
    setTarget(listener.upY, up.y, now, 0.05);
    setTarget(listener.upZ, up.z, now, 0.05);
  } else {
    listener.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
  }
}

export class PositionalTrafficAudio {
  constructor(context, output, options = {}) {
    this.context = context;
    this.output = output;
    this.maxVoices = Math.max(1, Math.min(6, options.maxVoices || PHONE_AUDIO_LIMITS.positionalVoices));
    this.maxDistance = Math.max(200, Number(options.maxDistance) || PHONE_AUDIO_LIMITS.positionalMaxDistance);
    this.disposed = false;
    this.lastRanked = [];
    this.voices = Array.from({ length: this.maxVoices }, (_, index) => this._createVoice(index));
  }

  _createVoice(index) {
    const context = this.context;
    const fundamental = context.createOscillator();
    const harmonic = context.createOscillator();
    const pulse = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createPanner();
    fundamental.type = 'sawtooth';
    harmonic.type = 'triangle';
    pulse.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    gain.gain.value = 0.0001;
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 18;
    panner.maxDistance = this.maxDistance;
    panner.rolloffFactor = 1.35;
    fundamental.connect(filter);
    harmonic.connect(filter);
    pulse.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.output);
    fundamental.start();
    harmonic.start();
    pulse.start();
    return { index, fundamental, harmonic, pulse, filter, gain, panner, sourceId: null };
  }

  update(_dt, flight, camera, phase = 'flying', sources = []) {
    if (this.disposed) return [];
    const now = this.context.currentTime;
    setListener(this.context.listener, flight, camera, now);
    const ranked = phase === 'flying'
      ? rankTrafficSources(sources, flight?.position, this.maxVoices, this.maxDistance)
      : [];
    this.lastRanked = ranked;

    for (let index = 0; index < this.voices.length; index += 1) {
      const voice = this.voices[index];
      const source = ranked[index];
      if (!source) {
        voice.sourceId = null;
        setTarget(voice.gain.gain, 0.0001, now, 0.18);
        continue;
      }
      voice.sourceId = source.id;
      const profile = resolveSoundProfile(source.aircraftId);
      const speed = velocitySpeed(source.velocity);
      const base = profile.baseHz + Math.min(profile.cruiseHz, speed * 0.75);
      const distanceGain = 1 / (1 + source.distance / 210);
      const level = clamp(
        (0.015 + source.engineLevel * 0.055) * distanceGain,
        0,
        0.065,
      );
      setPosition(voice.panner, source.position, now);
      setTarget(voice.fundamental.frequency, Math.max(24, base), now, 0.12);
      setTarget(voice.harmonic.frequency, Math.max(48, base * profile.harmonicRatios[1]), now, 0.12);
      setTarget(voice.pulse.frequency, Math.max(18, base * Math.max(0.5, profile.pulseRatio)), now, 0.12);
      setTarget(voice.filter.frequency, 480 + Math.min(1200, speed * 7) + source.engineLevel * 320, now, 0.14);
      setTarget(voice.gain.gain, level + 0.0001, now, 0.14);
    }
    return ranked;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices) {
      for (const source of [voice.fundamental, voice.harmonic, voice.pulse]) {
        try { source.stop(this.context.currentTime + 0.02); } catch {}
      }
      for (const node of Object.values(voice)) {
        try { node?.disconnect?.(); } catch {}
      }
    }
    this.voices.length = 0;
  }
}
