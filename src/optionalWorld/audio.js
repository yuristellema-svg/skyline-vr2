import {
  AircraftAudioEngine,
} from '../audio/proceduralAircraftAudio.js';

function styleUnlockButton(button) {
  Object.assign(button.style, {
    width: '100%',
    minHeight: '56px',
    padding: '12px 16px',
    border: '2px solid #f0d78d',
    borderRadius: '3px',
    background: '#49452f',
    color: '#fff1bd',
    font: '800 15px/1.2 ui-monospace, Menlo, Consolas, monospace',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    touchAction: 'manipulation',
  });
}

/**
 * Compatibility facade used by the existing optional-world runtime.
 * It preserves the old class name and update signature while adding one
 * explicit mobile-safe audio permission button.
 */
export class OptionalWorldAudioSystem extends AircraftAudioEngine {
  constructor(options = {}) {
    super(options);

    this._unlockUiBusy = false;
    this._unlockUiHandler = event => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      this.unlockFromVisibleGesture();
    };

    globalThis.__skylineAudio = this;
    this._installUnlockButton();
  }

  _installUnlockButton() {
    if (typeof document === 'undefined') return;

    document
      .querySelector('#skyline-audio-unlock')
      ?.remove?.();

    const button = document.createElement('button');
    button.id = 'skyline-audio-unlock';
    button.type = 'button';
    button.textContent = 'TAP TO ENABLE SOUND';
    button.setAttribute('aria-label', 'Enable Skyline aircraft sound');
    styleUnlockButton(button);

    const actions = document.querySelector('.start-panel__actions');
    if (actions) {
      actions.prepend(button);
    } else {
      Object.assign(button.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        width: 'min(360px, calc(100vw - 32px))',
        transform: 'translateX(-50%)',
        zIndex: '100000',
      });
      document.body.append(button);
    }

    button.addEventListener('pointerdown', this._unlockUiHandler, {
      capture: true,
    });
    button.addEventListener('touchend', this._unlockUiHandler, {
      capture: true,
    });
    button.addEventListener('click', this._unlockUiHandler, {
      capture: true,
    });

    this._unlockButton = button;
  }

  _playUnlockConfirmation() {
    const context = this.context;
    if (!context || context.state !== 'running') return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(82, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.27);
  }

  unlockFromVisibleGesture() {
    if (this._unlockUiBusy) return;
    this._unlockUiBusy = true;

    const button = this._unlockButton;
    if (button) button.textContent = 'ENABLING SOUND...';

    const accepted = this.unlock();
    if (!accepted || !this.context) {
      if (button) {
        button.textContent = 'AUDIO UNAVAILABLE';
        button.disabled = true;
      }
      return;
    }

    const finish = () => {
      if (!this.context || this.context.state !== 'running') {
        this._unlockUiBusy = false;
        if (button) button.textContent = 'TAP AGAIN FOR SOUND';
        return;
      }

      this.ready = true;
      this._playUnlockConfirmation();

      if (button) {
        button.textContent = 'SOUND ENABLED';
        button.style.background = '#315135';
        button.style.borderColor = '#a8e5a9';
        button.style.color = '#eaffea';

        setTimeout(() => {
          if (button && this.ready) button.style.display = 'none';
        }, 900);
      }
    };

    try {
      const resume = this.context.resume?.();
      if (resume?.then) {
        resume.then(finish).catch(() => {
          this._unlockUiBusy = false;
          if (button) button.textContent = 'TAP AGAIN FOR SOUND';
        });
      } else {
        finish();
      }
    } catch {
      this._unlockUiBusy = false;
      if (button) button.textContent = 'TAP AGAIN FOR SOUND';
    }
  }

  dispose() {
    const button = this._unlockButton;
    if (button) {
      button.removeEventListener('pointerdown', this._unlockUiHandler, {
        capture: true,
      });
      button.removeEventListener('touchend', this._unlockUiHandler, {
        capture: true,
      });
      button.removeEventListener('click', this._unlockUiHandler, {
        capture: true,
      });
      button.remove();
    }

    if (globalThis.__skylineAudio === this) {
      try {
        delete globalThis.__skylineAudio;
      } catch {
        globalThis.__skylineAudio = null;
      }
    }

    super.dispose();
  }
}
