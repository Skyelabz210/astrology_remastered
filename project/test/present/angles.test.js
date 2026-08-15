// test/present/angles.test.js — the gates that were missing: ASC/MC and declination.
//
// WP-11/WP-12 built and verified tools/ephemeris/houses.js `ascMc()` against
// Swiss Ephemeris (5 charts x 9 systems, worst residual ~12.5"). It was never
// published to the browser, so every shipped chart kept using astro.jsx's own
// self-disclaimed "not a real solver" ascendant — wrong by up to ~109 deg,
// i.e. the wrong rising sign, which then seeds every house number, the sect,
// and all seven Hellenistic Lots.
//
// 4404 assertions passed over that error, before and after it was corrected,
// because the suite pinned the Ascendant only for range and self-consistency
// and never once compared it to an independent solver. houses.test.js's 794
// assertions test the module the UI did not call. This suite closes that gap:
// it asserts the SHIPPED path (astro.jsx, evaluated unmodified, in the same
// load order the pages use) agrees with the verified solver.
//
// It also pins the discriminator: the retained fallback formula must FAIL the
// same tolerance. Without that, this suite could pass on a build where the
// wiring silently regressed to the approximation.
//
// See project/docs/COMPLETION_AUDIT.md section 2.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const astroCoreModule = await import("../../src/present/astro-core.js");
const housesModule = await import("../../tools/ephemeris/houses.js");

// Mirrors the page load order: houses.js (module) publishes window.Houses
// before astro.jsx (text/babel) runs. `withHouses:false` reproduces a page
// that failed to load the module, which must fall back, not throw.
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

// Deliberately diverse: both hemispheres, a high-but-sub-polar latitude, the
// prime meridian, and the date-line side. Each is a (label, ISO, lat, lng)
// with lng EAST-positive, matching ascMc()'s documented convention.
const CHARTS = [
  ["San Antonio 1990 (suite's own fixture)", "1990-03-21T12:30:00-06:00",  29.4241,  -98.4936],
  ["London J2000",                           "2000-01-01T12:00:00Z",       51.4800,    0.0000],
  ["New York 1985",                          "1985-07-04T12:00:00-04:00",  40.7128,  -74.0060],
  ["Sydney 1971",                            "1971-11-02T19:45:00+10:00", -33.8688,  151.2093],
  ["Reykjavik 2010",                         "2010-02-14T06:15:00Z",       64.1466,  -21.9426],
  ["Quito 1999 (equator)",                   "1999-09-09T00:00:00-05:00",  -0.1807,  -78.4678],
  ["Cape Town 1962",                         "1962-05-30T08:20:00+02:00", -33.9249,   18.4241],
  ["Tokyo 2024",                             "2024-03-01T23:10:00+09:00",  35.6762,  139.6503],
];

// ascMc() and the shipped path share a timescale, so agreement should be
// exact to floating-point noise. 1e-9 deg (~3.6 microarcsec) is far tighter
// than any astronomical claim here; it is an identity check, not an accuracy
// budget. The Swiss Ephemeris accuracy claim itself is houses.test.js's job.
const IDENTITY_TOL_DEG = 1e-9;

// The fallback must miss by more than this for the discriminator to be
// meaningful. Observed spread is 26.8-108.9 deg; 1 deg is a safe floor.
const DISCRIMINATOR_MIN_DEG = 1.0;

function circDiffDeg(a, b) {
  return ((a - b) % 360 + 540) % 360 - 180;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const sandbox = makeSandbox();
  const { computeNatal, ascendantDeg, midheavenDeg } = sandbox;

  t("window.Houses is published to the shipped script",
    typeof sandbox.Houses?.ascMcFromDate === "function",
    "astro.jsx cannot reach the real solver without it");

  t("ANGLES_MODE reports REAL when houses.js is loaded",
    sandbox.ANGLES_MODE === "REAL", `got ${sandbox.ANGLES_MODE}`);

  for (const [label, dateISO, lat, lng] of CHARTS) {
    const date = new Date(dateISO);
    const ref = housesModule.ascMcFromDate(date, lat, lng);

    // 1. The shipped helper agrees with the verified solver.
    const asc = ascendantDeg(date, lat, lng);
    const dAsc = Math.abs(circDiffDeg(asc, ref.ascDeg));
    t(`${label} · ascendantDeg == ascMc`, dAsc < IDENTITY_TOL_DEG,
      `asc=${asc.toFixed(6)} ref=${ref.ascDeg.toFixed(6)} d=${dAsc.toExponential(2)}deg`);

    const mc = midheavenDeg(date, lng, lat);
    const dMc = Math.abs(circDiffDeg(mc, ref.mcDeg));
    t(`${label} · midheavenDeg == ascMc`, dMc < IDENTITY_TOL_DEG,
      `mc=${mc.toFixed(6)} ref=${ref.mcDeg.toFixed(6)} d=${dMc.toExponential(2)}deg`);

    // 2. The value that actually reaches the chart — not just the helper.
    const chart = computeNatal({ dateISO, lat, lng, houseSystem: "whole", sect: "auto" });
    t(`${label} · computeNatal ascendant == ascMc`,
      Math.abs(circDiffDeg(chart.asc, ref.ascDeg)) < IDENTITY_TOL_DEG,
      `chart.asc=${chart.asc.toFixed(6)}`);

    // 3. The rising sign — the thing a reader sees — follows the solver.
    t(`${label} · ascSignIdx follows the real ASC`,
      chart.ascSignIdx === Math.floor(ref.ascDeg / 30),
      `got ${chart.ascSignIdx}, expected ${Math.floor(ref.ascDeg / 30)}`);

    // 4. Descendant/IC stay opposite their angles.
    t(`${label} · descendant == ASC + 180`,
      Math.abs(circDiffDeg(chart.desc, ref.ascDeg + 180)) < 1e-9);
  }

  // 5. Discriminator: the retained fallback must be measurably WRONG, so a
  //    silent regression to it cannot pass this suite.
  const fallback = makeSandbox({ withHouses: false });
  t("ANGLES_MODE reports APPROX without houses.js",
    fallback.ANGLES_MODE === "APPROX", `got ${fallback.ANGLES_MODE}`);

  let worstFallbackErr = 0;
  for (const [label, dateISO, lat, lng] of CHARTS) {
    const date = new Date(dateISO);
    const ref = housesModule.ascMcFromDate(date, lat, lng);
    const err = Math.abs(circDiffDeg(fallback.ascendantDeg(date, lat, lng), ref.ascDeg));
    worstFallbackErr = Math.max(worstFallbackErr, err);
    t(`${label} · fallback ASC is detectably wrong`, err > DISCRIMINATOR_MIN_DEG,
      `err=${err.toFixed(2)}deg — if this fails the discriminator is toothless`);
  }
  t("fallback ASC error exceeds a full sign somewhere",
    worstFallbackErr > 30, `worst=${worstFallbackErr.toFixed(2)}deg`);

  // 6. A page missing the module must degrade, not crash.
  t("fallback path still produces a usable chart",
    Number.isFinite(fallback.computeNatal({
      dateISO: "2000-01-01T12:00:00Z", lat: 51.48, lng: 0,
      houseSystem: "whole", sect: "auto",
    }).asc));

  // ── Polar latitudes ────────────────────────────────────────────────────
  // houses.js ascMc() throws PolarLatitudeError above |lat| = 66.56° (a
  // correctness fix: it used to return the Descendant, a 180° error). WP-19
  // deliberately removed the ±66° entry clamp, so those latitudes ARE
  // reachable from the form — letting the throw escape would take down the
  // whole chart, including planetary positions that are perfectly valid
  // there. astro.jsx catches it and falls back; these assertions pin that a
  // polar chart still builds, that the MC stays exact anyway (it is
  // latitude-independent), and that the fallback is honestly reported.
  const POLAR = [
    ["Tromsø 69.6°N", 69.6492, 18.9553],
    ["Longyearbyen 78.2°N", 78.2232, 15.6267],
    ["McMurdo 77.8°S", -77.8419, 166.6863],
  ];
  const polarISO = "2010-02-14T06:15:00Z";
  const polarDate = new Date(polarISO);

  t("sub-polar latitude still gets the exact Ascendant",
    sandbox.ascendantIsExactAt(polarDate, 64.1466, -21.9426) === true);

  for (const [label, lat, lng] of POLAR) {
    let chart = null, threw = null;
    try {
      chart = computeNatal({ dateISO: polarISO, lat, lng, houseSystem: "whole", sect: "auto" });
    } catch (e) { threw = e; }

    t(`${label} · chart builds instead of throwing`, threw === null && chart !== null,
      threw ? `${threw.name}: ${threw.message}` : "");
    if (!chart) continue;

    t(`${label} · Ascendant is reported as NOT exact`,
      sandbox.ascendantIsExactAt(polarDate, lat, lng) === false);
    t(`${label} · Ascendant is still a finite number`, Number.isFinite(chart.asc));

    // The MC does not depend on latitude, so it must remain exact even where
    // the Ascendant cannot be computed. This is the half worth keeping.
    const mcRef = housesModule.ascMcFromDate(polarDate, 0, lng).mcDeg;
    t(`${label} · Midheaven stays exact`,
      Math.abs(circDiffDeg(chart.mc, mcRef)) < IDENTITY_TOL_DEG,
      `mc=${chart.mc.toFixed(6)} ref=${mcRef.toFixed(6)}`);

    // Planetary positions are latitude-independent and must be unaffected.
    t(`${label} · planets still computed`, chart.planets.length > 0 &&
      chart.planets.every((p) => Number.isFinite(p.lon)));
  }

  // A non-polar error must NOT be swallowed by that catch.
  {
    const boom = new Error("unrelated failure");
    const probe = makeSandbox();
    probe.Houses = { ...housesModule, ascMcFromDate: () => { throw boom; } };
    let caught = null;
    try { probe.ascendantDeg(polarDate, 40, -74); } catch (e) { caught = e; }
    t("a non-polar solver error propagates rather than silently falling back",
      caught === boom, caught ? `got ${caught.message}` : "nothing thrown");
  }

  // ── Declination / out-of-bounds ────────────────────────────────────────
  // planetDeclination() took longitude alone, implying beta = 0 for every
  // body, which caps |dec| at eps = 23.4393 deg — below the 23.45 deg
  // out-of-bounds threshold. The feature was unsatisfiable: no input of any
  // kind could produce a non-empty chart.outOfBounds. These assertions pin
  // both halves: the latitude term is now honoured, and the threshold is
  // reachable. See docs/COMPLETION_AUDIT.md section 3, item 2.
  const { planetDeclination } = sandbox;

  t("beta = 0 reduces to the classic on-ecliptic form",
    Math.abs(planetDeclination(90, 0) - 23.4393) < 1e-9,
    `got ${planetDeclination(90, 0)}`);
  t("omitted latitude still means beta = 0 (back-compatible)",
    planetDeclination(90) === planetDeclination(90, 0));
  t("positive ecliptic latitude raises declination past the obliquity",
    planetDeclination(90, 5) > 23.4393,
    `got ${planetDeclination(90, 5)}`);
  t("declination is odd under (lambda, beta) -> (lambda+180, -beta)",
    Math.abs(planetDeclination(90, 5) + planetDeclination(270, -5)) < 1e-9);

  // The Moon at a major lunar standstill is the textbook out-of-bounds case:
  // its orbit is inclined ~5.1 deg to the ecliptic, so |dec| reaches ~28.7
  // deg. 2006-09 is such an epoch. If this ever returns empty again, the
  // latitude term has been dropped and the feature is dead once more.
  const standstill = computeNatal({
    dateISO: "2006-09-15T00:00:00Z", lat: 40, lng: -74,
    houseSystem: "whole", sect: "auto",
  });
  const moonDec = standstill.planets.find((p) => p.name === "Moon").declination;
  t("Moon exceeds the obliquity at a major standstill",
    Math.abs(moonDec) > 23.45, `dec=${moonDec.toFixed(3)}deg`);
  t("Moon's standstill declination is within the physical ~28.8deg bound",
    Math.abs(moonDec) < 28.8, `dec=${moonDec.toFixed(3)}deg`);
  t("chart.outOfBounds is reachable at all",
    standstill.outOfBounds.length > 0,
    `outOfBounds=${JSON.stringify(standstill.outOfBounds)}`);
  t("out-of-bounds rows name the body",
    standstill.outOfBounds.every((o) => typeof o.planet === "string" && o.planet.length > 0));
  t("the Moon is the body flagged at this instant",
    standstill.outOfBounds.some((o) => o.planet === "Moon"));

  // Bodies genuinely on the ecliptic must NOT be swept in by the change.
  t("Sun is never out of bounds (it defines the ecliptic)",
    !standstill.outOfBounds.some((o) => o.planet === "Sun"));

  return rows;
}
