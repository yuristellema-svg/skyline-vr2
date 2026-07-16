const OWNER_KEY =
  '__skylineReliableFlightAudioV53';

function clampAudio(value, minimum, maximum) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function smoothAudio(minimum, maximum, value) {
  const amount =
    clampAudio(
      (value - minimum) /
        Math.max(1e-6, maximum - minimum),
      0,
      1,
    );

  return amount *
    amount *
    (3 - 2 * amount);
}

function currentSpeed(flight) {
  if (Number.isFinite(flight?.speed)) {
    return Math.max(0, flight.speed);
  }

  return Math.max(
    0,
    flight?.velocity?.length?.() || 0,
  );
}

function makeNoiseBuffer(context, seconds = 2) {
  const length =
    Math.max(
      1,
      Math.floor(
        context.sampleRate * seconds,
      ),
    );

  const buffer =
    context.createBuffer(
      1,
      length,
      context.sampleRate,
    );

  const data =
    buffer.getChannelData(0);

  let brown = 0;

  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {
    const white =
      Math.random() * 2 - 1;

    brown =
      brown * 0.985 +
      white * 0.015;

    data[index] =
      white * 0.38 +
      brown * 1.18;
  }

  return buffer;
}

function target(parameter, value, now, seconds = 0.08) {
  if (!parameter) return;

  try {
    parameter.setTargetAtTime(
      value,
      now,
      Math.max(0.008, seconds),
    );
  } catch {
    parameter.value = value;
  }
}

export class ReliableFlightAudio {
  constructor() {
    this.context = null;
    this.ready = false;
    this.failed = false;
    this.graphBuilt = false;
    this.profile = 'zero';
    this.sources = [];
    this.lastBoostTime = -Infinity;

    try {
      const stored =
        localStorage.getItem(
          'skyline-aircraft-profile-v4',
        );

      if (stored) {
        this.profile = stored;
      }
    } catch {
      // Storage is optional.
    }

    this._onAircraft = event => {
      const profile =
        event?.detail?.id;

      if (profile) {
        this.profile = profile;
      }
    };

    this._onBoost = event => {
      this.playBoost(
        event?.detail?.chain || 1,
      );
    };

    window.addEventListener(
      'skyline:aircraft-changed',
      this._onAircraft,
    );

    window.addEventListener(
      'skyline:boost-fired',
      this._onBoost,
    );
  }

  unlockFromGesture() {
    if (this.failed) {
      return false;
    }

    try {
      const previous =
        globalThis[OWNER_KEY];

      if (
        previous &&
        previous !== this
      ) {
        previous.dispose?.();
      }

      globalThis[OWNER_KEY] = this;

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        this.failed = true;
        return false;
      }

      if (
        !this.context ||
        this.context.state === 'closed'
      ) {
        this.context =
          new AudioContextClass({
            latencyHint: 'interactive',
          });

        this.graphBuilt = false;
      }

      if (!this.graphBuilt) {
        this._buildGraph();
      }

      if (
        this.context.state !== 'running'
      ) {
        this.context
          .resume()
          .catch(() => {});
      }

      this.ready = true;
      this._primeOutput();

      console.info(
        '[Skyline] Reliable flight audio unlocked',
        this.context.state,
      );

      window.dispatchEvent(
        new CustomEvent(
          'skyline:audio-ready',
          {
            detail: {
              state:
                this.context.state,
            },
          },
        ),
      );

      return true;
    } catch (error) {
      console.warn(
        '[Skyline] Reliable audio failed',
        error,
      );

      this.failed = true;
      return false;
    }
  }

  _createOscillator(
    type,
    frequency,
    level,
    destination,
  ) {
    const oscillator =
      this.context.createOscillator();

    const gain =
      this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.value =
      frequency;

    gain.gain.value = level;

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();

    this.sources.push(oscillator);

    return {
      oscillator,
      gain,
    };
  }

  _createNoise(
    buffer,
    filterType,
    frequency,
    q,
    destination,
  ) {
    const source =
      this.context.createBufferSource();

    const filter =
      this.context.createBiquadFilter();

    const gain =
      this.context.createGain();

    source.buffer = buffer;
    source.loop = true;

    filter.type = filterType;
    filter.frequency.value =
      frequency;

    filter.Q.value = q;
    gain.gain.value = 0.0001;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start();

    this.sources.push(source);

    return {
      source,
      filter,
      gain,
    };
  }

  _buildGraph() {
    const context =
      this.context;

    this.master =
      context.createGain();

    this.master.gain.value =
      0.0001;

    this.phoneProtection =
      context.createBiquadFilter();

    this.phoneProtection.type =
      'highpass';

    this.phoneProtection.frequency.value =
      38;

    this.phoneProtection.Q.value =
      0.72;

    this.compressor =
      context.createDynamicsCompressor();

    this.compressor.threshold.value =
      -20;

    this.compressor.knee.value =
      18;

    this.compressor.ratio.value =
      4.5;

    this.compressor.attack.value =
      0.007;

    this.compressor.release.value =
      0.22;

    this.limiter =
      context.createDynamicsCompressor();

    this.limiter.threshold.value =
      -4;

    this.limiter.knee.value =
      0;

    this.limiter.ratio.value =
      20;

    this.limiter.attack.value =
      0.002;

    this.limiter.release.value =
      0.075;

    this.master.connect(
      this.phoneProtection,
    );

    this.phoneProtection.connect(
      this.compressor,
    );

    this.compressor.connect(
      this.limiter,
    );

    this.limiter.connect(
      context.destination,
    );

    this.engineBus =
      context.createGain();

    this.engineFilter =
      context.createBiquadFilter();

    this.engineFilter.type =
      'lowpass';

    this.engineFilter.frequency.value =
      760;

    this.engineFilter.Q.value =
      0.72;

    this.engineBus.gain.value =
      0.0001;

    this.engineFilter.connect(
      this.engineBus,
    );

    this.engineBus.connect(
      this.master,
    );

    this.engineLayers = [
      {
        ...this._createOscillator(
          'triangle',
          24,
          0.13,
          this.engineFilter,
        ),
        ratio: 0.5,
      },
      {
        ...this._createOscillator(
          'sawtooth',
          48,
          0.16,
          this.engineFilter,
        ),
        ratio: 1,
      },
      {
        ...this._createOscillator(
          'sine',
          71,
          0.075,
          this.engineFilter,
        ),
        ratio: 1.47,
      },
      {
        ...this._createOscillator(
          'triangle',
          98,
          0.052,
          this.engineFilter,
        ),
        ratio: 2.03,
      },
      {
        ...this._createOscillator(
          'sawtooth',
          127,
          0.026,
          this.engineFilter,
        ),
        ratio: 2.64,
      },
    ];

    this.propeller =
      this._createOscillator(
        'triangle',
        145,
        0.055,
        this.engineFilter,
      );

    this.propellerFilter =
      context.createBiquadFilter();

    this.propellerFilter.type =
      'bandpass';

    this.propellerFilter.frequency.value =
      190;

    this.propellerFilter.Q.value =
      1.05;

    this.propeller.oscillator
      .disconnect();

    this.propeller.oscillator.connect(
      this.propellerFilter,
    );

    this.propellerFilter.connect(
      this.propeller.gain,
    );

    const noise =
      makeNoiseBuffer(context);

    this.mechanical =
      this._createNoise(
        noise,
        'bandpass',
        310,
        0.65,
        this.engineFilter,
      );

    this.wind =
      this._createNoise(
        noise,
        'bandpass',
        950,
        0.38,
        this.master,
      );

    this.buffet =
      this._createNoise(
        noise,
        'bandpass',
        145,
        1.15,
        this.master,
      );

    this.sirenFilter =
      context.createBiquadFilter();

    this.sirenFilter.type =
      'bandpass';

    this.sirenFilter.frequency.value =
      760;

    this.sirenFilter.Q.value =
      3.4;

    this.sirenGain =
      context.createGain();

    this.sirenGain.gain.value =
      0.0001;

    this.sirenOne =
      this._createOscillator(
        'sawtooth',
        670,
        0.28,
        this.sirenFilter,
      );

    this.sirenTwo =
      this._createOscillator(
        'triangle',
        682,
        0.23,
        this.sirenFilter,
      );

    this.sirenFilter.connect(
      this.sirenGain,
    );

    this.sirenGain.connect(
      this.master,
    );

    this.sirenLfo =
      context.createOscillator();

    this.sirenLfo.type =
      'sine';

    this.sirenLfo.frequency.value =
      8.4;

    this.sirenLfoGain =
      context.createGain();

    this.sirenLfoGain.gain.value =
      0;

    this.sirenLfo.connect(
      this.sirenLfoGain,
    );

    this.sirenLfoGain.connect(
      this.sirenGain.gain,
    );

    this.sirenLfo.start();
    this.sources.push(
      this.sirenLfo,
    );

    this.graphBuilt = true;
  }

  _primeOutput() {
    if (!this.context) return;

    const now =
      this.context.currentTime;

    const oscillator =
      this.context.createOscillator();

    const filter =
      this.context.createBiquadFilter();

    const gain =
      this.context.createGain();

    oscillator.type = 'triangle';

    oscillator.frequency.setValueAtTime(
      92,
      now,
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      48,
      now + 0.16,
    );

    filter.type = 'lowpass';
    filter.frequency.value = 520;

    gain.gain.setValueAtTime(
      0.0001,
      now,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.055,
      now + 0.018,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.18,
    );

    oscillator.connect(filter);
    filter.connect(gain);

    /*
     * Bypass the normal master gain for
     * this tiny ignition confirmation.
     * Compression and phone protection
     * still remain active.
     */
    gain.connect(
      this.phoneProtection,
    );

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  resume() {
    if (
      !this.context ||
      this.context.state === 'closed'
    ) {
      return false;
    }

    if (
      this.context.state !== 'running'
    ) {
      this.context
        .resume()
        .catch(() => {});
    }

    return true;
  }

  update(
    dt,
    flight,
    camera,
    phase = 'flying',
  ) {
    if (
      !this.ready ||
      !this.context ||
      !this.graphBuilt ||
      this.failed
    ) {
      return;
    }

    if (
      this.context.state !== 'running'
    ) {
      return;
    }

    const now =
      this.context.currentTime;

    const speed =
      currentSpeed(flight);

    const active =
      phase === 'flying'
        ? 1
        : 0;

    const angularRate =
      flight?.angularVelocity
        ?.length?.() || 0;

    const gForce =
      Math.abs(
        Number(flight?.gForce) || 1,
      );

    const load =
      clampAudio(
        angularRate * 0.32 +
          Math.max(0, gForce - 1) * 0.18,
        0,
        1,
      );

    const profile =
      this.profile;

    let baseFrequency =
      42 + speed * 0.19;

    let engineLevel = 0.47;
    let filterFrequency =
      660 - load * 135;

    let propellerLevel =
      0.052;

    if (profile === 'stuka') {
      baseFrequency =
        52 + speed * 0.22;

      engineLevel = 0.40;
      filterFrequency =
        810 - load * 110;

      propellerLevel = 0.045;
    } else if (profile === 'scout') {
      baseFrequency =
        61 + speed * 0.23;

      engineLevel = 0.29;
      filterFrequency = 940;
      propellerLevel = 0.032;
    } else if (profile === 'glider') {
      engineLevel = 0.0001;
      propellerLevel = 0.0001;
    }

    for (
      const layer of
      this.engineLayers
    ) {
      target(
        layer.oscillator.frequency,
        Math.max(
          18,
          baseFrequency *
            layer.ratio,
        ),
        now,
        0.07,
      );
    }

    target(
      this.engineBus.gain,
      active * engineLevel,
      now,
      0.11,
    );

    target(
      this.engineFilter.frequency,
      filterFrequency,
      now,
      0.12,
    );

    target(
      this.propeller.oscillator.frequency,
      Math.max(
        24,
        baseFrequency * 3,
      ),
      now,
      0.07,
    );

    target(
      this.propeller.gain.gain,
      active * propellerLevel,
      now,
      0.10,
    );

    target(
      this.propellerFilter.frequency,
      Math.min(
        520,
        130 + speed * 1.35,
      ),
      now,
      0.10,
    );

    target(
      this.mechanical.gain.gain,
      active *
        (
          0.018 +
          load * 0.034
        ),
      now,
      0.10,
    );

    target(
      this.mechanical.filter.frequency,
      260 + speed * 0.58,
      now,
      0.12,
    );

    const windAmount =
      smoothAudio(
        22,
        380,
        speed,
      );

    target(
      this.wind.gain.gain,
      active *
        (
          profile === 'glider'
            ? 0.025 +
              windAmount * 0.20
            : 0.008 +
              windAmount * 0.145
        ),
      now,
      0.13,
    );

    target(
      this.wind.filter.frequency,
      520 +
        Math.min(2200, speed * 4.1),
      now,
      0.14,
    );

    const stall =
      clampAudio(
        Number(
          flight?.stallSeverity ??
          flight?.stall ??
          0,
        ) || 0,
        0,
        1,
      );

    target(
      this.buffet.gain.gain,
      active *
        stall *
        stall *
        (
          0.055 +
          smoothAudio(
            30,
            160,
            speed,
          ) *
          0.065
        ),
      now,
      0.07,
    );

    const descentRate =
      Math.max(
        0,
        -(
          Number(
            flight?.velocity?.y,
          ) || 0
        ),
      );

    const velocityDiveAngle =
      Math.asin(
        clampAudio(
          descentRate /
            Math.max(1, speed),
          0,
          1,
        ),
      );

    const reportedPathAngle =
      Math.max(
        0,
        -(
          Number(
            flight?.pathAngle,
          ) || 0
        ),
      );

    const diveAngle =
      Math.max(
        velocityDiveAngle,
        reportedPathAngle,
      );

    const sirenGate =
      profile === 'stuka' &&
      active
        ? smoothAudio(
            84,
            126,
            speed,
          ) *
          smoothAudio(
            0.36,
            0.70,
            diveAngle,
          ) *
          smoothAudio(
            18,
            64,
            descentRate,
          )
        : 0;

    const sirenFrequency =
      610 +
      Math.min(
        390,
        speed * 1.75,
      );

    target(
      this.sirenOne.oscillator.frequency,
      sirenFrequency,
      now,
      0.06,
    );

    target(
      this.sirenTwo.oscillator.frequency,
      sirenFrequency * 1.0185,
      now,
      0.06,
    );

    target(
      this.sirenFilter.frequency,
      sirenFrequency * 1.08,
      now,
      0.09,
    );

    target(
      this.sirenGain.gain,
      0.0001 +
        sirenGate * 0.23,
      now,
      sirenGate > 0
        ? 0.11
        : 0.22,
    );

    target(
      this.sirenLfo.frequency,
      7.4 +
        sirenGate * 3.1,
      now,
      0.15,
    );

    target(
      this.sirenLfoGain.gain,
      sirenGate * 0.030,
      now,
      0.12,
    );

    target(
      this.master.gain,
      active
        ? 0.72
        : 0.0001,
      now,
      active
        ? 0.11
        : 0.18,
    );
  }

  playBoost(chain = 1) {
    if (
      !this.ready ||
      !this.context ||
      this.context.state !== 'running'
    ) {
      return;
    }

    const now =
      this.context.currentTime;

    if (
      now -
        this.lastBoostTime <
      0.08
    ) {
      return;
    }

    this.lastBoostTime = now;

    const oscillator =
      this.context.createOscillator();

    const filter =
      this.context.createBiquadFilter();

    const gain =
      this.context.createGain();

    oscillator.type = 'sawtooth';

    oscillator.frequency.setValueAtTime(
      82 + chain * 6,
      now,
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      390 + chain * 18,
      now + 0.32,
    );

    filter.type = 'lowpass';
    filter.frequency.value = 1150;

    gain.gain.setValueAtTime(
      0.0001,
      now,
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.min(
        0.18,
        0.105 + chain * 0.012,
      ),
      now + 0.022,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.52,
    );

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + 0.56);
  }

  dispose() {
    window.removeEventListener(
      'skyline:aircraft-changed',
      this._onAircraft,
    );

    window.removeEventListener(
      'skyline:boost-fired',
      this._onBoost,
    );

    for (const source of this.sources) {
      try {
        source.stop?.();
      } catch {
        // Already stopped.
      }

      try {
        source.disconnect?.();
      } catch {
        // Already disconnected.
      }
    }

    this.sources.length = 0;

    if (
      this.context &&
      this.context.state !== 'closed'
    ) {
      this.context
        .close()
        .catch(() => {});
    }

    if (
      globalThis[OWNER_KEY] === this
    ) {
      delete globalThis[OWNER_KEY];
    }

    this.ready = false;
    this.graphBuilt = false;
  }
}
