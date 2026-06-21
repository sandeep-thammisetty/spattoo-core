import { describe, it, expect } from 'vitest';
import { applyTextureConfig, styleDef, resolveStyleParams } from './creamStyles.js';
import { makeWallReliefSampler } from './geometry/creamWall.js';

// The wall relief SAMPLER lets side decor hug the live displaced surface: (theta, v) → local radial
// relief in world units. It mirrors the displacement strategies (reuses the wave field; same swirl
// formula), so it must stay bounded by the strategy's amplitude and return null for flat walls.
describe('makeWallReliefSampler — samples the same surface the wall is built from', () => {
  it('wave: local relief is bounded by relief × radius and stands proud', () => {
    const params = resolveStyleParams('wave');          // relief default 0.06
    const radius = 2;
    const s = makeWallReliefSampler('wave', radius, params);
    expect(typeof s).toBe('function');
    let max = -Infinity;
    for (let t = -Math.PI; t < Math.PI; t += 0.25) {
      for (let v = 0; v <= 1; v += 0.1) {
        const r = s(t, v);
        expect(Math.abs(r)).toBeLessThanOrEqual(0.06 * radius + 1e-6);   // |height|·mask ≤ 1
        if (r > max) max = r;
      }
    }
    expect(max).toBeGreaterThan(0.02);                  // the ribs actually stand proud of the wall
  });

  it('swirl: corrugation swings both ways, bounded by amp × radius', () => {
    const params = resolveStyleParams('swirl');          // amp default 0.045
    const radius = 2;
    const s = makeWallReliefSampler('swirl', radius, params);
    let min = Infinity, max = -Infinity;
    for (let t = -Math.PI; t < Math.PI; t += 0.2) {
      for (let v = 0; v <= 1; v += 0.1) { const r = s(t, v); min = Math.min(min, r); max = Math.max(max, r); }
    }
    expect(max).toBeLessThanOrEqual(0.045 * radius + 1e-6);
    expect(min).toBeGreaterThanOrEqual(-0.045 * radius - 1e-6);
    expect(min).toBeLessThan(0);                          // swirl dips IN as well as out
    expect(max).toBeGreaterThan(0);
  });

  it('flat walls (smooth / normal-map) have no sampler', () => {
    expect(makeWallReliefSampler('smooth', 1, {})).toBeNull();
    expect(makeWallReliefSampler(styleDef('rustic').wall, 1, {})).toBeNull();  // rustic wall is 'smooth'
  });
});

describe('applyTextureConfig — DB overlay falls back to the seed for omitted fields', () => {
  it('a partial DB row keeps the seed wall/params', () => {
    applyTextureConfig([{ key: 'wave', label: 'Cream Wave' }]);   // no algorithm / config
    expect(styleDef('wave').wall).toBe('wave');
    expect(styleDef('wave').params.length).toBeGreaterThan(0);
  });

  it('a brand-new DB texture is usable from its row alone', () => {
    applyTextureConfig([{ key: 'newgeo', label: 'New Geo', algorithm: 'wave',
      config: { params: [{ key: 'relief', default: 0.05 }] } }]);
    expect(styleDef('newgeo').wall).toBe('wave');
    expect(resolveStyleParams('newgeo').relief).toBeCloseTo(0.05, 6);
  });
});
