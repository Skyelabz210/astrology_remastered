// src/core/shell-kelim.js — shell winding recovery. (P3, canonical path P14)
//
// TWO PATHS, and the canonical one is the adjacent anchor.
//
//   CANONICAL (CRAM).  A = 17·19 = 323 — the gear pair, INTERNAL to the fixed
//   safe basis. Lanes 17 and 19 are already in the tray, produced by their own
//   reductions, disjoint from the six shell lanes. K ≡ (s − r)·287 (mod 323).
//   The precomputed inverse is the price of internality, and internality is not
//   optional: see below.
//
//   NOT ADMISSIBLE HERE.  A = M6 + 1 = 30,031 = 59 · 509 is EXTERNAL to SafeS8.
//   x and x + M8 share the entire tray yet differ modulo 30,031 (they differ by
//   M8 mod 30,031 = 29,708), so the adjacent residue is not a function of the
//   tray at all. Obtaining it means reconstructing the integer — leaving residue
//   space — or adjoining lanes 59 and 509, which violates A3. The adjacency
//   identity below is arithmetically true and is retained for bases where the
//   anchor IS internal (the star-lift bases; see src/core/anchor.js), but over
//   SafeS8 it is not a residue-space operation and must not be treated as one.
//
//   This reverses an earlier pass that had these two the other way round.
//
// Both are certified over the whole ecliptic ring in test/full-sweep.test.js.
// BigInt only.

import { M6, GEAR_PRODUCT, M6_INV_MOD_GEAR } from "./basis.js";
import { mod } from "./residues.js";

/** The canonical INTERNAL anchor for the six-lane shell: the gear pair. */
export const SHELL_ANCHOR = GEAR_PRODUCT;       // 323 = 17 · 19, both lanes of B8

/** The adjacent modulus. EXTERNAL to SafeS8 — not tray-determined. */
export const ADJACENT_MODULUS = M6 + 1n;        // 30,031 = 59 · 509

/**
 * The adjacent residue. Takes the INTEGER, not the tray — over SafeS8 the tray
 * cannot supply it. Provided so the identity can be exercised and its
 * inadmissibility demonstrated, not for use in the hot path.
 */
export function adjacentResidue(x) { return mod(x, ADJACENT_MODULUS); }

/**
 * The adjacency identity K ≡ r − s (mod M+1). Arithmetically exact, but over
 * SafeS8 it is NOT a residue-space operation — see the header. Use
 * `internalAdjacencyRecover` from anchor.js on a basis where the anchor is
 * internal (a star-lift basis).
 */
export function recoverShellWindingAdjacent(x) {
  return mod(shellResidue(x) - adjacentResidue(x), ADJACENT_MODULUS);
}

export function verifyShellWindingAdjacent(x) {
  const recovered = recoverShellWindingAdjacent(x);
  const actual = x / M6;
  return {
    path: "adjacency (identity only — anchor external to SafeS8)",
    anchor: ADJACENT_MODULUS.toString(),
    tray_determined: false,
    recovered: recovered.toString(),
    actual: actual.toString(),
    ok: recovered === actual,
  };
}

export function shellResidue(x) { return mod(x, M6); }
export function gearResidue(x) { return mod(x, GEAR_PRODUCT); }

export function recoverShellWindingFromGear(x) {
  const vM = shellResidue(x);
  const vA = gearResidue(x);
  return mod((vA - vM) * M6_INV_MOD_GEAR, GEAR_PRODUCT);
}

export function actualShellWinding(x) { return x / M6; }

export function verifyShellWinding(x) {
  const recovered = recoverShellWindingFromGear(x);
  const actual = actualShellWinding(x);
  return { recovered: recovered.toString(), actual: actual.toString(), ok: recovered === actual };
}
