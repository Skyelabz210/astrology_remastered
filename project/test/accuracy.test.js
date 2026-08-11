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
// Structure note for WP-13 (house-cusp rows land here later): the
// planetary-longitude comparison loop below is self-contained (reads the
// fixture, calls produceLedgerEntries, asserts + accumulates stats) and
// ends before the summary-assertions block. House-cusp comparisons should
// be added as an independent block after the summary block, not woven
// into this loop — do not add cusp logic in this package (WP-10); that is
// entirely WP-13's job.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).
// Also runnable standalone: `node test/accuracy.test.js`.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { produceLedgerEntries } from "../tools/ephemeris/produce-ledger.mjs";

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
