import { makeDescriptor } from './descriptor.js';
import { rotate2 } from './math.js';

function readHeight(sampleHeight, x, z) {
  const result = sampleHeight(x, z);
  const value = typeof result === 'number' ? result : result?.height;
  if (!Number.isFinite(value)) throw new TypeError(`sampleHeight returned invalid height at ${x}, ${z}`);
  return value;
}

function descriptor(landmark, suffix, data) {
  return makeDescriptor({
    id: `${landmark.id}:${suffix}`,
    settlementId: `landmark:${landmark.id}`,
    locationId: `landmark:${landmark.id}`,
    districtId: null,
    category: data.category ?? 'landmarks',
    primitive: data.primitive ?? 'box',
    role: data.role,
    x: data.x ?? landmark.anchor[0],
    y: data.y,
    z: data.z ?? landmark.anchor[1],
    width: data.width,
    height: data.height,
    depth: data.depth,
    yaw: data.yaw ?? landmark.yaw ?? 0,
    color: data.color ?? '#626968',
    surface: data.surface ?? 'metal',
    qualityRank: data.qualityRank ?? 0,
    priority: data.priority ?? 120,
    visibilityBand: data.visibilityBand ?? 'skyline',
    emissive: data.emissive ?? false,
    collidable: data.collidable ?? true,
    essential: data.essential ?? true,
    meta: {
      landmarkId: landmark.id,
      name: landmark.name,
      kind: landmark.kind,
      exactAnchor: true,
      roadRef: landmark.roadRef ?? null,
      shorelineRef: landmark.shorelineRef ?? null,
      ...data.meta,
    },
  });
}

function signalLamp(landmark, baseY, height, color = '#ff654c') {
  return descriptor(landmark, 'signal-lamp', {
    primitive: 'beacon', role: 'actual-signal-lamp',
    y: baseY + height + 1.4, width: 2.6, height: 2.6, depth: 2.6,
    color, surface: 'signal-lit', emissive: true, collidable: false,
  });
}

export function buildLandmarkDescriptors(landmark, sampleHeight) {
  const baseY = readHeight(sampleHeight, landmark.anchor[0], landmark.anchor[1]);
  const height = landmark.height;
  const result = [];
  switch (landmark.kind) {
    case 'radio_tower':
    case 'antenna_mast': {
      const legOffset = landmark.kind === 'radio_tower' ? 3.2 : 1.8;
      for (const [index, local] of [[0, [-legOffset, 0]], [1, [legOffset, 0]], [2, [0, legOffset * 0.9]]]) {
        const offset = rotate2(local[0], local[1], landmark.yaw ?? 0);
        result.push(descriptor(landmark, `leg-${index}`, {
          primitive: 'mast', role: 'lattice-tower-leg',
          x: landmark.anchor[0] + offset[0], z: landmark.anchor[1] + offset[1],
          y: baseY + height * 0.5, width: landmark.kind === 'radio_tower' ? 1.1 : 0.7,
          height, depth: landmark.kind === 'radio_tower' ? 1.1 : 0.7,
          qualityRank: 0, essential: true,
        }));
      }
      for (let level = 1; level <= 5; level += 1) {
        result.push(descriptor(landmark, `crossbar-${level}`, {
          primitive: 'truss', role: 'lattice-crossbar',
          y: baseY + height * (level / 6), width: legOffset * 2.4, height: 0.7, depth: legOffset * 1.9,
          qualityRank: level <= 2 ? 1 : 2, priority: 42, visibilityBand: 'near', collidable: false, essential: false,
        }));
      }
      result.push(signalLamp(landmark, baseY, height));
      break;
    }
    case 'aviation_beacon':
      result.push(descriptor(landmark, 'mast', {
        primitive: 'mast', role: 'aviation-beacon-tower', y: baseY + height * 0.5,
        width: 3.5, height, depth: 3.5,
      }));
      result.push(descriptor(landmark, 'platform', {
        role: 'beacon-platform', y: baseY + height, width: 7, height: 1.1, depth: 7,
      }));
      result.push(signalLamp(landmark, baseY, height + 1, '#ffd277'));
      break;
    case 'water_tower':
      for (const side of [-1, 1]) {
        result.push(descriptor(landmark, `leg-${side}`, {
          primitive: 'mast', role: 'water-tower-leg',
          x: landmark.anchor[0] + side * 3.4, y: baseY + height * 0.38, z: landmark.anchor[1],
          width: 1.3, height: height * 0.76, depth: 1.3,
        }));
      }
      result.push(descriptor(landmark, 'tank', {
        primitive: 'water_tank', role: 'water-tower-tank',
        y: baseY + height * 0.84, width: 18, height: 13, depth: 18,
        color: '#747a76',
      }));
      break;
    case 'church_spire':
      result.push(descriptor(landmark, 'tower', {
        role: 'church-tower', y: baseY + height * 0.36, width: 13, height: height * 0.72, depth: 13,
        color: '#777269', surface: 'masonry',
      }));
      result.push(descriptor(landmark, 'spire', {
        primitive: 'cone', role: 'church-spire', y: baseY + height * 0.86,
        width: 11, height: height * 0.28, depth: 11, color: '#4c5552', surface: 'roof',
      }));
      break;
    case 'control_tower':
      result.push(descriptor(landmark, 'stem', {
        role: 'control-tower-stem', y: baseY + height * 0.42,
        width: 10, height: height * 0.84, depth: 10, color: '#70746e', surface: 'concrete',
      }));
      result.push(descriptor(landmark, 'cab', {
        role: 'control-tower-cab', y: baseY + height * 0.88,
        width: 19, height: 8, depth: 16, color: '#454e50', surface: 'window-dark',
      }));
      result.push(signalLamp(landmark, baseY, height + 1));
      break;
    case 'silo':
      result.push(descriptor(landmark, 'silo', {
        primitive: 'silo', role: 'landmark-silo', y: baseY + height * 0.5,
        width: 17, height, depth: 17, color: '#777a71',
      }));
      break;
    case 'harbour_crane':
      result.push(descriptor(landmark, 'crane', {
        primitive: 'crane', role: 'harbour-crane-landmark', y: baseY + height * 0.5,
        width: height * 0.65, height, depth: 8, color: '#586162',
      }));
      break;
    case 'smokestack':
      result.push(descriptor(landmark, 'stack', {
        primitive: 'cylinder', role: 'smokestack', y: baseY + height * 0.5,
        width: 6, height, depth: 6, color: '#5f6260',
      }));
      result.push(signalLamp(landmark, baseY, height));
      break;
    case 'lighthouse':
      result.push(descriptor(landmark, 'tower', {
        primitive: 'cylinder', role: 'lighthouse', y: baseY + height * 0.5,
        width: 9, height, depth: 9, color: '#ded8c9', surface: 'masonry',
      }));
      result.push(descriptor(landmark, 'lantern', {
        primitive: 'beacon', role: 'actual-signal-lamp', y: baseY + height + 2,
        width: 6, height: 4, depth: 6, color: '#ffe29d', surface: 'signal-lit', emissive: true, collidable: false,
      }));
      break;
    default:
      break;
  }
  return result;
}
