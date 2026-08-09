// src/core/identity.js — the identity of a number. D-030. (P27)
//
// An integer is not a magnitude. On the CRT product ring it is a COMPOUND STATE
//
//     ID_p(x) = (r_p, w_p),        r_p = x mod p,   w_p = ⌊x / p⌋
//
// satisfying x = r_p + p·w_p. Geometrically ℤ_p is a CYLINDER: r is the ANGULAR
// coordinate on the circle ℤ/pℤ, w is the AXIAL coordinate — how many times the
// element has wrapped. The residue is the present; the winding is the past.
//
// Two integers with the same residue and different windings are DISTINCT STATES
// occupying the same angular position on different levels of the cylinder. The
// residue tuple alone is a projection that discards the axial coordinate.
//
// DOUBLE K-ELIMINATION IS SECOND ORDER. (corrects P23/P24)
// ───────────────────────────────────────────────────────
// P23 read "double K-Elimination lift" as two levels of one lane — 11 then 11² —
// which yields more digits of the SAME winding. That is precision. The double
// elimination is the winding OF THE WINDING:
//
//     κ₁ = K-Elim(x,  M,  A₁)          the winding — velocity, history
//     κ₂ = K-Elim(κ₁, A₁, A₂)          the winding of the winding — ACCELERATION
//
// κ₂ is the rate of change of the identity along the cylinder, and the third
// mixed-radix digit. Both digits come from independent eliminations on x — no
// accumulator is threaded, so this is mixed-radix WITHOUT a Garner cascade.
//
// THE WINDING IS THE MASK, NOT A LEAK. (D-030 §6.1)
// ────────────────────────────────────────────────
// Garner reconstruction converts residues back to an integer and DESTROYS the
// winding. Staying residue-native and using K-Elimination PRESERVES it. The
// windings are a deterministic, algorithm-dependent source of noise that masks
// power and timing side channels: an attacker's trace measures the residue, and
// the winding — which carries the history — is invisible to them. Structure in
// the carry is the defence, not an escape.
//
// BigInt only.

import { mod } from "./residues.js";
import { inverse } from "./cram.js";

// ── the cylinder ───────────────────────────────────────────────────

/** ID_p(x) = (r, w). r angular, w axial. x = r + p·w exactly. */
export function identity(x, p) {
  const r = mod(x, p);
  return { r, w: (x - r) / p, p, exact: x === r + p * ((x - r) / p) };
}

/** The full identity over a basis: one (r, w) pair per lane. */
export function identityOn(x, basis) { return basis.map((p) => identity(x, p)); }

/**
 * Same angular position, different level of the cylinder. This is the whole
 * point: the residue tuple cannot tell these apart, the identity can.
 */
export function sameAngleDifferentLevel(x, y, p) {
  const a = identity(x, p), b = identity(y, p);
  return { same_residue: a.r === b.r, same_winding: a.w === b.w, distinct: x !== y };
}

// ── K-Elimination, first and second order ──────────────────────────

/** κ = K-Elim(x, M, A) — the winding of x around M, read from A. Exact for κ < A. */
export function kElim(x, M, A) {
  const mi = inverse(mod(M, A), A);
  if (mi === null) return null;
  return mod((mod(x, A) - mod(x, M)) * mi, A);
}

/**
 * D-030 §2.2. The DOUBLE elimination — κ₂ = K-Elim(κ₁, A₁, A₂), the winding of
 * the winding. Both digits are read off x independently; nothing is threaded.
 *
 * Exact while K < A₁·A₂, i.e. x < M·A₁·A₂ — so the second order also widens the
 * corridor, but that is a consequence, not the point. The point is that κ₂ is
 * the ACCELERATION of the identity along the cylinder.
 */
export function doubleKElim(x, M, A1, A2) {
  const k1 = kElim(x, M, A1);                 // K mod A₁
  const kA2 = kElim(x, M, A2);                // K mod A₂
  if (k1 === null || kA2 === null) return null;
  const ai = inverse(mod(A1, A2), A2);
  if (ai === null) return null;
  return {
    kappa1: k1,                               // velocity — the winding
    kappa2: mod((kA2 - k1) * ai, A2),         // acceleration — the winding of it
    K: k1 + A1 * mod((kA2 - k1) * ai, A2),    // the winding, to two digits
    corridor: M * A1 * A2,
    order: 2n,
  };
}

/**
 * Mixed-radix digits of the winding from INDEPENDENT eliminations — one per
 * anchor, none depending on the last. This is what makes it not a Garner
 * cascade: Garner's digit i needs digits 0..i−1.
 */
export function windingDigits(x, M, anchors) {
  const digits = [];
  let acc = 0n, radix = 1n;
  for (const A of anchors) {
    const kA = kElim(x, M, A);
    if (kA === null) return null;
    const ri = inverse(mod(radix, A), A);
    if (ri === null) return null;
    const d = mod((kA - acc) * ri, A);
    digits.push(d);
    acc = acc + radix * d;
    radix = radix * A;
  }
  return { digits, K: acc, radix, corridor: M * radix, accumulator_threaded: false };
}

// ── the natal chart, the trip, the return (D-030 §4) ───────────────
//
// Not metaphor — the document is explicit. This is the exact behaviour of the
// integer state, and it is what binds the substrate to the astrology layer.

/** The natal chart: the birth state, (r₀, 0). The winding is zero by definition. */
export function natalChart(x0, basis) {
  return {
    kind: "NATAL_IDENTITY_V1",
    residues: basis.map((p) => mod(x0, p)),
    winding: basis.map(() => 0n),
    basis,
    origin: x0,
  };
}

/** A carry event: the residue wrapped p, so the winding incremented. A life event. */
export function carryEvent(xBefore, xAfter, p) {
  const a = identity(xBefore, p), b = identity(xAfter, p);
  return { wrapped: b.w > a.w, increments: b.w - a.w, from: a.r, to: b.r, lane: p };
}

/**
 * A RETURN: the angular position equals the natal one. Same chart position, and
 * a strictly greater winding — the identity is not the same. The Saturn Return
 * of the tradition is exactly this, and κ at the return measures the journey.
 */
export function isReturn(x, natalResidue, p) {
  const id = identity(x, p);
  return {
    returned: id.r === mod(natalResidue, p),
    winding: id.w,
    changed: id.w > 0n,
    journey: id.w,                            // the measure of the trip
  };
}

/** Every return of lane p up to a bound, with the winding each one carries. */
export function returns(natal, p, bound) {
  const r0 = mod(natal, p);
  const out = [];
  for (let x = r0; x < bound; x += p) out.push({ x, ...isReturn(x, r0, p) });
  return out;
}

// ── irreversibility (D-030 §3) ─────────────────────────────────────

/** The winding along a trajectory is non-decreasing — it is a Lyapunov function. */
export function windingMonotone(trajectory, p) {
  let prev = null, violations = 0;
  for (const x of trajectory) {
    const w = identity(x, p).w;
    if (prev !== null && w < prev) violations++;
    prev = w;
  }
  return { monotone: violations === 0, violations };
}

/**
 * The natal state (r₀, 0) is algebraically unreachable from any later state:
 * no future point on the cylinder carries winding zero once it has wound.
 */
export function natalUnreachable(trajectory, p) {
  const wound = trajectory.filter((x) => identity(x, p).w > 0n);
  return {
    wound_states: BigInt(wound.length),
    any_returned_to_zero: wound.some((x, i) =>
      i + 1 < wound.length && identity(wound[i + 1], p).w === 0n),
  };
}
