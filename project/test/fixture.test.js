// test/fixture.test.js — star lift, winding tower, phase-locked fixture. (P15)
//
// Three claims are checked here, all of them from the architecture rather than
// from this project's earlier reading of it:
//
//   · the star numbers are an adjacency family, and they are where every anchor
//     this project already uses came from;
//   · the 36/37 star lift iterated to zero is the winding tower, giving
//     arbitrary DEPTH, with the exact point named at which it must hand over to
//     transduction for PRECISION;
//   · the recommissioned unit lane is the frame-independent origin, and the
//     phase lock proper rides on the shared shadow lane.

import { B8, M8 } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import { shellModulus, encode, value, transduce } from "../src/core/cram.js";
import {
  starNumber, starPair, starFamily,
  towerLevel, windingTower, towerRebuild, towerReport, levelsAreIndependent, garnerDigits,
  UNIT_LANE, UNIT_LANE_INDEX, fixture, laneOf, unitLaneIsIdentity,
  laneStates, laneIsInformative, phaseLock, preservesPhase, lockedShift,
} from "../src/core/fixture.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── the star family is an adjacency family ──────────────────────
  t("S_n = 6n(n−1) + 1, and every star number is adjacent to its own shell",
    starFamily(12n).every((s) => BigInt(s.anchor) === BigInt(s.shell) + 1n),
    "adjacency for free across the whole family");
  t("S₁ = 1 — the recommissioned unit is the first star number",
    starNumber(1n) === 1n && UNIT_LANE === 1n);
  t("S₂ = 13 — the boundary witness", starNumber(2n) === 13n);
  t("S₃ = 37 — the 36/37 star lift", starNumber(3n) === 37n && starPair(3n).shell === "36");
  t("S₄ = 73 — the Maya resolution modulus, already used by the gradient",
    starNumber(4n) === 73n && 365n / 5n === 73n && 73n * 260n === 18980n);
  t("S₅ = 121 = 11² — the shadow prime squared, at n = 5, the shadow lane",
    starNumber(5n) === 121n && 11n * 11n === 121n);
  t("S₆ = 181 with shell 180 — the N-refinement folding period",
    starNumber(6n) === 181n && starPair(6n).shell === "180");
  t("the anchors this project already used all live in the star family",
    [1n, 13n, 37n, 73n, 121n, 181n].every((a) => {
      for (let n = 1n; n <= 8n; n++) if (starNumber(n) === a) return true;
      return false;
    }),
    "1 · 13 · 37 · 73 · 121 · 181 — S₁ through S₆");

  // ── the winding tower: arbitrary depth ──────────────────────────
  {
    const rep = towerReport(1331n, 36n);
    t("36/37 tower on 1331 terminates at zero, depth 3, fully certified",
      rep.depth === "3" && rep.terminates_at_zero && rep.identity_holds_every_level
      && rep.rebuild_exact_at_boundary && rep.certified_levels === "3" && rep.handover_depth === null,
      "1331 = 36² + 36·0 + ... rebuilt exactly");
  }
  {
    const rep = towerReport(2n ** 32n - 1n, 36n);
    t("tower on 2³²−1: depth 7, identity holds at every level, rebuild exact",
      rep.depth === "7" && rep.identity_holds_every_level && rep.rebuild_exact_at_boundary);
    t("only the top levels are corridor-certified — the handover is named",
      rep.certified_levels === "2" && rep.handover_depth === "0",
      "2/7 certified by the single adjacent anchor; the rest need a wider fixture");
  }
  {
    const rep = towerReport(2n ** 128n - 1n, 36n);
    t("tower on 2¹²⁸−1: depth 25, terminates, every level exact",
      rep.depth === "25" && rep.terminates_at_zero
      && rep.identity_holds_every_level && rep.rebuild_exact_at_boundary,
      "arbitrary depth — the tower does not care how large X is");
    t("depth is what the tower buys; precision is what transduction buys",
      rep.certified_levels === "2" && rep.handover_depth === "0"
      && BigInt(rep.anchor_needed_for_level_0) > 37n,
      `level 0 alone would need an anchor above ${rep.anchor_needed_for_level_0.slice(0, 12)}…`);
  }
  t("the tower terminates for every value tried, small and large",
    [0n, 1n, 35n, 36n, 37n, 1295n, 1296n, 999983n].every((x) =>
      towerRebuild(windingTower(x, 36n), 36n) === x),
    "termination is guaranteed: each level divides magnitude by M ≥ 2");
  t("a single level reads only its own (r, s) pair",
    towerLevel(1234567n, 36n).identity_holds
    && towerLevel(1234567n, 36n).digit === mod(1234567n, 36n));

  // ── tower is not a radix ────────────────────────────────────────
  t("levels are independent — each recomputes standalone from its own value",
    [47n, 1332n, 2n ** 64n - 1n].every((x) => levelsAreIndependent(x, 36n)),
    "no accumulator threads across levels");
  {
    const g = garnerDigits(123456789n, [2n, 3n, 5n, 7n, 11n, 13n]);
    t("Garner, by contrast, threads an accumulator through every digit",
      g.accumulator_threaded && g.digits.length === 6,
      "digit i depends on digits 0..i−1 — the positional emission A2 prohibits");
  }
  t("the tower has no such dependency, which is why it is a tower and not a radix",
    levelsAreIndependent(123456789n, 36n));

  // ── the recommissioned unit lane ────────────────────────────────
  t("lane 1 is coprime to every modulus, so it is admissible in EVERY fixture",
    B8.every((p) => mod(p, UNIT_LANE) === 0n) && unitLaneIsIdentity(B8),
    "gcd(1, n) = 1 always — it can never collide with an extension");
  t("adjoining the unit lane leaves M unchanged — the identity transduction",
    shellModulus([UNIT_LANE, ...B8]) === M8 && shellModulus(B8) === M8);
  t("Z/1 has exactly one element, so every value reads 0 there",
    [0n, 1n, 42n, 2n ** 64n].every((x) => mod(x, UNIT_LANE) === 0n));
  t("the unit lane carries zero bits — it is the origin, not the phase",
    laneStates(UNIT_LANE) === 1n && !laneIsInformative(UNIT_LANE)
    && laneIsInformative(11n) && laneStates(11n) === 11n,
    "one state vs eleven: lane 1 cannot relate two windings by itself");

  // ── lane indexing keeps 11 on lane 5 ───────────────────────────
  {
    const fx = fixture(B8);
    t("the unit is lane 0, so the shadow prime 11 stays on lane 5",
      laneOf(fx, UNIT_LANE) === UNIT_LANE_INDEX && laneOf(fx, 11n) === 5n,
      "2:1 3:2 5:3 7:4 11:5 13:6 17:7 19:8");
    t("prepending the unit as an ordinary lane would have shifted 11 to 6",
      [UNIT_LANE, ...B8].indexOf(11n) + 1 === 6,
      "which is why the unit is indexed at 0, outside the informative run");
    t("the fixture carries its own adjacent anchor",
      fx.M === M8 && fx.anchor === M8 + 1n && fx.lanes.length === 9);
  }

  // ── phase lock ──────────────────────────────────────────────────
  {
    const A = fixture([2n, 3n, 5n, 7n, 11n, 13n]);
    const Bx = fixture([11n, 17n, 19n, 23n]);
    const lock = phaseLock(A, Bx);
    t("two fixtures phase-lock on their shared lanes; the origin is always shared",
      lock.locked && lock.origin_shared && lock.origin_states === "1"
      && lock.carriers.join() === "11" && lock.strength === "11",
      "origin from lane 1 (0 bits), phase from lane 11 (11 states)");
    t("the lock names which lane carries it",
      lock.carrier_lanes.join() === "5", "lane 5 — the shadow anchor");
  }
  {
    const C = fixture([2n, 3n, 5n]), D = fixture([7n, 13n]);
    const lock = phaseLock(C, D);
    t("fixtures with no shared informative lane share only the origin",
      !lock.locked && lock.carriers.length === 0 && lock.origin_shared,
      "a common zero, but no phase — the lock needs an informative carrier");
  }

  // ── the lock is a constraint on Φ, not a label ──────────────────
  t("Φ preserves the phase lock on lane ℓ exactly when Φ(x) ≡ x (mod ℓ)",
    preservesPhase((x) => x, 11n)
    && preservesPhase(lockedShift(11n, 4n), 11n)
    && preservesPhase((x) => x + 121n, 11n)
    && !preservesPhase((x) => 2n * x + 1n, 11n)
    && !preservesPhase((x) => 3n * x - 4n, 11n),
    "x ↦ 2x+1 breaks the lock; x ↦ x + 11k holds it");
  t("every Φ trivially preserves the unit lane — zero bits constrain nothing",
    [(x) => 2n * x + 1n, (x) => 3n * x - 4n, (x) => x].every((f) => preservesPhase(f, UNIT_LANE)));
  {
    // an active transduction that holds the lock, and one that breaks it
    const A = [2n, 3n, 5n, 7n, 11n], Bt = [3n, 7n, 11n, 13n];
    const held = transduce(encode(83n, A), Bt,
      { phiLane: lockedShift(11n, 2n), phiBound: (N) => N + 22n });
    const broken = transduce(encode(83n, A), Bt,
      { phiLane: (v) => 2n * v + 1n, phiBound: (N) => 2n * N + 1n });
    t("a locked transduction lands on the same lane-11 phase; an unlocked one does not",
      mod(value(held), 11n) === mod(83n, 11n) && mod(value(broken), 11n) !== mod(83n, 11n),
      `83 → ${value(held)} holds phase ${mod(83n, 11n)}; 83 → ${value(broken)} does not`);
  }

  // ── depth × precision, composed ─────────────────────────────────
  {
    const X = 2n ** 200n - 1n;
    const rep = towerReport(X, 36n);
    const wide = encode(X, B8);
    t("tower gives depth, fixture gives width, and they compose on one value",
      rep.depth === "39" && rep.rebuild_exact_at_boundary && value(wide) === X && wide.K > 0n,
      `39 tower levels over 36/37; the same X sits in one B8 fixture with K = ${wide.K.toString().slice(0, 10)}…`);
  }

  return R;
}
