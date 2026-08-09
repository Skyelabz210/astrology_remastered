// test/carry.test.js — the hidden carry. (P25)
//
// Checked against the exact ledger of the Hidden Carry formalization. Every
// figure here is one the draft states; where the draft gives a verified value,
// this suite recomputes it rather than restating it.

import { mod } from "../src/core/residues.js";
import {
  centeredResidue, signedWinding, carrySplit, unsignedWinding,
  signedAnchorResidue, isSignedAnchor, closedShellDescent,
  emitWithCarry, laneShadow, carryFunctional, isResiduePure,
  squareImage, squareShadowLaw, emissionIsUniform,
} from "../src/core/carry.js";
import { encode, transduce, value } from "../src/core/cram.js";
import { M_SHELL, PARK, ARCSEC_CIRCLE } from "../src/core/basis.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── the carry is signed ──────────────────────────────────────────
  {
    let bad = 0;
    for (let x = -200n; x <= 200n; x++) {
      const s = carrySplit(x, 7n);
      if (!s.exact || 2n * (s.r < 0n ? -s.r : s.r) > 7n) bad++;
    }
    t("x = r + p·w exactly, with the centred residue in (−p/2, p/2]",
      bad === 0, "401 consecutive values at p = 7, zero failures");
  }
  t("the centred convention keeps the sign the [0,p) convention discards",
    centeredResidue(5n, 7n) === -2n && mod(5n, 7n) === 5n
    && signedWinding(5n, 7n) === 1n && unsignedWinding(5n, 7n) === 0n,
    "5 = −2 + 7·1 centred, 5 = 5 + 7·0 unsigned — the winding differs by one");
  t("the winding goes NEGATIVE below a shell, which [0,p) cannot express",
    signedWinding(-3n, 7n) === 0n && signedWinding(-5n, 7n) === -1n
    && unsignedWinding(-5n, 7n) === -1n && centeredResidue(-5n, 7n) === 2n,
    "w counts to the NEAREST shell, not the one below");
  t("it is the K-Elimination winding, not the p-adic valuation",
    signedWinding(49n, 7n) === 7n && signedWinding(343n, 7n) === 49n,
    "v_7(49) = 2 but w_7(49) = 7 — different objects entirely");

  // ── Lemma 1: the anchor reads the carry negated ──────────────────
  {
    // [DC] M = 36, A = 37 — verified by the draft over [0, 5000)
    let bad = 0;
    for (let N = 0n; N < 5000n; N++) {
      if (mod(N, 37n) !== signedAnchorResidue(mod(N, 36n), N / 36n, 37n)) bad++;
    }
    t("Lemma 1 — v_A = (r − K) mod A, exact over [0, 5000) at M=36, A=37",
      bad === 0 && isSignedAnchor(36n, 37n),
      "5,000 values, zero mismatches — the ledger's figure, recomputed");
  }
  {
    const d = closedShellDescent(36n, 37n, 5n);
    t("the anchor counts DOWN as the hidden carry counts up",
      d.slice(1, 5).map((z) => z.v.toString()).join() === "36,35,34,33"
      && d.every((z) => z.r === 0n) && d.every((z) => z.v === z.predicted),
      "N = 36, 72, 108, 144 → v₃₇ = 36, 35, 34, 33, every r = 0");
    t("closed shells are INDISTINGUISHABLE in the residue lane",
      d.every((z) => z.r === 0n) && new Set(d.map((z) => z.v.toString())).size === 5,
      "five shells, one residue between them, five distinct anchors");
  }
  t("K-Elim on the [DC] pair reproduces the ledger: k_elim(36,37,73) = 1,1,2",
    [[36n, 1n], [37n, 1n], [73n, 2n]].every(([N, want]) =>
      mod((mod(N, 37n) - mod(N, 36n)) * 36n, 37n) === want),
    "36 ≡ −1 (mod 37), so the inverse is self-dual: 36⁻¹ ≡ 36 ≡ −1");

  // ── the same descent on the register's own parked split ─────────
  {
    // the ecliptic ring holds exactly two closed shells of M_SHELL
    const closed = [];
    for (let x = 0n; x < ARCSEC_CIRCLE; x += M_SHELL) closed.push(x);
    t("the ring carries two closed shells, identical in every shell lane",
      closed.length === 2 && closed.every((x) => mod(x, M_SHELL) === 0n),
      "0″ and 881,790″ both read r = 0 — only the carry separates them");
    t("the parked lane separates them, and it is the carry that does it",
      mod(closed[0], PARK) !== mod(closed[1], PARK)
      && closed[1] / M_SHELL === 1n && closed[0] / M_SHELL === 0n,
      `lane 11 reads ${mod(closed[0], PARK)} vs ${mod(closed[1], PARK)}`);
  }

  // ── the carry functional ─────────────────────────────────────────
  {
    const pure = [];
    for (let i = 0n; i < 512n; i++) pure.push(mod(i, 7n) - 3n);
    t("C = Σ w² is zero exactly when nothing wound past its shell",
      carryFunctional(pure, 7n) === 0n && isResiduePure(pure, 7n),
      "512 centred residues, zero winding energy");
    const wound = [...pure]; wound[0] = 7n;
    t("one wound value lifts the functional off zero",
      carryFunctional(wound, 7n) === 1n && !isResiduePure(wound, 7n),
      "w_7(7) = 1, so C = 1");
    t("C is non-negative and integer-valued for any field",
      [0n, 1n, 7n, 14n, -7n, 100n, -100n, 7000000n].every((v) =>
        carryFunctional([v, v, v], 7n) >= 0n));
  }

  // ── the Sqr exception ────────────────────────────────────────────
  t("squaring is 2-to-1, so its image covers only (p+1)/2 of p values",
    squareImage(13n).distinct === 7n && squareImage(13n).expected === 7n
    && squareImage(37n).distinct === 19n && squareImage(37n).expected === 19n,
    "p = 13 hits 7 of 13; p = 37 hits 19 of 37 — the ledger's figures");
  t("an additive shift is flat; squaring is not — Lemma 3 does not apply",
    emissionIsUniform(13n, (r) => r + 5n).uniform
    && !emissionIsUniform(13n, (r) => r * r).uniform,
    "a bijection of Z_p absorbs into uniformity; a 2-to-1 map cannot");
  {
    const law = squareShadowLaw(13n);
    const counts = [...law.values()];
    t("the discarded quotient ⌊r²/p⌋ inherits the structure — it is not flat",
      law.size > 1 && !counts.every((c) => c === counts[0]),
      `${law.size} distinct shadows with unequal mass — the readable channel`);
  }

  // ── the carry is captured, not discarded ─────────────────────────
  {
    const A = [2n, 3n, 5n, 7n], Bt = [3n, 5n, 7n, 11n];
    const s = transduce(encode(1000n, A), Bt, { phiLane: (v) => 10000n * v });
    const line = s.lineage.at(-1);
    t("every lane's emitted carry is recorded, not dropped on the floor",
      line.lane_carry.length === 4 && line.lane_carry.some((c) => c !== "0"),
      `lane carries ${line.lane_carry.join(", ")}`);
    t("the carry the lane discarded is exactly ⌊Φ(v)/b⌋",
      line.lane_carry.every((c, i) => {
        const b = Bt[i];
        const v = mod(1000n, b);           // Φ acts lane-wise on the bridged value
        return BigInt(c) === laneShadow(10000n * v, b);
      }),
      "recomputed independently per lane, all four agree");
    t("the winding energy of the transduction is reported",
      BigInt(line.carry_energy) > 0n
      && BigInt(line.carry_energy) === line.lane_carry.reduce((a, c) => a + BigInt(c) * BigInt(c), 0n),
      `C = ${line.carry_energy}`);
    t("capturing the carry changes no value — it recovers what was thrown away",
      value(s) === 10000000n,
      "the residues are untouched; the quotient is simply no longer lost");
  }
  {
    // Φ = id emits no carry: the bridged value is already reduced
    const s = transduce(encode(1000n, [2n, 3n, 5n, 7n]), [3n, 5n, 7n, 11n]);
    t("an identity transduction emits no carry at all",
      s.lineage.at(-1).lane_carry.every((c) => c === "0")
      && s.lineage.at(-1).carry_energy === "0");
  }
  {
    const e = emitWithCarry(10000n, 13n);
    t("emitWithCarry keeps both halves of a reduction",
      e.residue === mod(10000n, 13n) && e.carry === 10000n / 13n
      && e.residue + 13n * e.carry === 10000n,
      "10,000 = 3 + 13·769");
  }

  return R;
}
