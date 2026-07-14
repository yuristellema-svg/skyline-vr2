import * as THREE from '../../../vendor/three.module.min.js';

function buildRiverGeometry(river, subdivisions = 8) {
  const controlPoints = river.points.map(point => new THREE.Vector3(point[0], point[1], point[2]));
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.5);
  const sampleCount = Math.max(2, (controlPoints.length - 1) * subdivisions + 1);
  const positions = new Float32Array(sampleCount * 2 * 3);
  const uvs = new Float32Array(sampleCount * 2 * 2);
  const indices = new Uint16Array((sampleCount - 1) * 6);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const width = river.bedWidthMeters * 0.94;
  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / (sampleCount - 1);
    curve.getPoint(t, point);
    curve.getTangent(t, tangent);
    const normalX = -tangent.z;
    const normalZ = tangent.x;
    const normalLength = Math.hypot(normalX, normalZ) || 1;
    const offsetX = normalX / normalLength * width * 0.5;
    const offsetZ = normalZ / normalLength * width * 0.5;
    const vertex = index * 6;
    positions[vertex] = point.x + offsetX;
    positions[vertex + 1] = point.y + 0.18;
    positions[vertex + 2] = point.z + offsetZ;
    positions[vertex + 3] = point.x - offsetX;
    positions[vertex + 4] = point.y + 0.18;
    positions[vertex + 5] = point.z - offsetZ;
    const uv = index * 4;
    uvs[uv] = 0;
    uvs[uv + 1] = t * 48;
    uvs[uv + 2] = 1;
    uvs[uv + 3] = t * 48;
    if (index < sampleCount - 1) {
      const cell = index * 6;
      const a = index * 2;
      indices[cell] = a;
      indices[cell + 1] = a + 2;
      indices[cell + 2] = a + 1;
      indices[cell + 3] = a + 1;
      indices[cell + 4] = a + 2;
      indices[cell + 5] = a + 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildLakeGeometry(lake, rings = 12, segments = 64) {
  const vertexCount = 1 + rings * segments;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const triangleCount = segments + (rings - 1) * segments * 2;
  const indices = new Uint16Array(triangleCount * 3);
  positions[0] = lake.center[0];
  positions[1] = lake.y + 0.18;
  positions[2] = lake.center[1];
  uvs[0] = 0.5;
  uvs[1] = 0.5;
  for (let ring = 1; ring <= rings; ring += 1) {
    const radius = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2;
      const index = 1 + (ring - 1) * segments + segment;
      positions[index * 3] = lake.center[0] + Math.cos(angle) * lake.radius[0] * radius;
      positions[index * 3 + 1] = lake.y + 0.18;
      positions[index * 3 + 2] = lake.center[1] + Math.sin(angle) * lake.radius[1] * radius;
      uvs[index * 2] = Math.cos(angle) * radius * 0.5 + 0.5;
      uvs[index * 2 + 1] = Math.sin(angle) * radius * 0.5 + 0.5;
    }
  }
  let cursor = 0;
  for (let segment = 0; segment < segments; segment += 1) {
    indices[cursor++] = 0;
    indices[cursor++] = 1 + segment;
    indices[cursor++] = 1 + (segment + 1) % segments;
  }
  for (let ring = 2; ring <= rings; ring += 1) {
    const innerStart = 1 + (ring - 2) * segments;
    const outerStart = 1 + (ring - 1) * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const inner = innerStart + segment;
      const innerNext = innerStart + next;
      const outer = outerStart + segment;
      const outerNext = outerStart + next;
      indices[cursor++] = inner;
      indices[cursor++] = outer;
      indices[cursor++] = innerNext;
      indices[cursor++] = innerNext;
      indices[cursor++] = outer;
      indices[cursor++] = outerNext;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createWaterMaterial(options) {
  const fog = options.fog ?? { color: new THREE.Color(0x9bb7bd), near: 900, far: 1600 };
  const fogColor = fog.color?.isColor ? fog.color : new THREE.Color(fog.color ?? 0x9bb7bd);
  return new THREE.ShaderMaterial({
    name: 'Skyline two-layer mobile water',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(options.deepColor ?? 0x174c62) },
      uShallow: { value: new THREE.Color(options.shallowColor ?? 0x4b9eb1) },
      uSky: { value: new THREE.Color(options.skyColor ?? 0xb7d6da) },
      uSunDirection: { value: new THREE.Vector3(-0.42, 0.78, 0.46).normalize() },
      uFogColor: { value: fogColor.clone() },
      uFogNear: { value: fog.near ?? 900 },
      uFogFar: { value: fog.far ?? 1600 },
      uOpacity: { value: options.opacity ?? 0.86 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPosition;
      varying vec2 vWavePosition;
      void main() {
        vec3 displaced = position;
        vec2 p = position.xz;
        float layerA = sin(dot(p, vec2(0.041, 0.018)) + uTime * 0.92);
        float layerB = sin(dot(p, vec2(-0.024, 0.052)) - uTime * 0.63);
        displaced.y += layerA * 0.28 + layerB * 0.18;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = world.xyz;
        vWavePosition = p;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunDirection;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uOpacity;
      varying vec3 vWorldPosition;
      varying vec2 vWavePosition;
      void main() {
        float phaseA = dot(vWavePosition, vec2(0.041, 0.018)) + uTime * 0.92;
        float phaseB = dot(vWavePosition, vec2(-0.024, 0.052)) - uTime * 0.63;
        float cosineA = cos(phaseA) * 0.28;
        float cosineB = cos(phaseB) * 0.18;
        float slopeX = cosineA * 0.041 + cosineB * -0.024;
        float slopeZ = cosineA * 0.018 + cosineB * 0.052;
        vec3 normal = normalize(vec3(-slopeX, 1.0, -slopeZ));
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
        float glint = pow(max(dot(reflect(-uSunDirection, normal), viewDirection), 0.0), 72.0);
        float crossedWaves = sin(phaseA * 1.9) * sin(phaseB * 1.45) * 0.5 + 0.5;
        vec3 base = mix(uDeep, uShallow, 0.3 + crossedWaves * 0.24);
        vec3 color = mix(base, uSky, fresnel * 0.7) + vec3(1.0, 0.88, 0.64) * glint * 1.65;
        float distanceToEye = length(cameraPosition - vWorldPosition);
        float fogAmount = smoothstep(uFogNear, uFogFar, distanceToEye);
        color = mix(color, uFogColor, fogAmount);
        gl_FragColor = vec4(color, uOpacity * (1.0 - fogAmount * 0.28));
      }
    `,
  });
}

export function createWaterLayer(features, options = {}) {
  if (!features?.water?.river || !features?.water?.lake) {
    throw new TypeError('World features must include river and lake water data.');
  }
  const group = new THREE.Group();
  group.name = 'River and Mirror Lake water';
  const material = createWaterMaterial(options);
  const river = new THREE.Mesh(buildRiverGeometry(features.water.river), material);
  river.name = features.water.river.id;
  river.renderOrder = 4;
  group.add(river);
  const lake = new THREE.Mesh(buildLakeGeometry(features.water.lake), material);
  lake.name = features.water.lake.id;
  lake.renderOrder = 4;
  group.add(lake);
  if (options.scene) options.scene.add(group);
  return {
    group,
    river,
    lake,
    material,
    update(elapsedSeconds) {
      material.uniforms.uTime.value = elapsedSeconds;
    },
    setFog(color, near, far) {
      material.uniforms.uFogColor.value.set(color);
      material.uniforms.uFogNear.value = near;
      material.uniforms.uFogFar.value = far;
    },
    dispose() {
      river.geometry.dispose();
      lake.geometry.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}

