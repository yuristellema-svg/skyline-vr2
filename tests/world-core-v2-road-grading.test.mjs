import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createExpansionHeightModel } from '../src/worldExpansion/heightModel.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
const model = createExpansionHeightModel(manifest, { coreSampleHeight: () => 74 });
const maximumGrade = { primary: 0.055, secondary: 0.075, service: 0.11 };

test('all non-bridge road profiles remain within their authored grade class', () => {
  for (const profile of model.roadProfiles.values()) {
    for (const segment of profile.segments) {
      if (segment.bridge) continue;
      const grade = Math.abs(segment.heightB - segment.heightA) / Math.max(1, segment.length);
      assert.ok(
        grade <= maximumGrade[profile.class] + 1e-9,
        `${profile.id}:${segment.segmentIndex} grade ${(grade * 100).toFixed(2)}% exceeds ${maximumGrade[profile.class] * 100}%`,
      );
    }
  }
});

test('road earthworks support every non-bridge water crossing as a visible causeway', () => {
  let supportedCrossings = 0;
  for (const profile of model.roadProfiles.values()) {
    for (const segment of profile.segments) {
      if (segment.bridge) continue;
      for (const t of [0.2, 0.5, 0.8]) {
        const x = segment.a[0] + segment.dx * t;
        const z = segment.a[1] + segment.dz * t;
        if (model.isInsideCore(x, z)) continue;
        const ground = model.sampleHeight(x, z);
        assert.ok(Number.isFinite(ground));
        const water = model.waterSurfaceAt(x, z);
        if (water == null) continue;
        supportedCrossings += 1;
        assert.ok(ground >= water + 1.4, `${profile.id}:${segment.segmentIndex} is unsupported over water`);
      }
    }
  }
  assert.ok(supportedCrossings > 0, 'the authored network should exercise culvert/causeway support');
});

test('bridge decks have usable clearances and terrain-connected abutments', () => {
  for (const profile of model.bridgeProfiles.values()) {
    const span = Math.hypot(profile.b[0] - profile.a[0], profile.b[1] - profile.a[1]);
    const grade = Math.abs(profile.targetB - profile.targetA) / span;
    assert.ok(grade <= 0.025 + 1e-9, `${profile.bridge.id} deck grade too steep`);
    assert.ok(profile.targetA >= profile.water + profile.bridge.clearanceMeters - 1e-6);
    assert.ok(profile.targetB >= profile.water + profile.bridge.clearanceMeters - 1e-6);
    assert.ok(Math.abs(model.sampleHeight(profile.a[0], profile.a[1]) - profile.targetA) < 1.2);
    assert.ok(Math.abs(model.sampleHeight(profile.b[0], profile.b[1]) - profile.targetB) < 1.2);
  }
});
