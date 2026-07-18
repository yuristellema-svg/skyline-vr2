import { DEFAULTS, VISIBILITY_BANDS } from './constants.js';

function descriptorPoint(descriptor) {
  return [descriptor.position[0], descriptor.position[2]];
}

export function buildSpatialCatalog(descriptors, cellSize = DEFAULTS.cellSize) {
  const settlements = {};
  const cells = {};
  for (const descriptor of descriptors) {
    const point = descriptorPoint(descriptor);
    const settlement = settlements[descriptor.settlementId] ??= {
      minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, count: 0,
    };
    settlement.minX = Math.min(settlement.minX, point[0]);
    settlement.maxX = Math.max(settlement.maxX, point[0]);
    settlement.minZ = Math.min(settlement.minZ, point[1]);
    settlement.maxZ = Math.max(settlement.maxZ, point[1]);
    settlement.count += 1;

    const cellX = Math.floor(point[0] / cellSize);
    const cellZ = Math.floor(point[1] / cellSize);
    const key = `${cellX}:${cellZ}`;
    const cell = cells[key] ??= { key, cellX, cellZ, count: 0, settlementIds: new Set() };
    cell.count += 1;
    cell.settlementIds.add(descriptor.settlementId);
  }
  for (const settlement of Object.values(settlements)) {
    settlement.center = Object.freeze([
      (settlement.minX + settlement.maxX) * 0.5,
      (settlement.minZ + settlement.maxZ) * 0.5,
    ]);
    settlement.radius = Math.hypot(settlement.maxX - settlement.minX, settlement.maxZ - settlement.minZ) * 0.5;
    Object.freeze(settlement);
  }
  const frozenCells = {};
  for (const [key, cell] of Object.entries(cells)) {
    frozenCells[key] = Object.freeze({
      ...cell,
      settlementIds: Object.freeze([...cell.settlementIds].sort()),
    });
  }
  return Object.freeze({
    cellSize,
    settlements: Object.freeze(settlements),
    cells: Object.freeze(frozenCells),
    cellCount: Object.keys(frozenCells).length,
  });
}

export function maximumDistanceForBand(band, budget) {
  const policy = VISIBILITY_BANDS[band] ?? VISIBILITY_BANDS.district;
  if (!Number.isFinite(policy.distanceMultiplier)) return Infinity;
  const base = band === 'micro' ? budget.microDetailDistance : budget.detailDistance;
  return base * policy.distanceMultiplier;
}
