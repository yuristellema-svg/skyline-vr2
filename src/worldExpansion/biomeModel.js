import {
  ellipseInfluence,
  fbm2,
  nearestPointOnPolyline,
  smoothstep,
} from './math.js';

const PALETTE = Object.freeze({
  'temperate-meadow': [0.44, 0.56, 0.31],
  'conifer-forest': [0.20, 0.37, 0.25],
  'mixed-forest': [0.29, 0.43, 0.27],
  'alpine-rock': [0.55, 0.55, 0.51],
  'granite-highland': [0.47, 0.49, 0.46],
  'canyon-steppe': [0.55, 0.41, 0.29],
  farmland: [0.51, 0.57, 0.35],
  riparian: [0.27, 0.45, 0.35],
  'delta-wetland': [0.32, 0.46, 0.40],
  'coastal-heath': [0.43, 0.46, 0.34],
  'settlement-ground': [0.47, 0.43, 0.36],
  'airfield-ground': [0.39, 0.44, 0.32],
  beach: [0.65, 0.56, 0.40],
});


function boundsForPoints(points, padding = 0) {
  const xs = points.map(point => point[0]);
  const zs = points.map(point => point[1]);
  return {
    minX: Math.min(...xs) - padding,
    minZ: Math.min(...zs) - padding,
    maxX: Math.max(...xs) + padding,
    maxZ: Math.max(...zs) + padding,
  };
}

function pointNearBounds(x, z, bounds) {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function blendColor(base, overlay, amount) {
  return [
    base[0] + (overlay[0] - base[0]) * amount,
    base[1] + (overlay[1] - base[1]) * amount,
    base[2] + (overlay[2] - base[2]) * amount,
  ];
}

export function createBiomeModel(manifest, index) {
  const assignments = manifest.biomes?.regionAssignments || {};
  const regions = manifest.regions.filter(region => region.kind !== 'inherited-core');
  const rivers = [...index.rivers.values()].map(river => ({ ...river, proximityBounds: boundsForPoints(river.points, 175) }));

  function nearestWaterDistance(x, z) {
    let distance = Number.POSITIVE_INFINITY;
    for (const river of rivers) {
      if (!pointNearBounds(x, z, river.proximityBounds)) continue;
      distance = Math.min(distance, nearestPointOnPolyline(x, z, river.compiled).distance);
    }
    for (const lake of manifest.water.lakes) {
      const nx = (x - lake.center[0]) / lake.radius[0];
      const nz = (z - lake.center[1]) / lake.radius[1];
      distance = Math.min(distance, Math.max(0, Math.hypot(nx, nz) - 1) * Math.min(lake.radius[0], lake.radius[1]));
    }
    return distance;
  }

  function regionBiome(x, z) {
    let best = { influence: 0, key: manifest.biomes?.default || 'temperate-meadow' };
    for (const region of regions) {
      const influence = ellipseInfluence(x, z, region.center, region.radius, 0.34);
      if (influence > best.influence) best = { influence, key: assignments[region.id] || manifest.biomes?.default || 'temperate-meadow' };
    }
    return best;
  }

  function classify(x, z, height, slope, waterSurface) {
    if (Number.isFinite(waterSurface) && height <= waterSurface + 2.5) return { key: 'beach', color: PALETTE.beach };
    const region = regionBiome(x, z);
    let key = region.key;
    const waterDistance = nearestWaterDistance(x, z);
    if (waterDistance < 175) key = region.key === 'delta-wetland' ? 'delta-wetland' : 'riparian';
    if (height > 330 || slope > 0.72) key = region.key === 'granite-highland' ? 'granite-highland' : 'alpine-rock';
    else if (height > 215 && key !== 'canyon-steppe') key = 'conifer-forest';
    const noise = fbm2(x * 0.0011, z * 0.0011, manifest.seed + 701, 3);
    const base = PALETTE[key] || PALETTE['temperate-meadow'];
    const light = 0.93 + noise * 0.08 - Math.min(0.12, slope * 0.08);
    return { key, color: base.map(value => Math.max(0, Math.min(1, value * light))) };
  }

  function blendForInfrastructure(surface, infrastructureAmount, infrastructureKey) {
    const target = PALETTE[infrastructureKey] || PALETTE['settlement-ground'];
    return { key: infrastructureKey, color: blendColor(surface.color, target, smoothstep(0, 1, infrastructureAmount)) };
  }

  return Object.freeze({ classify, blendForInfrastructure, palette: PALETTE });
}
