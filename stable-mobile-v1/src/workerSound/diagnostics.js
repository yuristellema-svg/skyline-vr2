import { WarningController } from './warningTargets.js';
import { WarningVoice } from './warningVoice.js';

function setTarget(parameter, value, now, timeConstant = 0.08) {
  try {
    parameter?.setTargetAtTime?.(value, now, Math.max(0.001, timeConstant));
    if (parameter && typeof parameter.setTargetAtTime !== 'function') parameter.value = value;
  } catch {}
}

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

export class WarningAudio {
  constructor(context, output, options = {}) {
    this.context = context;
    this.output = output;
    this.sampleHeight = options.sampleHeight || null;
    this.controller = new WarningController();
    this.voice = new WarningVoice(context, output);
    this.disposed = false;
    this.lastEvents = [];

    this.stressSource = context.createBufferSource();
    this.stressSource.buffer = makeNoise(context, 2.1, 0x5a3e55);
    this.stressSource.loop = true;
    this.stressFilter = context.createBiquadFilter();
    this.stressFilter.type = 'bandpass';
    this.stressFilter.frequency.value = 520;
    this.stressFilter.Q.value = 2.2;
    this.stressGain = context.createGain();
    this.stressGain.gain.value = 0.0001;
    this.stressSource.connect(this.stressFilter);
    this.stressFilter.connect(this.stressGain);
    this.stressGain.connect(output);
    this.stressSource.start();
  }

  update(dt, profileValue, flight, phase = 'flying') {
    if (this.disposed) return [];
    const events = this.controller.update(
      dt,
      profileValue,
      flight,
      this.sampleHeight,
      phase,
    );
    for (const event of events) {
      if (event.id === 'pull_up') this.voice.play('pull_up', 1.15);
      if (event.id === 'terrain') this.voice.play('terrain', 0.92);
      if (event.id === 'low_speed') this.voice.play('low_speed', 0.90);
    }
    const stress = this.controller.active === 'stress' ? 1 : 0;
    const now = this.context.currentTime;
    setTarget(this.stressGain.gain, stress * 0.046 + 0.0001, now, stress ? 0.15 : 0.35);
    setTarget(this.stressFilter.frequency, 460 + stress * 260, now, 0.18);
    this.lastEvents = events;
    return events;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.voice.dispose();
    try { this.stressSource.stop(this.context.currentTime + 0.02); } catch {}
    for (const node of [this.stressSource, this.stressFilter, this.stressGain]) {
      try { node.disconnect(); } catch {}
    }
  }
}
