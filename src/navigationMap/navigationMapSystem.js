import * as THREE from '../../vendor/three.module.min.js';

import {
  createNavigationMapCatalog,
  distance2D,
  findNavigationTarget,
  formatNavigationDistance,
  worldToMapPixel,
} from './mapCatalog.js';

const MAP_WIDTH = 3.8;
const MAP_HEIGHT = 2.45;
const MAP_DEPTH = 2.6;

const PHONE_SCALE = 0.92;
const DESKTOP_SCALE = 1.08;

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;

const MAP_RECT = Object.freeze({
  x: 54,
  y: 108,
  width: 842,
  height: 720,
});

const LIST_X = 928;
const LIST_WIDTH = 414;
const LIST_TOP = 122;
const LIST_ROW_HEIGHT = 61;
const LIST_GAP = 8;

const COLORS = Object.freeze({
  background: '#101716',
  frame: '#b6a87a',
  panel: '#1b2421',
  panelAlt: '#222c28',
  land: '#2d3a31',
  legacy: '#485446',
  roadPrimary: '#d3bd79',
  roadSecondary: '#897f62',
  river: '#4b8497',
  lake: '#4b8497',
  text: '#f0e8c8',
  muted: '#a9a185',
  accent: '#ffcf5c',
  ping: '#ff4fa3',
  current: '#ffdf73',
  danger: '#c96154',
  hover: '#fff3bd',
});

function colorForKind(kind) {
  if (kind === 'airfield') return '#d5d2bd';
  if (kind === 'lake') return '#65a8ba';
  if (kind === 'mountain') return '#c2a979';
  if (kind === 'industrial') return '#b48765';
  if (kind === 'canyon') return '#c87854';
  if (kind === 'port') return '#7aa6a2';
  if (kind === 'urban') return '#d7c489';
  return '#d5c989';
}

function safeHeight(sampleHeight, x, z) {
  if (typeof sampleHeight !== 'function') return 0;
  try {
    const value = sampleHeight(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function makeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  if ('colorSpace' in texture && THREE.SRGBColorSpace) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function roundedRect(context, x, y, width, height, radius = 12) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawText(context, text, x, y, options = {}) {
  context.textAlign = options.align ?? 'left';
  context.textBaseline = options.baseline ?? 'alphabetic';
  context.font =
    `${options.weight ?? 700} ${options.size ?? 24}px ui-monospace, Menlo, Consolas, monospace`;
  context.fillStyle = options.color ?? COLORS.text;
  context.fillText(String(text ?? ''), x, y);
}

function drawArrow(context, x, y, dx, dy, size, color) {
  const length = Math.max(1e-5, Math.hypot(dx, dy));
  const nx = dx / length;
  const ny = dy / length;
  const px = -ny;
  const py = nx;

  context.beginPath();
  context.moveTo(x + nx * size, y + ny * size);
  context.lineTo(
    x - nx * size * 0.62 + px * size * 0.58,
    y - ny * size * 0.62 + py * size * 0.58,
  );
  context.lineTo(
    x - nx * size * 0.30,
    y - ny * size * 0.30,
  );
  context.lineTo(
    x - nx * size * 0.62 - px * size * 0.58,
    y - ny * size * 0.62 - py * size * 0.58,
  );
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

export class NavigationMapSystem {
  constructor({
    scene,
    uiScene,
    input,
    sampleHeight,
    onBack = null,
    onPing = null,
  } = {}) {
    if (!scene?.add || !uiScene?.add) {
      throw new TypeError('NavigationMapSystem requires scene and uiScene.');
    }

    this.scene = scene;
    this.uiScene = uiScene;
    this.input = input;
    this.sampleHeight = sampleHeight;
    this.onBack = onBack;
    this.onPing = onPing;

    this.catalog = createNavigationMapCatalog();
    this.isOpen = false;
    this.phoneMode = false;
    this.camera = null;

    this.playerPosition = new THREE.Vector3();
    this.playerVelocity = new THREE.Vector3(0, 0, -1);

    this._waypointDirection =
      new THREE.Vector3();
    this._cameraForward =
      new THREE.Vector3(0, 0, -1);

    this.ping = null;
    this.hoveredTarget = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.activationLockout = 0;

    this._smoothedYaw = 0;
    this._smoothedPitch = 0;
    this._hasSmoothedLook = false;
    this._pointerPoint = null;
    this._pointerMoved = false;
    this._gazePoint = null;
    this._drawAccumulator = 0;
    this._hudAccumulator = 0;
    this._pulseTime = 0;
    this._lastDrawKey = '';
    this._lastHudKey = '';
    this.hitTargets = [];

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.context = this.canvas.getContext('2d');

    this.texture = makeTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.root = new THREE.Group();
    this.root.name = 'skyline-vr-navigation-map';
    this.root.visible = false;

    this.mapPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
      this.material,
    );
    this.mapPlane.position.z = -MAP_DEPTH;
    this.mapPlane.renderOrder = 220;
    this.root.add(this.mapPlane);
    this.uiScene.add(this.root);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    this._createWaypointVisuals();

    this._onPointerMove = event => {
      if (!this.isOpen || this.phoneMode || !this.camera) return;

      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);

      this.pointerNdc.set(
        event.clientX / width * 2 - 1,
        1 - event.clientY / height * 2,
      );

      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      this.mapPlane.updateMatrixWorld(true);

      const hit = this.raycaster.intersectObject(this.mapPlane, false)[0];
      if (!hit?.uv) {
        this._pointerPoint = null;
        this._setHovered(null);
        return;
      }

      this._pointerPoint = {
        x: hit.uv.x * CANVAS_WIDTH,
        y: (1 - hit.uv.y) * CANVAS_HEIGHT,
      };
      this._pointerMoved = true;
      this._updateHoveredFromPoint(this._pointerPoint);
    };

    this._onPointerDown = event => {
      if (
        !this.isOpen ||
        this.phoneMode ||
        event.button !== 0 ||
        !this.hoveredTarget ||
        this.activationLockout > 0
      ) {
        return;
      }

      event.preventDefault();
      this._activateTarget(this.hoveredTarget);
    };

    this._onKeyDown = event => {
      if (!this.isOpen || this.phoneMode) return;

      if (event.code === 'Escape') {
        event.preventDefault();
        this._activateTarget({ type: 'back' });
      } else if (
        (event.code === 'Enter' || event.code === 'Space') &&
        this.hoveredTarget &&
        this.activationLockout <= 0
      ) {
        event.preventDefault();
        this._activateTarget(this.hoveredTarget);
      }
    };

    window.addEventListener('pointermove', this._onPointerMove, {
      passive: true,
    });
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);

    this._drawMap(true);
  }

  _createWaypointVisuals() {
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4fa3,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4fa3,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });

    this.beacon = new THREE.Group();
    this.beacon.name = 'navigation-map-world-ping';
    this.beacon.visible = false;

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 260, 10, 1, true),
      beamMaterial,
    );
    this.beam.position.y = 130;

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(34, 2.6, 6, 32),
      ringMaterial,
    );
    this.ring.rotation.x = Math.PI * 0.5;
    this.ring.position.y = 14;

    this.cap = new THREE.Mesh(
      new THREE.ConeGeometry(10, 26, 8),
      ringMaterial,
    );
    this.cap.position.y = 270;
    this.cap.rotation.z = Math.PI;

    this.beacon.add(this.beam, this.ring, this.cap);
    this.scene.add(this.beacon);

    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 900;
    this.hudCanvas.height = 180;
    this.hudContext = this.hudCanvas.getContext('2d');
    this.hudTexture = makeTexture(this.hudCanvas);
    this.hudMaterial = new THREE.MeshBasicMaterial({
      map: this.hudTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.hudRoot = new THREE.Group();
    this.hudRoot.name = 'navigation-map-waypoint-hud';
    this.hudRoot.visible = false;

    this.hudPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.144),
      this.hudMaterial,
    );
    this.hudPlane.renderOrder = 225;
    this.hudPlane.frustumCulled = false;
    this.hudRoot.frustumCulled = false;
    this.hudRoot.add(this.hudPlane);
    this.uiScene.add(this.hudRoot);
  }

  setManifest(manifest) {
    this.catalog = createNavigationMapCatalog(manifest);
    this._lastDrawKey = '';
    this._drawMap(true);
    return this.catalog;
  }

  setPhoneMode(value) {
    this.phoneMode = Boolean(value);
    if (this.isOpen) {
      const scale = this.phoneMode ? PHONE_SCALE : DESKTOP_SCALE;
      this.root.scale.setScalar(scale);
      this._lastDrawKey = '';
      this._drawMap(true);
    }
    return this.phoneMode;
  }

  open({
    position,
    quaternion,
    camera,
    phoneMode = this.phoneMode,
    playerPosition,
    velocity,
    lookReference = 'current',
  } = {}) {
    this.phoneMode = Boolean(phoneMode);
    this.camera = camera ?? this.camera;

    if (position?.isVector3) this.root.position.copy(position);
    if (quaternion?.isQuaternion) this.root.quaternion.copy(quaternion);

    const scale = this.phoneMode ? PHONE_SCALE : DESKTOP_SCALE;
    this.root.scale.setScalar(scale);
    this.root.visible = true;
    this.root.updateMatrixWorld(true);

    this.isOpen = true;
    this.hoveredTarget = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this.activationLockout = 0.28;
    this._hasSmoothedLook = false;
    this._pointerMoved = false;
    this._pointerPoint = null;

    if (playerPosition?.isVector3) {
      this.playerPosition.copy(playerPosition);
    }
    if (velocity?.isVector3) {
      this.playerVelocity.copy(velocity);
    }

    document.body.classList.add('menu-open');
    this.input?.beginMenuLook?.(
      lookReference
    );

    this._lastDrawKey = '';
    this._drawMap(true);
  }

  close() {
    this.isOpen = false;
    this.root.visible = false;
    this.hoveredTarget = null;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this._pointerPoint = null;
    this._gazePoint = null;
    document.body.classList.remove('menu-open');
  }

  clearPing() {
    this.ping = null;
    this.beacon.visible = false;
    this.hudRoot.visible = false;
    this._lastDrawKey = '';
    this._lastHudKey = '';
    this._drawMap(true);
  }

  pingById(id) {
    const destination = this.catalog.destinations.find(
      item => item.id === id
    );
    if (!destination) return false;
    this._setPing(destination);
    return true;
  }

  _setPing(destination) {
    this.ping = destination;

    const [x, z] = destination.position;
    const y = safeHeight(this.sampleHeight, x, z);

    this.beacon.position.set(x, y, z);
    this.beacon.visible = true;
    this._lastDrawKey = '';
    this._lastHudKey = '';
  }

  _setHovered(target) {
    const previous =
      this.hoveredTarget?.id ??
      this.hoveredTarget?.type ??
      null;

    const next =
      target?.id ??
      target?.type ??
      null;

    if (previous === next) return;

    this.hoveredTarget = target;
    this.dwellElapsed = 0;
    this.dwellProgress = 0;
    this._lastDrawKey = '';
  }

  _updateHoveredFromPoint(point) {
    this._setHovered(
      findNavigationTarget(this.hitTargets, point)
    );
  }

  _activateTarget(target) {
    if (!target) return;

    if (target.type === 'back') {
      this.close();
      this.onBack?.();
      return;
    }

    if (target.type === 'clear') {
      this.clearPing();
      this.activationLockout = 0.55;
      this._setHovered(null);
      return;
    }

    if (target.type === 'destination' && target.destination) {
      this._setPing(target.destination);
      const destination = target.destination;
      this.close();
      this.onPing?.(destination);
    }
  }

  _pointFromPhoneLook(dt) {
    this.input?.sampleMenuLook?.();

    const rawYaw =
      Number.isFinite(this.input?.menuLook?.yaw)
        ? this.input.menuLook.yaw
        : 0;
    const rawPitch =
      Number.isFinite(this.input?.menuLook?.pitch)
        ? this.input.menuLook.pitch
        : 0;

    const blend = 1 - Math.exp(-Math.max(0, dt) / 0.12);

    if (!this._hasSmoothedLook) {
      this._smoothedYaw = rawYaw;
      this._smoothedPitch = rawPitch;
      this._hasSmoothedLook = true;
    } else {
      this._smoothedYaw +=
        (rawYaw - this._smoothedYaw) * blend;
      this._smoothedPitch +=
        (rawPitch - this._smoothedPitch) * blend;
    }

    const localX = Math.tan(this._smoothedYaw) * MAP_DEPTH;
    const localY = Math.tan(this._smoothedPitch) * MAP_DEPTH;

    const u = localX / MAP_WIDTH + 0.5;
    const v = 0.5 - localY / MAP_HEIGHT;

    if (u < 0 || u > 1 || v < 0 || v > 1) return null;

    return {
      x: u * CANVAS_WIDTH,
      y: v * CANVAS_HEIGHT,
    };
  }

  _drawWorldLayer(context) {
    const catalog = this.catalog;

    context.save();
    roundedRect(
      context,
      MAP_RECT.x,
      MAP_RECT.y,
      MAP_RECT.width,
      MAP_RECT.height,
      16,
    );
    context.clip();

    context.fillStyle = COLORS.land;
    context.fillRect(
      MAP_RECT.x,
      MAP_RECT.y,
      MAP_RECT.width,
      MAP_RECT.height,
    );

    for (const region of catalog.regions) {
      const center = worldToMapPixel(
        region.center,
        catalog.bounds,
        MAP_RECT,
      );

      const edge = worldToMapPixel(
        [
          region.center[0] + region.radius[0],
          region.center[1] + region.radius[1],
        ],
        catalog.bounds,
        MAP_RECT,
      );

      const radiusX = Math.abs(edge.x - center.x);
      const radiusY = Math.abs(edge.y - center.y);

      context.beginPath();
      context.ellipse(
        center.x,
        center.y,
        radiusX,
        radiusY,
        0,
        0,
        Math.PI * 2,
      );
      context.fillStyle =
        region.kind.includes('mountain')
          ? 'rgba(166, 145, 102, .13)'
          : region.kind.includes('coastal')
            ? 'rgba(78, 126, 132, .12)'
            : region.kind.includes('industrial')
              ? 'rgba(143, 103, 78, .12)'
              : 'rgba(117, 142, 112, .10)';
      context.fill();
    }

    const legacyMin = worldToMapPixel(
      [
        catalog.legacyCoreBounds.minX,
        catalog.legacyCoreBounds.minZ,
      ],
      catalog.bounds,
      MAP_RECT,
    );

    const legacyMax = worldToMapPixel(
      [
        catalog.legacyCoreBounds.maxX,
        catalog.legacyCoreBounds.maxZ,
      ],
      catalog.bounds,
      MAP_RECT,
    );

    const legacyX = Math.min(legacyMin.x, legacyMax.x);
    const legacyY = Math.min(legacyMin.y, legacyMax.y);
    const legacyW = Math.abs(legacyMax.x - legacyMin.x);
    const legacyH = Math.abs(legacyMax.y - legacyMin.y);

    context.fillStyle = 'rgba(203, 199, 157, .07)';
    context.fillRect(legacyX, legacyY, legacyW, legacyH);
    context.setLineDash([8, 8]);
    context.strokeStyle = 'rgba(221, 211, 172, .35)';
    context.lineWidth = 2;
    context.strokeRect(legacyX, legacyY, legacyW, legacyH);
    context.setLineDash([]);

    const gridStep = 2048;
    context.strokeStyle = 'rgba(218, 218, 188, .07)';
    context.lineWidth = 1;

    for (
      let x = Math.ceil(catalog.bounds.minX / gridStep) * gridStep;
      x <= catalog.bounds.maxX;
      x += gridStep
    ) {
      const a = worldToMapPixel(
        [x, catalog.bounds.minZ],
        catalog.bounds,
        MAP_RECT,
      );
      const b = worldToMapPixel(
        [x, catalog.bounds.maxZ],
        catalog.bounds,
        MAP_RECT,
      );
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    for (
      let z = Math.ceil(catalog.bounds.minZ / gridStep) * gridStep;
      z <= catalog.bounds.maxZ;
      z += gridStep
    ) {
      const a = worldToMapPixel(
        [catalog.bounds.minX, z],
        catalog.bounds,
        MAP_RECT,
      );
      const b = worldToMapPixel(
        [catalog.bounds.maxX, z],
        catalog.bounds,
        MAP_RECT,
      );
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    for (const river of catalog.rivers) {
      context.beginPath();
      river.points.forEach((point, index) => {
        const mapped = worldToMapPixel(
          point,
          catalog.bounds,
          MAP_RECT,
        );
        if (index === 0) context.moveTo(mapped.x, mapped.y);
        else context.lineTo(mapped.x, mapped.y);
      });
      context.strokeStyle = COLORS.river;
      context.lineWidth = 4;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }

    for (const lake of catalog.lakes) {
      const center = worldToMapPixel(
        lake.center,
        catalog.bounds,
        MAP_RECT,
      );
      const edge = worldToMapPixel(
        [
          lake.center[0] + lake.radius[0],
          lake.center[1] + lake.radius[1],
        ],
        catalog.bounds,
        MAP_RECT,
      );

      context.beginPath();
      context.ellipse(
        center.x,
        center.y,
        Math.abs(edge.x - center.x),
        Math.abs(edge.y - center.y),
        0,
        0,
        Math.PI * 2,
      );
      context.fillStyle = 'rgba(75, 132, 151, .74)';
      context.fill();
    }

    for (const road of catalog.roads) {
      context.beginPath();
      road.points.forEach((point, index) => {
        const mapped = worldToMapPixel(
          point,
          catalog.bounds,
          MAP_RECT,
        );
        if (index === 0) context.moveTo(mapped.x, mapped.y);
        else context.lineTo(mapped.x, mapped.y);
      });
      context.strokeStyle =
        road.class === 'primary'
          ? COLORS.roadPrimary
          : COLORS.roadSecondary;
      context.lineWidth =
        road.class === 'primary'
          ? 3.3
          : road.class === 'secondary'
            ? 2.1
            : 1.4;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }

    this.hitTargets = [];

    for (const destination of catalog.destinations) {
      const mapped = worldToMapPixel(
        destination.position,
        catalog.bounds,
        MAP_RECT,
      );

      const isPing = this.ping?.id === destination.id;
      const isHover =
        this.hoveredTarget?.id === destination.id;

      context.beginPath();
      context.arc(
        mapped.x,
        mapped.y,
        isPing ? 11 : 8,
        0,
        Math.PI * 2,
      );
      context.fillStyle =
        isPing
          ? COLORS.ping
          : colorForKind(destination.kind);
      context.fill();

      context.lineWidth = isPing ? 5 : isHover ? 3 : 1.5;
      context.strokeStyle =
        isPing
          ? COLORS.ping
          : isHover
            ? COLORS.hover
            : 'rgba(10, 15, 12, .75)';
      context.stroke();

      if (isPing) {
        context.beginPath();
        context.arc(
          mapped.x,
          mapped.y,
          17,
          0,
          Math.PI * 2,
        );
        context.strokeStyle = COLORS.ping;
        context.lineWidth = 2;
        context.stroke();
      }

      this.hitTargets.push({
        id: destination.id,
        type: 'destination',
        destination,
        rect: {
          x: mapped.x - 17,
          y: mapped.y - 17,
          width: 34,
          height: 34,
        },
      });
    }

    const current = worldToMapPixel(
      [this.playerPosition.x, this.playerPosition.z],
      catalog.bounds,
      MAP_RECT,
    );

    const vx = this.playerVelocity.x;
    const vz = this.playerVelocity.z;
    const length = Math.max(1e-5, Math.hypot(vx, vz));

    drawArrow(
      context,
      current.x,
      current.y,
      vx / length,
      -vz / length,
      16,
      COLORS.current,
    );

    context.restore();

    context.strokeStyle = COLORS.frame;
    context.lineWidth = 3;
    roundedRect(
      context,
      MAP_RECT.x,
      MAP_RECT.y,
      MAP_RECT.width,
      MAP_RECT.height,
      16,
    );
    context.stroke();

    drawText(
      context,
      'YOU',
      current.x,
      current.y - 22,
      {
        align: 'center',
        size: 17,
        color: COLORS.current,
        weight: 900,
      },
    );
  }

  _drawDestinationList(context) {
    this.catalog.destinations.forEach((destination, index) => {
      const y =
        LIST_TOP +
        index * (LIST_ROW_HEIGHT + LIST_GAP);

      const rect = {
        x: LIST_X,
        y,
        width: LIST_WIDTH,
        height: LIST_ROW_HEIGHT,
      };

      const isHover =
        this.hoveredTarget?.id === destination.id;
      const isPing = this.ping?.id === destination.id;

      roundedRect(
        context,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        10,
      );

      context.fillStyle =
        isHover
          ? '#3b4336'
          : isPing
            ? '#3d3a27'
            : index % 2
              ? COLORS.panelAlt
              : COLORS.panel;
      context.fill();

      context.strokeStyle =
        isPing
          ? COLORS.accent
          : isHover
            ? COLORS.hover
            : 'rgba(182, 168, 122, .34)';
      context.lineWidth = isPing || isHover ? 3 : 1.4;
      context.stroke();

      context.beginPath();
      context.arc(
        rect.x + 25,
        rect.y + rect.height * 0.5,
        8,
        0,
        Math.PI * 2,
      );
      context.fillStyle = colorForKind(destination.kind);
      context.fill();

      drawText(
        context,
        destination.label,
        rect.x + 45,
        rect.y + 25,
        {
          size: 21,
          weight: 900,
          color: isHover ? COLORS.hover : COLORS.text,
        },
      );

      drawText(
        context,
        destination.subtitle,
        rect.x + 45,
        rect.y + 47,
        {
          size: 14,
          weight: 700,
          color: COLORS.muted,
        },
      );

      const distance = distance2D(
        this.playerPosition,
        destination.position,
      );

      drawText(
        context,
        formatNavigationDistance(distance),
        rect.x + rect.width - 14,
        rect.y + 35,
        {
          align: 'right',
          size: 17,
          weight: 900,
          color: isPing ? COLORS.ping : COLORS.muted,
        },
      );

      if (
        isHover &&
        this.dwellProgress > 0 &&
        this.phoneMode
      ) {
        context.fillStyle = 'rgba(11, 15, 12, .86)';
        context.fillRect(
          rect.x + 10,
          rect.y + rect.height - 7,
          rect.width - 20,
          4,
        );
        context.fillStyle = COLORS.accent;
        context.fillRect(
          rect.x + 10,
          rect.y + rect.height - 7,
          (rect.width - 20) * this.dwellProgress,
          4,
        );
      }

      this.hitTargets.push({
        id: destination.id,
        type: 'destination',
        destination,
        rect,
      });
    });
  }

  _drawButtons(context) {
    const back = {
      type: 'back',
      rect: {
        x: LIST_X,
        y: 815,
        width: 196,
        height: 55,
      },
    };

    const clear = {
      type: 'clear',
      rect: {
        x: LIST_X + 218,
        y: 815,
        width: 196,
        height: 55,
      },
    };

    for (const target of [back, clear]) {
      const hovered =
        this.hoveredTarget?.type === target.type;

      roundedRect(
        context,
        target.rect.x,
        target.rect.y,
        target.rect.width,
        target.rect.height,
        10,
      );
      context.fillStyle =
        hovered ? '#474331' : COLORS.panel;
      context.fill();
      context.strokeStyle =
        hovered ? COLORS.hover : COLORS.frame;
      context.lineWidth = hovered ? 3 : 1.6;
      context.stroke();

      drawText(
        context,
        target.type === 'back'
          ? 'BACK'
          : 'CLEAR PING',
        target.rect.x + target.rect.width * 0.5,
        target.rect.y + 35,
        {
          align: 'center',
          size: 20,
          weight: 900,
          color:
            target.type === 'clear' && !this.ping
              ? '#706c5b'
              : COLORS.text,
        },
      );

      this.hitTargets.push(target);
    }
  }

  _drawMap(force = false) {
    if (!this.context) return;

    const progressBucket =
      Math.round(this.dwellProgress * 12);

    const key = [
      this.catalog.worldId,
      this.phoneMode,
      this.ping?.id ?? '',
      this.hoveredTarget?.id ??
        this.hoveredTarget?.type ??
        '',
      progressBucket,
      Math.round(this.playerPosition.x / 30),
      Math.round(this.playerPosition.z / 30),
      Math.round(this.playerVelocity.x / 5),
      Math.round(this.playerVelocity.z / 5),
      Math.round((this._gazePoint?.x ?? -1) / 8),
      Math.round((this._gazePoint?.y ?? -1) / 8),
    ].join('|');

    if (!force && key === this._lastDrawKey) return;
    this._lastDrawKey = key;

    const context = this.context;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    context.strokeStyle = COLORS.frame;
    context.lineWidth = 5;
    context.strokeRect(14, 14, CANVAS_WIDTH - 28, CANVAS_HEIGHT - 28);

    drawText(
      context,
      'SKYLINE NAVIGATION MAP',
      54,
      63,
      {
        size: 34,
        weight: 900,
        color: COLORS.text,
      },
    );

    drawText(
      context,
      this.phoneMode
        ? 'LOOK AT A DESTINATION TO PING'
        : 'CLICK A DESTINATION TO PING',
      CANVAS_WIDTH - 58,
      62,
      {
        align: 'right',
        size: 19,
        weight: 800,
        color: COLORS.accent,
      },
    );

    this._drawWorldLayer(context);
    this._drawDestinationList(context);
    this._drawButtons(context);

    if (
      this.phoneMode &&
      this._gazePoint
    ) {
      const x = this._gazePoint.x;
      const y = this._gazePoint.y;

      context.beginPath();
      context.arc(x, y, 16, 0, Math.PI * 2);
      context.fillStyle = 'rgba(8, 10, 9, .78)';
      context.fill();
      context.strokeStyle = COLORS.ping;
      context.lineWidth = 5;
      context.stroke();

      context.beginPath();
      context.moveTo(x - 9, y);
      context.lineTo(x + 9, y);
      context.moveTo(x, y - 9);
      context.lineTo(x, y + 9);
      context.strokeStyle = COLORS.hover;
      context.lineWidth = 2;
      context.stroke();
    }

    drawText(
      context,
      'N',
      MAP_RECT.x + MAP_RECT.width - 24,
      MAP_RECT.y + 32,
      {
        align: 'center',
        size: 22,
        weight: 900,
        color: COLORS.text,
      },
    );

    context.beginPath();
    context.moveTo(
      MAP_RECT.x + MAP_RECT.width - 24,
      MAP_RECT.y + 42,
    );
    context.lineTo(
      MAP_RECT.x + MAP_RECT.width - 24,
      MAP_RECT.y + 66,
    );
    context.strokeStyle = COLORS.text;
    context.lineWidth = 3;
    context.stroke();

    drawText(
      context,
      'DASHED BOX = ORIGINAL WORLD',
      MAP_RECT.x + 16,
      MAP_RECT.y + MAP_RECT.height - 16,
      {
        size: 15,
        weight: 700,
        color: COLORS.muted,
      },
    );

    this.texture.needsUpdate = true;
  }

  _drawHud(bearing, distance) {
    if (!this.hudContext || !this.ping) return;

    const direction =
      bearing < -0.10
        ? 'LEFT'
        : bearing > 0.10
          ? 'RIGHT'
          : 'AHEAD';

    const key = [
      this.ping.id,
      direction,
      Math.round(distance / 50),
    ].join('|');

    if (key === this._lastHudKey) return;
    this._lastHudKey = key;

    const context = this.hudContext;
    context.clearRect(
      0,
      0,
      this.hudCanvas.width,
      this.hudCanvas.height,
    );

    roundedRect(context, 12, 14, 876, 152, 22);
    context.fillStyle = 'rgba(14, 20, 18, .82)';
    context.fill();
    context.strokeStyle = COLORS.ping;
    context.lineWidth = 5;
    context.stroke();

    drawArrow(
      context,
      90,
      90,
      bearing < -0.10 ? -1 : bearing > 0.10 ? 1 : 0,
      bearing < -0.10 || bearing > 0.10 ? 0 : -1,
      34,
      COLORS.ping,
    );

    drawText(
      context,
      this.ping.label,
      150,
      77,
      {
        size: 35,
        weight: 900,
        color: COLORS.text,
      },
    );

    drawText(
      context,
      `${direction} · ${formatNavigationDistance(distance)}`,
      150,
      122,
      {
        size: 25,
        weight: 800,
        color: COLORS.accent,
      },
    );

    this.hudTexture.needsUpdate = true;
  }

  _updateWaypoint(dt, {
    camera,
    active,
  }) {
    this._pulseTime += Math.max(0, dt);

    if (!this.ping) {
      this.beacon.visible = false;
      this.hudRoot.visible = false;
      return;
    }

    const [x, z] = this.ping.position;
    const ground = safeHeight(this.sampleHeight, x, z);
    this.beacon.position.set(x, ground, z);
    this.beacon.visible = true;

    const pulse = 1 + Math.sin(this._pulseTime * 3.2) * 0.12;
    this.ring.scale.setScalar(pulse);
    this.cap.position.y =
      270 + Math.sin(this._pulseTime * 2.2) * 7;

    const distance = distance2D(
      this.playerPosition,
      this.ping.position,
    );

    const worldScale =
      Math.max(0.8, Math.min(3.2, distance / 1800));
    this.beacon.scale.setScalar(worldScale);

    if (
      !active ||
      this.isOpen ||
      !camera?.position ||
      !camera?.quaternion
    ) {
      this.hudRoot.visible = false;
      return;
    }

    /*
     * Use horizontal bearing only. Aircraft pitch and roll must not push the
     * navigation indicator sideways or behind the headset.
     */
    this._waypointDirection.set(
      x - this.playerPosition.x,
      0,
      z - this.playerPosition.z,
    );

    if (
      this._waypointDirection.lengthSq() >
      1e-6
    ) {
      this._waypointDirection.normalize();
    } else {
      this._waypointDirection.set(0, 0, -1);
    }

    camera.getWorldDirection(
      this._cameraForward
    );

    this._cameraForward.y = 0;

    if (
      this._cameraForward.lengthSq() >
      1e-6
    ) {
      this._cameraForward.normalize();
    } else {
      this._cameraForward.set(0, 0, -1);
    }

    const cross =
      this._cameraForward.x *
        this._waypointDirection.z -
      this._cameraForward.z *
        this._waypointDirection.x;

    const dot =
      this._cameraForward.x *
        this._waypointDirection.x +
      this._cameraForward.z *
        this._waypointDirection.z;

    const bearing =
      Math.atan2(cross, dot);

    const clamped =
      Math.max(-0.82, Math.min(0.82, bearing));

    this.hudRoot.visible = true;
    this.hudRoot.position.copy(camera.position);
    this.hudRoot.quaternion.copy(camera.quaternion);

    /*
     * This is intentionally a small indicator on phone VR, always constrained
     * to the comfortable central view. The parent follows the headset pose;
     * the panel itself stays front-facing and never uses a world-origin lookAt.
     */
    const radius =
      this.phoneMode ? 0.82 : 0.96;

    const horizontal =
      this.phoneMode ? 0.31 : 0.48;

    this.hudPlane.position.set(
      Math.sin(clamped) * horizontal,
      this.phoneMode ? 0.27 : 0.31,
      -Math.cos(clamped) * radius,
    );

    this.hudPlane.quaternion.identity();
    this.hudPlane.scale.setScalar(
      this.phoneMode ? 0.62 : 0.82
    );

    this._hudAccumulator += dt;
    if (this._hudAccumulator >= 0.16) {
      this._hudAccumulator = 0;
      this._drawHud(bearing, distance);
    }
  }

  update(dt, {
    camera,
    playerPosition,
    velocity,
    active = false,
    phoneMode = this.phoneMode,
  } = {}) {
    const safeDt =
      Math.max(0, Math.min(0.1, Number(dt) || 0));

    this.phoneMode = Boolean(phoneMode);
    this.camera = camera ?? this.camera;

    if (playerPosition?.isVector3) {
      this.playerPosition.copy(playerPosition);
    }

    if (velocity?.isVector3) {
      this.playerVelocity.copy(velocity);
    }

    this._updateWaypoint(safeDt, {
      camera: this.camera,
      active,
    });

    if (!this.isOpen) return;

    this.activationLockout =
      Math.max(0, this.activationLockout - safeDt);

    if (this.phoneMode) {
      const point = this._pointFromPhoneLook(safeDt);
      this._gazePoint = point;
      this._updateHoveredFromPoint(point);

      if (
        this.hoveredTarget &&
        this.activationLockout <= 0
      ) {
        this.dwellElapsed += safeDt;
        this.dwellProgress =
          Math.max(
            0,
            Math.min(1, this.dwellElapsed / 1.05)
          );

        if (this.dwellProgress >= 1) {
          this._activateTarget(this.hoveredTarget);
          return;
        }
      } else {
        this.dwellElapsed = 0;
        this.dwellProgress = 0;
      }
    } else if (!this._pointerMoved) {
      this._setHovered(null);
    }

    this._drawAccumulator += safeDt;
    if (this._drawAccumulator >= 0.05) {
      this._drawAccumulator = 0;
      this._drawMap();
    }
  }

  getStatus() {
    return {
      open: this.isOpen,
      phoneMode: this.phoneMode,
      destinationCount:
        this.catalog.destinations.length,
      roadCount:
        this.catalog.roads.length,
      riverCount:
        this.catalog.rivers.length,
      lakeCount:
        this.catalog.lakes.length,
      ping:
        this.ping
          ? {
              id: this.ping.id,
              label: this.ping.label,
              position: [...this.ping.position],
              distanceMeters:
                distance2D(
                  this.playerPosition,
                  this.ping.position,
                ),
            }
          : null,
      ownsAnimationLoop: false,
      playerPosition: [
        this.playerPosition.x,
        this.playerPosition.y,
        this.playerPosition.z,
      ],
    };
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

    this.close();

    this.uiScene.remove(this.root);
    this.uiScene.remove(this.hudRoot);
    this.scene.remove(this.beacon);

    this.mapPlane.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();

    this.hudPlane.geometry.dispose();
    this.hudMaterial.dispose();
    this.hudTexture.dispose();

    for (const child of this.beacon.children) {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }
}

export function createNavigationMapSystem(options) {
  return new NavigationMapSystem(options);
}
