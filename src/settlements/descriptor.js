import { TRIANGLES_BY_PRIMITIVE } from './constants.js';
import { orientedCorners } from './math.js';

export function makeDescriptor({
  id,
  settlementId,
  locationId,
  districtId = null,
  category,
  primitive = 'box',
  role,
  x,
  y,
  z,
  width,
  height,
  depth,
  yaw = 0,
  color = '#777777',
  surface = 'facade',
  qualityRank = 0,
  priority = 50,
  visibilityBand = 'district',
  emissive = false,
  collidable = false,
  essential = false,
  meta = {},
}) {
  const triangleEstimate = TRIANGLES_BY_PRIMITIVE[primitive] ?? 12;
  return Object.freeze({
    id,
    settlementId,
    locationId: locationId ?? id,
    districtId,
    category,
    primitive,
    role,
    position: Object.freeze([x, y, z]),
    scale: Object.freeze([width, height, depth]),
    yaw,
    color,
    surface,
    qualityRank,
    priority,
    visibilityBand,
    emissive: Boolean(emissive),
    collidable: Boolean(collidable),
    essential: Boolean(essential),
    triangleEstimate,
    meta: Object.freeze({ ...meta }),
  });
}

export function descriptorFootprint(descriptor) {
  const [x, , z] = descriptor.position;
  const [width, , depth] = descriptor.scale;
  return orientedCorners(x, z, width, depth, descriptor.yaw);
}

export function descriptorAabb(descriptor) {
  const footprint = descriptorFootprint(descriptor);
  const xs = footprint.map(point => point[0]);
  const zs = footprint.map(point => point[1]);
  const [y] = [descriptor.position[1]];
  const height = descriptor.scale[1];
  return Object.freeze({
    id: descriptor.id,
    settlementId: descriptor.settlementId,
    role: descriptor.role,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: y - height * 0.5,
    maxY: y + height * 0.5,
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  });
}
