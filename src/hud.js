const KMH = 3.6;
const MPS_TO_FPM = 196.850394;

function finite(
  value,
  fallback = 0,
) {
  return Number.isFinite(value)
    ? value
    : fallback;
}

function getSpeed(flight) {
  if (Number.isFinite(flight?.speed)) {
    return Math.max(
      0,
      flight.speed,
    );
  }

  if (flight?.velocity?.length) {
    return Math.max(
      0,
      flight.velocity.length(),
    );
  }

  return 0;
}

function getVerticalSpeed(flight) {
  if (
    Number.isFinite(
      flight?.verticalSpeed,
    )
  ) {
    return flight.verticalSpeed;
  }

  return finite(
    flight?.velocity?.y,
  );
}

function getHeading(flight) {
  const velocity = flight?.velocity;

  if (
    !velocity ||
    !Number.isFinite(velocity.x) ||
    !Number.isFinite(velocity.z)
  ) {
    return 0;
  }

  const heading =
    Math.atan2(
      velocity.x,
      -velocity.z,
    ) *
    180 /
    Math.PI;

  return (heading + 360) % 360;
}

function getLoad(flight) {
  for (const value of [
    flight?.loadFactor,
    flight?.gForce,
    flight?.currentG,
  ]) {
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 1;
}

function getStall(flight) {
  for (const value of [
    flight?.stallAmount,
    flight?.stallSeverity,
    flight?.stall,
  ]) {
    if (Number.isFinite(value)) {
      return Math.max(
        0,
        Math.min(1, value),
      );
    }
  }

  return 0;
}

function getBoost(flight) {
  if (
    Number.isFinite(
      flight?.boostCharge,
    )
  ) {
    return Math.max(
      0,
      Math.min(
        1,
        flight.boostCharge,
      ),
    );
  }

  return 0;
}

export class MonoHud {
  constructor(root) {
    this.root = root;
    this.visible = false;

    this.elapsed = 0;
    this.frames = 0;
    this.fps = 0;

    this.lastRender = -Infinity;

    this.aircraftName =
      'SKYLINE GLIDER';

    root.innerHTML = `
      <section
        class="flight-hud"
        aria-label="Flight information"
      >
        <div class="flight-hud__primary">
          <div class="flight-hud__readout">
            <span class="flight-hud__label">
              SPEED
            </span>
            <strong data-hud="speed">
              000
            </strong>
            <span class="flight-hud__unit">
              KM/H
            </span>
          </div>

          <div class="flight-hud__readout">
            <span class="flight-hud__label">
              ALT
            </span>
            <strong data-hud="altitude">
              0000
            </strong>
            <span class="flight-hud__unit">
              M
            </span>
          </div>
        </div>

        <div class="flight-hud__secondary">
          <span>
            V/S
            <b data-hud="vertical">
              +0000
            </b>
            FPM
          </span>

          <span>
            HDG
            <b data-hud="heading">
              000°
            </b>
          </span>

          <span>
            LOAD
            <b data-hud="load">
              1.0G
            </b>
          </span>

          <span>
            CAM
            <b data-hud="camera">
              FIRST
            </b>
          </span>
        </div>

        <div class="flight-hud__status">
          <span data-hud="aircraft">
            SKYLINE GLIDER
          </span>

          <span data-hud="state">
            CRUISE
          </span>
        </div>

        <div
          class="flight-hud__meter"
          aria-hidden="true"
        >
          <i data-hud="meter"></i>
        </div>

        <div
          class="flight-hud__debug"
          data-hud="debug"
        ></div>
      </section>
    `;

    this.nodes = Object.fromEntries(
      [
        ...root.querySelectorAll(
          '[data-hud]',
        ),
      ].map((node) => [
        node.dataset.hud,
        node,
      ]),
    );

    this._aircraftListener = (
      event,
    ) => {
      if (event?.detail?.name) {
        this.aircraftName =
          event.detail.name;
      }
    };

    window.addEventListener(
      'skyline:aircraft-changed',
      this._aircraftListener,
    );
  }

  setVisible(visible) {
    this.visible = Boolean(visible);

    this.root.classList.toggle(
      'hidden',
      !this.visible,
    );

    this.root.setAttribute(
      'aria-hidden',
      this.visible
        ? 'false'
        : 'true',
    );
  }

  update(
    dt,
    flight,
    cameraMode,
    metrics = {},
    droppedSteps = 0,
  ) {
    if (!this.visible) return;

    const safeDt = Math.max(
      0,
      Math.min(0.1, dt || 0),
    );

    this.elapsed += safeDt;
    this.frames += 1;

    if (this.elapsed >= 0.5) {
      this.fps =
        this.elapsed > 0
          ? this.frames /
            this.elapsed
          : 0;

      this.elapsed = 0;
      this.frames = 0;
    }

    const now =
      performance.now() / 1000;

    if (
      now - this.lastRender <
      0.08
    ) {
      return;
    }

    this.lastRender = now;

    const speed =
      getSpeed(flight);

    const altitude = Math.max(
      0,
      finite(flight?.position?.y),
    );

    const vertical =
      getVerticalSpeed(flight);

    const heading =
      getHeading(flight);

    const load =
      getLoad(flight);

    const stall =
      getStall(flight);

    const boost =
      getBoost(flight);

    this.nodes.speed.textContent =
      String(
        Math.round(speed * KMH),
      ).padStart(3, '0');

    this.nodes.altitude.textContent =
      String(
        Math.round(altitude),
      ).padStart(4, '0');

    const verticalSign =
      vertical >= 0 ? '+' : '−';

    const verticalValue =
      Math.round(
        Math.abs(vertical) *
          MPS_TO_FPM,
      );

    this.nodes.vertical.textContent =
      `${verticalSign}${String(
        verticalValue,
      ).padStart(4, '0')}`;

    this.nodes.heading.textContent =
      `${String(
        Math.round(heading) % 360,
      ).padStart(3, '0')}°`;

    this.nodes.load.textContent =
      `${load.toFixed(1)}G`;

    this.nodes.camera.textContent =
      String(
        cameraMode || 'FIRST',
      ).toUpperCase();

    this.nodes.aircraft.textContent =
      this.aircraftName;

    let state = 'CRUISE';

    let meter = Math.min(
      1,
      speed / 120,
    );

    if (stall > 0.65) {
      state =
        'STALL · LOWER NOSE';

      meter = stall;
    } else if (stall > 0.22) {
      state = 'AOA HIGH';
      meter = stall;
    } else if (boost > 0.04) {
      state =
        `ENERGY ${Math.round(
          boost * 100,
        )}%`;

      meter = boost;
    } else if (vertical < -12) {
      state = 'DIVE';
    } else if (vertical > 8) {
      state = 'CLIMB';
    }

    this.nodes.state.textContent =
      state;

    this.nodes.state.dataset.warning =
      stall > 0.22
        ? 'true'
        : 'false';

    this.nodes.meter.style.transform =
      `scaleX(${Math.max(
        0.015,
        meter,
      )})`;

    const drawCalls = finite(
      metrics.drawCalls ??
        metrics.calls,
      0,
    );

    const triangles = finite(
      metrics.triangles,
      0,
    );

    this.nodes.debug.textContent =
      `${Math.round(this.fps)} FPS · ` +
      `${drawCalls} DC · ` +
      `${Math.round(
        triangles / 1000,
      )}K TRI · ` +
      `${droppedSteps} DROP`;
  }

  dispose() {
    window.removeEventListener(
      'skyline:aircraft-changed',
      this._aircraftListener,
    );
  }
}
