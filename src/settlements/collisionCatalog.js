import { descriptorAabb } from './descriptor.js';

export function buildCollisionCatalog(descriptors) {
  const boxes = descriptors
    .filter(descriptor => descriptor.collidable)
    .map(descriptorAabb);
  return Object.freeze(boxes);
}

export function registerCollisionCatalog(collisionCatalog, collisionSystem) {
  if (!collisionSystem || typeof collisionSystem.addBox !== 'function') return 0;
  for (const box of collisionCatalog) {
    collisionSystem.addBox(
      box.minX,
      box.maxX,
      box.minY,
      box.maxY,
      box.minZ,
      box.maxZ,
      `${box.settlementId} ${box.role}`,
    );
  }
  return collisionCatalog.length;
}
