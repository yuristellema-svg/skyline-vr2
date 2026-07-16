const ORIGINAL_AUDIO_CONTEXT =
  window.AudioContext ||
  window.webkitAudioContext ||
  null;

let sharedContext = null;
let constructorsPatched = false;
let lastPrime = -Infinity;

function audioCandidates(worldPolish) {
  const optionalWorld =
    worldPolish?.optionalWorld ??
    worldPolish;

  const owner =
    optionalWorld
      ?.registry
      ?.get?.('audio') ??
    optionalWorld?.audio ??
    null;

  return [
    owner,
    owner?.audio,
    owner?.engine,
    owner?.runtime,
  ].filter(Boolean);
}

function patchConstructors() {
  if (
    constructorsPatched ||
    !sharedContext ||
    !ORIGINAL_AUDIO_CONTEXT
  ) {
    return;
  }

  function SharedAudioContext() {
    return sharedContext;
  }

  try {
    Object.setPrototypeOf(
      SharedAudioContext,
      ORIGINAL_AUDIO_CONTEXT,
    );

    SharedAudioContext.prototype =
      ORIGINAL_AUDIO_CONTEXT.prototype;
  } catch {
    // Prototype copying is optional.
  }

  try {
    window.AudioContext =
      SharedAudioContext;

    window.webkitAudioContext =
      SharedAudioContext;

    constructorsPatched = true;
  } catch {
    /*
     * Some Safari versions expose these
     * properties as read-only. Existing
     * context resumption still continues.
     */
  }
}

function primeAudio(context) {
  const now =
    performance.now();

  if (
    now -
      lastPrime <
    350
  ) {
    return;
  }

  lastPrime = now;

  try {
    const start =
      context.currentTime;

    const oscillator =
      context.createOscillator();

    const harmonic =
      context.createOscillator();

    const gain =
      context.createGain();

    const filter =
      context.createBiquadFilter();

    oscillator.type = 'triangle';
    harmonic.type = 'sine';

    oscillator.frequency.setValueAtTime(
      105,
      start,
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      62,
      start + 0.17,
    );

    harmonic.frequency.setValueAtTime(
      210,
      start,
    );

    harmonic.frequency.exponentialRampToValueAtTime(
      124,
      start + 0.17,
    );

    filter.type = 'lowpass';
    filter.frequency.value = 650;

    gain.gain.setValueAtTime(
      0.0001,
      start,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.045,
      start + 0.018,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + 0.19,
    );

    oscillator.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscillator.start(start);
    harmonic.start(start);

    oscillator.stop(start + 0.2);
    harmonic.stop(start + 0.2);
  } catch {
    // Ignition confirmation is optional.
  }
}

export function installIosAudioBridge(
  worldPolish,
) {
  function unlockFromGesture() {
    if (!ORIGINAL_AUDIO_CONTEXT) {
      return false;
    }

    try {
      if (
        !sharedContext ||
        sharedContext.state === 'closed'
      ) {
        sharedContext =
          new ORIGINAL_AUDIO_CONTEXT({
            latencyHint: 'interactive',
          });
      }

      globalThis.__skylineSharedAudioContext =
        sharedContext;

      patchConstructors();

      if (
        sharedContext.state !== 'running'
      ) {
        sharedContext
          .resume()
          .catch(() => {});
      }

      primeAudio(sharedContext);

      for (
        const candidate of
        audioCandidates(worldPolish)
      ) {
        const context =
          candidate.context ??
          candidate.audioContext ??
          candidate.audio?.context;

        if (
          context &&
          context.state !== 'running'
        ) {
          context
            .resume()
            .catch(() => {});
        }

        for (
          const method of
          [
            'unlockFromGesture',
            'unlock',
            'resumeFromGesture',
            'resume',
            'start',
          ]
        ) {
          if (
            typeof candidate[method] !==
            'function'
          ) {
            continue;
          }

          try {
            const result =
              candidate[method]();

            result?.catch?.(
              () => {},
            );
          } catch {
            // Try the next compatible method.
          }
        }
      }

      console.info(
        '[Skyline] iOS audio bridge activated',
        sharedContext.state,
      );

      return true;
    } catch (error) {
      console.warn(
        '[Skyline] iOS audio bridge failed',
        error,
      );

      return false;
    }
  }

  const options = {
    capture: true,
    passive: true,
  };

  const targets = [
    document.querySelector(
      '#phone-start',
    ),
    document.querySelector(
      '#desktop-start',
    ),
  ].filter(Boolean);

  for (const target of targets) {
    for (
      const eventName of
      [
        'pointerdown',
        'touchstart',
        'click',
      ]
    ) {
      target.addEventListener(
        eventName,
        unlockFromGesture,
        options,
      );
    }
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState ===
          'visible' &&
        sharedContext?.state ===
          'suspended'
      ) {
        sharedContext
          .resume()
          .catch(() => {});
      }
    },
  );

  window.addEventListener(
    'pageshow',
    () => {
      if (
        sharedContext?.state ===
          'suspended'
      ) {
        sharedContext
          .resume()
          .catch(() => {});
      }
    },
  );

  return {
    unlockFromGesture,
    get context() {
      return sharedContext;
    },
  };
}
