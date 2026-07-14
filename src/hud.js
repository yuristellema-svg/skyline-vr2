export class MonoHud {
  constructor(root) {
    this.root = root;
    this.speed = root.querySelector('[data-speed]');
    this.g = root.querySelector('[data-g]');
    this.boost = root.querySelector('[data-boost]');
    this.camera = root.querySelector('[data-camera]');
    this.performance = root.querySelector('[data-performance]');
    this._elapsed = 0;

    if (this.boost) {
      let boostRow = this.boost;

      while (
        boostRow.parentElement &&
        boostRow.parentElement !== root
      ) {
        const parent = boostRow.parentElement;

        const containsOtherHudValues =
          parent.querySelector(
            '[data-speed], ' +
            '[data-g], ' +
            '[data-camera], ' +
            '[data-performance]'
          );

        if (containsOtherHudValues) {
          break;
        }

        boostRow = parent;
      }

      boostRow.style.display = 'none';
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

    this.speed.textContent =
      `${Math.round(flight.speedKmh)} km/h`;

    this.g.textContent =
      `${flight.gLoad.toFixed(1)} g`;

    this.camera.textContent =
      cameraMode === 'first'
        ? 'FIRST PERSON'
        : 'THIRD PERSON';

    this.performance.textContent =
      `${metrics.calls} calls · ` +
      `${Math.round(metrics.triangles / 1000)}k tris · ` +
      `${droppedSteps} dropped`;
  }
}
