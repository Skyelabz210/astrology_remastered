// zodiac-globe.js — the zodiac stencil the landing globe wears.
//
// Dual-environment module: `export`ed for Node (test/present/zodiac-globe.test.js
// imports it directly) and also published as `window.ZodiacGlobe` so the
// Babel-standalone `.jsx` pages (plain classic scripts, which cannot
// `import`) can call it. Load it as
// `<script type="module" src="zodiac-globe.js"></script>` — same pattern as
// tzresolve.js / validate.js — before `globe.jsx`.
//
// ─────────────────────────── What this is for ───────────────────────────
//
// globe.jsx paints a dot-matrix sphere. This module supplies the pure,
// DOM-free half of painting a zodiac sign INTO that sphere: which sign is
// showing, which one it is crossfading to, how far through the crossfade it
// is, and where a projected dot lands inside the glyph's screen-space box.
// Everything that needs a <canvas> (rasterising a glyph to an alpha mask,
// then lighting the lattice dots that fall inside it) stays in globe.jsx;
// everything that is arithmetic lives here, where Node can assert on it.
//
// The stencil is screen-space, not surface-space: the glyph holds still at
// the centre of the disc while the sphere's dot lattice rotates through it,
// so the sign stays legible at a fixed size and the spin reads as the dots
// scanning across it — rather than a decal that smears into the limb and
// disappears for two thirds of every revolution.

/**
 * The twelve signs in zodiacal order (0 = Aries), with the same glyph
 * characters the rest of the app prints. This table is deliberately a
 * SECOND copy of astro.jsx's `ZODIAC` name/glyph columns: astro.jsx is a
 * `.jsx` classic script that Node cannot import, so a stencil module that
 * Node tests can load has to carry its own copy. The copies are coupled by
 * test/present/zodiac-globe.test.js, which reads astro.jsx's source and
 * fails if the two ever disagree.
 */
export const SIGN_GLYPHS = [
  { name: "Aries",       glyph: "♈" },
  { name: "Taurus",      glyph: "♉" },
  { name: "Gemini",      glyph: "♊" },
  { name: "Cancer",      glyph: "♋" },
  { name: "Leo",         glyph: "♌" },
  { name: "Virgo",       glyph: "♍" },
  { name: "Libra",       glyph: "♎" },
  { name: "Scorpio",     glyph: "♏" },
  { name: "Sagittarius", glyph: "♐" },
  { name: "Capricorn",   glyph: "♑" },
  { name: "Aquarius",    glyph: "♒" },
  { name: "Pisces",      glyph: "♓" },
];

/** How long a sign holds at full strength, and how long the crossfade takes. */
export const DEFAULT_CYCLE = { dwellMs: 5200, fadeMs: 1100 };

/** Side of the glyph's square stencil box, as a multiple of the globe radius. */
export const GLYPH_BOX_RATIO = 1.04;

/** Resolution (px per side) of the alpha mask each glyph is rasterised into. */
export const MASK_SIZE = 128;

/**
 * Pick the next sign to show, given the current one and a random number in
 * [0, 1). The draw is over the ELEVEN other signs, never the current one:
 * a plain `floor(r * 12)` would land on the sign already showing one time
 * in twelve and crossfade a sign into itself, which reads on screen as the
 * globe stalling rather than as a deliberate pause.
 *
 * @param {number|null} current 0-based sign index, or null/invalid to draw
 *                              freely from all twelve (used for the seed).
 * @param {number} r            random in [0, 1), e.g. from Math.random().
 * @returns {number} a sign index in [0, 12).
 */
export function nextSignIndex(current, r) {
  const n = SIGN_GLYPHS.length;
  // Clamp below 1 so an r of exactly 1 (or a caller's rounding up to it)
  // cannot index one past the end of the table.
  const rr = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.9999999) : 0;
  const valid = Number.isInteger(current) && current >= 0 && current < n;
  if (!valid) return Math.floor(rr * n);
  // Offset by 1..11 from the current sign — every other sign, none twice.
  return (current + 1 + Math.floor(rr * (n - 1))) % n;
}

/**
 * Seed a cycle state. `from === to` means "nothing is crossfading": the
 * seed sign is simply up, at full strength, from the first frame.
 */
export function startCycle(index, now) {
  const i = Number.isInteger(index) ? ((index % SIGN_GLYPHS.length) + SIGN_GLYPHS.length) % SIGN_GLYPHS.length : 0;
  return { from: i, to: i, startedAt: now };
}

/**
 * Advance the cycle if the current sign has finished its fade AND its
 * dwell. Pure: same state + same clock + same random draw gives the same
 * answer, and the state it returns is a fresh object only when the sign
 * actually changes (so callers can cheaply test identity).
 *
 * @param {{from:number,to:number,startedAt:number}} state
 * @param {number} now       monotonic ms (performance.now()).
 * @param {{dwellMs?:number, fadeMs?:number, hold?:boolean}} opts
 *        `hold` freezes the cycle on its current sign — what globe.jsx
 *        passes when the reader has asked for reduced motion.
 * @param {() => number} rnd
 */
export function advanceCycle(state, now, opts = {}, rnd = Math.random) {
  const dwellMs = opts.dwellMs ?? DEFAULT_CYCLE.dwellMs;
  const fadeMs  = opts.fadeMs  ?? DEFAULT_CYCLE.fadeMs;
  if (!state) return startCycle(nextSignIndex(null, rnd()), now);
  if (opts.hold) return state;
  if (now - state.startedAt < fadeMs + dwellMs) return state;
  return { from: state.to, to: nextSignIndex(state.to, rnd()), startedAt: now };
}

/** Smoothstep, so a sign eases in and out instead of ramping linearly. */
function ease(t) {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
}

/**
 * How much of the outgoing and incoming sign to paint, at `now`.
 *
 * The two never overlap: the old sign fades out over the first half of the
 * fade and the new one fades in over the second, so the stencil passes
 * through empty rather than through both glyphs at once. Painted
 * simultaneously at partial strength — the obvious cross-dissolve — two
 * line glyphs superimpose into an unreadable third shape for half a
 * second, which is what this shape of fade exists to avoid.
 *
 * A state whose `from` and `to` are the same sign is not fading at all: it
 * reports the sign at full strength and nothing outgoing.
 *
 * @returns {{from:number, to:number}} weights in [0, 1].
 */
export function fadeWeights(state, now, fadeMs = DEFAULT_CYCLE.fadeMs) {
  if (!state || state.from === state.to || !(fadeMs > 0)) return { from: 0, to: 1 };
  const p = Math.min(Math.max((now - state.startedAt) / fadeMs, 0), 1);
  return { from: 1 - ease(Math.min(1, p * 2)), to: ease(Math.max(0, p * 2 - 1)) };
}

/**
 * Map a projected dot's screen position into the glyph's stencil box.
 *
 * @param {number} px,py   the dot, in the globe canvas's own pixel space.
 * @param {number} cx,cy   centre of the globe disc.
 * @param {number} box     side of the (square, centred) stencil box.
 * @returns {{u:number,v:number}|null} texture coordinates in [0,1), or
 *          null when the dot falls outside the box entirely.
 */
export function stencilUV(px, py, cx, cy, box) {
  if (!(box > 0)) return null;
  const u = (px - (cx - box / 2)) / box;
  if (u < 0 || u >= 1) return null;
  const v = (py - (cy - box / 2)) / box;
  if (v < 0 || v >= 1) return null;
  return { u, v };
}

/** Index of texture coordinate (u, v) in a row-major n×n mask. */
export function maskIndex(u, v, n) {
  const x = Math.min(n - 1, Math.max(0, Math.floor(u * n)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(v * n)));
  return y * n + x;
}

if (typeof window !== "undefined") {
  window.ZodiacGlobe = {
    SIGN_GLYPHS, DEFAULT_CYCLE, GLYPH_BOX_RATIO, MASK_SIZE,
    nextSignIndex, startCycle, advanceCycle, fadeWeights, stencilUV, maskIndex,
  };
}
