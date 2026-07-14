import * as THREE from '../../../vendor/three.module.min.js';

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

const PALETTE = Object.freeze({
  stone: 0x8d7968,
  stoneLight: 0xb09b81,
  wood: 0x68452f,
  woodLight: 0xb27d4b,
  rail: 0x343a3c,
  concrete: 0xb4b5ae,
  steel: 0x617582,
  suspension: 0x34434a,
  cable: 0xc2c8c3,
  canyon: 0x9a6041,
  rock: 0x77776f,
});

function material(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

function addMesh(group, geometry, meshMaterial, name) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  group.add(mesh);
  return mesh;
}

function addBox(group, meshMaterial, x, y, z, width, height, depth, name, rotationZ = 0) {
  const mesh = addMesh(group, new THREE.BoxGeometry(width, height, depth), meshMaterial, name);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotationZ;
  return mesh;
}

function worldBox(local, bridge, label) {
  const angle = bridge.headingDegrees * DEG;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const halfX = local.width * 0.5;
  const halfZ = local.depth * 0.5;
  const worldHalfX = Math.abs(cosine) * halfX + Math.abs(sine) * halfZ;
  const worldHalfZ = Math.abs(sine) * halfX + Math.abs(cosine) * halfZ;
  const centerX = bridge.position[0] + cosine * local.x + sine * local.z;
  const centerZ = bridge.position[1] - sine * local.x + cosine * local.z;
  return {
    minX: centerX - worldHalfX,
    maxX: centerX + worldHalfX,
    minY: bridge.y + local.y - local.height * 0.5,
    maxY: bridge.y + local.y + local.height * 0.5,
    minZ: centerZ - worldHalfZ,
    maxZ: centerZ + worldHalfZ,
    label,
  };
}

function collisionBox(list, bridge, x, y, z, width, height, depth, label) {
  list.push(worldBox({ x, y, z, width, height, depth }, bridge, label));
}

function addCable(group, points, radius, cableMaterial, name) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
  const geometry = new THREE.TubeGeometry(curve, Math.max(10, points.length * 5), radius, 4, false);
  return addMesh(group, geometry, cableMaterial, name);
}

function setBridgeTransform(group, bridge) {
  group.position.set(bridge.position[0], bridge.y, bridge.position[1]);
  group.rotation.y = bridge.headingDegrees * DEG;
  group.name = bridge.id;
}

function createStoneArchBridge(bridge, collisions, materials) {
  const group = new THREE.Group();
  const span = bridge.spanMeters;
  const width = bridge.deckWidthMeters;
  const drop = Math.max(10, bridge.y - bridge.waterY);
  const archCount = 3;
  const pierWidth = 5.4;
  const openingWidth = (span - (archCount + 1) * pierWidth) / archCount;
  const shape = new THREE.Shape();
  shape.moveTo(-span * 0.5, -drop);
  shape.lineTo(span * 0.5, -drop);
  shape.lineTo(span * 0.5, 1.6);
  shape.lineTo(-span * 0.5, 1.6);
  shape.closePath();
  for (let index = 0; index < archCount; index += 1) {
    const center = -span * 0.5 + pierWidth + openingWidth * 0.5 + index * (openingWidth + pierWidth);
    const half = openingWidth * 0.5;
    const roof = -2.1;
    const spring = roof - half;
    const hole = new THREE.Path();
    hole.moveTo(center - half, -drop - 0.2);
    hole.lineTo(center - half, spring);
    hole.absarc(center, spring, half, Math.PI, 0, true);
    hole.lineTo(center + half, -drop - 0.2);
    hole.closePath();
    shape.holes.push(hole);
  }
  const masonry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 10,
  });
  masonry.translate(0, 0, -width * 0.5);
  masonry.computeVertexNormals();
  addMesh(group, masonry, materials.stone, 'Three-open arch masonry');
  addBox(group, materials.stoneLight, 0, 2.15, 0, span + 4, 1.1, width + 2, 'Stone coping');
  collisionBox(collisions, bridge, 0, 0.75, 0, span + 4, 2.5, width + 2, `${bridge.id} deck`);
  for (let index = 0; index <= archCount; index += 1) {
    const x = -span * 0.5 + pierWidth * 0.5 + index * (openingWidth + pierWidth);
    collisionBox(collisions, bridge, x, -drop * 0.5, 0, pierWidth, drop, width, `${bridge.id} pier`);
  }
  setBridgeTransform(group, bridge);
  return group;
}

function createWoodenBridge(bridge, collisions, materials) {
  const group = new THREE.Group();
  const span = bridge.spanMeters;
  const width = bridge.deckWidthMeters;
  const slatCount = Math.max(18, Math.round(span / 3));
  const slatGeometry = new THREE.BoxGeometry(span / slatCount * 0.86, 0.72, width);
  const slats = new THREE.InstancedMesh(slatGeometry, materials.woodLight, slatCount);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < slatCount; index += 1) {
    const x = -span * 0.5 + (index + 0.5) * span / slatCount;
    const sag = -1.9 * (1 - (x / (span * 0.5)) ** 2);
    matrix.makeTranslation(x, sag, 0);
    slats.setMatrixAt(index, matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  slats.name = 'Individual wooden deck boards';
  group.add(slats);
  const postCount = 18;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 3.5, 0.55), materials.wood, postCount * 2);
  let instance = 0;
  for (const side of [-1, 1]) {
    for (let index = 0; index < postCount; index += 1) {
      const x = -span * 0.5 + index * span / (postCount - 1);
      const sag = -1.9 * (1 - (x / (span * 0.5)) ** 2);
      matrix.makeTranslation(x, sag + 1.45, side * (width * 0.5 - 0.35));
      posts.setMatrixAt(instance++, matrix);
    }
    addCable(group, [
      new THREE.Vector3(-span * 0.5, 3.2, side * width * 0.5),
      new THREE.Vector3(0, -0.35, side * width * 0.5),
      new THREE.Vector3(span * 0.5, 3.2, side * width * 0.5),
    ], 0.18, materials.cable, 'Wood bridge hand rope');
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);
  collisionBox(collisions, bridge, 0, -0.7, 0, span, 2.5, width, `${bridge.id} deck`);
  setBridgeTransform(group, bridge);
  return group;
}

function createRailViaductBridge(bridge, collisions, materials) {
  const group = new THREE.Group();
  const span = bridge.spanMeters;
  const width = bridge.deckWidthMeters;
  const drop = Math.max(20, bridge.y - bridge.waterY);
  addBox(group, materials.concrete, 0, -1.3, 0, span, 2.6, width, 'Rail viaduct deck');
  for (const side of [-1, 1]) {
    addBox(group, materials.rail, 0, 0.26, side * width * 0.26, span, 0.18, 0.16, 'Rail line');
  }
  const pierCount = Math.max(4, Math.floor(span / 34));
  const pierSpacing = span / (pierCount + 1);
  for (let index = 1; index <= pierCount; index += 1) {
    const x = -span * 0.5 + index * pierSpacing;
    addBox(group, materials.concrete, x, -drop * 0.5 - 1.1, 0, 3.8, drop - 2.2, width * 0.72, 'Viaduct pier');
    addBox(group, materials.concrete, x, -4.2, 0, 9.5, 1.5, width, 'Viaduct pier cap');
    collisionBox(collisions, bridge, x, -drop * 0.5 - 1.1, 0, 3.8, drop - 2.2, width * 0.72, `${bridge.id} pillar`);
  }
  collisionBox(collisions, bridge, 0, -1.3, 0, span, 2.6, width, `${bridge.id} deck`);
  setBridgeTransform(group, bridge);
  return group;
}

function createModernBridge(bridge, collisions, materials) {
  const group = new THREE.Group();
  const span = bridge.spanMeters;
  const width = bridge.deckWidthMeters;
  const drop = Math.max(18, bridge.y - bridge.waterY);
  addBox(group, materials.steel, 0, -0.7, 0, span, 1.4, width, 'Modern steel span');
  addBox(group, materials.concrete, 0, -2.0, 0, span * 0.92, 1.25, width * 0.7, 'Modern underside spine');
  for (const side of [-1, 1]) {
    addBox(group, materials.cable, 0, 0.3, side * (width * 0.5 - 0.2), span, 0.32, 0.32, 'Modern safety edge');
  }
  for (const side of [-1, 1]) {
    const x = side * span * 0.28;
    const legHeight = drop - 3;
    addBox(group, materials.concrete, x - side * 4.5, -legHeight * 0.5 - 2, 0, 3.0, legHeight, width * 0.32, 'Splayed modern pier', side * 0.13);
    addBox(group, materials.concrete, x + side * 4.5, -legHeight * 0.5 - 2, 0, 3.0, legHeight, width * 0.32, 'Splayed modern pier', -side * 0.13);
    collisionBox(collisions, bridge, x - side * 4.5, -legHeight * 0.5 - 2, 0, 5.5, legHeight, width * 0.38, `${bridge.id} support`);
    collisionBox(collisions, bridge, x + side * 4.5, -legHeight * 0.5 - 2, 0, 5.5, legHeight, width * 0.38, `${bridge.id} support`);
  }
  collisionBox(collisions, bridge, 0, -0.7, 0, span, 1.4, width, `${bridge.id} deck`);
  setBridgeTransform(group, bridge);
  return group;
}

function createSuspensionBridge(bridge, collisions, materials) {
  const group = new THREE.Group();
  const span = bridge.spanMeters;
  const width = bridge.deckWidthMeters;
  const towerX = span * 0.31;
  const towerHeight = 32;
  addBox(group, materials.suspension, 0, -0.75, 0, span, 1.5, width, 'Suspension deck');
  for (const x of [-towerX, towerX]) {
    for (const side of [-1, 1]) {
      addBox(group, materials.suspension, x, towerHeight * 0.5, side * (width * 0.5 - 0.9), 2.8, towerHeight, 2.2, 'Suspension tower leg');
      collisionBox(collisions, bridge, x, towerHeight * 0.5, side * (width * 0.5 - 0.9), 2.8, towerHeight, 2.2, `${bridge.id} tower`);
    }
    addBox(group, materials.suspension, x, towerHeight - 2, 0, 3.2, 2.2, width, 'Suspension tower crown');
    collisionBox(collisions, bridge, x, towerHeight - 2, 0, 3.2, 2.2, width, `${bridge.id} tower crown`);
  }
  const hangerGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 4);
  const hangerCountPerSide = 23;
  const hangers = new THREE.InstancedMesh(hangerGeometry, materials.cable, hangerCountPerSide * 2);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const quaternion = new THREE.Quaternion();
  let instance = 0;
  for (const side of [-1, 1]) {
    const cablePoints = [];
    for (let index = 0; index < hangerCountPerSide; index += 1) {
      const x = -span * 0.5 + index * span / (hangerCountPerSide - 1);
      const inner = Math.abs(x) <= towerX;
      const normalized = inner ? Math.abs(x) / towerX : (Math.abs(x) - towerX) / (span * 0.5 - towerX);
      const cableY = inner
        ? 7 + (towerHeight - 7) * normalized * normalized
        : towerHeight - (towerHeight - 5) * normalized;
      cablePoints.push(new THREE.Vector3(x, cableY, side * width * 0.5));
      const height = Math.max(1, cableY - 0.25);
      position.set(x, height * 0.5, side * width * 0.5);
      scale.set(1, height, 1);
      matrix.compose(position, quaternion, scale);
      hangers.setMatrixAt(instance++, matrix);
    }
    addCable(group, cablePoints, 0.28, materials.cable, 'Suspension main cable');
  }
  hangers.instanceMatrix.needsUpdate = true;
  group.add(hangers);
  collisionBox(collisions, bridge, 0, -0.75, 0, span, 1.5, width, `${bridge.id} deck`);
  setBridgeTransform(group, bridge);
  return group;
}

const BRIDGE_BUILDERS = Object.freeze({
  stone_arch: createStoneArchBridge,
  urban_arch: createWoodenBridge,
  rail_viaduct: createRailViaductBridge,
  steel_truss: createModernBridge,
  suspension: createSuspensionBridge,
});

const BRIDGE_VISUAL_KINDS = Object.freeze({
  stone_arch: 'stone arch',
  urban_arch: 'wooden',
  rail_viaduct: 'rail viaduct',
  steel_truss: 'modern span',
  suspension: 'suspension',
});

function createNaturalArch(feature, collisions, materials) {
  const group = new THREE.Group();
  const radius = 24;
  const tube = 7;
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 7, 24, Math.PI),
    materials.canyon,
  );
  arch.rotation.z = 0;
  arch.position.y = 4;
  arch.name = 'Threadable canyon arch';
  group.add(arch);
  addBox(group, materials.canyon, -radius, -8, 0, tube * 1.8, 24, tube * 1.8, 'Natural arch left foot');
  addBox(group, materials.canyon, radius, -8, 0, tube * 1.8, 24, tube * 1.8, 'Natural arch right foot');
  const bridgeLike = {
    position: feature.position,
    y: feature.y,
    headingDegrees: feature.headingDegrees,
  };
  collisionBox(collisions, bridgeLike, -radius, -8, 0, tube * 1.8, 24, tube * 1.8, `${feature.id} foot`);
  collisionBox(collisions, bridgeLike, radius, -8, 0, tube * 1.8, 24, tube * 1.8, `${feature.id} foot`);
  collisionBox(collisions, bridgeLike, 0, radius + 4, 0, radius * 1.5, tube * 1.5, tube * 1.8, `${feature.id} crown`);
  group.position.set(feature.position[0], feature.y, feature.position[1]);
  group.rotation.y = feature.headingDegrees * DEG;
  group.name = feature.id;
  return group;
}

function createScenicLandmark(feature, collisions, materials) {
  const group = new THREE.Group();
  if (feature.type === 'observatory') {
    addMesh(group, new THREE.CylinderGeometry(17, 21, 14, 12), materials.stoneLight, 'Observatory base').position.y = 7;
    const dome = addMesh(group, new THREE.SphereGeometry(15, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), materials.concrete, 'Observatory dome');
    dome.position.y = 14;
    collisionBox(collisions, feature, 0, 7, 0, 42, 14, 42, `${feature.id} base`);
    collisionBox(collisions, feature, 0, 21.5, 0, 30, 15, 30, `${feature.id} dome`);
  } else if (feature.type === 'rock_needle') {
    const needle = addMesh(group, new THREE.ConeGeometry(13, 92, 7), materials.rock, 'Alpine rock needle');
    needle.position.y = 45;
    needle.rotation.z = 0.06;
    collisionBox(collisions, feature, 0, 45, 0, 32, 94, 26, `${feature.id} needle`);
  } else if (feature.type === 'stone_circle') {
    const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), materials.stone, 12);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const x = Math.cos(angle) * 23;
      const z = Math.sin(angle) * 23;
      matrix.compose(
        new THREE.Vector3(x, 4.5, z),
        new THREE.Quaternion().setFromAxisAngle(UP, angle),
        new THREE.Vector3(3.2, 7.5, 3.2),
      );
      stones.setMatrixAt(index, matrix);
      collisionBox(collisions, feature, x, 4.5, z, 6.4, 15, 6.4, `${feature.id} stone ${index + 1}`);
    }
    stones.instanceMatrix.needsUpdate = true;
    stones.name = 'Forest stone circle';
    group.add(stones);
  } else if (feature.type === 'wind_array') {
    const towers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 1.5, 34, 6), materials.concrete, 7);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 7; index += 1) {
      const x = (index - 3) * 34;
      const z = Math.sin(index * 1.8) * 16;
      matrix.makeTranslation(x, 17, z);
      towers.setMatrixAt(index, matrix);
      collisionBox(collisions, feature, x, 17, z, 3, 34, 3, `${feature.id} tower ${index + 1}`);
    }
    towers.instanceMatrix.needsUpdate = true;
    towers.name = 'Southern wind tower array';
    group.add(towers);
  } else {
    return null;
  }
  group.position.set(feature.position[0], feature.y, feature.position[1]);
  group.rotation.y = feature.headingDegrees * DEG;
  group.name = feature.id;
  return group;
}

export function registerStructureCollisions(collisionSystem, boxes) {
  if (!collisionSystem || typeof collisionSystem.addBox !== 'function') return 0;
  for (const box of boxes) {
    collisionSystem.addBox(box.minX, box.maxX, box.minY, box.maxY, box.minZ, box.maxZ, box.label);
  }
  return boxes.length;
}

export function createStructureLayer(features, options = {}) {
  if (!features || !Array.isArray(features.bridges)) throw new TypeError('World features with bridges are required.');
  const group = new THREE.Group();
  group.name = 'Authored bridges and landmarks';
  const ownedMaterials = {
    stone: material(PALETTE.stone),
    stoneLight: material(PALETTE.stoneLight),
    wood: material(PALETTE.wood),
    woodLight: material(PALETTE.woodLight),
    rail: material(PALETTE.rail),
    concrete: material(PALETTE.concrete),
    steel: material(PALETTE.steel),
    suspension: material(PALETTE.suspension),
    cable: material(PALETTE.cable),
    canyon: material(PALETTE.canyon),
    rock: material(PALETTE.rock),
  };
  const collisionBoxes = [];
  const bridgeKinds = [];
  const bridgeVisualKinds = [];
  for (const bridge of features.bridges) {
    const builder = BRIDGE_BUILDERS[bridge.type];
    if (!builder) continue;
    const bridgeGroup = builder(bridge, collisionBoxes, ownedMaterials);
    bridgeGroup.userData.structureType = bridge.type;
    bridgeGroup.userData.visualKind = BRIDGE_VISUAL_KINDS[bridge.type];
    bridgeGroup.userData.threadable = true;
    group.add(bridgeGroup);
    bridgeKinds.push(bridge.type);
    bridgeVisualKinds.push(BRIDGE_VISUAL_KINDS[bridge.type]);
  }
  for (const landmark of features.landmarks ?? []) {
    if (landmark.type === 'tower_pair' || landmark.type === 'open_atrium') continue;
    const landmarkGroup = landmark.type === 'natural_arch'
      ? createNaturalArch(landmark, collisionBoxes, ownedMaterials)
      : createScenicLandmark(landmark, collisionBoxes, ownedMaterials);
    if (landmarkGroup) group.add(landmarkGroup);
  }
  if (options.scene) options.scene.add(group);
  if (options.collision) registerStructureCollisions(options.collision, collisionBoxes);
  return {
    group,
    collisionBoxes,
    bridgeKinds,
    bridgeVisualKinds,
    registerCollisions(collisionSystem) {
      return registerStructureCollisions(collisionSystem, collisionBoxes);
    },
    dispose() {
      group.traverse(object => {
        if (object.geometry) object.geometry.dispose();
      });
      for (const owned of Object.values(ownedMaterials)) owned.dispose();
      group.removeFromParent();
    },
  };
}
