#!/usr/bin/env node
// Quality gate: the element RENDERER (src/designer/canvas/**) must stay config-driven — it
// dispatches on zone + placementMode, never on an element's DB type/slug. A type/slug literal
// here means a parallel, per-type render path is creeping back (see src/designer/INVARIANTS.md).
// Zone/mode strings ('side', 'top_surface', 'stand', 'hug', …) are the config-driven dispatch
// and are intentionally allowed; only element-TYPE slugs are banned.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src/designer/canvas';
const SLUGS = [
  'topper', 'top_side_decors', 'scattered_decor', 'picks', 'image_topper',
  'cream_piping', 'piping_pattern', 'piping_stamp', 'faux_ball', 'grouped_elements',
];
const slugRe = new RegExp(`['"\`](${SLUGS.join('|')})['"\`]`);
const identRe = /\bCakeTopper\b/;   // the deleted per-type renderer must not return

// A placement MODE must be read from placement_config[zone] — NEVER derived from the zone name in a
// ternary (the `top → stand` class of bug; INVARIANTS #1: never force a per-zone default). We flag a
// line only when it BOTH references a zone AND has a ternary whose result is a placement mode — so
// legit `placementMode === 'stand'` dispatch and uniform `?? 'hug'` data-layer defaults are fine.
// Scanned across the popup/picker code too, not just canvas/.
const MODE_FILES = ['src/designer/CakeDesigner.jsx'];
const zoneRe     = /ZONES\.(TOP_SURFACE|SIDE|BOARD|RIM|MIDDLE_TIER)|['"`](top_surface|side|board|rim|middle_tier)['"`]/;
const zoneModeRe = /\?\s*\(?\s*(PLACEMENT_MODES\.(STAND|HUG|FAUX\w*)|['"`](stand|hug|faux_balls|faux_ball_single)['"`])/;
const isZoneModeDefault = line => zoneRe.test(line) && zoneModeRe.test(line);

const stripComments = src => src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))  // block comments (keep line count)
  .replace(/(^|[^:])\/\/.*$/gm, '$1');                          // line comments (not URLs `://`)

const walk = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : (/\.(jsx?|tsx?)$/.test(f) ? [p] : []);
});

const violations = [];
// canvas/ renderer: no element-type/slug branch, no per-type renderer, no per-zone mode default.
for (const file of walk(ROOT)) {
  stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
    if (slugRe.test(line) || identRe.test(line) || isZoneModeDefault(line)) {
      violations.push(`  ${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}
// popup/picker code (CakeDesigner.jsx): the per-zone mode-default ban (the `top → stand` class).
for (const file of MODE_FILES) {
  stripComments(readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
    if (isZoneModeDefault(line)) violations.push(`  ${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
  });
}

if (violations.length) {
  console.error('\n✗ check:paths — config-driven placement violated.');
  console.error('  No element-type/slug branch or parallel per-type renderer in canvas/, and NEVER');
  console.error('  derive a placement MODE from a zone (read placement_config[zone]). See INVARIANTS.md.\n');
  console.error(violations.join('\n') + '\n');
  process.exit(1);
}
console.log('✓ check:paths — config-driven (no type branching, no per-zone mode defaults)');
