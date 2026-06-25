import { finishCanvasSize, finishDiskCanvasSize, mkCtx, clearCtx, ctxTexture, gray } from './finishCanvas.js';
import { stampDustFlecks, LUSTER_DUST_DEFAULTS } from './lusterDust.js';
import { stampFoilFlakes, GOLD_LEAF_DEFAULTS } from './goldLeafFlakes.js';

// Polar coordinate mapper for the flat TOP disk: a flake's (u,v) is (angle/2π, radial fraction 0→rim).
// It maps onto a SQUARE canvas that a PlaneGeometry(2R) decal (flipY texture) samples, so the same
// (u,v) places the shard here AND positions its drag handle in world space (see FinishHandles top
// branch — both use worldX=v·R·sinθ, worldZ=v·R·cosθ). No seam wrap (a disk has no seam).
function topDiskProject(S, radius) {
  const half = S / 2;
  return {
    pxPerWorld: S / (2 * radius),     // disk spans 2R world across S px
    place(f) {
      const th = (f.u ?? 0) * Math.PI * 2;
      const r = f.v ?? 0;
      return [[half + half * r * Math.sin(th), half + half * r * Math.cos(th)]];
    },
  };
}

// ── Unified particle-finish compositor ────────────────────────────────────────
// A tier wall can carry luster dust AND gold leaf at once, but a material has ONE map slot per channel
// — so both finishes bake into ONE set of maps. The base fills carry the cake's own colour + surface
// metalness/roughness (so non-finish wall is untouched); dust specks and gold-leaf shards stamp
// ABSOLUTE metalness/roughness greys on top. The material binds these with metalness/roughness SCALARS
// = 1, so each particle keeps its own metalness/roughness regardless of the other finish.
//
// Drag/add rebuilds this every change, so it REUSES the caller's canvases + textures (pass `reuse`):
// it redraws into the same canvases and flags the same textures for re-upload instead of allocating
// fresh ones each frame (allocation/GC + new-texture churn was the drag cost). The normal map is not
// produced — the designer keeps the cream grain normal, so a finish normal would be unused.
export function makeParticleFinishMaps({
  surface = 'side', radius = 1, height = 2.2, baseColor = '#ffffff', surfRoughness = 0.68, surfMetalness = 0,
  dusting = null, foil = null, reuse = null,
}) {
  // The flat top is a disk decal (polar map, square canvas); every other surface is the wall unwrap.
  const top = surface === 'top_surface';
  const { WU, Wc, Hc } = top ? finishDiskCanvasSize(radius) : finishCanvasSize(radius, height);
  const reusable = reuse && reuse._w === Wc && reuse._h === Hc;

  let alb, met, rou, emi;
  if (reusable) {
    ({ alb, met, rou, emi } = reuse._ctx);
    clearCtx(alb, baseColor, Wc, Hc);
    clearCtx(met, gray(surfMetalness), Wc, Hc);
    clearCtx(rou, gray(surfRoughness), Wc, Hc);
    clearCtx(emi, '#000000', Wc, Hc);
  } else {
    alb = mkCtx(baseColor, Wc, Hc);
    met = mkCtx(gray(surfMetalness), Wc, Hc);
    rou = mkCtx(gray(surfRoughness), Wc, Hc);
    emi = mkCtx('#000000', Wc, Hc);
  }

  if (!top && dusting?.splashes?.length) {   // dust is a wall flick — top-surface dust is not offered
    const d = { ...LUSTER_DUST_DEFAULTS, ...dusting };
    stampDustFlecks({
      alb, met, rou, emi, nrm: null, Wc, Hc, WU, radius, height,
      dustColor: d.dustColor, density: d.density, fleckSize: d.fleckSize, sizeVar: d.sizeVar,
      sparkle: d.sparkle, glitter: d.glitter, falloff: d.falloff, scatter: d.scatter,
      directionality: d.directionality, splashes: dusting.splashes, seed: 1337,
      metalFill: gray(d.metalness ?? 0.2),
      roughFill: gray(surfRoughness * (d.sparkle ?? 0.36)),
    });
  }
  if (foil?.flakes?.length) {
    const fin = { ...GOLD_LEAF_DEFAULTS, ...(foil.finish ?? {}) };
    stampFoilFlakes({
      alb, met, rou, emi, Wc, Hc, height,
      leafColor: foil.color ?? '#e6be4a',
      metalness: fin.metalness, roughness: fin.roughness, sizeScale: fin.sizeScale, raggedness: fin.raggedness,
      flakes: foil.flakes, seed: 99,
      project: top ? topDiskProject(Wc, radius) : null,
    });
  }

  if (reusable) {
    reuse.map.needsUpdate = true;
    reuse.metalnessMap.needsUpdate = true;
    reuse.roughnessMap.needsUpdate = true;
    reuse.emissiveMap.needsUpdate = true;
    return reuse;   // SAME object → stable ref downstream (no shader recompile, no React churn)
  }
  return {
    map: ctxTexture(alb, true), metalnessMap: ctxTexture(met), roughnessMap: ctxTexture(rou),
    emissiveMap: ctxTexture(emi, true), normalMap: null,
    _ctx: { alb, met, rou, emi }, _w: Wc, _h: Hc,
  };
}
