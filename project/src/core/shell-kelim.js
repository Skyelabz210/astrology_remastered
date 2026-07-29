// src/core/shell-kelim.js — shell winding recovery via the gear anchor. (P3)
// K = ⌊x / M6⌋ recovered from residues alone: K ≡ (vA − vM)·M6⁻¹ (mod 323).
// Valid because 0 ≤ K ≤ 43 < 323. BigInt only.

import { M6, GEAR_PRODUCT, M6_INV_MOD_GEAR } from "./basis.js";
import { mod } from "./residues.js";

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
