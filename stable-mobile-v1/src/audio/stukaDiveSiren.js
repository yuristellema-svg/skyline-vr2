import {
  safeDisconnect,
  safeSetTarget,
} from './audioMath.js';

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function smoothstep(edge0, edge1, value) {
  const amount =
    clamp(
      (value - edge0) /
        Math.max(
          0.0001,
          edge1 - edge0,
        ),
      0,
      1,
    );

  return (
    amount *
    amount *
    (3 - 2 * amount)
  );
}

export function stukaSirenDemand(
  profile,
  flight,
  phase = 'flying',
) {
  if (
    profile !== 'stuka' ||
    phase !== 'flying'
  ) {
    return 0;
  }

  const speed =
    Math.max(
      0,
      Number(flight?.speed) || 0,
    );

  const diveAngle =
    Math.max(
      0,
      -(Number(flight?.pathAngle) || 0),
    );

  const speedDemand =
    smoothstep(
      38,
      72,
      speed,
    );

  const diveDemand =
    smoothstep(
      0.22,
      0.58,
      diveAngle,
    );

  return (
    speedDemand *
    diveDemand
  );
}

export class StukaDiveSiren {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.demand = 0;

    this.voiceGainA =
      context.createGain();

    this.voiceGainB =
      context.createGain();

    this.voiceGainA.gain.value =
      0.58;

    this.voiceGainB.gain.value =
      0.42;

    this.oscillatorA =
      context.createOscillator();

    this.oscillatorB =
      context.createOscillator();

    this.oscillatorA.type =
      'sawtooth';

    this.oscillatorB.type =
      'sawtooth';

    this.oscillatorA.frequency.value =
      535;

    this.oscillatorB.frequency.value =
      557;

    this.bandpass =
      context.createBiquadFilter();

    this.bandpass.type =
      'bandpass';

    this.bandpass.frequency.value =
      760;

    this.bandpass.Q.value =
      1.15;

    this.lowpass =
      context.createBiquadFilter();

    this.lowpass.type =
      'lowpass';

    this.lowpass.frequency.value =
      1850;

    this.outputGain =
      context.createGain();

    this.outputGain.gain.value =
      0.0001;

    this.flutter =
      context.createOscillator();

    this.flutter.type =
      'sine';

    this.flutter.frequency.value =
      7.4;

    this.flutterDepth =
      context.createGain();

    this.flutterDepth.gain.value =
      15;

    this.oscillatorA.connect(
      this.voiceGainA,
    );

    this.oscillatorB.connect(
      this.voiceGainB,
    );

    this.voiceGainA.connect(
      this.bandpass,
    );

    this.voiceGainB.connect(
      this.bandpass,
    );

    this.bandpass.connect(
      this.lowpass,
    );

    this.lowpass.connect(
      this.outputGain,
    );

    this.outputGain.connect(
      output,
    );

    this.flutter.connect(
      this.flutterDepth,
    );

    this.flutterDepth.connect(
      this.oscillatorA.frequency,
    );

    this.flutterDepth.connect(
      this.oscillatorB.frequency,
    );

    const now =
      context.currentTime;

    this.oscillatorA.start(now);
    this.oscillatorB.start(now);
    this.flutter.start(now);
  }

  update(
    profile,
    flight,
    phase,
  ) {
    const now =
      this.context.currentTime;

    this.demand =
      stukaSirenDemand(
        profile,
        flight,
        phase,
      );

    const speed =
      Math.max(
        0,
        Number(flight?.speed) || 0,
      );

    const baseFrequency =
      500 +
      clamp(
        speed,
        0,
        100,
      ) *
        2.15;

    safeSetTarget(
      this.oscillatorA.frequency,
      baseFrequency,
      now,
      0.10,
    );

    safeSetTarget(
      this.oscillatorB.frequency,
      baseFrequency * 1.037,
      now,
      0.10,
    );

    safeSetTarget(
      this.bandpass.frequency,
      700 +
        this.demand *
          620,
      now,
      0.12,
    );

    safeSetTarget(
      this.outputGain.gain,
      0.0001 +
        this.demand *
          0.115,
      now,
      this.demand > 0.02
        ? 0.18
        : 0.32,
    );

    safeSetTarget(
      this.flutterDepth.gain,
      10 +
        this.demand *
          19,
      now,
      0.15,
    );
  }

  getStatus() {
    return {
      active:
        this.demand > 0.05,

      demand:
        this.demand,
    };
  }

  dispose() {
    const now =
      this.context.currentTime;

    for (
      const oscillator of [
        this.oscillatorA,
        this.oscillatorB,
        this.flutter,
      ]
    ) {
      try {
        oscillator.stop(
          now + 0.02,
        );
      } catch {}

      safeDisconnect(
        oscillator,
      );
    }

    for (
      const node of [
        this.voiceGainA,
        this.voiceGainB,
        this.bandpass,
        this.lowpass,
        this.outputGain,
        this.flutterDepth,
      ]
    ) {
      safeDisconnect(node);
    }
  }
}
