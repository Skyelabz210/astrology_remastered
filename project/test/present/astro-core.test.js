// test/present/astro-core.test.js — WP-22: Node port of tests.jsx's
// dignity / triplicity / term / face / aspect / critical-degree / joy /
// pattern-detection suites against the real WP-21 module,
// project/src/present/astro-core.js.
//
// This is a FAITHFUL PORT, not a redesign: every assertion below reproduces
// a specific `expect(...)` line from project/tests.jsx (suites 2-6, 11, 12,
// 14 — see that file's own numbered suite list in its header comment),
// same inputs, same expected values. tests.jsx itself now carries a header
// pointing back here as the canonical CLI coverage (project/tests.jsx stays
// a live browser smoke/demo page, loaded by "Test Harness.html").
//
// Suites NOT ported into this file (ported elsewhere, or not applicable):
//   - zodiac (1), houses/whole-sign (8), sect (9), angles (13),
//     regression (18) — need computeNatal()/ZODIAC, which live in
//     astro.jsx (a browser classic script, not this ES module) →
//     test/present/astro-chart.test.js.
//   - lots (7), lunar phase (10), CRT residues (17) →
//     test/present/astro-core-lots.test.js.
//   - Maya calendar (15), TCO cycles (16) — live in time.jsx, not
//     astro-core.js → test/present/ctm-mayan.test.js.

import {
  dignityFor,
  TRIP_DAY, TRIP_NIGHT, TRIP_PART,
  termRuler,
  faceRuler,
  nearestAspect,
  applyingPhase,
  criticalKind,
  PLANET_JOY,
  detectPatterns,
} from "../../src/present/astro-core.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── Suite 2: Essential dignities (Ptolemaic) ──────────────────────────
  // tests.jsx: suite("Essential dignities", ...)
  t("Sun in Leo → domicile",         dignityFor("Sun",      4).kind === "domicile");
  t("Sun in Aries → exaltation",     dignityFor("Sun",      0).kind === "exaltation");
  t("Sun in Aquarius → detriment",   dignityFor("Sun",     10).kind === "detriment");
  t("Sun in Libra → fall",           dignityFor("Sun",      6).kind === "fall");
  t("Moon in Cancer → domicile",     dignityFor("Moon",     3).kind === "domicile");
  t("Moon in Taurus → exaltation",   dignityFor("Moon",     1).kind === "exaltation");
  t("Moon in Capricorn → detriment", dignityFor("Moon",     9).kind === "detriment");
  t("Moon in Scorpio → fall",        dignityFor("Moon",     7).kind === "fall");
  t("Mercury in Gemini → domicile",  dignityFor("Mercury",  2).kind === "domicile");
  t("Mercury in Virgo → domicile",   dignityFor("Mercury",  5).kind === "domicile");
  t("Mercury in Pisces → detriment", dignityFor("Mercury", 11).kind === "detriment");
  t("Venus in Taurus → domicile",    dignityFor("Venus",    1).kind === "domicile");
  t("Venus in Libra → domicile",     dignityFor("Venus",    6).kind === "domicile");
  t("Venus in Pisces → exaltation",  dignityFor("Venus",   11).kind === "exaltation");
  t("Venus in Virgo → fall",         dignityFor("Venus",    5).kind === "fall");
  t("Venus in Aries → detriment",    dignityFor("Venus",    0).kind === "detriment");
  t("Mars in Aries → domicile",      dignityFor("Mars",     0).kind === "domicile");
  t("Mars in Scorpio → domicile",    dignityFor("Mars",     7).kind === "domicile");
  t("Mars in Capricorn → exaltation",dignityFor("Mars",     9).kind === "exaltation");
  t("Mars in Cancer → fall",         dignityFor("Mars",     3).kind === "fall");
  t("Mars in Libra → detriment",     dignityFor("Mars",     6).kind === "detriment");
  t("Jupiter in Sagittarius → domicile", dignityFor("Jupiter", 8).kind === "domicile");
  t("Jupiter in Pisces → domicile",      dignityFor("Jupiter",11).kind === "domicile");
  t("Jupiter in Cancer → exaltation",    dignityFor("Jupiter", 3).kind === "exaltation");
  t("Jupiter in Capricorn → fall",       dignityFor("Jupiter", 9).kind === "fall");
  t("Saturn in Capricorn → domicile",    dignityFor("Saturn",  9).kind === "domicile");
  t("Saturn in Aquarius → domicile",     dignityFor("Saturn", 10).kind === "domicile");
  t("Saturn in Libra → exaltation",      dignityFor("Saturn",  6).kind === "exaltation");
  t("Saturn in Aries → fall",            dignityFor("Saturn",  0).kind === "fall");
  t("domicile score = +5",   dignityFor("Sun", 4).score === 5);
  t("exaltation score = +4", dignityFor("Sun", 0).score === 4);
  t("detriment score = −5",  dignityFor("Sun",10).score === -5);
  t("fall score = −4",       dignityFor("Sun", 6).score === -4);
  t("neutral score = 0",     dignityFor("Sun", 1).score === 0);

  // ── Suite 3: Triplicities · Dorothean day & night lords ──────────────
  t("Fire day = Sun",       TRIP_DAY.Fire === "Sun");
  t("Fire night = Jupiter", TRIP_NIGHT.Fire === "Jupiter");
  t("Earth day = Venus",    TRIP_DAY.Earth === "Venus");
  t("Earth night = Moon",   TRIP_NIGHT.Earth === "Moon");
  t("Air day = Saturn",     TRIP_DAY.Air === "Saturn");
  t("Air night = Mercury",  TRIP_NIGHT.Air === "Mercury");
  t("Water day = Venus",    TRIP_DAY.Water === "Venus");
  t("Water night = Mars",   TRIP_NIGHT.Water === "Mars");

  // ── Regression: TRIP_PART (participating triplicity ruler, Dorothean) ──
  // Previously untested — an earlier version had Fire/Earth/Air wrong
  // (Fire and Air each duplicated their own TRIP_NIGHT ruler, which is
  // itself a giveaway: a triplicity is supposed to have three DISTINCT
  // rulers, day/night/participating).
  t("Fire participating = Saturn",  TRIP_PART.Fire === "Saturn");
  t("Earth participating = Mars",   TRIP_PART.Earth === "Mars");
  t("Air participating = Jupiter",  TRIP_PART.Air === "Jupiter");
  t("Water participating = Moon",   TRIP_PART.Water === "Moon");
  t("every triplicity's three rulers (day/night/participating) are distinct",
    ["Fire", "Earth", "Air", "Water"].every((elem) => {
      const trio = [TRIP_DAY[elem], TRIP_NIGHT[elem], TRIP_PART[elem]];
      return new Set(trio).size === 3;
    }));

  // ── Suite 4: Egyptian terms (Ptolemaic) ───────────────────────────────
  t("Aries 0° → Jupiter (term)",  termRuler(0, 3)  === "Jupiter");
  t("Aries 7° → Venus (term)",    termRuler(0, 7)  === "Venus");
  t("Aries 15° → Mercury (term)", termRuler(0, 15) === "Mercury");
  t("Aries 22° → Mars (term)",    termRuler(0, 22) === "Mars");
  t("Aries 28° → Saturn (term)",  termRuler(0, 28) === "Saturn");
  t("Taurus 0° → Venus",          termRuler(1, 3)  === "Venus");
  t("Pisces 29° → Saturn",        termRuler(11, 29) === "Saturn");

  // ── Suite 5: Chaldean faces (10° decan rulers) ────────────────────────
  t("Aries 5° → Mars (1st face)",   faceRuler(0, 5)  === "Mars");
  t("Aries 15° → Sun (2nd face)",   faceRuler(0, 15) === "Sun");
  t("Aries 25° → Venus (3rd face)", faceRuler(0, 25) === "Venus");
  t("Cancer 5° → Venus (1st face)", faceRuler(3, 5)  === "Venus");
  t("Pisces 25° → Mars (3rd face)", faceRuler(11, 25) === "Mars");

  // ── Suite 6: Aspects · angles & orb ───────────────────────────────────
  t("conjunction at 0° detected",  nearestAspect(0).name   === "Conjunction");
  t("opposition at 180° detected", nearestAspect(180).name === "Opposition");
  t("trine at 120° detected",      nearestAspect(120).name === "Trine");
  t("square at 90° detected",      nearestAspect(90).name  === "Square");
  t("sextile at 60° detected",     nearestAspect(60).name  === "Sextile");
  t("quincunx at 150° detected",   nearestAspect(150).name === "Quincunx");
  t("semisquare at 45° detected",  nearestAspect(45).name  === "Semisquare");
  t("quintile at 72° detected",    nearestAspect(72).name  === "Quintile");
  t("biquintile at 144° detected", nearestAspect(144).name === "BiQuintile");
  t("septile near 51.43° detected",   nearestAspect(360 / 7).name  === "Septile");
  t("undecile near 32.73° detected",  nearestAspect(360 / 11).name === "Undecile");
  t("tredecile near 27.69° detected", nearestAspect(360 / 13).name === "Tredecile");
  t("no aspect at 100° (out of orb)", nearestAspect(100) === null);

  // ── Regression: applyingPhase for fast-body/small-orb aspects ─────────
  // An earlier version used a whole-DAY forward-Euler step to decide
  // direction; for a body closing faster than the orb is wide (the Moon
  // against slower bodies is typically 11-15°/day, well past the default
  // 2-8° orbs), the day-step overshoots exact and lands back on the far
  // side, misreporting "separating" for a pair that is actually applying.
  // Moon at 95°, other body at 100°, relative speed 12°/day (13-1):
  // instantaneously closing on the 0° conjunction (separation 5° and
  // shrinking) -> must be "applying", not "separating".
  t("applyingPhase: fast Moon-like body closing a small orb reports 'applying', not 'separating'",
    applyingPhase(95, 100, 13, 1, 0) === "applying");
  // Mirror case: moving away from exact should still report "separating".
  t("applyingPhase: fast body moving away from a small orb still reports 'separating'",
    applyingPhase(95, 100, -13, 1, 0) === "separating");
  // Ordinary slow-body case (well within a day-step) still works as before.
  t("applyingPhase: slow bodies approaching a trine report 'applying'",
    applyingPhase(115, 0, 1, 0.5, 120) === "applying");
  t("trine family = classical",       nearestAspect(120).family === "classical");
  t("opposition family = cardinal",   nearestAspect(180).family === "cardinal");
  t("undecile family = undecile (shadow)", nearestAspect(360 / 11).family === "undecile");

  // ── Suite 11: Critical degrees ────────────────────────────────────────
  // Cardinal 0/13/26 · Fixed 9/21 · Mutable 4/17 · 29 anaretic
  t("Aries 0° critical (Cardinal)",  criticalKind(0, 0)  === "critical");
  t("Aries 13° critical",            criticalKind(0, 13) === "critical");
  t("Aries 26° critical",            criticalKind(0, 26) === "critical");
  t("Taurus 9° critical (Fixed)",    criticalKind(1, 9)  === "critical");
  t("Taurus 21° critical",           criticalKind(1, 21) === "critical");
  t("Gemini 4° critical (Mutable)",  criticalKind(2, 4)  === "critical");
  t("Gemini 17° critical",           criticalKind(2, 17) === "critical");
  t("Any 29° → anaretic",            criticalKind(7, 29.5) === "anaretic");
  t("Aries 5° not critical",         criticalKind(0, 5)  === null);

  // ── Suite 12: Planetary joys (Hellenistic) ────────────────────────────
  t("Mercury joy = H1",  PLANET_JOY.Mercury === 1);
  t("Moon joy = H3",     PLANET_JOY.Moon === 3);
  t("Venus joy = H5",    PLANET_JOY.Venus === 5);
  t("Mars joy = H6",     PLANET_JOY.Mars === 6);
  t("Sun joy = H9",      PLANET_JOY.Sun === 9);
  t("Jupiter joy = H11", PLANET_JOY.Jupiter === 11);
  t("Saturn joy = H12",  PLANET_JOY.Saturn === 12);

  // ── Suite 14: Pattern detection — Grand Trine / T-Square / Yod ───────
  {
    const aspects = [
      { a: "Sun",     b: "Moon",    aspect: "Trine", orb: 1, family: "classical" },
      { a: "Moon",    b: "Jupiter", aspect: "Trine", orb: 1, family: "classical" },
      { a: "Sun",     b: "Jupiter", aspect: "Trine", orb: 1, family: "classical" },
    ];
    const planets = [
      { name: "Sun" }, { name: "Moon" }, { name: "Jupiter" },
      { name: "Mercury" }, { name: "Venus" }, { name: "Mars" }, { name: "Saturn" }, { name: "Uranus" }, { name: "Neptune" }, { name: "Pluto" },
    ];
    const p = detectPatterns(aspects, planets);
    t("Grand Trine: 3 mutual trines detected", p.some((x) => x.kind === "Grand Trine"));
  }
  {
    const aspects = [
      { a: "Sun", b: "Moon",    aspect: "Opposition", orb: 1, family: "cardinal"  },
      { a: "Sun", b: "Mars",    aspect: "Square",     orb: 1, family: "classical" },
      { a: "Moon",b: "Mars",    aspect: "Square",     orb: 1, family: "classical" },
    ];
    const planets = ["Sun","Moon","Mars","Mercury","Venus","Jupiter","Saturn","Uranus","Neptune","Pluto"].map((n) => ({ name: n }));
    const p = detectPatterns(aspects, planets);
    t("T-Square: opposition + two squares", p.some((x) => x.kind === "T-Square" && x.apex === "Mars"));
  }
  {
    const aspects = [
      { a: "Sun", b: "Moon",   aspect: "Sextile",  orb: 1, family: "classical" },
      { a: "Sun", b: "Saturn", aspect: "Quincunx", orb: 1, family: "minor" },
      { a: "Moon",b: "Saturn", aspect: "Quincunx", orb: 1, family: "minor" },
    ];
    const planets = ["Sun","Moon","Saturn","Mercury","Venus","Mars","Jupiter","Uranus","Neptune","Pluto"].map((n) => ({ name: n }));
    const p = detectPatterns(aspects, planets);
    t("Yod: sextile + two quincunxes", p.some((x) => x.kind === "Yod" && x.apex === "Saturn"));
  }

  return R;
}
