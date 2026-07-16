import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp } from './config.js';

const DEG = Math.PI / 180;
// SKYLINE_B_POLISH_LARGE_MENU
// SKYLINE_BUNDLE_A_V2_MENU
const PANEL_WIDTH = 0.78;
const PANEL_HEIGHT = 0.35;

function panelTexture(title, subtitle, selected = false, danger = false, progress = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 300;
  const context = canvas.getContext('2d');

  const face = danger ? '#4c211d' : selected ? '#55513a' : '#2b2b23';
  const edge = danger ? '#d77b62' : selected ? '#f0d78d' : '#9e946f';

  context.fillStyle = '#161611';
  context.fillRect(0, 0, 640, 300);
  context.fillStyle = face;
  context.fillRect(15, 15, 610, 270);

  context.strokeStyle = edge;
  context.lineWidth = selected ? 8 : 4;
  context.strokeRect(18, 18, 604, 264);
  context.strokeStyle = 'rgba(10, 10, 7, .85)';
  context.lineWidth = 3;
  context.strokeRect(31, 31, 578, 238);

  for (const [x, y] of [[42, 42], [598, 42], [42, 258], [598, 258]]) {
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fillStyle = '#b7aa80';
    context.fill();
    context.strokeStyle = '#1c1b16';
    context.lineWidth = 3;
    context.stroke();
    context.beginPath();
    context.moveTo(x - 5, y);
    context.lineTo(x + 5, y);
    context.stroke();
  }

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = selected ? '#fff0bd' : '#e5ddbd';
  context.font = '900 47px ui-monospace, Menlo, Consolas, monospace';
  context.fillText(title, 320, subtitle ? 124 : 150);

  if (subtitle) {
    context.fillStyle = selected ? '#e3c96f' : '#b9b08d';
    context.font = '700 25px ui-monospace, Menlo, Consolas, monospace';
    context.fillText(subtitle, 320, 186);
  }

  if (progress > 0) {
    context.fillStyle = '#171711';
    context.fillRect(88, 238, 464, 12);
    context.fillStyle = danger ? '#d96552' : '#d9bc62';
    context.fillRect(88, 238, 464 * clamp(progress, 0, 1), 12);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function makePanel(definition, depth) {
  const material = new THREE.MeshBasicMaterial({
    map: panelTexture(definition.title, definition.subtitle, false, definition.danger, 0),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    material,
  );
  panel.renderOrder = 110;
  panel.userData.definition = definition;
  panel.userData.depth = depth;
  panel.userData.stateKey = '';
  return panel;
}

function refreshPanel(panel, selected, subtitle, progress) {
  const key = `${selected}|${subtitle}|${Math.round(progress * 20)}`;
  if (panel.userData.stateKey === key) return;
  panel.userData.stateKey = key;
  const old = panel.material.map;
  panel.material.map = panelTexture(
    panel.userData.definition.title,
    subtitle,
    selected,
    panel.userData.definition.danger,
    selected ? progress : 0,
  );
  panel.material.needsUpdate = true;
  old?.dispose?.();
}

export class GazeMenu {
  constructor(uiScene, input, actions = {}) {
    this.uiScene = uiScene;
    this.input = input;
    this.actions = actions;
    this.isOpen = false;
    this.crashMode = false;
    this.cameraName = 'FIRST';
    this.effectsName = 'STANDARD';
    this.aircraftName = 'A6M ZERO · WHITE 872';
    this.hoveredPanel = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.activationLockout = 0;
    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._hasSmoothedLook = false;
    this._pointerYaw = 0;
    this._pointerPitch = 0;
    this._pointerMovedSinceOpen = false;
    this._hoverStartedAt = 0;
    this._requirePhoneExit = false;

    this._onPointerMove = event => {
      if (!this.isOpen || this.input?.mode === 'phone') return;
      this._setPointerFromEvent(event);
      this._pointerMovedSinceOpen = true;
    };

    this._onPointerDown = event => {
      if (!this.isOpen || this.input?.mode === 'phone' || event.button !== 0) return;
      this._setPointerFromEvent(event);
      this._pointerMovedSinceOpen = true;
      this._updateDesktopCandidate();
      const hoveredLongEnough = performance.now() - this._hoverStartedAt >= 120;
      if (this.hoveredPanel && hoveredLongEnough && this.activationLockout <= 0) {
        event.preventDefault();
        this._activate(this.hoveredPanel);
      }
    };

    this._onKeyDown = event => {
      if (!this.isOpen || this.input?.mode === 'phone') return;
      if (event.code === 'Enter' || event.code === 'Space') {
        if (this.hoveredPanel && this.activationLockout <= 0) {
          event.preventDefault();
          this._activate(this.hoveredPanel);
        }
      }
    };

    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);

    this.root = new THREE.Group();
    this.root.name = 'analog-flight-menu';
    this.root.visible = false;
    this.uiScene.add(this.root);
    this.panels = [];

    this._aircraftListener = event => {
      if (event?.detail?.name) this.aircraftName = event.detail.name;
    };
    window.addEventListener('skyline:aircraft-changed', this._aircraftListener);
  }

  _setPointerFromEvent(event) {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this._pointerYaw = ((event.clientX / width) - 0.5) * 54 * DEG;
    this._pointerPitch = (0.5 - (event.clientY / height)) * 34 * DEG;
  }

  _definitions() {
    if (this.crashMode) {
      return [
        { id: 'respawn', title: 'RETURN', subtitle: 'RE-ENTER FLIGHT', yaw: -13, pitch: 3 },
        { id: 'aircraft', title: 'AIRCRAFT', subtitle: this.aircraftName, yaw: 0, pitch: 3 },
        { id: 'restart', title: 'REBUILD', subtitle: 'RELOAD WORLD', yaw: 13, pitch: 3, danger: true },
      ];
    }

    return [
      { id: 'resume', title: 'RESUME', subtitle: 'BACK TO FLIGHT', yaw: -27, pitch: 8 },
      { id: 'recenter', title: 'RECENTER', subtitle: 'RESET NEUTRAL', yaw: -9, pitch: 8 },
      { id: 'camera', title: 'VIEW', subtitle: this.cameraName, yaw: 9, pitch: 8 },
      { id: 'aircraft', title: 'AIRCRAFT', subtitle: this.aircraftName, yaw: 27, pitch: 8 },
      { id: 'effects', title: 'EFFECTS', subtitle: this.effectsName, yaw: -18, pitch: -9 },
      { id: 'respawn', title: 'RETURN', subtitle: 'START POSITION', yaw: 0, pitch: -9 },
      { id: 'restart', title: 'REBUILD', subtitle: 'RELOAD WORLD', yaw: 18, pitch: -9, danger: true },
    ];
  }

  _clearPanels() {
    for (const panel of this.panels) {
      this.root.remove(panel);
      panel.geometry.dispose();
      panel.material.map?.dispose?.();
      panel.material.dispose();
    }
    this.panels.length = 0;
  }

  _buildPanels() {
    this._clearPanels();
    const depth = CONFIG.menu?.depth || 2.5;
    for (const definition of this._definitions()) {
      const panel = makePanel(definition, depth);
      const yaw = definition.yaw * DEG;
      const pitch = definition.pitch * DEG;
      const horizontal = Math.cos(pitch) * depth;
      panel.position.set(
        Math.sin(yaw) * horizontal,
        Math.sin(pitch) * depth,
        -Math.cos(yaw) * horizontal,
      );
      panel.lookAt(0, 0, 0);
      this.root.add(panel);
      this.panels.push(panel);
    }
  }

  open(position, quaternion, crashMode = false) {
    this.root.visible = false;
    this._clearPanels();

    this.root.scale.set(1.18, 1.18, 1.18);
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.quaternion.identity();

    this.crashMode = Boolean(crashMode);
    this.isOpen = true;
    this.root.visible = true;
    this.hoveredPanel = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.activationLockout = 0.28;
    this._hasSmoothedLook = false;
    this._pointerMovedSinceOpen = false;
    this._hoverStartedAt = 0;
    this._requirePhoneExit = false;
    document.body.classList.add('menu-open');
    this.input?.beginMenuLook?.();
    this._buildPanels();
    this.reanchor(position, quaternion);
  }

  close() {
    this.isOpen = false;
    this.root.visible = false;
    this.hoveredPanel = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    document.body.classList.remove('menu-open');
  }

  reanchor(position, quaternion) {
    if (position?.isVector3) this.root.position.copy(position);
    else if (Array.isArray(position)) this.root.position.fromArray(position);
    if (quaternion?.isQuaternion) this.root.quaternion.copy(quaternion);
    this.root.updateMatrixWorld(true);
  }

  _subtitle(panel) {
    const id = panel.userData.definition.id;
    if (id === 'camera') return this.cameraName;
    if (id === 'effects') return this.effectsName;
    if (id === 'aircraft') return this.aircraftName;
    return panel.userData.definition.subtitle || '';
  }

  _activate(panel) {
    const id = panel.userData.definition.id;
    let result;
    if (id === 'resume') result = this.actions.resume?.();
    else if (id === 'recenter') {
      this.input?.recenter?.();
      result = this.actions.recenter?.();
    } else if (id === 'camera') {
      result = this.actions.camera?.();
      if (result) this.cameraName = String(result).toUpperCase();
    } else if (id === 'aircraft') {
      window.dispatchEvent(new CustomEvent('skyline:aircraft-next'));
    } else if (id === 'effects') {
      result = this.actions.effects?.();
      if (result) this.effectsName = String(result).toUpperCase();
    } else if (id === 'respawn') {
      this.close();
      result = this.actions.respawn?.();
    } else if (id === 'restart') {
      this.close();
      result = this.actions.restart?.();
    }

    this.activationLockout = 0.65;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    if (this.input?.mode === 'phone') this._requirePhoneExit = true;
    return result;
  }

  _candidateAt(yaw, pitch, phoneMode) {
    let candidate = null;
    let bestScore = Infinity;
    for (const panel of this.panels) {
      const definition = panel.userData.definition;
      const continuing = panel === this.hoveredPanel;
      const yawLimit = (phoneMode
        ? (continuing ? 6.5 : 5.2)
        : (continuing ? 7.0 : 5.8)) * DEG;
      const pitchLimit = (phoneMode
        ? (continuing ? 5.8 : 4.5)
        : (continuing ? 6.2 : 5.0)) * DEG;
      const yawDelta = Math.abs(yaw - definition.yaw * DEG);
      const pitchDelta = Math.abs(pitch - definition.pitch * DEG);
      if (yawDelta <= yawLimit && pitchDelta <= pitchLimit) {
        const score = yawDelta / yawLimit + pitchDelta / pitchLimit;
        if (score < bestScore) {
          bestScore = score;
          candidate = panel;
        }
      }
    }
    return candidate;
  }

  _setCandidate(candidate) {
    if (candidate === this.hoveredPanel) return;
    this.hoveredPanel = candidate;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this._hoverStartedAt = performance.now();
    if (!candidate) this._requirePhoneExit = false;
  }

  _updateDesktopCandidate() {
    if (!this._pointerMovedSinceOpen) {
      this._setCandidate(null);
      return;
    }
    this._setCandidate(this._candidateAt(this._pointerYaw, this._pointerPitch, false));
  }

  update(dt) {
    if (!this.isOpen) return;
    const safeDt = clamp(dt || 0, 0, 0.1);
    this.activationLockout = Math.max(0, this.activationLockout - safeDt);

    const phoneMode = this.input?.mode === 'phone';
    if (!phoneMode) {
      this._updateDesktopCandidate();
      this.dwellElapsed = 0;
      this.dwellProgress = 0;
    } else {
      this.input?.sampleMenuLook?.();
      const rawYaw = Number.isFinite(this.input?.menuLook?.yaw) ? this.input.menuLook.yaw : 0;
      const rawPitch = Number.isFinite(this.input?.menuLook?.pitch) ? this.input.menuLook.pitch : 0;
      const blend = 1 - Math.exp(-safeDt / 0.12);
      if (!this._hasSmoothedLook) {
        this._smoothedYaw = rawYaw;
        this._smoothedPitch = rawPitch;
        this._hasSmoothedLook = true;
      } else {
        this._smoothedYaw += (rawYaw - this._smoothedYaw) * blend;
        this._smoothedPitch += (rawPitch - this._smoothedPitch) * blend;
      }

      const candidate = this._candidateAt(this._smoothedYaw, this._smoothedPitch, true);
      this._setCandidate(candidate);

      const dwellSeconds = this.hoveredPanel?.userData.definition.danger ? 1.8 : 1.35;
      if (this.hoveredPanel && !this._requirePhoneExit && this.activationLockout <= 0) {
        this.dwellElapsed += safeDt;
        this.dwellProgress = clamp(this.dwellElapsed / dwellSeconds, 0, 1);
        if (this.dwellElapsed >= dwellSeconds) this._activate(this.hoveredPanel);
      } else {
        this.dwellElapsed = Math.max(0, this.dwellElapsed - safeDt * 2.0);
        this.dwellProgress = clamp(this.dwellElapsed / dwellSeconds, 0, 1);
      }
    }

    for (const panel of this.panels) {
      refreshPanel(
        panel,
        panel === this.hoveredPanel,
        this._subtitle(panel),
        phoneMode && panel === this.hoveredPanel ? this.dwellProgress : 0,
      );
    }
  }

  dispose() {
    window.removeEventListener('skyline:aircraft-changed', this._aircraftListener);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('keydown', this._onKeyDown);
    document.body.classList.remove('menu-open');
    this._clearPanels();
    this.uiScene?.remove(this.root);
  }
}
