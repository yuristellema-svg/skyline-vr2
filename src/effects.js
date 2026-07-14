import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, clamp, smoothstep } from './config.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(1664525, value) + 1013904223;
    return (value >>> 0) / 4294967296;
  };
}

export class EffectsSystem {
  constructor(scene, config = CONFIG) {
    this.config = config;
    this.time = 0;
    this.intensityIndex = 2;
    this.levels = [0.45, 0.72, 1];
    this.levelNames = ['LOW', 'MEDIUM', 'FULL'];
    this.vignette = 0;
    this.redTint = 0;
    this.viewSqueeze = 0;
    this.shakePitch = 0;
    this.shakeYaw = 0;
    this.shakeRoll = 0;
    this._negativeGTime = 0;
    this._sessionNumber = 0;
    this._promptState = -1;
    this._velocityDirection = new THREE.Vector3(0, 0, -1);
    this._streakQuaternion = new THREE.Quaternion();
    this._promptOffset = new THREE.Vector3(0, -0.22, -this.config.effects.promptDepth);
    this._promptWorldOffset = new THREE.Vector3();
    this.streaks = this._buildStreaks();
    scene.add(this.streaks);
    this.boostPrompt = this._buildBoostPrompt();
    scene.add(this.boostPrompt);
  }

  _buildBoostPrompt() {
    this._promptCanvas = document.createElement('canvas');
    this._promptCanvas.width = 512;
    this._promptCanvas.height = 128;
    this._promptContext = this._promptCanvas.getContext('2d');
    this._promptTexture = new THREE.CanvasTexture(this._promptCanvas);
    this._promptTexture.colorSpace = THREE.SRGBColorSpace;
    this._promptTexture.minFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({
      map: this._promptTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.23), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 9950;
    mesh.visible = false;
    mesh.name = 'Fused boost instruction at reticle depth';
    return mesh;
  }

  beginSession() {
    try {
      const previous = Number.parseInt(localStorage.getItem('skyline-vr-flight-sessions') || '0', 10) || 0;
      this._sessionNumber = previous + 1;
      localStorage.setItem('skyline-vr-flight-sessions', String(this._sessionNumber));
    } catch {
      this._sessionNumber += 1;
    }
  }

  _setPrompt(state) {
    if (state === this._promptState) return;
    this._promptState = state;
    this.boostPrompt.visible = state !== 0;
    if (state === 0) return;
    const context = this._promptContext;
    context.clearRect(0, 0, 512, 128);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '900 48px system-ui, sans-serif';
    context.lineWidth = 10;
    context.strokeStyle = 'rgba(5,20,27,0.82)';
    context.fillStyle = state === 2 ? '#ffb34f' : state === 3 ? '#8ee9ff' : '#fff7e8';
    const label = state === 1 ? 'DIVE TO CHARGE' : state === 2 ? 'PULL' : 'BOOST';
    context.strokeText(label, 256, 64);
    context.fillText(label, 256, 64);
    this._promptTexture.needsUpdate = true;
  }

  _buildStreaks() {
    const count = this.config.effects.streakCount;
    const positions = new Float32Array(count * 2 * 3);
    const offsets = new Float32Array(count * 2 * 3);
    const phases = new Float32Array(count * 2);
    const ends = new Float32Array(count * 2);
    const random = seededRandom(20260714);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * this.config.effects.streakRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const phase = random();
      const a = i * 2;
      offsets[a * 3] = x;
      offsets[a * 3 + 1] = y;
      offsets[a * 3 + 2] = 0;
      offsets[(a + 1) * 3] = x;
      offsets[(a + 1) * 3 + 1] = y;
      offsets[(a + 1) * 3 + 2] = 0;
      phases[a] = phase;
      phases[a + 1] = phase;
      ends[a] = 0;
      ends[a + 1] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 },
        uDepth: { value: this.config.effects.streakDepth },
        uBoost: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uAmount;
        uniform float uDepth;
        uniform float uBoost;
        attribute vec3 aOffset;
        attribute float aPhase;
        attribute float aEnd;
        varying float vAlpha;
        void main() {
          float travel = fract(aPhase + uTime * mix(0.18, 0.72, uAmount));
          float z = -mix(3.5, uDepth, 1.0 - travel);
          float length = mix(0.15, 4.8, uAmount) + uBoost * 3.0;
          vec3 p = vec3(aOffset.xy, z - aEnd * length);
          vAlpha = uAmount * smoothstep(0.0, 0.14, travel) * (1.0 - smoothstep(0.72, 1.0, travel));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(0.72, 0.91, 1.0, vAlpha * 0.7);
        }
      `,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 20;
    lines.name = 'Velocity-aligned wind streaks';
    return lines;
  }

  update(dt, flight, camera) {
    this.time += dt;
    const effectLevel = this.levels[this.intensityIndex];
    const speedAmount = smoothstep(
      this.config.effects.streakStartSpeed,
      this.config.effects.streakFullSpeed,
      flight.speed
    );
    const boost = flight.boosting ? 1 : 0;
    this.streaks.material.uniforms.uTime.value = this.time;
    this.streaks.material.uniforms.uAmount.value = clamp(
      speedAmount * effectLevel * (boost ? this.config.effects.boostIntensity : 1),
      0,
      1.35
    );
    this.streaks.material.uniforms.uBoost.value = boost;
    this.streaks.position.copy(camera.position);
    this._velocityDirection.copy(flight.velocity).normalize();
    this._streakQuaternion.setFromUnitVectors(LOCAL_FORWARD, this._velocityDirection);
    this.streaks.quaternion.copy(this._streakQuaternion);

    const positiveG = smoothstep(
      this.config.effects.gVignetteStart,
      this.config.effects.gVignetteFull,
      flight.gLoad
    );
    this.vignette = positiveG * 0.72 * effectLevel;
    this.viewSqueeze = positiveG * this.config.effects.maxViewSqueeze * effectLevel;

    if (flight.gLoad < this.config.effects.negativeGTintStart) this._negativeGTime += dt;
    else this._negativeGTime = Math.max(0, this._negativeGTime - dt * 2.5);
    this.redTint = smoothstep(0.35, 0.55, this._negativeGTime) *
      smoothstep(-this.config.effects.negativeGTintStart, 1.6, -flight.gLoad) * 0.16 * effectLevel;

    const shakeAmount = this.config.effects.maxVrShake * speedAmount * effectLevel * (boost ? 1.3 : 1);
    this.shakePitch = Math.sin(this.time * 31.7) * shakeAmount * 0.62;
    this.shakeYaw = Math.sin(this.time * 37.1 + 1.7) * shakeAmount * 0.48;
    this.shakeRoll = Math.sin(this.time * 27.3 + 0.4) * shakeAmount * 0.55;
    const stallBuffet = (flight.stallAmount || 0) * this.config.effects.stallBuffetAngle * effectLevel;
    this.shakePitch += Math.sin(this.time * 73.1) * stallBuffet;
    this.shakeYaw += Math.sin(this.time * 61.7 + 0.8) * stallBuffet * 0.7;

    let promptState = 0;
    if (flight.boosting) promptState = 3;
    else if ((flight.boostArmedRemaining || 0) > 0) promptState = 2;
    else if (flight.boostChargeCondition && this._sessionNumber <= 3) promptState = 1;
    this._setPrompt(promptState);
    this._promptWorldOffset.copy(this._promptOffset).applyQuaternion(camera.quaternion);
    this.boostPrompt.position.copy(camera.position).add(this._promptWorldOffset);
    this.boostPrompt.quaternion.copy(camera.quaternion);
  }

  cycleIntensity() {
    this.intensityIndex = (this.intensityIndex + 1) % this.levels.length;
    return this.levelNames[this.intensityIndex];
  }

  get intensityName() {
    return this.levelNames[this.intensityIndex];
  }
}
