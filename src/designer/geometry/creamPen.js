import * as THREE from 'three';

// ── Cream Pen (freehand piping) geometry ─────────────────────────────────────
// Ported from the admin prototype (FreehandPenStudio). LINE style only — the shell
// and rosette styles were dropped (they didn't read well). A stroke is the nozzle's
// cross-section profile swept along a centerline: a round tip gives a smooth rope, an
// open star gives a ribbed rope with grooves down its length, French gives fine ribs.
//
// IMPORTANT: the points handed to buildPipingStroke are the SEATED centerline already —
// the draw layer offsets each pointer hit along the surface normal (by the rope radius)
// at capture time, so the cream rests on the cake. This module is pure geometry: it just
// sweeps the profile through the stored points. That keeps design.piping a plain list of
// [x,y,z] points that fully determines the mesh on reload.

// A piping tip is a CROSS-SECTION at unit radius (max reach = 1); thickness scales it.
function starProfile(spikes, inner) {
  const out = [];
  for (let i = 0; i < spikes; i++) {
    const a0 = (i / spikes) * Math.PI * 2;          // outer point
    const a1 = ((i + 0.5) / spikes) * Math.PI * 2;  // valley between points
    out.push([Math.cos(a0), Math.sin(a0)]);
    out.push([Math.cos(a1) * inner, Math.sin(a1) * inner]);
  }
  return out;
}
function roundProfile(n) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push([Math.cos(a), Math.sin(a)]); }
  return out;
}

// spikes = rib count · inner = valley depth (smaller = deeper grooves)
export const NOZZLES = [
  { key: 'round',  label: 'Round',       hint: 'Writing / smooth rope', profile: roundProfile(16) },
  { key: 'star5',  label: 'Open Star',   hint: '1M — the classic',      profile: starProfile(5, 0.55) },
  { key: 'star6',  label: '6-Star',      hint: 'Tighter ribs',          profile: starProfile(6, 0.55) },
  { key: 'closed', label: 'Closed Star', hint: 'Deep grooves',          profile: starProfile(6, 0.40) },
  { key: 'french', label: 'French',      hint: 'Fine fluted ribs',      profile: starProfile(14, 0.82) },
];
export const NOZZLE_BY_KEY = Object.fromEntries(NOZZLES.map(n => [n.key, n]));
export const DEFAULT_NOZZLE = 'star5';

// Sweep a profile along a centerline: sample a CatmullRom through the control points,
// build Frenet frames (a stable normal/binormal plane per sample), drop the profile ring
// at radius radiusAt(i, segs), stitch the rings, and fan-cap both ends (rounded tips).
// Appends into shared pos/idx arrays so a geometry can hold several strokes if needed.
function pushSweep(pos, idx, controlPts, profile, radiusAt) {
  const curve = new THREE.CatmullRomCurve3(controlPts, false, 'catmullrom', 0.5);
  const segs = Math.min(800, Math.max(20, controlPts.length * 4));
  const samples = curve.getPoints(segs);                 // segs + 1
  const frames = curve.computeFrenetFrames(segs, false);
  const P = profile.length;
  const base = pos.length / 3;

  for (let i = 0; i <= segs; i++) {
    const C = samples[i], N = frames.normals[i], B = frames.binormals[i], r = radiusAt(i, segs);
    for (let j = 0; j < P; j++) {
      const px = profile[j][0] * r, py = profile[j][1] * r;
      pos.push(C.x + N.x * px + B.x * py, C.y + N.y * px + B.y * py, C.z + N.z * px + B.z * py);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < P; j++) {
      const a = base + i * P + j, b = base + i * P + (j + 1) % P;
      const c = base + (i + 1) * P + j, d = base + (i + 1) * P + (j + 1) % P;
      idx.push(a, c, b, b, c, d);
    }
  }
  const r0 = radiusAt(0, segs), rn = radiusAt(segs, segs);
  const sC = samples[0].clone().addScaledVector(frames.tangents[0], -r0 * 0.6);
  const eC = samples[segs].clone().addScaledVector(frames.tangents[segs], rn * 0.6);
  const sI = pos.length / 3; pos.push(sC.x, sC.y, sC.z);
  const eI = pos.length / 3; pos.push(eC.x, eC.y, eC.z);
  for (let j = 0; j < P; j++) {
    idx.push(sI, base + (j + 1) % P, base + j);
    idx.push(eI, base + segs * P + j, base + segs * P + (j + 1) % P);
  }
}

function finishGeo(pos, idx) {
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const toVec = p => (p instanceof THREE.Vector3 ? p : new THREE.Vector3(p[0], p[1], p[2]));

// Build one freehand stroke: sweep the chosen nozzle profile (constant radius) through the
// seated centerline points. `points` is [[x,y,z]…] or Vector3[]. Returns a BufferGeometry,
// or null if there's nothing to draw.
export function buildPipingStroke(points, nozzleKey, thickness) {
  const profile = (NOZZLE_BY_KEY[nozzleKey] || NOZZLE_BY_KEY[DEFAULT_NOZZLE]).profile;
  let pts = points.map(toVec).filter((p, i, a) => i === 0 || p.distanceTo(a[i - 1]) > 1e-4);
  if (pts.length === 0) return null;
  // A lone tap can't sweep — stub it upward so a dot still reads as piped cream.
  if (pts.length === 1) pts = [pts[0], pts[0].clone().add(new THREE.Vector3(0, Math.max(0.02, thickness), 0))];
  const pos = [], idx = [];
  pushSweep(pos, idx, pts, profile, () => thickness);
  return finishGeo(pos, idx);
}
