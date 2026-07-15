import * as THREE from '../vendor/three.module.min.js';

const SKY_VERTEX = `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 zenithColor;
  uniform vec3 upperColor;
  uniform vec3 horizonColor;
  uniform vec3 groundHazeColor;
  uniform float sunWarmth;

  varying vec3 vDirection;

  void main() {
    float y = clamp(vDirection.y, -1.0, 1.0);
    float skyBlend = smoothstep(-0.05, 0.72, y);
    float upperBlend = smoothstep(0.18, 0.92, y);
    float horizonBand = 1.0 - smoothstep(0.0, 0.34, abs(y));

    vec3 sky = mix(horizonColor, upperColor, skyBlend);
    sky = mix(sky, zenithColor, upperBlend);
    sky = mix(sky, groundHazeColor, smoothstep(-0.08, -0.55, y));
    sky += vec3(1.0, 0.55, 0.28) * horizonBand * sunWarmth * 0.055;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function damp(current, target, response, dt) {
  return target + (current - target) * Math.exp(-response * dt);
}

function getSpeed(flight) {
  if (Number.isFinite(flight?.speed)) return Math.max(0, flight.speed);
  if (flight?.velocity?.isVector3) return flight.velocity.length();
  return 0;
}

function safeHeight(sampleHeight, x, z) {
  if (typeof sampleHeight !== 'function') return 0;

  try {
    const value = sampleHeight(x, z);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export class AtmosphereSystem {
  constructor(scene, sampleHeight = null) {
    this.scene = scene;
    this.sampleHeight = sampleHeight;
    this.elapsed = 0;

    this.fogNear = 720;
    this.fogFar = 1660;

    this.fogColor = new THREE.Color(0x9ab5bd);
    this.targetFogColor = new THREE.Color(0x9ab5bd);

    this.skyRoot = new THREE.Group();
    this.skyRoot.name = 'world-polish-sky-root';

    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: new THREE.Color(0x3e6d86) },
        upperColor: { value: new THREE.Color(0x6f9eb1) },
        horizonColor: { value: new THREE.Color(0xc1c8bd) },
        groundHazeColor: { value: new THREE.Color(0x8e9b89) },
        sunWarmth: { value: 0.45 },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(820, 28, 18),
      this.skyMaterial,
    );

    this.sky.name = 'aerial-perspective-sky';
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.skyRoot.add(this.sky);
    this.scene.add(this.skyRoot);

    this.hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xc4c6b7,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    this.hazeRing = new THREE.Mesh(
      new THREE.CylinderGeometry(690, 690, 130, 48, 1, true),
      this.hazeMaterial,
    );

    this.hazeRing.name = 'horizon-haze-ring';
    this.hazeRing.frustumCulled = false;
    this.hazeRing.renderOrder = -900;
    this.hazeRing.position.y = -20;
    this.skyRoot.add(this.hazeRing);

    this._ensureFog();
  }

  _ensureFog() {
    if (!this.scene.fog || !this.scene.fog.isFog) {
      this.scene.fog = new THREE.Fog(
        this.fogColor.clone(),
        this.fogNear,
        this.fogFar,
      );
    }
  }

  update(dt, flight, camera) {
    if (!camera) return;

    const safeDt = clamp(dt || 0, 0, 0.1);
    this.elapsed += safeDt;

    this._ensureFog();

    this.skyRoot.position.copy(camera.position);

    const position = flight?.position || camera.position;
    const ground = safeHeight(this.sampleHeight, position.x, position.z);
    const altitudeAboveGround = Math.max(0, position.y - ground);
    const altitudeFactor = clamp(altitudeAboveGround / 650, 0, 1);
    const speedFactor = clamp((getSpeed(flight) - 55) / 100, 0, 1);

    const desiredNear = 420 + altitudeFactor * 360 + speedFactor * 60;
    const cameraFar = Number.isFinite(camera.far) ? camera.far : 1800;
    const desiredFar = Math.min(
      cameraFar * 0.965,
      1260 + altitudeFactor * 470 + speedFactor * 55,
    );

    this.fogNear = damp(this.fogNear, desiredNear, 1.9, safeDt);
    this.fogFar = damp(this.fogFar, Math.max(this.fogNear + 260, desiredFar), 1.6, safeDt);

    const lowColor = new THREE.Color(0xa4aea5);
    const highColor = new THREE.Color(0x8daeba);
    this.targetFogColor.copy(lowColor).lerp(highColor, altitudeFactor);
    this.fogColor.lerp(this.targetFogColor, 1 - Math.exp(-1.35 * safeDt));

    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.near = this.fogNear;
    this.scene.fog.far = this.fogFar;

    this.hazeMaterial.color.copy(this.fogColor);
    this.hazeMaterial.opacity = 0.07 + (1 - altitudeFactor) * 0.055;

    this.skyMaterial.uniforms.horizonColor.value.copy(this.fogColor).offsetHSL(0, -0.03, 0.08);
    this.skyMaterial.uniforms.sunWarmth.value =
      0.38 + Math.sin(this.elapsed * 0.006) * 0.04;
  }

  dispose() {
    this.scene?.remove(this.skyRoot);
    this.sky.geometry.dispose();
    this.skyMaterial.dispose();
    this.hazeRing.geometry.dispose();
    this.hazeMaterial.dispose();
  }
}
