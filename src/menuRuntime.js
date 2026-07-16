import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './config.js';
import { GazeMenu as BaseGazeMenu } from './menu.js';

const DEG = Math.PI / 180;

const PHONE_LAYOUT = Object.freeze({
  resume: [0, 30],
  recenter: [-32, 10],
  camera: [0, 10],
  aircraft: [32, 10],
  effects: [-32, -14],
  respawn: [0, -14],
  restart: [32, -14],
});

const CRASH_LAYOUT = Object.freeze({
  respawn: [-30, 0],
  aircraft: [0, 0],
  restart: [30, 0],
});

const PHONE_PANEL_SCALE = 1.48;
const CRASH_PANEL_SCALE = 1.62;
const REQUIRED_STABLE_SECONDS = 0.34;
const MAX_STABLE_ANGULAR_SPEED = 0.38;
const PHONE_DWELL_TIME_SCALE = 0.86;

function placePanel(panel, yawDegrees, pitchDegrees, scale) {
  const depth = Math.max(1.2, Number(panel.userData.depth) || 1.75);
  const yaw = yawDegrees * DEG;
  const pitch = pitchDegrees * DEG;
  const horizontal = Math.cos(pitch) * depth;

  panel.position.set(
    Math.sin(yaw) * horizontal,
    Math.sin(pitch) * depth,
    -Math.cos(yaw) * horizontal,
  );

  panel.scale.setScalar(scale);
  panel.lookAt(new THREE.Vector3(0, 0, 0));
  panel.updateMatrixWorld(true);
}

export class GazeMenu extends BaseGazeMenu {
  constructor(...args) {
    super(...args);
    this._runtimeStableElapsed = 0;
    this._runtimeLastRawYaw = 0;
    this._runtimeLastRawPitch = 0;
    this._runtimeHasRawLook = false;
  }

  open(...args) {
    this._runtimeStableElapsed = 0;
    this._runtimeHasRawLook = false;
    return super.open(...args);
  }

  _buildPanels() {
    super._buildPanels();

    if (this.input?.mode !== 'phone') {
      return;
    }

    const layout = this.crashMode ? CRASH_LAYOUT : PHONE_LAYOUT;
    const scale = this.crashMode ? CRASH_PANEL_SCALE : PHONE_PANEL_SCALE;

    for (const panel of this.panels) {
      const definition = panel.userData.definition;
      const coordinates = layout[definition.id];

      if (!coordinates) {
        continue;
      }

      const [yawDegrees, pitchDegrees] = coordinates;
      definition.yaw = yawDegrees;
      definition.pitch = pitchDegrees;
      placePanel(panel, yawDegrees, pitchDegrees, scale);
    }

    this.root.updateMatrixWorld(true);
  }

  _candidateAt(yaw, pitch, phoneMode) {
    if (!phoneMode) {
      return super._candidateAt(yaw, pitch, false);
    }

    // Phone head-look and the menu use the same horizontal direction.
    // Looking left therefore selects the panel physically placed left.
    const selectionYaw = yaw;
    const selectionPitch = pitch;
    let candidate = null;
    let bestScore = Infinity;

    for (const panel of this.panels) {
      const definition = panel.userData.definition;
      const continuing = panel === this.hoveredPanel;
      const yawLimit = (continuing ? 15.5 : 13.0) * DEG;
      const pitchLimit = (continuing ? 11.5 : 9.5) * DEG;
      const yawDelta = Math.abs(selectionYaw - definition.yaw * DEG);
      const pitchDelta = Math.abs(selectionPitch - definition.pitch * DEG);

      if (yawDelta > yawLimit || pitchDelta > pitchLimit) {
        continue;
      }

      const score = yawDelta / yawLimit + pitchDelta / pitchLimit;
      if (score < bestScore) {
        bestScore = score;
        candidate = panel;
      }
    }

    return candidate;
  }

  _setCandidate(candidate) {
    const changed = candidate !== this.hoveredPanel;
    super._setCandidate(candidate);

    if (changed) {
      this._runtimeStableElapsed = 0;
      this.dwellElapsed = 0;
      this.dwellProgress = 0;
    }
  }

  update(dt) {
    if (this.input?.mode !== 'phone') {
      super.update(dt);
      return;
    }

    const safeDt = clamp(dt || 0, 0, 0.1);
    const rawYaw = Number.isFinite(this.input?.menuLook?.yaw)
      ? this.input.menuLook.yaw
      : 0;
    const rawPitch = Number.isFinite(this.input?.menuLook?.pitch)
      ? this.input.menuLook.pitch
      : 0;

    let angularSpeed = Infinity;
    if (this._runtimeHasRawLook && safeDt > 0.0001) {
      angularSpeed = Math.hypot(
        rawYaw - this._runtimeLastRawYaw,
        rawPitch - this._runtimeLastRawPitch,
      ) / safeDt;
    }

    const movingTooFast = angularSpeed > MAX_STABLE_ANGULAR_SPEED;
    if (movingTooFast || this._runtimeStableElapsed < REQUIRED_STABLE_SECONDS) {
      this.activationLockout = Math.max(this.activationLockout, 0.12);
    }

    const previousCandidate = this.hoveredPanel;
    super.update(safeDt * PHONE_DWELL_TIME_SCALE);

    if (!this.hoveredPanel || this.hoveredPanel !== previousCandidate || movingTooFast) {
      this._runtimeStableElapsed = 0;
      this.dwellElapsed = 0;
      this.dwellProgress = 0;
    } else {
      this._runtimeStableElapsed += safeDt;

      if (this._runtimeStableElapsed < REQUIRED_STABLE_SECONDS) {
        this.dwellElapsed = 0;
        this.dwellProgress = 0;
        this.activationLockout = Math.max(this.activationLockout, 0.08);
      }
    }

    this._runtimeLastRawYaw = rawYaw;
    this._runtimeLastRawPitch = rawPitch;
    this._runtimeHasRawLook = true;
  }
}
