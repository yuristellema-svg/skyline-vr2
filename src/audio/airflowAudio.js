import {
  clamp,
  loadFactorOf,
  makeNoiseBuffer,
  safeDisconnect,
  safeSetTarget,
  safeStop,
  smoothstep,
  speedOf,
  stallAmountOf,
} from './audioMath.js';
import { resolveAircraftAudioProfile } from './aircraftProfiles.js';

export function computeAirflowTargets(profileValue, flight, phase = 'flying') {
  const profile = resolveAircraftAudioProfile(profileValue);
  const active = phase === 'flying' ? 1 : 0;
  const speed = speedOf(flight);
  const speedAmount = smoothstep(8, 230, speed);
  const extreme = smoothstep(175, 900, speed);
  const stall = stallAmountOf(flight);
  const load = smoothstep(1.2, 6.0, loadFactorOf(flight));
  const glider = profile.id === 'glider' ? 1 : 0;

  return {
    windGain: active * profile.windGain * (0.08 + speedAmount * 0.78 + extreme * 0.38),
    windFrequency: 260 + speedAmount * 1700 + extreme * 1300,
    windQ: 0.42 + extreme * 0.18,
    buffetGain: active * clamp(stall * stall * 0.15 + load * stall * 0.05, 0, 0.19),
    buffetFrequency: 72 + stall * 155 + load * 35,
    gliderCreakGain: active * glider * clamp(speedAmount * 0.025 + extreme * 0.055 + load * 0.035, 0, 0.085),
    gliderCreakFrequency: 115 + speedAmount * 95 + load * 55,
  };
}

export class AirflowAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.disposed = false;
    this.sources = [];
    this.nodes = [];

    const buffer = makeNoiseBuffer(context, 3.1, 0x91af10);

    this.windSource = context.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.46;
    this.windGain = context.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(output);
    this.windSource.start();

    this.buffetSource = context.createBufferSource();
    this.buffetSource.buffer = buffer;
    this.buffetSource.loop = true;
    this.buffetFilter = context.createBiquadFilter();
    this.buffetFilter.type = 'bandpass';
    this.buffetFilter.frequency.value = 110;
    this.buffetFilter.Q.value = 1.1;
    this.buffetGain = context.createGain();
    this.buffetGain.gain.value = 0;
    this.buffetSource.connect(this.buffetFilter);
    this.buffetFilter.connect(this.buffetGain);
    this.buffetGain.connect(output);
    this.buffetSource.start();

    this.creakOscillator = context.createOscillator();
    this.creakOscillator.type = 'triangle';
    this.creakOscillator.frequency.value = 150;
    this.creakFilter = context.createBiquadFilter();
    this.creakFilter.type = 'bandpass';
    this.creakFilter.frequency.value = 360;
    this.creakFilter.Q.value = 3.2;
    this.creakGain = context.createGain();
    this.creakGain.gain.value = 0;
    this.creakOscillator.connect(this.creakFilter);
    this.creakFilter.connect(this.creakGain);
    this.creakGain.connect(output);
    this.creakOscillator.start();

    this.sources.push(this.windSource, this.buffetSource, this.creakOscillator);
    this.nodes.push(
      this.windFilter,
      this.windGain,
      this.buffetFilter,
      this.buffetGain,
      this.creakFilter,
      this.creakGain,
    );
  }

  update(profileValue, flight, phase = 'flying') {
    if (this.disposed) return;
    const now = this.context.currentTime;
    const targets = computeAirflowTargets(profileValue, flight, phase);
    safeSetTarget(this.windGain.gain, targets.windGain + 0.0001, now, 0.08);
    safeSetTarget(this.windFilter.frequency, targets.windFrequency, now, 0.08);
    safeSetTarget(this.windFilter.Q, targets.windQ, now, 0.10);
    safeSetTarget(this.buffetGain.gain, targets.buffetGain + 0.0001, now, 0.055);
    safeSetTarget(this.buffetFilter.frequency, targets.buffetFrequency, now, 0.065);
    safeSetTarget(this.creakGain.gain, targets.gliderCreakGain + 0.0001, now, 0.11);
    safeSetTarget(this.creakOscillator.frequency, targets.gliderCreakFrequency, now, 0.12);
    safeSetTarget(this.creakFilter.frequency, targets.gliderCreakFrequency * 2.2, now, 0.12);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const now = this.context.currentTime;
    for (const source of this.sources) safeStop(source, now + 0.02);
    for (const node of [...this.sources, ...this.nodes]) safeDisconnect(node);
  }
}
