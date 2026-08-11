// test/astro-ephemeris.test.js — WP-17: real ephemeris in the browser.
//
// astro.jsx contains no JSX syntax at all (verified: node --check-equivalent
// vm.Script compile succeeds unmodified) — it is a plain classic script of
// data tables + derivation functions, loaded via Babel-standalone on the HTML
// pages purely as a matter of file-extension convention. That means it can be
// evaluated UNMODIFIED via node:vm, the same "least invasive" approach
// test/cram-tools.test.js (WP-23) uses for the plain browser-global scripts,
// with a minimal `window` stub — no Babel transform needed.
//
// Two sandboxes are built: one with project/vendor/astronomy.browser.min.js
// (WP-17's vendored astronomy-engine 2.1.19 — see project/vendor/README.md)
// preloaded so `window.Astronomy` is defined before astro.jsx runs (the REAL
// path), and one without it (the SYNTHETIC / offline fallback path) — mirroring
// exactly what the HTML pages' <script> tag order does or doesn't provide.
//
// Pinned here:
//   • window.EPHEMERIS_MODE is set to "REAL"/"SYNTHETIC" unconditionally in
//     both branches (WP-19's future badge depends on this always being defined).
//   • REAL path: WP-17's own ACCEPT example — Sun ecliptic longitude at
//     2000-01-01T12:00:00Z is ~280.4deg (~10.4deg Capricorn) — using the same
//     Astronomy.GeoVector(body, time, true) -> Astronomy.Ecliptic(vec).elon
//     call project/tools/ephemeris/produce-ledger.mjs (WP-08) uses for the
//     Node ledger CLI.
//   • REAL path: for every one of the 10 classical bodies, planetSpeed()'s
//     sign and isRetrograde()'s flag are always consistent — the bug fix of
//     record (the old synthetic planetSpeed was a constant positive mean
//     rate, independent of isRetrograde()'s separate heuristic).
//   • SYNTHETIC path (no vendor loaded, or a body astronomy-engine does not
//     model — NorthNode/Chiron/Lilith): longitude values are byte-for-byte
//     unchanged from the pre-WP-17 mean-motion formula — the documented
//     offline fallback is provably untouched, not just "probably fine."
//   • Removing the vendor script still renders a full natal chart (computeNatal
//     returns a complete planet list) in SYNTHETIC mode — the second half of
//     WP-17's ACCEPT criterion.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");

const REAL_BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const SYNTHETIC_ONLY_BODIES = ["NorthNode", "Chiron", "Lilith"];

function makeSandbox({ withAstronomy }) {
  const sandbox = {};
  sandbox.window = sandbox; // top-level `window.X = ...` and bare `window` refs resolve here
  vm.createContext(sandbox);
  if (withAstronomy) {
    vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  }
  vm.runInContext(astroSrc, sandbox, { filename: "astro.jsx" });
  return sandbox;
}

// Pre-WP-17 synthetic formula, reproduced verbatim from the original
// astro.jsx (PLANET_PERIODS/PLANET_PHASE0 tables + planetLongitude body) as a
// change-detector independent of the file under test.
function preWp17SyntheticLongitude(planet, jd) {
  const PLANET_PERIODS = {
    Sun: 1.0000, Moon: 0.0748, Mercury: 0.2408, Venus: 0.6152, Mars: 1.8809,
    Jupiter: 11.8618, Saturn: 29.4571, Uranus: 84.0205, Neptune: 163.7236, Pluto: 247.9407,
    NorthNode: -18.6, Chiron: 50.42, Lilith: 8.85,
  };
  const PLANET_PHASE0 = {
    Sun: 280.46, Moon: 218.32, Mercury: 252.25, Venus: 181.98, Mars: 355.43,
    Jupiter: 34.35, Saturn: 50.08, Uranus: 314.05, Neptune: 304.35, Pluto: 238.93,
    NorthNode: 125.04, Chiron: 36.42, Lilith: 83.35,
  };
  const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
  const period = PLANET_PERIODS[planet];
  const phase0 = PLANET_PHASE0[planet] ?? 0;
  let m = phase0 + (360 / period) * yearsFromJ2000;
  m = m % 360;
  if (m < 0) m += 360;
  return m;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const real = makeSandbox({ withAstronomy: true });
  const synth = makeSandbox({ withAstronomy: false });

  // ── EPHEMERIS_MODE flag ───────────────────────────────────────────
  t("window.Astronomy is defined after loading the vendored UMD build",
    real.window.Astronomy !== undefined,
    "vendor/astronomy.browser.min.js assigns window.Astronomy via its UMD wrapper");
  t("window.EPHEMERIS_MODE === REAL when Astronomy is present",
    real.EPHEMERIS_MODE === "REAL",
    `got ${real.EPHEMERIS_MODE}`);
  t("window.Astronomy is undefined without the vendor script (offline)",
    synth.window.Astronomy === undefined,
    "no vendor script loaded into this sandbox");
  t("window.EPHEMERIS_MODE === SYNTHETIC when Astronomy is absent",
    synth.EPHEMERIS_MODE === "SYNTHETIC",
    `got ${synth.EPHEMERIS_MODE}`);

  // ── REAL path: WP-17's own ACCEPT example ─────────────────────────
  const jd2000 = real.dateToJD(new Date("2000-01-01T12:00:00Z"));
  const sunLonReal = real.planetLongitude("Sun", jd2000);
  t("REAL Sun ecliptic longitude at 2000-01-01T12:00:00Z is ~280.4deg (10.4deg Capricorn)",
    Math.abs(sunLonReal - 280.4) < 0.3,
    `got ${sunLonReal}`);

  // ── REAL path: every classical body returns an in-range longitude ─
  for (const body of REAL_BODIES) {
    const lon = real.planetLongitude(body, jd2000);
    t(`REAL ${body} longitude is a finite value in [0,360)`,
      Number.isFinite(lon) && lon >= 0 && lon < 360,
      `got ${lon}`);
  }

  // ── REAL path: speed sign and retrograde flag never disagree ─────
  for (const body of REAL_BODIES) {
    const speed = real.planetSpeed(body, jd2000);
    const retro = real.isRetrograde(body, jd2000);
    t(`REAL ${body}: planetSpeed sign matches isRetrograde flag`,
      (speed < 0) === retro,
      `speed=${speed} retrograde=${retro}`);
  }

  // Re-check speed/retrograde consistency at a second, unrelated instant to
  // rule out 2000-01-01 being a lucky coincidence (e.g. no station nearby).
  const jd2024 = real.dateToJD(new Date("2024-06-15T00:00:00Z"));
  for (const body of REAL_BODIES) {
    const speed = real.planetSpeed(body, jd2024);
    const retro = real.isRetrograde(body, jd2024);
    t(`REAL ${body} (2024-06-15): planetSpeed sign matches isRetrograde flag`,
      (speed < 0) === retro,
      `speed=${speed} retrograde=${retro}`);
  }

  // ── SYNTHETIC-only bodies: unmodeled by astronomy-engine, always
  //    synthetic even when window.Astronomy is present ──────────────
  for (const body of SYNTHETIC_ONLY_BODIES) {
    const lonWhenReal = real.planetLongitude(body, jd2000);
    const expected = preWp17SyntheticLongitude(body, jd2000);
    t(`REAL mode: ${body} still uses the synthetic formula (astronomy-engine has no Body.${body})`,
      Math.abs(lonWhenReal - expected) < 1e-9,
      `got ${lonWhenReal}, expected ${expected}`);
  }

  // ── SYNTHETIC path: byte-for-byte unchanged from the pre-WP-17 formula ─
  for (const body of [...REAL_BODIES, ...SYNTHETIC_ONLY_BODIES]) {
    const lon = synth.planetLongitude(body, jd2000);
    const expected = preWp17SyntheticLongitude(body, jd2000);
    t(`SYNTHETIC ${body} longitude matches the pre-WP-17 mean-motion formula exactly`,
      Math.abs(lon - expected) < 1e-9,
      `got ${lon}, expected ${expected}`);
  }
  t("SYNTHETIC Sun is never retrograde",
    synth.isRetrograde("Sun", jd2000) === false,
    "unchanged synthetic contract");
  t("SYNTHETIC NorthNode is always retrograde",
    synth.isRetrograde("NorthNode", jd2000) === true,
    "unchanged synthetic contract");
  t("SYNTHETIC planetSpeed(Sun) is a positive constant",
    synth.planetSpeed("Sun", jd2000) > 0,
    `got ${synth.planetSpeed("Sun", jd2000)}`);

  // ── computeNatal end-to-end in both modes (second half of the ACCEPT
  //    criterion: "removing the vendor script still renders, with SYNTHETIC
  //    mode set") ──────────────────────────────────────────────────
  const birth = { dateISO: "2000-01-01T12:00:00Z", lat: 29.4241, lng: -98.4936, sect: "auto", houseSystem: "whole" };
  const natalReal = real.computeNatal(birth);
  const natalSynth = synth.computeNatal(birth);
  t("computeNatal (REAL) returns a full planet list",
    Array.isArray(natalReal.planets) && natalReal.planets.length === 14, // 13 PLANET_ORDER + SouthNode
    `got ${Array.isArray(natalReal.planets) ? natalReal.planets.length : typeof natalReal.planets} entries`);
  t("computeNatal (SYNTHETIC, vendor 'removed') still renders a full planet list",
    Array.isArray(natalSynth.planets) && natalSynth.planets.length === 14,
    `got ${Array.isArray(natalSynth.planets) ? natalSynth.planets.length : typeof natalSynth.planets} entries`);

  const realSunEntry = natalReal.planets.find((p) => p.name === "Sun");
  t("computeNatal (REAL) Sun longitude matches the ACCEPT example",
    Math.abs(realSunEntry.lon - 280.4) < 0.3,
    `got ${realSunEntry.lon}`);
  for (const body of REAL_BODIES) {
    const p = natalReal.planets.find((pl) => pl.name === body);
    t(`computeNatal (REAL): ${body} speed/retrograde consistent end-to-end`,
      (p.speed < 0) === p.retrograde,
      `speed=${p.speed} retrograde=${p.retrograde}`);
  }

  return R;
}
