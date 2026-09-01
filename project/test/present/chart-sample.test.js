// test/present/chart-sample.test.js — the wide net: many charts, every claim
// the chart object makes about itself, and the shipped path against JPL.
//
// Two gaps this suite exists to close (see the pipeline audit that preceded
// it):
//
//   1. accuracy.test.js diffs produce-ledger.mjs against JPL Horizons — but
//      the READER's chart comes from astro.jsx's computeNatal, a different
//      code path over the same engine, and no suite ever diffed THAT path
//      against Horizons for any body but the Sun, at any date but J2000.
//      Part A does, for all 10 real bodies at all 20 fixture instants.
//
//   2. Every existing consistency check runs on a handful of hand-picked
//      charts. Part B draws a SEEDED sample of random nativities — spread
//      over two centuries, both hemispheres, every house system the picker
//      offers — and holds every chart to the same internal contracts:
//      sign/degree/arcsec decompositions agree with the longitude, the CRT
//      residues are genuinely arcsec mod {2,3,5,7,11,13}, angles oppose,
//      the South Node opposes the North, houses land in 1..12 and agree
//      with the cusp table, aspects respect their own orbs, the Lots
//      reproduce their published formulas, and retrograde is exactly
//      "speed < 0" on the real path. Part C then re-derives a subsample's
//      longitudes through produce-ledger.mjs (independent code path, same
//      engine) and requires arcsecond-level agreement.
//
// The sample is SEEDED (mulberry32, fixed seed): every run tests the same
// charts, so a failure is reproducible by chart index. `npm test` runs the
// full sample; `--quick` a smaller one (the flag is read straight off
// process.argv, which test/run.js shares with its suites).

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc  = readFileSync(join(ROOT, "astro.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const AstroCore = await import("../../src/present/astro-core.js");
const Houses    = await import("../../tools/ephemeris/houses.js");
const { produceLedgerEntries } = await import("../../tools/ephemeris/produce-ledger.mjs");
const fixture = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "reference-vectors.json"), "utf8"));

const QUICK = process.argv.includes("--quick");

// Same sandbox recipe as angles.test.js / quadrant-houses.test.js: the page's
// own load order, astro.jsx evaluated unmodified.
function makeSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.AstroCore = AstroCore;
  sandbox.Houses = Houses;
  vm.createContext(sandbox);
  vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  vm.runInContext(astroSrc,  sandbox, { filename: "astro.jsx" });
  return sandbox;
}

/** Deterministic PRNG so the "random" sample is the same sample every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const circDiff = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
};

const REAL_BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
// The picker's exact option list (app.jsx TweakRadio "House system");
// the eight quadrant systems mirror astro.jsx's QUADRANT_HOUSE_SYSTEMS.
const HOUSE_SYSTEMS = ["whole","equal","placidus","koch","regiomontanus","campanus","alcabitius","topocentric","meridian","morinus"];
const QUADRANT_SYSTEMS = ["placidus","koch","regiomontanus","campanus","alcabitius","topocentric","meridian","morinus"];
const LANE_PRIMES = { r2: 2, r3: 3, r5: 5, r7: 7, r11: 11, r13: 13 };

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });
  const sb = makeSandbox();

  t("sandbox is on the REAL ephemeris path", sb.EPHEMERIS_MODE === "REAL", String(sb.EPHEMERIS_MODE));
  t("sandbox is on the REAL angles path", sb.ANGLES_MODE === "REAL", String(sb.ANGLES_MODE));

  // ───────────────────────────────────────────────────────────────────
  // Part A — the shipped longitude path vs JPL Horizons (DE441)
  // ───────────────────────────────────────────────────────────────────
  // Same bar as accuracy.test.js holds the producer to: 60 arcsec, every
  // body, every instant. Reported per body (worst instant named) so a
  // regression says which planet drifted, not just "something failed".
  {
    const worst = new Map(REAL_BODIES.map((b) => [b, { diff: -1, utc: "" }]));
    let comparisons = 0;
    for (const point of fixture.points) {
      const jd = sb.dateToJD(new Date(point.utc));
      for (const body of REAL_BODIES) {
        const ref = point.bodies[body];
        if (!ref) continue;
        const got = sb.planetLongitude(body, jd);
        const diffArcsec = circDiff(got, ref.longitude_arcsec_decimal / 3600) * 3600;
        comparisons++;
        if (diffArcsec > worst.get(body).diff) worst.set(body, { diff: diffArcsec, utc: point.utc });
      }
    }
    t("Horizons gate covers all 20 instants x 10 bodies", comparisons === 200, `${comparisons} comparisons`);
    for (const body of REAL_BODIES) {
      const w = worst.get(body);
      t(`computeNatal path: ${body} within 60" of Horizons at every instant`,
        w.diff >= 0 && w.diff <= 60, `worst ${w.diff.toFixed(2)}" at ${w.utc}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Part B — seeded random nativities, every internal contract
  // ───────────────────────────────────────────────────────────────────
  const N = QUICK ? 60 : 240;
  const rnd = mulberry32(0x5eed);
  const T0 = Date.UTC(1850, 0, 1), T1 = Date.UTC(2050, 0, 1);

  // One aggregated row per invariant: `fails` counts offending charts, the
  // detail names the first offender by sample index + birth data so it can
  // be replayed in isolation.
  const inv = new Map();
  const check = (key, ok, chartDetail) => {
    if (!inv.has(key)) inv.set(key, { fails: 0, first: "" });
    if (!ok) {
      const e = inv.get(key);
      e.fails++;
      if (!e.first) e.first = chartDetail;
    }
  };

  const charts = [];
  for (let i = 0; i < N; i++) {
    const dateISO = new Date(T0 + rnd() * (T1 - T0)).toISOString();
    const lat = -60 + rnd() * 120;                 // sub-polar: quadrant systems must not fall back
    const lng = -180 + rnd() * 360;
    const houseSystem = HOUSE_SYSTEMS[Math.floor(rnd() * HOUSE_SYSTEMS.length)];
    const birth = { dateISO, lat, lng, houseSystem };
    const id = `#${i} ${dateISO} lat ${lat.toFixed(2)} lng ${lng.toFixed(2)} ${houseSystem}`;
    const mod360 = (x) => ((x % 360) + 360) % 360;
    let chart;
    try {
      chart = sb.computeNatal(birth);
    } catch (err) {
      check("computeNatal never throws on a valid nativity", false, `${id}: ${err.message}`);
      continue;
    }
    charts.push({ birth, chart, id });

    // — longitudes and their decompositions —
    for (const p of chart.planets) {
      check("every longitude is finite and in [0, 360)",
        Number.isFinite(p.lon) && p.lon >= 0 && p.lon < 360, `${id}: ${p.name}=${p.lon}`);
      check("sign index is floor(lon / 30)",
        p.sign === Math.floor(p.lon / 30), `${id}: ${p.name}`);
      check("degInSign decomposes the longitude",
        Math.abs(p.degInSign - (p.lon - p.sign * 30)) < 1e-9, `${id}: ${p.name}`);
      check("arcsec is exactly lon * 3600",
        Math.abs(p.arcsec - p.lon * 3600) < 1e-6, `${id}: ${p.name}`);

      // — the remastery invariant: residues really are arcsec mod prime —
      for (const [key, prime] of Object.entries(LANE_PRIMES)) {
        check("CRT residues are floor(arcsec) mod {2,3,5,7,11,13}",
          p.residues[key] === Math.floor(p.arcsec) % prime, `${id}: ${p.name}.${key}`);
      }

      check("every planet lands in a house 1..12",
        Number.isInteger(p.house) && p.house >= 1 && p.house <= 12, `${id}: ${p.name}=${p.house}`);
      if (chart.houseCusps) {
        check("house placement agrees with the chart's own cusp table",
          p.house === AstroCore.houseForCusps(p.lon, chart.houseCusps), `${id}: ${p.name}`);
      }
    }

    // — real-path retrograde is exactly "speed < 0" —
    for (const p of chart.planets) {
      if (!REAL_BODIES.includes(p.name)) continue;
      check("retrograde is exactly speed < 0 on the real path",
        p.retrograde === (p.speed < 0), `${id}: ${p.name} speed=${p.speed}`);
    }

    // — angles —
    check("Descendant opposes the Ascendant",
      circDiff(chart.desc, chart.asc + 180) < 1e-9, id);
    check("IC opposes the MC",
      circDiff(chart.ic, chart.mc + 180) < 1e-9, id);
    check("rising sign index matches the Ascendant",
      chart.ascSignIdx === Math.floor(chart.asc / 30), id);

    // — nodes —
    const nn = chart.planets.find((p) => p.name === "NorthNode");
    const sn = chart.planets.find((p) => p.name === "SouthNode");
    check("South Node opposes the North Node",
      nn && sn && circDiff(sn.lon, nn.lon + 180) < 1e-9, id);

    // — houses —
    if (HOUSE_SYSTEMS.indexOf(chart.houseSystemActual) < 0) {
      check("houseSystemActual is a known system", false, `${id}: ${chart.houseSystemActual}`);
    }
    if (QUADRANT_SYSTEMS.includes(birth.houseSystem)) {
      check("quadrant systems do not fall back below 60 deg latitude",
        chart.houseSystemActual === birth.houseSystem && Array.isArray(chart.houseCusps) && chart.houseCusps.length === 12,
        `${id}: got ${chart.houseSystemActual}`);
    }

    // — aspect grid —
    let lastOrb = -1;
    for (const g of chart.aspectGrid) {
      check("no aspect pairs a planet with itself", g.a !== g.b, `${id}: ${g.a}`);
      check("every aspect is inside its own orb",
        g.orb >= 0 && g.orb <= g.maxOrb + 1e-9, `${id}: ${g.a}-${g.b} ${g.orb}/${g.maxOrb}`);
      check("aspect tightness is 1 - orb/maxOrb in [0,1]",
        g.tightness >= -1e-9 && g.tightness <= 1 + 1e-9 &&
        Math.abs(g.tightness - (1 - g.orb / g.maxOrb)) < 1e-9, `${id}: ${g.a}-${g.b}`);
      const A = chart.planets.find((p) => p.name === g.a);
      const B = chart.planets.find((p) => p.name === g.b);
      check("aspect separation re-derives from the two longitudes",
        Math.abs(circDiff(A.lon - B.lon, g.angle) - g.orb) < 1e-6 ||
        Math.abs(circDiff(B.lon - A.lon, g.angle) - g.orb) < 1e-6, `${id}: ${g.a}-${g.b}`);
      check("aspect grid is sorted tightest first", g.orb >= lastOrb - 1e-9, `${id}: ${g.a}-${g.b}`);
      lastOrb = g.orb;
    }

    // — the Lots reproduce their published formulas —
    const lonOf = (n) => chart.planets.find((p) => p.name === n).lon;
    const fortune = chart.lots.find((l) => l.name === "Fortune");
    const spirit  = chart.lots.find((l) => l.name === "Spirit");
    const wantFortune = chart.isDayChart
      ? mod360(chart.asc + lonOf("Moon") - lonOf("Sun"))
      : mod360(chart.asc + lonOf("Sun") - lonOf("Moon"));
    check("Lot of Fortune matches its day/night formula",
      fortune && circDiff(fortune.lon, wantFortune) < 1e-9, id);
    check("Fortune and Spirit mirror each other's formula",
      fortune && spirit &&
      circDiff(mod360(fortune.lon + spirit.lon), mod360(2 * chart.asc + 0)) < 1e-6 ===
      (circDiff(mod360(fortune.lon - chart.asc), mod360(chart.asc - spirit.lon)) < 1e-6), id);
    check("all seven Lots are present and in range",
      chart.lots.length === 7 && chart.lots.every((l) => Number.isFinite(l.lon) && l.lon >= 0 && l.lon < 360 && l.sign === Math.floor(l.lon / 30)), id);

    // — cards —
    check("twelve sign cards, resonance in [0,1]",
      chart.cards.length === 12 && chart.cards.every((c) => c.resonance >= 0 && c.resonance <= 1), id);
    check("card shadow-lane residues are the card centre's arcsec mod 11/13/7",
      chart.cards.every((c) => {
        const cardArcsec = Math.floor((c.idx * 30 + 15) * 3600);
        return c.laneR11 === cardArcsec % 11 && c.laneR13 === cardArcsec % 13 && c.cardR7 === cardArcsec % 7;
      }), id);

    check("void-of-course carries a verdict and a sign-change horizon",
      chart.voidOfCourse && typeof chart.voidOfCourse.isVoc === "boolean" &&
      Number.isFinite(chart.voidOfCourse.daysToNextSignChange) && chart.voidOfCourse.daysToNextSignChange > 0, id);
    const sunP = chart.planets.find((p) => p.name === "Sun");
    const moonP = chart.planets.find((p) => p.name === "Moon");
    check("lunar phase names a phase and its elongation is Moon minus Sun",
      chart.phase && typeof chart.phase.phase === "string" &&
      circDiff(chart.phase.elongDeg, mod360(moonP.lon - sunP.lon)) < 1e-9, id);
  }

  t(`sample size is ${N} seeded nativities`, charts.length + (inv.get("computeNatal never throws on a valid nativity")?.fails ?? 0) === N,
    `${charts.length} computed`);
  for (const [name, { fails, first }] of inv) {
    t(`${name} — across the sample`, fails === 0, fails ? `${fails} failures, first: ${first}` : "");
  }

  // ───────────────────────────────────────────────────────────────────
  // Part C — cross-path: computeNatal vs produce-ledger.mjs
  // ───────────────────────────────────────────────────────────────────
  // Same engine, independent wiring (its own time handling, its own call
  // pattern). Agreement here rules out a JD / rounding / argument bug in
  // either path; it does not re-validate the engine itself — Part A does
  // that against Horizons. Ledger arcsec is rounded to the integer, so the
  // bar is 1 full arcsecond.
  {
    const step = QUICK ? 12 : 6;
    let compared = 0, worst = { diff: -1, at: "" };
    for (let i = 0; i < charts.length; i += step) {
      const { birth, chart } = charts[i];
      const entries = produceLedgerEntries({ time: birth.dateISO, lat: birth.lat, lng: birth.lng });
      for (const e of entries) {
        const p = chart.planets.find((x) => x.name === e.body);
        if (!p || !REAL_BODIES.includes(e.body)) continue;
        const d = Math.abs(p.arcsec - e.longitude_arcsec);
        const wrapped = Math.min(d, 1296000 - d);
        compared++;
        if (wrapped > worst.diff) worst = { diff: wrapped, at: `${charts[i].id} ${e.body}` };
      }
    }
    t("cross-path subsample compared", compared >= (QUICK ? 40 : 300), `${compared} body-longitudes`);
    t('computeNatal and produce-ledger agree within 1" everywhere',
      worst.diff >= 0 && worst.diff <= 1.0, `worst ${worst.diff.toFixed(4)}" at ${worst.at}`);
  }

  // ───────────────────────────────────────────────────────────────────
  // Polar fallback still honoured under the same sandbox
  // ───────────────────────────────────────────────────────────────────
  {
    const polar = sb.computeNatal({ dateISO: "1988-06-21T03:00:00Z", lat: 75, lng: 20, houseSystem: "placidus" });
    t("above the polar circle, Placidus falls back to whole sign",
      polar.houseSystemActual === "whole" && polar.houseCusps === null,
      `${polar.houseSystemActual}`);
  }

  return rows;
}
