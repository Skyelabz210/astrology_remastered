// test/present/perfections.test.js — the perfection scan: exact transit
// instants inside a window of the lifecycle.
//
// transitPerfections (time.jsx) is the arithmetic under the lifecycle
// panel's "road behind and ahead": for each slow transiting body it scans
// the real ephemeris across the window on a 2-day grid and bisects every
// crossing of a major-aspect angle to a natal point. The contract this
// suite pins is the one the panel's copy makes: the reported instants are
// EXACT (re-evaluating the separation at the instant gives the aspect
// angle to well under an arcsecond), sorted, inside the window, free of
// duplicates, and deterministic. The window is a year full-run and six
// months under --quick.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const QUICK = process.argv.includes("--quick");

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

  const chart = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const centre = sb.dateToJD(new Date("2026-09-01T00:00:00Z"));
  const span = QUICK ? 180 : 366;
  const res = sb.transitPerfections(chart, centre, span);

  const wrap180 = (x) => { const m = ((x % 360) + 360) % 360; return m > 180 ? m - 360 : m; };
  const natalLon = (name) =>
    name === "Ascendant" ? chart.asc :
    name === "Midheaven" ? chart.mc :
    chart.planets.find((p) => p.name === name).lon;

  t(`the window yields a substantial timeline (${res.hits.length} hits over ${span}d)`,
    res.hits.length >= (QUICK ? 20 : 40), String(res.hits.length));

  // ── exactness: at each reported instant, the separation IS the angle ──
  let worstArcsec = 0, worstAt = "";
  for (const h of res.hits) {
    const sep = Math.abs(wrap180(sb.planetLongitude(h.transit, h.jd) - natalLon(h.natal)));
    const err = Math.abs(sep - h.angle) * 3600;
    if (err > worstArcsec) { worstArcsec = err; worstAt = `${h.transit} ${h.aspect} ${h.natal} ${h.dateISO}`; }
  }
  t('every perfection re-evaluates to its aspect angle within 0.01"',
    worstArcsec <= 0.01, `worst ${worstArcsec.toFixed(6)}" at ${worstAt}`);

  // ── ordering, window, duplicates ──
  t("hits are sorted by instant",
    res.hits.every((h, i, a) => i === 0 || a[i - 1].jd <= h.jd));
  t("every hit lies inside the window",
    res.hits.every((h) => h.jd >= centre - span / 2 - 1e-6 && h.jd <= centre + span / 2 + 2 + 1e-6));
  const dupes = res.hits.filter((h, i, a) => i > 0 &&
    a[i - 1].transit === h.transit && a[i - 1].natal === h.natal &&
    a[i - 1].aspect === h.aspect && Math.abs(a[i - 1].jd - h.jd) < 0.05);
  t("no crossing is reported twice", dupes.length === 0, `${dupes.length} dupes`);

  // ── the fields the panel renders ──
  t("every hit names its bodies, aspect, and a parseable instant",
    res.hits.every((h) =>
      typeof h.transit === "string" && typeof h.natal === "string" &&
      ["Conjunction","Sextile","Square","Trine","Opposition"].includes(h.aspect) &&
      typeof h.retrograde === "boolean" &&
      !Number.isNaN(Date.parse(h.dateISO))));

  // ── Jupiter sweeps ~30°/yr: it cannot cross a year without perfecting ──
  const jup = res.hits.filter((h) => h.transit === "Jupiter");
  t("Jupiter perfects several times in any such window",
    jup.length >= (QUICK ? 1 : 3), `${jup.length} Jupiter hits`);

  // ── the bodies parameter subsets the same scan ──
  const marsOnly = sb.transitPerfections(chart, centre, span, ["Mars"]);
  const marsFromAll = res.hits.filter((h) => h.transit === "Mars");
  t("a single-body scan reproduces exactly that body's slice of the full scan",
    marsOnly.hits.length === marsFromAll.length &&
    marsOnly.hits.every((h, i) => Math.abs(h.jd - marsFromAll[i].jd) < 1e-9),
    `${marsOnly.hits.length} vs ${marsFromAll.length}`);

  // ── determinism ──
  const again = sb.transitPerfections(chart, centre, span, ["Jupiter"]);
  const jupAgain = res.hits.filter((h) => h.transit === "Jupiter");
  t("the scan is deterministic",
    again.hits.length === jupAgain.length &&
    again.hits.every((h, i) => h.jd === jupAgain[i].jd));

  // ── an unknown birth time keeps the angles out of the timeline ──
  const noTime = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole", timeUnknown: true });
  noTime.timeUnknown = true;
  const resNoTime = sb.transitPerfections(noTime, centre, QUICK ? 90 : 180, ["Jupiter"]);
  t("with the birth time unknown, no perfection targets the Ascendant or Midheaven",
    resNoTime.hits.every((h) => h.natal !== "Ascendant" && h.natal !== "Midheaven"));

  return rows;
}
