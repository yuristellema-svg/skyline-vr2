import {
  makeNoiseBuffer,
  safeDisconnect,
  safeSetTarget,
  safeStop,
} from './audioMath.js';
import { FlightWarningController } from './flightWarningLogic.js';
import { ProceduralWarningVoice } from './proceduralWarningVoice.js';

export class FlightWarningAudio {
  constructor(context, output, options = {}) {
    this.context = context;
    this.output = output;
    this.sampleHeight = options.sampleHeight || null;
    this.controller = new FlightWarningController({
      terrainEnabled: options.terrainEnabled !== false,
    });
    this.voice = new ProceduralWarningVoice(context, output);
    this.disposed = false;
    this.lastConditions = null;

    const buffer = makeNoiseBuffer(context, 2.1, 0x5a3e55);
    this.stressSource = context.createBufferSource();
    this.stressSource.buffer = buffer;
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
      this.lastConditions = event.conditions;
    }

    const now = this.context.currentTime;
    const stressActive = this.controller.active === 'stress' ? 1 : 0;
    safeSetTarget(this.stressGain.gain, stressActive * 0.048 + 0.0001, now, stressActive ? 0.15 : 0.35);
    safeSetTarget(this.stressFilter.frequency, 460 + stressActive * 260, now, 0.18);
    return events;
  }

  reset() {
    this.controller.reset();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.voice.dispose();
    safeStop(this.stressSource, this.context.currentTime + 0.02);
    safeDisconnect(this.stressSource);
    safeDisconnect(this.stressFilter);
    safeDisconnect(this.stressGain);
  }
}
