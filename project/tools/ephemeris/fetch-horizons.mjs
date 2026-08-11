#!/usr/bin/env node
// project/tools/ephemeris/fetch-horizons.mjs — WP-09: regeneration path for
// project/test/fixtures/reference-vectors.json.
//
// Lives under project/tools/ (Mandate A1: astronomy-engine-adjacent tooling,
// floats, Date, fetch, etc. are all legal here — forbidden only under
// project/src/core/).
//
// ── What this is ──────────────────────────────────────────────────────────
// A real, runnable Node script that queries the JPL Horizons API directly
// (https://ssd.jpl.nasa.gov/api/horizons.api) for the same 20 UTC instants ×
// 10 classical bodies documented in project/test/fixtures/horizons-prefetch.json's
// `meta` block, and regenerates project/test/fixtures/reference-vectors.json
// FROM SCRATCH — i.e. this is the "re-fetch from the independent source" path
// that project/test/fixtures.test.js and WP-10's accuracy/retrograde suites
// ultimately depend on, as opposed to the one-off local transform that turned
// the already-committed horizons-prefetch.json into reference-vectors.json.
//
// It is NOT run in CI (network access to an external API is exactly what CI
// jobs must not depend on for a deterministic pass/fail) — see
// project/docs/EXECUTION_PLAN.md WP-09. Run it by hand, with network access,
// when the reference vectors need to be regenerated (e.g. a new reference
// point is added, or a discrepancy with horizons-prefetch.json needs
// independent re-verification).
//
// ── Output choice: writes reference-vectors.json directly ──────────────────
// The brief allows either regenerating horizons-prefetch.json or
// reference-vectors.json directly; this script writes reference-vectors.json
// directly (not an intermediate horizons-prefetch.json) because that is the
// file WP-10's accuracy/retrograde suites and fixtures.test.js actually
// consume, and because the transform step (degrees -> arcsec, provenance
// propagation) is simple enough to inline here rather than requiring a
// second, uncommitted script to bridge the two files. If a raw
// horizons-prefetch.json-shaped snapshot is wanted for archival/diffing
// purposes, pass --raw-out <path> (see below) — the fully parsed Horizons
// response is written there in the same shape as the original prefetch file
// before the arcsec transform is applied.
//
// ── Query pattern (matches horizons-prefetch.json's meta block) ────────────
//   COMMAND      = per-body Horizons target code (see BODY_COMMANDS below)
//   CENTER       = '500@399'   (geocentric, Earth body center)
//   MAKE_EPHEM   = YES
//   EPHEM_TYPE   = OBSERVER
//   QUANTITIES   = '31'        (ObsEcLon / ObsEcLat: observer-centered
//                                IAU76/80 ecliptic-of-date apparent position —
//                                light-time, gravitational deflection, and
//                                stellar aberration all included; airless)
//   ANG_FORMAT   = DEG
//   CAL_FORMAT   = CAL (default) — Horizons prints "Mixed Julian/Gregorian"
//                  calendar dates by default, which is fine for every point
//                  in this matrix (the earliest, 1700-03-20, already falls in
//                  the Gregorian era for all countries whose local calendar
//                  matters here) — see horizons-prefetch.json's calendar_note.
//   format       = text
//   START_TIME / STOP_TIME / STEP_SIZE — Horizons has no "single instant"
//                  mode; this script requests a 1-minute window
//                  (START_TIME = the target instant truncated to the minute,
//                  STOP_TIME = START_TIME + 1 minute, STEP_SIZE = '1m') and
//                  reads the FIRST row of the $$SOE/$$EOE ephemeris block,
//                  which Horizons always emits at exactly START_TIME.
//
// Response parsing: the ephemeris table is delimited by literal "$$SOE" and
// "$$EOE" marker lines; each data line between them is whitespace-separated
// "<Mon>-<D> <HH:MM>  <ObsEcLon>  <ObsEcLat>" (e.g.
// " 2000-Jan-01 12:00     280.3689092   0.0002381"); columns 3 and 4 (0-based
// index 2 and 3 after splitting on whitespace, once the two date/time tokens
// are counted) are the longitude/latitude in degrees. This was verified
// against a live query during development of this script (see
// project/docs/EXECUTION_STATUS.md WP-09 entry for whether it was possible to
// execute this script end-to-end in the environment that authored it).
//
// ── Pre-1800 barycenter fallback ────────────────────────────────────────────
// Horizons has no planet-CENTER ephemeris before certain dates for the outer
// planets (Saturn: before 1749-12-30; Neptune: before 1800-01-01; Pluto:
// before 1800-01-02) — see horizons-prefetch.json's coverage_note. For any
// requested instant before a body's cutoff, this script automatically
// substitutes that body's system BARYCENTER command (Saturn: 6, Neptune: 8,
// Pluto: 9) instead of the planet-center command, and records a `note` on
// that body's fixture entry documenting the substitution (offset from planet
// center is negligible, <0.1 arcsec, at these distances).
//
// ── Usage ────────────────────────────────────────────────────────────────
//   node tools/ephemeris/fetch-horizons.mjs
//     Queries all 20 points x 10 bodies, writes
//     test/fixtures/reference-vectors.json (overwriting it).
//
//   node tools/ephemeris/fetch-horizons.mjs --points 9,11 --bodies Sun,Moon
//     Restricts the run to a subset — useful for spot-checking without
//     hammering the live API with all 200 queries.
//
//   node tools/ephemeris/fetch-horizons.mjs --out other-file.json
//     Writes somewhere other than the default reference-vectors.json path.
//
//   node tools/ephemeris/fetch-horizons.mjs --dry-run
//     Prints the query plan (URLs it would fetch) without making any network
//     calls — useful for reviewing the request shape offline.
//
// Between requests this script sleeps DELAY_MS (default 300ms) to stay well
// under any reasonable rate limit for the public Horizons API; 200 requests
// at that pace take roughly 1-2 minutes on top of network latency.

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const DELAY_MS = 300;
const ARCSEC_PER_DEG = 3600;
const ARCSEC_CIRCLE = 1296000;

// ── the 20-point matrix (WP-09 brief, EXECUTION_PLAN.md), matching
//    horizons-prefetch.json's `points` ids exactly ──────────────────────────
export const POINTS = [
  { id: 1, utc: "1700-03-20T12:00:00Z", lat: 48.85, lng: 2.35, label: "Paris — large-ΔT regime, century boundary" },
  { id: 2, utc: "1800-01-01T00:00:00Z", lat: 51.5, lng: -0.13, label: "London — century, ΔT ≈ 13.7s" },
  { id: 3, utc: "1900-02-28T23:00:00Z", lat: 41.9, lng: 12.5, label: "Rome — non-leap century year" },
  { id: 4, utc: "1912-04-15T05:00:00Z", lat: 41.7, lng: -49.9, label: "N. Atlantic — free ocean lat/lng" },
  { id: 5, utc: "1941-12-07T18:00:00Z", lat: 21.3, lng: -157.86, label: "Honolulu — pre-modern-tzdb offsets" },
  { id: 6, utc: "1955-06-15T12:00:00Z", lat: -0.18, lng: -78.47, label: "Quito — equator, ΔT plateau" },
  { id: 7, utc: "1969-07-20T20:17:00Z", lat: 28.4, lng: -80.6, label: "Cape Canaveral — pre-leap-second UTC era" },
  { id: 8, utc: "1972-06-30T23:59:00Z", lat: -33.87, lng: 151.21, label: "Sydney — first leap second, southern hemisphere" },
  { id: 9, utc: "1987-04-10T19:21:00Z", lat: 51.48, lng: 0.0, label: "Greenwich — Meeus GMST worked example" },
  { id: 10, utc: "1996-02-29T12:00:00Z", lat: 35.68, lng: 139.69, label: "Tokyo — leap day, no-DST zone" },
  { id: 11, utc: "2000-01-01T12:00:00Z", lat: 51.48, lng: 0.0, label: "Greenwich — J2000 anchor" },
  { id: 12, utc: "2000-02-29T06:00:00Z", lat: -1.29, lng: 36.82, label: "Nairobi — 400-rule century leap day" },
  { id: 13, utc: "2004-06-08T08:20:00Z", lat: 78.22, lng: 15.63, label: "Longyearbyen — polar (Placidus-undefined path)" },
  { id: 14, utc: "2015-06-30T23:59:00Z", lat: -54.8, lng: -68.3, label: "Ushuaia — leap-second adjacency, far south" },
  { id: 15, utc: "2021-03-14T07:30:00Z", lat: 40.71, lng: -74.01, label: "New York — pairs with nonexistent local 02:30 EDT" },
  { id: 16, utc: "2021-11-07T05:30:00Z", lat: 40.71, lng: -74.01, label: "New York — pairs with ambiguous local 01:30" },
  { id: 17, utc: "2023-04-21T00:00:00Z", lat: 64.15, lng: -21.94, label: "Reykjavík — Mercury station; high-lat non-polar" },
  { id: 18, utc: "2022-10-30T13:26:00Z", lat: 52.52, lng: 13.4, label: "Berlin — Mars station + EU DST transition day" },
  { id: 19, utc: "2023-07-22T01:00:00Z", lat: 69.65, lng: 18.96, label: "Tromsø — Venus station; above polar circle" },
  { id: 20, utc: "2050-01-01T00:00:00Z", lat: 29.42, lng: -98.49, label: "San Antonio — extrapolated ΔT, future date" },
];

// ── Horizons COMMAND codes, geocentric observer quantity 31 ────────────────
export const BODY_COMMANDS = {
  Sun: "10",
  Moon: "301",
  Mercury: "199",
  Venus: "299",
  Mars: "499",
  Jupiter: "599",
  Saturn: "699",
  Uranus: "799",
  Neptune: "899",
  Pluto: "999",
};

// Pre-planet-ephemeris cutoffs -> system-barycenter fallback command.
// These are the EXACT instants Horizons itself reports (queried live during
// development of this script: "No ephemeris for target <X> prior to A.D.
// <cutoff> UT") — a full day later than the calendar-date-only cutoffs a
// naive reading of horizons-prefetch.json's coverage_note might suggest
// (e.g. Neptune's ephemeris does not actually start until 1800-01-01
// 23:59:41 UT, so the 1800-01-01T00:00:00Z reference instant itself still
// needs the barycenter fallback).
const BARYCENTER_FALLBACK = {
  Saturn: { command: "6", cutoff: "1749-12-30T23:59:43Z" },
  Neptune: { command: "8", cutoff: "1800-01-01T23:59:42Z" },
  Pluto: { command: "9", cutoff: "1800-01-02T23:59:42Z" },
};

export const DEFAULT_BODIES = Object.keys(BODY_COMMANDS);

// Stations carried over verbatim from horizons-prefetch.json (this script
// does not re-derive station brackets; they are documented, dated
// day-by-day scans already committed and unlikely to need re-fetching
// unless the underlying sign-change dates themselves are challenged).
const STATIONS = {
  Mercury: {
    range_utc: ["2023-04-14", "2023-05-22"],
    step: "1 d",
    sign_changes: [
      { between: ["2023-04-21", "2023-04-22"], kind: "prograde->retrograde (retrograde station)", delta_before_deg_per_day: 0.0849509, delta_after_deg_per_day: -0.0137213 },
      { between: ["2023-05-15", "2023-05-16"], kind: "retrograde->prograde (direct station)", delta_before_deg_per_day: -0.0489277, delta_after_deg_per_day: 0.0279834 },
    ],
    n_days: 39,
  },
  Mars: {
    range_utc: ["2022-10-23", "2023-01-19"],
    step: "1 d",
    sign_changes: [
      { between: ["2022-10-31", "2022-11-01"], kind: "prograde->retrograde (retrograde station)", delta_before_deg_per_day: 0.0008504, delta_after_deg_per_day: -0.013545 },
      { between: ["2023-01-13", "2023-01-14"], kind: "retrograde->prograde (direct station)", delta_before_deg_per_day: -0.0047911, delta_after_deg_per_day: 0.0080121 },
    ],
    n_days: 89,
  },
  Venus: {
    range_utc: ["2023-07-15", "2023-07-29"],
    step: "1 d",
    sign_changes: [
      { between: ["2023-07-23", "2023-07-24"], kind: "prograde->retrograde (retrograde station)", delta_before_deg_per_day: 0.0216971, delta_after_deg_per_day: -0.0169262 },
    ],
    n_days: 15,
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundHalfAwayFromZero(x) {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}

function normalizeDeg(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Truncate an ISO UTC instant to minute precision, Horizons "YYYY-MM-DDTHH:MM" form. */
function toMinuteIso(utc) {
  return utc.slice(0, 16); // "1700-03-20T12:00:00Z" -> "1700-03-20T12:00"
}

function addOneMinuteIso(minuteIso) {
  const d = new Date(`${minuteIso}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  return d.toISOString().slice(0, 16);
}

/** Pick the Horizons COMMAND for a body at a given instant, applying the
 * pre-planet-ephemeris barycenter fallback where needed. Returns
 * { command, substituted, note } */
function commandFor(body, utc) {
  const planetCommand = BODY_COMMANDS[body];
  if (!planetCommand) throw new Error(`fetch-horizons: unknown body "${body}"`);
  const fb = BARYCENTER_FALLBACK[body];
  if (fb && Date.parse(utc) < Date.parse(fb.cutoff)) {
    return {
      command: fb.command,
      substituted: true,
      note:
        `planet-center ephemeris unavailable in Horizons before ${fb.cutoff}; ` +
        `value is ${body} Barycenter (${fb.command}) (offset from planet center ` +
        `is negligible at this distance, <0.1 arcsec)`,
    };
  }
  return { command: planetCommand, substituted: false, note: null };
}

function buildUrl({ command, startMinuteIso, stopMinuteIso }) {
  const params = new URLSearchParams({
    format: "text",
    COMMAND: `'${command}'`,
    CENTER: "'500@399'",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    QUANTITIES: "'31'",
    ANG_FORMAT: "DEG",
    START_TIME: `'${startMinuteIso}'`,
    STOP_TIME: `'${stopMinuteIso}'`,
    STEP_SIZE: "'1m'",
  });
  return `${HORIZONS_API}?${params.toString()}`;
}

/** Parse the $$SOE/$$EOE block's first data row into {lonDeg, latDeg}. */
export function parseHorizonsFirstRow(text) {
  const soe = text.indexOf("$$SOE");
  const eoe = text.indexOf("$$EOE");
  if (soe === -1 || eoe === -1 || eoe < soe) {
    throw new Error("fetch-horizons: could not find $$SOE/$$EOE ephemeris block in response");
  }
  const block = text.slice(soe + "$$SOE".length, eoe).trim();
  const firstLine = block.split("\n")[0];
  if (!firstLine) throw new Error("fetch-horizons: $$SOE/$$EOE block was empty");
  const fields = firstLine.trim().split(/\s+/);
  // Expected: ["2000-Jan-01", "12:00", "280.3689092", "0.0002381"]
  if (fields.length < 4) {
    throw new Error(`fetch-horizons: unexpected ephemeris row shape: "${firstLine}"`);
  }
  const lonDeg = Number(fields[fields.length - 2]);
  const latDeg = Number(fields[fields.length - 1]);
  if (!Number.isFinite(lonDeg) || !Number.isFinite(latDeg)) {
    throw new Error(`fetch-horizons: could not parse lon/lat from row: "${firstLine}"`);
  }
  return { lonDeg, latDeg };
}

// Horizons queries for far-past instants (this matrix reaches back to 1700)
// take noticeably longer to compute server-side than queries near the
// present; observed during development of this script, deep-past requests
// occasionally exceeded an intermediate proxy's timeout and came back as a
// transient HTTP 503 ("upstream connect error ... connection timeout") even
// though the same query succeeded on a retry a few seconds later. Retry with
// backoff rather than treating a single 503/network error as fatal.
const RETRY_DELAYS_MS = [2000, 5000, 10000];

async function fetchOne({ body, utc }) {
  const { command, substituted, note } = commandFor(body, utc);
  const startMinuteIso = toMinuteIso(utc);
  const stopMinuteIso = addOneMinuteIso(startMinuteIso);
  const url = buildUrl({ command, startMinuteIso, stopMinuteIso });

  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch-horizons: HTTP ${res.status} for ${body} @ ${utc} (${url})`);
      const text = await res.text();
      const { lonDeg, latDeg } = parseHorizonsFirstRow(text);
      return { lonDeg, latDeg, substituted, note, url };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastErr;
}

function parseArgs(argv) {
  const args = {
    points: null,
    bodies: null,
    out: null,
    dryRun: false,
    rawOut: null,
    delayMs: DELAY_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--points":
        args.points = new Set(String(argv[++i]).split(",").map((s) => Number(s.trim())));
        break;
      case "--bodies":
        args.bodies = String(argv[++i]).split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--out": args.out = argv[++i]; break;
      case "--raw-out": args.rawOut = argv[++i]; break;
      case "--dry-run": args.dryRun = true; break;
      case "--delay-ms": args.delayMs = Number(argv[++i]); break;
      default:
        throw new Error(`fetch-horizons: unknown argument "${a}"`);
    }
  }
  return args;
}

function defaultOutPath() {
  // project/tools/ephemeris/fetch-horizons.mjs -> project/test/fixtures/reference-vectors.json
  return new URL("../../test/fixtures/reference-vectors.json", import.meta.url).pathname;
}

export async function regenerate({ points = POINTS, bodies = DEFAULT_BODIES, dryRun = false, delayMs = DELAY_MS, log = () => {} } = {}) {
  const rawPoints = [];
  const outPoints = [];

  for (const pt of points) {
    const rawBodies = {};
    const outBodies = {};
    for (const body of bodies) {
      if (dryRun) {
        const { command, substituted } = commandFor(body, pt.utc);
        const startMinuteIso = toMinuteIso(pt.utc);
        const stopMinuteIso = addOneMinuteIso(startMinuteIso);
        const url = buildUrl({ command, startMinuteIso, stopMinuteIso });
        log(`[dry-run] point ${pt.id} ${body}${substituted ? " (barycenter fallback)" : ""}: ${url}`);
        continue;
      }
      const { lonDeg, latDeg, substituted, note } = await fetchOne({ body, utc: pt.utc });
      log(`point ${pt.id} (${pt.utc}) ${body}: lon=${lonDeg} lat=${latDeg}${substituted ? " [barycenter]" : ""}`);

      rawBodies[body] = note ? { ecl_lon_deg: lonDeg, ecl_lat_deg: latDeg, note } : { ecl_lon_deg: lonDeg, ecl_lat_deg: latDeg };

      const lonDegNorm = normalizeDeg(lonDeg);
      const lonArcsecDecimal = lonDegNorm * ARCSEC_PER_DEG;
      const lonArcsecRounded = ((roundHalfAwayFromZero(lonArcsecDecimal) % ARCSEC_CIRCLE) + ARCSEC_CIRCLE) % ARCSEC_CIRCLE;
      outBodies[body] = {
        ecl_lon_deg: lonDeg,
        ecl_lat_deg: latDeg,
        longitude_arcsec_decimal: lonArcsecDecimal,
        longitude_arcsec_rounded: lonArcsecRounded,
        ...(note ? { note } : {}),
      };

      await sleep(delayMs);
    }
    if (dryRun) continue;
    rawPoints.push({ id: pt.id, utc: pt.utc, bodies: rawBodies });
    outPoints.push({ id: pt.id, utc: pt.utc, bodies: outBodies });
  }

  if (dryRun) return { dryRun: true };

  const today = new Date().toISOString().slice(0, 10);

  const referenceVectors = {
    meta: {
      derived_from: "JPL Horizons API (direct re-fetch, not from horizons-prefetch.json)",
      derived_date: today,
      derivation_note:
        "Regenerated from scratch by project/tools/ephemeris/fetch-horizons.mjs " +
        "querying the live JPL Horizons API for each of the 20 points x " +
        `${bodies.length} bodies (COMMAND per body, CENTER=500@399 geocentric, ` +
        "QUANTITIES=31 ObsEcLon/ObsEcLat, format=text; see this script's header " +
        "comment for the full query pattern). longitude_arcsec_decimal = " +
        "ecl_lon_deg normalized to [0,360) then multiplied by 3600 (full float " +
        "precision, not rounded, for a meaningful ~60 arcsec tolerance " +
        "comparison in WP-10's accuracy gate); longitude_arcsec_rounded is the " +
        "nearest integer arcsec (round-half-away-from-zero, matching " +
        "produce-ledger.mjs's own rounding convention).",
      source: "JPL Horizons API",
      retrieved: today,
      ephemeris: "current default Horizons ephemeris at time of fetch (see raw response's {source: ...} tag per body; was DE441 as of the original 2026-08-10 prefetch this script's fixture format matches)",
      quantities: "31 (ObsEcLon, ObsEcLat)",
      center: "500@399 geocentric",
      calendar_note: "Calendar mode: Mixed Julian/Gregorian (earliest instant 1700 is Gregorian-era, so plain dates are fine)",
      frame_note: "ObsEcLon/ObsEcLat are observer-centered IAU76/80 ecliptic-of-date apparent positions (light-time, gravitational deflection, stellar aberration); airless (Atmos refraction: NO)",
      coverage_note: "Horizons planet-center ephemerides begin 1749-12-30 (Saturn 699), 1800-01-01 (Neptune 899), 1800-01-02 (Pluto 999); points before those cutoffs automatically substitute the system barycenter (COMMAND 6/8/9), marked with a per-body note.",
    },
    points: outPoints,
    stations: STATIONS,
  };

  return { referenceVectors, rawPoints };
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

async function main(argv) {
  const args = parseArgs(argv);
  const points = args.points ? POINTS.filter((p) => args.points.has(p.id)) : POINTS;
  const bodies = args.bodies || DEFAULT_BODIES;
  const outPath = args.out || defaultOutPath();

  if (args.dryRun) {
    await regenerate({ points, bodies, dryRun: true, log: (m) => console.log(m) });
    return;
  }

  console.error(`fetch-horizons: querying ${points.length} points x ${bodies.length} bodies = ${points.length * bodies.length} requests (delay ${args.delayMs}ms between requests)...`);
  const { referenceVectors, rawPoints } = await regenerate({ points, bodies, delayMs: args.delayMs, log: (m) => console.error(`  ${m}`) });

  writeFileSync(outPath, `${JSON.stringify(referenceVectors, null, 2)}\n`, "utf8");
  console.error(`fetch-horizons: wrote ${outPath}`);

  if (args.rawOut) {
    const rawSnapshot = { meta: referenceVectors.meta, points: rawPoints, stations: STATIONS };
    writeFileSync(args.rawOut, `${JSON.stringify(rawSnapshot, null, 2)}\n`, "utf8");
    console.error(`fetch-horizons: wrote raw snapshot ${args.rawOut}`);
  }
}

if (isMain()) {
  try {
    await main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
