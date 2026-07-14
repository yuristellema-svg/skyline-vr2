export class MonoHud {
  constructor(root) {
    this.root = root;

    this.speed =
      root.querySelector('[data-speed]');

    this.g =
      root.querySelector('[data-g]');

    this.boost =
      root.querySelector('[data-boost]');

    this.camera =
      root.querySelector('[data-camera]');

    this.performance =
      root.querySelector('[data-performance]');

    this.altitude = null;
    this._elapsed = 0;

    this._replaceBoostWithAltitude();
    this._createStereoHud();
  }

  _replaceBoostWithAltitude() {
    if (!this.boost) {
      return;
    }

    const row = this.boost.closest('div');

    if (!row) {
      return;
    }

    row.innerHTML = `
      <span>ALTITUDE</span>
      <strong data-altitude>0 m</strong>
    `;

    this.altitude =
      row.querySelector('[data-altitude]');
  }

  _createStereoHud() {
    const existing =
      document.querySelector(
        '#stereo-flight-hud'
      );

    if (existing) {
      this.stereoHud = existing;
    } else {
      this.stereoHud =
        document.createElement('div');

      this.stereoHud.id =
        'stereo-flight-hud';

      this.stereoHud.setAttribute(
        'aria-hidden',
        'true'
      );

      this.stereoHud.innerHTML = `
        <div class="stereo-hud-eye">
          <div class="stereo-hud-card">
            <strong data-vr-speed>
              0 km/h
            </strong>

            <span data-vr-altitude>
              ALT 0 m
            </span>
          </div>
        </div>

        <div class="stereo-hud-eye">
          <div class="stereo-hud-card">
            <strong data-vr-speed>
              0 km/h
            </strong>

            <span data-vr-altitude>
              ALT 0 m
            </span>
          </div>
        </div>
      `;

      document.body.appendChild(
        this.stereoHud
      );
    }

    this.stereoSpeeds = [
      ...this.stereoHud.querySelectorAll(
        '[data-vr-speed]'
      ),
    ];

    this.stereoAltitudes = [
      ...this.stereoHud.querySelectorAll(
        '[data-vr-altitude]'
      ),
    ];

    if (
      !document.querySelector(
        '#stereo-flight-hud-style'
      )
    ) {
      const style =
        document.createElement('style');

      style.id =
        'stereo-flight-hud-style';

      style.textContent = `
        #stereo-flight-hud {
          display: none;
          position: fixed;
          z-index: 14;
          inset: 0;
          pointer-events: none;
        }

        body.stereo.running
        #stereo-flight-hud {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .stereo-hud-eye {
          position: relative;
          min-width: 0;
        }

        .stereo-hud-card {
          position: absolute;
          right: 7%;
          bottom: 8%;
          display: grid;
          justify-items: end;
          gap: 2px;
          min-width: 94px;
          padding: 7px 9px;
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          border-radius: 9px;
          color: #fff7e8;
          background:
            rgba(5, 18, 24, 0.44);
          box-shadow:
            0 4px 14px
            rgba(0, 0, 0, 0.18);
          text-align: right;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            sans-serif;
          text-shadow:
            0 2px 6px
            rgba(0, 0, 0, 0.55);
        }

        .stereo-hud-card strong {
          font-size:
            clamp(13px, 2vw, 18px);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .stereo-hud-card span {
          color:
            rgba(255, 255, 255, 0.68);
          font-size:
            clamp(8px, 1.15vw, 11px);
          font-weight: 750;
          line-height: 1;
          letter-spacing: 0.06em;
        }
      `;

      document.head.appendChild(style);
    }
  }

  setVisible(visible) {
    this.root.classList.toggle(
      'hidden',
      !visible
    );
  }

  update(
    dt,
    flight,
    cameraMode,
    metrics,
    droppedSteps
  ) {
    this._elapsed += dt;

    if (this._elapsed < 0.1) {
      return;
    }

    this._elapsed = 0;

    const speed =
      Math.round(flight.speedKmh);

    const altitude =
      Math.max(
        0,
        Math.round(flight.position.y)
      );

    this.speed.textContent =
      `${speed} km/h`;

    this.g.textContent =
      `${flight.gLoad.toFixed(1)} g`;

    if (this.altitude) {
      this.altitude.textContent =
        `${altitude} m`;
    }

    for (
      const element of
      this.stereoSpeeds
    ) {
      element.textContent =
        `${speed} km/h`;
    }

    for (
      const element of
      this.stereoAltitudes
    ) {
      element.textContent =
        `ALT ${altitude} m`;
    }

    this.camera.textContent =
      cameraMode === 'first'
        ? 'FIRST PERSON'
        : 'THIRD PERSON';

    this.performance.textContent =
      `${metrics.calls} calls · ` +
      `${Math.round(
        metrics.triangles / 1000
      )}k tris · ` +
      `${droppedSteps} dropped`;
  }
}
