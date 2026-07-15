import * as THREE from '../vendor/three.module.min.js';

import {
  CONFIG,
  clamp,
} from './config.js';

const DEG = Math.PI / 180;

const PANEL_WIDTH = 0.62;
const PANEL_HEIGHT = 0.29;

function canvasTexture(
  title,
  subtitle = '',
  selected = false,
  danger = false,
) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 512;
  canvas.height = 256;

  const context =
    canvas.getContext('2d');

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  context.fillStyle = danger
    ? 'rgba(67, 18, 18, 0.94)'
    : selected
      ? 'rgba(28, 65, 79, 0.96)'
      : 'rgba(10, 18, 24, 0.92)';

  context.fillRect(
    10,
    10,
    492,
    236,
  );

  context.strokeStyle = danger
    ? '#ef8e78'
    : selected
      ? '#8de2ff'
      : '#6b8390';

  context.lineWidth =
    selected ? 10 : 5;

  context.strokeRect(
    12,
    12,
    488,
    232,
  );

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f7fbfd';

  context.font =
    '700 43px system-ui, -apple-system, sans-serif';

  context.fillText(
    title,
    256,
    subtitle ? 104 : 128,
  );

  if (subtitle) {
    context.fillStyle = selected
      ? '#bdefff'
      : '#aabac2';

    context.font =
      '600 24px system-ui, -apple-system, sans-serif';

    context.fillText(
      subtitle,
      256,
      163,
    );
  }

  const texture =
    new THREE.CanvasTexture(canvas);

  if (
    'colorSpace' in texture &&
    THREE.SRGBColorSpace
  ) {
    texture.colorSpace =
      THREE.SRGBColorSpace;
  } else if (
    'encoding' in texture &&
    THREE.sRGBEncoding
  ) {
    texture.encoding =
      THREE.sRGBEncoding;
  }

  texture.minFilter =
    THREE.LinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.generateMipmaps = false;

  return texture;
}

function makePanel(
  definition,
  depth,
) {
  const geometry =
    new THREE.PlaneGeometry(
      PANEL_WIDTH,
      PANEL_HEIGHT,
    );

  const panelMaterial =
    new THREE.MeshBasicMaterial({
      map: canvasTexture(
        definition.title,
        definition.subtitle,
        false,
        definition.danger,
      ),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

  const mesh = new THREE.Mesh(
    geometry,
    panelMaterial,
  );

  mesh.renderOrder = 100;

  mesh.userData.definition =
    definition;

  mesh.userData.depth = depth;
  mesh.userData.selected = false;

  return mesh;
}

function refreshPanel(
  panel,
  selected,
  subtitle,
) {
  if (
    panel.userData.selected ===
      selected &&
    panel.userData.lastSubtitle ===
      subtitle
  ) {
    return;
  }

  panel.userData.selected =
    selected;

  panel.userData.lastSubtitle =
    subtitle;

  const definition =
    panel.userData.definition;

  const oldTexture =
    panel.material.map;

  panel.material.map =
    canvasTexture(
      definition.title,
      subtitle,
      selected,
      definition.danger,
    );

  panel.material.needsUpdate = true;
  oldTexture?.dispose();
}

function localDirectionFromQuaternion(
  quaternion,
) {
  return new THREE.Vector3(
    0,
    0,
    -1,
  )
    .applyQuaternion(quaternion)
    .normalize();
}

function finiteAngle(value) {
  return Number.isFinite(value)
    ? value
    : 0;
}

export class GazeMenu {
  constructor(
    uiScene,
    input,
    actions = {},
  ) {
    this.uiScene = uiScene;
    this.input = input;
    this.actions = actions;

    this.isOpen = false;
    this.crashMode = false;
    this.dwellProgress = 0;

    this.cameraName = 'FIRST';
    this.effectsName = 'STANDARD';
    this.aircraftName =
      'SKYLINE GLIDER';

    this.root = new THREE.Group();
    this.root.name = 'gaze-menu-root';
    this.root.visible = false;

    this.uiScene.add(this.root);

    this.panels = [];
    this.hoveredPanel = null;
    this.dwellElapsed = 0;
    this.activationLockout = 0;

    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._hasSmoothedLook = false;

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

  _definitions() {
    if (this.crashMode) {
      return [
        {
          id: 'respawn',
          title: 'RESPAWN',
          subtitle:
            'RETURN TO FLIGHT',
          yaw: -13,
          pitch: 4,
        },
        {
          id: 'aircraft',
          title: 'AIRCRAFT',
          subtitle:
            this.aircraftName,
          yaw: 0,
          pitch: 4,
        },
        {
          id: 'restart',
          title: 'REBUILD WORLD',
          subtitle:
            'RELOAD STREAM',
          yaw: 13,
          pitch: 4,
          danger: true,
        },
      ];
    }

    return [
      {
        id: 'resume',
        title: 'RESUME',
        subtitle: 'BACK TO FLIGHT',
        yaw: -20,
        pitch: 7,
      },
      {
        id: 'recenter',
        title: 'RECENTER',
        subtitle: 'RESET NEUTRAL',
        yaw: -7,
        pitch: 7,
      },
      {
        id: 'camera',
        title: 'CAMERA',
        subtitle: this.cameraName,
        yaw: 7,
        pitch: 7,
      },
      {
        id: 'aircraft',
        title: 'AIRCRAFT',
        subtitle:
          this.aircraftName,
        yaw: 20,
        pitch: 7,
      },
      {
        id: 'effects',
        title: 'EFFECTS',
        subtitle:
          this.effectsName,
        yaw: -13,
        pitch: -8,
      },
      {
        id: 'respawn',
        title: 'RESPAWN',
        subtitle:
          'RETURN TO START',
        yaw: 0,
        pitch: -8,
      },
      {
        id: 'restart',
        title: 'REBUILD WORLD',
        subtitle:
          'RELOAD STREAM',
        yaw: 13,
        pitch: -8,
        danger: true,
      },
    ];
  }

  _clearPanels() {
    for (const panel of this.panels) {
      this.root.remove(panel);

      panel.geometry.dispose();
      panel.material.map?.dispose();
      panel.material.dispose();
    }

    this.panels.length = 0;
  }

  _buildPanels() {
    this._clearPanels();

    const depth =
      CONFIG.menu?.depth || 2.5;

    for (
      const definition of
      this._definitions()
    ) {
      const panel = makePanel(
        definition,
        depth,
      );

      const yaw =
        definition.yaw * DEG;

      const pitch =
        definition.pitch * DEG;

      const horizontal =
        Math.cos(pitch) * depth;

      panel.position.set(
        Math.sin(yaw) *
          horizontal,
        Math.sin(pitch) *
          depth,
        -Math.cos(yaw) *
          horizontal,
      );

      panel.lookAt(0, 0, 0);

      this.root.add(panel);
      this.panels.push(panel);
    }
  }

  open(
    position,
    quaternion,
    crashMode = false,
  ) {
    this.crashMode =
      Boolean(crashMode);

    this.isOpen = true;
    this.root.visible = true;

    this.dwellProgress = 0;
    this.dwellElapsed = 0;

    this.activationLockout =
      CONFIG.menu
        ?.activationLockoutSeconds ||
      0.5;

    this.hoveredPanel = null;
    this._hasSmoothedLook = false;

    this._buildPanels();

    this.reanchor(
      position,
      quaternion,
    );
  }

  close() {
    this.isOpen = false;
    this.root.visible = false;

    this.dwellProgress = 0;
    this.dwellElapsed = 0;
    this.hoveredPanel = null;
  }

  reanchor(
    position,
    quaternion,
  ) {
    if (position?.isVector3) {
      this.root.position.copy(
        position,
      );
    } else if (
      Array.isArray(position)
    ) {
      this.root.position.fromArray(
        position,
      );
    }

    if (quaternion?.isQuaternion) {
      this.root.quaternion.copy(
        quaternion,
      );
    }

    this.root.updateMatrixWorld(true);
  }

  _readLookAngles() {
    const look =
      this.input?.menuLook;

    if (!look) {
      return {
        yaw: 0,
        pitch: 0,
      };
    }

    if (
      Number.isFinite(look.yaw) ||
      Number.isFinite(look.pitch)
    ) {
      return {
        yaw: finiteAngle(look.yaw),
        pitch: finiteAngle(
          look.pitch,
        ),
      };
    }

    if (
      Number.isFinite(look.x) &&
      Number.isFinite(look.y) &&
      !look.isVector3
    ) {
      return {
        yaw: finiteAngle(look.x),
        pitch: finiteAngle(look.y),
      };
    }

    let direction = null;

    if (look.isVector3) {
      direction = look
        .clone()
        .normalize();
    } else if (
      look.direction?.isVector3
    ) {
      direction =
        look.direction
          .clone()
          .normalize();
    } else if (look.isQuaternion) {
      direction =
        localDirectionFromQuaternion(
          look,
        );
    } else if (
      look.quaternion?.isQuaternion
    ) {
      direction =
        localDirectionFromQuaternion(
          look.quaternion,
        );
    }

    if (direction) {
      return {
        yaw: Math.atan2(
          -direction.x,
          -direction.z,
        ),
        pitch: Math.asin(
          clamp(
            direction.y,
            -1,
            1,
          ),
        ),
      };
    }

    return {
      yaw: 0,
      pitch: 0,
    };
  }

  _subtitle(panel) {
    const id =
      panel.userData.definition.id;

    if (id === 'camera') {
      return this.cameraName;
    }

    if (id === 'effects') {
      return this.effectsName;
    }

    if (id === 'aircraft') {
      return this.aircraftName;
    }

    return (
      panel.userData.definition
        .subtitle || ''
    );
  }

  _activate(panel) {
    const id =
      panel.userData.definition.id;

    let result;

    if (id === 'resume') {
      result =
        this.actions.resume?.();
    } else if (
      id === 'recenter'
    ) {
      this.input?.recenter?.();

      result =
        this.actions.recenter?.();
    } else if (
      id === 'camera'
    ) {
      result =
        this.actions.camera?.();

      if (result) {
        this.cameraName =
          String(result).toUpperCase();
      }
    } else if (
      id === 'aircraft'
    ) {
      window.dispatchEvent(
        new CustomEvent(
          'skyline:aircraft-next',
        ),
      );
    } else if (
      id === 'effects'
    ) {
      result =
        this.actions.effects?.();

      if (result) {
        this.effectsName =
          String(result).toUpperCase();
      }
    } else if (
      id === 'respawn'
    ) {
      this.close();

      result =
        this.actions.respawn?.();
    } else if (
      id === 'restart'
    ) {
      this.close();

      result =
        this.actions.restart?.();
    }

    this.activationLockout =
      CONFIG.menu
        ?.activationLockoutSeconds ||
      0.5;

    this.dwellElapsed = 0;
    this.dwellProgress = 0;

    return result;
  }

  update(dt) {
    if (!this.isOpen) return;

    const safeDt = clamp(
      dt || 0,
      0,
      0.1,
    );

    this.activationLockout =
      Math.max(
        0,
        this.activationLockout -
          safeDt,
      );

    const raw =
      this._readLookAngles();

    const smoothingTau =
      Math.max(
        0.001,
        CONFIG.menu
          ?.gazeSmoothingTau ||
          0.12,
      );

    const blend =
      1 -
      Math.exp(
        -safeDt / smoothingTau,
      );

    if (!this._hasSmoothedLook) {
      this._smoothedYaw = raw.yaw;
      this._smoothedPitch =
        raw.pitch;

      this._hasSmoothedLook = true;
    } else {
      this._smoothedYaw +=
        (
          raw.yaw -
          this._smoothedYaw
        ) *
        blend;

      this._smoothedPitch +=
        (
          raw.pitch -
          this._smoothedPitch
        ) *
        blend;
    }

    const hitYaw =
      CONFIG.menu
        ?.panelHitHalfAngle ||
      5.5 * DEG;

    const hitPitch =
      CONFIG.menu
        ?.panelPitchHalfAngle ||
      4.8 * DEG;

    const exitYaw =
      CONFIG.menu
        ?.panelExitHalfAngle ||
      7.5 * DEG;

    const exitPitch =
      CONFIG.menu
        ?.panelExitPitchHalfAngle ||
      6.8 * DEG;

    let candidate = null;
    let bestScore = Infinity;

    for (
      const panel of
      this.panels
    ) {
      const definition =
        panel.userData.definition;

      const yawDelta = Math.abs(
        this._smoothedYaw -
          definition.yaw * DEG,
      );

      const pitchDelta = Math.abs(
        this._smoothedPitch -
          definition.pitch * DEG,
      );

      const continuing =
        panel === this.hoveredPanel;

      const yawLimit = continuing
        ? exitYaw
        : hitYaw;

      const pitchLimit = continuing
        ? exitPitch
        : hitPitch;

      if (
        yawDelta <= yawLimit &&
        pitchDelta <= pitchLimit
      ) {
        const score =
          yawDelta / yawLimit +
          pitchDelta / pitchLimit;

        if (score < bestScore) {
          bestScore = score;
          candidate = panel;
        }
      }
    }

    if (
      candidate !==
      this.hoveredPanel
    ) {
      this.hoveredPanel =
        candidate;

      this.dwellElapsed = 0;
      this.dwellProgress = 0;
    }

    const dwellSeconds =
      this.hoveredPanel?.userData
        .definition.danger
        ? (
            CONFIG.menu
              ?.destructiveDwellSeconds ||
            1.5
          )
        : (
            CONFIG.menu
              ?.dwellSeconds || 1
          );

    if (
      this.hoveredPanel &&
      this.activationLockout <= 0
    ) {
      this.dwellElapsed += safeDt;

      this.dwellProgress = clamp(
        this.dwellElapsed /
          dwellSeconds,
        0,
        1,
      );

      if (
        this.dwellElapsed >=
        dwellSeconds
      ) {
        this._activate(
          this.hoveredPanel,
        );
      }
    } else {
      const decaySeconds =
        Math.max(
          0.05,
          CONFIG.menu
            ?.dwellDecaySeconds ||
            0.4,
        );

      this.dwellElapsed =
        Math.max(
          0,
          this.dwellElapsed -
            (
              safeDt /
              decaySeconds
            ) *
              dwellSeconds,
        );

      this.dwellProgress = clamp(
        this.dwellElapsed /
          dwellSeconds,
        0,
        1,
      );
    }

    for (
      const panel of
      this.panels
    ) {
      refreshPanel(
        panel,
        panel ===
          this.hoveredPanel,
        this._subtitle(panel),
      );
    }
  }

  dispose() {
    window.removeEventListener(
      'skyline:aircraft-changed',
      this._aircraftListener,
    );

    this._clearPanels();
    this.uiScene?.remove(this.root);
  }
}
