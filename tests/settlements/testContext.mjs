import { buildSettlementCatalog } from '../../src/settlements/catalogBuilder.js';
import { SAMPLE_WORLD_MANIFEST } from '../../src/settlements/sampleCatalog.js';

export const sampleHeight = (x, z) =>
  14 + Math.sin(x * 0.002) * 3 + Math.cos(z * 0.0017) * 2;

export function buildCatalog(overrides = {}) {
  return buildSettlementCatalog({
    manifest: SAMPLE_WORLD_MANIFEST,
    sampleHeight,
    ...overrides,
  });
}
