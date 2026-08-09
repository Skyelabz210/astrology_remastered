// test/anchor.test.js — the anchor must be internal, or i.i.d. is gone. (P17)
//
// This suite REVERSES P14. That pass called the adjacent anchor A = M+1
// "canonical" and dismissed the gear pair 17·19 = 323 as an RNS move because it
// was drawn from inside the basis. Inside the basis is the point. The tray
// cannot even evaluate an external anchor, so the question is not cost — it is
// admissibility.

import { B6, B8, M6, M8, GEAR, GEAR_PRODUCT, M6_INV_MOD_GEAR, ARCSEC_CIRCLE } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import {
  gcd, shellModulus, generalRecover,
  yieldAdjacent, yieldGeneral, identityEquals, identityCompare,
  projectToInteger, yieldCost,
} from "../src/core/cram.js";
import { starNumber } from "../src/core/fixture.js";
import {
  trayDeterminesAnchor, undeterminedWitness, anchorLanes, isInternalAnchor,
  laneDependency, anchorReport, primePowerLanes, starLiftBasis,
  internalAdjacencyRecover,
  PARKED_LANE, SHELL_LANES_PARKED, SHELL_PARKED, shadowAnchor,
  parkingReport, parkedRecover, parkedRecoverFrom,
} from "../src/core/anchor.js";
import { SHELL_ANCHOR, LEGACY_ANCHOR, LEGACY_SHELL } from "../src/core/shell-kelim.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── the decisive fact ────────────────────────────────────────────
  t("the tray determines x mod A if and only if A divides M",
    trayDeterminesAnchor(B8, GEAR_PRODUCT) && mod(M8, GEAR_PRODUCT) === 0n
    && !trayDeterminesAnchor(B8, 30031n) && mod(M8, 30031n) !== 0n,
    "323 | 9,699,690 ✓ · 30,031 ∤ 9,699,690");
  {
    const w = undeterminedWitness(B8, 30031n);
    t("REJECTED — the adjacent anchor is not a function of the tray at all",
      w !== null && w.tray_identical && w.anchor_x !== w.anchor_y && w.differ_by === "29708",
      `x and x+M₈ share every lane yet read ${w.anchor_x} vs ${w.anchor_y} mod 30,031`);
    t("an internal anchor has no such witness",
      undeterminedWitness(B8, GEAR_PRODUCT) === null);
  }
  t("30,031 = 59 · 509, and neither 59 nor 509 is a lane of SafeS8",
    59n * 509n === 30031n && !isInternalAnchor(B8, 30031n)
    && anchorLanes(B8, 30031n) === null
    && gcd(30031n, M8) === 1n,
    "coprime to the whole basis — so it cannot be a sub-product of it");
  t("adjoining 59 and 509 would violate A3 — the basis is fixed at instantiation",
    !B8.some((p) => p === 59n) && !B8.some((p) => p === 509n),
    "the anchor has to come from the basis you already have");

  // ── i.i.d.: which lanes must be read ────────────────────────────
  {
    const inner = laneDependency(B8, GEAR_PRODUCT);
    const outer = laneDependency(B8, 30031n);
    t("the internal anchor reads exactly its own two lanes",
      inner.map(String).join() === "17,19", "disjoint from the six shell lanes");
    t("the external anchor couples every lane — and is still undetermined",
      outer.length === 8 && outer.map(String).join() === "2,3,5,7,11,13,17,19",
      "no lane can be produced independently of the others");
    t("i.i.d. survives an internal anchor and not an external one",
      anchorReport(B8, B6, GEAR).iid_preserved
      && inner.every((p) => !B6.some((q) => q === p)));
  }

  // ── the canonical SafeS8 configuration, restored ────────────────
  {
    const rep = anchorReport(B8, B6, GEAR);
    t("SafeS8 canonical split: shell 30,030 · anchor 323, internal and disjoint",
      rep.admissible && rep.internal && rep.disjoint && rep.tray_determines_anchor
      && rep.shell === "30030" && rep.anchor === "323",
      rep.recovery);
    t("it is NOT adjacent, so the precomputed inverse is the correct price",
      !rep.adjacent && M6_INV_MOD_GEAR === 287n,
      "internality costs one multiply; it is not optional");
    t("the gear split remains admissible and is retained as LEGACY",
      SHELL_ANCHOR !== LEGACY_ANCHOR && LEGACY_ANCHOR === GEAR_PRODUCT
      && LEGACY_SHELL === M6,
      "exact, still certified, no longer the register's split");
    t("shell-kelim's CANONICAL anchor is now the parked lane 11",
      SHELL_ANCHOR === PARKED_LANE && SHELL_ANCHOR === 11n,
      "P21 re-base: the register runs on the parked shell");
  }
  {
    // the canonical path still certifies the whole ring
    let bad = null;
    for (let x = 0n; x < ARCSEC_CIRCLE; x += 11n) {
      if (generalRecover(mod(x, M6), mod(x, GEAR_PRODUCT), M6, GEAR_PRODUCT) !== x / M6) {
        bad = x.toString(); break;
      }
    }
    t("internal-anchor K-Elim exact across the ecliptic ring",
      bad === null, bad === null ? "117,819 strided points, zero mismatches" : "failure at " + bad);
  }

  // ── adjacency is not lost — it is designed in ───────────────────
  {
    const cases = [2n, 3n, 4n, 6n];
    const built = cases.map((n) => starLiftBasis(n));
    t("star-lift bases realise the star pair INTERNALLY",
      built.every((b) => b.report.admissible && b.report.adjacent && b.report.internal),
      built.map((b) => `S${b.n}:{${b.basis.map(String).join(",")}}`).join(" "));
    t("S₃ gives {4, 9, 37} — shell 36, anchor 37, both sub-products of one basis",
      built[1].basis.map(String).join() === "4,9,37"
      && built[1].shell === 36n && built[1].anchor === 37n,
      "the 36/37 star lift, with the anchor inside residue space");
    let bad = 0n, total = 0n;
    for (const b of built) {
      for (let v = 0n; v < b.shell * b.anchor; v++) {
        const K = internalAdjacencyRecover(b.basis, b.shell_lanes, b.anchor_lanes,
          mod(v, b.shell), mod(v, b.anchor));
        if (K !== v / b.shell) bad++;
        total++;
      }
    }
    t("internal adjacency K ≡ r − s exact over every star-lift basis, exhaustively",
      bad === 0n && total > 39000n,
      `${total} states across 4 bases, zero mismatches — one subtraction, tray-determined`);
    t("these anchors ARE tray-determined, unlike 30,031",
      built.every((b) => trayDeterminesAnchor(b.basis, b.anchor)));
  }
  t("the star anchor is the star number and the shell is 6n(n−1)",
    [2n, 3n, 4n, 6n].every((n) => {
      const b = starLiftBasis(n);
      return b.anchor === starNumber(n) && b.shell === 6n * n * (n - 1n);
    }));
  t("prime-power lanes are the coarsest pairwise-coprime split",
    primePowerLanes(180n).map(String).join() === "4,9,5"
    && primePowerLanes(120n).map(String).join() === "8,3,5"
    && primePowerLanes(37n).map(String).join() === "37");

  // ── refusal ──────────────────────────────────────────────────────
  t("an inadmissible anchor is refused, not silently used",
    (() => { try { internalAdjacencyRecover(B8, B6, [59n, 509n], 0n, 0n); return false; }
      catch { return true; } })(),
    "59 and 509 are not lanes of the fixed basis");
  t("a non-adjacent internal anchor is refused by the adjacency path",
    (() => { try { internalAdjacencyRecover(B8, B6, GEAR, 0n, 0n); return false; }
      catch (e) { return e.message.includes("not adjacent"); } })(),
    "323 ≠ 30,031 — use the general form there");
  {
    // overlapping shell and anchor lanes destroy disjointness
    const rep = anchorReport(B8, [2n, 3n, 5n, 7n, 11n, 13n, 17n], [17n, 19n]);
    t("overlapping shell and anchor lanes are refused",
      !rep.disjoint && !rep.admissible,
      "lane 17 cannot be in both halves");
  }

  // ── the parked lane: 11 is the anchor, so it is NOT in the shell ──
  t("a lane cannot be both anchor and shell — 11 is parked, empty of value",
    PARKED_LANE === 11n
    && SHELL_LANES_PARKED.map(String).join() === "2,3,5,7,13,17,19"
    && !SHELL_LANES_PARKED.some((p) => p === 11n),
    "in the basis, so the tray reaches it; out of the shell, so it can anchor");
  t("parked shell M = 2·3·5·7·13·17·19 = 881,790 = M₈ / 11",
    SHELL_PARKED === 881790n && SHELL_PARKED === M8 / 11n
    && shellModulus(SHELL_LANES_PARKED) === SHELL_PARKED);
  {
    // the core is now built on this split — check it end to end
    const rep = anchorReport(B8, SHELL_LANES_PARKED, [11n]);
    t("the RE-BASED core split is admissible: internal, disjoint, tray-determined",
      rep.admissible && rep.internal && rep.disjoint && rep.tray_determines_anchor
      && rep.iid_preserved && rep.shell === "881790" && rep.anchor === "11",
      "shell 881,790 · anchor lane 11 · " + rep.recovery);
    t("the parked anchor reads exactly one lane, and it is not a shell lane",
      laneDependency(B8, 11n).map(String).join() === "11"
      && !SHELL_LANES_PARKED.some((p) => p === 11n),
      "i.i.d. intact — every shell lane is still x mod p and nothing else");
  }
  {
    const rep = parkingReport(B8, [11n], 1n);
    t("shell and parked lane are disjoint and coprime",
      rep.disjoint && rep.coprime && rep.admissible
      && rep.shell === "881790" && rep.anchor === "11");
    t("corridor with the bare parked lane is the full Colony",
      rep.corridor === "9699690", "881,790 · 11 = 9,699,690");
  }
  {
    // over the ecliptic ring the parked lane alone suffices
    let bad = null, maxK = 0n;
    for (let x = 0n; x < ARCSEC_CIRCLE; x++) {
      const K = parkedRecoverFrom(x, SHELL_PARKED, 11n);
      const want = x / SHELL_PARKED;
      if (K !== want) { bad = x.toString(); break; }
      if (want > maxK) maxK = want;
    }
    t("ecliptic ring with 11 parked: K_max = 1, a single lane-11 anchor covers it",
      bad === null && maxK === 1n,
      bad === null ? "1,296,000/1,296,000 exact, K ∈ {0,1}" : "failure at " + bad);
    t("loading 11 into the shell is what forced K ≤ 43 and the gear pair",
      (ARCSEC_CIRCLE - 1n) / M6 === 43n && (ARCSEC_CIRCLE - 1n) / SHELL_PARKED === 1n,
      "M6 = 30,030 → 44 laps; M = 881,790 → 2 laps");
  }
  {
    // the shadow lift, without the workaround
    const P6 = shadowAnchor(6n);
    t("with 11 parked, gcd(11⁶, shell) = 1 — the shadow lift is plain K-Elim",
      P6 === 1771561n && gcd(P6, SHELL_PARKED) === 1n,
      "no divide-by-11, no Hensel step");
    t("SUPERSEDED — 'gcd(11⁶, M₆) = 11, non-coprimality is intentional'",
      gcd(P6, M6) === 11n && gcd(P6, SHELL_PARKED) === 1n,
      "the non-coprimality was self-inflicted by loading 11 into the shell");
    let bad = null, n = 0n;
    for (let K = 0n; K < P6; K += 977n) {
      for (const g0 of [0n, 1n, 42n, SHELL_PARKED - 1n]) {
        const x = g0 + K * SHELL_PARKED;
        if (parkedRecover(mod(x, SHELL_PARKED), mod(x, P6), SHELL_PARKED, P6) !== mod(K, P6)) {
          bad = `K=${K}`; break;
        }
        n++;
      }
      if (bad) break;
    }
    t("clean shadow K-Elim at 11⁶ verified across the corridor",
      bad === null && n > 7000n,
      bad === null ? `${n} samples, zero mismatches` : "failure at " + bad);
    t("same corridor as the old workaround, obtained without it",
      SHELL_PARKED * P6 === 1562144774190n && SHELL_PARKED * P6 === M8 * (11n ** 5n),
      "881,790 · 11⁶ = 9,699,690 · 11⁵");
    const rep = parkingReport(B8, [11n], 6n);
    t("widening the parked lane to 11⁶ is a lane widening, not a basis extension",
      rep.lane_widened && rep.coprime && rep.admissible
      && !trayDeterminesAnchor(B8, P6),
      "11⁶ ∤ M₈, so the lane must be carried at that power — Sh = {11⁶,13,17,19}");
  }
  t("parkedRecover refuses when the parked prime is still in the shell",
    (() => { try { parkedRecover(0n, 0n, M6, 11n); return false; } catch { return true; } })(),
    "11 | 30,030, so no inverse exists — the lane was never parked");

  // ── the O(1) yield: K-Elim, uncoupled ───────────────────────────
  {
    // the pair is faithful WITHOUT the composite ever being formed
    const seen = new Set();
    let bad = 0n;
    for (let X = 0n; X < 36n * 37n; X++) {
      const id = yieldAdjacent(mod(X, 36n), mod(X, 37n), 36n);
      const key = id.r.toString() + ":" + id.K.toString();
      if (seen.has(key)) bad++;
      seen.add(key);
      if (id.K !== X / 36n) bad++;
    }
    t("the yield is the PAIR (r, K) — one modular subtraction, nothing coupled",
      bad === 0n && seen.size === 1332,
      "1,332 states, 1,332 distinct pairs, no composite formed");
  }
  {
    let bad = 0n, n = 0n;
    for (let X = 0n; X < M8; X += 239n) {
      const id = yieldGeneral(mod(X, M6), mod(X, GEAR_PRODUCT), M6, GEAR_PRODUCT);
      if (id === null || id.K !== X / M6 || id.r !== mod(X, M6)) bad++;
      n++;
    }
    t("general yield on the internal shell/anchor pair, also uncoupled",
      bad === 0n, `${n} states — K-Elimination and stop`);
  }
  {
    // equality and order work on the pair directly
    const id = (X) => yieldAdjacent(mod(X, 36n), mod(X, 37n), 36n);
    let ordBad = 0n, eqBad = 0n;
    for (let a = 0n; a < 36n * 37n; a += 7n) {
      for (let b = 0n; b < 36n * 37n; b += 11n) {
        const truth = a < b ? -1 : (a > b ? 1 : 0);
        if (identityCompare(id(a), id(b)) !== truth) ordBad++;
        if (identityEquals(id(a), id(b)) !== (a === b)) eqBad++;
      }
    }
    t("order and equality read straight off (K, r) — no composite needed",
      ordBad === 0n && eqBad === 0n,
      "lexicographic (K, r) reproduces integer order exactly");
  }
  {
    const a = yieldCost("adjacent"), g = yieldCost("general"),
      pr = yieldCost("projection"), gar = yieldCost("garner", 8n);
    t("the yield does not couple; the projection does",
      !a.couples && !g.couples && pr.couples && gar.couples,
      "adjacent 2 ops · general 3 ops · projection +2 ops · Garner 48 ops");
    t("CORRECTED — 'K-Elim plus one multiply-add' folded a radix step into the yield",
      a.total_ops === 2n && a.multiply === 0n && a.add === 0n
      && pr.multiply === 1n && pr.add === 1n,
      "r + K·M is base-M positional composition, not part of producing the number");
    t("neither yield depends on the lane count; Garner does",
      !a.depends_on_lane_count && !g.depends_on_lane_count
      && gar.depends_on_lane_count && gar.total_ops === 48n);
  }
  {
    // the projection is still exact — it is just a boundary, and named as one
    let bad = 0n;
    for (let X = 0n; X < 36n * 37n; X++) {
      if (projectToInteger(yieldAdjacent(mod(X, 36n), mod(X, 37n), 36n)) !== X) bad++;
    }
    t("projectToInteger is exact, and is declared a boundary radix step",
      bad === 0n && yieldCost("projection").couples,
      "available, exact, and kept out of the path");
  }
  {
    // the P17 overclaim, corrected
    const X = 123456n;
    const id = yieldAdjacent(mod(X, M8), mod(X, M8 + 1n), M8);
    t("AMENDED — an external modulus IS reachable, at the cost of the boundary",
      projectToInteger(id) === X && mod(projectToInteger(id), 30031n) === mod(X, 30031n),
      "'cannot be evaluated at all' was an overclaim and is withdrawn");
    t("what stands is i.i.d. — reaching it couples every lane",
      laneDependency(B8, 30031n).length === 8
      && laneDependency(B8, GEAR_PRODUCT).length === 2,
      "the internal anchor reads two lanes and couples nothing");
    t("A3 is withdrawn as a premise — no claim here depends on an immutable basis",
      anchorReport(B8, B6, GEAR).admissible
      && anchorReport(B8, SHELL_LANES_PARKED, [11n]).admissible,
      "both splits stand on internality and disjointness alone");
  }

  return R;
}
