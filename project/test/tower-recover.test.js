// test/tower-recover.test.js — T-COMP-1, the anchor-set recovery. (P26)
//
// Verified exhaustively over the full period M·L, as the composition document
// specifies. This SUPERSEDES the anchor-power lift of P24.

import { mod } from "../src/core/residues.js";
import { gcd } from "../src/core/cram.js";
import {
  lcmAll, crtCombine, anchorSetCorridor, towerRecover, towerRecoverFrom,
  extendAnchors, crossCheckWinding,
} from "../src/core/tower-recover.js";
import { M_SHELL, PARK } from "../src/core/basis.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── the unconditional-inverse claim ──────────────────────────────
  {
    let bad = 0, n = 0;
    for (let M = 1n; M <= 300n; M++) {
      for (let L = 1n; L <= 300n; L++) {
        const d = gcd(M, L);
        if (gcd(M / d, L / d) !== 1n) bad++;
        n++;
      }
    }
    t("gcd(M/d, L/d) = 1 UNCONDITIONALLY — no coprimality precondition at all",
      bad === 0 && n === 90000,
      "90,000 (M,L) pairs: per prime one exponent is exhausted by the min");
  }

  // ── exhaustive over the full period, per the document ────────────
  const CASES = [
    { M: 30n, anchors: [7n, 11n], label: "coprime anchor set, d = 1" },
    { M: 36n, anchors: [37n], label: "the [DC] pair 36/37" },
    { M: 12n, anchors: [8n, 18n], label: "anchors NOT coprime to each other, d = 12" },
    { M: 260n, anchors: [365n], label: "the Maya gradient, d = 5, R = 73" },
  ];
  for (const c of CASES) {
    const { L, d, R: Rc } = anchorSetCorridor(c.M, c.anchors);
    let bad = 0, n = 0n;
    for (let x = 0n; x < c.M * L; x++) {
      const got = towerRecoverFrom(x, c.M, c.anchors);
      if (got === null || got.K !== mod(x / c.M, Rc)) bad++;
      n++;
    }
    t(`T-COMP-1 exact over the full period M·L — ${c.label}`,
      bad === 0 && n === c.M * L,
      `M=${c.M} anchors=[${c.anchors}] L=${L} d=${d} R=${Rc} — ${n} values, 0 mismatches`);
  }
  {
    // the register's own parked split, over the ecliptic ring and beyond
    let bad = 0;
    for (let x = 0n; x < 2000000n; x++) {
      const got = towerRecoverFrom(x, M_SHELL, [PARK]);
      if (got === null || got.K !== mod(x / M_SHELL, 11n)) bad++;
    }
    t("the parked split is an instance: M_SHELL with anchor set [11]",
      bad === 0 && anchorSetCorridor(M_SHELL, [PARK]).R === 11n,
      "2,000,000 values, zero mismatches");
  }

  // ── the gradient is the general case, not an exception ───────────
  t("d > 1 is not routed around — it IS the general case",
    anchorSetCorridor(260n, [365n]).d === 5n
    && anchorSetCorridor(260n, [365n]).R === 73n
    && 73n * 260n === 18980n && 52n * 365n === 18980n,
    "the Maya Calendar Round falls straight out of R = L/d");

  // ── extending the set beats raising one anchor ───────────────────
  {
    const base = anchorSetCorridor(1155n, [1156n]);
    const one = anchorSetCorridor(1155n, [1156n, 13n]);
    const two = anchorSetCorridor(1155n, [1156n, 13n, 19n]);
    t("each added coprime anchor MULTIPLIES R at one pairwise combine",
      base.R === 1156n && one.R === 15028n && two.R === 285532n
      && one.R === base.R * 13n && two.R === one.R * 19n,
      "1,156 → 15,028 → 285,532: linear cost, multiplicative corridor");
    t("an anchor already dividing the lcm buys nothing, and does not pretend to",
      anchorSetCorridor(1155n, [1156n, 13n, 17n]).R === 15028n && 1156n % 17n === 0n,
      "17 | 1156, so lcm does not move");
    const ext = extendAnchors(1155n, [1156n], 10000000n, [13n, 19n, 23n]);
    t("extendAnchors grows the set until the corridor covers what is needed",
      ext.span > 10000000n && ext.anchors.length === 2,
      `[${ext.anchors}] → span ${ext.span}`);
  }

  // ── consistency and fault detection ──────────────────────────────
  t("inconsistent anchor residues are refused, not silently combined",
    crtCombine([1n, 2n], [4n, 6n]) === null && crtCombine([1n, 3n], [4n, 6n]) === 9n,
    "1 mod 4 and 2 mod 6 cannot come from one integer; 1 mod 4 and 3 mod 6 give 9 mod 12");
  t("a residue pair off the class d | (v_L − r) is refused",
    towerRecover(1n, [0n], 12n, [8n]) === null
    && towerRecover(0n, [0n], 12n, [8n]) !== null,
    "M=12 anchors=[8]: d=4 and (0−1) mod 8 = 7, which 4 does not divide — refused");
  t("E-DIV-4 — tracked and extracted windings cross-check",
    crossCheckWinding(5n, 5n).agree && !crossCheckWinding(5n, 6n).agree
    && crossCheckWinding(5n, 6n).fault === "E-DIV-4 winding mismatch",
    "disagreement is an implementation fault, not a domain error");

  // ── lcm plumbing ─────────────────────────────────────────────────
  t("lcm of an anchor set is computed, not assumed to be the product",
    lcmAll([4n, 6n]) === 12n && lcmAll([7n, 11n]) === 77n
    && lcmAll([1156n, 17n]) === 1156n);

  return R;
}
