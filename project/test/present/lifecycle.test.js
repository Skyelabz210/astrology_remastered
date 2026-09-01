// test/present/lifecycle.test.js — the winding lift: addressing any point
// of a chart's lifecycle.
//
// windingLift (time.jsx) is the arithmetic under the lifecycle panel: for
// a target instant, each body's completed circuits since birth (K, by the
// body's own period — negative before birth) and its shadow-lane residue
// at the target beside the natal one. This suite pins the contract the
// panel's copy makes: K is zero and every body is in its natal lane when
// the target IS the birth; K counts real circuits at known offsets; lanes
// are genuine arcsec-mod-11 of the target position; and earlier states
// are addressable (negative K), not an error.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function makeSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8"), sandbox, { filename: "astronomy.browser.min.js" });
  return sandbox;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const sb = makeSandbox();
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.runInContext(readFileSync(join(ROOT, "astro.jsx"), "utf8"), sb, { filename: "astro.jsx" });
  vm.runInContext(readFileSync(join(ROOT, "time.jsx"), "utf8"), sb, { filename: "time.jsx" });

  const chart = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];

  // ── the target IS the birth ──
  const atBirth = sb.windingLift(chart, chart.jd);
  t("at birth, ten bodies are lifted", atBirth.rows.length === 10);
  t("at birth, every winding count is zero",
    atBirth.rows.every((r) => r.K === 0), JSON.stringify(atBirth.rows.map((r) => [r.name, r.K])));
  t("at birth, every body is in its natal lane",
    atBirth.rows.every((r) => r.isReturn && r.lane11 === r.natalLane));
  t("at birth, age is zero", atBirth.ageDays === 0 && atBirth.ageYears === 0);
  t("at birth, the returns list is all ten bodies", atBirth.returns.length === 10);

  // ── known circuit counts at known offsets ──
  const plus400 = sb.windingLift(chart, chart.jd + 400);
  const sun400 = plus400.rows.find((r) => r.name === "Sun");
  const moon400 = plus400.rows.find((r) => r.name === "Moon");
  t("400 days on: the Sun has closed exactly one circuit", sun400.K === 1, `K=${sun400.K}`);
  // PLANET_PERIODS is a top-level const (context lexical scope, not a
  // sandbox property) — read it by evaluating in the context.
  const moonPeriodYears = vm.runInContext("PLANET_PERIODS.Moon", sb);
  t("400 days on: the Moon has closed fourteen",
    moon400.K === Math.trunc(400 / (moonPeriodYears * 365.25)) && moon400.K === 14, `K=${moon400.K}`);
  const pluto400 = plus400.rows.find((r) => r.name === "Pluto");
  t("400 days on: Pluto has closed none", pluto400.K === 0);

  // ── earlier states are addressable, not an error ──
  const minus400 = sb.windingLift(chart, chart.jd - 400);
  t("400 days before birth: the Sun's winding runs to minus one",
    minus400.rows.find((r) => r.name === "Sun").K === -1);
  t("before birth, every lane is still a valid residue",
    minus400.rows.every((r) => r.lane11 >= 0 && r.lane11 <= 10));

  // ── a target minutes before birth never prints "-0 circuits" ──
  const justBefore = sb.windingLift(chart, chart.jd - 0.4);
  t("minutes before birth, windings are plain zero, never negative zero",
    justBefore.rows.every((r) => !Object.is(r.K, -0)),
    JSON.stringify(justBefore.rows.map((r) => [r.name, r.K])));

  // ── lanes are genuine arcsec mod 11 of the target position ──
  const at9000 = sb.windingLift(chart, chart.jd + 9000);
  t("every target lane re-derives from the target longitude",
    at9000.rows.every((r) => r.lane11 === Math.floor(sb.planetLongitude(r.name, chart.jd + 9000) * 3600) % 11));
  t("every return flag is exactly lane equality",
    at9000.rows.every((r) => r.isReturn === (r.lane11 === r.natalLane)));
  t("natal lanes quote the chart's own residues",
    at9000.rows.every((r) => r.natalLane === chart.planets.find((p) => p.name === r.name).residues.r11));

  // ── windings never decrease as the target moves forward ──
  let monotone = true;
  let prev = null;
  for (const offset of [-2000, 0, 500, 5000, 20000]) {
    const lift = sb.windingLift(chart, chart.jd + offset);
    if (prev) {
      for (const body of BODIES) {
        const a = prev.rows.find((r) => r.name === body).K;
        const b = lift.rows.find((r) => r.name === body).K;
        if (b < a) monotone = false;
      }
    }
    prev = lift;
  }
  t("winding counts are monotone along the lifecycle", monotone);

  return rows;
}
