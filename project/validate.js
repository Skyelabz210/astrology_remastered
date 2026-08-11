// validate.js — WP-19: pure, dependency-free validation helpers for
// birth-data input (real-calendar dates, latitude/longitude range, and the
// polar-latitude house-system fallback warning).
//
// Dual-environment module, same pattern as tzresolve.js: `export`ed for
// Node (test/validate.test.js imports it directly) and published as
// `window.Validate` so the Babel-standalone `.jsx` pages (plain classic
// scripts, not ES modules) can call it. Load it as
// `<script type="module" src="validate.js"></script>` before any `.jsx`
// script that needs `window.Validate` — same convention tzresolve.js
// documents.
//
// Deliberately has NO dependency on tools/ephemeris/houses.js: the
// polar-latitude check below takes the policy table as a parameter rather
// than importing it, so this module stays a plain, freely-testable unit —
// callers (landing.jsx/app.jsx) pass in the real
// `window.HousesPolicy.POLAR_FALLBACK_POLICY` (published by houses.js's own
// WP-19 addition) and test/validate.test.js passes in the real
// `POLAR_FALLBACK_POLICY` imported straight from houses.js, so both the
// browser and the test suite exercise the SAME table — no risk of a
// duplicated/hand-copied copy drifting out of sync with houses.js.

/**
 * Real-calendar date validity check — leap-year aware. Rejects "Feb 30",
 * "day 32", "month 13", etc. by round-tripping through Date.UTC() and
 * confirming the constructed date didn't silently roll over into a
 * different month/day than requested (JS Date normalizes overflow instead
 * of throwing, e.g. new Date(2021, 1, 30) quietly becomes March 2 — the
 * round-trip is what catches that).
 *
 * @param {{year: number, month: number, day: number}} parts month is
 *   1-indexed (1 = January), matching landing.jsx's Picker convention.
 * @returns {boolean}
 */
export function isValidCalendarDate({ year, month, day }) {
  const y = Number(year), m = Number(month), d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Coerce a free-entry field (string or number) to a finite number, or NaN. */
function parseNumericInput(input) {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return NaN;
  const trimmed = input.trim().replace(/[°\s]+$/, "");
  if (trimmed === "") return NaN;
  return Number(trimmed);
}

/**
 * @param {string|number} input
 * @returns {{ok: true, value: number} | {ok: false, error: string}}
 */
export function validateLatitude(input) {
  const n = parseNumericInput(input);
  if (!Number.isFinite(n)) return { ok: false, error: "Latitude must be a number." };
  if (n < -90 || n > 90) return { ok: false, error: "Latitude must be between -90 and 90 degrees." };
  return { ok: true, value: n };
}

/**
 * @param {string|number} input
 * @returns {{ok: true, value: number} | {ok: false, error: string}}
 */
export function validateLongitude(input) {
  const n = parseNumericInput(input);
  if (!Number.isFinite(n)) return { ok: false, error: "Longitude must be a number." };
  if (n < -180 || n > 180) return { ok: false, error: "Longitude must be between -180 and 180 degrees." };
  return { ok: true, value: n };
}

const SYSTEM_LABELS = {
  placidus: "Placidus", koch: "Koch", alcabitius: "Alcabitius",
  regiomontanus: "Regiomontanus", campanus: "Campanus",
  topocentric: "Topocentric", meridian: "Meridian", morinus: "Morinus",
  whole: "Whole Sign", equal: "Equal",
};
const FALLBACK_LABELS = { WholeSign: "Whole Sign" };

/**
 * Is `latDeg` outside the valid/recommended latitude range for
 * `houseSystemKey`, per houses.js's POLAR_FALLBACK_POLICY table? Returns
 * `null` when there is nothing to warn about — either the latitude is
 * fine, or `houseSystemKey` isn't in the table at all (meaning the system
 * never breaks down at any latitude, e.g. "whole"/"equal", which aren't
 * quadrant systems and carry no entry in POLAR_FALLBACK_POLICY).
 *
 * @param {number} latDeg
 * @param {string} houseSystemKey e.g. "placidus", "whole".
 * @param {object} policyTable the real POLAR_FALLBACK_POLICY object
 *   (passed in, not imported — see module header).
 * @returns {null | {system: string, fallback: string, enforced: string, message: string}}
 */
export function polarHouseWarning(latDeg, houseSystemKey, policyTable) {
  if (!policyTable) return null;
  const policy = policyTable[houseSystemKey];
  if (!policy) return null;
  const [lo, hi] = policy.validLatRange;
  if (latDeg >= lo && latDeg <= hi) return null;
  const label = SYSTEM_LABELS[houseSystemKey] || houseSystemKey;
  const fallbackLabel = FALLBACK_LABELS[policy.fallback] || policy.fallback;
  const verb = policy.enforced === "hard" ? "undefined" : "unreliable";
  return {
    system: houseSystemKey,
    fallback: policy.fallback,
    enforced: policy.enforced,
    message: `${label} house cusps are ${verb} above the polar circle at this latitude; using ${fallbackLabel} houses instead.`,
  };
}

if (typeof window !== "undefined") {
  window.Validate = { isValidCalendarDate, validateLatitude, validateLongitude, polarHouseWarning };
}
