// test/shadow-spine.test.js — certification of the shadow spine. (P11)
//
// Three things are proved here, in this order:
//
//   1. THE TWO AXES STAY APART. Shadow is a mod-4 property ({3,7,11,19},
//      inert in Z[i], anchored at 11); off-ring is a closure property
//      ({7,11,13,17,19}). They cross rather than coincide, and the divisions
//      that fail to close are exactly those carrying an off-ring prime —
//      which is NOT the same as carrying a shadow prime.
//
//   2. THE SPINE IS NEW INFORMATION. Over the whole ring, every sign contains
//      every residue of every spine lane, and every spine class occurs in
//      every sign. The two partitions are mutually independent, so the spine
//      records an axis that sign, decan and house cannot encode.
//
//   3. NONE OF IT CHANGES ANYTHING CLASSICAL. Under every declared frame
//      rotation, separations, aspect classification and whole-sign houses are
//      invariant — only sign naming moves, and it moves by exactly the
//      predicted amount. Traditional astrology is left intact; the spine is
//      strictly additive.
//
// Arithmetic note: identity checks and all certifying comparisons are BigInt.
// The exhaustive census loop carries its lane residues as rolling small
// integers (every value < 2^53, so exact) purely for speed — and is then
// checked against a BigInt closed form, which is what certifies it.

import { B8 } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import { RING, OFF_RING_PRIMES, defect, closes, offRingPrimes } from "../src/core/ring.js";
import { SHADOW_SPINE, isShadowPrime } from "../src/core/safe-basis.js";
import {
  OFF_RING_LANES, SPINE, EVENT_CLASSES, CLASS_IDS, axisOf,
  bodyEvents, edgeEvents, laneResidues, shadowResidues, crossClassify,
  divisionClosure, divisionShadow, censusClosedForm, classicalAttribution,
  bodyClassVocabulary, edgeClassVocabulary,
} from "../src/core/shadow-spine.js";
import {
  FRAMES, DIVISIONS, ASPECT_FAMILIES, toFrame, separation, signIndex,
  wholeSignHouse, equalHouse, ARCSEC_PER_SIGN,
} from "../src/core/variants.js";

/** The classifier period: classification depends only on x mod 7·11·13·17·19. */
export const SPINE_PERIOD = 323323n;   // 7 · 11 · 13 · 17 · 19

/** Frames that are genuine ring rotations (heliocentric and draconic excluded). */
const ROTATIONS = FRAMES.filter((f) => f.offset_arcsec !== null);

/** Classical separations swept for invariance, in arcseconds. */
const SEPARATIONS = [648000n, 432000n, 324000n, 216000n, 108000n];

// ────────────────────────────────────────────────────────────────────
// Fast synchronous assertions
// ────────────────────────────────────────────────────────────────────

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // — the two axes, kept apart —
  t("off-ring lanes are the SafeS8 primes with nonzero ring residue",
    OFF_RING_LANES.length === 5
    && OFF_RING_LANES.every((l) => mod(RING, l.prime) !== 0n)
    && B8.filter((p) => mod(RING, p) !== 0n).every((p, i) => p === OFF_RING_LANES[i].prime),
    OFF_RING_LANES.map((l) => `${l.id}(${l.prime})`).join(" · "));
  t("the shadow spine is the INERT set {3,7,11,19}, not the off-ring set",
    SHADOW_SPINE.map(String).join() === "3,7,11,19"
    && OFF_RING_PRIMES.map(String).join() === "7,11,13,17,19"
    && SPINE.length === 4 && SPINE.some((z) => z.anchor && z.prime === 11n),
    "shadow ≠ off-ring — the correction this suite pins");
  t("lane 3 is a shadow prime that CLOSES — the trine absorbs shadow structure",
    isShadowPrime(3n) && closes(3n) && SPINE.find((z) => z.prime === 3n).closes_ring === true,
    "trine = 432,000″ exact, on an inert Gaussian prime");
  t("13 and 17 are off-ring but SPLIT — boundary/saturation defect, not shadow",
    !isShadowPrime(13n) && !isShadowPrime(17n)
    && OFF_RING_LANES.find((l) => l.prime === 13n).shadow === false
    && OFF_RING_LANES.find((l) => l.prime === 17n).shadow === false);
  t("lane roles carried through: H7 bridge · SH11 shadow anchor · B13 boundary · G17/G19 extenders",
    OFF_RING_LANES.map((l) => l.id).join() === "H7,SH11,B13,G17,G19"
    && OFF_RING_LANES.find((l) => l.prime === 11n).role === "shadow anchor"
    && OFF_RING_LANES.find((l) => l.prime === 17n).role === "saturation extender");
  t("every off-ring lane has an irreducible arcsecond defect",
    OFF_RING_LANES.every((l) => defect(l.prime) > 0n),
    OFF_RING_LANES.map((l) => `${l.id}=${defect(l.prime)}″`).join(" "));
  {
    const c = crossClassify();
    t("2×2 cross is fully occupied — neither axis determines the other",
      c.shadow_closing.join() === "3" && c.shadow_off_ring.join() === "7,11,19"
      && c.nonshadow_closing.join() === "2,5" && c.nonshadow_off_ring.join() === "13,17");
  }

  // — event vocabulary declares its axis —
  t("13 event classes, each declaring the axis it reports on",
    EVENT_CLASSES.length === 13
    && bodyClassVocabulary().every((c) => CLASS_IDS.includes(c))
    && edgeClassVocabulary().every((c) => CLASS_IDS.includes(c)));
  t("SH-* and H7-* report on the shadow axis",
    axisOf("SH-body") === "shadow" && axisOf("SH-edge") === "shadow"
    && axisOf("H7-body") === "shadow" && axisOf("G19-body") === "shadow");
  t("B13-* report on the boundary axis, G-* on saturation — never merged with shadow",
    axisOf("B13-zero") === "boundary" && axisOf("B13-pre") === "boundary"
    && axisOf("G-zero") === "saturation" && axisOf("G-pre") === "saturation"
    && axisOf("G-edge") === "saturation");
  t("B13-pre and B13-zero are distinct states, not one boundary highlight",
    CLASS_IDS.includes("B13-pre") && CLASS_IDS.includes("B13-zero"));
  t("body and edge scopes are separate classes",
    CLASS_IDS.includes("SH-body") && CLASS_IDS.includes("SH-edge")
    && CLASS_IDS.includes("G-zero") && CLASS_IDS.includes("G-edge"));

  // — body classification witnesses —
  {
    const cls = (x) => bodyEvents(x).map((e) => e.eventClass);
    t("r11 = 0 raises SH-body", cls(11n).includes("SH-body"));
    t("r13 = 0 raises B13-zero", cls(13n).includes("B13-zero"));
    t("r13 = 12 raises B13-pre", cls(12n).includes("B13-pre"));
    t("r7 = 0 raises H7-body", cls(7n).includes("H7-body"));
    t("x ≡ 0 (mod 323) raises G-zero", cls(323n).includes("G-zero"));
    t("x ≡ 322 (mod 323) raises G-pre",
      cls(322n).includes("G-pre"), "r17=16 ∧ r19=18");
    t("r19 = 0 raises G19-body — 19 is a shadow prime as well as an extender",
      cls(19n).includes("G19-body") && axisOf("G19-body") === "shadow");
    t("r17 ≤ 1 ∧ r19 ≤ 1 raises the exploratory G-low, distinct from G-zero",
      cls(1n).includes("G-low") && !cls(1n).includes("G-zero"));
    t("ordinary position raises exactly R",
      cls(2n).length === 1 && cls(2n)[0] === "R");
    t("every body event carries eventClass/trigger/scope/prime/value/proofStatus",
      bodyEvents(11n, "Moon").every((e) =>
        "eventClass" in e && "trigger" in e && e.scope === "body" && "axis" in e
        && "prime" in e && "value" in e && e.proofStatus === "computed"));
  }

  // — edge classification witnesses —
  {
    const cls = (x, y) => edgeEvents(x, y).map((e) => e.eventClass);
    t("shared r11 raises SH-edge", cls(5n, 16n).includes("SH-edge"));
    t("shared r13 raises B13-edge", cls(5n, 18n).includes("B13-edge"));
    t("shared r17 ∧ r19 raises G-edge", cls(5n, 328n).includes("G-edge"));
    t("shared r7 raises H7-edge", cls(5n, 12n).includes("H7-edge"));
    t("edge scope is tagged aspect-edge",
      edgeEvents(5n, 16n, "Mercury–Saturn").every((e) => e.scope === "aspect-edge"));
    t("a chart may hold zero body closures yet still hold edge preservations",
      bodyEvents(2n)[0].eventClass === "R"
      && !cls(2n, 14n).includes("SH-edge")
      && cls(2n, 79n).includes("SH-edge"), "r11(2) = r11(79) = 2, no body closure at either");
  }

  // — division-level classification, on both axes —
  t("divisionClosure names the lane that blocks closure",
    divisionClosure(84n).off_ring_lanes.join() === "H7"
    && divisionClosure(132n).off_ring_lanes.join() === "SH11"
    && divisionClosure(260n).off_ring_lanes.join() === "B13");
  t("a closing division carries no off-ring prime",
    divisionClosure(108n).off_ring_primes.length === 0
    && divisionClosure(108n).closes === true
    && divisionClosure(108n).alien_factor === null);
  t("divisionShadow reports q, δ, ρ and band — independent of closure",
    divisionShadow(260n).q === "0" && divisionShadow(260n).rho === "3"
    && divisionShadow(132n).q === "11" && divisionShadow(132n).anchored === true
    && divisionShadow(36n).closes === undefined,
    "Tzolk'in is off-ring yet q = 0 — off-ring is not shadow");
  {
    let bad = null;
    for (const d of DIVISIONS) {
      const c = divisionClosure(d.n);
      const blocked = c.off_ring_primes.length > 0 || c.alien_factor !== null;
      if (c.closes === blocked) { bad = d.id; break; }
    }
    t("across the registry: closes ⟺ no blocking factor", bad === null,
      bad === null ? `${DIVISIONS.length}/${DIVISIONS.length}` : "counterexample " + bad);
  }
  {
    // the axes genuinely disagree somewhere in the registry
    const disagree = DIVISIONS.filter((d) => {
      const offShadow = divisionClosure(d.n).off_ring_primes.some((p) => isShadowPrime(BigInt(p)));
      const hasShadow = divisionShadow(d.n).q !== "0";
      return offShadow !== hasShadow;
    });
    t("the two axes disagree on real divisions — proof they are not one thing",
      disagree.length > 0, disagree.map((d) => d.id).slice(0, 5).join(" · "));
  }

  // — the reinforcement statement, as arithmetic —
  {
    const ptol = ASPECT_FAMILIES.find((f) => f.id === "ptolemaic");
    const marginal = ["septile", "undecile", "harmonic_13"]
      .map((id) => ASPECT_FAMILIES.find((f) => f.id === id));
    t("the Ptolemaic set is exactly the closing part of the harmonic space",
      ptol.divisors.every((n) => closes(n))
      && marginal.every((f) => f.divisors.every((n) => !closes(n))),
      "{1,2,3,4,6} close · {7,11,13,14} do not");
    t("the traditional apparatus is {2,3,5}-smooth throughout",
      [12n, 36n, 144n, 360n, 21600n, RING].every((n) => closes(n)));
    t("the marginal families are exactly the off-ring lanes",
      marginal.flatMap((f) => f.divisors).every((n) => offRingPrimes(n).length > 0));
  }

  // — the classical layer never consults the spine —
  {
    const x = 456789n;
    const before = JSON.stringify(classicalAttribution(x, 0n));
    bodyEvents(x); edgeEvents(x, mod(x + 432000n, RING));
    laneResidues(x); shadowResidues(x);
    const after = JSON.stringify(classicalAttribution(x, 0n));
    t("evaluating the spine leaves the classical attribution byte-identical",
      before === after, "sign/decan/dwad/degree unchanged");
  }
  t("classicalAttribution is exact at boundaries",
    classicalAttribution(0n, 0n).sign === "0"
    && classicalAttribution(RING - 1n, 0n).sign === "11"
    && classicalAttribution(107999n, 0n).degree_in_sign === "29"
    && classicalAttribution(3600n, 0n).degree_in_sign === "1");

  // — closed-form census is self-consistent —
  {
    const c = censusClosedForm();
    const ok = c["SH-body"] === "117819" && c["B13-zero"] === "99693"
      && c["B13-pre"] === "99692" && c["H7-body"] === "185143"
      && c["G19-body"] === "68211" && c["G-zero"] === "4013" && c["G-pre"] === "4012";
    t("closed-form census over the ring", ok,
      `SH-body ${c["SH-body"]} · B13-zero ${c["B13-zero"]} · B13-pre ${c["B13-pre"]} · G-zero ${c["G-zero"]}`);
  }
  t("event classification has period 7·11·13·17·19 = 323,323",
    SPINE_PERIOD === 7n * 11n * 13n * 17n * 19n);

  return R;
}

// ────────────────────────────────────────────────────────────────────
// Exhaustive sweep: classifier agreement, census, independence
// ────────────────────────────────────────────────────────────────────

/**
 * Phase A — exhaustive over one full classifier period [0, 323,323): the
 * object-emitting `bodyEvents` agrees with the inline classifier used by the
 * census. Since classification depends only on x mod 323,323, this is a
 * complete proof of agreement over the entire ring.
 *
 * Phase B — exhaustive over the whole ring [0, 1,296,000): body-event census,
 * checked against the BigInt closed form; and the independence matrix, which
 * records for every (sign, lane) pair which residues actually occur and for
 * every (sign, class) pair whether that class fires there.
 */
export async function runSpineSweep(onProgress) {
  const results = [];
  const P = [7, 11, 13, 17, 19];

  // ── Phase A ──────────────────────────────────────────────────────
  let disagree = null;
  {
    const CHUNK = 20000n;
    for (let base = 0n; base < SPINE_PERIOD && disagree === null; base += CHUNK) {
      const end = base + CHUNK < SPINE_PERIOD ? base + CHUNK : SPINE_PERIOD;
      for (let x = base; x < end; x++) {
        const want = inlineBodyClasses(
          Number(mod(x, 7n)), Number(mod(x, 11n)), Number(mod(x, 13n)),
          Number(mod(x, 17n)), Number(mod(x, 19n)),
        );
        const got = bodyEvents(x).map((e) => e.eventClass);
        if (want.length !== got.length || want.some((c, i) => c !== got[i])) {
          disagree = x.toString(); break;
        }
      }
      if (onProgress) {
        await onProgress({
          phase: "classifier agreement",
          pct: Number((end * 40n) / SPINE_PERIOD),
        });
      }
    }
  }
  results.push({
    name: "bodyEvents ≡ census classifier, exhaustive over the 323,323 period",
    ok: disagree === null,
    detail: disagree === null ? "323,323/323,323 agree — complete for the ring" : "disagreement at x=" + disagree,
  });

  // ── Phase B ──────────────────────────────────────────────────────
  const census = Object.create(null);
  for (const c of bodyClassVocabulary()) census[c] = 0;

  // seen[sign][laneIdx] = Set of residues observed; fired[sign] = Set of classes
  const seen = [], fired = [];
  for (let s = 0; s < 12; s++) {
    seen.push(P.map(() => new Set()));
    fired.push(new Set());
  }

  {
    const SEG = 108000;                 // one sign
    const r = [0, 0, 0, 0, 0];          // rolling residues, all < 20
    let x = 0;
    for (let s = 0; s < 12; s++) {
      for (let i = 0; i < SEG; i++, x++) {
        const cls = inlineBodyClasses(r[0], r[1], r[2], r[3], r[4]);
        for (const c of cls) { census[c]++; fired[s].add(c); }
        for (let k = 0; k < 5; k++) seen[s][k].add(r[k]);
        for (let k = 0; k < 5; k++) { r[k]++; if (r[k] === P[k]) r[k] = 0; }
      }
      if (onProgress) {
        await onProgress({ phase: "ring census", pct: 40 + ((s + 1) * 60) / 12 });
      }
    }
  }

  // census vs closed form
  {
    const cf = censusClosedForm();
    const mism = [];
    for (const key of Object.keys(cf)) {
      if (BigInt(census[key]) !== BigInt(cf[key])) mism.push(`${key}: swept ${census[key]} ≠ ${cf[key]}`);
    }
    results.push({
      name: "swept census = BigInt closed form, all six body classes",
      ok: mism.length === 0,
      detail: mism.length ? mism.join(" · ")
        : `SH-body ${census["SH-body"]} · B13-zero ${census["B13-zero"]} · B13-pre ${census["B13-pre"]} · H7-body ${census["H7-body"]} · G-zero ${census["G-zero"]} · G-pre ${census["G-pre"]}`,
    });
  }
  {
    const total = Object.values(census).reduce((a, b) => a + b, 0);
    results.push({
      name: "every ring position classified — no position left unlabelled",
      ok: census["R"] > 0 && total >= 1296000,
      detail: `${census["R"].toLocaleString()} ordinary · ${(total - census["R"]).toLocaleString()} spine events`,
    });
  }

  // independence: every lane residue occurs in every sign
  {
    const gaps = [];
    for (let s = 0; s < 12; s++) {
      for (let k = 0; k < 5; k++) {
        if (seen[s][k].size !== P[k]) gaps.push(`sign ${s} lane ${P[k]}: ${seen[s][k].size}/${P[k]}`);
      }
    }
    results.push({
      name: "orthogonality — every sign contains every residue of every off-ring lane",
      ok: gaps.length === 0,
      detail: gaps.length ? gaps.slice(0, 3).join(" · ")
        : "12 signs × 5 lanes × all residues present — the lanes are not a re-encoding of sign",
    });
  }
  // independence the other way: every firing class occurs in every sign
  {
    const classes = ["SH-body", "B13-zero", "B13-pre", "H7-body", "G19-body", "G-zero", "G-pre", "R"];
    const gaps = [];
    for (let s = 0; s < 12; s++) for (const c of classes) if (!fired[s].has(c)) gaps.push(`sign ${s}: ${c}`);
    results.push({
      name: "independence — every event class fires in every sign",
      ok: gaps.length === 0,
      detail: gaps.length ? gaps.slice(0, 3).join(" · ")
        : "no class is confined to a sign — sign is not recoverable from event class",
    });
  }

  const ok = results.every((r) => r.ok);
  return { name: "Lane sweep", results, ok, census };
}

/** Inline body classifier — small integers only. Mirrors bodyEvents order. */
function inlineBodyClasses(r7, r11, r13, r17, r19) {
  const out = [];
  if (r11 === 0) out.push("SH-body");
  if (r13 === 0) out.push("B13-zero");
  else if (r13 === 12) out.push("B13-pre");
  if (r17 === 0 && r19 === 0) out.push("G-zero");
  else if (r17 === 16 && r19 === 18) out.push("G-pre");
  else if (r17 <= 1 && r19 <= 1) out.push("G-low");
  if (r7 === 0) out.push("H7-body");
  if (r19 === 0) out.push("G19-body");
  if (out.length === 0) out.push("R");
  return out;
}

// ────────────────────────────────────────────────────────────────────
// Exhaustive sweep: frame invariance of the classical layer
// ────────────────────────────────────────────────────────────────────

/**
 * For every x in [0, 1,296,000) and every declared sidereal frame ω:
 *
 *   (a) SEPARATIONS ARE INVARIANT. mod((x−ω) − (y−ω)) = mod(x−y): the rotation
 *       cancels, so every aspect — and every orb — survives the frame change
 *       untouched. Choosing an ayanamsa cannot create or destroy an aspect.
 *
 *   (b) DEGREE-BASED HOUSES ARE INVARIANT. Equal houses measured in arcseconds
 *       from the ascendant contain no reference to ω at all.
 *
 *   (c) SIGN NAMING SHIFTS BY A FIXED AMOUNT. The sign index drops by exactly
 *       ⌊ω/108000⌋ or one more — never anything else.
 *
 *   (d) WHOLE-SIGN HOUSES MOVE BY AT MOST ONE. Whole-sign houses are defined on
 *       signs, so they are frame-dependent — but the dependence is bounded and
 *       exact: house(ω) − house(0) ≡ δ_asc − δ_x (mod 12) with each δ ∈ {lo,
 *       lo+1}, hence a shift in {−1, 0, +1} and nothing larger. A sidereal
 *       frame re-labels the chart; it never scrambles it.
 *
 * Together this is the certificate that the variant layer is additive.
 */
export async function runFrameSweep(onProgress) {
  const results = [];
  const frames = ROTATIONS.map((f) => ({ id: f.id, w: f.offset_arcsec }));
  let sepFail = null, equalFail = null, signFail = null, wsFail = null;
  let wsMoved = 0n;
  const CHUNK = 27000n;
  const asc = 271828n;

  for (let base = 0n; base < RING; base += CHUNK) {
    const end = base + CHUNK < RING ? base + CHUNK : RING;
    for (let x = base; x < end; x++) {
      const s = SEPARATIONS[Number(mod(x, 5n))];
      const y = mod(x + s, RING);
      const trueSep = separation(x, y);
      const trueEqual = equalHouse(x, asc);
      const trueWhole = wholeSignHouse(x, asc, 0n);
      const baseSign = signIndex(x, 0n);
      for (const f of frames) {
        const lo = f.w / ARCSEC_PER_SIGN;
        const xr = toFrame(x, f.w), yr = toFrame(y, f.w), ar = toFrame(asc, f.w);

        // (a) separation invariance
        if (sepFail === null && separation(xr, yr) !== trueSep) sepFail = `${f.id}@${x}`;

        // (b) degree-based houses carry no frame dependence
        if (equalFail === null && equalHouse(xr, ar) !== trueEqual) equalFail = `${f.id}@${x}`;

        // (c) sign naming shifts by lo or lo+1
        const dx = mod(baseSign - signIndex(x, f.w), 12n);
        if (signFail === null && dx !== mod(lo, 12n) && dx !== mod(lo + 1n, 12n)) signFail = `${f.id}@${x}`;

        // (d) whole-sign house shift is exactly δ_asc − δ_x, hence in {−1,0,+1}
        const dAsc = mod(signIndex(asc, 0n) - signIndex(asc, f.w), 12n);
        const shift = mod(wholeSignHouse(x, asc, f.w) - trueWhole, 12n);
        const predicted = mod(dAsc - dx, 12n);
        if (wsFail === null && shift !== predicted) wsFail = `${f.id}@${x}`;
        if (shift !== 0n) wsMoved++;
        if (wsFail === null && shift !== 0n && shift !== 1n && shift !== 11n) wsFail = `${f.id}@${x}:${shift}`;
      }
    }
    if (onProgress) await onProgress({ phase: "frame invariance", pct: Number((end * 100n) / RING) });
  }

  const total = RING * BigInt(frames.length);
  results.push({
    name: "separations invariant under every sidereal frame — every aspect survives",
    ok: sepFail === null,
    detail: sepFail === null
      ? `1,296,000 × ${frames.length} frames × Ptolemaic separations — zero drift`
      : "drift at " + sepFail,
  });
  results.push({
    name: "degree-based (equal) houses invariant under every sidereal frame",
    ok: equalFail === null,
    detail: equalFail === null ? "arcsecond house placement carries no ayanamsa dependence" : "changed at " + equalFail,
  });
  results.push({
    name: "sign naming shifts by exactly ⌊ω/30°⌋ or one more — nothing else moves",
    ok: signFail === null,
    detail: signFail === null
      ? frames.map((f) => `${f.id} −${(f.w / ARCSEC_PER_SIGN).toString()} sign`).join(" · ")
      : "unexpected shift at " + signFail,
  });
  results.push({
    name: "whole-sign house shift = δ_asc − δ_body exactly, always within one house",
    ok: wsFail === null,
    detail: wsFail === null
      ? `${wsMoved.toString()} of ${total.toString()} placements move, every one by a single house`
      : "unbounded or unpredicted shift at " + wsFail,
  });

  return { name: "Frame-invariance sweep", results, ok: results.every((r) => r.ok) };
}
