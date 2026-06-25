import * as THREE from 'three';
import { heightfieldToNormalMap } from './heightfieldNormal.js';
import { makeValueNoise } from './valueNoise.js';

// Shared FONDANT surface — one procedurally-built, tileable, colour-agnostic NORMAL map reused by
// every element flagged `placement_config.useSharedFondantTexture`. It adds the soft sugar-paste
// micro-grain that makes a flat recolourable part read as fondant rather than plastic, under ANY
// chosen colour (the map carries surface bumps only, never colour). Built once, cached.

let _normalMap = null;

// Smooth value-noise height field → Sobel → tangent-space normal map (RGB), wrap-tiled so box-UVs
// can repeat it without visible seams at grain scale.
function buildFondantNormalMap(size = 256, strength = 0.6) {
  // tileable value noise: a small lattice of random heights, wrapped + bilinearly sampled (shared
  // helper); L=16 keeps it seamless on repeat. Sampled at u,v = x/size·L below.
  const L = 16;
  const noise = makeValueNoise(L, 1234567);
  // height = two octaves of the tiling noise
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * L, v = y / size * L;
    H[y * size + x] = noise(u, v) * 0.7 + noise(u * 2, v * 2) * 0.3;
  }

  // Sobel gradient → normal (shared packer; wrapped neighbours keep it seamless)
  return heightfieldToNormalMap(H, size, size, strength * size * 0.02);
}

export function getFondantNormalMap() {
  if (!_normalMap) _normalMap = buildFondantNormalMap();
  return _normalMap;
}

// Recompose parts export geometry with positions + normals only (no UVs). Box-project a UV from the
// vertex's dominant-normal axis so a tiling normal map maps cleanly; seams are invisible at grain
// scale. `tile` controls grain density (world units per texture repeat). Mutates the geometry.
export function applyBoxUVs(geometry, tile = 0.12) {
  if (!geometry?.attributes?.position) return;
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor) n.fromBufferAttribute(nor, i); else n.set(0, 0, 1);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, w;
    if (ax >= ay && ax >= az)      { u = p.z; w = p.y; } // project on X-facing
    else if (ay >= ax && ay >= az) { u = p.x; w = p.z; } // Y-facing
    else                           { u = p.x; w = p.y; } // Z-facing
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = w / tile;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
