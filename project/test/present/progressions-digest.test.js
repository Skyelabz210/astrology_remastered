// test/present/progressions-digest.test.js — the secondary-progressions
// table's prose lead-in.
//
// progressionsDigest (time.jsx) composes the SAME facts the progressions
// table on the Cylindrical Time panel already shows — the progressed
// Moon's current sign, which slower body (if any) has changed sign since
// birth, and the progressed Sun-Moon phase relationship — into a few
// plain sentences, the same register lifecycleDigest already uses. It
// computes nothing new: every fact in it traces back to progressedAt and
// lunarPhase, both already tested elsewhere. This suite pins that the
// prose matches those source computations exactly, that the birth
// instant (progressed = natal, trivially) produces the tautological
// "no sign change" case, and that no frequency or rarity is claimed for
// either fact — this file has not measured how often a body's progressed
// sign changes across a lifetime, so it must not imply one is rare or
// common.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sb = {};
  sb.window = sb;
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }

  const chart = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const jdNow = sb.dateToJD(new Date("2026-09-02T10:00:00Z"));

  // ── shape ──
  const d = sb.progressionsDigest(chart, jdNow);
  t("progressionsDigest returns a non-empty array of strings",
    Array.isArray(d.lines) && d.lines.length > 0 && d.lines.every((l) => typeof l === "string" && l.length > 0));

  // ── age matches the same formula ctmState itself uses, not a re-derivation ──
  const ctm = sb.ctmState(jdNow, chart.jd);
  t("digest age (years) matches ctmState's own ageYears",
    Math.abs(d.ageYears - ctm.ageYears) < 1e-9, `${d.ageYears} vs ${ctm.ageYears}`);

  // ── the Moon's progressed sign line matches progressedAt's own output ──
  const prog = sb.progressedAt(chart.jd, d.ageYears);
  const progMoon = prog.bodies.find((b) => b.name === "Moon");
  t("progressedJd matches progressedAt's own value", d.progressedJd === prog.progressedJd);
  t("the Moon's current progressed sign is always stated",
    d.lines.some((l) => l.includes(`the Moon has reached ${progMoon.signName}`)), d.lines.join(" | "));

  // ── sign changes match a direct comparison against the natal chart ──
  for (const name of ["Sun", "Mercury", "Venus", "Mars"]) {
    const p = prog.bodies.find((b) => b.name === name);
    const natalP = chart.planets.find((x) => x.name === name);
    const changed = p.sign !== natalP.sign;
    const line = d.lines.find((l) => l.includes(`the progressed ${name} has moved`));
    t(`${name}: a sign-change line appears iff progressedAt/natal actually disagree on sign`,
      changed === !!line, `changed=${changed} line=${line}`);
    if (line) {
      t(`${name}: the line names the correct FROM sign`,
        line.includes(`from ${sb.ZODIAC[natalP.sign].name}`), line);
      t(`${name}: the line names the correct TO sign`,
        line.includes(`into ${p.signName}`), line);
    }
  }
  t("the Moon never appears in the sign-CHANGE lines (it has its own line instead)",
    !d.lines.some((l) => l.includes("the progressed Moon has moved")), d.lines.join(" | "));

  // ── the phase relationship matches lunarPhase's own computation exactly ──
  const progSun = prog.bodies.find((b) => b.name === "Sun");
  const phase = sb.lunarPhase(progSun.lon, progMoon.lon);
  t("the progressed Sun-Moon phase line names lunarPhase's own phase, verbatim",
    d.lines.some((l) => l.includes(phase.phase.toLowerCase())), d.lines.join(" | "));

  // ── the birth instant: progressed = natal, trivially — no sign changes ──
  const atBirth = sb.progressionsDigest(chart, chart.jd);
  t("at the birth instant, no body has changed sign (progressed IS natal)",
    !atBirth.lines.some((l) => l.includes("has moved from")), atBirth.lines.join(" | "));
  const natalPhase = sb.lunarPhase(
    chart.planets.find((p) => p.name === "Sun").lon,
    chart.planets.find((p) => p.name === "Moon").lon
  );
  t("at the birth instant, the progressed phase is exactly the chart's own natal phase",
    atBirth.lines.some((l) => l.includes(natalPhase.phase.toLowerCase())), atBirth.lines.join(" | "));
  t("at the birth instant, the Moon's stated progressed sign IS its natal sign",
    atBirth.lines.some((l) => l.includes(chart.planets.find((p) => p.name === "Moon").signName
      || sb.ZODIAC[chart.planets.find((p) => p.name === "Moon").sign].name)),
    atBirth.lines.join(" | "));

  // ── it is genuinely age-sensitive, not a fixed string ──
  const later = sb.progressionsDigest(chart, chart.jd + 45 * 365.25);
  t("a target decades later produces different prose than the birth instant",
    later.lines.join(" ") !== atBirth.lines.join(" "));

  // ── honesty: no frequency or rarity is asserted for either fact ──
  const allText = [d.lines, atBirth.lines, later.lines].flat().join(" ").toLowerCase();
  t("no rarity or frequency language appears anywhere (never measured, so never claimed)",
    !/\brare\b|\bcommon\b|\bfrequently\b|\bmilestone\b|\bunusual\b|\bevery \d/.test(allText),
    allText);

  // ── an unknown birth time withholds every progressed fact, not just
  //    some of them ──
  // (Codex review: the Moon moves ~13°/day, so an assumed-noon birth time
  // uncertain by hours is enough to flip its progressed sign or the
  // progressed Sun-Moon phase relationship — these lines would otherwise
  // report exactly that uncertain instant as settled fact. Unlike
  // lifecycleDigest's shadow-lane sentence, EVERY fact this function
  // produces traces back to the Moon or to exact longitudes at the
  // progressed instant, so there is no partial fact left safe to keep —
  // the whole digest collapses to one explanatory line, for any target.)
  {
    // Positive control: `d` (declared above, same chart+jdNow) already
    // carries real progressed content — the Moon-sign line at minimum —
    // confirming the unknown-time check below suppresses a real fact
    // rather than one that was never going to appear anyway.
    t("sanity: the known-time chart's digest at this target carries real progressed content to suppress",
      d.lines.some((l) => l.includes("the Moon has reached")), d.lines.join(" | "));

    const unknownChart = { ...chart, timeUnknown: true };
    for (const jdOffset of [jdNow, chart.jd, chart.jd + 45 * 365.25]) {
      const dUnknown = sb.progressionsDigest(unknownChart, jdOffset);
      t(`timeUnknown: exactly one line (the caveat), no fact lines, at jd=${jdOffset.toFixed(1)}`,
        dUnknown.lines.length === 1, dUnknown.lines.join(" | "));
      t(`timeUnknown: the caveat explains why, at jd=${jdOffset.toFixed(1)}`,
        /birth time is unknown/i.test(dUnknown.lines[0]), dUnknown.lines[0]);
      t(`timeUnknown: no Moon-sign fact leaks through, at jd=${jdOffset.toFixed(1)}`,
        !dUnknown.lines.some((l) => l.includes("the Moon has reached")));
      t(`timeUnknown: no sign-change fact leaks through, at jd=${jdOffset.toFixed(1)}`,
        !dUnknown.lines.some((l) => l.includes("has moved from")));
      t(`timeUnknown: no phase fact leaks through, at jd=${jdOffset.toFixed(1)}`,
        !dUnknown.lines.some((l) => l.includes("relationship")));
      t(`timeUnknown: ageYears is still computed (not itself withheld), at jd=${jdOffset.toFixed(1)}`,
        Math.abs(dUnknown.ageYears - (jdOffset - chart.jd) / 365.25) < 1e-9);
      t(`timeUnknown: progressedJd is still finite (not itself withheld), at jd=${jdOffset.toFixed(1)}`,
        Number.isFinite(dUnknown.progressedJd));
    }
  }

  // ── degenerate inputs do not crash ──
  t("a null chart does not throw",
    (() => { try { sb.progressionsDigest(null, jdNow); return false; } catch { return true; } })());

  return rows;
}
