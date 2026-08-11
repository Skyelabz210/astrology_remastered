// test/accuracy.test.js — WP-10: accuracy gate.
//
// Compares tools/ephemeris/produce-ledger.mjs's output against the
// independently-sourced JPL Horizons fixture (test/fixtures/reference-
// vectors.json, WP-09) at all 20 fixture points x 10 bodies (200
// comparisons), circular (wraparound-safe, shortest-arc) difference in
// arcseconds, against a per-body tolerance.
//
// ── Which fixture field to diff against ───────────────────────────────
// reference-vectors.json's own `meta.derivation_note` says explicitly:
//   "longitude_arcsec_decimal = ... full float precision, not rounded —
//    this is the value accuracy.test.js (WP-10) should diff against,
//    since rounding here would swamp a ~60 arcsec tolerance with
//    fixture-side rounding error"
// So this suite diffs against `longitude_arcsec_decimal`, not
// `longitude_arcsec_rounded` — the rounded field would add up to 0.5″ of
// pure fixture-side quantization noise on top of the real producer-vs-
// Horizons error being measured, which matters when tracking a 60″ budget.
//
// ── Tolerance ────────────────────────────────────────────────────────
// 60″ for Sun/Mercury/Venus/Mars/Jupiter/Saturn/Uranus/Neptune/Pluto.
// 120″ for the Moon: astronomy-engine's lunar theory (ELP2000-82B-derived)
// and JPL Horizons' DE441 (a full numerically-integrated ephemeris) are
// two different lunar models; their disagreement is dominated by physics
// (different lunar theories), not implementation bugs, and the Moon's own
// ~13°/day motion makes a given time/model discrepancy translate into a
// larger longitude error than for any other body. This is a documented,
// widely-cited astronomy-engine-vs-JPL characteristic (not a project bug),
// so the Moon gets a wider, explicitly-labeled budget rather than being
// silently excluded.
//
// ── Barycenter-substituted cells ────────────────────────────────────
// 5 cells (points 1-2: Saturn/Neptune/Pluto at points before Horizons has
// planet-center ephemerides) are Horizons *barycenter* positions, not true
// planet-center positions (see each cell's `note` field and the fixture's
// top-level `coverage_note`). Per that same coverage_note, the offset is
// "negligible at this distance, <0.1 arcsec" — three orders of magnitude
// under even the tightest (60″) tolerance here. Decision: INCLUDE them in
// the strict tolerance check like every other cell (no special-casing),
// and assert their count is exactly 5 as a sanity check that this suite
// is seeing the fixture its documentation describes.
//
// Structure note (WP-10): the planetary-longitude comparison loop below is
// self-contained (reads the fixture, calls produceLedgerEntries, asserts +
// accumulates stats) and ends before the summary-assertions block.
//
// WP-13 house-cusp rows: added as an independent block AFTER the summary
// block (per the note above), not woven into the planetary loop. See that
// block's own header comment for what it does and does not re-verify, and
// why it reuses test/houses.test.js's exported SWISSEPH_REFERENCE constant
// (genuine pyswisseph 2.10.03 output — see that file's header for
// provenance/regeneration steps) rather than embedding a second copy of the
// same reference numbers here.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).
// Also runnable standalone: `node test/accuracy.test.js`.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { produceLedgerEntries, produceHouseLedgerEntries } from "../tools/ephemeris/produce-ledger.mjs";
import { SWISSEPH_REFERENCE } from "./houses.test.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures", "reference-vectors.json");

const ARCSEC_CIRCLE = 1296000; // 360 * 3600
const BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

function toleranceArcsecFor(body) {
  return body === "Moon" ? 120 : 60;
}

/** Shortest-arc, wraparound-safe absolute difference between two arcsec
 * values (each expected in/near [0, 1296000)), returned in [0, 648000]. */
function circularDiffArcsec(a, b) {
  let d = (a - b) % ARCSEC_CIRCLE;
  if (d < 0) d += ARCSEC_CIRCLE;
  if (d > ARCSEC_CIRCLE / 2) d = ARCSEC_CIRCLE - d;
  return d;
}

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

/** Shortest-arc, wraparound-safe absolute difference between two DEGREE
 * values, returned in ARCSECONDS. Used by the WP-13 house-cusp block below
 * (which works in degrees, unlike the arcsec-domain planetary loop above). */
function circularDiffDegArcsec(aDeg, bDeg) {
  let d = Math.abs(aDeg - bDeg) % 360;
  if (d > 180) d = 360 - d;
  return d * 3600;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const fixture = loadFixture();
  const points = fixture.points;

  t("fixture loads with 20 points", Array.isArray(points) && points.length === 20,
    `got ${Array.isArray(points) ? points.length : typeof points}`);
  if (!Array.isArray(points) || points.length === 0) return R;

  // Per-body accumulators for the summary block below.
  const stats = {};
  for (const body of BODIES) stats[body] = { diffs: [], barycenterCount: 0 };

  // ── main comparison loop: one produceLedgerEntries() call per point ───
  for (const point of points) {
    let entries;
    try {
      entries = produceLedgerEntries({ time: point.utc, lat: 0, lng: 0, bodies: BODIES });
    } catch (err) {
      t(`point ${point.id} (${point.utc}): produceLedgerEntries succeeds`, false, String(err && err.message || err));
      continue;
    }
    const byBody = new Map(entries.map((e) => [e.body, e]));

    for (const body of BODIES) {
      const ref = point.bodies && point.bodies[body];
      if (!ref) {
        t(`point ${point.id}/${body}: fixture has this body`, false, "missing from fixture point");
        continue;
      }
      const entry = byBody.get(body);
      if (!entry) {
        t(`point ${point.id}/${body}: producer emitted this body`, false, "missing from produceLedgerEntries output");
        continue;
      }
      if (ref.note) stats[body].barycenterCount += 1;

      const produced = Number(entry.longitude_arcsec);
      const reference = ref.longitude_arcsec_decimal;
      const diff = circularDiffArcsec(produced, reference);
      const tol = toleranceArcsecFor(body);
      stats[body].diffs.push(diff);

      t(
        `point ${point.id} (${point.utc}) / ${body}: within ${tol}″`,
        diff <= tol,
        `produced=${produced}″ reference=${reference}″ diff=${diff.toFixed(4)}″` +
          (ref.note ? " [barycenter-substituted fixture cell, included per policy]" : ""),
      );
    }
  }

  // ── summary assertions: real max/mean per body, not just pass/fail ────
  for (const body of BODIES) {
    const { diffs, barycenterCount } = stats[body];
    if (diffs.length === 0) {
      t(`${body}: summary has data`, false, "no comparisons recorded");
      continue;
    }
    const max = Math.max(...diffs);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const tol = toleranceArcsecFor(body);
    t(
      `${body}: summary over ${diffs.length} points — max=${max.toFixed(4)}″ mean=${mean.toFixed(4)}″ (tolerance ${tol}″${barycenterCount ? `, incl. ${barycenterCount} barycenter-substituted cell(s)` : ""})`,
      max <= tol,
      `max=${max.toFixed(4)}″ mean=${mean.toFixed(4)}″ n=${diffs.length}`,
    );
  }

  // ── sanity check: this suite is seeing the fixture its docs describe ──
  const totalBarycenter = BODIES.reduce((sum, b) => sum + stats[b].barycenterCount, 0);
  t("exactly 5 barycenter-substituted cells seen (per fixture coverage_note)",
    totalBarycenter === 5, `saw ${totalBarycenter}`);

  // ── house-cusp rows (WP-13): ledger-wiring cross-check ─────────────────
  // This block does NOT re-verify houses.js's spherical-astronomy formulas
  // — that already happened in test/houses.test.js (540 comparisons against
  // genuine pyswisseph output there, worst residual ~12.5″, well inside the
  // 30″ bar). What THIS block checks is whether produce-ledger.mjs's WP-13
  // `--houses` wiring — degrees->arcsec rounding, event_id/house_system
  // tagging, schema shape (see produceHouseLedgerEntries()) — introduces
  // any NEW discrepancy on top of that already-verified math. It does so by
  // calling produceHouseLedgerEntries() (the in-process equivalent of the
  // CLI's `--houses` path) over a representative subset of
  // test/houses.test.js's own charts and comparing the *emitted ledger
  // entries* against the same genuine external (pyswisseph 2.10.03)
  // reference numbers houses.test.js uses, imported from its exported
  // SWISSEPH_REFERENCE constant (see that file's header for full
  // regeneration provenance) rather than embedding a second copy of the
  // same numbers here.
  //
  // Representative subset: 4 of the 8 ledger-gated quadrant systems x all 5
  // SWISSEPH_REFERENCE charts (not the full 8x5 matrix — that coverage
  // already exists in houses.test.js, and re-running it here under a
  // different file name would test houses.js a second time rather than
  // testing the ledger wiring this package actually adds). The four chosen
  // — placidus (iterative, "hard" polar-throw), koch (closed-form, "hard"
  // polar-throw), campanus ("soft" polar guidance, prime-vertical
  // construction), meridian (no latitude dependence at all, and the one
  // system here where cusp1 is NOT the true Ascendant — see houses.js's
  // meridianCusps() comment) — deliberately span the module's different
  // construction families and its one ASC-identity edge case, rather than
  // picking four similar systems.
  {
    const CUSP_TOLERANCE_ARCSEC = 30;
    const REPRESENTATIVE_SYSTEMS = ["placidus", "koch", "campanus", "meridian"];
    // Per houses.js's own per-system documentation: cusp1 (house 1) equals
    // the true Ascendant, and cusp10 (house 10) equals the true Midheaven,
    // for every quadrant system in this file EXCEPT meridian, whose
    // construction is RA-based rather than angular — meridian's cusp10
    // still equals the true MC (documented explicitly in meridianCusps()'s
    // header) but its cusp1 does not equal the true ASC (it is the
    // "equatorial ascendant" instead). ASC/MC ledger entries are only
    // compared against a chart's reference cusp1/cusp10 where that
    // identity actually holds, so this suite never asserts a false
    // equivalence.
    const CUSP1_IS_ASC = { placidus: true, koch: true, campanus: true, meridian: false };
    const CUSP10_IS_MC = { placidus: true, koch: true, campanus: true, meridian: true };

    let maxObservedArcsec = 0;
    let maxObservedWhere = "";
    let cuspComparisons = 0;
    const expectedPerChart =
      REPRESENTATIVE_SYSTEMS.length * 12 +
      Object.values(CUSP1_IS_ASC).filter(Boolean).length +
      Object.values(CUSP10_IS_MC).filter(Boolean).length;
    const expectedTotal = expectedPerChart * Object.keys(SWISSEPH_REFERENCE).length;

    for (const [chartLabel, chart] of Object.entries(SWISSEPH_REFERENCE)) {
      let entries;
      try {
        entries = produceHouseLedgerEntries({
          time: chart.iso, lat: chart.latDeg, lng: chart.lngDeg, systems: REPRESENTATIVE_SYSTEMS,
        });
      } catch (err) {
        t(`chart ${chartLabel}: produceHouseLedgerEntries succeeds`, false, String((err && err.message) || err));
        continue;
      }
      const byKey = new Map(entries.map((e) => [`${e.house_system}#${e.body}`, e]));

      const checkPoint = (sys, body, expectedDeg, label) => {
        const entry = byKey.get(`${sys}#${body}`);
        cuspComparisons += 1;
        if (!entry) {
          t(`chart ${chartLabel} / ${sys} / ${label}: ledger emits this entry`, false, "missing (system skipped? see stderr)");
          return;
        }
        const producedDeg = Number(entry.longitude_arcsec) / 3600;
        const diffArcsec = circularDiffDegArcsec(producedDeg, expectedDeg);
        if (diffArcsec > maxObservedArcsec) { maxObservedArcsec = diffArcsec; maxObservedWhere = `${chartLabel}/${sys}/${label}`; }
        t(
          `chart ${chartLabel} / ${sys} / ${label}: ledger entry within ${CUSP_TOLERANCE_ARCSEC}″ of swisseph`,
          diffArcsec <= CUSP_TOLERANCE_ARCSEC,
          `entry=${producedDeg}° expected=${expectedDeg}° diff=${diffArcsec.toFixed(2)}″ house_system=${entry.house_system}`,
        );
      };

      for (const sys of REPRESENTATIVE_SYSTEMS) {
        const expected = chart.systems[sys];
        for (let i = 0; i < 12; i++) checkPoint(sys, `CUSP_${i + 1}`, expected[i], `CUSP_${i + 1}`);
        if (CUSP1_IS_ASC[sys]) checkPoint(sys, "ASC", expected[0], "ASC");
        if (CUSP10_IS_MC[sys]) checkPoint(sys, "MC", expected[9], "MC");
      }
    }

    t(
      `house-cusp ledger rows: saw all ${REPRESENTATIVE_SYSTEMS.length} representative systems x ${Object.keys(SWISSEPH_REFERENCE).length} charts (${expectedTotal} comparisons expected)`,
      cuspComparisons === expectedTotal,
      `saw ${cuspComparisons}, expected ${expectedTotal}`
    );
    t(
      `worst observed produce-ledger.mjs house-cusp residual across all chart/system/point rows is well inside ${CUSP_TOLERANCE_ARCSEC}″`,
      maxObservedArcsec <= CUSP_TOLERANCE_ARCSEC,
      `max=${maxObservedArcsec.toFixed(3)}″ at ${maxObservedWhere}`
    );
  }

  return R;
}

// ── standalone execution: `node test/accuracy.test.js` ────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const rows = run();
  const pass = rows.filter((r) => r.ok).length;
  for (const r of rows) {
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n  ${pass === rows.length ? "PASS" : "FAIL"}  ${pass}/${rows.length} assertions`);
  process.exit(pass === rows.length ? 0 : 1);
}
