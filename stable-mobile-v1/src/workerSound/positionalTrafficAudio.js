const PHRASES = Object.freeze({
  pull_up: Object.freeze([
    [0.07, 450, 1200, 2500, 0.16],
    [0.14, 680, 1180, 2450, 0.02],
    [0.08, 390, 2350, 3000, 0.03],
    [0.05, 500, 1350, 2550, 0.12],
    [0.15, 650, 1100, 2400, 0.02],
  ]),
  terrain: Object.freeze([
    [0.06, 520, 1500, 2600, 0.14],
    [0.12, 590, 1450, 2500, 0.02],
    [0.12, 730, 1200, 2450, 0.02],
    [0.10, 520, 1750, 2700, 0.03],
    [0.12, 400, 2050, 2800, 0.02],
  ]),
  low_speed: Object.freeze([
    [0.12, 420, 900, 2450, 0.02],
    [0.12, 540, 980, 2500, 0.02],
    [0.07, 500, 1600, 2650, 0.13],
    [0.12, 510, 1700, 2700, 0.02],
    [0.12, 390, 2100, 2850, 0.02],
  ]),
});

function makeNoise(context, seconds, seed) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let state = seed >>> 0;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    data[index] = state / 4294967296 * 2 - 1;
  }
  return buffer;
}

function schedule(parameter, value, time) {
  try { parameter?.setValueAtTime?.(value, time); } catch {}
}

function cleanup(bundle) {
  for (const node of bundle.nodes) {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  }
}

export class WarningVoice {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.active = new Set();
    this.disposed = false;
  }

  play(id, intensity = 1) {
    if (this.disposed || !PHRASES[id]) return false;
    const context = this.context;
    const now = context.currentTime;
    const phraseGain = context.createGain();
    const oscillator = context.createOscillator();
    const sourceGain = context.createGain();
    const noise = context.createBufferSource();
    const noiseGain = context.createGain();
    const filters = [0, 1, 2].map(index => ({
      filter: context.createBiquadFilter(),
      gain: context.createGain(),
      index,
    }));

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = id === 'pull_up' ? 104 : 92;
    sourceGain.gain.value = 0.33;
    noise.buffer = makeNoise(context, 0.8, id.length * 7919);
    noiseGain.gain.value = 0;
    oscillator.connect(sourceGain);
    noise.connect(noiseGain);

    for (const item of filters) {
      item.filter.type = 'bandpass';
      item.filter.Q.value = item.index === 0 ? 4.2 : 7;
      item.gain.gain.value = 0;
      sourceGain.connect(item.filter);
      noiseGain.connect(item.filter);
      item.filter.connect(item.gain);
      item.gain.connect(phraseGain);
    }

    phraseGain.gain.value = 0.0001;
    phraseGain.connect(this.output);
    phraseGain.gain.setValueAtTime?.(0.0001, now);
    phraseGain.gain.exponentialRampToValueAtTime?.(
      0.070 * Math.max(0.6, Math.min(1.2, intensity)),
      now + 0.018,
    );

    let cursor = now + 0.02;
    for (const [duration, f0, f1, f2, noiseLevel] of PHRASES[id]) {
      const frequencies = [f0, f1, f2];
      for (const item of filters) {
        schedule(item.filter.frequency, frequencies[item.index], cursor);
        schedule(item.gain.gain, [0.10, 0.068, 0.042][item.index], cursor);
      }
      schedule(noiseGain.gain, noiseLevel, cursor);
      cursor += duration;
    }

    phraseGain.gain.setValueAtTime?.(0.070, Math.max(now + 0.02, cursor - 0.04));
    phraseGain.gain.exponentialRampToValueAtTime?.(0.0001, cursor + 0.08);
    oscillator.start(now);
    noise.start(now);
    oscillator.stop(cursor + 0.10);
    noise.stop(cursor + 0.10);

    const bundle = {
      nodes: [
        oscillator,
        noise,
        sourceGain,
        noiseGain,
        phraseGain,
        ...filters.flatMap(item => [item.filter, item.gain]),
      ],
    };
    this.active.add(bundle);
    const timeoutMs = Math.max(200, (cursor + 0.16 - now) * 1000);
    globalThis.setTimeout?.(() => {
      if (!this.active.delete(bundle)) return;
      cleanup(bundle);
    }, timeoutMs);
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const bundle of this.active) cleanup(bundle);
    this.active.clear();
  }
}
