import { describe, it, expect } from 'vitest';
import { finishToMaterial, finishOf, FINISH_METALLIC, FINISH_MATTE } from './finish.js';

describe('finishToMaterial — one metallic→matte slider', () => {
  it('t=0 is fully metallic (the default)', () => {
    expect(finishToMaterial(0)).toEqual(FINISH_METALLIC);
  });

  it('t=1 is fully matte', () => {
    expect(finishToMaterial(1)).toEqual(FINISH_MATTE);
  });

  it('t=0.5 lands halfway on both params', () => {
    const m = finishToMaterial(0.5);
    expect(m.metalness).toBeCloseTo(0.45, 3);
    expect(m.roughness).toBeCloseTo(0.525, 3);
  });

  it('metalness falls and roughness rises as t increases', () => {
    const a = finishToMaterial(0.2), b = finishToMaterial(0.8);
    expect(b.metalness).toBeLessThan(a.metalness);
    expect(b.roughness).toBeGreaterThan(a.roughness);
  });

  it('clamps out-of-range t', () => {
    expect(finishToMaterial(-1)).toEqual(FINISH_METALLIC);
    expect(finishToMaterial(2)).toEqual(FINISH_MATTE);
  });
});

describe('finishOf — inverse for slider position', () => {
  it('absent metalness → 0 (metallic default)', () => {
    expect(finishOf(null)).toBe(0);
    expect(finishOf(undefined)).toBe(0);
  });

  it('round-trips a slider position through the material and back', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(finishOf(finishToMaterial(t).metalness)).toBeCloseTo(t, 2);
    }
  });
});
