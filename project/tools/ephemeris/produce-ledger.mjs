#!/usr/bin/env node
// project/tools/ephemeris/produce-ledger.mjs — WP-08: ledger producer CLI.
//
// Lives under project/tools/ (Mandate A1: astronomy-engine, floats, Math.*,
// Date, etc. are legal here — they are forbidden only under project/src/core/;
// see project/tools/README.md for the boundary rule this module sits behind).
//
// Usage:
//   node tools/ephemeris/produce-ledger.mjs --time 1994-01-11T14:30:00Z \
//     --lat 29.4241 --lng -98.4936 [--bodies Sun,Moon,Mercury,...] [--out file.json]
//
// Emits a JSON array of entries conforming to
// project/src/ledger/ephemeris-ledger-schema.json (v1, plus the additive
// `meta` block this package adds to the schema) — each one admissible to
// project/src/ledger/import-ledger.js's validateLedgerEntry()/admitForCore().
//
// ── Time handling: astronomy-engine's own AstroTime, not tools/ephemeris/
//    timescale.js ────────────────────────────────────────────────────────
// timescale.js (WP-07) is a from-scratch implementation of the published
// Espenak-Meeus ΔT polynomial, GMST/GAST, and IAU2006 obliquity formulas.
// astronomy-engine's `AstroTime` computes its own JD(TT) internally (via
// `AstroTime.tt`, "days since J2000 in Terrestrial Time"), using — per its
// own source (astronomy.d.ts, and DeltaT_EspenakMeeus in astronomy.js) —
// the *same* Espenak & Meeus polynomial timescale.js implements. Since every
// longitude in this file is computed by handing an AstroTime straight to
// GeoVector()/Ecliptic() (astronomy-engine's own internal machinery), using
// AstroTime's own `.tt`/`.ut` for this file's `jd_tt`/`delta_t_seconds`
// meta fields keeps those numbers *exactly* consistent with the position
// that was actually computed — two independent ΔT evaluations (this file's
// and timescale.js's) could differ at the sub-second level and make the
// reported jd_tt subtly inconsistent with the longitude next to it. So:
// timescale.js is not imported here. (WP-11's houses.js, which needs GAST
// for ASC/MC and does not call into astronomy-engine, is where timescale.js
// is the right tool.)
//
// ── Longitude convention: geocentric apparent ecliptic-of-date ───────────
// For every body (including the Moon) this file calls
//   Astronomy.Ecliptic(Astronomy.GeoVector(body, time, /*aberration*/ true))
// .elon — GeoVector() returns a geocentric J2000-equatorial (EQJ) vector,
// always corrected for light-travel time (the position is "back-dated" to
// when the light left the body) and, with aberration=true, corrected for
// the observer's (Earth's) motion. Ecliptic() then rotates that vector into
// the *true* ecliptic-of-date frame (ECT) — i.e. precession AND nutation of
// Earth's axis as of the requested instant are applied by astronomy-engine's
// own nutation model. `.elon` is the resulting ecliptic longitude in
// degrees, [0, 360). This is uniform across all 10 classical bodies: for
// Body.Moon, GeoVector() internally calls GeoMoon() (ELP2000-based lunar
// theory), which is astronomy-engine's own recommended path for a geocentric
// Moon vector consistent with the other bodies' GeoVector() call.
//
// `--lat`/`--lng` are the observer's location. They are NOT used in the
// longitude computation above — geocentric quantities are, by definition,
// independent of the observer's position on Earth's surface. They are
// accepted (and range-validated) because (a) the CLI contract requires them,
// (b) they are folded into each entry's checksum and certificate notes for
// provenance, and (c) a topocentric/house-cusp consumer (WP-11/13) will need
// them threaded through the same CLI surface later.
//
// ── Speed / retrograde ─────────────────────────────────────────────────
// Central difference over a 12-hour window (t-6h, t+6h): the two longitudes
// are differenced with wraparound handled (shortest signed arc, i.e. into
// (-180, 180]) and divided by 0.5 days to get degrees/day, then rounded to
// the nearest integer arcsecond/day for the ledger's `meta.speed_arcsec_per_day`
// string. `meta.retrograde` is derived from *that rounded integer's* sign
// (not the raw float) specifically so the flag is always exactly consistent
// with the string sitting next to it in the same entry — the invariant
// project/test/producer.test.js checks.
//
// ── Checksum ───────────────────────────────────────────────────────────
// `source.checksum` is sha256 (hex) of the pipe-joined string
//   "<astronomy-engine version>|<canonical ISO instant>|<lat>|<lng>|<body>|<longitude_arcsec>"
// i.e. a checksum over the *inputs that determine this entry's admitted
// integer value* (plus the tool identity/version), not over the entry's own
// JSON serialization. This makes the checksum independently reproducible by
// anyone holding just those five plain values, and — because it is a
// function of longitude_arcsec itself — it changes if the emitted value is
// tampered with after the fact, without requiring a canonical-JSON
// serialization step (which the ledger schema does not otherwise specify).
//
// ── House cusps (WP-13) ────────────────────────────────────────────────
// `--houses <system1,system2,...>` additionally emits ASC/MC/CUSP_1..
// CUSP_12 entries per requested house system id (the "LEDGER"-status ids
// in src/core/variants.js's HOUSE_SYSTEMS: placidus, koch, regiomontanus,
// campanus, alcabitius, topocentric, morinus, meridian). Unlike the planet
// path above, house cusps need GAST and mean obliquity at the requested
// instant, which is exactly what tools/ephemeris/timescale.js's
// julianDayUTC()/ttFromUtc() supply to houses.js's ascMc()/*Cusps()
// functions (this is the "houses.js needs GAST ... timescale.js is the
// right tool" case flagged in the header note above) — so, unlike the
// planet path, this one *does* import timescale.js. astronomy-engine is
// not involved in the house-cusp computation at all.
//
// ASC/MC are system-independent (ascMc() is called once per requested
// instant/observer) but are still emitted ONCE PER REQUESTED SYSTEM, each
// copy tagged with that system's `house_system` id — so filtering the
// ledger by a single house_system id yields a complete, self-contained
// 14-entry chart (ASC, MC, CUSP_1..12) for that system without needing to
// also fetch a separate untagged ASC/MC pair. The tradeoff (documented
// here, not hidden) is duplicate ASC/MC longitude values across systems
// when `--houses` names more than one system; this was chosen over a
// single untagged ASC/MC pair because "one system id → one complete,
// independently-filterable chart" is a simpler contract for downstream
// consumers than "look up ASC/MC separately, without a house_system tag,
// then join it against whichever *Cusps entries you also fetched."
//
// checksumFor()'s payload (see above) is body/longitude-keyed but has no
// house_system slot, so house entries use a parallel checksumForHouse()
// that folds house_system into the payload too — otherwise e.g.
// placidus's ASC entry and koch's ASC entry (same isoTime/lat/lng/body
// "ASC"/longitude_arcsec, since ASC is system-independent) would hash to
// the *same* checksum despite being two distinct ledger entries
// (different event_id, different house_system) — a correct but confusing
// coincidence this avoids by construction.
//
// PolarLatitudeError handling: if a requested system's cusp function
// throws at the given latitude (Placidus/Koch/Alcabitius, |lat| >
// 66.56°), that system is SKIPPED with a console.error warning and the
// run continues with the remaining requested systems, rather than failing
// the whole CLI invocation. Rationale: this CLI is meant to be usable as
// a batch producer over many charts/systems in one run (see WP-08's own
// header on this file's role); one polar chart failing one iterative
// system it mathematically cannot support (a real, documented domain
// limit — see houses.js's PolarLatitudeError class comment — not a bug)
// should not discard every other system's valid output for that same
// chart, nor abort a batch's remaining charts. Callers who need
// fail-fast-on-any-gap semantics can inspect stderr (each skip is logged
// there) or re-request just that system to observe the throw directly via
// produceHouseLedgerEntries()/houses.js.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as Astronomy from "astronomy-engine";
import {
  ascMc,
  placidusCusps,
  kochCusps,
  regiomontanusCusps,
  campanusCusps,
  alcabitiusCusps,
  topocentricCusps,
  morinusCusps,
  meridianCusps,
  PolarLatitudeError,
} from "./houses.js";
import { julianDayUTC, ttFromUtc } from "./timescale.js";

export const DEFAULT_BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

const ARCSEC_CIRCLE = 1296000;
const ARCSEC_PER_DEG = 3600;
const ASTRONOMY_ENGINE_VERSION = "2.1.19"; // pinned in project/package.json

// ── small numeric helpers (floats are legal in project/tools/) ───────────

function roundHalfAwayFromZero(x) {
  return x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5);
}

/** Wrap an integer arcsecond count into [0, 1296000). */
function normalizeArcsec(n) {
  let x = n % ARCSEC_CIRCLE;
  if (x < 0) x += ARCSEC_CIRCLE;
  return x;
}

/** Signed shortest arc a-b, wrapped into (-180, 180], in degrees. */
function circularDiffDeg(a, b) {
  let d = (a - b) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

function requireFiniteNumber(raw, fieldName, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`produce-ledger: --${fieldName} must be a finite number, got "${raw}"`);
  if (n < min || n > max) throw new Error(`produce-ledger: --${fieldName} must be in [${min}, ${max}], got ${n}`);
  return n;
}

function eclipticLongitudeDeg(bodyEnum, astroTime) {
  const vec = Astronomy.GeoVector(bodyEnum, astroTime, true); // aberration on
  return Astronomy.Ecliptic(vec).elon;
}

function checksumFor({ isoTime, lat, lng, body, longitudeArcsecStr }) {
  const payload = `${ASTRONOMY_ENGINE_VERSION}|${isoTime}|${lat}|${lng}|${body}|${longitudeArcsecStr}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// ── house cusps (WP-13) ───────────────────────────────────────────────

// The "LEDGER"-status quadrant systems from src/core/variants.js's
// HOUSE_SYSTEMS registry (ids matched exactly — snake_case where the
// registry uses it, none of these eight happen to need it). The five
// "exact"/"PROVEN" systems in that registry (whole_sign, equal_asc,
// equal_mc, vehlow, porphyry) are computed directly by the exact integer
// core and are deliberately NOT offered here — this CLI's job is only the
// systems that are *not* computable by the exact core and so must reach
// it through the ledger contract (see variants.js's comment on why those
// eight are ledger-gated).
const HOUSE_SYSTEM_FNS = {
  placidus: placidusCusps,
  koch: kochCusps,
  regiomontanus: regiomontanusCusps,
  campanus: campanusCusps,
  alcabitius: alcabitiusCusps,
  topocentric: topocentricCusps,
  morinus: morinusCusps,
  meridian: meridianCusps,
};

const HOUSES_SOURCE_KIND = "hcrm-house-solver";
// Not a third-party pinned dependency (unlike astronomy-engine), so there
// is no upstream version number to pin — this names the two in-repo
// modules that jointly determine the computed value instead.
const HOUSES_SOURCE_NAME = "houses.js+timescale.js";

function cuspBodyName(i) {
  return `CUSP_${i + 1}`;
}

// See the "House cusps (WP-13)" header note above for why this payload
// includes houseSystem (checksumFor()'s planet-path payload does not).
function checksumForHouse({ isoTime, lat, lng, houseSystem, body, longitudeArcsecStr }) {
  const payload = `${HOUSES_SOURCE_NAME}|${isoTime}|${lat}|${lng}|${houseSystem}|${body}|${longitudeArcsecStr}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Compute schema-conformant ASC/MC/CUSP_1..CUSP_12 ledger entries for the
 * given instant/observer, for each requested house system.
 *
 * @param {object} opts
 * @param {string|Date} opts.time - ISO-8601 UTC instant (or a Date).
 * @param {number|string} opts.lat - observer latitude, degrees, [-90, 90].
 * @param {number|string} opts.lng - observer longitude, degrees, [-180, 180].
 * @param {string[]} opts.systems - house system ids, keys of HOUSE_SYSTEM_FNS
 *   (e.g. "placidus"). Non-empty; unknown ids throw.
 * @returns {object[]} array of ledger entries — see file header for shape
 *   and the "House cusps (WP-13)" note for the one-copy-per-system,
 *   house_system-tagged ASC/MC convention. A system whose cusp function
 *   throws PolarLatitudeError at this latitude is skipped (console.error
 *   warning, run continues) rather than aborting the whole call.
 */
export function produceHouseLedgerEntries({ time, lat, lng, systems }) {
  if (time === undefined || time === null || time === "")
    throw new Error("produce-ledger: --time is required (ISO-8601 UTC instant)");
  if (!Array.isArray(systems) || systems.length === 0)
    throw new Error("produce-ledger: --houses must name at least one house system");

  const latNum = requireFiniteNumber(lat, "lat", -90, 90);
  const lngNum = requireFiniteNumber(lng, "lng", -180, 180);

  for (const sys of systems) {
    if (!Object.prototype.hasOwnProperty.call(HOUSE_SYSTEM_FNS, sys))
      throw new Error(
        `produce-ledger: unknown house system "${sys}" (known: ${Object.keys(HOUSE_SYSTEM_FNS).join(", ")})`
      );
  }

  let t0;
  try {
    t0 = Astronomy.MakeTime(new Date(time));
  } catch (err) {
    throw new Error(`produce-ledger: could not parse --time "${time}": ${err.message}`, { cause: err });
  }
  if (Number.isNaN(t0.ut)) throw new Error(`produce-ledger: --time "${time}" is not a valid timestamp`);
  const isoTime = t0.date.toISOString();

  const jdUt1 = julianDayUTC(isoTime);
  const jdTt = ttFromUtc(jdUt1);
  const deltaTSeconds = (jdTt - jdUt1) * 86400;

  const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, latNum, lngNum);

  const entries = [];
  for (const sys of systems) {
    const fn = HOUSE_SYSTEM_FNS[sys];
    let cusps;
    try {
      cusps = fn(jdUt1, jdTt, latNum, lngNum);
    } catch (err) {
      if (err instanceof PolarLatitudeError) {
        console.error(`produce-ledger: skipping house system "${sys}" at lat=${latNum} — ${err.message}`);
        continue;
      }
      throw err;
    }

    const points = [["ASC", ascDeg], ["MC", mcDeg]];
    for (let i = 0; i < 12; i++) points.push([cuspBodyName(i), cusps[i]]);

    for (const [body, deg] of points) {
      const arcsec = normalizeArcsec(roundHalfAwayFromZero(deg * ARCSEC_PER_DEG));
      const longitudeArcsecStr = String(arcsec);
      const checksum = checksumForHouse({ isoTime, lat: latNum, lng: lngNum, houseSystem: sys, body, longitudeArcsecStr });

      entries.push({
        ledger_version: "hcrm-ephemeris-ledger-v1",
        event_id: `${isoTime}#${sys}#${body}`,
        body,
        house_system: sys,
        longitude_arcsec: longitudeArcsecStr,
        source: {
          kind: HOUSES_SOURCE_KIND,
          name: HOUSES_SOURCE_NAME,
          checksum,
        },
        certificate: {
          status: "IMPORTED_INTEGER_LEDGER",
          notes:
            `${sys} house cusp (project/tools/ephemeris/houses.js, mean-obliquity/GAST ` +
            `timescale from timescale.js); observer lat=${latNum} lng=${lngNum}`,
        },
        meta: {
          jd_tt: jdTt,
          delta_t_seconds: deltaTSeconds,
        },
      });
    }
  }
  return entries;
}

// ── core function — importable directly by tests, no subprocess needed ───

/**
 * Compute schema-conformant ledger entries for the given instant/observer.
 *
 * @param {object} opts
 * @param {string|Date} opts.time - ISO-8601 UTC instant (or a Date).
 * @param {number|string} opts.lat - observer latitude, degrees, [-90, 90].
 * @param {number|string} opts.lng - observer longitude, degrees, [-180, 180].
 * @param {string[]} [opts.bodies] - body names (Astronomy.Body keys); default
 *   is the 10 classical bodies (DEFAULT_BODIES).
 * @returns {object[]} array of ledger entries (see file header for shape).
 */
export function produceLedgerEntries({ time, lat, lng, bodies = DEFAULT_BODIES }) {
  if (time === undefined || time === null || time === "")
    throw new Error("produce-ledger: --time is required (ISO-8601 UTC instant)");
  if (!Array.isArray(bodies) || bodies.length === 0)
    throw new Error("produce-ledger: bodies must be a non-empty list");

  const latNum = requireFiniteNumber(lat, "lat", -90, 90);
  const lngNum = requireFiniteNumber(lng, "lng", -180, 180);

  let t0;
  try {
    t0 = Astronomy.MakeTime(new Date(time));
  } catch (err) {
    throw new Error(`produce-ledger: could not parse --time "${time}": ${err.message}`, { cause: err });
  }
  if (Number.isNaN(t0.ut)) throw new Error(`produce-ledger: --time "${time}" is not a valid timestamp`);

  const isoTime = t0.date.toISOString(); // canonical form, used in event_id + checksum
  const tMinus = t0.AddDays(-0.25); // -6h
  const tPlus = t0.AddDays(0.25);   // +6h

  const jdTt = 2451545.0 + t0.tt;
  const deltaTSeconds = (t0.tt - t0.ut) * 86400;

  const entries = [];
  for (const body of bodies) {
    if (!Object.prototype.hasOwnProperty.call(Astronomy.Body, body) || body === "SSB" || body === "EMB")
      throw new Error(`produce-ledger: unknown body "${body}"`);
    const bodyEnum = Astronomy.Body[body];

    const lon0 = eclipticLongitudeDeg(bodyEnum, t0);
    const lonMinus = eclipticLongitudeDeg(bodyEnum, tMinus);
    const lonPlus = eclipticLongitudeDeg(bodyEnum, tPlus);

    const speedDegPerDay = circularDiffDeg(lonPlus, lonMinus) / 0.5; // 12h span = 0.5 day
    const speedArcsecPerDay = roundHalfAwayFromZero(speedDegPerDay * ARCSEC_PER_DEG);
    const retrograde = speedArcsecPerDay < 0;

    const arcsec = normalizeArcsec(roundHalfAwayFromZero(lon0 * ARCSEC_PER_DEG));
    const longitudeArcsecStr = String(arcsec);

    const checksum = checksumFor({ isoTime, lat: latNum, lng: lngNum, body, longitudeArcsecStr });

    entries.push({
      ledger_version: "hcrm-ephemeris-ledger-v1",
      event_id: `${isoTime}#${body}`,
      body,
      longitude_arcsec: longitudeArcsecStr,
      source: {
        kind: "astronomy-engine",
        name: ASTRONOMY_ENGINE_VERSION,
        checksum,
      },
      certificate: {
        status: "IMPORTED_INTEGER_LEDGER",
        notes:
          `geocentric apparent ecliptic-of-date longitude (aberration on, ` +
          `astronomy-engine ${ASTRONOMY_ENGINE_VERSION} GeoVector+Ecliptic); ` +
          `observer lat=${latNum} lng=${lngNum} (not used in this geocentric ` +
          `computation; carried for provenance and future topocentric consumers)`,
      },
      meta: {
        jd_tt: jdTt,
        delta_t_seconds: deltaTSeconds,
        speed_arcsec_per_day: String(speedArcsecPerDay),
        retrograde,
      },
    });
  }
  return entries;
}

// ── CLI wrapper ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { time: undefined, lat: undefined, lng: undefined, bodies: DEFAULT_BODIES.slice(), houses: [], out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--time": args.time = argv[++i]; break;
      case "--lat": args.lat = argv[++i]; break;
      case "--lng": args.lng = argv[++i]; break;
      case "--bodies":
        args.bodies = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--houses":
        args.houses = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--out": args.out = argv[++i]; break;
      default:
        throw new Error(`produce-ledger: unknown argument "${a}"`);
    }
  }
  if (args.time === undefined) throw new Error("produce-ledger: --time is required");
  if (args.lat === undefined) throw new Error("produce-ledger: --lat is required");
  if (args.lng === undefined) throw new Error("produce-ledger: --lng is required");
  return args;
}

export function main(argv) {
  const args = parseArgs(argv);
  const entries = produceLedgerEntries(args);
  if (args.houses.length > 0) {
    entries.push(...produceHouseLedgerEntries({ time: args.time, lat: args.lat, lng: args.lng, systems: args.houses }));
  }
  const json = JSON.stringify(entries, null, 2);
  if (args.out) {
    writeFileSync(args.out, `${json}\n`, "utf8");
  } else {
    console.log(json);
  }
  return entries;
}

// Only run as a CLI when this file is the process entry point — importing it
// (as project/test/producer.test.js does, to call produceLedgerEntries()
// in-process) must not parse argv or print anything.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
