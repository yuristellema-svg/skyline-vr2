import { ThreeWorldDetailAdapter } from './threeRuntime.js';
import { createWorldDetailSystemCore } from './worldDetailSystem.js';

export function createWorldDetailSystem(options = {}) {
  return createWorldDetailSystemCore(
    options,
    adapterOptions => new ThreeWorldDetailAdapter(adapterOptions),
  );
}

export {
  DEFAULT_AIRFIELDS,
  SAFETY_CONTRACT,
  WORLD_DETAIL_ROOT_NAME,
  WORLD_DETAIL_VERSION,
} from './constants.js';

export {
  AUTHORED_WORLD_REFERENCE,
  mergeAuthoredReference,
} from './authoredReference.js';

export {
  applyBudgetToLayout,
  buildWorldDetailLayout,
  layoutObjectCount,
  nearestAuthoredRiverDistance,
  nearestBridgeDistance,
  roadNetworkRepetitionScore,
} from './layout.js';

export {
  DETAIL_BUDGETS,
  normalizeQuality,
  resolveDetailBudget,
} from './budget.js';

export {
  MATERIAL_SPECS,
  canMaterialEmit,
  validateMaterialPolicy,
} from './materialPolicy.js';
