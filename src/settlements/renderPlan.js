import { maximumDistanceForBand } from './spatial.js';

export function renderScopeFor(descriptor) {
  return descriptor.visibilityBand === 'near' || descriptor.visibilityBand === 'micro'
    ? descriptor.settlementId
    : 'global';
}

export function renderGroupKey(descriptor) {
  return [
    renderScopeFor(descriptor),
    descriptor.visibilityBand,
    descriptor.primitive,
    descriptor.surface,
    descriptor.emissive ? 'lit' : 'opaque',
  ].join('|');
}

export function buildRenderPlan(descriptors, spatial, budget) {
  const groups = new Map();
  for (const descriptor of descriptors) {
    const key = renderGroupKey(descriptor);
    const group = groups.get(key) ?? {
      key,
      scope: renderScopeFor(descriptor),
      settlementId: renderScopeFor(descriptor) === 'global' ? null : descriptor.settlementId,
      visibilityBand: descriptor.visibilityBand,
      primitive: descriptor.primitive,
      surface: descriptor.surface,
      emissive: descriptor.emissive,
      count: 0,
      triangleEstimate: 0,
    };
    group.count += 1;
    group.triangleEstimate += descriptor.triangleEstimate;
    groups.set(key, group);
  }
  const result = [...groups.values()].map(group => {
    const bounds = group.settlementId ? spatial.settlements[group.settlementId] : null;
    return Object.freeze({
      ...group,
      center: bounds?.center ?? null,
      radius: bounds?.radius ?? 0,
      maxDistance: maximumDistanceForBand(group.visibilityBand, budget),
    });
  }).sort((a, b) => a.key.localeCompare(b.key));
  return Object.freeze({
    drawCalls: result.length,
    groups: Object.freeze(result),
    instancedObjects: descriptors.length,
    triangles: result.reduce((sum, group) => sum + group.triangleEstimate, 0),
  });
}
