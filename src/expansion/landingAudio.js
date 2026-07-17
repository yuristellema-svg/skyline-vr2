import {
  makeNoiseBuffer,
  safeDisconnect,
  safeStop,
} from '../audio/audioMath.js';

export class LandingAudio {
  constructor(context, output, eventTarget = globalThis.window) {
    this.context = context;
    this.output = output;
    this.eventTarget = eventTarget;
    this.nodes = new Set();
    this.sources = new Set();
    this.touchdown = event => {
      this.playTouchdown(event?.detail?.quality || 'good');
    };
    this.landed = () => this.playStop();
    this.takeoff = () => this.playTakeoff();
    eventTarget?.addEventListener?.('skyline:touchdown', this.touchdown);
    eventTarget?.addEventListener?.('skyline:landed', this.landed);
    eventTarget?.addEventListener?.('skyline:takeoff', this.takeoff);
  }

  track(source, ...nodes) {
    this.sources.add(source);
    for (const node of nodes) this.nodes.add(node);
    source.addEventListener?.('ended', () => {
      this.sources.delete(source);
      safeDisconnect(source);
      for (const node of nodes) {
        this.nodes.delete(node);
        safeDisconnect(node);
      }
    }, { once: true });
  }

  playTouchdown(quality) {
    const now = this.context.currentTime;
    const duration = quality === 'bounce' ? 0.28 : 0.36;
    const source = this.context.createBufferSource();
    source.buffer = makeNoiseBuffer(this.context, duration, 0x9911aa22);
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = quality === 'bounce' ? 260 : 340;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(quality === 'bounce' ? 0.18 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    source.start(now);
    source.stop(now + duration + 0.02);
    this.track(source, filter, gain);
  }

  playStop() {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(86, now);
    oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.32);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
    this.track(oscillator, gain);
  }

  playTakeoff() {
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, now);
    oscillator.frequency.exponentialRampToValueAtTime(260, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
    this.track(oscillator, gain);
  }

  dispose() {
    this.eventTarget?.removeEventListener?.('skyline:touchdown', this.touchdown);
    this.eventTarget?.removeEventListener?.('skyline:landed', this.landed);
    this.eventTarget?.removeEventListener?.('skyline:takeoff', this.takeoff);
    const now = this.context.currentTime;
    for (const source of this.sources) safeStop(source, now + 0.02);
    for (const node of [...this.sources, ...this.nodes]) safeDisconnect(node);
    this.sources.clear();
    this.nodes.clear();
  }
}
