import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './config.js';

const DEG = Math.PI / 180;

const PHONE_DWELL_SECONDS = 1.25;
const PHONE_DANGER_DWELL_SECONDS = 1.65;
const PHONE_STABILITY_SECONDS = 0.18;

function angularDifference(a, b) {
  return Math.abs(
    Math.atan2(
      Math.sin(a - b),
      Math.cos(a - b),
    ),
  );
}

function createPanelTexture(
  definition,
  selected = false,
  progress = 0,
) {
  const canvas =
    document.createElement('canvas');

  canvas.width = 1024;
  canvas.height = 480;

  const context =
    canvas.getContext('2d');

  const danger =
    Boolean(definition.danger);

  const face =
    danger
      ? '#45221d'
      : selected
        ? '#5b553b'
        : '#292b25';

  const border =
    danger
      ? '#e18169'
      : selected
        ? '#ffe08a'
        : '#aaa078';

  context.fillStyle =
    'rgba(9, 10, 8, 0.98)';

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  context.fillStyle = face;

  context.fillRect(
    20,
    20,
    canvas.width - 40,
    canvas.height - 40,
  );

  context.strokeStyle = border;

  context.lineWidth =
    selected ? 13 : 7;

  context.strokeRect(
    25,
    25,
    canvas.width - 50,
    canvas.height - 50,
  );

  context.strokeStyle =
    'rgba(4, 5, 4, 0.9)';

  context.lineWidth = 4;

  context.strokeRect(
    48,
    48,
    canvas.width - 96,
    canvas.height - 96,
  );

  const bolts = [
    [65, 65],
    [canvas.width - 65, 65],
    [65, canvas.height - 65],
    [
      canvas.width - 65,
      canvas.height - 65,
    ],
  ];

  for (const [x, y] of bolts) {
    context.beginPath();

    context.arc(
      x,
      y,
      11,
      0,
      Math.PI * 2,
    );

    context.fillStyle =
      '#b9aa78';

    context.fill();

    context.strokeStyle =
      '#151611';

    context.lineWidth = 4;
    context.stroke();

    context.beginPath();

    context.moveTo(
      x - 7,
      y,
    );

    context.lineTo(
      x + 7,
      y,
    );

    context.stroke();
  }

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.fillStyle =
    selected
      ? '#fff2bc'
      : '#ebe3c5';

  context.font =
    '900 78px ui-monospace, Menlo, Consolas, monospace';

  context.fillText(
    definition.title,
    canvas.width / 2,
    definition.subtitle
      ? 190
      : 232,
    canvas.width - 170,
  );

  if (definition.subtitle) {
    context.fillStyle =
      selected
        ? '#f4d16f'
        : '#c7bb96';

    context.font =
      '700 38px ui-monospace, Menlo, Consolas, monospace';

    context.fillText(
      definition.subtitle,
      canvas.width / 2,
      292,
      canvas.width - 180,
    );
  }

  context.fillStyle =
    '#11120e';

  context.fillRect(
    135,
    390,
    canvas.width - 270,
    24,
  );

  if (progress > 0) {
    context.fillStyle =
      danger
        ? '#e26d58'
        : '#efca55';

    context.fillRect(
      135,
      390,
      (
        canvas.width - 270
      ) *
        clamp(
          progress,
          0,
          1,
        ),
      24,
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas,
    );

  texture.minFilter =
    THREE.LinearFilter;

  texture.magFilter =
    THREE.LinearFilter;

  texture.generateMipmaps =
    false;

  if (
    'colorSpace' in texture
    && THREE.SRGBColorSpace
  ) {
    texture.colorSpace =
      THREE.SRGBColorSpace;
  }

  return texture;
}

function createPanel(definition) {
  const geometry =
    new THREE.PlaneGeometry(
      definition.width || 0.92,
      definition.height || 0.42,
    );

  const material =
    new THREE.MeshBasicMaterial({
      map:
        createPanelTexture(
          definition,
        ),

      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

  const panel =
    new THREE.Mesh(
      geometry,
      material,
    );

  panel.renderOrder = 110;
  panel.frustumCulled = false;

  panel.userData.definition =
    definition;

  panel.userData.stateKey = '';

  return panel;
}

function updatePanelTexture(
  panel,
  selected,
  subtitle,
  progress,
) {
  const definition =
    panel.userData.definition;

  const stateKey = [
    selected,
    subtitle,
    Math.round(
      progress * 40,
    ),
  ].join('|');

  if (
    panel.userData.stateKey ===
    stateKey
  ) {
    return;
  }

  panel.userData.stateKey =
    stateKey;

  const previousTexture =
    panel.material.map;

  panel.material.map =
    createPanelTexture(
      {
        ...definition,
        subtitle,
      },

      selected,
      selected
        ? progress
        : 0,
    );

  panel.material.needsUpdate =
    true;

  previousTexture?.dispose?.();
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

    this.cameraName = 'COCKPIT';
    this.effectsName = 'STANDARD';
    this.aircraftName =
      'A6M ZERO';

    this.panels = [];
    this.hoveredPanel = null;

    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.stableElapsed = 0;
    this.activationLockout = 0;

    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._hasSmoothedLook = false;

    this._pointerYaw = 0;
    this._pointerPitch = 0;

    this._pointerMovedSinceOpen =
      false;

    this._hoverStartedAt = 0;
    this._requirePhoneExit = false;

    this.root =
      new THREE.Group();

    this.root.name =
      'skyline-wide-curved-vr-menu';

    this.root.visible = false;
    this.root.matrixAutoUpdate = true;

    this.uiScene.add(
      this.root,
    );

    this._onPointerMove =
      event => {
        if (
          !this.isOpen
          || this.input?.mode ===
            'phone'
        ) {
          return;
        }

        this._setPointerFromEvent(
          event,
        );

        this._pointerMovedSinceOpen =
          true;
      };

    this._onPointerDown =
      event => {
        if (
          !this.isOpen
          || this.input?.mode ===
            'phone'
          || event.button !== 0
        ) {
          return;
        }

        this._setPointerFromEvent(
          event,
        );

        this._pointerMovedSinceOpen =
          true;

        this._updateDesktopCandidate();

        const hoveredLongEnough =
          performance.now()
          - this._hoverStartedAt
          >= 100;

        if (
          this.hoveredPanel
          && hoveredLongEnough
          && this.activationLockout
            <= 0
        ) {
          event.preventDefault();

          this._activate(
            this.hoveredPanel,
          );
        }
      };

    this._onKeyDown =
      event => {
        if (
          !this.isOpen
          || this.input?.mode ===
            'phone'
        ) {
          return;
        }

        if (
          event.code === 'Enter'
          || event.code === 'Space'
        ) {
          if (
            this.hoveredPanel
            && this.activationLockout
              <= 0
          ) {
            event.preventDefault();

            this._activate(
              this.hoveredPanel,
            );
          }
        }
      };

    this._aircraftListener =
      event => {
        if (
          event?.detail?.name
        ) {
          this.aircraftName =
            event.detail.name;
        }
      };

    window.addEventListener(
      'pointermove',
      this._onPointerMove,
      {
        passive: true,
      },
    );

    window.addEventListener(
      'pointerdown',
      this._onPointerDown,
    );

    window.addEventListener(
      'keydown',
      this._onKeyDown,
    );

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
          yaw: -27,
          pitch: 3,
          depth: 2.38,
        },

        {
          id: 'aircraft',
          title: 'AIRCRAFT',
          subtitle:
            this.aircraftName,
          yaw: 0,
          pitch: 7,
          depth: 2.10,
          width: 1.02,
          height: 0.44,
        },

        {
          id: 'restart',
          title: 'RESTART',
          subtitle:
            'REBUILD WORLD',
          yaw: 27,
          pitch: 3,
          depth: 2.38,
          danger: true,
        },
      ];
    }

    return [
      {
        id: 'resume',
        title: 'RESUME',
        subtitle:
          'BACK TO FLIGHT',
        yaw: 0,
        pitch: 16,
        depth: 2.08,
        width: 1.06,
        height: 0.45,
      },

      {
        id: 'recenter',
        title: 'RECENTER',
        subtitle:
          'RESET HEAD NEUTRAL',
        yaw: -30,
        pitch: 1,
        depth: 2.48,
      },

      {
        id: 'aircraft',
        title: 'AIRCRAFT',
        subtitle:
          this.aircraftName,
        yaw: 30,
        pitch: 1,
        depth: 2.48,
      },

      {
        id: 'respawn',
        title: 'RESPAWN',
        subtitle:
          'START POSITION',
        yaw: -16,
        pitch: -18,
        depth: 2.38,
      },

      {
        id: 'restart',
        title: 'RESTART',
        subtitle:
          'REBUILD WORLD',
        yaw: 16,
        pitch: -18,
        depth: 2.38,
        danger: true,
      },
    ];
  }

  _clearPanels() {
    for (
      const panel of
      this.panels
    ) {
      this.root.remove(
        panel,
      );

      panel.geometry
        ?.dispose?.();

      panel.material
        ?.map
        ?.dispose?.();

      panel.material
        ?.dispose?.();
    }

    this.panels.length = 0;
  }

  _buildPanels() {
    this._clearPanels();

    for (
      const definition of
      this._definitions()
    ) {
      const panel =
        createPanel(
          definition,
        );

      const yaw =
        definition.yaw * DEG;

      const pitch =
        definition.pitch * DEG;

      const depth =
        definition.depth;

      const horizontal =
        Math.cos(pitch)
        * depth;

      panel.position.set(
        Math.sin(yaw)
          * horizontal,

        Math.sin(pitch)
          * depth,

        -Math.cos(yaw)
          * horizontal,
      );

      panel.lookAt(
        0,
        0,
        0,
      );

      panel.updateMatrixWorld(
        true,
      );

      this.root.add(
        panel,
      );

      this.panels.push(
        panel,
      );
    }

    this.root.updateMatrixWorld(
      true,
    );
  }

  _resetInteractionState() {
    this.hoveredPanel = null;

    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.stableElapsed = 0;

    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._hasSmoothedLook = false;

    this._pointerYaw = 0;
    this._pointerPitch = 0;

    this._pointerMovedSinceOpen =
      false;

    this._hoverStartedAt = 0;
    this._requirePhoneExit = false;
  }

  open(
    position,
    quaternion,
    crashMode = false,
  ) {
    this.root.visible = false;

    this._clearPanels();
    this._resetInteractionState();

    this.crashMode =
      Boolean(crashMode);

    this.activationLockout =
      0.32;

    this.root.matrixAutoUpdate =
      true;

    this.root.scale.set(
      1,
      1,
      1,
    );

    this.root.position.set(
      0,
      0,
      0,
    );

    this.root.rotation.set(
      0,
      0,
      0,
    );

    this.root.quaternion.identity();

    this.reanchor(
      position,
      quaternion,
    );

    this.input
      ?.beginMenuLook?.();

    this._buildPanels();

    this.isOpen = true;
    this.root.visible = true;

    document.body
      .classList
      .add('menu-open');

    this.root.updateMatrixWorld(
      true,
    );
  }

  close() {
    this.isOpen = false;
    this.root.visible = false;

    this._clearPanels();
    this._resetInteractionState();

    this.root.scale.set(
      1,
      1,
      1,
    );

    this.root.position.set(
      0,
      0,
      0,
    );

    this.root.rotation.set(
      0,
      0,
      0,
    );

    this.root.quaternion.identity();

    this.root.updateMatrixWorld(
      true,
    );

    document.body
      .classList
      .remove('menu-open');
  }

  reanchor(
    position,
    quaternion,
  ) {
    this.root.matrixAutoUpdate =
      true;

    this.root.scale.set(
      1,
      1,
      1,
    );

    if (
      position?.isVector3
    ) {
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

    if (
      quaternion?.isQuaternion
    ) {
      this.root.quaternion
        .copy(quaternion)
        .normalize();
    } else {
      this.root.quaternion
        .identity();
    }

    this.root.updateMatrix();
    this.root.updateMatrixWorld(
      true,
    );
  }

  _setPointerFromEvent(event) {
    const canvas =
      document.querySelector(
        '#game',
      );

    const rectangle =
      canvas
        ?.getBoundingClientRect
        ?.() ?? {
          left: 0,
          top: 0,
          width:
            window.innerWidth,
          height:
            window.innerHeight,
        };

    const normalizedX =
      clamp(
        (
          event.clientX
          - rectangle.left
        )
        / Math.max(
          1,
          rectangle.width,
        ),

        0,
        1,
      );

    const normalizedY =
      clamp(
        (
          event.clientY
          - rectangle.top
        )
        / Math.max(
          1,
          rectangle.height,
        ),

        0,
        1,
      );

    this._pointerYaw =
      (
        normalizedX - 0.5
      )
      * 76
      * DEG;

    this._pointerPitch =
      (
        0.5 - normalizedY
      )
      * 56
      * DEG;
  }

  _subtitle(panel) {
    const id =
      panel.userData
        .definition.id;

    if (
      id === 'aircraft'
    ) {
      return this.aircraftName;
    }

    return (
      panel.userData
        .definition.subtitle
      || ''
    );
  }

  _activate(panel) {
    const id =
      panel.userData
        .definition.id;

    let result;

    if (
      id === 'resume'
    ) {
      result =
        this.actions.resume?.();
    } else if (
      id === 'recenter'
    ) {
      this.input
        ?.recenter?.();

      result =
        this.actions
          .recenter?.();

      this._resetInteractionState();

      this.activationLockout =
        0.55;
    } else if (
      id === 'aircraft'
    ) {
      window.dispatchEvent(
        new CustomEvent(
          'skyline:aircraft-next',
        ),
      );
    } else if (
      id === 'respawn'
    ) {
      this.close();

      result =
        this.actions
          .respawn?.();
    } else if (
      id === 'restart'
    ) {
      this.close();

      result =
        this.actions
          .restart?.();
    }

    this.activationLockout =
      Math.max(
        this.activationLockout,
        0.68,
      );

    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.stableElapsed = 0;

    if (
      this.input?.mode ===
      'phone'
    ) {
      this._requirePhoneExit =
        true;
    }

    return result;
  }

  _candidateAt(
    yaw,
    pitch,
    phoneMode,
  ) {
    const selectionYaw = yaw;
    const selectionPitch = pitch;

    let candidate = null;
    let bestScore = Infinity;

    for (
      const panel of
      this.panels
    ) {
      const definition =
        panel.userData
          .definition;

      const continuing =
        panel ===
        this.hoveredPanel;

      const yawLimit =
        (
          phoneMode
            ? continuing
              ? 13
              : 11
            : continuing
              ? 10
              : 8.5
        )
        * DEG;

      const pitchLimit =
        (
          phoneMode
            ? continuing
              ? 10
              : 8
            : continuing
              ? 8
              : 6.5
        )
        * DEG;

      const yawDelta =
        angularDifference(
          selectionYaw,
          definition.yaw
            * DEG,
        );

      const pitchDelta =
        Math.abs(
          selectionPitch
          - definition.pitch
            * DEG,
        );

      if (
        yawDelta > yawLimit
        || pitchDelta >
          pitchLimit
      ) {
        continue;
      }

      const score =
        yawDelta / yawLimit
        + pitchDelta
          / pitchLimit;

      if (
        score < bestScore
      ) {
        bestScore = score;
        candidate = panel;
      }
    }

    return candidate;
  }

  _setCandidate(candidate) {
    if (
      candidate ===
      this.hoveredPanel
    ) {
      return;
    }

    this.hoveredPanel =
      candidate;

    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.stableElapsed = 0;

    this._hoverStartedAt =
      performance.now();

    if (!candidate) {
      this._requirePhoneExit =
        false;
    }
  }

  _updateDesktopCandidate() {
    if (
      !this._pointerMovedSinceOpen
    ) {
      this._setCandidate(
        null,
      );

      return;
    }

    this._setCandidate(
      this._candidateAt(
        this._pointerYaw,
        this._pointerPitch,
        false,
      ),
    );
  }

  update(dt) {
    if (!this.isOpen) {
      return;
    }

    const safeDt =
      clamp(
        dt || 0,
        0,
        0.1,
      );

    this.activationLockout =
      Math.max(
        0,
        this.activationLockout
        - safeDt,
      );

    const phoneMode =
      this.input?.mode ===
      'phone';

    if (!phoneMode) {
      this._updateDesktopCandidate();

      this.dwellElapsed = 0;
      this.dwellProgress = 0;
      this.stableElapsed = 0;
    } else {
      this.input
        ?.sampleMenuLook?.();

      const rawYaw =
        Number.isFinite(
          this.input
            ?.menuLook
            ?.yaw,
        )
          ? this.input.menuLook.yaw
          : 0;

      const rawPitch =
        Number.isFinite(
          this.input
            ?.menuLook
            ?.pitch,
        )
          ? this.input.menuLook.pitch
          : 0;

      const smoothing =
        1 -
        Math.exp(
          -safeDt / 0.10,
        );

      if (
        !this._hasSmoothedLook
      ) {
        this._smoothedYaw =
          rawYaw;

        this._smoothedPitch =
          rawPitch;

        this._hasSmoothedLook =
          true;
      } else {
        this._smoothedYaw +=
          (
            rawYaw
            - this._smoothedYaw
          )
          * smoothing;

        this._smoothedPitch +=
          (
            rawPitch
            - this._smoothedPitch
          )
          * smoothing;
      }

      const candidate =
        this._candidateAt(
          this._smoothedYaw,
          this._smoothedPitch,
          true,
        );

      this._setCandidate(
        candidate,
      );

      if (
        this.hoveredPanel
      ) {
        this.stableElapsed +=
          safeDt;
      } else {
        this.stableElapsed = 0;
      }

      const danger =
        Boolean(
          this.hoveredPanel
            ?.userData
            ?.definition
            ?.danger,
        );

      const dwellSeconds =
        danger
          ? PHONE_DANGER_DWELL_SECONDS
          : PHONE_DWELL_SECONDS;

      const stable =
        this.stableElapsed
        >= PHONE_STABILITY_SECONDS;

      if (
        this.hoveredPanel
        && stable
        && !this._requirePhoneExit
        && this.activationLockout
          <= 0
      ) {
        this.dwellElapsed +=
          safeDt;

        this.dwellProgress =
          clamp(
            this.dwellElapsed
            / dwellSeconds,

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
        this.dwellElapsed = 0;
        this.dwellProgress = 0;
      }
    }

    for (
      const panel of
      this.panels
    ) {
      updatePanelTexture(
        panel,

        panel ===
          this.hoveredPanel,

        this._subtitle(
          panel,
        ),

        phoneMode
        && panel ===
          this.hoveredPanel
          ? this.dwellProgress
          : 0,
      );
    }
  }

  dispose() {
    window.removeEventListener(
      'pointermove',
      this._onPointerMove,
    );

    window.removeEventListener(
      'pointerdown',
      this._onPointerDown,
    );

    window.removeEventListener(
      'keydown',
      this._onKeyDown,
    );

    window.removeEventListener(
      'skyline:aircraft-changed',
      this._aircraftListener,
    );

    document.body
      .classList
      .remove('menu-open');

    this._clearPanels();

    this.uiScene
      ?.remove(
        this.root,
      );
  }
}
