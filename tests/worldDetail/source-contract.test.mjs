import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync(new URL('../../src/worldDetail/threeRuntime.js', import.meta.url), 'utf8');
const system = fs.readFileSync(new URL('../../src/worldDetail/worldDetailSystem.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../../src/worldDetail/index.js', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../../src/worldDetail/layout.js', import.meta.url), 'utf8');
const constants = fs.readFileSync(new URL('../../src/worldDetail/constants.js', import.meta.url), 'utf8');

const combined = `${runtime}\n${system}\n${index}\n${layout}\n${constants}`;

test('runtime never traverses or recolours the existing scene', () => {
  assert.equal(/scene\s*\.\s*traverse/.test(runtime), false);
  assert.equal(/trackedMaterials|trackedObjects/.test(runtime), false);
  assert.match(runtime, /sceneWideMaterialScans:\s*0/);
  assert.match(runtime, /SAFETY_CONTRACT/);
  assert.match(constants, /arbitraryCityRecolouring:\s*false/);
});

test('required public API and safe additive API are present', () => {
  assert.match(index, /createWorldDetailSystem/);
  for (const method of [
    'setPhoneMode',
    'fixedStepUpdate',
    'update',
    'getStatus',
    'dispose',
    'setQuality',
    'getCollisionDescriptors',
  ]) {
    assert.match(system, new RegExp(`\\b${method}\\s*\\(`), method);
  }
});

test('rendering uses instancing and reusable resource pools', () => {
  assert.match(runtime, /InstancedMesh/);
  assert.match(runtime, /WorldDetailResourcePool/);
  assert.match(runtime, /geometryCreatedPerFrame:\s*0/);
  assert.match(runtime, /materialCreatedPerFrame:\s*0/);
});

test('package does not import or implement other worker ownership', () => {
  assert.doesNotMatch(combined, /from ['"].*(flightModel|windAudio|menu|camera|aircraftVisuals|workerNav|workerSound)/);
  assert.doesNotMatch(combined, /skyline:boost-fired/);
  assert.doesNotMatch(combined, /new\s+WebSocket|AudioContext|requestOrientationPermission/);
});

test('package has no server, service-worker or port behavior', () => {
  assert.doesNotMatch(combined, /4176|createServer|serviceWorker|navigator\.serviceWorker/);
});

test('no new giant cone or pyramid mountain implementation exists', () => {
  assert.doesNotMatch(runtime, /ConeGeometry\([^\n]*[1-9][0-9]{2,}/);
  assert.doesNotMatch(combined, /crownMountain|giant[- ]?cone|pyramid[- ]?mountain/i);
});
