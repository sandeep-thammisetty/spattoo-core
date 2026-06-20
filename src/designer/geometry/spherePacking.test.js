import { describe, it, expect } from 'vitest';
import { apollo3, packClusterOnSurface } from './spherePacking.js';

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('apollo3 — tangent to three spheres', () => {
  it('places a unit ball tangent to three unit balls, topmost solution', () => {
    // Three unit balls on the y=0 plane; a fourth unit ball nestles in the pocket above.
    const P1 = [0, 1, 0], P2 = [2, 1, 0], P3 = [1, 1, Math.sqrt(3)];
    const g = apollo3(P1, 1, P2, 1, P3, 1, 1);
    expect(g).not.toBeNull();
    for (const P of [P1, P2, P3]) expect(dist3(g, P)).toBeCloseTo(2, 3);   // tangent (1+1)
    expect(g[1]).toBeGreaterThan(1);   // nestled ABOVE the seed plane (topmost)
  });

  it('returns null for collinear centres', () => {
    expect(apollo3([0, 0, 0], 1, [2, 0, 0], 1, [4, 0, 0], 1, 1)).toBeNull();
  });
});

describe('packClusterOnSurface — the cluster invariants (#3–#5)', () => {
  const radii = [1.5, 1.0, 0.6];
  const balls = packClusterOnSurface({ count: 14, radii });

  it('produces the requested number of balls', () => {
    expect(balls).toHaveLength(14);
  });

  it('uses a MIX of sizes (#3)', () => {
    expect(new Set(balls.map(b => b.r)).size).toBeGreaterThan(1);
  });

  it('NO ball penetrates another (#5)', () => {
    for (let i = 0; i < balls.length; i++)
      for (let j = i + 1; j < balls.length; j++) {
        const d = dist3([balls[i].x, balls[i].y, balls[i].z], [balls[j].x, balls[j].y, balls[j].z]);
        expect(d).toBeGreaterThanOrEqual(balls[i].r + balls[j].r - 1e-3);
      }
  });

  it('every ball TOUCHES at least one other (#4/#5)', () => {
    for (let i = 0; i < balls.length; i++) {
      const touches = balls.some((b, j) =>
        j !== i &&
        Math.abs(dist3([balls[i].x, balls[i].y, balls[i].z], [b.x, b.y, b.z]) - (balls[i].r + b.r)) < 1e-2);
      expect(touches).toBe(true);
    }
  });

  it('all balls rest ON or ABOVE the surface (no sinking)', () => {
    for (const b of balls) expect(b.y).toBeGreaterThanOrEqual(b.r - 1e-3);
  });

  it('seed is the first/biggest ball at the anchor', () => {
    expect(balls[0]).toMatchObject({ x: 0, z: 0, r: 1.5 });
  });

  it('degenerate inputs are safe', () => {
    expect(packClusterOnSurface({ count: 0, radii })).toEqual([]);
    expect(packClusterOnSurface({ count: 5, radii: [] })).toEqual([]);
    expect(packClusterOnSurface({ count: 1, radii })).toHaveLength(1);
  });
});
