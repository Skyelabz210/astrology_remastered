// test/cram.test.js — CRAM used as CRAM, not as RNS. (P14)
//
// P14 pinned the adjacency collapse, coprimality-not-primality, the resolution
// gradient and the shadow lift. P17 REVERSES one of its conclusions: the
// adjacent anchor A = M+1 is EXTERNAL to SafeS8 and the tray cannot evaluate
// it, so the internal gear anchor is canonical after all. See
// test/anchor.test.js — the assertions below are restated on that footing.

import { B6, B8, M6, M8, GEAR_PRODUCT, M6_INV_MOD_GEAR, ARCSEC_CIRCLE } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import {
  gcd, inverse, isSafeBasis, shellModulus, canonicalAnchor,
  adjacencyRecover, adjacencyRecoverFrom, generalRecover, gradientRecover, resolution,
  shadowLift, recoveryCost, encode, gamma, value, wellFormed, STATE_FIELDS,
  transduce, isReversiblePolicy, SHELL_6, SHELL_8,
  certifyTransduction, idempotents, gammaOf,
} from "../src/core/cram.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const throws = (f) => { try { f(); return false; } catch { return true; } };

  // ── the anchor ───────────────────────────────────────────────────
  t("the adjacent modulus is coprime for free: gcd(M, M+1) = 1 always",
    canonicalAnchor(M6) === 30031n && gcd(M6, 30031n) === 1n
    && canonicalAnchor(M8) === 9699691n && gcd(M8, 9699691n) === 1n,
    "true, but coprimality is not admissibility — see anchor.test.js");
  t("M ≡ −1 (mod M+1), so M is its own inverse — no precomputation",
    mod(M6, 30031n) === 30030n && mod(M6 * M6, 30031n) === 1n
    && inverse(M6, 30031n) === M6);
  t("CANONICAL — the gear anchor is internal to the basis, and pays one multiply",
    M6_INV_MOD_GEAR === 287n && inverse(M6, GEAR_PRODUCT) === 287n
    && GEAR_PRODUCT === 17n * 19n,
    "17 and 19 are lanes of B8: the anchor is read from the tray, i.i.d. intact");
  t("the adjacent modulus would give a 92× corridor — but it is not admissible",
    30031n / GEAR_PRODUCT === 92n && 30031n > GEAR_PRODUCT
    && mod(M8, 30031n) !== 0n,
    "a wider corridor the tray cannot reach is not a wider corridor");

  // ── the adjacency collapse, exhaustively over the ecliptic ring ──
  {
    // the adjacency IDENTITY is arithmetically exact — that was never in doubt.
    // What P17 corrects is whether it can be evaluated from the tray.
    let bad = null, maxK = 0n, n = 0n;
    for (let x = 0n; x < ARCSEC_CIRCLE; x++) {
      const K = adjacencyRecoverFrom(x, M6);
      const want = x / M6;
      if (K !== want) { bad = x.toString(); break; }
      if (want > maxK) maxK = want;
      n++;
    }
    t("the adjacency identity K ≡ r − s (mod M+1) is exact over the whole ring",
      bad === null && n === ARCSEC_CIRCLE && maxK === 43n,
      "1,296,000/1,296,000 — exact arithmetic, but it reads x, not the tray");
  }
  {
    // agreement with the shipped gear path, wherever the gear path is valid
    let bad = null;
    for (let x = 0n; x < ARCSEC_CIRCLE; x += 7n) {
      const adj = adjacencyRecoverFrom(x, M6);
      const gen = generalRecover(mod(x, M6), mod(x, GEAR_PRODUCT), M6, GEAR_PRODUCT);
      if (adj !== gen) { bad = x.toString(); break; }
    }
    t("the identity and the internal gear path agree on every K",
      bad === null, bad === null ? "185,143 strided points, identical K" : "divergence at x=" + bad);
  }
  {
    const a = recoveryCost("adjacency"), g = recoveryCost("general");
    t("adjacency costs 1 subtract + 1 reduce; the general path costs a multiply more",
      a.multiply === 0n && a.inverse_precomputed === 0n && a.total_ops === 2n
      && g.multiply === 1n && g.inverse_precomputed === 1n && g.total_ops === 3n,
      "the saving is real — but only realisable on a basis where the anchor is internal");
  }

  // ── coprimality, not primality ───────────────────────────────────
  t("30,031 = 59 · 509 and 9,699,691 = 347 · 27,953 — both anchors are COMPOSITE",
    59n * 509n === 30031n && 347n * 27953n === 9699691n,
    "and both work: primality is not what the addressing layer needs");
  {
    const CB = [8n, 9n, 25n, 49n, 11n, 13n];
    const MC = shellModulus(CB);
    t("a safe basis is pairwise-coprime integers, not primes: {8,9,25,49,11,13}",
      isSafeBasis(CB) && MC === 12612600n, "M = 12,612,600");
    let bad = null, n = 0n;
    for (let x = 0n; x < 50n * MC; x += 104729n) {
      if (adjacencyRecoverFrom(x, MC) !== x / MC) { bad = x.toString(); break; }
      n++;
    }
    t("adjacency K-Elim is exact on an ALL-COMPOSITE basis — no lane is a field",
      bad === null && n > 6000n,
      bad === null ? `${n} strided samples over 50 shells, zero mismatches` : "failure at x=" + bad);
    t("a non-coprime pseudo-basis is correctly refused",
      !isSafeBasis([4n, 6n, 10n]) && !isSafeBasis([6n, 15n]));
  }

  // ── resolution gradient ──────────────────────────────────────────
  {
    let bad = null, n = 0n;
    for (let x = 0n; x < 18980n; x++) {
      const K = gradientRecover(mod(x, 260n), mod(x, 365n), 260n, 365n);
      if (K === null || K !== mod(x / 260n, 73n)) { bad = x.toString(); break; }
      n++;
    }
    t("resolution gradient: gcd(260,365) = 5 gives resolution 73, exhaustive over the lcm",
      bad === null && n === 18980n,
      bad === null ? "18,980/18,980 exact" : "failure at x=" + bad);
  }
  t("the Maya Calendar Round falls out of the gradient, not out of narrative",
    73n * 260n === 18980n && 52n * 365n === 18980n
    && 260n * 365n / gcd(260n, 365n) === 18980n
    && resolution(260n, 365n).resolution === "73",
    "73 · 260 = 52 · 365 = lcm(260,365) = 18,980");
  t("73 is the star number S₄ = 6·4·3 + 1, and Haab 365 = 5 · 73",
    6n * 4n * 3n + 1n === 73n && 365n === 5n * 73n);
  t("gradient degrades rather than fails: resolution A/d, not zero",
    resolution(36n, 48n).resolution === "4" && resolution(100n, 140n).resolution === "7"
    && resolution(M6, M6 + 1n).d === "1",
    "adjacency is the d = 1 extreme of the same law");

  // ── shadow lift ──────────────────────────────────────────────────
  {
    const lift = shadowLift(0n, mod(12345n * M8, 11n ** 6n), M8, 11n, 6n);
    t("shadow lift pins K modulo 11⁵ = 161,051",
      lift !== null && lift.modulus === 161051n && lift.K === mod(12345n, 161051n));
    t("the shadow corridor is M8 · 11⁵ ≈ 1.56 × 10¹²",
      lift.corridor === M8 * 161051n && lift.corridor === 1562144774190n);
    t("gcd(11⁶, M8) = 11 — the non-coprimality is intentional, not a bug",
      gcd(11n ** 6n, M8) === 11n);
    t("shadow anchor product 11⁶ · 13 · 17 · 19 = 7,438,784,639",
      11n ** 6n * 13n * 17n * 19n === 7438784639n);
    let bad = null, n = 0n;
    for (let K = 0n; K < 400000n; K += 991n) {
      for (const g0 of [0n, 1n, 4242n, M8 - 1n]) {
        const X = g0 + K * M8;
        const L = shadowLift(g0, mod(X, 11n ** 6n), M8, 11n, 6n);
        if (L === null || L.K !== mod(K, 161051n)) { bad = `K=${K}`; break; }
        n++;
      }
      if (bad) break;
    }
    t("shadow lift verified across the corridor",
      bad === null && n > 1500n,
      bad === null ? `${n} samples, K up to 400,000, zero mismatches` : "failure at " + bad);
  }

  // ── the state tuple is not (r, K) ────────────────────────────────
  t("the CRAM state carries eight fields, not two",
    STATE_FIELDS.length === 8
    && STATE_FIELDS.join() === "basis,r,K,sigma,topology,shadow,lineage,support",
    "A4: each lane may carry an independent operator — topology is first-class");
  {
    const s = encode(35113n, B8, { sigma: { prime: false }, topology: B8.map(() => "id") });
    t("encode / γ / value round-trip exactly", wellFormed(s) && value(s) === 35113n
      && gamma(s) === mod(35113n, M8) && s.K === 35113n / M8);
    const big = encode(9699690n * 7n + 12345n, B8);
    t("winding is carried, not discarded", big.K === 7n && value(big) === 9699690n * 7n + 12345n);
    t("a homogeneous topology is the special case, not the requirement",
      s.topology.length === 8 && encode(5n, B8, { topology: ["id", "phase", "id", "id", "id", "id", "id", "id"] }).topology[1] === "phase");
  }

  // ── the 5th operator: transduction χ ─────────────────────────────
  {
    const A = [2n, 3n, 5n, 7n], Bt = [2n, 3n, 5n, 11n, 13n];
    const sA = encode(257n, A);
    const sB = transduce(sA, Bt);
    t("pure basis transduction (Φ = id) preserves the integer exactly",
      value(sB) === 257n && sB.basis.length === 5 && wellFormed(sB),
      "A = {2,3,5,7} M=210 → B = {2,3,5,11,13} M=4290, value 257 unchanged");
    t("the tray and winding are re-expressed, not the value",
      sA.K === 1n && sB.K === 0n && value(sA) === value(sB),
      "K_A = 1 over M=210; K_B = 0 over M=4290");
  }
  {
    // Φ acts LANE-WISE: any polynomial with integer coefficients satisfies
    // Φ(x) mod b = Φ(x mod b) mod b, so an active transduction stays native.
    const A = [2n, 3n, 5n, 7n], Bt = [3n, 5n, 7n, 11n];
    const sB = transduce(encode(83n, A), Bt, { phiLane: (v) => 2n * v + 1n });
    t("active transduction (Φ ≠ id) applies lane-wise and stays residue-native",
      value(sB) === 167n && 2n * 83n + 1n === 167n,
      "Φ(x) mod b = Φ(x mod b) mod b for integer-coefficient Φ");
  }
  {
    // Φ⁻¹ is lane-wise only when its divisor is a UNIT IN EVERY LANE IT TOUCHES
    // — and the bridge touches the ANCHOR lane M+1 as well as the basis lanes.
    const A = [2n, 5n, 7n, 13n], Bt = [17n, 19n, 23n];   // M+1 = 911 and 7430, both coprime to 3
    const x = 29n;
    const sB = transduce(encode(x, A), Bt, { phiLane: (v) => 3n * v - 4n });
    const back = transduce(sB, A, { phiLane: (v, m) => mod((v + 4n) * inverse(3n, m), m) });
    t("reversible round trip: Φ then Φ⁻¹, both lane-wise",
      value(sB) === 83n && value(back) === x && wellFormed(back),
      "29 → 3·29−4 = 83 → (83+4)·3⁻¹ = 29");
    t("Φ⁻¹ is lane-wise only where its divisor is a unit — including on the ANCHOR lane",
      inverse(3n, 13n) !== null && inverse(3n, 3n) === null
      && inverse(3n, shellModulus(A) + 1n) !== null
      && inverse(3n, shellModulus([2n, 5n, 7n, 11n]) + 1n) === null,
      "M+1 = 771 = 3·257 would break a divide-by-3 even though no basis lane contains 3");
    t("dividing by a non-unit is the Fused-Piggyback case, not a lane map",
      inverse(2n, 8n) === null && inverse(3n, 9n) === null);
  }
  {
    // the certificate: what makes a transduction admissible
    const c = certifyTransduction([2n, 3n, 5n, 7n], [3n, 7n, 11n]);
    t("a transduction is certified by an UNBROKEN SAFE BASIS, not by the tower",
      c.admissible && c.source_unbroken && c.target_unbroken && c.idempotents_exist
      && c.certified_by === "unbroken safe basis");
    t("shared lanes are allowed and are exactly where the phase lock lives",
      c.shared_lanes.join() === "3,7" && !c.disjoint,
      "disjointness of the two bases is NOT required");
    t("a broken basis is refused outright",
      !certifyTransduction([4n, 6n], [5n]).admissible
      && !certifyTransduction([2n, 3n, 3n], [5n]).admissible,
      "non-coprime, and repeated lane");
  }
  {
    // residue-native: nothing proportional to the value is ever formed
    const A = [2n, 3n, 5n, 7n], MA = 210n;
    const huge = encode(123n + (10n ** 40n) * MA, A);
    t("the bridge refuses when the TARGET winding leaves its anchor corridor",
      (() => { try { transduce(huge, [11n, 13n, 17n]); return false; } catch (e) {
        return e.message.includes("wrapped the corridor"); } })(),
      "it names the corridor and the remedy rather than returning a wrong K");
    const lifted = transduce(huge, [11n, 13n, 17n], { omega: "lift" });
    t("omega:'lift' accepts an explicit, flagged boundary touch",
      value(lifted) === value(huge) && lifted.lineage[0].boundary_touch === true,
      "declared in the lineage, never silent");
  }
  {
    // ── P26. THE CORRIDOR IS GROWN BY EXTENDING THE ANCHOR SET (T-COMP-1) ──
    // P24 grew it by raising ONE anchor to a power and certified with a
    // leading-digit heuristic. Superseded. The theorem gives the exact bound:
    //   L = lcm(anchors), d = gcd(M_B, L), R = L/d,  exact while K < R.
    const A = [2n, 3n, 5n, 7n], Bt = [3n, 5n, 7n, 11n];   // M_B = 1155, base 1156
    const amp = (v) => 10000n * v;
    {
      t("one adjacent anchor gives R = 1156 — too narrow for Φ(1000) = 10,000,000",
        (() => { try { transduce(encode(1000n, A), Bt, { phiLane: amp }); return false; }
          catch (e) { return e.message.includes("wrapped the corridor"); } })(),
        "K_B = 8658 ≥ R = 1156, and a wider set proves it");
      const s = transduce(encode(1000n, A), Bt, { phiLane: amp, anchors: [1156n, 13n] });
      const L = s.lineage.at(-1).lift;
      t("ONE small added anchor multiplies R and carries it — linear cost",
        value(s) === 10000000n && s.K === 8658n && L.R === "15028"
        && L.mechanism === "anchor-set (T-COMP-1)",
        "13 × 1156 = 15,028; corridor 17,357,340 covers 10,000,000");
      t("the corridor grows multiplicatively in the anchor count",
        BigInt(transduce(encode(1000n, A), Bt,
          { phiLane: amp, anchors: [1156n, 13n, 19n] }).lineage.at(-1).lift.R) === 285532n,
        "adding 19 multiplies R again: 15,028 → 285,532");
      t("an anchor already dividing the lcm adds nothing, and is not pretended to",
        transduce(encode(1000n, A), Bt, { phiLane: amp, anchors: [1156n, 13n, 17n] })
          .lineage.at(-1).lift.R === "15028",
        "17 | 1156, so lcm does not move — R stays 15,028");
    }
    {
      // the inverse is unconditional — no coprimality precondition
      const s = transduce(encode(1000n, A), Bt, { phiLane: amp, anchors: [1156n, 13n] });
      t("(M_B/d) is invertible mod R UNCONDITIONALLY — gcd(M/d, L/d) = 1 always",
        s.lineage.at(-1).lift.unconditional_inverse === true,
        "per prime one exponent is exhausted by the min; d > 1 is the general case");
    }
    {
      // Φ = id must be untouched
      const s = transduce(encode(1000n, A), Bt);
      t("no phiLane — the derivation is unchanged and nothing is falsified",
        value(s) === 1000n && s.lineage.at(-1).lift.falsified === false
        && s.lineage.at(-1).phi_active === false);
    }
    {
      // phiBound survives as an OPTIONAL strengthening
      const s = transduce(encode(1000n, A), Bt,
        { phiLane: amp, anchors: [1156n, 13n], phiBound: (N) => 10000n * N });
      t("phiBound remains optional — supplied, it proves containment outright",
        s.lineage.at(-1).lift.bound_supplied === true && value(s) === 10000000n);
    }
    {
      const s = transduce(encode(1000n, A), Bt, { omega: "preserve", phiLane: amp });
      t("under preserve/project a Φ-moved winding is flagged as ASSERTED",
        s.lineage.at(-1).winding_asserted === true
        && s.lineage.at(-1).corridor_certified === null,
        "the caller owns the winding there; nothing claims to have proven it");
    }
    t("REGRESSION — depth 1 of the old power-lift is what P22 certified and got wrong",
      mod(10000000n - 1155n * 566n, 1155n) === 10n && 10n + 566n * 1155n === 653740n,
      "653,740 was the wrapped answer; both P24 and P26 refuse it");
  }
  {
    const A = [2n, 3n, 5n, 7n, 11n], Bt = [2n, 3n, 5n, 7n];
    const x = 5432n;
    const sA = encode(x, A);
    const proj = transduce(sA, Bt, { omega: "project" });
    t("projection discards the winding and is NOT reversible",
      sA.K === 2n && proj.K === 0n && value(proj) !== x && value(proj) === mod(x, 210n),
      `K_A = 2 dropped; ${value(proj)} now represents infinitely many integers`);
    t("the winding policy declares reversibility up front",
      isReversiblePolicy("recompute") && isReversiblePolicy("preserve")
      && !isReversiblePolicy("project"));
    t("lineage records the transduction rather than losing it",
      proj.lineage.length === 1 && proj.lineage[0].op === "chi"
      && proj.lineage[0].omega === "project");
  }

  // ── shells wired to the adjacent anchor ─────────────────────────
  t("project shells record the adjacent modulus, flagged external",
    SHELL_6.anchor === M6 + 1n && SHELL_8.anchor === M8 + 1n
    && SHELL_6.M === M6 && SHELL_8.M === M8
    && mod(M8, SHELL_6.anchor) !== 0n,
    "kept for reference; the admissible SafeS8 anchor is the internal 323");

  return R;
}
