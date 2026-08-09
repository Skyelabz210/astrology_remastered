// src/core/shell-kelim.js — shell winding recovery. (P3, re-based P21)
//
// CANONICAL — the parked split.
// ─────────────────────────────
// Shell {2,3,5,7,13,17,19} = 881,790, anchor the parked lane 11. Both are
// sub-products of the fixed basis and their lane sets are disjoint, so the
// anchor is INTERNAL and tray-determined and i.i.d. survives: every lane is
// still x mod p, referencing no other lane.
//
//     K ≡ (s − r) · M_SHELL⁻¹   (mod 11),      M_SHELL⁻¹ ≡ 7 (mod 11)
//
// Exact while K < 11. Over the ecliptic ring K ≤ 1, so the bare lane covers it
// with an order of magnitude to spare.
//
// The yield is the PAIR (r, K). It is not fused: r lives in the shell lanes,
// K in the parked lane. Forming r + K·M_SHELL is a radix boundary projection
// and lives in cram.js as `projectToInteger`, not here.
//
// LEGACY — the gear split.
// ────────────────────────
// Shell {2,3,5,7,11,13} = 30,030, anchor 17·19 = 323 with the precomputed
// inverse 287. Exact, still PROVEN, still exported. It needs the wider 323
// anchor only because 11 was loaded into the shell, pushing K to 43.
//
// BigInt only.

import {
  M6, GEAR_PRODUCT, M6_INV_MOD_GEAR,
  PARK, M_SHELL, M_SHELL_INV_MOD_PARK,
} from "./basis.js";
import { mod } from "./residues.js";

// ── canonical: parked shell, lane-11 anchor ────────────────────────

/** The canonical internal anchor: the parked lane. */
export const SHELL_ANCHOR = PARK;               // 11

/** r — the shell residue, over {2,3,5,7,13,17,19}. */
export function parkedShellResidue(x) { return mod(x, M_SHELL); }

/** s — the anchor residue, read straight off the parked lane. */
export function parkResidue(x) { return mod(x, PARK); }

/**
 * K-Elimination on the parked split. Returns K only; the number is the pair
 * (r, K) and nothing here fuses them.
 */
export function recoverShellWinding(r, s) {
  return mod((s - r) * M_SHELL_INV_MOD_PARK, PARK);
}

/** The same, driven from the integer — for encoding and for tests. */
export function recoverShellWindingFrom(x) {
  return recoverShellWinding(parkedShellResidue(x), parkResidue(x));
}

/** The yield: the identity pair, uncoupled. */
export function shellIdentity(x) {
  const r = parkedShellResidue(x);
  return { r, K: recoverShellWinding(r, parkResidue(x)), shell: M_SHELL, anchor: PARK };
}

export function actualShellWinding(x) { return x / M_SHELL; }

export function verifyShellWinding(x) {
  const recovered = recoverShellWindingFrom(x);
  const actual = actualShellWinding(x);
  return {
    split: "parked",
    shell: M_SHELL.toString(),
    anchor: PARK.toString(),
    recovered: recovered.toString(),
    actual: actual.toString(),
    ok: recovered === actual,
  };
}

// ── legacy: gear split, retained and still exact ───────────────────

export const LEGACY_SHELL = M6;
export const LEGACY_ANCHOR = GEAR_PRODUCT;

export function shellResidue(x) { return mod(x, M6); }
export function gearResidue(x) { return mod(x, GEAR_PRODUCT); }

export function recoverShellWindingFromGear(x) {
  const vM = shellResidue(x);
  const vA = gearResidue(x);
  return mod((vA - vM) * M6_INV_MOD_GEAR, GEAR_PRODUCT);
}

export function actualLegacyWinding(x) { return x / M6; }

export function verifyLegacyShellWinding(x) {
  const recovered = recoverShellWindingFromGear(x);
  const actual = actualLegacyWinding(x);
  return {
    split: "gear (legacy)",
    shell: M6.toString(),
    anchor: GEAR_PRODUCT.toString(),
    recovered: recovered.toString(),
    actual: actual.toString(),
    ok: recovered === actual,
  };
}
