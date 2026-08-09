// test/full-sweep.test.js — exhaustive exact proof over the ecliptic ring. (P4, re-based P21)
//
// CANONICAL claim. With lane 11 PARKED — in the basis, out of the shell — the
// register runs on shell {2,3,5,7,13,17,19} = 881,790 with the internal
// anchor on lane 11:
//
//     K ≡ (s − r) · 7   (mod 11)        r = x mod 881,790,  s = x mod 11
//
// Exact for every integer arcsecond x in [0, 1,296,000), where K ≤ 1 — the bare
// lane covers the ring with an order of magnitude to spare. The anchor is a
// sub-product of the fixed basis and its lane set is disjoint from the shell,
// so it is tray-determined and i.i.d. survives.
//
// LEGACY claim, retained and still certified: the gear split, shell 30,030 with
// anchor 17·19 = 323 and the precomputed inverse 287, K ≤ 43.
//
// Both are swept together so the re-base is shown to lose nothing. SafeS8
// residues remain injective on the ring (M8 = 9,699,690 > 1,296,000).
//
// Chunked + async so the browser stays live. BigInt only.

import {
  M6, GEAR_PRODUCT, M6_INV_MOD_GEAR, ARCSEC_CIRCLE,
  PARK, M_SHELL, M_SHELL_INV_MOD_PARK, K_MAX_PARKED, K_MAX_LEGACY,
} from "../src/core/basis.js";

export async function runSweep(onProgress) {
  const RING = ARCSEC_CIRCLE;
  const CHUNK = 32400n;                 // 40 chunks over the ring
  let x = 0n, checked = 0n;
  let parkedMismatches = 0, gearMismatches = 0;
  let maxKParked = 0n, maxKLegacy = 0n, firstFail = null;

  while (x < RING) {
    const end = x + CHUNK < RING ? x + CHUNK : RING;
    for (; x < end; x++) {
      // ── canonical: parked shell, lane-11 anchor ──
      const r = x % M_SHELL;
      const s = x % PARK;
      let kP = ((s - r) * M_SHELL_INV_MOD_PARK) % PARK; if (kP < 0n) kP += PARK;
      const actualP = x / M_SHELL;
      if (kP !== actualP) { parkedMismatches++; if (firstFail === null) firstFail = x.toString(); }
      if (actualP > maxKParked) maxKParked = actualP;

      // ── legacy: gear shell, 17·19 anchor ──
      const vM = x % M6;
      const vA = x % GEAR_PRODUCT;
      let kG = ((vA - vM) * M6_INV_MOD_GEAR) % GEAR_PRODUCT; if (kG < 0n) kG += GEAR_PRODUCT;
      const actualG = x / M6;
      if (kG !== actualG) { gearMismatches++; if (firstFail === null) firstFail = x.toString(); }
      if (actualG > maxKLegacy) maxKLegacy = actualG;

      checked++;
    }
    if (onProgress) {
      await onProgress(Number((x * 100n) / RING), checked.toString(),
        parkedMismatches + gearMismatches);
    }
  }

  return {
    name: "Full ecliptic sweep [0, 1,296,000) — parked shell (canonical) + gear shell (legacy)",
    checked: checked.toString(),
    mismatches: parkedMismatches + gearMismatches,
    parked: {
      shell: M_SHELL.toString(), anchor: PARK.toString(),
      mismatches: parkedMismatches, maxK: maxKParked.toString(),
      anchor_internal: true, corridor_ok: maxKParked < PARK,
    },
    legacy: {
      shell: M6.toString(), anchor: GEAR_PRODUCT.toString(),
      mismatches: gearMismatches, maxK: maxKLegacy.toString(),
      corridor_ok: maxKLegacy < GEAR_PRODUCT,
    },
    maxK: maxKParked.toString(),
    firstFail,
    ok: parkedMismatches === 0 && gearMismatches === 0 && checked === RING
      && maxKParked === K_MAX_PARKED && maxKLegacy === K_MAX_LEGACY,
  };
}
