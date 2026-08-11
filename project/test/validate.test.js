// test/validate.test.js — WP-19: birth-data input validation
// (project/validate.js). Not under src/core/: this is presentation-layer
// validation, not the exact-integer core.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).

import { isValidCalendarDate, validateLatitude, validateLongitude, polarHouseWarning } from "../validate.js";
import { POLAR_FALLBACK_POLICY } from "../tools/ephemeris/houses.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── isValidCalendarDate: real-calendar validity, leap-year aware ──────
  t("2021-02-28 is valid (ordinary February)",
    isValidCalendarDate({ year: 2021, month: 2, day: 28 }) === true);
  t("2021-02-29 is INVALID (2021 is not a leap year)",
    isValidCalendarDate({ year: 2021, month: 2, day: 29 }) === false);
  t("2020-02-29 is valid (2020 IS a leap year)",
    isValidCalendarDate({ year: 2020, month: 2, day: 29 }) === true);
  t("2000-02-29 is valid (divisible by 400 -> leap year)",
    isValidCalendarDate({ year: 2000, month: 2, day: 29 }) === true);
  t("1900-02-29 is INVALID (divisible by 100 but not 400 -> not a leap year)",
    isValidCalendarDate({ year: 1900, month: 2, day: 29 }) === false);
  t("2021-02-30 is INVALID (February never has 30 days)",
    isValidCalendarDate({ year: 2021, month: 2, day: 30 }) === false);
  t("2021-04-31 is INVALID (April has 30 days)",
    isValidCalendarDate({ year: 2021, month: 4, day: 31 }) === false);
  t("2021-01-32 is INVALID (day out of range)",
    isValidCalendarDate({ year: 2021, month: 1, day: 32 }) === false);
  t("2021-13-01 is INVALID (month out of range)",
    isValidCalendarDate({ year: 2021, month: 13, day: 1 }) === false);
  t("2021-00-15 is INVALID (month 0)",
    isValidCalendarDate({ year: 2021, month: 0, day: 15 }) === false);
  t("2021-03-00 is INVALID (day 0)",
    isValidCalendarDate({ year: 2021, month: 3, day: 0 }) === false);
  t("2021-03-21.5 is INVALID (non-integer day)",
    isValidCalendarDate({ year: 2021, month: 3, day: 21.5 }) === false);
  t("1990-03-21 is valid (ordinary date, default birth date in the app)",
    isValidCalendarDate({ year: 1990, month: 3, day: 21 }) === true);
  t("1600-02-29 is valid (divisible by 400, pre-1900 historic leap year)",
    isValidCalendarDate({ year: 1600, month: 2, day: 29 }) === true);
  t("every day of every month in 2024 (a leap year) round-trips valid", (() => {
    const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysPerMonth[m - 1]; d++) {
        if (!isValidCalendarDate({ year: 2024, month: m, day: d })) return false;
      }
      if (isValidCalendarDate({ year: 2024, month: m, day: daysPerMonth[m - 1] + 1 })) return false;
    }
    return true;
  })());

  // ── validateLatitude ───────────────────────────────────────────────
  t("validateLatitude(0) ok", validateLatitude(0).ok === true);
  t("validateLatitude(90) ok (exact pole, valid)", validateLatitude(90).ok === true);
  t("validateLatitude(-90) ok (exact pole, valid)", validateLatitude(-90).ok === true);
  t("validateLatitude(90.0001) rejected (just past the pole)", validateLatitude(90.0001).ok === false);
  t("validateLatitude(-90.0001) rejected", validateLatitude(-90.0001).ok === false);
  t("validateLatitude(180) rejected (double the max)", validateLatitude(180).ok === false);
  t("validateLatitude('abc') rejected as non-numeric", validateLatitude("abc").ok === false);
  t("validateLatitude('') rejected as non-numeric (empty)", validateLatitude("").ok === false);
  t("validateLatitude(NaN) rejected", validateLatitude(NaN).ok === false);
  t("validateLatitude(Infinity) rejected", validateLatitude(Infinity).ok === false);
  t("validateLatitude('40.5') accepts a numeric string, returns numeric value",
    validateLatitude("40.5").ok === true && validateLatitude("40.5").value === 40.5);
  t("validateLatitude('  85.2° ') tolerates whitespace/degree-sign", (() => {
    const r = validateLatitude("  85.2° ");
    return r.ok === true && r.value === 85.2;
  })());
  t("validateLatitude out-of-range carries a human-readable error string",
    typeof validateLatitude(200).error === "string" && validateLatitude(200).error.length > 0);

  // ── validateLongitude ──────────────────────────────────────────────
  t("validateLongitude(0) ok", validateLongitude(0).ok === true);
  t("validateLongitude(180) ok (exact antimeridian, valid)", validateLongitude(180).ok === true);
  t("validateLongitude(-180) ok", validateLongitude(-180).ok === true);
  t("validateLongitude(180.0001) rejected", validateLongitude(180.0001).ok === false);
  t("validateLongitude(-98.4936) ok (San Antonio, the app default)", validateLongitude(-98.4936).ok === true);
  t("validateLongitude('xyz') rejected as non-numeric", validateLongitude("xyz").ok === false);
  t("validateLongitude(NaN) rejected", validateLongitude(NaN).ok === false);

  // ── polarHouseWarning, wired against the REAL POLAR_FALLBACK_POLICY ──
  // (imported straight from houses.js, not a hand-copied duplicate — see
  // validate.js's module header for why).
  t("polarHouseWarning: placidus at 40N (well within range) -> no warning",
    polarHouseWarning(40, "placidus", POLAR_FALLBACK_POLICY) === null);
  t("polarHouseWarning: placidus at 70N (past the ~66.56 hard limit) -> warns",
    polarHouseWarning(70, "placidus", POLAR_FALLBACK_POLICY) !== null);
  {
    const w = polarHouseWarning(70, "placidus", POLAR_FALLBACK_POLICY);
    t("polarHouseWarning: placidus warning names Placidus and the WholeSign fallback",
      w && w.system === "placidus" && w.fallback === "WholeSign", JSON.stringify(w));
    t("polarHouseWarning: placidus (hard-enforced) warning says 'undefined', not 'unreliable'",
      w && w.message.includes("undefined") && w.message.includes("Whole Sign"), w && w.message);
  }
  t("polarHouseWarning: koch at -70 (southern polar) -> warns (symmetric range)",
    polarHouseWarning(-70, "koch", POLAR_FALLBACK_POLICY) !== null);
  {
    const w = polarHouseWarning(70, "regiomontanus", POLAR_FALLBACK_POLICY);
    t("polarHouseWarning: regiomontanus (soft-enforced) warning says 'unreliable', not 'undefined'",
      w && w.message.includes("unreliable"), w && w.message);
  }
  t("polarHouseWarning: meridian at 89N -> no warning (validLatRange is the full [-90,90])",
    polarHouseWarning(89, "meridian", POLAR_FALLBACK_POLICY) === null);
  t("polarHouseWarning: 'whole' is not in the policy table -> no warning at any latitude",
    polarHouseWarning(89, "whole", POLAR_FALLBACK_POLICY) === null
    && polarHouseWarning(-89, "whole", POLAR_FALLBACK_POLICY) === null);
  t("polarHouseWarning: 'equal' is not in the policy table -> no warning at any latitude",
    polarHouseWarning(89, "equal", POLAR_FALLBACK_POLICY) === null);
  t("polarHouseWarning: unknown house-system key -> no warning (nothing to look up)",
    polarHouseWarning(89, "not-a-real-system", POLAR_FALLBACK_POLICY) === null);
  t("polarHouseWarning: null policy table -> no warning (defensive, doesn't throw)",
    polarHouseWarning(89, "placidus", null) === null);
  t("polarHouseWarning: exactly at the boundary (66.56...) is still valid, not past it",
    (() => {
      const lim = POLAR_FALLBACK_POLICY.placidus.validLatRange[1];
      return polarHouseWarning(lim, "placidus", POLAR_FALLBACK_POLICY) === null;
    })());
  t("polarHouseWarning: one hundredth of a degree past the boundary warns",
    (() => {
      const lim = POLAR_FALLBACK_POLICY.placidus.validLatRange[1];
      return polarHouseWarning(lim + 0.01, "placidus", POLAR_FALLBACK_POLICY) !== null;
    })());
  // Every quadrant-system entry in the real policy table produces SOME
  // warning once past its own validLatRange — a sweep so this suite stays
  // correct if houses.js's table gains/loses systems later.
  {
    let allWarn = true;
    const detail = [];
    for (const [key, policy] of Object.entries(POLAR_FALLBACK_POLICY)) {
      const pastLimit = policy.validLatRange[1] + 0.5;
      if (pastLimit > 90) continue; // meridian/morinus: nothing past 90 to test
      const w = polarHouseWarning(pastLimit, key, POLAR_FALLBACK_POLICY);
      if (!w) { allWarn = false; detail.push(key); }
    }
    t("polarHouseWarning: every hard/soft policy entry warns just past its own validLatRange",
      allWarn, `no-warn systems: ${detail.join(", ")}`);
  }

  return R;
}
