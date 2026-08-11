// test/safe-basis.test.js — the Safe Basis used as an architecture. (P12)
//
// This suite exists because an earlier pass used the basis as a flat list of
// eight primes and derived a "shadow spine" from ring divisibility alone. It
// pins down the things that were missing: the role taxonomy, the Gaussian
// (mod-4) class that actually defines shadow, the prime families, ρ(n) with its
// bands, the saturation argument for the extenders, and the arrow.

import { B6, B8, GEAR, M6, M8, ARCSEC_CIRCLE } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import { RING, OFF_RING_PRIMES } from "../src/core/ring.js";
import {
  COLONY, SHELL, ROLES, role, gaussianClass, isShadowPrime, sumOfTwoSquares,
  SHADOW_SPINE, SPLIT_PRIMES, SHADOW_ANCHOR, SHADOW_ESCALATION,
  familyPartners, isSophieGermain, isSafePrime,
  basisGaps, basisProfile, saturationReport, isqrt, isPrime,
  S_R, RAMANUJAN_CONGRUENCE, hasRamanujanCongruence, partitionNumbers,
  T_FABRIC, T_MEASUREMENT, T_BOUNDARY, tierOf, providesStructure,
  fibonacci, FIBONACCI_ENTRY, bootGates, SD11_ANCHOR, SD11_REJECT,
} from "../src/core/safe-basis.js";
import { omega, largestShadowFactor, delta, rho, band, rhoReport } from "../src/core/rho.js";
import { crossClassify, divisionClosure, divisionShadow } from "../src/core/shadow-spine.js";
import {
  identity, reconstruct, stepForward, stepBackward, arrowCompare, tupleCompare,
  saturation, pairwiseCoprime, fibreProfile, shadowEntropyBits,
  carriedDomain, keyPhaseOnly, keyIdentity, tuple,
} from "../src/core/arrow.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── role taxonomy ────────────────────────────────────────────────
  t("Safe Basis S = {2,3,5,7,11,13,17,19}, |S| = 8",
    B8.length === 8 && B8.every((p, i) => p === [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n][i]));
  t("Colony C = ∏S = 9,699,690", COLONY === 9699690n && COLONY === M8, COLONY.toString());
  t("Shell M6 = ∏B6 = 30,030", SHELL === 30030n && SHELL === M6, SHELL.toString());
  t("every basis prime carries a declared role", ROLES.length === 8
    && B8.every((p) => typeof role(p).role === "string"));
  t("roles: 2 parity · 3 triadic · 5 surface · 7 bridge",
    role(2n).role === "parity witness" && role(3n).role === "triadic witness"
    && role(5n).role === "surface witness" && role(7n).role === "bridge witness");
  t("roles: 11 shadow anchor · 13 boundary witness",
    role(11n).role === "shadow anchor" && role(13n).role === "boundary witness");
  t("roles: 17 and 19 are saturation extenders, not classical basis members",
    role(17n).role === "saturation extender" && role(19n).role === "saturation extender"
    && role(17n).tier === "extender" && role(13n).tier === "classical-six");

  // ── shadow is a mod-4 property, not a ring property ──────────────
  t("shadow prime ⟺ inert in Z[i] ⟺ p ≡ 3 (mod 4)",
    isShadowPrime(3n) && isShadowPrime(7n) && isShadowPrime(11n) && isShadowPrime(19n)
    && !isShadowPrime(5n) && !isShadowPrime(13n) && !isShadowPrime(17n) && !isShadowPrime(2n));
  t("the shadow spine of the Safe Basis is {3, 7, 11, 19}",
    SHADOW_SPINE.length === 4 && SHADOW_SPINE.every((p, i) => p === [3n, 7n, 11n, 19n][i]),
    SHADOW_SPINE.map(String).join(" · "));
  t("11 is the Shadow Anchor, 19 the escalation",
    SHADOW_ANCHOR === 11n && SHADOW_ESCALATION === 19n);
  t("split primes {5,13,17} are sums of two squares — 13 = 2²+3², 17 = 1²+4²",
    SPLIT_PRIMES.every((p, i) => p === [5n, 13n, 17n][i])
    && sumOfTwoSquares(13n) !== null && sumOfTwoSquares(17n) !== null,
    "5 = 1²+2² · 13 = 2²+3² · 17 = 1²+4²");
  t("shadow primes have no two-square witness — that absence IS the shadow",
    SHADOW_SPINE.every((p) => sumOfTwoSquares(p) === null));
  t("2 ramifies, it is neither split nor shadow",
    gaussianClass(2n) === "ramified" && !isShadowPrime(2n));
  {
    // the correction, stated as an assertion
    const off = OFF_RING_PRIMES.map(String).join(",");
    const sh = SHADOW_SPINE.map(String).join(",");
    t("shadow spine ≠ off-ring set — the two axes are distinct",
      off !== sh && off === "7,11,13,17,19" && sh === "3,7,11,19",
      "off-ring " + off + "  ·  shadow " + sh);
  }

  // ── the 2×2 cross, every cell occupied ──────────────────────────
  {
    const c = crossClassify();
    t("cross: shadow ∧ closing = {3} — the trine sits on an absorbed shadow prime",
      c.shadow_closing.join() === "3");
    t("cross: shadow ∧ off-ring = {7, 11, 19} — irreducible shadow",
      c.shadow_off_ring.join() === "7,11,19");
    t("cross: non-shadow ∧ closing = {2, 5}", c.nonshadow_closing.join() === "2,5");
    t("cross: non-shadow ∧ off-ring = {13, 17} — boundary and saturation, not shadow",
      c.nonshadow_off_ring.join() === "13,17");
    t("all four cells occupied — neither axis determines the other",
      [c.shadow_closing, c.shadow_off_ring, c.nonshadow_closing, c.nonshadow_off_ring]
        .every((z) => z.length > 0));
  }

  // ── prime families ───────────────────────────────────────────────
  t("17 and 19 are a twin pair — the extenders are twins",
    familyPartners(17n, B8).some((f) => f.family === "twin" && f.partner === "19"));
  t("11 and 13 are twins; 3·5 and 5·7 are twins",
    familyPartners(11n, B8).some((f) => f.family === "twin" && f.partner === "13")
    && familyPartners(3n, B8).some((f) => f.family === "twin" && f.partner === "5")
    && familyPartners(5n, B8).some((f) => f.family === "twin" && f.partner === "7"));
  t("7 and 11 are cousins (gap 4); 7 and 13 are sexy (gap 6)",
    familyPartners(7n, B8).some((f) => f.family === "cousin" && f.partner === "11")
    && familyPartners(7n, B8).some((f) => f.family === "sexy" && f.partner === "13"));
  t("Sophie Germain in the basis: {2, 3, 5, 11}",
    B8.filter(isSophieGermain).map(String).join() === "2,3,5,11");
  t("safe primes in the basis: {5, 7, 11}",
    B8.filter(isSafePrime).map(String).join() === "5,7,11");
  {
    // CORRECTION: S_R means the partition-congruence primes, not OEIS A104272.
    const P = partitionNumbers(600n);
    const holds = (p, off) => {
      for (let k = 0n; p * k + off <= 600n; k++) if (mod(P.get(p * k + off), p) !== 0n) return false;
      return true;
    };
    t("S_R = {5,7,11} — the Ramanujan PARTITION congruences, verified on p(n)",
      RAMANUJAN_CONGRUENCE.every((c) => holds(c.prime, c.offset))
      && S_R.join() === "5,7,11",
      "p(5n+4)≡0 mod 5 · p(7n+5)≡0 mod 7 · p(11n+6)≡0 mod 11");
    let any13 = false;
    for (let off = 0n; off < 13n; off++) if (holds(13n, off)) any13 = true;
    t("REJECTED — 13 has no partition congruence at ANY offset",
      !any13 && !hasRamanujanCongruence(13n),
      "checked all 13 residue classes — this is why 13 is capacity, not structure");
    t("11 is both Shadow Anchor and a measurement-tier congruence prime",
      hasRamanujanCongruence(11n) && isShadowPrime(11n) && tierOf(11n) === "measurement");
  }
  {
    t("three tiers: fabric {2,3} · measurement {5,7,11} · boundary {13}",
      T_FABRIC.join() === "2,3" && T_MEASUREMENT.join() === "5,7,11" && T_BOUNDARY.join() === "13"
      && [...T_FABRIC, ...T_MEASUREMENT, ...T_BOUNDARY].join() === "2,3,5,7,11,13",
      "disjoint and exhaustive over S6");
    t("13 provides capacity, not structure — never equivalent to {5,7,11}",
      !providesStructure(13n) && T_MEASUREMENT.every(providesStructure)
      && tierOf(13n) === "boundary" && tierOf(17n) === "extender");
    const F = fibonacci(12n);
    t("Fibonacci entry: 2,3,5,13 direct; 7 and 11 only via COMPOSITE values",
      FIBONACCI_ENTRY.every((e) => F.get(e.index) === e.value)
      && F.get(8n) === 21n && 21n === 3n * 7n && F.get(10n) === 55n && 55n === 5n * 11n
      && FIBONACCI_ENTRY.filter((e) => !e.direct).map((e) => e.prime).join() === "7,11",
      "F(8)=21=3·7, F(10)=55=5·11");
  }
  {
    const g = bootGates(B8, [30031n, 9699691n, 37n, 73n]);
    t("boot gates B001–B004 pass on the Safe Basis — this is 'unbroken'",
      g.B001_colony.pass && g.B002_sd11_anchor.pass && g.B003_no_repeat.pass
      && g.B004_aux_coprime.pass && g.unbroken,
      "colony 9,699,690 · SD-11 anchor 7,438,784,639 · no repeat · aux coprime");
    t("B002 catches the known transcription error 7,437,683,639",
      SD11_ANCHOR === 7438784639n && SD11_ANCHOR !== SD11_REJECT
      && SD11_ANCHOR - SD11_REJECT === 1101000n);
    t("a repeated lane breaks the basis and the gates say so",
      !bootGates([2n, 3n, 3n, 5n]).B003_no_repeat.pass && !bootGates([2n, 3n, 3n, 5n]).unbroken);
  }
  t("basis gaps: 1, 2, 2, 4, 2, 4, 2",
    basisGaps().map(String).join() === "1,2,2,4,2,4,2");
  t("isqrt and isPrime are exact",
    isqrt(9699690n) === 3114n && isqrt(1296000n) === 1138n
    && isPrime(19n) && !isPrime(323n) && isPrime(30029n) === isPrime(30029n));

  // ── ρ(n), against the framework's own reference table ────────────
  t("ρ(Tzolk'in 260) — ω 3, q 0, ρ 3, Stable",
    omega(260n) === 3n && largestShadowFactor(260n) === 0n && rho(260n) === 3n
    && band(rho(260n)).id === "stable");
  t("ρ(Haab 365) — ω 2, q 0, ρ 2, Stable",
    omega(365n) === 2n && largestShadowFactor(365n) === 0n && rho(365n) === 2n);
  t("ρ(Shell 30,030) — ω 6, q 11, δ 1, ρ 7, Strong",
    omega(30030n) === 6n && largestShadowFactor(30030n) === 11n && delta(30030n) === 1n
    && rho(30030n) === 7n && band(rho(30030n)).id === "strong");
  t("ρ(Colony 9,699,690) — ω 8, q 19, δ 2, ρ 10, Chaotic",
    omega(COLONY) === 8n && largestShadowFactor(COLONY) === 19n && delta(COLONY) === 2n
    && rho(COLONY) === 10n && band(rho(COLONY)).id === "chaotic");
  t("δ has no gap: no prime strictly between 11 and 19 is ≡ 3 (mod 4)",
    ![13n, 17n].some(isShadowPrime));
  t("δ thresholds: q ≤ 7 → 0, q = 11 → 1, q ≥ 19 → 2",
    delta(21n) === 0n && delta(11n) === 1n && delta(19n) === 2n && delta(23n) === 2n,
    "21 = 3·7 → 0");
  t("bands partition ρ: Stable ≤4 · Mild 5–6 · Strong 7–8 · Chaotic ≥9",
    band(4n).id === "stable" && band(5n).id === "mild" && band(6n).id === "mild"
    && band(7n).id === "strong" && band(8n).id === "strong" && band(9n).id === "chaotic");
  {
    // the result that matters for this project
    const r = rhoReport(RING);
    t("ρ(ecliptic ring 1,296,000) = 3 — the ring itself is Stable",
      r.omega === "3" && r.q === "3" && r.delta === "0" && r.rho === "3" && r.band === "stable",
      "2⁷·3⁴·5³ · q = 3 (shadow but δ = 0)");
    t("the ring is Stable while its own basis shell is Strong and the Colony Chaotic",
      rho(RING) === 3n && rho(SHELL) === 7n && rho(COLONY) === 10n,
      "ρ: ring 3 · shell 7 · colony 10");
  }
  t("gear product 323 = 17·19 — ω 2, q 19, δ 2, ρ 4",
    rho(323n) === 4n && largestShadowFactor(323n) === 19n);

  // ── saturation: why the extenders exist ──────────────────────────
  {
    const s = saturationReport(ARCSEC_CIRCLE);
    t("the classical six UNDER-saturate the ecliptic ring (M6 < 1,296,000)",
      s.shell_saturates === false && SHELL < ARCSEC_CIRCLE,
      "30,030 < 1,296,000 — 44 laps");
    t("the Colony saturates it (M8 > 1,296,000)",
      s.colony_saturates === true && COLONY > ARCSEC_CIRCLE);
    t("winding deficit K_max = 43, so 44 laps are required",
      s.winding_bound === "43" && s.laps_required === "44");
    t("the twin extenders carry exactly that deficit: 323 > 43",
      s.anchor_suffices === true && s.gear_product === "323",
      "17·19 = 323 > 43 = K_max");
    t("saturation is the reason 17 and 19 are in the basis at all",
      GEAR.every((p) => role(p).role === "saturation extender"));
  }

  // ── the arrow ────────────────────────────────────────────────────
  {
    const x = 35113n;
    const id = identity(x);
    t("identity X = r + K·M is exact", reconstruct(id.r, id.K) === x
      && id.K === x / M6 && id.r === mod(x, M6), `r=${id.r} K=${id.K}`);
    t("identity is exact for negative X too (floor, not truncation)",
      reconstruct(identity(-1n).r, identity(-1n).K) === -1n
      && identity(-1n).K === -1n && identity(-1n).r === M6 - 1n);
    t("phase alone has no direction: X and X+M read identically on every lane",
      tuple(5n).every((v, i) => v === tuple(5n + M6)[i]) && identity(5n).K !== identity(5n + M6).K);
  }
  {
    // forward and backward over three laps, returning exactly to the origin
    let s = { r: 0n, K: 0n };
    let ok = true;
    const laps = 3n;
    for (let i = 0n; i < laps * M6; i++) s = stepForward(s, M6);
    if (s.r !== 0n || s.K !== laps) ok = false;
    for (let i = 0n; i < laps * M6; i++) s = stepBackward(s, M6);
    if (s.r !== 0n || s.K !== 0n) ok = false;
    t("one signed rule carries the arrow both ways over three laps",
      ok, "forward to K=3, backward to K=0, phase exact");
  }
  t("the arrow is the pair (K, r) — K orders laps, r orders within a lap",
    arrowCompare({ r: 5n, K: 0n }, { r: 1n, K: 1n }) === -1
    && arrowCompare({ r: 1n, K: 1n }, { r: 5n, K: 1n }) === -1
    && arrowCompare({ r: 5n, K: 1n }, { r: 5n, K: 1n }) === 0);
  t("the tuple is a faithful label, NOT an order",
    tupleCompare(2n, 1n) === -1 && arrowCompare(identity(2n), identity(1n)) === 1,
    "x=2 → (0,2,2,2,2,2) sorts below x=1 → (1,1,1,1,1,1)");

  // ── saturation of the clock, and its failure ────────────────────
  {
    const good = saturation([2n, 3n, 5n, 7n]);
    t("a pairwise-coprime basis is a faithful clock — zero collisions",
      good.faithful && good.collisions === "0" && good.pairwise_coprime,
      `{2,3,5,7} → ${good.distinct_readings}/${good.range}`);
    const bad = saturation([4n, 6n, 10n]);
    t("the pseudo-basis {4,6,10} collides — 180 collisions over its product",
      !bad.faithful && bad.collisions === "180" && bad.lcm === "60" && !bad.pairwise_coprime,
      `lcm 60, product 240, distinct ${bad.distinct_readings}`);
    t("pairwiseCoprime agrees with the collision measurement",
      pairwiseCoprime(B6) && !pairwiseCoprime([4n, 6n, 10n]));
  }

  // ── shadow entropy ───────────────────────────────────────────────
  {
    const dom = carriedDomain(4n, 30n);      // 4 laps of a small modulus
    const clean = fibreProfile(dom, keyIdentity);
    const fused = fibreProfile(dom, keyPhaseOnly);
    t("carrying K keeps the step a bijection — H_shadow = 0, reversible",
      clean.bijection && clean.fibre_max === 1 && clean.h_shadow_zero,
      `${clean.fibres} fibres, max size 1`);
    t("discarding K collapses L laps onto one phase — fibre size exactly L",
      !fused.bijection && fused.fibre_max === 4 && fused.fibres === 30,
      "L = 4 laps → fibre size 4");
    t("H_shadow = log₂ L reported exactly, only when L is a power of two",
      shadowEntropyBits(4) === "2" && shadowEntropyBits(1) === "0"
      && shadowEntropyBits(3) === null,
      "no logarithm is ever evaluated");
    t("irreversibility ⟺ H_shadow > 0 ⟺ a synthetic was introduced",
      clean.h_shadow_zero && !fused.h_shadow_zero);
  }

  // ── profile integrity ────────────────────────────────────────────
  {
    const prof = basisProfile();
    t("basis profile is complete and JSON-safe",
      prof.kind === "SAFE_BASIS_PROFILE_V1" && prof.primes.length === 8
      && prof.primes.every((p) => typeof p.prime === "string" && typeof p.role === "string"
        && typeof p.gaussian_class === "string" && typeof p.divides_ring === "boolean"));
    t("every prime's ring_defect agrees with R mod p",
      prof.primes.every((p) => p.ring_defect === mod(RING, BigInt(p.prime)).toString()));
    t("divides_ring is true exactly for {2,3,5}",
      prof.primes.filter((p) => p.divides_ring).map((p) => p.prime).join() === "2,3,5");
  }
  {
    // the two division classifiers must stay separable
    const c = divisionClosure(260n), s = divisionShadow(260n);
    t("division classifiers are separate objects on separate axes",
      c.axis === "closure" && s.axis === "shadow"
      && c.off_ring_lanes.join() === "B13" && s.q === "0" && s.rho === "3",
      "Tzolk'in: off-ring via 13, but q = 0 — off-ring is not shadow");
    const c2 = divisionClosure(132n), s2 = divisionShadow(132n);
    t("D-11 rudrāṁśa is off-ring via 11 AND shadow-anchored — both axes fire",
      c2.off_ring_lanes.join() === "SH11" && s2.q === "11" && s2.delta === "1"
      && s2.rho === "4" && s2.anchored === true);
    const c3 = divisionClosure(36n), s3 = divisionShadow(36n);
    t("the decan closes yet carries shadow prime 3 — closure without escalation",
      c3.closes === true && s3.q === "3" && s3.delta === "0" && s3.rho === "2");
  }

  return R;
}
