import * as THREE from '../../../vendor/three.module.min.js';

const DEFAULT_SKIRT_DEPTH = 36;

function hexToRgb(hex, target, offset) {
  const value = Number.parseInt(hex.startsWith('#') ? hex.slice(1) : hex, 16);
  target[offset] = ((value >>> 16) & 255) / 255;
  target[offset + 1] = ((value >>> 8) & 255) / 255;
  target[offset + 2] = (value & 255) / 255;
}

export function createTerrainPalette(manifest) {
  const entries = manifest.encoding.splat.palette;
  const palette = new Float32Array(8 * 3);
  for (let index = 0; index < entries.length; index += 1) {
    hexToRgb(entries[index].color, palette, entries[index].id * 3);
  }
  return palette;
}

export function terrainTriangleCount(chunkSize, spacing) {
  const segments = chunkSize / spacing;
  return segments * segments * 2 + segments * 8;
}

function writeBiomeColor(colors, colorOffset, packedBiome, palette, normalY, height, darken = 1) {
  const primary = packedBiome & 7;
  const secondary = (packedBiome >>> 3) & 7;
  const blend = (packedBiome >>> 6) / 3;
  const p = primary * 3;
  const s = secondary * 3;
  let r = palette[p] + (palette[s] - palette[p]) * blend;
  let g = palette[p + 1] + (palette[s + 1] - palette[p + 1]) * blend;
  let b = palette[p + 2] + (palette[s + 2] - palette[p + 2]) * blend;

  // Steep surfaces expose rock, while altitude adds a restrained cold tint.
  const rock = 9;
  const steepness = Math.max(0, Math.min(0.72, (0.86 - normalY) * 1.55));
  r += (palette[rock] - r) * steepness;
  g += (palette[rock + 1] - g) * steepness;
  b += (palette[rock + 2] - b) * steepness;
  const altitude = Math.max(0, Math.min(0.16, (height - 280) / 1200));
  r += (0.86 - r) * altitude;
  g += (0.9 - g) * altitude;
  b += (0.91 - b) * altitude;
  const light = (0.8 + normalY * 0.2) * darken;
  colors[colorOffset] = r * light;
  colors[colorOffset + 1] = g * light;
  colors[colorOffset + 2] = b * light;
}

export function createTerrainGeometry(
  pack,
  manifest,
  entry,
  chunkX,
  chunkZ,
  spacing,
  palette,
  skirtDepth = DEFAULT_SKIRT_DEPTH,
) {
  const chunkSize = manifest.world.chunkSizeMeters;
  const sourceSpacing = manifest.encoding.height.resolutionMeters;
  const splatSpacing = manifest.encoding.splat.resolutionMeters;
  if (chunkSize % spacing !== 0 || spacing % sourceSpacing !== 0 || spacing % splatSpacing !== 0) {
    throw new Error(`Terrain spacing ${spacing} is incompatible with baked world samples.`);
  }

  const segments = chunkSize / spacing;
  const side = segments + 1;
  const topVertices = side * side;
  const skirtVertices = side * 4;
  const vertexCount = topVertices + skirtVertices;
  const triangleCount = terrainTriangleCount(chunkSize, spacing);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint16Array(triangleCount * 3);
  const heightStep = spacing / sourceSpacing;
  const splatStep = spacing / splatSpacing;
  const heightOffset = manifest.encoding.height.offsetMeters;
  const heightScale = manifest.encoding.height.scaleMeters;
  const heightSide = pack.heightSamples;
  const splatSide = pack.splatSamples;

  let vertex = 0;
  for (let z = 0; z <= segments; z += 1) {
    const heightZ = entry.heightStartZ + z * heightStep;
    const splatZ = entry.splatStartZ + z * splatStep;
    for (let x = 0; x <= segments; x += 1) {
      const heightX = entry.heightStartX + x * heightStep;
      const splatX = entry.splatStartX + x * splatStep;
      const sample = heightZ * heightSide + heightX;
      const y = heightOffset + pack.heights[sample] * heightScale;
      const left = heightZ * heightSide + Math.max(0, heightX - 1);
      const right = heightZ * heightSide + Math.min(heightSide - 1, heightX + 1);
      const back = Math.max(0, heightZ - 1) * heightSide + heightX;
      const front = Math.min(heightSide - 1, heightZ + 1) * heightSide + heightX;
      const nx0 = -(pack.heights[right] - pack.heights[left]) * heightScale / (sourceSpacing * 2);
      const nz0 = -(pack.heights[front] - pack.heights[back]) * heightScale / (sourceSpacing * 2);
      const inverseLength = 1 / Math.hypot(nx0, 1, nz0);
      const offset = vertex * 3;
      positions[offset] = x * spacing;
      positions[offset + 1] = y;
      positions[offset + 2] = z * spacing;
      normals[offset] = nx0 * inverseLength;
      normals[offset + 1] = inverseLength;
      normals[offset + 2] = nz0 * inverseLength;
      writeBiomeColor(colors, offset, pack.splats[splatZ * splatSide + splatX], palette, inverseLength, y);
      vertex += 1;
    }
  }

  let indexOffset = 0;
  for (let z = 0; z < segments; z += 1) {
    const row = z * side;
    const next = row + side;
    for (let x = 0; x < segments; x += 1) {
      const a = row + x;
      const b = a + 1;
      const c = next + x;
      const d = c + 1;
      indices[indexOffset++] = a;
      indices[indexOffset++] = c;
      indices[indexOffset++] = b;
      indices[indexOffset++] = b;
      indices[indexOffset++] = c;
      indices[indexOffset++] = d;
    }
  }

  // Duplicate all four edges and lower them. Separate edge copies preserve
  // crisp outward normals and hide mismatched neighboring LODs without cracks.
  for (let edge = 0; edge < 4; edge += 1) {
    const skirtStart = topVertices + edge * side;
    for (let step = 0; step <= segments; step += 1) {
      let top;
      let normalX = 0;
      let normalZ = 0;
      if (edge === 0) {
        top = step;
        normalZ = -1;
      } else if (edge === 1) {
        top = step * side + segments;
        normalX = 1;
      } else if (edge === 2) {
        top = segments * side + (segments - step);
        normalZ = 1;
      } else {
        top = (segments - step) * side;
        normalX = -1;
      }
      const source = top * 3;
      const target = (skirtStart + step) * 3;
      positions[target] = positions[source];
      positions[target + 1] = positions[source + 1] - skirtDepth;
      positions[target + 2] = positions[source + 2];
      normals[target] = normalX;
      normals[target + 1] = 0;
      normals[target + 2] = normalZ;
      colors[target] = colors[source] * 0.62;
      colors[target + 1] = colors[source + 1] * 0.62;
      colors[target + 2] = colors[source + 2] * 0.62;
    }
    for (let step = 0; step < segments; step += 1) {
      let top0;
      let top1;
      if (edge === 0) {
        top0 = step;
        top1 = step + 1;
      } else if (edge === 1) {
        top0 = step * side + segments;
        top1 = (step + 1) * side + segments;
      } else if (edge === 2) {
        top0 = segments * side + (segments - step);
        top1 = top0 - 1;
      } else {
        top0 = (segments - step) * side;
        top1 = top0 - side;
      }
      const skirt0 = skirtStart + step;
      const skirt1 = skirt0 + 1;
      indices[indexOffset++] = top0;
      indices[indexOffset++] = skirt0;
      indices[indexOffset++] = top1;
      indices[indexOffset++] = top1;
      indices[indexOffset++] = skirt0;
      indices[indexOffset++] = skirt1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.spacing = spacing;
  geometry.userData.triangleCount = triangleCount;
  geometry.userData.chunkX = chunkX;
  geometry.userData.chunkZ = chunkZ;
  return geometry;
}
