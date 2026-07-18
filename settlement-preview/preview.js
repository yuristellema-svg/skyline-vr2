import * as THREE from '../vendor/three.module.min.js';
import { createSettlementSystem } from '../src/settlements/index.js';
import { SAMPLE_WORLD_MANIFEST } from '../src/settlements/sampleCatalog.js';

const canvas = document.querySelector('#preview');
const params = new URLSearchParams(location.search);
if (params.get('capture') === '1') document.body.classList.add('capture');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, Number(params.get('dpr')) || devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.20;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 7000);
const root = new THREE.Group();
scene.add(root);

const hemi = new THREE.HemisphereLight(0xdcecf0, 0x4b4f43, 1.45);
const sun = new THREE.DirectionalLight(0xffe0b0, 3.4);
const ambient = new THREE.AmbientLight(0xffffff, 0.62);
sun.position.set(-750, 900, -430);
scene.add(hemi, sun, ambient);
const fillEast = new THREE.DirectionalLight(0xc9dde1, 1.45);
fillEast.position.set(1100, 520, 900);
const fillWest = new THREE.DirectionalLight(0xe9d6bd, 1.25);
fillWest.position.set(-1000, 440, 950);
const fillNorth = new THREE.DirectionalLight(0xbacbd0, 0.85);
fillNorth.position.set(100, 380, -1200);
scene.add(fillEast, fillWest, fillNorth);

function heightAt(x, z) {
  const cityPlateau = Math.exp(-((x / 780) ** 2 + (z / 760) ** 2));
  return 5 + Math.sin(x / 330) * 1.8 + Math.cos(z / 280) * 1.3 + cityPlateau * 1.4;
}

function addGround() {
  const geometry = new THREE.PlaneGeometry(3200, 2600, 64, 52);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, heightAt(positions.getX(i), positions.getZ(i)) - 0.35);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ color: 0x819078, flatShading: false });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'Preview terrain only';
  root.add(ground);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 950), new THREE.MeshLambertMaterial({ color: 0x547686, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-80, SAMPLE_WORLD_MANIFEST.waterLevel, 1110);
  root.add(water);
}

function addRoadSegment(a, b, width, color = 0x4d5150) {
  const dx = b[0] - a[0]; const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.32, width), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set((a[0] + b[0]) / 2, Math.max(heightAt(a[0], a[1]), heightAt(b[0], b[1])) + 0.18, (a[1] + b[1]) / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  root.add(mesh);
}

function addRoads() {
  for (const road of SAMPLE_WORLD_MANIFEST.roads) {
    for (let i = 0; i < road.points.length - 1; i += 1) addRoadSegment(road.points[i], road.points[i + 1], road.width, road.class === 'service' ? 0x555b58 : road.class === 'rural' || road.class === 'farm' ? 0x686358 : 0x464b4b);
  }
}

function addTrees() {
  const geometry = new THREE.ConeGeometry(3.5, 13, 7);
  const material = new THREE.MeshLambertMaterial({ color: 0x465d49 });
  const positions = [];
  for (let x = -1450; x <= 1450; x += 68) for (let z = -1150; z <= 1150; z += 68) {
    const central = Math.abs(x) < 850 && Math.abs(z) < 900;
    const selector = Math.abs(Math.sin(x * 0.071 + z * 0.113));
    if ((central && selector < 0.96) || (!central && selector < 0.58) || z > 820) continue;
    positions.push([x, heightAt(x, z) + 6.5, z]);
  }
  const trees = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  positions.forEach((p, i) => { matrix.makeTranslation(...p); trees.setMatrixAt(i, matrix); });
  trees.instanceMatrix.needsUpdate = true;
  root.add(trees);
}

addGround(); addRoads(); addTrees();
const system = createSettlementSystem({ scene, manifest: SAMPLE_WORLD_MANIFEST, sampleHeight: heightAt, quality: 'high', phoneMode: false });

const VIEWS = {
  aerial: { pos: [1280, 1280, 1480], target: [0, 40, 40], fov: 48 },
  approach: { pos: [-1250, 105, -350], target: [-10, 75, -45], fov: 56 },
  downtown: { pos: [-580, 255, -470], target: [-60, 75, -35], fov: 51 },
  skyline: { pos: [-1050, 72, 20], target: [-25, 88, -20], fov: 42 },
  civic: { pos: [-760, 175, -170], target: [-330, 38, -30], fov: 48 },
  oldquarter: { pos: [790, 145, -390], target: [270, 28, -10], fov: 50 },
  harbour: { pos: [-950, 115, 1110], target: [-180, 26, 660], fov: 52 },
  town: { pos: [1220, 125, -980], target: [840, 24, -465], fov: 50 },
  village: { pos: [1370, 92, -260], target: [1060, 22, 10], fov: 48 },
};

function setView(name) {
  const view = VIEWS[name] ?? VIEWS.aerial;
  camera.position.fromArray(view.pos);
  camera.fov = view.fov; camera.updateProjectionMatrix();
  camera.lookAt(...view.target);
}

function setLighting(name) {
  if (name === 'night') {
    scene.background = new THREE.Color(0x07131c); scene.fog = new THREE.Fog(0x07131c, 900, 3600);
    hemi.color.set(0x42596b); hemi.groundColor.set(0x151c20); hemi.intensity = 0.92; ambient.intensity = 0.38; fillEast.intensity = 0.22; fillWest.intensity = 0.12; fillNorth.intensity = 0.16;
    sun.color.set(0x8ba5c8); sun.intensity = 0.18; renderer.toneMappingExposure = 1.08;
    system.update(0, { camera, nightFactor: 1, worldTimeSeconds: 14 });
  } else if (name === 'sunset') {
    scene.background = new THREE.Color(0xc28b70); scene.fog = new THREE.Fog(0xb88973, 1050, 3900);
    hemi.color.set(0xd6c1b0); hemi.groundColor.set(0x4c4d43); hemi.intensity = 1.25; ambient.intensity = 0.48; fillEast.intensity = 0.75; fillWest.intensity = 1.05; fillNorth.intensity = 0.40;
    sun.color.set(0xff9c62); sun.intensity = 3.0; sun.position.set(-1100, 360, -700); renderer.toneMappingExposure = 1.08;
    system.update(0, { camera, nightFactor: 0.35, worldTimeSeconds: 8 });
  } else {
    scene.background = new THREE.Color(0x93afb8); scene.fog = new THREE.Fog(0x93afb8, 1200, 4300);
    hemi.color.set(0xdcecf0); hemi.groundColor.set(0x4b4f43); hemi.intensity = 1.75; ambient.intensity = 0.62; fillEast.intensity = 1.45; fillWest.intensity = 1.25; fillNorth.intensity = 0.85;
    sun.color.set(0xffe0b0); sun.intensity = 3.4; sun.position.set(-750, 900, -430); renderer.toneMappingExposure = 1.20;
    system.update(0, { camera, nightFactor: 0, worldTimeSeconds: 2 });
  }
}

function resize() {
  const width = innerWidth; const height = innerHeight;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}

function render() {
  resize();
  system.update(0, { camera, nightFactor: document.querySelector('#light').value === 'night' ? 1 : document.querySelector('#light').value === 'sunset' ? 0.35 : 0 });
  renderer.render(scene, camera);
  const status = system.getStatus();
  document.querySelector('#status').textContent = `${status.quality.toUpperCase()}  ${status.totalInstances} instances\n${status.estimatedDrawCalls} draw calls  ${status.triangleEstimate} tris`;
  window.__SETTLEMENT_PREVIEW_READY__ = true;
  window.__SETTLEMENT_PREVIEW_STATUS__ = status;
}

const quality = document.querySelector('#quality');
const light = document.querySelector('#light');
const view = document.querySelector('#view');
quality.value = params.get('quality') ?? 'high';
light.value = params.get('light') ?? 'day';
view.value = params.get('view') ?? 'aerial';
function apply() {
  system.setPhoneMode(quality.value === 'low');
  if (quality.value !== 'low') system.setQuality(quality.value);
  setView(view.value); setLighting(light.value); render();
}
for (const input of [quality, light, view]) input.addEventListener('change', apply);
addEventListener('resize', render);
apply();
