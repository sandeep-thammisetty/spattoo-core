// ── Sphere packing ────────────────────────────────────────────────────────────
// Pure 3D geometry for packing balls so they touch without overlapping. Extracted from the (removed)
// faux-ball cluster code as the reusable seed for the config-driven ball-cluster feature: a packer
// places each new ball tangent to existing ones, which is the Apollonius tangency solved here.

// 3-sphere Apollonius: centre of a ball of radius rG that is tangent to spheres P1,P2,P3 (each given
// as a [x,y,z] centre + radius). Returns the topmost (max-y) solution, or null when the three centres
// are collinear / no real solution. Subtract sphere equations pairwise to get two planes, intersect
// for a line, then solve the quadratic for the point on that line lying on sphere-1.
export function apollo3(P1, rP1, P2, rP2, P3, rP3, rG) {
  const R1 = rP1 + rG, R2 = rP2 + rG, R3 = rP3 + rG;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const d12 = [P2[0] - P1[0], P2[1] - P1[1], P2[2] - P1[2]];
  const d23 = [P3[0] - P2[0], P3[1] - P2[1], P3[2] - P2[2]];
  const n = cross(d12, d23);
  const nn = dot(n, n);
  if (nn < 1e-12) return null;
  const b1 = (R1 * R1 - R2 * R2 + dot(P2, P2) - dot(P1, P1)) / 2;
  const b2 = (R2 * R2 - R3 * R3 + dot(P3, P3) - dot(P2, P2)) / 2;
  const G0 = sc(add(sc(cross(d23, n), b1), sc(cross(n, d12), b2)), 1 / nn);
  const nLen = Math.sqrt(nn);
  const nu = sc(n, 1 / nLen);
  const v = [G0[0] - P1[0], G0[1] - P1[1], G0[2] - P1[2]];
  const bq = 2 * dot(v, nu), cq = dot(v, v) - R1 * R1;
  const disc = bq * bq - 4 * cq;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const C1 = add(G0, sc(nu, (-bq + sq) / 2));
  const C2 = add(G0, sc(nu, (-bq - sq) / 2));
  return C1[1] >= C2[1] ? C1 : C2;
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Greedy 3D pack of mixed-size balls into ONE compact clump resting on a flat surface (plane y=0),
// growing from a seed at the anchor. Every ball after the seed TOUCHES at least one placed ball and
// NONE overlap, so the cluster reads as a single group (Phase-B requirements #3–#5). Pure +
// deterministic (candidate angles on a fixed grid, no RNG) so it's unit-testable in isolation.
//
//   count — total number of balls
//   radii — the mix of radii to draw from; radii[0] is the seed (put the biggest first — reads best)
//
// Returns [{ x, y, z, r }] in the surface-local frame (anchor at origin, y = centre height above the
// surface). B1 covers the TOP surface only; B3 will extend the same candidate model over the rim and
// down the side wall. Candidates are (a) resting on the surface tangent to one placed ball, and
// (b) nestled in a pocket tangent to three placed balls (apollo3). The lowest, most central valid
// candidate wins, so the clump stays grounded and compact rather than sprawling.
export function packClusterOnSurface({ count, radii }) {
  const EPS = 1e-4;
  const TOUCH_TOL = 1e-2;
  const ANGLES = 24;
  if (!count || count < 1 || !radii?.length) return [];
  const balls = [{ c: [0, radii[0], 0], r: radii[0] }];   // seed on the surface at the anchor
  const overlapsAny = (c, r) => balls.some(b => dist3(c, b.c) < b.r + r - EPS);
  const touchesAny  = (c, r) => balls.some(b => Math.abs(dist3(c, b.c) - (b.r + r)) < TOUCH_TOL);

  for (let i = 1; i < count; i++) {
    const r = radii[i % radii.length];
    // Grow as a COMPACT 3D mound (balanced horizontal + vertical), not a flat disc: score each
    // candidate by distance to the current cluster centroid, so the clump fills inward/upward into
    // pockets rather than only spreading sideways. y >= r keeps it resting on the surface, so the
    // result is a rounded hemispherical pile.
    const n = balls.length;
    const centroid = [
      balls.reduce((a, b) => a + b.c[0], 0) / n,
      balls.reduce((a, b) => a + b.c[1], 0) / n,
      balls.reduce((a, b) => a + b.c[2], 0) / n,
    ];
    let best = null, bestScore = Infinity;
    const consider = (c) => {
      if (!c || c[1] < r - EPS) return;            // null / below the surface
      if (overlapsAny(c, r) || !touchesAny(c, r)) return;
      const score = dist3(c, centroid);            // tightest to the centroid wins → compact mound
      if (score < bestScore) { bestScore = score; best = c; }
    };
    // (a) resting on the surface (centre at y=r), tangent to a placed ball
    for (const b of balls) {
      const dh2 = (b.r + r) ** 2 - (b.c[1] - r) ** 2;   // horizontal distance² for surface tangency
      if (dh2 <= 0) continue;
      const dh = Math.sqrt(dh2);
      for (let a = 0; a < ANGLES; a++) {
        const th = (a / ANGLES) * 2 * Math.PI;
        consider([b.c[0] + dh * Math.cos(th), r, b.c[2] + dh * Math.sin(th)]);
      }
    }
    // (b) nestled in a pocket: tangent to three placed balls
    for (let p = 0; p < balls.length; p++)
      for (let q = p + 1; q < balls.length; q++)
        for (let s = q + 1; s < balls.length; s++)
          consider(apollo3(balls[p].c, balls[p].r, balls[q].c, balls[q].r, balls[s].c, balls[s].r, r));

    if (!best) break;   // nowhere valid to place (degenerate inputs)
    balls.push({ c: best, r });
  }
  return balls.map(b => ({ x: b.c[0], y: b.c[1], z: b.c[2], r: b.r }));
}
