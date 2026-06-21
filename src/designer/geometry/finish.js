// ── Material finish: one "metallic → matte" slider ───────────────────────────
// A faux ball's finish is a single customer control, but a believable metallic↔matte
// continuum needs BOTH PBR params to move together: shiny metal = high metalness +
// low roughness; dull plastic/sugar = no metalness + high roughness. So one slider
// value `t` drives both. This is the ONE place that mapping lives (used by the
// control's onChange to write the material, and by the inverse to position the slider).
//
//   t = 0  → metallic (the DEFAULT, slider hard left)
//   t = 1  → matte    (slider hard right)
//
// The result { roughness, metalness } is the same shape the render path already reads
// (sticker.roughness / sticker.metalness → cleanGlbScene override) — no new render code.

export const FINISH_METALLIC = { metalness: 0.9, roughness: 0.15 };
export const FINISH_MATTE    = { metalness: 0.0, roughness: 0.90 };

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

// Slider position (0 metallic … 1 matte) → GLB material override.
export function finishToMaterial(t) {
  const u = clamp01(t);
  return {
    metalness: +lerp(FINISH_METALLIC.metalness, FINISH_MATTE.metalness, u).toFixed(3),
    roughness: +lerp(FINISH_METALLIC.roughness, FINISH_MATTE.roughness, u).toFixed(3),
  };
}

// Inverse: recover the slider position from a stored metalness, so the control shows
// where the customer left it. Absent/null → 0 (metallic, the default position).
export function finishOf(metalness) {
  if (metalness == null) return 0;
  const span = FINISH_METALLIC.metalness - FINISH_MATTE.metalness;   // 0.9
  return clamp01((FINISH_METALLIC.metalness - metalness) / span);
}
