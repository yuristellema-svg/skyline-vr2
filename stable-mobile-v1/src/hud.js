const KMH = 3.6;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function speedOf(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  return flight?.velocity?.length?.() || 0;
}

function headingOf(flight) {
  const velocity = flight?.velocity;
  if (!velocity) return 0;
  return (Math.atan2(velocity.x, -velocity.z) * 180 / Math.PI + 360) % 360;
}

// SKYLINE_BUNDLE_B_HUD
export class MonoHud {
  constructor(root) {
    this.root = root;
    this.visible = false;
    this.aircraftName = 'A6M ZERO · WHITE 872';
    this.lastRender = -Infinity;
    this.boostText = '';
    this.boostUntil = 0;

    root.innerHTML = `
      <section class="analog-hud" aria-label="Flight instruments">
        <div class="analog-hud__plate">
          <div class="analog-hud__screws"><i></i><i></i><i></i><i></i></div>
          <div class="analog-hud__header"><span data-hud="aircraft">A6M ZERO · WHITE 872</span><b data-hud="state">CRUISE</b></div>
          <div class="analog-hud__gauges">
            <div class="analog-gauge"><small>IAS</small><strong data-hud="speed">000</strong><em>KM/H</em></div>
            <div class="analog-gauge"><small>ALT</small><strong data-hud="altitude">0000</strong><em>M</em></div>
            <div class="analog-gauge analog-gauge--small"><small>HDG</small><strong data-hud="heading">000</strong><em>DEG</em></div>
            <div class="analog-gauge analog-gauge--small"><small>LOAD</small><strong data-hud="load">1.0</strong><em>G</em></div>
          </div>
          <div class="analog-hud__footer"><span>V/S <b data-hud="vertical">+000</b></span><span>VIEW <b data-hud="camera">FIRST</b></span><span>PWR <b data-hud="power">MIDDLE</b></span><span>RWY <b data-hud="runway">----</b></span><span data-hud="boost"></span></div>
        </div>
      </section>`;

    this.nodes = Object.fromEntries([...root.querySelectorAll('[data-hud]')].map(node => [node.dataset.hud, node]));
    this._aircraftListener = event => { if (event?.detail?.name) this.aircraftName = event.detail.name; };
    this._boostListener = event => {
      const chain = event?.detail?.chain || 1;
      this.boostText = `BOOST ×${chain}`;
      this.boostUntil = performance.now() / 1000 + 1.8;
    };
    window.addEventListener('skyline:aircraft-changed', this._aircraftListener);
    window.addEventListener('skyline:boost-fired', this._boostListener);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.root.classList.toggle('hidden', !this.visible);
    this.root.setAttribute('aria-hidden', this.visible ? 'false' : 'true');
  }

  update(_dt, flight, cameraMode) {
    if (!this.visible) return;
    const now = performance.now() / 1000;
    if (now - this.lastRender < 0.07) return;
    this.lastRender = now;

    const speed = speedOf(flight);
    const vertical = finite(flight?.velocity?.y);
    const stall = Math.max(0, Math.min(1, finite(flight?.stallAmount)));
    const path = finite(flight?.pathAngle);

    const structural =
      Math.max(
        0,
        Math.min(
          1,
          finite(
            flight
              ?.structuralStress,
          ),
        ),
      );

    const blackout =
      Math.max(
        0,
        Math.min(
          1,
          finite(
            flight
              ?.blackoutAmount,
          ),
        ),
      );

    const redout =
      Math.max(
        0,
        Math.min(
          1,
          finite(
            flight
              ?.redoutAmount,
          ),
        ),
      );

    this.nodes.speed.textContent = String(Math.round(speed * KMH)).padStart(3, '0');
    this.nodes.altitude.textContent = String(Math.max(0, Math.round(finite(flight?.position?.y)))).padStart(4, '0');
    this.nodes.heading.textContent = String(Math.round(headingOf(flight)) % 360).padStart(3, '0');
    this.nodes.load.textContent = finite(flight?.gLoad, 1).toFixed(1);
    this.nodes.vertical.textContent = `${vertical >= 0 ? '+' : '−'}${String(Math.round(Math.abs(vertical))).padStart(3, '0')}`;
    this.nodes.camera.textContent = String(cameraMode || 'first').toUpperCase();
    this.nodes.aircraft.textContent = this.aircraftName;
    this.nodes.power.textContent =
      String(flight?.powerLabel || 'MIDDLE').toUpperCase();

    const runwayDistance =
      Number(
        flight?.runwayDistance,
      );

    this.nodes.runway.textContent =
      Number.isFinite(
        runwayDistance,
      )
        ? runwayDistance >= 1000
          ? `${(
              runwayDistance /
              1000
            ).toFixed(1)}K`
          : `${Math.round(
              runwayDistance,
            )}M`
        : '----';

    let state = 'CRUISE';

    if (flight?.landingState === 'stopped') {
      state = 'LANDED';
    } else if (flight?.landingState === 'rollout') {
      state = 'ROLLOUT';
    } else if (flight?.runwayApproach) {
      state = 'APPROACH';
    } else if (
      structural > 0.72
    ) {
      state =
        'STRUCTURAL LOAD';
    } else if (
      blackout > 0.62
    ) {
      state =
        'G-LOC WARNING';
    } else if (
      redout > 0.55
    ) {
      state =
        'NEGATIVE G';
    } else if (
      stall > 0.65
    ) {
      state =
        'STALL · NOSE DOWN';
    } else if (
      stall > 0.22
    ) {
      state = 'BUFFET';
    } else if (
      path < -0.22
    ) {
      state = 'DIVE';
    } else if (
      path > 0.18
    ) {
      state = 'CLIMB';
    } else if (
      speed < 18
    ) {
      state = 'RECOVERY';
    }

    this.nodes.state.textContent =
      state;

    this.nodes.state.dataset.warning =
      (
        structural > 0.46 ||
        blackout > 0.40 ||
        redout > 0.36 ||
        stall > 0.22
      )
        ? 'true'
        : 'false';
    this.nodes.boost.textContent = now < this.boostUntil ? this.boostText : '';
  }

  dispose() {
    window.removeEventListener('skyline:aircraft-changed', this._aircraftListener);
    window.removeEventListener('skyline:boost-fired', this._boostListener);
  }
}
