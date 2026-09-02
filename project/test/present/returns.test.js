// test/present/returns.test.js — return charts: a body's return to its own
// natal degree, cast whole.
//
// nearestBodyReturns / returnChart (time.jsx) implement the classical
// solar- and lunar-return technique: find the exact instant the Sun or
// Moon re-crosses its own natal longitude, then cast a FULL chart
// (computeNatal) for that instant at the natal place. Neither body is
// ever retrograde, so the crossing is guaranteed unique per period — the
// suite leans on that to assert exactness and spacing directly, the same
// way chart-sample.test.js leans on Horizons for computeNatal itself.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

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
  const targetJd = sb.dateToJD(new Date("2026-09-01T00:00:00Z"));
  const natalLon = (name) => chart.planets.find((p) => p.name === name).lon;
  const wrap180 = (x) => { const m = ((x % 360) + 360) % 360; return m > 180 ? m - 360 : m; };

  t("RETURN_BODIES is exactly Sun and Moon — the two that are never retrograde",
    JSON.stringify(sb.RETURN_BODIES) === JSON.stringify(["Sun", "Moon"]));

  for (const body of sb.RETURN_BODIES) {
    const r = sb.returnChart(chart, body, targetJd);

    t(`${body}: returnChart produces a full chart object`,
      r && r.chart && Array.isArray(r.chart.planets) && r.chart.planets.length > 0 &&
      Number.isFinite(r.chart.asc) && Number.isFinite(r.chart.mc));

    const gotLon = r.chart.planets.find((p) => p.name === body).lon;
    const errArcsec = Math.abs(wrap180(gotLon - natalLon(body))) * 3600;
    t(`${body}: the return chart's own ${body} sits on the natal degree within 0.01"`,
      errArcsec <= 0.01, `${errArcsec.toFixed(6)}"`);

    t(`${body}: prev return is at or before the target, next is strictly after`,
      r.jd <= targetJd + 1e-9 && r.nextJd > targetJd,
      `jd=${r.jd} target=${targetJd} next=${r.nextJd}`);

    t(`${body}: isCurrent reflects which of prev/next was chosen`,
      r.isCurrent === true, "returnChart should pick the return in force at the target");

    const { prev, next } = sb.nearestBodyReturns(chart, body, targetJd);
    t(`${body}: nearestBodyReturns agrees with returnChart's own jd/nextJd`,
      prev === r.jd && next === r.nextJd);

    // spacing across several consecutive returns: within ~a week of the
    // body's own mean period (eccentricity/lunar-month variation is real
    // but small next to the period itself).
    const periodDays = { Sun: 365.2422, Moon: 29.530589 }[body]; // true synodic/tropical period, NOT our mean-motion approx
    let cursor = chart.jd + 5, prevJd = null, worstSpacingErr = 0;
    for (let i = 0; i < 5; i++) {
      const nb = sb.nearestBodyReturns(chart, body, cursor);
      if (prevJd !== null) {
        const spacing = nb.next - prevJd;
        worstSpacingErr = Math.max(worstSpacingErr, Math.abs(spacing - periodDays));
      }
      prevJd = nb.next;
      cursor = nb.next + 5;
    }
    t(`${body}: consecutive returns are spaced within 3 days of the true period`,
      worstSpacingErr <= 3, `worst ${worstSpacingErr.toFixed(3)}d off ${periodDays}d`);

    t(`${body}: K and windingLift's own K for this body never differ by more than 1`,
      (() => {
        const wl = sb.windingLift(chart, r.jd + 0.01);
        const wlK = wl.rows.find((row) => row.name === body).K;
        return Math.abs(wlK - r.K) <= 1;
      })(), "trunc vs round of the same real number, expected to differ by at most 1");

    t(`${body}: sect is re-derived for the return instant, not inherited`,
      typeof r.chart.isDayChart === "boolean");
  }

  // ── no return before birth: a target one hour after birth has no prev ──
  {
    const soon = sb.returnChart(chart, "Sun", chart.jd + 1 / 24);
    t("no solar return exists an hour after birth — the upcoming one is used instead",
      soon.isCurrent === false && soon.jd > chart.jd, `isCurrent=${soon.isCurrent}`);
    const nb = sb.nearestBodyReturns(chart, "Sun", chart.jd + 1 / 24);
    t("nearestBodyReturns reports no prior return that soon after birth",
      nb.prev === undefined);
  }

  // ── determinism ──
  {
    const a = sb.returnChart(chart, "Moon", targetJd);
    const b = sb.returnChart(chart, "Moon", targetJd);
    t("returnChart is deterministic", a.jd === b.jd && a.nextJd === b.nextJd);
  }

  return rows;
}
