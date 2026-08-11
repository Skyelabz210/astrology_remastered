// test/fixtures.test.js — WP-09: sanity checks over
// test/fixtures/reference-vectors.json itself.
//
// This is NOT the accuracy gate — it does not compare against
// produce-ledger.mjs's output at all. That comparison (circular-difference
// tolerance per body, retrograde/station sign flips) is WP-10's job
// (test/accuracy.test.js and test/retrograde.test.js). This suite only
// checks that the fixture file WP-10 will consume has the shape, ranges, and
// provenance it claims to have: 20 points, 10 bodies each, longitudes in
// range, a complete provenance block, station brackets for Mercury/Mars/
// Venus, and one well-known spot-check (Sun at the J2000 instant).
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures", "reference-vectors.json");

const EXPECTED_BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];
const EXPECTED_POINT_COUNT = 20;
const ARCSEC_CIRCLE = 1296000;
const ARCSEC_PER_DEG = 3600;
const STATION_BODIES = ["Mercury", "Mars", "Venus"];

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  let raw = null;
  let parseErr = null;
  try {
    raw = readFileSync(FIXTURE_PATH, "utf8");
  } catch (err) {
    parseErr = err;
  }
  t("reference-vectors.json exists and is readable", raw !== null, parseErr ? String(parseErr.message) : "");
  if (raw === null) return R;

  let fixture = null;
  try {
    fixture = JSON.parse(raw);
  } catch (err) {
    parseErr = err;
  }
  t("reference-vectors.json is valid JSON", fixture !== null, parseErr ? String(parseErr.message) : "");
  if (fixture === null) return R;

  // ── top-level shape ──────────────────────────────────────────────────
  t("has a meta block", typeof fixture.meta === "object" && fixture.meta !== null);
  t("has a points array", Array.isArray(fixture.points));
  t("has a stations block", typeof fixture.stations === "object" && fixture.stations !== null);

  // ── provenance block ─────────────────────────────────────────────────
  const meta = fixture.meta || {};
  const requiredMetaFields = [
    "derived_from", "derived_date", "derivation_note",
    "source", "retrieved", "ephemeris", "quantities", "center",
    "calendar_note", "frame_note", "coverage_note",
  ];
  for (const field of requiredMetaFields) {
    t(`meta.${field} is present and non-empty`,
      typeof meta[field] === "string" && meta[field].length > 0,
      `got ${JSON.stringify(meta[field])}`);
  }
  t("meta.derivation_note documents this file was derived from horizons-prefetch.json (not independently fetched)",
    typeof meta.derivation_note === "string" && meta.derivation_note.includes("horizons-prefetch.json"),
    meta.derivation_note || "");
  t("meta.source names JPL Horizons (independent reference source)",
    typeof meta.source === "string" && /horizons/i.test(meta.source),
    meta.source || "");
  t("meta.coverage_note documents the 5 pre-1800 barycenter-substituted cells",
    typeof meta.coverage_note === "string" && meta.coverage_note.length > 0);

  // ── points: count, ids, bodies, ranges ─────────────────────────────────
  const points = Array.isArray(fixture.points) ? fixture.points : [];
  t(`exactly ${EXPECTED_POINT_COUNT} reference points`,
    points.length === EXPECTED_POINT_COUNT, `got ${points.length}`);

  const seenIds = new Set();
  let notedCellCount = 0;

  for (const pt of points) {
    const idTag = `point ${JSON.stringify(pt && pt.id)}`;

    t(`${idTag}: has an integer id`, Number.isInteger(pt.id), `got ${JSON.stringify(pt.id)}`);
    if (Number.isInteger(pt.id)) seenIds.add(pt.id);

    t(`${idTag}: has a UTC instant string`,
      typeof pt.utc === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(pt.utc),
      `got ${JSON.stringify(pt.utc)}`);
    t(`${idTag}: utc parses to a valid Date`,
      typeof pt.utc === "string" && !Number.isNaN(Date.parse(pt.utc)));

    const bodies = pt.bodies || {};
    const bodyNames = Object.keys(bodies);
    t(`${idTag}: has exactly the 10 classical bodies`,
      EXPECTED_BODIES.every((b) => bodyNames.includes(b)) && bodyNames.length === EXPECTED_BODIES.length,
      `got ${JSON.stringify(bodyNames)}`);

    for (const body of EXPECTED_BODIES) {
      const b = bodies[body];
      const tag = `${idTag} / ${body}`;
      if (!b) { t(`${tag}: entry present`, false, "missing"); continue; }

      t(`${tag}: ecl_lon_deg is a finite number`, isFiniteNumber(b.ecl_lon_deg), `got ${b.ecl_lon_deg}`);
      t(`${tag}: ecl_lat_deg is a finite number`, isFiniteNumber(b.ecl_lat_deg), `got ${b.ecl_lat_deg}`);
      t(`${tag}: ecl_lat_deg in [-90, 90]`,
        isFiniteNumber(b.ecl_lat_deg) && b.ecl_lat_deg >= -90 && b.ecl_lat_deg <= 90,
        `got ${b.ecl_lat_deg}`);

      t(`${tag}: longitude_arcsec_decimal is a finite number`,
        isFiniteNumber(b.longitude_arcsec_decimal), `got ${b.longitude_arcsec_decimal}`);
      t(`${tag}: longitude_arcsec_decimal in [0, 1296000)`,
        isFiniteNumber(b.longitude_arcsec_decimal) && b.longitude_arcsec_decimal >= 0 && b.longitude_arcsec_decimal < ARCSEC_CIRCLE,
        `got ${b.longitude_arcsec_decimal}`);

      t(`${tag}: longitude_arcsec_rounded is a non-negative integer in [0, 1296000)`,
        Number.isInteger(b.longitude_arcsec_rounded) && b.longitude_arcsec_rounded >= 0 && b.longitude_arcsec_rounded < ARCSEC_CIRCLE,
        `got ${b.longitude_arcsec_rounded}`);

      // decimal and rounded arcsec must agree with ecl_lon_deg to within
      // rounding — this is a cross-consistency check, not a value re-derivation.
      if (isFiniteNumber(b.ecl_lon_deg) && isFiniteNumber(b.longitude_arcsec_decimal)) {
        const normDeg = ((b.ecl_lon_deg % 360) + 360) % 360;
        const expectedArcsecDecimal = normDeg * ARCSEC_PER_DEG;
        const diff = Math.abs(expectedArcsecDecimal - b.longitude_arcsec_decimal);
        t(`${tag}: longitude_arcsec_decimal matches ecl_lon_deg * 3600 (normalized)`,
          diff < 1e-6, `expected ${expectedArcsecDecimal}, got ${b.longitude_arcsec_decimal}, diff ${diff}`);
      }
      if (Number.isInteger(b.longitude_arcsec_rounded) && isFiniteNumber(b.longitude_arcsec_decimal)) {
        const diff = Math.abs(b.longitude_arcsec_rounded - b.longitude_arcsec_decimal);
        t(`${tag}: longitude_arcsec_rounded is within 0.5 arcsec of longitude_arcsec_decimal (mod wraparound)`,
          diff <= 0.5 || Math.abs(diff - ARCSEC_CIRCLE) <= 0.5,
          `decimal=${b.longitude_arcsec_decimal}, rounded=${b.longitude_arcsec_rounded}`);
      }

      if (typeof b.note === "string" && b.note.length > 0) {
        notedCellCount += 1;
        t(`${tag}: barycenter-substitution note is descriptive`,
          /barycenter/i.test(b.note), b.note);
      }
    }
  }

  t("point ids are unique", seenIds.size === points.length, `${seenIds.size} unique of ${points.length}`);
  t(`point ids run 1..${EXPECTED_POINT_COUNT} with no gaps`,
    Array.from({ length: EXPECTED_POINT_COUNT }, (_, i) => i + 1).every((id) => seenIds.has(id)),
    `got ${Array.from(seenIds).sort((a, b) => a - b).join(",")}`);

  t("exactly 5 body-cells carry a coverage-substitution note (the 5 pre-1800 barycenter cells)",
    notedCellCount === 5, `got ${notedCellCount}`);

  // ── stations block ───────────────────────────────────────────────────
  const stations = fixture.stations || {};
  for (const body of STATION_BODIES) {
    const s = stations[body];
    t(`stations.${body} is present`, typeof s === "object" && s !== null);
    if (!s) continue;
    t(`stations.${body}.sign_changes is a non-empty array`,
      Array.isArray(s.sign_changes) && s.sign_changes.length > 0,
      `got ${JSON.stringify(s.sign_changes)}`);
    for (const sc of s.sign_changes || []) {
      t(`stations.${body}: sign change has a 2-element "between" bracket`,
        Array.isArray(sc.between) && sc.between.length === 2,
        `got ${JSON.stringify(sc.between)}`);
      t(`stations.${body}: sign change has opposite-signed before/after speeds`,
        isFiniteNumber(sc.delta_before_deg_per_day) && isFiniteNumber(sc.delta_after_deg_per_day)
        && Math.sign(sc.delta_before_deg_per_day) !== Math.sign(sc.delta_after_deg_per_day),
        `before=${sc.delta_before_deg_per_day}, after=${sc.delta_after_deg_per_day}`);
    }
  }

  // ── spot-check: Sun at the J2000 anchor (point 11, 2000-01-01T12:00Z) ──
  {
    const j2000 = points.find((p) => p.utc === "2000-01-01T12:00:00Z");
    t("J2000 reference point (2000-01-01T12:00:00Z) is present", !!j2000);
    if (j2000) {
      const sun = (j2000.bodies || {}).Sun;
      t("J2000 point has a Sun entry", !!sun);
      if (sun) {
        const diffDeg = Math.abs(sun.ecl_lon_deg - 280.37);
        t("Sun ecliptic longitude at J2000 is within 0.02 deg of the well-known ~280.37 deg",
          diffDeg <= 0.02, `got ${sun.ecl_lon_deg} deg, diff ${diffDeg} deg`);
      }
    }
  }

  return R;
}
