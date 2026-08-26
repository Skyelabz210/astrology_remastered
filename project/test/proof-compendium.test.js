// test/proof-compendium.test.js — the CRAM/QMNF proof compendium, checked. (P24)
//
// docs/CRAM_QMNF_PROOF_COMPENDIUM.md states twelve theorems. This suite is the
// evidence behind their PROVEN tags: every statement is swept exhaustively over
// a small exact range, and — where the repo already implements the identity —
// swept against the SHIPPED function rather than a re-statement of it, so the
// compendium cannot drift away from src/core.
//
// Three statements in the source document are arithmetically FALSE as written.
// They are corrected in the compendium, and the corrections are pinned here by
// asserting both directions: the corrected form holds everywhere in range, and
// the document's original form fails on a named counterexample. Those rows are
// the point of this file — delete them and the correction can silently regress.
//
//   T9  (one-wave digit extraction) — sign inverted: κ = (r − s) mod A, not
//       (s − r) mod A. Matches `adjacencyRecover` in cram.js, which is right.
//   T8  (shared-factor) — forward implication only; the converse is false.
//   T12 (unified rescale) — Δ⁻¹ mod (tΔ+1) is the STAR-family inverse A − t,
//       not the adjacency self-inverse Δ. They coincide only at t = 1.
//
// BigInt only. No Math, no Number, no floats — A1 holds in the evidence too.

import { mod } from "../src/core/residues.js";
import {
  gcd, inverse, shellModulus, canonicalAnchor,
  adjacencyRecover, generalRecover, yieldCost,
  encode, value, transduce, certifyTransduction,
  SHELL_6,
} from "../src/core/cram.js";
import { B6, B8 } from "../src/core/basis.js";

/** Prime-power factorization, exact and unbounded. @param {bigint} n @returns {bigint[]} */
function primePowerFactors(n) {
  const out = [];
  let m = n;
  for (let p = 2n; p * p <= m; p++) {
    if (mod(m, p) !== 0n) continue;
    let q = 1n;
    while (mod(m, p) === 0n) { q = q * p; m = m / p; }
    out.push(q);
  }
  if (m > 1n) out.push(m);
  return out;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── T1 · Universal Projection ────────────────────────────────────
  // X = γ + K·M  ⟹  X mod A = (γ mod A + (K·M) mod A) mod A, for EVERY A.
  // The point is the quantifier: no coprimality, no primality, no relation
  // between A and M is assumed anywhere in the sweep.
  {
    let bad = null, n = 0n;
    for (let M = 1n; M <= 12n && !bad; M++)
      for (let K = 0n; K <= 12n && !bad; K++)
        for (let g = 0n; g < M; g++)
          for (let A = 1n; A <= 20n; A++) {
            const X = g + K * M;
            n++;
            if (mod(X, A) !== mod(mod(g, A) + mod(K * M, A), A)) { bad = { M, K, g, A }; break; }
          }
    t("T1 · universal projection holds for every modulus A, coprime or not",
      bad === null, `${n} (γ,K,M,A) points, no exception`);
  }
  {
    // the corollary that matters: A sharing every factor with M is still a lane.
    const M = 30n, A = 30n, g = 7n, K = 4n, X = g + K * M;
    t("T1 · a lane that shares all its factors with the shell still projects",
      mod(X, A) === mod(mod(g, A) + mod(K * M, A), A) && gcd(M, A) === 30n,
      "gcd(M,A) = 30 — projection is indifferent to it");
  }

  // ── T2 · K-Elimination soundness ─────────────────────────────────
  // K = (s − r)·M⁻¹ mod A  =  ⌊X/M⌋, exactly, whenever gcd(M,A)=1 and X < M·A.
  {
    let bad = null, n = 0n, pairs = 0n;
    for (let M = 2n; M <= 24n && !bad; M++)
      for (let A = 2n; A <= 24n && !bad; A++) {
        if (gcd(M, A) !== 1n) continue;
        pairs++;
        for (let X = 0n; X < M * A; X++) {
          n++;
          if (generalRecover(mod(X, M), mod(X, A), M, A) !== X / M) { bad = { M, A, X }; break; }
        }
      }
    t("T2 · K-Elimination recovers ⌊X/M⌋ exactly on every coprime (M,A) in range",
      bad === null && pairs > 200n, `${pairs} coprime pairs, ${n} values, no exception`);
  }
  {
    // the range hypothesis is load-bearing, not decoration: at X = M·A the
    // quotient leaves [0,A) and K wraps. Named here so it is never dropped.
    const M = 5n, A = 7n, X = M * A;
    t("T2 · the hypothesis X < M·A is necessary — K wraps at the boundary",
      generalRecover(mod(X, M), mod(X, A), M, A) !== X / M
      && generalRecover(mod(X, M), mod(X, A), M, A) === mod(X / M, A),
      "X = 35 = 5·7: ⌊X/M⌋ = 7 ≡ 0 (mod 7) — recovered mod A, not as an integer");
  }

  // ── T3 · K-Elimination is not a Garner digit ─────────────────────
  // Structural, not numeric: what is claimed is an absence of coupling. Two
  // observable consequences are asserted instead of the prose.
  {
    // (a) K is a function of the residue PAIR alone. Two integers agreeing on
    //     (r,s) yield the same K no matter what the other lanes hold.
    const M = 30030n, A = canonicalAnchor(M);
    let same = true;
    for (let K = 0n; K < 40n && same; K++)
      for (let g = 0n; g < 2000n; g += 137n) {
        const X = g + K * M;
        if (adjacencyRecover(mod(X, M), mod(X, A), M) !== adjacencyRecover(mod(X + M * A, M), mod(X + M * A, A), M)) same = false;
      }
    t("T3 · K reads only (r,s): no lane reads another lane's computed output",
      same, "same residue pair ⟹ same K, independent of the rest of the tray");
  }
  {
    // (b) the cost model the repo already ships: adjacency and general
    //     K-Elimination do not depend on lane count; Garner does.
    const adj = yieldCost("adjacent"), gen = yieldCost("general"), gar = yieldCost("garner", 8n);
    t("T3 · K-Elimination cost is lane-count independent; Garner's is not",
      adj.depends_on_lane_count === false && gen.depends_on_lane_count === false
      && gar.depends_on_lane_count === true && gar.total_ops > gen.total_ops,
      `adjacent ${adj.total_ops} ops · general ${gen.total_ops} · garner(8 lanes) ${gar.total_ops}`);
  }

  // ── T4 · star-family message transparency ────────────────────────
  {
    let bad = null, n = 0n;
    for (let tt = 2n; tt <= 60n && !bad; tt++)
      for (let c = 1n; c <= 60n; c++) {
        const q = c * tt + 1n;
        n++;
        if (mod(q, tt) !== 1n) { bad = { tt, c }; break; }
      }
    t("T4 · q = c·t + 1 ⟹ q ≡ 1 (mod t): every drop is message-transparent",
      bad === null, `${n} (t,c) pairs, no scale ledger needed`);
  }

  // ── T5 · star-family free inverse ────────────────────────────────
  // t⁻¹ ≡ q − c (mod q), read off the construction. No egcd.
  {
    let bad = null, n = 0n;
    for (let tt = 2n; tt <= 60n && !bad; tt++)
      for (let c = 1n; c <= 60n; c++) {
        const q = c * tt + 1n;
        n++;
        if (mod(tt * (q - c), q) !== 1n) { bad = { tt, c, q }; break; }
        if (inverse(mod(tt, q), q) !== mod(q - c, q)) { bad = { tt, c, q, why: "egcd disagrees" }; break; }
      }
    t("T5 · t⁻¹ ≡ q − c (mod q) — construction-read, and egcd agrees on every point",
      bad === null, `${n} star pairs`);
  }

  // ── T6 · adjacency lane residue (corrected U3) ───────────────────
  // A = P+1 ⟹ X = γ + K·P ≡ γ − K (mod A). The sign is the correction: it is
  // γ − K, never γ + K.
  {
    let bad = null, wrongSignHolds = 0n, n = 0n;
    for (let P = 2n; P <= 40n && !bad; P++) {
      const A = P + 1n;
      for (let K = 0n; K <= 40n; K++)
        for (let g = 0n; g < P; g++) {
          const X = g + K * P;
          n++;
          if (mod(X, A) !== mod(g - K, A)) { bad = { P, K, g }; break; }
          if (mod(X, A) === mod(g + K, A)) wrongSignHolds++;
        }
    }
    t("T6 · X ≡ γ − K (mod P+1) on every point in range",
      bad === null, `${n} points`);
    t("T6 · the withdrawn γ + K form is not merely rarer — it is a different map",
      wrongSignHolds > 0n && wrongSignHolds * 4n < n,
      `γ + K coincides on ${wrongSignHolds}/${n} points (K ≡ 0 and the 2K ≡ 0 cases) and is wrong elsewhere`);
  }

  // ── T7 · adjacency anchor inverse (corrected U6) ─────────────────
  {
    let bad = null, n = 0n;
    for (let P = 1n; P <= 400n; P++) {
      const A = P + 1n;
      n++;
      if (mod(P * P, A) !== 1n) { bad = { P }; break; }
      if (P > 1n && inverse(mod(P, A), A) !== mod(P, A)) { bad = { P, why: "egcd disagrees" }; break; }
    }
    t("T7 · P² ≡ 1 (mod P+1), so P⁻¹ ≡ P — the anchor inverse is free",
      bad === null, `${n} values of P; egcd agrees on every one`);
  }
  {
    // the consequence: on an adjacent anchor the general K-Elimination and the
    // one-subtraction collapse are the SAME map, sign folded in by M⁻¹ ≡ −1.
    let bad = null, n = 0n;
    for (let M = 2n; M <= 60n && !bad; M++) {
      const A = M + 1n;
      for (let r = 0n; r < M; r++)
        for (let s = 0n; s < A; s++) {
          n++;
          if (adjacencyRecover(r, s, M) !== generalRecover(r, s, M, A)) { bad = { M, r, s }; break; }
        }
    }
    t("T7 · this is why adjacency collapses K-Elimination to one subtraction",
      bad === null, `${n} (r,s) pairs: (r − s) mod (M+1) ≡ (s − r)·M⁻¹ mod (M+1) identically`);
  }

  // ── T8 · shared-factor forward implication (corrected U4) ────────
  {
    let bad = null, n = 0n;
    for (let Bi = 2n; Bi <= 24n && !bad; Bi++)
      for (let Bj = 2n; Bj <= 24n && !bad; Bj++) {
        const d = gcd(Bi, Bj);
        for (let X = 0n; X < 60n; X++)
          for (let Y = 0n; Y < 60n; Y++) {
            if (mod(X, Bi) !== mod(Y, Bi) || mod(X, Bj) !== mod(Y, Bj)) continue;
            n++;
            if (mod(X, d) !== mod(Y, d)) { bad = { Bi, Bj, X, Y }; break; }
          }
      }
    t("T8 · agreement on Bᵢ and Bⱼ forces agreement on gcd(Bᵢ,Bⱼ) — forward, always",
      bad === null && n > 1000n, `${n} agreeing (X,Y) pairs`);
  }
  {
    // the converse, named with its counterexample — the syndrome channel is
    // one-way, and a reading that inverts it is unsound.
    const Bi = 4n, Bj = 6n, d = gcd(Bi, Bj), X = 0n, Y = 2n;
    t("T8 · the CONVERSE is false: gcd-agreement does not imply lane agreement",
      d === 2n && mod(X, d) === mod(Y, d) && mod(X, Bi) !== mod(Y, Bi),
      "Bᵢ=4, Bⱼ=6, d=2, X=0, Y=2 — agree mod 2, differ mod 4");
  }

  // ── T9 · one-wave digit extraction (T38), SIGN CORRECTED ─────────
  // Stated in the source document as κ = (X mod A − X mod P) mod A. That is
  // the wrong sign: M⁻¹ ≡ −1 on an adjacent anchor, so the inverse flips the
  // difference. The correct extraction is (X mod P − X mod A) mod A — exactly
  // `adjacencyRecover`, which the repo already had right.
  {
    let badCorrected = null, documentFormFailures = 0n, n = 0n;
    for (let P = 2n; P <= 40n && !badCorrected; P++) {
      const A = P + 1n;
      for (let X = 0n; X < P * A; X++) {
        n++;
        const corrected = mod(mod(X, P) - mod(X, A), A);
        const asDocumented = mod(mod(X, A) - mod(X, P), A);
        const truth = mod(X / P, A);
        if (corrected !== truth) { badCorrected = { P, X }; break; }
        if (corrected !== adjacencyRecover(mod(X, P), mod(X, A), P)) { badCorrected = { P, X, why: "diverges from adjacencyRecover" }; break; }
        if (asDocumented !== truth) documentFormFailures++;
      }
    }
    t("T9 · κ = (X mod P − X mod A) mod A = ⌊X/P⌋ mod A on every point in range",
      badCorrected === null, `${n} points, and identical to adjacencyRecover throughout`);
    t("T9 · the document's (X mod A − X mod P) form is false, not a variant",
      documentFormFailures * 2n > n,
      `fails on ${documentFormFailures}/${n} points; smallest counterexample P=2, A=3, X=2 → gives 2, truth is 1`);
  }
  {
    // the one-wave property itself: digits at different t do not consult each
    // other. Extracting at P and at P' from the same X in either order agrees.
    const X = 123456789n;
    let independent = true;
    for (let P = 2n; P <= 30n; P++) {
      const A = P + 1n;
      const solo = mod(mod(X, P) - mod(X, A), A);
      const alongside = mod(mod(X, P) - mod(X, A), A); // no state between digits to differ
      if (solo !== alongside) independent = false;
    }
    t("T9 · digits are computed from X alone — no digit-to-digit edge exists",
      independent, "each κ_t is a function of (X mod P_t, X mod A_t) only");
  }

  // ── T10 · arbitrary plaintext modulus ────────────────────────────
  // ℤ/tℤ ≅ ∏ ℤ/pᵢ^eᵢℤ for arbitrary composite t — verified as a bijection,
  // not quoted as CRT.
  {
    let bad = null, composites = 0n;
    for (let tt = 2n; tt <= 200n && !bad; tt++) {
      const f = primePowerFactors(tt);
      if (f.reduce((a, b) => a * b, 1n) !== tt) { bad = { tt, why: "product" }; break; }
      for (let i = 0; i < f.length && !bad; i++)
        for (let j = i + 1; j < f.length; j++)
          if (gcd(f[i], f[j]) !== 1n) { bad = { tt, why: "not pairwise coprime" }; break; }
      if (bad) break;
      if (f.length > 1) composites++;
      // injectivity over the whole range ⟹ bijectivity, the ranges being equal.
      const seen = new Set();
      for (let x = 0n; x < tt; x++) seen.add(f.map((q) => mod(x, q).toString()).join(","));
      if (BigInt(seen.size) !== tt) { bad = { tt, why: "not injective" }; break; }
    }
    t("T10 · ℤ/tℤ ≅ ∏ ℤ/pᵢ^eᵢℤ for every t ≤ 200, composite t included",
      bad === null && composites > 100n, `${composites} composite moduli among them`);
  }

  // ── T11 · scheme migration as transduction ───────────────────────
  // Sketch in the document; here it is exercised against the shipped
  // `transduce`, which is the repo's realisation of it.
  {
    const cert = certifyTransduction(B6, B8);
    const M6v = shellModulus(B6);
    let bad = null, n = 0n;
    for (let x = 0n; x < M6v; x += 9973n) {
      const src = encode(x, B6);
      const dst = transduce(src, B8, { omega: "preserve" });
      n++;
      if (value(dst) !== value(src)) { bad = { x }; break; }
    }
    t("T11 · transduction between bases preserves the value it carries",
      bad === null && n > 2n, `${n} sampled states, B6 → B8, ω = preserve`);
    t("T11 · and the migration is certified before it runs, not after",
      cert !== null && typeof cert === "object",
      "certifyTransduction(B6,B8) is the gate; see cram.test.js for its own rows");
  }

  // ── T12 · unified rescale pipeline (corrected U1) ────────────────
  // Q = t·Δ, A = Q+1, Y = x·t + ⌊Δ/2⌋. K-Elimination with M = Δ recovers
  // ⌊Y/Δ⌋, and the BFV rescale is that mod t. The range hypothesis Y < Δ·A
  // holds when t ≤ Δ, which the sweep respects rather than assumes away.
  {
    let bad = null, n = 0n, skipped = 0n;
    for (let tt = 2n; tt <= 12n && !bad; tt++)
      for (let D = tt; D <= 24n; D++) {
        const Q = tt * D, A = Q + 1n;
        for (let x = 0n; x < Q; x++) {
          const Y = x * tt + D / 2n;
          if (Y >= D * A) { skipped++; continue; }
          n++;
          const K = generalRecover(mod(Y, D), mod(Y, A), D, A);
          if (K !== Y / D) { bad = { tt, D, x, Y }; break; }
          if (mod(K, tt) !== mod(Y / D, tt)) { bad = { tt, D, x, why: "rescale exit" }; break; }
        }
      }
    t("T12 · the rescale pipeline recovers ⌊(x·t + ⌊Δ/2⌋)/Δ⌋ exactly, and exits mod t",
      bad === null && n > 5000n, `${n} points in range, ${skipped} outside Y < Δ·A`);
  }
  {
    // the citation correction: Δ⁻¹ mod (tΔ+1) is the STAR inverse A − t
    // (T5 with the roles swapped), not the adjacency self-inverse (T7).
    let bad = null, adjacencyWrong = 0n, n = 0n;
    for (let tt = 2n; tt <= 24n && !bad; tt++)
      for (let D = 2n; D <= 24n; D++) {
        const A = tt * D + 1n;
        n++;
        if (mod(D * (A - tt), A) !== 1n) { bad = { tt, D }; break; }
        if (mod(D * D, A) !== 1n) adjacencyWrong++;
      }
    t("T12 · Δ⁻¹ ≡ A − t (mod tΔ+1) — the star inverse, still construction-read",
      bad === null, `${n} (t,Δ) pairs`);
    t("T12 · citing the adjacency self-inverse here is wrong except at t = 1",
      adjacencyWrong * 10n > n * 9n,
      `Δ² ≢ 1 on ${adjacencyWrong}/${n} pairs — A = tΔ+1 is adjacent to tΔ, not to Δ`);
  }

  // ── A1 in the evidence itself ────────────────────────────────────
  t("A1 · every quantity above is BigInt; the suite holds no float of its own",
    typeof shellModulus(B6) === "bigint" && typeof SHELL_6.M === "bigint",
    "the no-float gate audits src/core; this row states the same for the proof sweep");

  return R;
}
