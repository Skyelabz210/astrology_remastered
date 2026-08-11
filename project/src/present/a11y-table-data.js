// project/src/present/a11y-table-data.js — WP-20 accessibility & privacy.
//
// Pure data transformation for a11y-table.jsx's textual chart alternative:
// takes the SAME computed chart object the visual zodiac-card spread (and
// the HCRM shadow-lane wheel) render from — `computeNatal()`'s return value,
// astro.jsx — and reshapes chart.planets into plain row objects for a real
// `<table>`: body, sign, degree, house, retrograde. No DOM, no React; kept
// separate from a11y-table.jsx (which IS JSX and therefore cannot be
// `import`ed by a plain Node test) purely so this logic is unit-testable —
// see project/test/a11y-table.test.js.
//
// Dual-environment export, mirroring src/present/astro-core.js (WP-21):
// named ES `export`s for Node/`import`, and assembled onto
// `window.A11yTableData` for the classic (Babel-standalone `text/babel`)
// a11y-table.jsx to consume like every other presentation script in this
// repo. Floats/Math.* are fine here — this is project/src/present/, not
// project/src/core/ (outside the no-float audit's CORE_MANIFEST).
//
// Sign names are deliberately duplicated (not imported) from astro.jsx's
// own ZODIAC table, same call astro-core.js's header makes for its angle
// helpers: astro.jsx is a non-module `text/babel` script, so there is
// nothing here to `import` from it, and a 12-entry name list is cheap to
// keep in sync by inspection.
export const ZODIAC_SIGN_NAMES = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

function signName(idx) {
  return ZODIAC_SIGN_NAMES[idx] ?? `sign ${idx}`;
}

// formatDegree — degrees-in-sign to 2 decimal places, the same precision
// astro.jsx's own `.toFixed(2)` calls use throughout (TraditionalPanel,
// header ASC/MC readouts). Guards non-finite input rather than emitting
// "NaN°" for a malformed/partial chart.
export function formatDegree(deg) {
  return typeof deg === "number" && Number.isFinite(deg) ? `${deg.toFixed(2)}°` : "—";
}

// chartToTableRows — one row per body in chart.planets, in the same order
// astro.jsx's PLANET_ORDER produced them (Sun..Pluto, nodes, Chiron,
// Lilith, then SouthNode appended). Each row is plain data (no JSX), ready
// for either the visible <table> or the always-present screen-reader copy.
export function chartToTableRows(chart) {
  if (!chart || !Array.isArray(chart.planets)) return [];
  return chart.planets.map((p) => ({
    body: p.name,
    sign: signName(p.sign),
    degree: formatDegree(p.degInSign),
    house: Number.isFinite(p.house) ? `H${p.house}` : "—",
    retrograde: !!p.retrograde,
  }));
}

// chartAngleRows — ASC/MC/DSC/IC are not bodies (no house or retrograde
// state of their own — they DEFINE the houses), but a sighted user reading
// the visual spread sees them too (app.jsx's header + TraditionalPanel), so
// the text alternative surfaces them as their own small row set rather than
// silently dropping them.
export function chartAngleRows(chart) {
  if (!chart) return [];
  const rows = [];
  if (Number.isFinite(chart.asc) && Number.isFinite(chart.ascSignIdx)) {
    rows.push({ body: "Ascendant", sign: signName(chart.ascSignIdx), degree: formatDegree(chart.asc % 30), house: "—", retrograde: false });
  }
  if (Number.isFinite(chart.mc) && Number.isFinite(chart.mcSignIdx)) {
    rows.push({ body: "Midheaven", sign: signName(chart.mcSignIdx), degree: formatDegree(chart.mc % 30), house: "—", retrograde: false });
  }
  return rows;
}

if (typeof window !== "undefined") {
  window.A11yTableData = { ZODIAC_SIGN_NAMES, formatDegree, chartToTableRows, chartAngleRows };
}
