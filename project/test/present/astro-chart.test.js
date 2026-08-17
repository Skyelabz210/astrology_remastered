// test/present/astro-chart.test.js — WP-22: Node port of tests.jsx's
// zodiac, whole-sign-houses, sect, angles, and full-chart-regression suites
// (1, 8, 9, 13, 18).
//
// These suites all reach for computeNatal() and/or the ZODIAC table, which
// (post WP-21) live in project/astro.jsx — a browser classic script (no
// `export` syntax; it assigns to `window`), NOT project/src/present/
// astro-core.js. astro.jsx itself contains no JSX (grep confirms:
// `grep -n "^import \|^export " project/astro.jsx` is empty; it is a
// Babel-standalone classic script purely by file-extension convention —
// the same fact test/astro-ephemeris.test.js, WP-17's own suite, already
// relies on), so it is evaluated UNMODIFIED via node:vm, mirroring exactly
// what test/astro-ephemeris.test.js does: astro-core.js is `import()`ed for
// real and its namespace attached to the sandbox as the bare global
// `AstroCore` astro.jsx's top-level code expects, then astro.jsx runs on
// top of it. The vendored astronomy-engine build is loaded first too,
// because that is what "Test Harness.html" (tests.jsx's real host page)
// itself does — <script src="vendor/astronomy.browser.min.js"> before
// <script type="text/babel" src="astro.jsx">, so this reproduces the exact
// ephemeris mode (REAL) the original browser suite ran under.
//
// One assertion is intentionally strengthened, not just copied: tests.jsx's
// "Houses · whole-sign" suite (8) never calls a function at all — it
// inlines the whole-sign formula `((sign - asc + 12) % 12) + 1` directly in
// the test body. That inline formula is byte-identical to astro.jsx's own
// houseForSign() (a thin AstroCore.houseForSign wrapper — see astro.jsx's
// WP-21 header), so this port calls the real shipped function with the
// same inputs/expected outputs instead of re-deriving the formula inline —
// same assertion, real code path exercised.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
// Every HTML page that loads astro.jsx also loads tools/ephemeris/houses.js as
// a module tag BEFORE it, so window.Houses is populated by the time
// computeNatal() runs and the REAL ascMc() solver is the live ASC/MC path.
// The sandbox mirrors that load order; without it these suites would silently
// exercise the ~109deg-wrong fallback the browser never uses.
const housesModule = await import("../../tools/ephemeris/houses.js");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const astroCoreModule = await import("../../src/present/astro-core.js");

function makeSandbox() {
  const sandbox = {};
  sandbox.window = sandbox; // top-level `window.X = ...` resolves here, same as astro-ephemeris.test.js
  sandbox.Houses = housesModule;
  sandbox.AstroCore = astroCoreModule;
  vm.createContext(sandbox);
  vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  vm.runInContext(astroSrc, sandbox, { filename: "astro.jsx" });
  return sandbox;
}

// tests.jsx's own FIXTURE_BIRTH — vernal equinox 1990, San Antonio TX.
const FIXTURE_BIRTH = {
  dateISO:     "1990-03-21T12:30:00-06:00",
  lat:         29.4241,
  lng:         -98.4936,
  houseSystem: "whole",
  sect:        "auto",
  placeLabel:  "San Antonio · TX",
};

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const chart = makeSandbox();
  const { ZODIAC, computeNatal, houseForSign, mod360, antiscion, contraAntiscion } = chart;

  // ── Suite 1: Zodiac signs ─────────────────────────────────────────────
  t("12 signs total", ZODIAC.length === 12);
  t("Aries: Fire Cardinal, ruled by Mars",
    `${ZODIAC[0].name}/${ZODIAC[0].element}/${ZODIAC[0].modality}/${ZODIAC[0].ruler}` === "Aries/Fire/Cardinal/Mars");
  t("Taurus: Earth Fixed, Venus",
    `${ZODIAC[1].name}/${ZODIAC[1].element}/${ZODIAC[1].modality}/${ZODIAC[1].ruler}` === "Taurus/Earth/Fixed/Venus");
  t("Cancer: Water Cardinal, Moon",
    `${ZODIAC[3].name}/${ZODIAC[3].element}/${ZODIAC[3].modality}/${ZODIAC[3].ruler}` === "Cancer/Water/Cardinal/Moon");
  t("Leo: Fire Fixed, Sun",
    `${ZODIAC[4].name}/${ZODIAC[4].element}/${ZODIAC[4].modality}/${ZODIAC[4].ruler}` === "Leo/Fire/Fixed/Sun");
  t("Scorpio: Water Fixed, Mars (classical)",
    `${ZODIAC[7].name}/${ZODIAC[7].element}/${ZODIAC[7].modality}/${ZODIAC[7].ruler}` === "Scorpio/Water/Fixed/Mars");
  t("Capricorn: Earth Cardinal, Saturn",
    `${ZODIAC[9].name}/${ZODIAC[9].element}/${ZODIAC[9].modality}/${ZODIAC[9].ruler}` === "Capricorn/Earth/Cardinal/Saturn");
  t("Aquarius: Air Fixed, Saturn (classical)",
    `${ZODIAC[10].name}/${ZODIAC[10].element}/${ZODIAC[10].modality}/${ZODIAC[10].ruler}` === "Aquarius/Air/Fixed/Saturn");
  t("Pisces: Water Mutable, Jupiter (classical)",
    `${ZODIAC[11].name}/${ZODIAC[11].element}/${ZODIAC[11].modality}/${ZODIAC[11].ruler}` === "Pisces/Water/Mutable/Jupiter");

  // ── Suite 8: Houses · whole-sign — ASC sign rules H1; next sign = H2 ──
  t("ASC sign Aries → Aries is H1",
    [0,1,2,3,4,5,6,7,8,9,10,11].map((i) => houseForSign(i, 0)).join(",") === "1,2,3,4,5,6,7,8,9,10,11,12");
  t("ASC sign Cancer → Capricorn is H7", houseForSign(9, 3) === 7);

  // ── Suite 9: Sect classification — day chart iff Sun above horizon ───
  {
    // This assertion used to read `c.isDayChart === true || c.isDayChart ===
    // false` — satisfied by any boolean, so it asserted nothing while its name
    // promised a specific outcome. It was written when the ASC came from
    // astro.jsx's ~109°-wrong approximation, where no stable outcome could be
    // pinned. With the real ascMc() solver wired in, the configuration is
    // determinate, so the real outcome is pinned along with its derivation.
    //
    // At this instant, lat/lng 0/0: ASC 187.09° (Libra), Sun 0.88° (Aries).
    // The Sun sits 173.8° counterclockwise from the ASC — short of the 180°
    // Descendant, so it is still BELOW the horizon → night chart. Whole-sign
    // houses put it in H7 (Aries is the 7th sign from Libra) even though it
    // has not yet crossed the horizon; sect follows the true elevation, not
    // the whole-sign house number, and that divergence is the point here.
    const c = computeNatal({ dateISO: FIXTURE_BIRTH.dateISO, lat: 0, lng: 0, houseSystem: "whole", sect: "auto" });
    const sunLon = c.planets.find((p) => p.name === "Sun").lon;
    const elong = ((sunLon - c.asc) % 360 + 360) % 360;
    t("Sun 173.8° past ASC (below horizon) → night chart",
      c.isDayChart === false, `isDayChart=${c.isDayChart} elong=${elong.toFixed(2)}°`);
    t("sect follows true elevation, not the whole-sign house",
      elong > 90 && elong < 180 && c.planets.find((p) => p.name === "Sun").house === 7,
      `elong=${elong.toFixed(2)}° house=${c.planets.find((p) => p.name === "Sun").house}`);
  }
  {
    const c = computeNatal({ ...FIXTURE_BIRTH, sect: "day" });
    t("explicit sect=day overrides", c.isDayChart === true);
  }
  {
    const c = computeNatal({ ...FIXTURE_BIRTH, sect: "night" });
    t("explicit sect=night overrides", c.isDayChart === false);
  }

  // ── Suite 13: Angles · ASC / MC / DSC / IC consistency ────────────────
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("DSC = ASC + 180", Math.abs(mod360(c.desc - c.asc) - 180) < 1e-3, `got ${mod360(c.desc - c.asc)}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("IC = MC + 180", Math.abs(mod360(c.ic - c.mc) - 180) < 1e-3, `got ${mod360(c.ic - c.mc)}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("ASC in [0, 360)", c.asc >= 0 && c.asc <= 360, `got ${c.asc}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("MC in [0, 360)", c.mc >= 0 && c.mc <= 360, `got ${c.mc}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("ascSignIdx in [0, 11]", c.ascSignIdx >= 0 && c.ascSignIdx <= 11, `got ${c.ascSignIdx}`);
  }

  // ── Suite 18: Regression · full chart roundtrip ───────────────────────
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("chart resolves on canonical fixture", !!c && typeof c.asc === "number");
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("chart has 14 planet entries (10 + Chiron + Nodes + Lilith)", c.planets.length === 14, `got ${c.planets.length}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("chart has 12 cards", c.cards.length === 12, `got ${c.cards.length}`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("each card resonance ∈ [0, 1]", c.cards.every((card) => card.resonance >= 0 && card.resonance <= 1));
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("each planet longitude ∈ [0, 360)", c.planets.every((p) => p.lon >= 0 && p.lon < 360));
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("each planet house ∈ [1, 12]", c.planets.every((p) => p.house >= 1 && p.house <= 12));
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    t("aspectGrid is non-empty", c.aspectGrid.length > 0);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    const sorted = [...c.aspectGrid].sort((a, b) => a.orb - b.orb);
    t("aspectGrid sorted tightest first",
      JSON.stringify(c.aspectGrid.map((a) => a.orb)) === JSON.stringify(sorted.map((a) => a.orb)));
  }
  {
    let thrown = 0;
    for (let i = 0; i < 100; i++) {
      try {
        const y = 1900 + Math.floor(Math.random() * 150);
        const m = 1 + Math.floor(Math.random() * 12);
        const d = 1 + Math.floor(Math.random() * 28);
        const h = Math.floor(Math.random() * 24);
        const lat = (Math.random() - 0.5) * 130;
        const lng = (Math.random() - 0.5) * 360;
        computeNatal({
          dateISO: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`,
          lat, lng, houseSystem: "whole", sect: "auto",
        });
      } catch { thrown++; }
    }
    t("100 random charts (1900-2050) don't throw", thrown === 0, `${thrown} threw`);
  }
  {
    const c = computeNatal(FIXTURE_BIRTH);
    const sunLon = c.planets.find((p) => p.name === "Sun").lon;
    const dist = Math.min(sunLon, 360 - sunLon);
    t("Sun near 0° on vernal equinox (1990-03-21)", dist >= 0 && dist <= 15, `got ${dist}`);
  }
  {
    const samples = [0, 30, 45, 90, 137, 200, 270, 359];
    const ok = samples.every((l) => Math.abs(antiscion(antiscion(l)) - l) < 1e-9);
    t("antiscion involution: A(A(λ)) = λ", ok);
  }
  {
    const samples = [0, 30, 45, 90, 137, 200, 270, 359];
    const ok = samples.every((l) => Math.abs(contraAntiscion(contraAntiscion(l)) - l) < 1e-9);
    t("contra-antiscion involution: C(C(λ)) = λ", ok);
  }

  return R;
}
