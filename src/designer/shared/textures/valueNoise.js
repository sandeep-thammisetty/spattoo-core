// ── Tileable value noise ──────────────────────────────────────────────────────────────────────
// The ONE place the procedural cream/fondant surfaces get their organic irregularity. An L×L lattice
// of deterministic pseudo-random heights (a plain LCG — no Math.random, so every build is reproducible
// and cacheable), wrap-indexed and bilinearly sampled with a hermite smooth-step. Wrapping the lattice
// indices modulo L makes the field tile seamlessly, so a repeated texture shows no seam.
//
// Returns a sampler `noise(x, y)` where x,y are in LATTICE units (integer step = one cell). Callers
// either sample raw fractional coords (cream-wave field) or pre-scale their UV by L / L·octave
// (grain, foam, fondant). `L` sets the feature size (small L = big blobs); `seed` the pattern.
export function makeValueNoise(L, seed) {
  const rand = new Float32Array(L * L);
  let s = seed;
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < L * L; i++) rand[i] = next();
  const latt = (xi, yi) => rand[((yi % L + L) % L) * L + ((xi % L + L) % L)];
  const smooth = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = latt(xi, yi),     b = latt(xi + 1, yi);
    const c = latt(xi, yi + 1), d = latt(xi + 1, yi + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
