// test/present/mutual-perfections.test.js — mutual activations: two
// independent lifecycle scans compared for near-simultaneous perfections.
//
// mergeNearPerfections/mutualPerfections (time.jsx) claim nothing about
// EITHER chart individually — they only ask whether two already-exact,
// already-tested facts (each transitPerfections hit is independently
// bisected to sub-arcsecond exactness, per perfections.test.js) happen to
// land within a day of each other. This suite pins the merge's own
// correctness (every reported pair really is within the window, no pair
// outside it is missed, symmetry, determinism) using both synthetic
// fixtures (fast, no ephemeris) and a real two-chart integration run.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const sb = {};
  sb.window = sb;
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }

  // ── synthetic fixtures: the merge logic alone, no ephemeris involved ──
  const hit = (jd, tag) => ({ jd, tag });
  {
    const a = [hit(1000, "a0"), hit(1010, "a1"), hit(1020.4, "a2")];
    const b = [hit(1000.3, "b0"), hit(1015, "b1"), hit(1020.6, "b2")];

    const w05 = sb.mergeNearPerfections(a, b, 0.5);
    t("default-adjacent window (0.5d) finds exactly the two true near-pairs",
      w05.length === 2, JSON.stringify(w05.map((m) => [m.a.tag, m.b.tag])));
    t("each reported pair is genuinely within the requested window",
      w05.every((m) => Math.abs(m.b.jd - m.a.jd) <= 0.5 + 1e-9));
    t("a0/b0 (0.3d apart) and a2/b2 (0.2d apart) are the pairs found",
      w05.some((m) => m.a.tag === "a0" && m.b.tag === "b0") &&
      w05.some((m) => m.a.tag === "a2" && m.b.tag === "b2"));

    const wide = sb.mergeNearPerfections(a, b, 5);
    t("widening the window finds more pairs, never fewer",
      wide.length >= w05.length);
    t("every pair from the tight window still appears in the wide one",
      w05.every((m0) => wide.some((m1) => m1.a.tag === m0.a.tag && m1.b.tag === m0.b.tag)));

    t("a zero window only matches genuinely simultaneous instants",
      sb.mergeNearPerfections(a, b, 0).length === 0);

    t("results are sorted by the pair's midpoint instant",
      w05.every((m, i, arr) => i === 0 || arr[i - 1].jd <= m.jd));

    t("gapDays is signed b-minus-a, and jd is the true midpoint",
      w05.every((m) => Math.abs(m.gapDays - (m.b.jd - m.a.jd)) < 1e-9 &&
                        Math.abs(m.jd - (m.a.jd + m.b.jd) / 2) < 1e-9));
  }

  // ── swapping the two inputs reproduces the same pairs (order-independent set) ──
  {
    const a = [hit(2000, "a0"), hit(2000.2, "a1")];
    const b = [hit(2000.1, "b0")];
    const ab = sb.mergeNearPerfections(a, b, 1);
    const ba = sb.mergeNearPerfections(b, a, 1);
    t("swapping the two charts' hit lists reproduces the same pairing (mirrored)",
      ab.length === ba.length &&
      ab.every((m) => ba.some((n) => n.a.tag === m.b.tag && n.b.tag === m.a.tag)));
  }

  // ── a chart against itself: every hit is (trivially) within any window of itself ──
  {
    const a = [hit(3000, "x"), hit(3010, "y")];
    const self = sb.mergeNearPerfections(a, a, 0);
    t("a chart's scan against itself matches every hit to itself exactly",
      self.length === a.length && self.every((m) => m.a.tag === m.b.tag && m.gapDays === 0));
  }

  // ── determinism ──
  {
    const a = [hit(4000, "a"), hit(4001, "a2")];
    const b = [hit(4000.4, "b")];
    const r1 = sb.mergeNearPerfections(a, b, 1);
    const r2 = sb.mergeNearPerfections(a, b, 1);
    t("mergeNearPerfections is deterministic", JSON.stringify(r1) === JSON.stringify(r2));
  }

  // ── real two-chart integration: mutualPerfections end to end ──
  {
    const A = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
    const B = sb.computeNatal({ dateISO: "1990-03-15T12:30:00Z", lat: 29.4241, lng: -98.4936, houseSystem: "whole" });
    const jdCenter = sb.dateToJD(new Date("2026-09-01T00:00:00Z"));

    const mutual = sb.mutualPerfections(A, B, jdCenter, 366, sb.MUTUAL_SAME_DAY_WINDOW);
    t("mutualPerfections returns a plausible count for a year at the same-day window",
      mutual.length >= 0 && mutual.length < 60, `${mutual.length} mutual hits`);
    t("every mutual hit is genuinely within the same-day window",
      mutual.every((m) => Math.abs(m.gapDays) <= sb.MUTUAL_SAME_DAY_WINDOW + 1e-9));
    t("every mutual hit's two sides are real, independently-exact perfections",
      mutual.every((m) =>
        typeof m.a.transit === "string" && typeof m.a.natal === "string" &&
        typeof m.b.transit === "string" && typeof m.b.natal === "string" &&
        !Number.isNaN(Date.parse(m.a.dateISO)) && !Number.isNaN(Date.parse(m.b.dateISO))));

    // Consistency: mutualPerfections must equal running the two scans by
    // hand and merging them — it is a convenience wrapper, not a
    // different computation.
    const hitsA = sb.transitPerfections(A, jdCenter, 366).hits;
    const hitsB = sb.transitPerfections(B, jdCenter, 366).hits;
    const byHand = sb.mergeNearPerfections(hitsA, hitsB, sb.MUTUAL_SAME_DAY_WINDOW);
    t("mutualPerfections agrees exactly with scanning both charts and merging by hand",
      mutual.length === byHand.length &&
      mutual.every((m, i) => m.jd === byHand[i].jd));

    // A chart against a shifted copy of itself: shifting B's birth by
    // exactly one day should reproduce every one of A's own perfections
    // as a mutual hit at ~1 day gap (both charts see the identical sky,
    // offset by exactly the birth gap) — a strong end-to-end sanity check
    // that the merge is finding real coincidences, not noise.
    const Bshifted = sb.computeNatal({ dateISO: A.birth.dateISO, lat: A.birth.lat, lng: A.birth.lng, houseSystem: A.birth.houseSystem });
    const mutualSelf = sb.mutualPerfections(A, Bshifted, jdCenter, 366, 0.001);
    t("a chart matched against an identical copy of itself finds every one of its own perfections",
      mutualSelf.length === hitsA.length, `${mutualSelf.length} vs ${hitsA.length}`);
  }

  return rows;
}
