import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, DEG, wrapPi } from './config.js';

const PANEL_LAYOUT = [
  ['RESUME', 'resume', -20, 10],
  ['RECENTER', 'recenter', 0, 10],
  ['CAMERA', 'camera', 20, 10],
  ['RESPAWN', 'respawn', -27, -9],
  ['SENSITIVITY', 'sensitivity', -9, -9],
  ['EFFECTS', 'effects', 9, -9],
  ['RESTART WORLD', 'restart', 27, -9],
];

export class GazeMenu {
  constructor(uiScene, input, callbacks, config = CONFIG) {
    this.config = config;
    this.input = input;
    this.callbacks = callbacks;
    this.root = new THREE.Group();
    this.root.name = 'Stereo gaze menu at 2.5 metres';
    this.root.visible = false;
    uiScene.add(this.root);
    this.panels = [];
    this.isOpen = false;
    this.crashMode = false;
    this.targetIndex = -1;
    this.latchedIndex = -1;
    this.dwellIndex = -1;
    this.dwellTime = 0;
    this.exitTime = 0;
    this.entryGrace = 0;
    this.activationLockout = 0;
    this.dwellProgress = 0;
    this._smoothedGazeX = 0;
    this._smoothedGazeY = 0;
    this._smoothedGazeZ = -1;
    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._gazeInitialized = false;
    this._panelArmed = new Uint8Array(PANEL_LAYOUT.length);
    this._panelArmed.fill(1);
    this.cameraName = 'FIRST';
    this.effectsName = 'FULL';
    this._buildPanels();
  }

  _buildPanels() {
    const depth = this.config.menu.depth;
    for (let i = 0; i < PANEL_LAYOUT.length; i += 1) {
      const spec = PANEL_LAYOUT[i];
      const yaw = spec[2] * DEG;
      const pitch = spec[3] * DEG;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.34), material);
      const cosPitch = Math.cos(pitch);
      mesh.position.set(
        Math.sin(yaw) * cosPitch * depth,
        Math.sin(pitch) * depth,
        -Math.cos(yaw) * cosPitch * depth
      );
      mesh.lookAt(0, 0, 0);
      mesh.renderOrder = 9000;
      mesh.frustumCulled = false;
      this.root.add(mesh);
      this.panels.push({
        label: spec[0],
        action: spec[1],
        yaw,
        pitch,
        canvas,
        texture,
        material,
        mesh,
      });
      this._drawPanel(i, false);
    }
  }

  open(position, quaternion, crashMode = false) {
    this.root.position.copy(position);
    this.root.quaternion.copy(quaternion);
    this.root.visible = true;
    this.isOpen = true;
    this.crashMode = crashMode;
    this.targetIndex = -1;
    this.latchedIndex = -1;
    this.dwellIndex = -1;
    this.dwellTime = 0;
    this.exitTime = 0;
    this.entryGrace = 0.4;
    this.activationLockout = 0;
    this.dwellProgress = 0;
    this._gazeInitialized = false;
    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._panelArmed.fill(1);
    this.input.beginMenuLook();
    for (let i = 0; i < this.panels.length; i += 1) this._drawPanel(i, false);
  }

  close() {
    this.root.visible = false;
    this.isOpen = false;
    this.crashMode = false;
    this.targetIndex = -1;
    this.latchedIndex = -1;
    this.dwellIndex = -1;
    this.dwellTime = 0;
    this.activationLockout = 0;
    this.dwellProgress = 0;
    this._gazeInitialized = false;
  }

  reanchor(position, quaternion) {
    this.root.position.copy(position);
    this.root.quaternion.copy(quaternion);
  }

  update(dt) {
    if (!this.isOpen) {
      this.dwellProgress = 0;
      return;
    }
    this.input.sampleMenuLook();
    this._smoothGaze(dt);
    this._rearmExitedPanels();

    if (this.entryGrace > 0) {
      this.entryGrace = Math.max(0, this.entryGrace - dt);
      this._setTarget(-1);
      return;
    }

    if (this.activationLockout > 0) {
      this.activationLockout = Math.max(0, this.activationLockout - dt);
      this._setTarget(-1);
      this.dwellIndex = -1;
      this.dwellTime = 0;
      this.dwellProgress = 0;
      return;
    }

    const target = this._findTarget();
    if (target >= 0) {
      if (this.dwellIndex !== target) {
        this.dwellIndex = target;
        this.dwellTime = 0;
      }
      this._setTarget(target);
      this.dwellTime += dt;
      const requiredDwell = this._requiredDwell(target);
      this.dwellProgress = Math.min(1, this.dwellTime / requiredDwell);
      if (this.dwellTime >= requiredDwell) {
        this._panelArmed[target] = 0;
        this.latchedIndex = target;
        this.dwellIndex = -1;
        this.dwellTime = 0;
        this.dwellProgress = 0;
        this.activationLockout = this.config.menu.activationLockoutSeconds ?? 0.5;
        this._setTarget(-1);
        this._activate(target);
      }
      return;
    }

    this._setTarget(-1);
    if (this.dwellIndex >= 0 && this.dwellTime > 0) {
      const requiredDwell = this._requiredDwell(this.dwellIndex);
      const decaySeconds = this.config.menu.dwellDecaySeconds ?? 0.4;
      this.dwellTime = Math.max(0, this.dwellTime - dt * requiredDwell / decaySeconds);
      this.dwellProgress = this.dwellTime / requiredDwell;
      if (this.dwellTime === 0) this.dwellIndex = -1;
    } else {
      this.dwellIndex = -1;
      this.dwellTime = 0;
      this.dwellProgress = 0;
    }
  }

  _smoothGaze(dt) {
    const yaw = this.input.menuLook.yaw;
    const pitch = this.input.menuLook.pitch;
    const cosPitch = Math.cos(pitch);
    const rawX = Math.sin(yaw) * cosPitch;
    const rawY = Math.sin(pitch);
    const rawZ = -Math.cos(yaw) * cosPitch;

    if (!this._gazeInitialized) {
      this._smoothedGazeX = rawX;
      this._smoothedGazeY = rawY;
      this._smoothedGazeZ = rawZ;
      this._gazeInitialized = true;
    } else {
      const tau = this.config.menu.gazeSmoothingTau ?? 0.12;
      const weight = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
      this._smoothedGazeX += (rawX - this._smoothedGazeX) * weight;
      this._smoothedGazeY += (rawY - this._smoothedGazeY) * weight;
      this._smoothedGazeZ += (rawZ - this._smoothedGazeZ) * weight;
      const length = Math.hypot(
        this._smoothedGazeX,
        this._smoothedGazeY,
        this._smoothedGazeZ
      );
      if (length > 1e-8) {
        const inverseLength = 1 / length;
        this._smoothedGazeX *= inverseLength;
        this._smoothedGazeY *= inverseLength;
        this._smoothedGazeZ *= inverseLength;
      } else {
        this._smoothedGazeX = rawX;
        this._smoothedGazeY = rawY;
        this._smoothedGazeZ = rawZ;
      }
    }

    this._smoothedYaw = Math.atan2(this._smoothedGazeX, -this._smoothedGazeZ);
    this._smoothedPitch = Math.atan2(
      this._smoothedGazeY,
      Math.hypot(this._smoothedGazeX, this._smoothedGazeZ)
    );
  }

  _isInsidePanel(index, yawHalfAngle, pitchHalfAngle) {
    const panel = this.panels[index];
    return (
      Math.abs(wrapPi(this._smoothedYaw - panel.yaw)) <= yawHalfAngle &&
      Math.abs(this._smoothedPitch - panel.pitch) <= pitchHalfAngle
    );
  }

  _rearmExitedPanels() {
    const yawExit = this.config.menu.panelExitHalfAngle ?? 7.5 * DEG;
    const pitchExit = this.config.menu.panelExitPitchHalfAngle ?? 6.8 * DEG;
    for (let i = 0; i < this.panels.length; i += 1) {
      if (this._panelArmed[i] === 0 && !this._isInsidePanel(i, yawExit, pitchExit)) {
        this._panelArmed[i] = 1;
        if (this.latchedIndex === i) this.latchedIndex = -1;
      }
    }
  }

  _findTarget() {
    const yawEnter = this.config.menu.panelHitHalfAngle;
    const pitchEnter = this.config.menu.panelPitchHalfAngle;
    const yawExit = this.config.menu.panelExitHalfAngle ?? 7.5 * DEG;
    const pitchExit = this.config.menu.panelExitPitchHalfAngle ?? 6.8 * DEG;
    const held = this.targetIndex;

    if (
      held >= 0 &&
      this._panelArmed[held] !== 0 &&
      !(this.crashMode && this.panels[held].action === 'resume') &&
      this._isInsidePanel(held, yawExit, pitchExit)
    ) {
      return held;
    }

    for (let i = 0; i < this.panels.length; i += 1) {
      if (this._panelArmed[i] === 0) continue;
      if (this.crashMode && this.panels[i].action === 'resume') continue;
      if (this._isInsidePanel(i, yawEnter, pitchEnter)) return i;
    }
    return -1;
  }

  _requiredDwell(index) {
    return this.panels[index].action === 'restart'
      ? this.config.menu.destructiveDwellSeconds ?? 1.5
      : this.config.menu.dwellSeconds;
  }

  _setTarget(index) {
    if (index === this.targetIndex) return;
    const previous = this.targetIndex;
    this.targetIndex = index;
    if (previous >= 0) this._drawPanel(previous, false);
    if (index >= 0) this._drawPanel(index, true);
  }

  _activate(index) {
    const action = this.panels[index].action;
    if (action === 'resume') this.callbacks.resume();
    else if (action === 'recenter') {
      this.input.recenter();
      this.input.beginMenuLook();
      this.callbacks.recenter();
    } else if (action === 'camera') {
      this.cameraName = this.callbacks.camera().toUpperCase();
      this._drawPanel(index, this.targetIndex === index);
    } else if (action === 'respawn') this.callbacks.respawn();
    else if (action === 'sensitivity') {
      this.input.cycleSensitivity();
      this._drawPanel(index, this.targetIndex === index);
    } else if (action === 'effects') {
      this.effectsName = this.callbacks.effects();
      this._drawPanel(index, this.targetIndex === index);
    } else if (action === 'restart') this.callbacks.restart();
  }

  _drawPanel(index, active) {
    const panel = this.panels[index];
    const context = panel.canvas.getContext('2d');
    context.clearRect(0, 0, panel.canvas.width, panel.canvas.height);
    const disabled = this.crashMode && panel.action === 'resume';
    context.fillStyle = disabled ? 'rgba(24,32,35,0.72)' : active ? 'rgba(237,164,78,0.96)' : 'rgba(13,31,39,0.92)';
    context.strokeStyle = active ? '#fff4dc' : 'rgba(195,225,231,0.62)';
    context.lineWidth = active ? 10 : 5;
    context.beginPath();
    context.roundRect(8, 8, 496, 240, 38);
    context.fill();
    context.stroke();
    context.fillStyle = disabled ? 'rgba(255,255,255,0.28)' : active ? '#15272d' : '#fff7e8';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '800 38px system-ui, sans-serif';
    let title = panel.label;
    let value = '';
    if (panel.action === 'resume' && disabled) title = 'RESPAWNING';
    if (panel.action === 'camera') value = this.cameraName;
    if (panel.action === 'sensitivity') value = this.input.sensitivityName;
    if (panel.action === 'effects') value = this.effectsName;
    context.fillText(title, 256, value ? 100 : 128);
    if (value) {
      context.font = '700 30px system-ui, sans-serif';
      context.fillText(value, 256, 158);
    }
    panel.texture.needsUpdate = true;
    panel.mesh.scale.setScalar(active ? 1.06 : 1);
  }
}
