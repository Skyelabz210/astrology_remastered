// src/present/exact-ring.js — the 1,296,000-arcsecond ring as the SYSTEM OF
// RECORD for every chart computation (P31).
//
// CORRECTION OF WIRING
// ────────────────────
// The exact integer engine (src/core/: RING = 1296000n = 2^7·3^4·5^3, the
// Safe-Basis CRT lanes, HCRM registers) existed, was proven over the full
// 1,296,000-arcsecond sweep, and fed only the optional "Remastered layers"
// panel. Meanwhile astro.jsx's computeNatal() consumed raw IEEE-754 float
// degrees from the ephemeris sensor and did its downstream arithmetic —
// speeds, sign/degree decomposition, Lots, house placement, aspect selection,
// orbs, phases — in float degrees with `% 360`. That is the split-brain this
// module closes: astronomy-engine is demoted to a SENSOR whose float output is
// quantized at the boundary into exact BigInt arcseconds; everything after the
// boundary is integer arithmetic in Z_1296000 with zero float operations.
//
// THE BOUNDARY (single point of entry, mirrors src/core/validators.js's
// parseArcsecString regime gate):
//
//   Float degrees cross ONCE, via wrapDegToArcsec(deg), into
//   s ∈ [0, 1295999] — half-away-from-zero rounding, identical convention to
//   tools/ephemeris/produce-ledger.mjs's roundHalfAwayFromZero +
//   normalizeArcsec, so the live chart and the certified ledger agree on every
//   quantized value.
//
// After that point:
//   • Speeds      Δs = signed circular arc between the ±6h quantized samples
//                 (arcsec/day, exact integers; retrograde ⟺ Δs < 0 by
//                 construction — the two can never disagree).
//   • Decompose   sign = s / 108000, degree = (s % 108000) / 3600,
//                 arcminute = (s % 3600) / 60, arcsecond = s % 60 — exact
//                 quotient/remainder in the hierarchical radix. No float
//                 floor(), no boundary ambiguity at 29°59′59″↔0°00′00″.
//   • Lots        (a + x − y) mod 1296000 — modular addition in the ring,
//                 never float `% 360` on unrounded sums.
//   • Aspects     |sA − sB| reduced to the shortest arc d ≤ 648000, compared
//                 against INTEGER harmonic targets (conjunction 0″, semisextile
//                 108000″, semisquare 162000″, sextile 216000″, novile 144000″,
//                 decile 129600″, trine 432000″, opposition 648000″, …) with
//                 INTEGER arcsecond orbs (8° = 28800″). Orbs are reported in
//                 arcseconds, not 0.04-style float degrees.
//   • Phase       applying/separating from the exact relative-velocity integer
//                 and the exact signed error to the target residue.
//   • Houses      whole-sign ((signIdx − ascSignIdx + 12) mod 12) + 1, equal
//                 ((s − sASC) mod R) / 108000 + 1, quadrant arcs tested as
//                 integer angular comparisons against quantized cusps.
//   • Dignities   Ptolemaic domicile/exaltation tables keyed on the EXACT
//                 integer sign index; Egyptian terms/faces keyed on the exact
//                 integer degree-in-sign (0..29) — boundary degrees classify
//                 deterministically because they arrive as integers.
//   • Residues    the CRAM/Safe-Basis projection itself: s mod p for the
//                 8-lane basis {2,3,5,7,11,13,17,19}, computed with BigInt
//                 (the core regime), plus the ring-closure profile of each
//                 division (ring.js `closes(n)` / `stepArcsec(n)`).
//
// WHAT STAYS FLOAT (and why it is not a divergence):
//   the ephemeris sensor itself (astronomy-engine VSOP87 series), the horizon
//   solver (houses.js trigonometry), solar altitude for sect, illumination,
//   declination/ecliptic latitude, and mean-element node/Lilith formulas all
//   produce floats — they are INSTRUMENTS. Their outputs cross the boundary
//   through wrapDegToArcsec() exactly once and are then locked. No float value
//   participates in any ring operation after quantization.
//
// Tooling note: plain ES module (Node-importable for tests and for the
// headless CLI driver; browser pages load it via <script type="module"> and
// it also attaches to window.ExactRing, mirroring astro-core.js's dual pattern).

import { RING, closes, stepArcsec } from "../core/ring.js";
import { B8 } from "../core/basis.js";

const SIGN_ARCSEC = 108000n;         // 30°
const DEG_ARCSEC = 3600n;            // 1°
const MIN_ARCSEC = 60n;              // 1′
const CIRC_HALF = 648000n;           // 180°

export const RING_ARCSEC = 1296000;
export const SIGN_ARC = 108000;

/**
 * THE SENSOR BOUNDARY. Quantize one float degree value into the exact ring.
 * Half-away-from-zero, then wrapped into [0, 1295999] — bit-for-bit the same
 * convention as produce-ledger.mjs (roundHalfAwayFromZero + normalizeArcsec).
 * @param {number} deg - float degrees from an ephemeris/horizon sensor.
 * @returns {bigint} exact arcsecond residue s ∈ [0, 1296000).
 */
export function wrapDegToArcsec(deg) {
  if (!Number.isFinite(deg)) throw new RangeError("wrapDegToArcsec requires a finite float degree");
  const scaled = deg * 3600;                       // float, sensor side
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  let s = rounded % 1296000;                       // safe integer range (< 2^53)
  if (s < 0) s += 1296000;
  return BigInt(s);
}

/** Signed shortest circular arc (b → a) in exact arcseconds, ∈ (−648000, 648000]. */
export function signedArc(sa, sb) {
  let d = (sa - sb) % RING;
  if (d > CIRC_HALF) d -= RING;
  else if (d <= -CIRC_HALF) d += RING; // ties resolve negative→positive mirror like produce-ledger's circularDiffDeg
  if (d === -CIRC_HALF) d = CIRC_HALF;
  return d;
}

/** Unwrapped shortest distance between two ring points: min(|Δ|, R−|Δ|). */
export function arcDistance(sa, sb) {
  const d = ((sa - sb) % RING + RING) % RING;
  return d <= CIRC_HALF ? d : RING - d;
}

/** Exact hierarchical-radix decomposition of a ring point. All BigInt. */
export function decompose(s) {
  const sign = s / SIGN_ARC;
  const inSign = s % SIGN_ARC;
  return {
    sign: Number(sign),                              // 0..11
    degree: Number(inSign / DEG_ARCSEC),             // 0..29
    arcminute: Number((inSign % DEG_ARCSEC) / MIN_ARCSEC), // 0..59
    arcsecond: Number(inSign % MIN_ARCSEC),          // 0..59
    arcsecInSign: Number(inSign),                    // 0..107999
  };
}

/**
 * Exact central-difference speed from the two quantized ±6h sensor samples.
 * The window spans 0.5 days, so arcsec/day = 2 × the signed circular arc.
 * Returns a BigInt (signed). Retrograde ⟺ result < 0n; callers MUST derive
 * the flag from this value, never independently — mirroring produce-ledger's
 * speed_arcsec_per_day convention.
 */
export function speedArcsecPerDay(sPlus, sMinus) {
  return signedArc(sPlus, sMinus) * 2n;
}

// ── Hermetic Lots in the ring ─────────────────────────────────────────
/** lot = (asc + x − y) mod 1,296,000 — exact modular arithmetic. */
export function lotAdd(sAsc, sx, sy) {
  return (((sAsc + sx - sy) % RING) + RING) % RING;
}

// ── Aspect lattice ────────────────────────────────────────────────────
// Every classic aspect is an exact integer arcsecond target (angle × 3600);
// every orb is an exact integer arcsecond radius. Septile/undecile/tredecile
// carry the SAME float-derived targets the legacy table used (360/7 etc. were
// never ring-exact — 7, 11, 13 do not divide the ring; see ring.js closure)
// but locked to integer arcseconds here, so even the off-ring harmonics are
// compared as integers. Their residues still live inside Z_1296000; the
// off-ring defect belongs to the DIVISION n, not to the comparison arithmetic.
export const ASPECT_LATTICE = Object.freeze([
  { name: "Conjunction",    angle: 0,    target: 0n,      orbArcsec: 28800n, family: "cardinal" },
  { name: "Opposition",     angle: 180,  target: 648000n, orbArcsec: 28800n, family: "cardinal" },
  { name: "Trine",          angle: 120,  target: 432000n, orbArcsec: 25200n, family: "classical" },
  { name: "Square",         angle: 90,   target: 324000n, orbArcsec: 25200n, family: "classical" },
  { name: "Sextile",        angle: 60,   target: 216000n, orbArcsec: 18000n, family: "classical" },
  { name: "Quincunx",       angle: 150,  target: 540000n, orbArcsec: 10800n, family: "minor" },
  { name: "Semisquare",     angle: 45,   target: 162000n, orbArcsec: 7200n,  family: "minor" },
  { name: "Semisextile",    angle: 30,   target: 108000n, orbArcsec: 7200n,  family: "minor" },
  { name: "Sesquiquadrate", angle: 135,  target: 486000n, orbArcsec: 7200n,  family: "minor" },
  { name: "Novile",         angle: 40,   target: 144000n, orbArcsec: 5400n,  family: "novile" },
  { name: "Decile",         angle: 36,   target: 129600n, orbArcsec: 4320n,  family: "decile" },
  { name: "Tridecile",      angle: 108,  target: 388800n, orbArcsec: 4320n,  family: "decile" },
  { name: "Quintile",       angle: 72,   target: 259200n, orbArcsec: 7200n,  family: "quintile" },
  { name: "BiQuintile",     angle: 144,  target: 518400n, orbArcsec: 7200n,  family: "quintile" },
  // 360/7° = 185142.857…″ → nearest integer lattice point 185143″ (defect disclosed by closure check)
  { name: "Septile",        angle: 360 / 7,  target: 185143n, orbArcsec: 5400n, family: "septile" },
  { name: "Undecile",       angle: 360 / 11, target: 118909n, orbArcsec: 4320n, family: "undecile" },
  { name: "Tredecile",      angle: 360 / 13, target: 100154n, orbArcsec: 4320n, family: "tredecile" },
]);

/**
 * Nearest aspect in the ring: integer separation vs integer targets.
 * @param {bigint} sa - faster/first body's ring position.
 * @param {bigint} sb - second body's ring position.
 * @param {number} orbScale - caller-supplied orb multiplier (presentation
 *   dial). Applied as Math.round(orbArcsec * scale) — the ONLY float touch in
 *   this function, and it scales a DISCLOSURE radius, never a position.
 * @returns {null | {name, angle, family, target, orbArcsec, sepArcsec, exact:boolean}}
 */
export function nearestAspectRing(sa, sb, orbScale = 1) {
  const d = arcDistance(sa, sb);
  let best = null;
  for (const a of ASPECT_LATTICE) {
    const sep = d >= a.target ? d - a.target : a.target - d;
    const orb = BigInt(Math.round(Number(a.orbArcsec) * orbScale));
    if (sep <= orb && (best === null || sep < best.sepArcsec)) {
      best = { name: a.name, angle: a.angle, family: a.family, target: a.target,
               orbArcsec: orb, sepArcsec: sep, exact: sep === 0n };
    }
  }
  return best;
}

/**
 * Applying / separating — exact. error = signed offset of the pair's arc
 * distance from the target residue; it shrinks toward 0 iff the relative
 * velocity carries the bodies together. All integer comparisons.
 * @param {bigint} sFast - faster body position, @param {bigint} sSlow
 * @param {bigint} vFast - arcsec/day, @param {bigint} vSlow
 * @param {bigint} target - aspect lattice target
 */
export function phaseExact(sFast, sSlow, vFast, vSlow, target) {
  const rel = vFast - vSlow;
  if (rel === 0n) return "static";
  const sep = arcDistance(sFast, sSlow);
  const err = sep >= target ? sep - target : target - sep; // ≥ 0
  if (err === 0n) return "exact";
  // Moving apart when the current separation exceeds the target and the
  // (unsigned) separation derivative is positive; symmetric below target.
  const opening = sep > target ? rel > 0n : rel < 0n;
  return opening ? "separating" : "applying";
}

// ── House placement in the ring ───────────────────────────────────────
export function houseWholeSign(s, sAsc) {
  const signIdx = Number(s / SIGN_ARC);
  const ascSignIdx = Number(sAsc / SIGN_ARC);
  return ((signIdx - ascSignIdx + 12) % 12) + 1;
}

export function houseEqual(s, sAsc) {
  const d = ((s - sAsc) % RING + RING) % RING;
  return Number(d / SIGN_ARC) + 1;
}

/** Quadrant houses from QUANTIZED integer cusps (cusps[0] = ASC cusp). */
export function houseForCuspsExact(s, cusps) {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const arc = ((end - start) % RING + RING) % RING;
    const off = ((s - start) % RING + RING) % RING;
    // A zero-width arc reads as a full circle, not "nothing" — same rule
    // astro-core's float houseForCusps applied (`|| 360`), now integer-exact.
    if (arc === 0n || off < arc) return i + 1;
  }
  return 12; // unreachable for a well-formed 12-cusp array
}

// ── CRAM / Safe-Basis projection ──────────────────────────────────────
/** The 8-lane centred residue vector of a ring point, pure BigInt. */
export function laneResidues(s) {
  const out = {};
  for (const p of B8) out[`r${p}`] = s % p;
  return out;
}

/** Ring-closure profile for the divisions astrology actually names. */
export function closureProfile(divisors = [2n, 3n, 4n, 5n, 7n, 9n, 10n, 11n, 12n, 13n, 27n, 36n]) {
  return divisors.map((n) => ({
    divisor: n,
    closes: closes(n),
    step: closes(n) ? stepArcsec(n) : null,
    defect: RING % n,
  }));
}

// ── Formatting (display is the LAST stage, never an input) ───────────
export function formatDms(s) {
  const d = decompose(s);
  return `${String(d.degree).padStart(2, "0")}°${String(d.arcminute).padStart(2, "0")}′${String(d.arcsecond).padStart(2, "0")}″`;
}
export function arcsecText(arcsecBigintOrNumber) {
  return `${arcsecBigintOrNumber}″`;
}

// Dual-environment bridge, mirroring astro-core.js's pattern.
if (typeof window !== "undefined") window.ExactRing = {
  RING_ARCSEC, SIGN_ARC, wrapDegToArcsec, signedArc, arcDistance, decompose,
  speedArcsecPerDay, lotAdd, ASPECT_LATTICE, nearestAspectRing,
  phaseExact, houseWholeSign, houseEqual, houseForCuspsExact, laneResidues,
  closureProfile, formatDms,
};
