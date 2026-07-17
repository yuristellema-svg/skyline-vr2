export const CROWN_MOUNTAIN_OMISSION_REASON =
  'Omitted: the safe baseline exposes no terrain-generator hook that also updates the collision height sampler. A standalone camera-relative or cone-based mountain would repeat the rejected failure.';

export class CrownMountainSystem {
  constructor(scene, options = {}) {
    this.scene = scene || null;
    this.enabled = false;
    this.disposed = false;
    this.node = null;
    this.integration = null;
    this.reason = CROWN_MOUNTAIN_OMISSION_REASON;

    if (
      options.mode === 'terrain-hook' &&
      typeof options.createTerrainMountain === 'function'
    ) {
      try {
        const integration = options.createTerrainMountain({ scene: this.scene });
        if (integration?.heightSamplerIntegrated === true && integration.node) {
          this.integration = integration;
          this.node = integration.node;
          if (this.scene && !this.node.parent) this.scene.add?.(this.node);
          this.enabled = true;
          this.reason = '';
        }
      } catch (error) {
        this.reason = `Terrain-hook integration failed safely: ${error?.message || error}`;
      }
    }
  }

  fixedStepUpdate() {}
  update() {}
  setQuality() {}

  getStatus() {
    return {
      active: this.enabled && !this.disposed,
      omitted: !this.enabled,
      mode: this.enabled ? 'terrain-hook' : 'omitted',
      heightSamplerIntegrated: Boolean(this.integration?.heightSamplerIntegrated),
      cameraRelative: false,
      reason: this.reason,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try { this.integration?.dispose?.(); } catch {}
    if (this.node) this.scene?.remove?.(this.node);
    this.node = null;
    this.integration = null;
    this.enabled = false;
  }
}
