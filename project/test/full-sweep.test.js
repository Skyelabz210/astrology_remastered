// test/full-sweep.test.js — exhaustive exact proof over the ecliptic ring. (P4)
//
// PROVEN claim: for every integer arcsecond x in [0, 1,296,000), the shell
// winding K = ⌊x / M6⌋ is recovered exactly from residues alone through the
// 17·19 gear anchor:
//
//     K ≡ (x mod 323 − x mod 30030) · 287   (mod 323)
//
// and SafeS8 residues are injective on the ring (M8 = 9,699,690 > 1,296,000).
//
// This runs the WHOLE ring. It is chunked + async so the browser stays live
// and can report progress. BigInt only — no floats anywhere in the hot loop.

import { M6, GEAR_PRODUCT, M6_INV_MOD_GEAR, ARCSEC_CIRCLE } from "../src/core/basis.js";

export async function runSweep(onProgress) {
  const M6n = M6, A = GEAR_PRODUCT, inv = M6_INV_MOD_GEAR, RING = ARCSEC_CIRCLE;
  const CHUNK = 32400n;                 // 40 chunks over the ring
  let x = 0n, mismatches = 0, checked = 0n;
  let maxK = 0n, firstFail = null;

  while (x < RING) {
    const end = x + CHUNK < RING ? x + CHUNK : RING;
    for (; x < end; x++) {
      const vM = x % M6n;                          // shell residue
      const vA = x % A;                            // gear residue
      let k = ((vA - vM) * inv) % A; if (k < 0n) k += A;
      const actual = x / M6n;                       // ⌊x/M6⌋ exact (BigInt division)
      if (k !== actual) { mismatches++; if (firstFail === null) firstFail = x.toString(); }
      if (actual > maxK) maxK = actual;
      checked++;
    }
    if (onProgress) await onProgress(Number((x * 100n) / RING), checked.toString(), mismatches);
  }

  return {
    name: "Full ecliptic K-Elim sweep [0, 1,296,000)",
    checked: checked.toString(),
    mismatches,
    maxK: maxK.toString(),
    firstFail,
    ok: mismatches === 0 && checked === RING && maxK === 43n,
  };
}
