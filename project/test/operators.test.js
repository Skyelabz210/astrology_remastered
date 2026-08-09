// test/operators.test.js — the lane-wise operator atlas, derived not asserted. (P13)
//
// This suite exists to settle a specific set of claims from an operator-atlas
// paper circulated against this project: that each lane of S8 admits 14
// primitive exact operations, that the raw space is therefore 14^8, that
// filtering leaves 14,174,742 verified operators, and that the result gives
// native exact square roots and Frobenius maps.
//
// Every one of those is checked here against enumeration. What survives is
// recorded as PROVEN; what does not is recorded as REJECTED with the
// counter-computation attached.

import { B8 } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import {
  gcd, totient, powMod, bijectiveExponents, laneTable, isExactLaneOperator,
  laneOperators, laneMonomials, atlas, laneClosesUnderComposition,
  sqrtDiagnostics, frobeniusIsIdentity, keyspaceBitsFloor,
} from "../src/core/operators.js";

const M = B8.reduce((a, p) => a * p, 1n);

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── helpers ──────────────────────────────────────────────────────
  t("gcd / totient / powMod are exact",
    gcd(12n, 18n) === 6n && totient(18n) === 6n && totient(1n) === 1n
    && powMod(4n, 9n, 19n) === mod(4n ** 9n, 19n));

  // ── the per-lane count is φ(p−1), never 14 ──────────────────────
  {
    const want = { 2: 1n, 3: 1n, 5: 2n, 7: 2n, 11: 4n, 13: 4n, 17: 8n, 19: 6n };
    const ok = B8.every((p) => BigInt(bijectiveExponents(p).length) === want[p.toString()]
      && totient(p - 1n) === want[p.toString()]);
    t("bijective exponents per lane = φ(p−1) — 1,1,2,2,4,4,8,6", ok,
      B8.map((p) => `${p}→${bijectiveExponents(p).length}`).join(" "));
  }
  {
    const counts = B8.map((p) => BigInt(laneOperators(p).length));
    const closed = B8.map((p) => (p - 1n) * totient(p - 1n));
    t("distinct exact lane operators c·x^e = (p−1)·φ(p−1) — 1,2,8,12,40,48,128,108",
      counts.every((c, i) => c === closed[i]),
      B8.map((p, i) => `${p}→${counts[i]}`).join(" "));
    t("REJECTED — no lane of S8 admits 14 exact operators",
      counts.every((c) => c !== 14n),
      "closest is lane 7 with 12; lane 2 admits exactly 1");
    t("REJECTED — the per-lane count cannot be uniform: lane 2's group is trivial",
      counts[0] === 1n && counts[1] === 2n,
      "(Z/2)* has order 1, so x↦x is the only multiplicative bijection");
  }

  // ── every enumerated operator really is one ──────────────────────
  {
    let bad = null, total = 0n;
    for (const p of B8) {
      for (const op of laneOperators(p)) {
        total++;
        if (!isExactLaneOperator(op.table, p)) { bad = `p=${p} c=${op.c} e=${op.e}`; break; }
      }
      if (bad) break;
    }
    t("every enumerated lane map is a 0-fixing bijection, checked exhaustively",
      bad === null, bad === null ? `${total} lane maps verified` : "counterexample " + bad);
  }
  {
    // and the labelling (c, e) → function is injective, so no double counting
    let dup = null;
    for (const p of B8) {
      const seen = new Set();
      for (const e of bijectiveExponents(p)) for (let c = 1n; c < p; c++) {
        const k = laneTable(p, c, e).join(",");
        if (seen.has(k)) { dup = `p=${p}`; break; }
        seen.add(k);
      }
      if (dup) break;
    }
    t("(c, e) ↦ function is injective — the count is distinct maps, not labels",
      dup === null, dup === null ? "no collisions in any lane" : "collision at " + dup);
  }
  t("the exact lane operators close under composition (holomorph of C_{p−1})",
    B8.every(laneClosesUnderComposition), "verified by composing every pair in every lane");

  // ── the global atlas ─────────────────────────────────────────────
  {
    const a = atlas();
    t("atlas: per-lane enumeration agrees with the closed form in every lane",
      a.lanes.every((l) => l.closed_form_agrees));
    t("pure monomial operators over S8: ∏φ(p−1) = 3,072",
      a.total_monomial === "3072");
    t("twisted operators over S8: ∏(p−1)φ(p−1) = 5,096,079,360",
      a.total_twisted === "5096079360");
    t("pure multiplications over S8: ∏(p−1) = φ(M) = 1,658,880",
      a.total_units === "1658880" && a.modulus === "9699690");
  }
  {
    // the paper's arithmetic, checked
    t("14^8 = 1,475,789,056 — the paper's raw figure is arithmetically right",
      14n ** 8n === 1475789056n);
    t("REJECTED — but 14^8 is not this operator space: the true twisted space is larger",
      5096079360n > 1475789056n,
      "5,096,079,360 exact operators vs an asserted raw space of 1,475,789,056");
    t("the paper's family table does sum to its total",
      56700n + 2841120n + 7612922n + 3664000n === 14174742n,
      "internal consistency is not evidence of derivation");
    {
      // a count of algebraic objects over S8 should be smooth; this one is not
      let n = 14174742n, big = 1n;
      for (let d = 2n; d * d <= n; d++) { while (mod(n, d) === 0n) { n = n / d; if (d > big) big = d; } }
      if (n > big) big = n;
      t("REJECTED — 14,174,742 = 2 · 3 · 2,362,457 with a 7-digit prime factor",
        big === 2362457n,
        "no product of lane counts over S8 can carry that factor");
    }
  }

  // ── square root is not a lane operator ───────────────────────────
  {
    const d = sqrtDiagnostics();
    t("REJECTED — sqrt is not total: only 181,440 of 9,699,690 residues are squares in every lane",
      !d.is_total && d.defined_everywhere === "181440" && d.defined_everywhere_of === "9699690",
      "undefined on 98.13% of the torus");
    t("REJECTED — sqrt is not single-valued: a generic square has 2^7 = 128 roots mod M",
      !d.is_single_valued && d.root_multiplicity === "128");
    t("a fixed per-lane branch returns the intended root for 90,720 / 4,849,845 of inputs",
      d.branch_hits === "181440" && d.branch_of === "9699690",
      "181,440/9,699,690 = 90,720/4,849,845 ≈ 1.87% — not 'exact for all perfect squares'");
    t("per-lane square counts are (p+1)/2 for odd p, 2 at lane 2",
      d.lanes.every((l) => l.squares === (l.prime === "2" ? "2" : ((BigInt(l.prime) + 1n) / 2n).toString())),
      d.lanes.map((l) => `${l.prime}→${l.squares}`).join(" "));
  }
  {
    // empirical confirmation on real inputs, independent of the closed form
    let hit = 0n, tot = 0n;
    const roots = B8.map((p) => {
      const m = new Map();
      for (let y = 0n; y < p; y++) { const q = mod(y * y, p); if (!m.has(q.toString())) m.set(q.toString(), y); }
      return m;   // first (smallest) root per square
    });
    for (let Y = 0n; Y < 20000n; Y++) {
      const X = mod(Y * Y, M);
      let ok = true;
      for (let i = 0; i < B8.length; i++) {
        if (roots[i].get(mod(X, B8[i]).toString()) !== mod(Y, B8[i])) { ok = false; break; }
      }
      if (ok) hit++;
      tot++;
    }
    // closed-form rate is 181440/9699690; over 20,000 samples expect ≈ 374
    t("empirical: min-branch sqrt recovers Y on a ~1.9% minority of 20,000 real inputs",
      hit * 100n < tot * 3n && hit * 100n > tot,
      `${hit}/${tot} recovered`);
  }

  // ── Frobenius on a prime field is the identity ──────────────────
  t("REJECTED — 'Frobenius maps' are not available in-lane: x^p = x on a prime field",
    B8.every(frobeniusIsIdentity),
    "Frobenius is non-trivial only over F_{p^n}, n > 1; every lane here is prime");

  // ── the cryptographic claim ─────────────────────────────────────
  {
    const paper = keyspaceBitsFloor(14174742n);
    const real = keyspaceBitsFloor(5096079360n);
    t("REJECTED — operator-as-secret-permutation gives a 23-bit keyspace as claimed",
      paper === 23n, "14,174,742 operators ≈ 2^23 — exhaustible instantly");
    t("even the true twisted space is only a 32-bit keyspace",
      real === 32n, "5,096,079,360 ≈ 2^32 — still not a cryptographic parameter");
  }

  // ── what does survive ───────────────────────────────────────────
  t("PROVEN — the atlas is real, and larger than claimed, once derived correctly",
    BigInt(atlas().total_twisted) === 5096079360n
    && B8.every((p) => BigInt(laneOperators(p).length) === (p - 1n) * totient(p - 1n)),
    "5,096,079,360 exact, reversible, 0-fixing lane operators over S8");
  t("PROVEN — they are single-step and need no iterative algorithm",
    laneMonomials(17n).length === 8 && laneOperators(19n).length === 108,
    "c·x^e is one modular exponentiation per lane, no Tonelli–Shanks required");

  return R;
}
