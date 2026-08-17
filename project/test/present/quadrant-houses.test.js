// test/present/quadrant-houses.test.js — the other unwired capability.
//
// docs/COMPLETION_AUDIT.md §4 flagged: "Quadrant houses unreachable. The
// picker offers Whole/Equal only; the 9 verified cusp solvers are
// Node-only." tools/ephemeris/houses.js had a real, Swiss-Ephemeris-cross-
// checked cusp function for each of Placidus/Koch/Regiomontanus/Campanus/
// Alcabitius/Topocentric/Meridian/Morinus since WP-11/WP-12 — the same
// pattern as the Ascendant fix in angles.test.js, just for house PLACEMENT
// instead of the angle itself. Nothing in astro.jsx ever called them, and
// app.jsx's house-system picker only ever offered two of ten options.
//
// This suite pins the wiring astro.jsx now does: astro-core.js's new
// houseForCusps() generalizes the existing houseForSign()/houseForLongEqual()
// pattern to an arbitrary (non-uniform) 12-cusp array, houses.js's new
// quadrantCuspsFromDate() dispatches to the right solver by system key, and
// computeNatal() routes every house-placement call site through both,
// falling back to Whole exactly per POLAR_FALLBACK_POLICY when the real
// solver declines (polar latitude) or is unavailable (offline).

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { houseForCusps } from "../../src/present/astro-core.js";
import { SWISSEPH_REFERENCE } from "../houses.test.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const astroCoreModule = await import("../../src/present/astro-core.js");
const housesModule = await import("../../tools/ephemeris/houses.js");

function makeSandbox({ withHouses = true } = {}) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.AstroCore = astroCoreModule;
  if (withHouses) sandbox.Houses = housesModule;
  vm.createContext(sandbox);
  vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  vm.runInContext(astroSrc, sandbox, { filename: "astro.jsx" });
  return sandbox;
}

// The 8 systems astro.jsx's QUADRANT_HOUSE_SYSTEMS declares, matching
// houses.js's QUADRANT_CUSP_FNS and POLAR_FALLBACK_POLICY exactly. Porphyry
// is deliberately excluded from this set — see astro.jsx's own comment on
// QUADRANT_HOUSE_SYSTEMS for why (it belongs to the exact-core/registry
// track, a different admissibility class from these 8 "LEDGER" systems).
const QUADRANT_SYSTEMS = [
  "placidus", "koch", "regiomontanus", "campanus",
  "alcabitius", "topocentric", "meridian", "morinus",
];

// Meridian and Morinus have no latitude dependence at all
// (POLAR_FALLBACK_POLICY: enforced "none"); the other 6 are "hard" and
// throw PolarLatitudeError beyond ~66.56 deg.
const HARD_POLAR_SYSTEMS = new Set([
  "placidus", "koch", "regiomontanus", "campanus", "alcabitius", "topocentric",
]);

const FIXTURE_BIRTH = {
  dateISO: "1990-03-21T12:30:00-06:00", lat: 29.4241, lng: -98.4936, sect: "auto",
};

function circDiffDeg(a, b) {
  return ((a - b) % 360 + 540) % 360 - 180;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── houseForCusps() itself — the generic placement primitive ──────────
  {
    // Degenerate case: uniform 30 deg cusps starting at 0 must reduce
    // exactly to the existing houseForSign()/houseForLongEqual() result.
    const uniform = Array.from({ length: 12 }, (_, i) => i * 30);
    let uniformOk = true;
    for (let lon = 0; lon < 360; lon += 11) {
      if (houseForCusps(lon, uniform) !== Math.floor(lon / 30) + 1) uniformOk = false;
    }
    t("houseForCusps on uniform 30deg cusps matches equal-house exactly", uniformOk);

    // A point exactly on a cusp belongs to the house that cusp opens.
    let boundaryOk = true;
    for (let i = 0; i < 12; i++) if (houseForCusps(uniform[i], uniform) !== i + 1) boundaryOk = false;
    t("a point exactly on a cusp belongs to the house it opens", boundaryOk);

    // Non-uniform (quadrant-shaped) cusps, spot-checked at each arc's midpoint.
    const nonUniform = [10, 40, 75, 100, 130, 160, 190, 220, 255, 280, 310, 350];
    let nonUniformOk = true;
    for (let i = 0; i < 12; i++) {
      const arc = (nonUniform[(i + 1) % 12] - nonUniform[i] + 360) % 360;
      const mid = (nonUniform[i] + arc / 2) % 360;
      if (houseForCusps(mid, nonUniform) !== i + 1) nonUniformOk = false;
    }
    t("non-uniform cusp midpoints land in the correct house", nonUniformOk);

    // Wraparound: house 12 straddles the 350->10 deg seam.
    t("wraparound: a point past 350deg falls in the pre-seam house",
      houseForCusps(355, nonUniform) === 12);
    t("wraparound: a point past 0deg still falls in the same house",
      houseForCusps(5, nonUniform) === 12);
  }

  // ── the dispatcher reproduces the already-verified Swiss cusps ────────
  // houses.test.js's SWISSEPH_REFERENCE is genuine swe.houses() output.
  // quadrantCuspsFromDate() is a thin JD-conversion wrapper around the same
  // cusp functions houses.test.js already cross-checked to <=30", so this
  // is an end-to-end wiring check, not a re-derivation of that accuracy claim.
  {
    const TOLERANCE_ARCSEC = 30;
    let worst = 0;
    let comparisons = 0;
    for (const [label, chart] of Object.entries(SWISSEPH_REFERENCE)) {
      const date = new Date(chart.iso);
      for (const sys of QUADRANT_SYSTEMS) {
        const ref = chart.systems[sys];
        if (!ref) continue;
        const got = housesModule.quadrantCuspsFromDate(sys, date, chart.latDeg, chart.lngDeg);
        for (let i = 0; i < 12; i++) {
          const diffArcsec = Math.abs(circDiffDeg(got[i], ref[i])) * 3600;
          worst = Math.max(worst, diffArcsec);
          comparisons++;
          t(`${label}/${sys} cusp ${i + 1} matches swisseph within ${TOLERANCE_ARCSEC}"`,
            diffArcsec <= TOLERANCE_ARCSEC,
            `diff=${diffArcsec.toFixed(3)}"`);
        }
      }
    }
    t(`quadrantCuspsFromDate: worst residual across ${comparisons} comparisons stays inside ${TOLERANCE_ARCSEC}"`,
      worst <= TOLERANCE_ARCSEC, `worst=${worst.toFixed(3)}"`);
  }

  // ── the shipped path: computeNatal() actually uses it ─────────────────
  const sandbox = makeSandbox();
  const { computeNatal } = sandbox;

  for (const sys of [...QUADRANT_SYSTEMS, "whole", "equal"]) {
    const chart = computeNatal({ ...FIXTURE_BIRTH, houseSystem: sys });
    t(`${sys}: houseSystemActual matches the request at a non-polar latitude`,
      chart.houseSystemActual === sys, `got ${chart.houseSystemActual}`);
    const wantsCusps = QUADRANT_SYSTEMS.includes(sys);
    t(`${sys}: houseCusps is ${wantsCusps ? "present" : "null"} as expected`,
      wantsCusps ? Array.isArray(chart.houseCusps) && chart.houseCusps.length === 12
                 : chart.houseCusps === null);
    t(`${sys}: every planet gets a house 1-12`,
      chart.planets.every((p) => Number.isInteger(p.house) && p.house >= 1 && p.house <= 12),
      JSON.stringify(chart.planets.map((p) => p.house)));
  }

  // A quadrant chart's house numbers must actually differ from Whole's
  // somewhere — otherwise the wiring could be silently falling through to
  // the old behavior while still reporting houseSystemActual correctly.
  {
    const wholeChart = computeNatal({ ...FIXTURE_BIRTH, houseSystem: "whole" });
    const placidusChart = computeNatal({ ...FIXTURE_BIRTH, houseSystem: "placidus" });
    const anyDiffer = wholeChart.planets.some((p, i) => p.house !== placidusChart.planets[i].house);
    t("Placidus house placements differ from Whole's for this fixture chart",
      anyDiffer, "if this fails, the dispatcher is a no-op");
  }

  // ── polar fallback: hard systems degrade, none crash ───────────────────
  const POLAR = { dateISO: "2010-02-14T06:15:00Z", lat: 69.6492, lng: 18.9553, sect: "auto" };

  for (const sys of QUADRANT_SYSTEMS) {
    let chart = null, threw = null;
    try { chart = computeNatal({ ...POLAR, houseSystem: sys }); } catch (e) { threw = e; }
    t(`${sys} at 69.6N: computeNatal does not throw`,
      threw === null && chart !== null, threw ? `${threw.name}: ${threw.message}` : "");
    if (!chart) continue;

    if (HARD_POLAR_SYSTEMS.has(sys)) {
      t(`${sys} at 69.6N: falls back to Whole per POLAR_FALLBACK_POLICY`,
        chart.houseSystemActual === "whole", `got ${chart.houseSystemActual}`);
      t(`${sys} at 69.6N: houseCusps is null on fallback`, chart.houseCusps === null);
      t(`${sys} at 69.6N: fallback house numbers match plain Whole exactly`,
        chart.planets.every((p, i) => p.house === computeNatal({ ...POLAR, houseSystem: "whole" }).planets[i].house));
    } else {
      // Meridian / Morinus: no latitude dependence, so no fallback here.
      t(`${sys} at 69.6N: does NOT fall back (POLAR_FALLBACK_POLICY: enforced "none")`,
        chart.houseSystemActual === sys, `got ${chart.houseSystemActual}`);
      t(`${sys} at 69.6N: houseCusps is still a real 12-cusp array`,
        Array.isArray(chart.houseCusps) && chart.houseCusps.length === 12);
    }
  }

  // ── the diagnostic getter agrees with the fallback it predicts ────────
  for (const sys of QUADRANT_SYSTEMS) {
    const nonPolar = sandbox.quadrantHousesAvailableAt(sys, new Date(FIXTURE_BIRTH.dateISO), FIXTURE_BIRTH.lat, FIXTURE_BIRTH.lng);
    t(`quadrantHousesAvailableAt(${sys}, non-polar) = true`, nonPolar === true);
    const polar = sandbox.quadrantHousesAvailableAt(sys, new Date(POLAR.dateISO), POLAR.lat, POLAR.lng);
    const expectPolarAvailable = !HARD_POLAR_SYSTEMS.has(sys);
    t(`quadrantHousesAvailableAt(${sys}, polar) = ${expectPolarAvailable}`,
      polar === expectPolarAvailable, `got ${polar}`);
  }

  // ── offline fallback: a page missing houses.js degrades, not crashes ──
  const offline = makeSandbox({ withHouses: false });
  for (const sys of ["placidus", "meridian"]) {
    const chart = offline.computeNatal({ ...FIXTURE_BIRTH, houseSystem: sys });
    t(`${sys} with window.Houses missing: falls back to Whole`,
      chart.houseSystemActual === "whole", `got ${chart.houseSystemActual}`);
    t(`${sys} with window.Houses missing: houseCusps is null`, chart.houseCusps === null);
  }

  // ── a non-polar solver error must NOT be swallowed by the fallback ────
  {
    const boom = new Error("unrelated failure");
    const probe = makeSandbox();
    probe.Houses = { ...housesModule, quadrantCuspsFromDate: () => { throw boom; } };
    let caught = null;
    try { probe.computeNatal({ ...FIXTURE_BIRTH, houseSystem: "placidus" }); } catch (e) { caught = e; }
    t("a non-polar solver error propagates rather than silently falling back",
      caught === boom, caught ? `got ${caught.message}` : "nothing thrown");
  }

  // ── the UI picker offers every system the backend can now honor ───────
  // TweakRadio's option list lives in app.jsx (not evaluated here — it's a
  // classic <script> with JSX and no exports), so this is a structural
  // cross-check: read the option `value`s back out of the source text and
  // assert they match astro.jsx's QUADRANT_HOUSE_SYSTEMS exactly, so the
  // two cannot silently drift apart again.
  {
    const appSrc = readFileSync(join(ROOT, "app.jsx"), "utf8");
    const start = appSrc.indexOf('label="House system"');
    const end = appSrc.indexOf("setTweak('houseSystem'", start);
    const block = appSrc.slice(start, end);
    const offered = [...block.matchAll(/value:\s*'([a-z]+)'/g)].map((m) => m[1]);
    const expected = ["whole", "equal", ...QUADRANT_SYSTEMS];
    t("app.jsx's house-system picker offers exactly whole+equal+8 quadrant systems",
      expected.every((v) => offered.includes(v)) && offered.length === expected.length,
      `offered=${JSON.stringify(offered)}`);
  }

  return rows;
}
