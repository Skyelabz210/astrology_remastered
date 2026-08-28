// test/present/zodiac-globe.test.js — the zodiac stencil the landing globe
// wears (zodiac-globe.js), and its coupling to the app's sign table.
//
// Two things are asserted here.
//
// 1. The stencil's own SIGN_GLYPHS table is a second copy of astro.jsx's
//    ZODIAC name/glyph columns — unavoidable, because astro.jsx is a .jsx
//    classic script Node cannot import and the stencil has to be loadable
//    here. So, in the same spirit as present/defaults.test.js, this suite
//    IS the coupling: it reads astro.jsx's source and fails if the two
//    tables ever drift apart in order, name, or glyph.
//
// 2. The pure arithmetic globe.jsx leans on every frame: the
//    pick-a-different-sign draw (which must never pick the sign already
//    showing, or the globe visibly stalls for a beat), the cycle clock,
//    the fade weights (whose defining property is that the outgoing and
//    incoming glyphs are never both on screen — two superimposed line
//    glyphs are unreadable), and the screen-space stencil mapping.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SIGN_GLYPHS, DEFAULT_CYCLE, GLYPH_BOX_RATIO, MASK_SIZE,
  nextSignIndex, startCycle, advanceCycle, fadeWeights, stencilUV, maskIndex,
} from "../../zodiac-globe.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

/** Pull the `name`/`glyph` columns out of astro.jsx's ZODIAC table. */
function astroZodiac() {
  const src = readFileSync(join(ROOT, "astro.jsx"), "utf8");
  const block = src.match(/const\s+ZODIAC\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return null;
  const rows = [...block[1].matchAll(/\{\s*name:\s*"([^"]+)"\s*,\s*glyph:\s*"([^"]+)"/g)];
  return rows.map((m) => ({ name: m[1], glyph: m[2] }));
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── the table, and its coupling to astro.jsx ──
  t("SIGN_GLYPHS has twelve signs", SIGN_GLYPHS.length === 12, `got ${SIGN_GLYPHS.length}`);
  t("SIGN_GLYPHS opens on Aries and closes on Pisces",
    SIGN_GLYPHS[0].name === "Aries" && SIGN_GLYPHS[11].name === "Pisces",
    `${SIGN_GLYPHS[0].name}…${SIGN_GLYPHS[11].name}`);
  t("every glyph is a single U+2648–2653 sign character",
    SIGN_GLYPHS.every((s, i) => s.glyph.codePointAt(0) === 0x2648 + i && [...s.glyph].length === 1),
    SIGN_GLYPHS.map((s) => s.glyph).join(""));

  const zod = astroZodiac();
  t("astro.jsx's ZODIAC table is readable", Array.isArray(zod) && zod.length === 12,
    zod ? `parsed ${zod.length} rows` : "regex found no table");
  if (zod && zod.length === 12) {
    const mismatch = SIGN_GLYPHS
      .map((s, i) => (s.name === zod[i].name && s.glyph === zod[i].glyph ? null : `${i}: ${s.name}/${s.glyph} ≠ ${zod[i].name}/${zod[i].glyph}`))
      .filter(Boolean);
    t("stencil signs match astro.jsx's ZODIAC, in order", mismatch.length === 0, mismatch.join("; "));
  }

  // ── nextSignIndex ──
  let everRepeated = false;
  for (let cur = 0; cur < 12; cur++) {
    for (let k = 0; k < 1000; k++) {
      const got = nextSignIndex(cur, k / 1000);
      if (got === cur || !Number.isInteger(got) || got < 0 || got > 11) everRepeated = true;
    }
  }
  t("nextSignIndex never returns the sign already showing", !everRepeated);

  const reachable = new Set();
  for (let k = 0; k < 1000; k++) reachable.add(nextSignIndex(4, k / 1000));
  t("nextSignIndex can reach all eleven other signs", reachable.size === 11 && !reachable.has(4),
    `reached ${reachable.size}`);

  // Uniformity: 11 outcomes over a swept r should each land within a few
  // percent of 1/11 — a lopsided draw would park the globe on one sign.
  const counts = new Map();
  const N = 11000;
  for (let k = 0; k < N; k++) {
    const i = nextSignIndex(0, k / N);
    counts.set(i, (counts.get(i) || 0) + 1);
  }
  const spread = Math.max(...counts.values()) - Math.min(...counts.values());
  t("nextSignIndex draws the eleven others uniformly", spread <= 1, `count spread ${spread}`);

  t("nextSignIndex clamps r = 1 inside the table", nextSignIndex(0, 1) === 11, String(nextSignIndex(0, 1)));
  t("nextSignIndex draws from all twelve with no current sign",
    nextSignIndex(null, 0) === 0 && nextSignIndex(null, 0.99) === 11 && nextSignIndex(undefined, 0.5) === 6);
  t("nextSignIndex survives a non-finite r", Number.isInteger(nextSignIndex(3, NaN)));

  // ── the cycle clock ──
  const seed = startCycle(5, 1000);
  t("startCycle seeds a sign that is not crossfading", seed.from === 5 && seed.to === 5 && seed.startedAt === 1000);
  t("startCycle wraps an out-of-range index", startCycle(14, 0).to === 2 && startCycle(-1, 0).to === 11);

  const { dwellMs, fadeMs } = DEFAULT_CYCLE;
  const held = advanceCycle(seed, 1000 + dwellMs + fadeMs - 1, {}, () => 0.5);
  t("advanceCycle holds a sign for its full fade + dwell", held === seed);

  const flipped = advanceCycle(seed, 1000 + dwellMs + fadeMs, {}, () => 0);
  t("advanceCycle changes sign once fade + dwell has elapsed",
    flipped !== seed && flipped.from === 5 && flipped.to === 6 && flipped.startedAt === 1000 + dwellMs + fadeMs,
    JSON.stringify(flipped));
  t("advanceCycle never crossfades a sign into itself",
    advanceCycle(seed, 1e9, {}, () => 0.999999).to !== 5);
  t("advanceCycle respects a custom dwell/fade",
    advanceCycle(seed, 1400, { dwellMs: 300, fadeMs: 100 }, () => 0) !== seed &&
    advanceCycle(seed, 1399, { dwellMs: 300, fadeMs: 100 }, () => 0) === seed);
  t("advanceCycle with hold freezes the sign (reduced motion)",
    advanceCycle(seed, 1e9, { hold: true }, () => 0) === seed);
  t("advanceCycle seeds a state when handed none",
    Number.isInteger(advanceCycle(null, 42, {}, () => 0.5).to) && advanceCycle(null, 42, {}, () => 0.5).startedAt === 42);

  // ── the fade weights ──
  const fading = { from: 2, to: 7, startedAt: 0 };
  const w = (ms) => fadeWeights(fading, ms, 1000);
  t("a fade opens on the outgoing sign alone", w(0).from === 1 && w(0).to === 0, JSON.stringify(w(0)));
  t("a fade closes on the incoming sign alone", w(1000).from === 0 && w(1000).to === 1, JSON.stringify(w(1000)));
  t("a finished fade stays closed", w(9999).from === 0 && w(9999).to === 1);
  t("the stencil passes through empty rather than through both glyphs",
    w(500).from === 0 && w(500).to === 0, JSON.stringify(w(500)));

  let overlap = false, outMonotone = true, inMonotone = true;
  for (let k = 0; k <= 200; k++) {
    const a = w(k * 5), b = w((k + 1) * 5);
    if (a.from > 0 && a.to > 0) overlap = true;   // the defining property
    if (b.from > a.from) outMonotone = false;
    if (b.to < a.to) inMonotone = false;
  }
  t("the outgoing and incoming signs are never both on screen", !overlap);
  t("the outgoing sign only ever dims", outMonotone);
  t("the incoming sign only ever brightens", inMonotone);
  t("the outgoing sign is gone by the midpoint of the fade", w(499).from < 0.02, String(w(499).from));
  t("the incoming sign is still gone at the midpoint", w(501).to < 0.02, String(w(501).to));
  t("the weights ease rather than ramp linearly",
    w(125).from > 0.5 && w(875).to > 0.5, `${w(125).from} / ${w(875).to}`);
  t("a settled sign is painted at full strength with nothing outgoing",
    fadeWeights({ from: 3, to: 3, startedAt: 0 }, 0, 1000).from === 0 &&
    fadeWeights({ from: 3, to: 3, startedAt: 0 }, 0, 1000).to === 1);
  t("a zero-length fade lands straight on the incoming sign",
    fadeWeights(fading, 0, 0).from === 0 && fadeWeights(fading, 0, 0).to === 1);
  t("no state at all still paints something", fadeWeights(null, 0, 1000).to === 1);

  // ── the screen-space stencil ──
  const cx = 250, cy = 250, box = 200;
  const mid = stencilUV(cx, cy, cx, cy, box);
  t("stencilUV puts the disc centre at the middle of the glyph box",
    mid && Math.abs(mid.u - 0.5) < 1e-12 && Math.abs(mid.v - 0.5) < 1e-12, JSON.stringify(mid));
  const tl = stencilUV(cx - box / 2, cy - box / 2, cx, cy, box);
  t("stencilUV puts the box's top-left corner at (0, 0)", tl && tl.u === 0 && tl.v === 0, JSON.stringify(tl));
  t("stencilUV rejects a dot past the box's far edge",
    stencilUV(cx + box / 2, cy, cx, cy, box) === null && stencilUV(cx, cy + box / 2, cx, cy, box) === null);
  t("stencilUV rejects a dot outside the box entirely",
    stencilUV(0, 0, cx, cy, box) === null && stencilUV(500, 500, cx, cy, box) === null);
  t("stencilUV rejects a degenerate box", stencilUV(cx, cy, cx, cy, 0) === null);

  // ── mask indexing ──
  t("maskIndex is row-major over the mask", maskIndex(0, 0, 128) === 0 &&
    maskIndex(0.5, 0.5, 128) === 64 * 128 + 64 && maskIndex(0.999, 0.999, 128) === 128 * 128 - 1);
  t("maskIndex clamps inside the mask for out-of-range coordinates",
    maskIndex(-1, -1, 128) === 0 && maskIndex(2, 2, 128) === 128 * 128 - 1);

  // ── the constants globe.jsx sizes the stencil from ──
  t("the glyph box stays inside the globe's disc", GLYPH_BOX_RATIO > 0 && GLYPH_BOX_RATIO < 2,
    `ratio ${GLYPH_BOX_RATIO} of the radius`);
  t("the mask is a sane power-of-two raster", MASK_SIZE >= 64 && (MASK_SIZE & (MASK_SIZE - 1)) === 0,
    String(MASK_SIZE));
  t("a sign holds longer than it takes to fade in", dwellMs > fadeMs && fadeMs > 0,
    `dwell ${dwellMs}ms, fade ${fadeMs}ms`);

  return rows;
}
