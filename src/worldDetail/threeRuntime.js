import * as THREE from '../../vendor/three.module.min.js';
import { applyBudgetToLayout, layoutObjectCount } from './layout.js';
import { resolveDetailBudget } from './budget.js';
import { clamp, damp } from './math.js';
import { SafeSubsystemRegistry } from './safeRegistry.js';
import { AdaptiveDetailGovernor } from './runtimeMetrics.js';
import { WorldDetailResourcePool } from './resourcePool.js';
import { SAFETY_CONTRACT } from './constants.js';

const DUMMY = new THREE.Object3D();
const DAY_CLOUD_NEAR = new THREE.Color(0xd7dde0);
const NIGHT_CLOUD_NEAR = new THREE.Color(0x596675);
const TWILIGHT_CLOUD_NEAR = new THREE.Color(0xb6998c);
const DAY_CLOUD_FAR = new THREE.Color(0xbfc9ce);
const NIGHT_CLOUD_FAR = new THREE.Color(0x354453);
const TWILIGHT_CLOUD_FAR = new THREE.Color(0x907f7a);

function applyInstance(mesh, index, descriptor) {
  DUMMY.position.set(
    Number(descriptor.x) || 0,
    Number(descriptor.y) || 0,
    Number(descriptor.z) || 0,
  );
  DUMMY.rotation.set(
    Number(descriptor.rotationX) || 0,
    Number(descriptor.rotationY ?? descriptor.heading) || 0,
    Number(descriptor.rotationZ) || 0,
    'XYZ',
  );
  DUMMY.scale.set(
    Math.max(0.0001, Number(descriptor.width ?? descriptor.radius) || 1),
    Math.max(0.0001, Number(descriptor.height ?? descriptor.radius) || 1),
    Math.max(0.0001, Number(descriptor.depth ?? descriptor.length) || 1),
  );
  DUMMY.updateMatrix();
  mesh.setMatrixAt(index, DUMMY.matrix);
}

function createInstanced(root, geometry, material, capacity, name) {
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    Math.max(1, Math.floor(capacity) || 1),
  );
  mesh.name = name;
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = true;
  mesh.userData.skylineWorldDetailOwned = true;
  root.add(mesh);
  return mesh;
}

function fillInstanced(mesh, descriptors, map = value => value) {
  const count = Math.min(mesh.instanceMatrix.count, descriptors.length);
  mesh.count = count;
  for (let index = 0; index < count; index += 1) {
    applyInstance(mesh, index, map(descriptors[index], index));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere?.();
  return count;
}

function directDistance(camera, center) {
  const position = camera?.position;
  if (!position) return 0;
  return Math.hypot(
    (Number(position.x) || 0) - center.x,
    (Number(position.z) || 0) - center.z,
  );
}

function groupRoot(parent, name) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.skylineWorldDetailOwned = true;
  parent.add(group);
  return group;
}

function disposeGroup(parent, group) {
  parent?.remove?.(group);
}

function createCityDetailSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-city-district-layer');
  const windowGroup = groupRoot(group, 'world-detail-actual-window-layer');
  const roofGroup = groupRoot(group, 'world-detail-rooftop-layer');
  const infillGroup = groupRoot(group, 'world-detail-infill-district-layer');
  const box = pool.geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const windowBox = pool.geometry('actual-window-box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = pool.geometry('industrial-cylinder', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12));
  const sphere = pool.geometry('rooftop-beacon', () => new THREE.SphereGeometry(0.5, 7, 5));
  const highWindowCapacity = Math.ceil(
    layout.city.windows.length * resolveDetailBudget('high', false).cityWindowFraction,
  ) + 32;

  const litWindows = createInstanced(
    windowGroup,
    windowBox,
    pool.material('windowLit'),
    highWindowCapacity,
    'actual-lit-window-panes',
  );
  const unlitWindows = createInstanced(
    windowGroup,
    windowBox,
    pool.material('windowOff'),
    highWindowCapacity,
    'actual-unlit-window-panes',
  );
  const roofServiceBoxes = createInstanced(
    roofGroup,
    box,
    pool.material('roof'),
    layout.city.rooftops.length,
    'authored-city-rooftop-service-boxes',
  );
  const antennas = createInstanced(
    roofGroup,
    cylinder,
    pool.material('steel'),
    layout.city.rooftops.length,
    'authored-city-rooftop-antennas',
  );
  const beacons = createInstanced(
    roofGroup,
    sphere,
    pool.material('navigationLamp'),
    layout.city.rooftops.length,
    'actual-rooftop-navigation-beacons',
  );
  const residential = createInstanced(
    infillGroup,
    box,
    pool.material('residentialFacade'),
    layout.city.residentialInfill.length,
    'residential-district-infill',
  );
  const industrialBoxes = createInstanced(
    infillGroup,
    box,
    pool.material('industrialFacade'),
    layout.city.industrialInfill.length,
    'industrial-district-buildings',
  );
  const industrialTanks = createInstanced(
    infillGroup,
    cylinder,
    pool.material('steel'),
    layout.city.industrialInfill.length,
    'industrial-district-tanks',
  );
  const industrialStacks = createInstanced(
    infillGroup,
    cylinder,
    pool.material('steel'),
    layout.city.industrialInfill.length,
    'industrial-district-smokestacks',
  );
  const residentialRoofs = createInstanced(
    infillGroup,
    box,
    pool.material('roof'),
    layout.city.residentialInfill.length,
    'residential-roofline',
  );
  const industrialRoofs = createInstanced(
    infillGroup,
    box,
    pool.material('roof'),
    layout.city.industrialInfill.length,
    'industrial-roofline',
  );

  function setBudget(budgeted) {
    fillInstanced(litWindows, budgeted.city.litWindows);
    fillInstanced(unlitWindows, budgeted.city.unlitWindows);
    const service = budgeted.city.rooftops.filter(item => item.kind !== 'antenna-base');
    const antennaItems = budgeted.city.rooftops.filter(item => item.kind === 'antenna-base');
    fillInstanced(roofServiceBoxes, service);
    fillInstanced(antennas, antennaItems, item => ({
      ...item,
      width: Math.max(0.35, item.width * 0.08),
      height: item.height * 1.75,
      depth: Math.max(0.35, item.depth * 0.08),
      y: item.y + item.height * 0.35,
    }));
    fillInstanced(beacons, antennaItems, item => ({
      ...item,
      x: item.x,
      y: item.y + item.height * 1.3,
      z: item.z,
      width: 0.58,
      height: 0.58,
      depth: 0.58,
    }));
    fillInstanced(residential, budgeted.city.residentialInfill);

    const tanks = budgeted.city.industrialInfill.filter(item => item.archetype === 'tank-house');
    const boxes = budgeted.city.industrialInfill.filter(item => item.archetype !== 'tank-house');
    const stacks = boxes.filter(item => item.archetype === 'workshop' || item.rank < 0.28);
    fillInstanced(industrialBoxes, boxes);
    fillInstanced(industrialTanks, tanks, item => ({
      ...item,
      width: item.width * 0.48,
      depth: item.width * 0.48,
    }));
    fillInstanced(industrialStacks, stacks, item => {
      const offset = localOffset(item, item.width * 0.26, item.depth * 0.18);
      return {
        ...item,
        x: offset.x,
        y: item.y + item.height * 0.5 + 7,
        z: offset.z,
        width: 2.1,
        height: 14,
        depth: 2.1,
      };
    });
    fillInstanced(residentialRoofs, budgeted.city.residentialInfill, item => ({
      ...item,
      y: item.y + item.height * 0.5 + 0.8,
      width: item.width * 1.04,
      height: 1.6,
      depth: item.depth * 1.04,
    }));
    fillInstanced(industrialRoofs, budgeted.city.industrialInfill, item => ({
      ...item,
      y: item.y + item.height * 0.5 + 1,
      width: item.width * 1.02,
      height: 2,
      depth: item.depth * 1.02,
    }));
  }

  function updateVisibility(camera, budget) {
    const distance = directDistance(camera, { x: 950, z: -860 });
    group.visible = distance <= budget.cityDistance;
    windowGroup.visible = group.visible && distance <= budget.windowDistance;
    roofGroup.visible = group.visible && distance <= budget.minorDetailDistance * 1.25;
    infillGroup.visible = group.visible && distance <= budget.cityDistance;
  }

  return {
    setBudget,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      litWindows: litWindows.count,
      unlitWindows: unlitWindows.count,
      rooftopServiceBoxes: roofServiceBoxes.count,
      rooftopAntennas: antennas.count,
      rooftopBeacons: beacons.count,
      residentialBuildings: residential.count,
      industrialBuildings: industrialBoxes.count + industrialTanks.count,
      industrialStacks: industrialStacks.count,
      drawCalls: 12,
      overlaysExistingAuthoredCity: true,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function localOffset(item, localX, localZ) {
  const cosine = Math.cos(item.rotationY || 0);
  const sine = Math.sin(item.rotationY || 0);
  return {
    x: item.x + cosine * localX + sine * localZ,
    z: item.z - sine * localX + cosine * localZ,
  };
}

function createRoadSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-road-hierarchy');
  const markingGroup = groupRoot(group, 'world-detail-road-markings');
  const box = pool.geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const roads = createInstanced(
    group,
    box,
    pool.material('road'),
    layout.roads.segments.length,
    'curved-major-road-segments',
  );
  const markings = createInstanced(
    markingGroup,
    box,
    pool.material('roadMarking'),
    layout.roads.markings.length,
    'restrained-road-centre-markings',
  );

  function setBudget(budgeted) {
    fillInstanced(roads, budgeted.roads.segments);
    fillInstanced(markings, budgeted.roads.markings);
  }

  function updateVisibility(camera, budget) {
    const distance = directDistance(camera, { x: 880, z: -720 });
    group.visible = distance <= budget.cityDistance * 1.15;
    markingGroup.visible = group.visible && distance <= budget.minorDetailDistance;
  }

  return {
    setBudget,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      roadSegments: roads.count,
      markings: markings.count,
      drawCalls: 2,
      curvedCorridors: true,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function createBridgeSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-authored-bridge-overlays');
  const box = pool.geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const arch = pool.geometry('bridge-arch-rib', () => {
    const geometry = new THREE.TorusGeometry(1, 0.12, 6, 20, Math.PI);
    geometry.rotateZ(Math.PI);
    return geometry;
  });
  const steel = createInstanced(
    group,
    box,
    pool.material('steel'),
    layout.bridges.details.length,
    'bridge-steel-rails-cables-and-trusses',
  );
  const masonry = createInstanced(
    group,
    box,
    pool.material('masonry'),
    layout.bridges.details.length,
    'bridge-masonry-rails',
  );
  const arches = createInstanced(
    group,
    arch,
    pool.material('masonry'),
    layout.bridges.details.length,
    'bridge-actual-arch-ribs',
  );

  function setBudget(budgeted) {
    const steelItems = budgeted.bridges.details.filter(item => item.kind !== 'arch' && item.material !== 'masonry');
    const masonryItems = budgeted.bridges.details.filter(item => item.kind !== 'arch' && item.material === 'masonry');
    const archItems = budgeted.bridges.details.filter(item => item.kind === 'arch');
    fillInstanced(steel, steelItems);
    fillInstanced(masonry, masonryItems);
    fillInstanced(arches, archItems, item => ({
      ...item,
      width: item.radius,
      height: item.radius,
      depth: Math.max(1, item.depth / 0.24),
    }));
  }

  function updateVisibility(camera, budget) {
    group.visible = !camera?.position || Math.abs(Number(camera.position.y) || 0) < 3900 || budget.id === 'high';
  }

  return {
    setBudget,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      steelDetails: steel.count,
      masonryDetails: masonry.count,
      arches: arches.count,
      drawCalls: 3,
      alignedToAuthoredBridges: true,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function createHarbourSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-river-harbour');
  const box = pool.geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = pool.geometry('harbour-bollard', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
  const sphere = pool.geometry('navigation-lamp', () => new THREE.SphereGeometry(0.5, 8, 5));
  const pieces = createInstanced(
    group,
    box,
    pool.material('harbour'),
    layout.harbour.pieces.length,
    'harbour-quays-and-piers',
  );
  const cranes = createInstanced(
    group,
    box,
    pool.material('steel'),
    layout.harbour.cranes.length,
    'harbour-crane-silhouettes',
  );
  const bollards = createInstanced(
    group,
    cylinder,
    pool.material('steel'),
    layout.harbour.pieces.length * 2,
    'harbour-mooring-bollards',
  );
  const lamps = createInstanced(
    group,
    sphere,
    pool.material('navigationLamp'),
    layout.harbour.lamps.length,
    'actual-harbour-navigation-lamps',
  );

  function setBudget(budgeted) {
    fillInstanced(pieces, budgeted.harbour.pieces);
    fillInstanced(cranes, budgeted.harbour.cranes);
    const pierBollards = [];
    for (const piece of budgeted.harbour.pieces.filter(item => item.kind === 'pier')) {
      for (const side of [-1, 1]) {
        const offset = localOffset(piece, side * piece.width * 0.34, piece.depth * 0.32);
        pierBollards.push({
          ...piece,
          x: offset.x,
          y: piece.y + piece.height * 0.5 + 0.65,
          z: offset.z,
          width: 0.65,
          height: 1.3,
          depth: 0.65,
        });
      }
    }
    fillInstanced(bollards, pierBollards);
    fillInstanced(lamps, budgeted.harbour.lamps);
  }

  function updateVisibility(camera, budget) {
    const distance = directDistance(camera, { x: 1120, z: -1080 });
    group.visible = distance <= budget.cityDistance * 1.25;
  }

  return {
    setBudget,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      quayAndPierPieces: pieces.count,
      craneParts: cranes.count,
      mooringBollards: bollards.count,
      navigationLamps: lamps.count,
      drawCalls: 4,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function createAirfieldSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-airfield-navigation-landmarks');
  const buildingGroup = groupRoot(group, 'world-detail-airfield-buildings');
  const markerGroup = groupRoot(group, 'world-detail-airfield-markers');
  const box = pool.geometry('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const hangarRoofGeometry = pool.geometry('curved-hangar-roof', () => {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, 0, Math.PI);
    geometry.rotateX(Math.PI * 0.5);
    return geometry;
  });
  const poleGeometry = pool.geometry('windsock-pole', () => new THREE.CylinderGeometry(0.22, 0.28, 1, 6));
  const sockGeometry = pool.geometry('windsock-cone', () => new THREE.ConeGeometry(1, 4, 10, 1, true));
  const buildings = createInstanced(
    buildingGroup,
    box,
    pool.material('industrialFacade'),
    layout.airfield.landmarks.length,
    'airfield-hangar-walls-tower-shafts-and-sheds',
  );
  const roofs = createInstanced(
    buildingGroup,
    box,
    pool.material('roof'),
    layout.airfield.landmarks.length,
    'airfield-flat-roof-silhouettes',
  );
  const hangarRoofs = createInstanced(
    buildingGroup,
    hangarRoofGeometry,
    pool.material('roof'),
    layout.airfield.landmarks.length,
    'airfield-curved-hangar-roofs',
  );
  const towerCabs = createInstanced(
    buildingGroup,
    box,
    pool.material('windowOff'),
    layout.airfield.landmarks.length,
    'airfield-control-tower-glass-cabs',
  );
  const hangarDoors = createInstanced(
    buildingGroup,
    box,
    pool.material('steel'),
    layout.airfield.landmarks.length,
    'airfield-hangar-doors',
  );
  const markers = createInstanced(
    markerGroup,
    box,
    pool.material('roadMarking'),
    layout.airfield.landmarks.length,
    'physical-approach-marker-boards',
  );
  const pole = new THREE.Mesh(poleGeometry, pool.material('steel'));
  const sock = new THREE.Mesh(sockGeometry, pool.material('windsock'));
  pole.name = 'city-airfield-windsock-pole';
  sock.name = 'city-airfield-windsock-fabric';
  pole.userData.skylineWorldDetailOwned = true;
  sock.userData.skylineWorldDetailOwned = true;
  group.add(pole, sock);
  let windsock = null;
  let elapsed = 0;

  function setBudget(budgeted) {
    const structures = budgeted.airfield.landmarks.filter(item => !['windsock', 'approach-marker'].includes(item.type));
    const hangars = structures.filter(item => item.type === 'hangar');
    const towers = structures.filter(item => item.type === 'control-tower');
    const flatRoofStructures = structures.filter(item => item.type !== 'hangar');
    const markerItems = budgeted.airfield.landmarks.filter(item => item.type === 'approach-marker');
    windsock = budgeted.airfield.landmarks.find(item => item.type === 'windsock') || null;

    fillInstanced(buildings, structures, item => item.type === 'control-tower'
      ? {
          ...item,
          y: item.y - item.height * 0.08,
          width: item.width * 0.46,
          height: item.height * 0.78,
          depth: item.depth * 0.46,
        }
      : item);
    fillInstanced(roofs, flatRoofStructures, item => ({
      ...item,
      y: item.y + item.height * 0.5 + 0.9,
      width: item.width * (item.type === 'control-tower' ? 1.15 : 1.06),
      height: item.type === 'control-tower' ? 1.5 : 1.8,
      depth: item.depth * (item.type === 'control-tower' ? 1.15 : 1.06),
    }));
    fillInstanced(hangarRoofs, hangars, item => ({
      ...item,
      y: item.y + item.height * 0.42,
      width: item.width,
      height: item.height * 0.72,
      depth: item.depth,
    }));
    fillInstanced(towerCabs, towers, item => ({
      ...item,
      y: item.y + item.height * 0.36,
      width: item.width,
      height: item.height * 0.22,
      depth: item.depth,
    }));
    fillInstanced(hangarDoors, hangars, item => {
      const front = localOffset(item, 0, item.depth * 0.5 + 0.1);
      return {
        ...item,
        x: front.x,
        y: item.y - item.height * 0.08,
        z: front.z,
        width: item.width * 0.72,
        height: item.height * 0.64,
        depth: 0.28,
      };
    });
    fillInstanced(markers, markerItems);
    pole.visible = Boolean(windsock);
    sock.visible = Boolean(windsock);
    if (windsock) {
      pole.position.set(windsock.x, windsock.y + windsock.height * 0.5, windsock.z);
      pole.scale.set(1, windsock.height, 1);
      sock.position.set(windsock.x, windsock.y + windsock.height, windsock.z);
      sock.scale.set(1.15, 1.15, 1.15);
      sock.rotation.set(Math.PI * 0.5, windsock.rotationY, 0);
    }
  }

  function update(dt) {
    if (!windsock) return;
    elapsed += clamp(dt, 0, 0.1);
    sock.rotation.y = windsock.rotationY + Math.sin(elapsed * 0.34) * 0.16;
    sock.rotation.z = Math.PI * 0.5 + Math.sin(elapsed * 1.8) * 0.055;
  }

  function updateVisibility(camera, budget) {
    const distance = directDistance(camera, { x: 520, z: 380 });
    group.visible = distance <= Math.max(4200, budget.cityDistance * 1.2);
    markerGroup.visible = group.visible && distance <= budget.minorDetailDistance * 1.6;
  }

  return {
    setBudget,
    update,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      structures: buildings.count,
      curvedHangarRoofs: hangarRoofs.count,
      hangarDoors: hangarDoors.count,
      towerCabs: towerCabs.count,
      approachMarkers: markers.count,
      windsock: Boolean(windsock),
      drawCalls: 8,
      portalFramesAdded: false,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function createTrafficHintSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-restrained-traffic-hints');
  const poleGeometry = pool.geometry('traffic-pole', () => new THREE.CylinderGeometry(0.12, 0.16, 1, 6));
  const lampGeometry = pool.geometry('traffic-lamp', () => new THREE.SphereGeometry(0.5, 7, 5));
  const poles = createInstanced(
    group,
    poleGeometry,
    pool.material('signalHousing'),
    layout.trafficHints.length,
    'traffic-signal-housings',
  );
  const lamps = createInstanced(
    group,
    lampGeometry,
    pool.material('signalLamp'),
    layout.trafficHints.length,
    'actual-traffic-signal-lamps',
  );

  function setBudget(budgeted) {
    fillInstanced(poles, budgeted.trafficHints, item => ({
      ...item,
      y: item.y - 2.05,
      width: 1,
      height: 4.1,
      depth: 1,
    }));
    fillInstanced(lamps, budgeted.trafficHints);
  }

  function updateVisibility(camera, budget) {
    const distance = directDistance(camera, { x: 900, z: -700 });
    group.visible = distance <= budget.minorDetailDistance;
  }

  return {
    setBudget,
    updateVisibility,
    getStatus: () => ({
      visible: group.visible,
      hints: lamps.count,
      movingTraffic: 0,
      drawCalls: 2,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

function createCloudSubsystem(root, pool, layout) {
  const group = groupRoot(root, 'world-detail-distant-cloud-strata');
  const cloudGeometry = pool.geometry('low-poly-cloud-cluster', () => new THREE.SphereGeometry(1, 10, 6));
  const near = createInstanced(
    group,
    cloudGeometry,
    pool.material('cloudNear'),
    layout.clouds.near.length,
    'distant-near-cloud-stratum',
  );
  const far = createInstanced(
    group,
    cloudGeometry,
    pool.material('cloudFar'),
    layout.clouds.far.length,
    'distant-far-cloud-stratum',
  );
  let elapsed = 0;

  function setBudget(budgeted) {
    fillInstanced(near, budgeted.clouds.near);
    fillInstanced(far, budgeted.clouds.far);
  }

  function update(dt) {
    elapsed += clamp(dt, 0, 0.1);
    group.position.x = Math.sin(elapsed * 0.012) * 75;
    group.position.z = Math.cos(elapsed * 0.009) * 54;
  }

  return {
    setBudget,
    update,
    updateVisibility() {},
    getStatus: () => ({
      nearClusters: near.count,
      farClusters: far.count,
      transparentDrawCalls: 2,
      worldSpace: true,
      cameraRelative: false,
    }),
    dispose: () => disposeGroup(root, group),
  };
}

class OwnedDayNightController {
  constructor(pool, eventTarget) {
    this.pool = pool;
    this.eventTarget = eventTarget;
    this.targetDaylight = 1;
    this.targetTwilight = 0;
    this.daylight = 1;
    this.twilight = 0;
    this.eventSeen = false;
    this.disposed = false;
    this.materials = Object.freeze({
      lit: this.pool.material('windowLit'),
      signal: this.pool.material('signalLamp'),
      navigation: this.pool.material('navigationLamp'),
      nearCloud: this.pool.material('cloudNear'),
      farCloud: this.pool.material('cloudFar'),
    });
    this._listener = event => {
      this.eventSeen = true;
      this.targetDaylight = clamp(event?.detail?.daylight, 0, 1);
      this.targetTwilight = clamp(event?.detail?.twilight, 0, 1);
    };
    this.eventTarget?.addEventListener?.('skyline:time-of-day', this._listener);
  }

  update(dt) {
    if (this.disposed) return;
    this.daylight = damp(this.daylight, this.targetDaylight, 1.35, dt);
    this.twilight = damp(this.twilight, this.targetTwilight, 1.15, dt);
    const night = 1 - this.daylight;
    const illumination = Math.max(night, this.twilight * 0.34);
    const { lit, signal, navigation, nearCloud, farCloud } = this.materials;

    lit.emissiveIntensity = illumination * 0.72;
    signal.emissiveIntensity = 0.06 + illumination * 0.22;
    navigation.emissiveIntensity = illumination * 0.54;

    nearCloud.color.copy(NIGHT_CLOUD_NEAR).lerp(DAY_CLOUD_NEAR, this.daylight);
    nearCloud.color.lerp(TWILIGHT_CLOUD_NEAR, this.twilight * 0.24);
    farCloud.color.copy(NIGHT_CLOUD_FAR).lerp(DAY_CLOUD_FAR, this.daylight);
    farCloud.color.lerp(TWILIGHT_CLOUD_FAR, this.twilight * 0.20);
    nearCloud.opacity = 0.14 + this.daylight * 0.08;
    farCloud.opacity = 0.08 + this.daylight * 0.05;
  }

  getStatus() {
    return {
      eventSeen: this.eventSeen,
      daylight: this.daylight,
      twilight: this.twilight,
      affectsOwnedMaterialsOnly: true,
      facadeEmission: 0,
      roofEmission: 0,
      maximumWindowEmission: 0.72,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.eventTarget?.removeEventListener?.('skyline:time-of-day', this._listener);
  }
}

export class ThreeWorldDetailAdapter {
  constructor({
    scene,
    rootName,
    layout,
    quality = 'auto',
    phone = false,
    eventTarget = globalThis.window || null,
    logger = console,
    subsystemFactories = {},
  }) {
    if (!scene?.add || !scene?.remove) throw new TypeError('World detail requires a Three.js scene');
    this.scene = scene;
    this.layout = layout;
    this.logger = logger;
    this.disposed = false;
    this.elapsed = 0;
    this.visibilityTimer = 0;
    this.updates = 0;
    this.fixedSteps = 0;
    this.pool = new WorldDetailResourcePool(THREE);
    this.root = new THREE.Group();
    this.root.name = rootName;
    this.root.userData.skylineWorldDetail = true;
    this.root.userData.skylineWorldDetailOwned = true;
    this.root.userData.safety = SAFETY_CONTRACT;
    this.scene.add(this.root);
    this.registry = new SafeSubsystemRegistry(logger);
    this.governor = new AdaptiveDetailGovernor({ requested: quality, phone });
    this.quality = quality;
    this.phone = Boolean(phone);
    this.budget = resolveDetailBudget(this.governor.effective, this.phone);
    this.budgetedLayout = null;

    const registerVisual = (name, defaultFactory) => {
      this.registry.register(name, () => {
        const before = new Set(this.root.children);
        try {
          const custom = subsystemFactories[name];
          return custom
            ? custom({ root: this.root, pool: this.pool, layout })
            : defaultFactory();
        } catch (error) {
          for (const child of [...this.root.children]) {
            if (!before.has(child)) this.root.remove(child);
          }
          throw error;
        }
      });
    };

    registerVisual('cityDetails', () => createCityDetailSubsystem(this.root, this.pool, layout));
    registerVisual('roads', () => createRoadSubsystem(this.root, this.pool, layout));
    registerVisual('bridges', () => createBridgeSubsystem(this.root, this.pool, layout));
    registerVisual('harbour', () => createHarbourSubsystem(this.root, this.pool, layout));
    registerVisual('airfield', () => createAirfieldSubsystem(this.root, this.pool, layout));
    registerVisual('trafficHints', () => createTrafficHintSubsystem(this.root, this.pool, layout));
    registerVisual('cloudLayers', () => createCloudSubsystem(this.root, this.pool, layout));
    this.registry.register('dayNight', () => new OwnedDayNightController(this.pool, eventTarget));
    this._applyBudget();
  }

  _applyBudget() {
    this.budget = resolveDetailBudget(this.governor.effective, this.phone);
    this.budgetedLayout = applyBudgetToLayout(
      this.layout,
      this.governor.effective,
      this.phone,
    );
    this.registry.invoke('setBudget', this.budgetedLayout);
  }

  setPhoneMode(phone) {
    const next = Boolean(phone);
    if (next === this.phone) return;
    this.phone = next;
    this.governor.setPhoneMode(next);
    this._applyBudget();
  }

  setQuality(quality) {
    this.quality = quality;
    this.governor.setRequested(quality);
    this._applyBudget();
  }

  fixedStepUpdate(dt, flight, phase = 'flying') {
    if (this.disposed) return;
    this.fixedSteps += 1;
    this.registry.invoke('fixedStepUpdate', dt, flight, phase);
  }

  update(dt, flight, camera, phase = 'flying') {
    if (this.disposed) return;
    const safeDt = clamp(dt, 0, 0.1);
    this.elapsed += safeDt;
    this.updates += 1;
    if (this.governor.update(safeDt)) this._applyBudget();
    this.registry.invoke('update', safeDt, flight, camera, phase);
    this.visibilityTimer -= safeDt;
    if (this.visibilityTimer <= 0) {
      this.visibilityTimer = this.budget.updateInterval;
      this.registry.invoke('updateVisibility', camera, this.budget, flight, phase);
    }
  }

  getCollisionDescriptors() {
    return this.budgetedLayout?.collisionDescriptors || [];
  }

  getStatus() {
    const systems = this.registry.status();
    const transparentDrawCalls =
      Number(systems.cloudLayers?.transparentDrawCalls) || 0;
    return Object.freeze({
      active: !this.disposed,
      disposed: this.disposed,
      phoneMode: this.phone,
      quality: this.governor.effective,
      requestedQuality: this.quality,
      updates: this.updates,
      fixedSteps: this.fixedSteps,
      descriptorCount: layoutObjectCount(this.budgetedLayout || {}),
      collisionDescriptors: this.getCollisionDescriptors().length,
      governor: this.governor.status(),
      resources: this.pool.status(),
      systems,
      performance: Object.freeze({
        transparentDrawCalls,
        maximumTransparentDrawCalls: SAFETY_CONTRACT.maximumTransparentDrawCalls,
        sceneWideMaterialScans: 0,
        geometryCreatedPerFrame: 0,
        materialCreatedPerFrame: 0,
        adaptiveHysteresis: true,
      }),
      safety: Object.freeze({
        ...SAFETY_CONTRACT,
        transparentDrawCallsWithinLimit:
          transparentDrawCalls <= SAFETY_CONTRACT.maximumTransparentDrawCalls,
        packageOwnedRootChildren: this.root.children.length,
      }),
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.registry.dispose();
    this.scene.remove(this.root);
    this.pool.dispose();
  }
}
