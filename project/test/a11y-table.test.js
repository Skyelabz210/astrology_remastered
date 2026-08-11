// test/a11y-table.test.js — WP-20 accessibility & privacy.
//
// Unit tests for src/present/a11y-table-data.js, the pure data
// transformation a11y-table.jsx's <table> renders from. The React
// component itself (a11y-table.jsx) is JSX and cannot be `import`ed by
// plain Node, so — same split WP-21/WP-22 drew for astro-core.js — this
// suite pins the logic layer only: given a chart-shaped object, does
// chartToTableRows()/chartAngleRows() produce the right body/sign/degree/
// house/retrograde rows.

import { ZODIAC_SIGN_NAMES, formatDegree, chartToTableRows, chartAngleRows } from "../src/present/a11y-table-data.js";

// A minimal but structurally faithful stand-in for computeNatal()'s
// chart.planets shape (astro.jsx computeNatal, PLANET_ORDER loop): each
// entry carries name/sign/degInSign/house/retrograde among other fields
// a11y-table-data.js does not touch.
function fakeChart(overrides = {}) {
  return {
    asc: 15.5,        // Aries (sign 0) 15.50°
    ascSignIdx: 0,
    mc: 285.25,        // Capricorn (sign 9) 15.25°
    mcSignIdx: 9,
    planets: [
      { name: "Sun",   sign: 0,  degInSign: 0.3801,  house: 1,  retrograde: false, lon: 0.3801 },
      { name: "Moon",  sign: 6,  degInSign: 12.5,     house: 7,  retrograde: false, lon: 192.5 },
      { name: "Mercury", sign: 11, degInSign: 29.9,   house: 12, retrograde: true,  lon: 359.9 },
    ],
    ...overrides,
  };
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── ZODIAC_SIGN_NAMES ────────────────────────────────────────────
  t("ZODIAC_SIGN_NAMES has all 12 signs in order",
    ZODIAC_SIGN_NAMES.length === 12 && ZODIAC_SIGN_NAMES[0] === "Aries" && ZODIAC_SIGN_NAMES[11] === "Pisces",
    ZODIAC_SIGN_NAMES.join(","));

  // ── formatDegree ─────────────────────────────────────────────────
  t("formatDegree formats to 2 decimals with a degree sign",
    formatDegree(12.5) === "12.50°",
    formatDegree(12.5));
  t("formatDegree rounds like astro.jsx's own .toFixed(2) calls",
    formatDegree(29.996) === "30.00°",
    formatDegree(29.996));
  t("formatDegree guards non-finite input instead of emitting NaN°",
    formatDegree(NaN) === "—" && formatDegree(undefined) === "—" && formatDegree("x") === "—",
    `${formatDegree(NaN)} / ${formatDegree(undefined)} / ${formatDegree("x")}`);
  t("formatDegree(0) is a real zero, not treated as falsy/missing",
    formatDegree(0) === "0.00°",
    formatDegree(0));

  // ── chartToTableRows ─────────────────────────────────────────────
  t("chartToTableRows returns no rows for a null/undefined chart",
    chartToTableRows(null).length === 0 && chartToTableRows(undefined).length === 0,
    "");
  t("chartToTableRows returns no rows when chart.planets is missing/not an array",
    chartToTableRows({}).length === 0 && chartToTableRows({ planets: "nope" }).length === 0,
    "");
  {
    const rows = chartToTableRows(fakeChart());
    t("chartToTableRows produces one row per planet, same order as chart.planets",
      rows.length === 3 && rows.map((r) => r.body).join(",") === "Sun,Moon,Mercury",
      rows.map((r) => r.body).join(","));
    t("chartToTableRows resolves sign index to sign name",
      rows[0].sign === "Aries" && rows[1].sign === "Libra" && rows[2].sign === "Pisces",
      `${rows[0].sign}/${rows[1].sign}/${rows[2].sign}`);
    t("chartToTableRows formats degree-in-sign via formatDegree",
      rows[0].degree === "0.38°" && rows[1].degree === "12.50°",
      `${rows[0].degree}/${rows[1].degree}`);
    t("chartToTableRows prefixes house with H",
      rows[0].house === "H1" && rows[2].house === "H12",
      `${rows[0].house}/${rows[2].house}`);
    t("chartToTableRows coerces retrograde to a real boolean",
      rows[0].retrograde === false && rows[2].retrograde === true,
      `${rows[0].retrograde}/${rows[2].retrograde}`);
    t("chartToTableRows never emits a house label when house is not finite",
      chartToTableRows({ planets: [{ name: "X", sign: 0, degInSign: 0, house: null, retrograde: false }] })[0].house === "—",
      "");
    t("chartToTableRows falls back to a raw sign label for an out-of-range sign index",
      chartToTableRows({ planets: [{ name: "X", sign: 99, degInSign: 0, house: 1, retrograde: false }] })[0].sign === "sign 99",
      chartToTableRows({ planets: [{ name: "X", sign: 99, degInSign: 0, house: 1, retrograde: false }] })[0].sign);
  }

  // ── chartAngleRows ───────────────────────────────────────────────
  t("chartAngleRows returns no rows for a null chart",
    chartAngleRows(null).length === 0,
    "");
  {
    const rows = chartAngleRows(fakeChart());
    t("chartAngleRows emits Ascendant and Midheaven, in that order",
      rows.length === 2 && rows[0].body === "Ascendant" && rows[1].body === "Midheaven",
      rows.map((r) => r.body).join(","));
    t("chartAngleRows resolves ASC/MC sign indices to names",
      rows[0].sign === "Aries" && rows[1].sign === "Capricorn",
      `${rows[0].sign}/${rows[1].sign}`);
    t("chartAngleRows reduces the angle's full longitude to degree-within-sign (mod 30)",
      rows[0].degree === "15.50°" && rows[1].degree === "15.25°",
      `${rows[0].degree}/${rows[1].degree}`);
    t("chartAngleRows marks angle rows as non-retrograde with no house of their own",
      rows[0].retrograde === false && rows[0].house === "—",
      `${rows[0].retrograde}/${rows[0].house}`);
  }
  t("chartAngleRows omits an angle whose data is absent (partial chart)",
    chartAngleRows({ asc: 10, ascSignIdx: 0 }).length === 1,
    "");

  return R;
}
