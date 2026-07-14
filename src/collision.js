import { CONFIG } from './config.js';

export class CollisionSystem {
  constructor(
    heightSampler = () => 0,
    radius = CONFIG.collision.playerRadius
  ) {
    this.heightSampler = heightSampler;
    this.radius = radius;
    this.boxes = [];
    this.arches = [];
    this.lastReason = '';
  }

  setHeightSampler(heightSampler) {
    if (typeof heightSampler !== 'function') {
      throw new TypeError(
        'Height sampler must be a function.'
      );
    }

    this.heightSampler = heightSampler;
  }

  addBox(
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    label = 'Obstacle'
  ) {
    this.boxes.push({
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      label,
    });
  }

  addArchBridge({
    z,
    depth,
    halfSpan,
    bottom,
    deckTop,
    halfOpening,
    openingHeight,
    label = 'Bridge',
  }) {
    this.arches.push({
      z,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      halfSpan,
      bottom,
      deckTop,
      halfOpening,
      openingHeight,
      label,
    });
  }

  clear() {
    this.boxes.length = 0;
    this.arches.length = 0;
  }

  check(position) {
    const terrainHeight =
      this.heightSampler(
        position.x,
        position.z
      );

    const minimumHeight =
      terrainHeight +
      this.radius +
      0.35;

    /*
     * Safe flight-testing mode.
     *
     * Touching the terrain no longer triggers the crash menu
     * or freezes the controls. The player is gently kept just
     * above the surface and can pull upward to recover.
     */
    if (position.y < minimumHeight) {
      position.y = minimumHeight;
      this.lastReason = 'Terrain skim';
      return false;
    }

    /*
     * Obstacles and bridges are temporarily non-lethal.
     *
     * During physics tuning it is more important that the
     * player never becomes trapped in the crash/respawn state.
     * Proper collision reactions can be restored later.
     */
    this.lastReason = '';
    return false;
  }
}
