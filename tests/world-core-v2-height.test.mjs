import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createExpansionHeightModel } from '../src/worldExpansion/heightModel.js';
import { localCoordinates } from '../src/worldExpansion/math.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../assets/world/world-core-v2-manifest.json', import.meta.url)));
const coreSampler = (x, z) => 73 + Math.sin(x * 0.001) * 4 + Math.cos(z * 0.0013) * 3;
const model = createExpansionHeightModel(manifest, { coreSampleHeight: coreSampler });

test('height generation is finite and exactly deterministic across all regions', () => {
  const samples = [];
  for (let z = -8000; z <= 8000; z += 800) {
    for (let x = -8000; x <= 8000; x += 800) {
      const first = model.sampleHeight(x, z);
      const second = model.sampleHeight(x, z);
      assert.ok(Number.isFinite(first), `non-finite at ${x},${z}`);
      assert.equal(first, second);
      samples.push(first);
    }
  }
  assert.ok(Math.max(...samples) - Math.min(...samples) > 250, 'terrain lacks meaningful relief');
});

test('legacy core remains authoritative and the expansion seam is continuous', () => {
  assert.equal(model.sampleHeight(1200, -900), coreSampler(1200, -900));
  for (const [inside, outside] of [
    [[4095, 700], [4097, 700]],
    [[-4095, -1100], [-4097, -1100]],
    [[500, 4095], [500, 4097]],
    [[-800, -4095], [-800, -4097]],
  ]) {
    assert.ok(Math.abs(model.sampleHeight(...inside) - model.sampleHeight(...outside)) < 4.5);
  }
});

test('both runway and approach corridors are terrain-authored and flat enough to use', () => {
  for (const airfield of manifest.airfields) {
    for (const forward of [-0.48, -0.25, 0, 0.25, 0.48]) {
      for (const lateral of [-0.35, 0, 0.35]) {
        const radians = airfield.headingDegrees * Math.PI / 180;
        const f = forward * airfield.runwayLengthMeters;
        const r = lateral * airfield.runwayWidthMeters;
        const x = airfield.center[0] + Math.sin(radians) * f + Math.cos(radians) * r;
        const z = airfield.center[1] + Math.cos(radians) * f - Math.sin(radians) * r;
        assert.ok(Math.abs(model.sampleHeight(x, z) - airfield.elevationMeters) < 0.02, `${airfield.id} runway is not flat`);
      }
    }
    const approachPoint = (() => {
      const radians = airfield.headingDegrees * Math.PI / 180;
      const distance = airfield.runwayLengthMeters * 0.5 + airfield.approachLengthMeters * 0.75;
      return [airfield.center[0] + Math.sin(radians) * distance, airfield.center[1] + Math.cos(radians) * distance];
    })();
    const local = localCoordinates(approachPoint[0], approachPoint[1], airfield.center, airfield.headingDegrees);
    assert.ok(Math.abs(local.right) < 1e-6);
    assert.ok(model.sampleHeight(...approachPoint) < airfield.elevationMeters + 15, `${airfield.id} approach is obstructed`);
  }
});


test('bridge deck endpoints meet terrain approaches while river beds remain open below', () => {
  for (const bridge of manifest.bridges) {
    const road = model.index.roads.get(bridge.roadId);
    const river = model.index.rivers.get(bridge.riverId);
    const a = road.points[bridge.segmentIndex];
    const b = road.points[bridge.segmentIndex + 1];
    const midpoint = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
    const water = model.waterSurfaceAt(midpoint[0], midpoint[1]);
    if (Number.isFinite(water)) {
      assert.ok(model.sampleHeight(a[0], a[1]) + 0.33 >= water + bridge.clearanceMeters);
      assert.ok(model.sampleHeight(b[0], b[1]) + 0.33 >= water + bridge.clearanceMeters);
    }
    const riverPoint = river.points[Math.floor(river.points.length / 2)];
    const riverSurface = model.waterSurfaceAt(riverPoint[0], riverPoint[1]);
    assert.ok(model.sampleHeight(riverPoint[0], riverPoint[1]) < riverSurface);
  }
});

test('river beds and lake floors sit below their declared visible water surfaces', () => {
  for (const river of manifest.water.rivers) {
    const compiled = model.index.rivers.get(river.id).compiled;
    let carvedSample = null;
    for (const segment of compiled.segments) {
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const x = segment.a[0] + segment.dx * t;
        const z = segment.a[1] + segment.dz * t;
        if (model.isInsideCore(x, z)) continue;
        const road = model.roadSurfaceAt(x, z);
        const roadCore = road && !road.bridge &&
          road.distance <= road.profile.widthMeters * 0.5 + road.profile.shoulderMeters + 1.5;
        if (roadCore) continue;
        const surface = model.waterSurfaceAt(x, z);
        const height = model.sampleHeight(x, z);
        if (Number.isFinite(surface) && height <= surface - river.bedDepthMeters * 0.65) {
          carvedSample = [x, z];
          break;
        }
      }
      if (carvedSample) break;
    }
    assert.ok(carvedSample, `${river.id} has no production-depth bed outside the inherited core`);
  }
  for (const lake of manifest.water.lakes) {
    assert.equal(model.waterSurfaceAt(...lake.center), lake.surfaceMeters);
    assert.ok(model.sampleHeight(...lake.center) <= lake.floorMeters + 0.01);
  }
});
