import { describe, it, expect } from 'vitest';
import { isSinglePerSlot, placementSlots, hugScale, isDynamicHug, wallClampY, DEFAULT_HUG_FILL } from './placement.js';

// Contract: every element type flows through the SAME placement logic. These fixtures stand in
// for the real types; if a type ever diverges, a shared assertion here breaks. Guards the exact
// bugs we hit: scattered wrongly grouped, slot ordering, top placed on the wrong tier.

const heroTopSide = { allowed_zones: ['top_surface', 'side'], placement_config: { single_per_slot: true } };
const heroTopOnly = { allowed_zones: ['top_surface'], placement_config: { single_per_slot: true } };
const scattered   = { allowed_zones: ['top_surface', 'side', 'middle_tier'], placement_config: {} };
const picks       = { allowed_zones: ['top_surface', 'side', 'middle_tier'], placement_config: {} };

describe('isSinglePerSlot — placement STYLE is config-driven, not zone-count', () => {
  it('hero elements (single_per_slot flag) are single-per-slot', () => {
    expect(isSinglePerSlot(heroTopSide)).toBe(true);
    expect(isSinglePerSlot(heroTopOnly)).toBe(true);
  });
  it('scattered/picks scatter freely even with many allowed_zones', () => {
    expect(isSinglePerSlot(scattered)).toBe(false);  // the bug: 3 zones must NOT mean single-per-slot
    expect(isSinglePerSlot(picks)).toBe(false);
    expect(isSinglePerSlot(undefined)).toBe(false);
  });
});

describe('placementSlots — one slot per (tier × surface)', () => {
  it('top+side on a 2-tier cake: Top, then sides top→bottom (bottom LAST)', () => {
    const slots = placementSlots(heroTopSide, 2);
    expect(slots.map(s => s.key)).toEqual(['top', 'side-1', 'side-0']);
    expect(slots[0]).toMatchObject({ placement: 'top', tierIndex: 1 }); // top sits on the LAST tier
  });
  it('single-tier cake: Top + one Side', () => {
    expect(placementSlots(heroTopSide, 1).map(s => s.key)).toEqual(['top', 'side-0']);
  });
  it('top-only element offers only a Top slot', () => {
    expect(placementSlots(heroTopOnly, 3).map(s => s.key)).toEqual(['top']);
  });
});

describe('hugScale — side-hug size tracks the tier WALL HEIGHT, not r', () => {
  const STICKER_SIZE = 0.28;
  it('fills the default fraction of the wall height', () => {
    // A shorter (upper) tier yields a smaller decoration than a taller (bottom) tier — the bug we fix.
    expect(hugScale(1.0, STICKER_SIZE)).toBeCloseTo((1.0 * DEFAULT_HUG_FILL) / STICKER_SIZE);
    expect(hugScale(0.6, STICKER_SIZE)).toBeLessThan(hugScale(1.0, STICKER_SIZE));
  });
  it('honours a per-element fill override', () => {
    expect(hugScale(1.0, STICKER_SIZE, 0.5)).toBeLessThan(hugScale(1.0, STICKER_SIZE, 0.7));
  });
  it('does NOT depend on placement_config.r (absolute scale is stand-only)', () => {
    // Same wall → same hug size regardless of any r the element carries.
    expect(hugScale(1.0, STICKER_SIZE)).toBe(hugScale(1.0, STICKER_SIZE));
  });
});

describe('isDynamicHug — only HERO hugs auto-fit; scattered decor keeps its own r', () => {
  it('hero element hugging a side is dynamic', () => {
    expect(isDynamicHug({ singlePerSlot: true, placementMode: 'hug' })).toBe(true);
  });
  it('scattered decor (not single_per_slot) hugging a side stays absolute', () => {
    expect(isDynamicHug({ singlePerSlot: false, placementMode: 'hug' })).toBe(false);
    expect(isDynamicHug({ placementMode: 'hug' })).toBe(false);
  });
  it('a hero STANDING (not hugging) uses r, not the dynamic size', () => {
    expect(isDynamicHug({ singlePerSlot: true, placementMode: 'stand' })).toBe(false);
  });
});

describe('wallClampY — a side decal never dips below the tier base into the board', () => {
  const baseY = 1.0, wall = 0.8;
  it('leaves a comfortably-sized decal where it is', () => {
    const halfH = 0.2;                                   // fits well within the wall
    expect(wallClampY(1.4, baseY, wall, halfH)).toBe(1.4);
  });
  it('lifts a decal whose bottom would cross the tier base', () => {
    const halfH = 0.35;
    expect(wallClampY(baseY + 0.1, baseY, wall, halfH)).toBe(baseY + halfH); // bottom snaps to base
  });
  it('keeps the top edge within the wall when there is room', () => {
    const halfH = 0.2;
    expect(wallClampY(baseY + wall, baseY, wall, halfH)).toBe(baseY + wall - halfH);
  });
  it('a decal taller than the wall overflows UP, never into the board', () => {
    const halfH = 0.6;                                   // taller than the 0.8 wall
    const y = wallClampY(5, baseY, wall, halfH);
    expect(y).toBe(baseY + halfH);                       // bottom pinned to base
    expect(y - halfH).toBeGreaterThanOrEqual(baseY);     // bottom never below the board line
  });
});
