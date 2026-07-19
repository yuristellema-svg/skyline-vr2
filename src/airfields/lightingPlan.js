export function buildLightingPlan(field, phone = false) {
  const budget = Math.max(0, Math.floor(phone ? field.lighting.mobileLightBudget : field.lighting.desktopLightBudget));
  const plan = [];
  const add = (kind, data) => { if (plan.length < budget) plan.push(Object.freeze({ kind, ...data })); };
  const directions = [...new Set([...field.operations.landingDirections, ...field.operations.takeoffDirections])];
  for (const sign of directions) {
    const points = field.kind === 'primary' ? 7 : 3;
    for (let i = 0; i < points; i += 1) add('threshold', { sign, along: sign * (field.length / 2 - 2.5), lateral: -field.width * 0.39 + field.width * 0.78 * (points === 1 ? 0.5 : i / (points - 1)), color: sign > 0 ? 0xe34a3b : 0x79e6ad });
  }
  const approachDistances = field.lighting.approach === 'precision-short' ? [45, 95, 165, 245, 335] : field.lighting.approach === 'threshold-only' ? [55, 125] : [];
  for (const sign of field.operations.landingDirections) for (const distance of approachDistances) add('approach', { sign, distance, along: -sign * (field.length / 2 + distance), lateral: 0, color: 0xf4ead0 });
  const remaining = Math.max(0, budget - plan.length); const pairs = Math.floor(remaining / 2);
  for (let i = 0; i < pairs; i += 1) { const along = -field.length / 2 + field.length * (i + 1) / (pairs + 1); add('edge', { along, lateral: -field.width / 2 + 1.2, color: 0xb9e4ff }); add('edge', { along, lateral: field.width / 2 - 1.2, color: 0xb9e4ff }); }
  return Object.freeze({ budget, phone, lights: Object.freeze(plan), count: plan.length, byKind: Object.freeze(plan.reduce((out, light) => ({ ...out, [light.kind]: (out[light.kind] || 0) + 1 }), {})) });
}
