import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
const source = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing system preserves constructor and main integration surface', async () => { const text = await source('src/expansion/landingSystem.js'); assert.match(text, /constructor\(scene, sampleHeight/); assert.match(text, /afterFlightStep\(flight, powerState\)/); assert.match(text, /stepGround\(dt, flight, powerState\)/); assert.match(text, /get grounded\(\)/); assert.match(text, /groundLateralSpeed/); assert.match(text, /RUNWAY TOO SHORT/); });

test('guidance preserves existing update API and exposes richer flight fields', async () => { const text = await source('src/expansion/runwayGuidance.js'); assert.match(text, /constructor\(scene, landingSystem\)/); assert.match(text, /update\(flight\)/); assert.match(text, /export \{ distanceToRunway \}/); assert.match(text, /flight\.runwayCue/); assert.match(text, /flight\.runwayOperational/); });

test('manifest installs the root installer without touching protected integration files', async () => { const text = await source('CHANGED_FILES.txt'); const paths = text.split(/\r?\n/); assert.ok(paths.includes('install.sh')); for (const protectedPath of ['src/main.js', 'src/world/world.js', 'src/flightModel.js', 'src/camera.js', 'src/input.js', 'src/menu.js', 'src/aircraftVisuals.js', 'index.html', 'sw.js', 'package.json']) assert.ok(!paths.includes(protectedPath)); });

test('visual implementation consumes shared profile and mobile lighting planner', async () => { const text = await source('src/airfields/airfieldVisuals.js'); assert.match(text, /runwaySurfaceGrid/); assert.match(text, /runwayEarthworkSkirt/); assert.match(text, /buildLightingPlan\(field, true\)/); assert.match(text, /addPapi/); });

test('diagnostics and navigation include approach and departure corridors', async () => { const diagnostics = await source('src/airfields/airfieldDiagnostics.js'), nav = await source('src/navigation/navigationVisuals.js'); assert.match(diagnostics, /approachCorridorBounds/); assert.match(diagnostics, /departureCorridorBounds/); assert.match(nav, /createDepartureCue/); assert.match(nav, /locator/); });

test('world audit uses the exact generator sampler and packed fine detail', async () => { const text = await source('tools/airfields/auditWorldSites.mjs'); assert.match(text, /createAnalyticSampler/); assert.match(text, /splatResolutionMeters/); assert.match(text, /detailAmplitudeMeters/); assert.match(text, /process\.exitCode = 1/); });

test('capability report imports live aircraft profiles rather than duplicating them', async () => { const text = await source('tools/airfields/reportCapabilities.mjs'); assert.match(text, /AIRCRAFT_FLIGHT_PROFILES/); assert.match(text, /capabilityMatrix/); });

test('phone guidance avoids giant HUD copy and uses world-space geometry', async () => { const text = await source('src/navigation/navigationVisuals.js'); assert.doesNotMatch(text, /CanvasTexture|fillText|font\s*=/); assert.match(text, /TorusGeometry|OctahedronGeometry/); });

test('installer runs every focused test plus repository validation before commit', async () => { const text = await source('install.sh'); assert.match(text, /node --test tests\/airfields-\*\.test\.mjs tests\/landing-\*\.test\.mjs tests\/package-\*\.test\.mjs/); assert.match(text, /npm test/); assert.match(text, /world:validate/); assert.ok(text.indexOf('===== VALIDATING =====') < text.indexOf('===== COMMITTING =====')); });

test('gh-pages is never a push target', async () => { const text = await source('install.sh'); assert.doesNotMatch(text, /HEAD:gh-pages|push origin gh-pages/); assert.match(text, /git push -u origin "\$BRANCH"/); });
