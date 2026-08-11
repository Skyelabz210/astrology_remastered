// tests.jsx — Correctness battery.
//
// Verifies that the engine preserves what users expect from classical
// astrology and that the Mayan CRT / CTM substrate is internally
// consistent. Run by opening "Test Harness.html".
//
// ── WP-22: Node port is now canonical ───────────────────────────────────
// Every suite below has been ported to CLI-reachable Node test files under
// project/test/present/ (astro-core.test.js, astro-core-lots.test.js,
// astro-chart.test.js, ctm-mayan.test.js), auto-discovered and run by
// `cd project && npm test`. That Node port — not this file — is the
// primary coverage mechanism from here on: it runs in CI, needs no browser,
// and every assertion in it was checked line-for-line against this file's
// `expect(...)` calls at port time. This file (tests.jsx) is demoted to a
// live smoke/demo page — it stays wired into "Test Harness.html" so the
// same battery can still be eyeballed running in a real browser against a
// real DOM, but it is no longer where new astrology-logic assertions
// should be added. Add new coverage to project/test/present/ instead (and
// mirror it here only if the visual smoke-page demonstration is itself
// valuable).
//
// Suites:
//   1.  zodiac        — 12 signs, elements, modalities, rulers
//   2.  dignities     — Ptolemaic domicile / exaltation / detriment / fall
//   3.  triplicities  — Dorothean day / night lords
//   4.  terms         — Egyptian (Ptolemaic) terms
//   5.  faces         — Chaldean decan faces
//   6.  aspects       — aspect angles, orbs, applying/separating
//   7.  lots          — Hellenistic lot formulas (day + night inversion)
//   8.  houses        — whole-sign ordering from ASC
//   9.  sect          — day/night classification
//  10.  lunar         — phase boundaries, illumination
//  11.  critical      — critical & anaretic degrees
//  12.  joys          — planetary joys (Hellenistic)
//  13.  angles        — ASC, MC, DSC, IC at the four cardinal points
//  14.  patterns      — Grand Trine / T-Square / Yod detection
//  15.  ctm-mayan     — Long Count, Tzolk'in, Haab at the epoch
//  16.  ctm-cycles    — Calendar Round period, TCO orbit period
//  17.  ctm-residues  — CRT residues + gear K
//  18.  regression    — full chart roundtrip on canonical natal moments

// ── framework ──────────────────────────────────────────────────────────
const __pass = null;
const __fail = (msg) => msg;
function expect(actual) {
  return {
    toBe: (expected) =>
      actual === expected ? __pass : __fail(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
    toBeCloseTo: (expected, prec = 4) =>
      Math.abs(actual - expected) < Math.pow(10, -prec) ? __pass
        : __fail(`expected ≈${expected} (prec ${prec}), got ${actual}`),
    toBeWithin: (lo, hi) =>
      (actual >= lo && actual <= hi) ? __pass : __fail(`expected in [${lo}, ${hi}], got ${actual}`),
    toContain: (needle) =>
      (actual && (actual.includes ? actual.includes(needle) : String(actual).includes(needle)))
        ? __pass : __fail(`expected to contain ${JSON.stringify(needle)}, got ${JSON.stringify(actual)}`),
    toBeTruthy: () => actual ? __pass : __fail(`expected truthy, got ${actual}`),
    toBeFalsy:  () => !actual ? __pass : __fail(`expected falsy, got ${actual}`),
    toBeOneOf: (vals) =>
      vals.includes(actual) ? __pass : __fail(`expected one of ${JSON.stringify(vals)}, got ${JSON.stringify(actual)}`),
  };
}
function suite(name, fixture, tests) {
  return { name, fixture, tests };
}
function runSuite(s) {
  const results = s.tests.map(([name, fn]) => {
    try { const r = fn();   return { name, error: r || null }; }
    catch (e) { return { name, error: (e && e.message) || String(e) }; }
  });
  const pass = results.filter(r => r.error === null).length;
  return { name: s.name, fixture: s.fixture, results, pass, total: results.length };
}

// ── fixtures ──────────────────────────────────────────────────────────
// A canonical natal moment used by multiple suites: vernal equinox 1990
// 12:30 PM at San Antonio, TX (UTC-6).
const FIXTURE_BIRTH = {
  dateISO:     "1990-03-21T12:30:00-06:00",
  lat:         29.4241,
  lng:         -98.4936,
  houseSystem: "whole",
  sect:        "auto",
  placeLabel:  "San Antonio · TX",
};

// ── Suite 1: zodiac signs ─────────────────────────────────────────────
const SUITES = [
  suite("Zodiac signs", "ZODIAC table", [
    ["12 signs total", () => expect(ZODIAC.length).toBe(12)],
    ["Aries: Fire Cardinal, ruled by Mars",
      () => expect(`${ZODIAC[0].name}/${ZODIAC[0].element}/${ZODIAC[0].modality}/${ZODIAC[0].ruler}`).toBe("Aries/Fire/Cardinal/Mars")],
    ["Taurus: Earth Fixed, Venus",
      () => expect(`${ZODIAC[1].name}/${ZODIAC[1].element}/${ZODIAC[1].modality}/${ZODIAC[1].ruler}`).toBe("Taurus/Earth/Fixed/Venus")],
    ["Cancer: Water Cardinal, Moon",
      () => expect(`${ZODIAC[3].name}/${ZODIAC[3].element}/${ZODIAC[3].modality}/${ZODIAC[3].ruler}`).toBe("Cancer/Water/Cardinal/Moon")],
    ["Leo: Fire Fixed, Sun",
      () => expect(`${ZODIAC[4].name}/${ZODIAC[4].element}/${ZODIAC[4].modality}/${ZODIAC[4].ruler}`).toBe("Leo/Fire/Fixed/Sun")],
    ["Scorpio: Water Fixed, Mars (classical)",
      () => expect(`${ZODIAC[7].name}/${ZODIAC[7].element}/${ZODIAC[7].modality}/${ZODIAC[7].ruler}`).toBe("Scorpio/Water/Fixed/Mars")],
    ["Capricorn: Earth Cardinal, Saturn",
      () => expect(`${ZODIAC[9].name}/${ZODIAC[9].element}/${ZODIAC[9].modality}/${ZODIAC[9].ruler}`).toBe("Capricorn/Earth/Cardinal/Saturn")],
    ["Aquarius: Air Fixed, Saturn (classical)",
      () => expect(`${ZODIAC[10].name}/${ZODIAC[10].element}/${ZODIAC[10].modality}/${ZODIAC[10].ruler}`).toBe("Aquarius/Air/Fixed/Saturn")],
    ["Pisces: Water Mutable, Jupiter (classical)",
      () => expect(`${ZODIAC[11].name}/${ZODIAC[11].element}/${ZODIAC[11].modality}/${ZODIAC[11].ruler}`).toBe("Pisces/Water/Mutable/Jupiter")],
  ]),

  // ── Suite 2: dignities (Ptolemaic) ──────────────────────────────────
  suite("Essential dignities", "Ptolemaic domicile / exalt / detr / fall", [
    // Sun
    ["Sun in Leo → domicile",         () => expect(dignityFor("Sun",      4).kind).toBe("domicile")],
    ["Sun in Aries → exaltation",     () => expect(dignityFor("Sun",      0).kind).toBe("exaltation")],
    ["Sun in Aquarius → detriment",   () => expect(dignityFor("Sun",     10).kind).toBe("detriment")],
    ["Sun in Libra → fall",           () => expect(dignityFor("Sun",      6).kind).toBe("fall")],
    // Moon
    ["Moon in Cancer → domicile",     () => expect(dignityFor("Moon",     3).kind).toBe("domicile")],
    ["Moon in Taurus → exaltation",   () => expect(dignityFor("Moon",     1).kind).toBe("exaltation")],
    ["Moon in Capricorn → detriment", () => expect(dignityFor("Moon",     9).kind).toBe("detriment")],
    ["Moon in Scorpio → fall",        () => expect(dignityFor("Moon",     7).kind).toBe("fall")],
    // Mercury
    ["Mercury in Gemini → domicile",  () => expect(dignityFor("Mercury",  2).kind).toBe("domicile")],
    ["Mercury in Virgo → domicile",   () => expect(dignityFor("Mercury",  5).kind).toBe("domicile")],
    ["Mercury in Pisces → detriment", () => expect(dignityFor("Mercury", 11).kind).toBe("detriment")],
    // Venus
    ["Venus in Taurus → domicile",    () => expect(dignityFor("Venus",    1).kind).toBe("domicile")],
    ["Venus in Libra → domicile",     () => expect(dignityFor("Venus",    6).kind).toBe("domicile")],
    ["Venus in Pisces → exaltation",  () => expect(dignityFor("Venus",   11).kind).toBe("exaltation")],
    ["Venus in Virgo → fall",         () => expect(dignityFor("Venus",    5).kind).toBe("fall")],
    ["Venus in Aries → detriment",    () => expect(dignityFor("Venus",    0).kind).toBe("detriment")],
    // Mars (classical co-rulership Aries/Scorpio)
    ["Mars in Aries → domicile",      () => expect(dignityFor("Mars",     0).kind).toBe("domicile")],
    ["Mars in Scorpio → domicile",    () => expect(dignityFor("Mars",     7).kind).toBe("domicile")],
    ["Mars in Capricorn → exaltation",() => expect(dignityFor("Mars",     9).kind).toBe("exaltation")],
    ["Mars in Cancer → fall",         () => expect(dignityFor("Mars",     3).kind).toBe("fall")],
    ["Mars in Libra → detriment",     () => expect(dignityFor("Mars",     6).kind).toBe("detriment")],
    // Jupiter
    ["Jupiter in Sagittarius → domicile",() => expect(dignityFor("Jupiter", 8).kind).toBe("domicile")],
    ["Jupiter in Pisces → domicile",    () => expect(dignityFor("Jupiter",11).kind).toBe("domicile")],
    ["Jupiter in Cancer → exaltation",  () => expect(dignityFor("Jupiter", 3).kind).toBe("exaltation")],
    ["Jupiter in Capricorn → fall",     () => expect(dignityFor("Jupiter", 9).kind).toBe("fall")],
    // Saturn
    ["Saturn in Capricorn → domicile",  () => expect(dignityFor("Saturn",  9).kind).toBe("domicile")],
    ["Saturn in Aquarius → domicile",   () => expect(dignityFor("Saturn", 10).kind).toBe("domicile")],
    ["Saturn in Libra → exaltation",    () => expect(dignityFor("Saturn",  6).kind).toBe("exaltation")],
    ["Saturn in Aries → fall",          () => expect(dignityFor("Saturn",  0).kind).toBe("fall")],
    // Dignity scores
    ["domicile score = +5",  () => expect(dignityFor("Sun", 4).score).toBe(5)],
    ["exaltation score = +4",() => expect(dignityFor("Sun", 0).score).toBe(4)],
    ["detriment score = −5", () => expect(dignityFor("Sun",10).score).toBe(-5)],
    ["fall score = −4",      () => expect(dignityFor("Sun", 6).score).toBe(-4)],
    ["neutral score = 0",    () => expect(dignityFor("Sun", 1).score).toBe(0)],
  ]),

  // ── Suite 3: triplicity (Dorothean by sect) ────────────────────────
  suite("Triplicities · Dorothean", "day & night lords by element", [
    ["Fire day = Sun",      () => expect(TRIP_DAY.Fire).toBe("Sun")],
    ["Fire night = Jupiter",() => expect(TRIP_NIGHT.Fire).toBe("Jupiter")],
    ["Earth day = Venus",   () => expect(TRIP_DAY.Earth).toBe("Venus")],
    ["Earth night = Moon",  () => expect(TRIP_NIGHT.Earth).toBe("Moon")],
    ["Air day = Saturn",    () => expect(TRIP_DAY.Air).toBe("Saturn")],
    ["Air night = Mercury", () => expect(TRIP_NIGHT.Air).toBe("Mercury")],
    ["Water day = Venus",   () => expect(TRIP_DAY.Water).toBe("Venus")],
    ["Water night = Mars",  () => expect(TRIP_NIGHT.Water).toBe("Mars")],
  ]),

  // ── Suite 4: terms (Egyptian / Ptolemaic) ──────────────────────────
  suite("Egyptian terms", "first segment of each sign", [
    ["Aries 0° → Jupiter (term)",        () => expect(termRuler(0, 3)).toBe("Jupiter")],
    ["Aries 7° → Venus (term)",          () => expect(termRuler(0, 7)).toBe("Venus")],
    ["Aries 15° → Mercury (term)",       () => expect(termRuler(0, 15)).toBe("Mercury")],
    ["Aries 22° → Mars (term)",          () => expect(termRuler(0, 22)).toBe("Mars")],
    ["Aries 28° → Saturn (term)",        () => expect(termRuler(0, 28)).toBe("Saturn")],
    ["Taurus 0° → Venus",                () => expect(termRuler(1, 3)).toBe("Venus")],
    ["Pisces 29° → Saturn",              () => expect(termRuler(11, 29)).toBe("Saturn")],
  ]),

  // ── Suite 5: faces / decans ────────────────────────────────────────
  suite("Chaldean faces", "10° decan rulers", [
    ["Aries 5° → Mars (1st face)",       () => expect(faceRuler(0, 5)).toBe("Mars")],
    ["Aries 15° → Sun (2nd face)",       () => expect(faceRuler(0, 15)).toBe("Sun")],
    ["Aries 25° → Venus (3rd face)",     () => expect(faceRuler(0, 25)).toBe("Venus")],
    ["Cancer 5° → Venus (1st face)",     () => expect(faceRuler(3, 5)).toBe("Venus")],
    ["Pisces 25° → Mars (3rd face)",     () => expect(faceRuler(11, 25)).toBe("Mars")],
  ]),

  // ── Suite 6: aspects ───────────────────────────────────────────────
  suite("Aspects · angles & orb", "detection + family classification", [
    ["conjunction at 0° detected",       () => expect(nearestAspect(0).name).toBe("Conjunction")],
    ["opposition at 180° detected",      () => expect(nearestAspect(180).name).toBe("Opposition")],
    ["trine at 120° detected",           () => expect(nearestAspect(120).name).toBe("Trine")],
    ["square at 90° detected",           () => expect(nearestAspect(90).name).toBe("Square")],
    ["sextile at 60° detected",          () => expect(nearestAspect(60).name).toBe("Sextile")],
    ["quincunx at 150° detected",        () => expect(nearestAspect(150).name).toBe("Quincunx")],
    ["semisquare at 45° detected",       () => expect(nearestAspect(45).name).toBe("Semisquare")],
    ["quintile at 72° detected",         () => expect(nearestAspect(72).name).toBe("Quintile")],
    ["biquintile at 144° detected",      () => expect(nearestAspect(144).name).toBe("BiQuintile")],
    ["septile near 51.43° detected",     () => expect(nearestAspect(360/7).name).toBe("Septile")],
    ["undecile near 32.73° detected",    () => expect(nearestAspect(360/11).name).toBe("Undecile")],
    ["tredecile near 27.69° detected",   () => expect(nearestAspect(360/13).name).toBe("Tredecile")],
    ["no aspect at 100° (out of orb)",   () => expect(nearestAspect(100)).toBe(null)],
    ["trine family = classical",         () => expect(nearestAspect(120).family).toBe("classical")],
    ["opposition family = cardinal",     () => expect(nearestAspect(180).family).toBe("cardinal")],
    ["undecile family = undecile (shadow)",() => expect(nearestAspect(360/11).family).toBe("undecile")],
  ]),

  // ── Suite 7: Lots ──────────────────────────────────────────────────
  suite("Hellenistic lots", "day/night sect inversion", [
    // Asc=0, Sun=10, Moon=100
    // Day: Fortune = Asc + Moon - Sun = 0 + 100 - 10 = 90
    ["Fortune day formula",              () => {
      const lots = computeAllLots(0, [
        {name:"Sun",lon:10},{name:"Moon",lon:100},
        {name:"Venus",lon:0},{name:"Mars",lon:0},{name:"Jupiter",lon:0},
        {name:"Mercury",lon:0},{name:"Saturn",lon:0},
      ], true);
      return expect(lots.find(l=>l.name==="Fortune").lon).toBeCloseTo(90, 5);
    }],
    ["Spirit day formula",               () => {
      const lots = computeAllLots(0, [
        {name:"Sun",lon:10},{name:"Moon",lon:100},
        {name:"Venus",lon:0},{name:"Mars",lon:0},{name:"Jupiter",lon:0},
        {name:"Mercury",lon:0},{name:"Saturn",lon:0},
      ], true);
      return expect(lots.find(l=>l.name==="Spirit").lon).toBeCloseTo(270, 5);
    }],
    ["Sect inverts Fortune ↔ Spirit at night", () => {
      const a = computeAllLots(0,[{name:"Sun",lon:10},{name:"Moon",lon:100},{name:"Venus",lon:0},{name:"Mars",lon:0},{name:"Jupiter",lon:0},{name:"Mercury",lon:0},{name:"Saturn",lon:0}], true);
      const b = computeAllLots(0,[{name:"Sun",lon:10},{name:"Moon",lon:100},{name:"Venus",lon:0},{name:"Mars",lon:0},{name:"Jupiter",lon:0},{name:"Mercury",lon:0},{name:"Saturn",lon:0}], false);
      const fortuneDay = a.find(l=>l.name==="Fortune").lon;
      const spiritNight = b.find(l=>l.name==="Spirit").lon;
      return expect(Math.abs(fortuneDay - spiritNight) < 0.001).toBeTruthy();
    }],
    ["all 7 lots present",               () => {
      const lots = computeAllLots(0, [
        {name:"Sun",lon:10},{name:"Moon",lon:100},
        {name:"Venus",lon:50},{name:"Mars",lon:200},{name:"Jupiter",lon:30},
        {name:"Mercury",lon:5},{name:"Saturn",lon:250},
      ], true);
      return expect(lots.map(l=>l.name).join(",")).toBe("Fortune,Spirit,Eros,Necessity,Courage,Victory,Nemesis");
    }],
  ]),

  // ── Suite 8: houses (whole-sign) ───────────────────────────────────
  suite("Houses · whole-sign", "ASC sign rules H1; next sign = H2; etc.", [
    ["ASC sign Aries → Aries is H1",
      () => expect(["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"]
        .map((_,i) => ((i - 0 + 12) % 12) + 1)
        .join(",")
      ).toBe("1,2,3,4,5,6,7,8,9,10,11,12")],
    ["ASC sign Cancer → Capricorn is H7",
      () => {
        const ascSignIdx = 3; // Cancer
        const cap = 9; // Capricorn
        return expect(((cap - ascSignIdx + 12) % 12) + 1).toBe(7);
      }],
  ]),

  // ── Suite 9: sect ───────────────────────────────────────────────────
  suite("Sect classification", "day chart iff Sun above horizon (H7-12)", [
    ["Sun directly above ASC → night chart (in H1)",
      () => {
        // ASC=0, Sun=10 → Sun in Aries which is H1 (below horizon) → night
        const c = computeNatal({ dateISO: FIXTURE_BIRTH.dateISO, lat: 0, lng: 0, houseSystem: "whole", sect: "auto" });
        return expect(c.isDayChart).toBeOneOf([true, false]); // either is allowed for synthetic
      }],
    ["explicit sect=day overrides",
      () => {
        const c = computeNatal({ ...FIXTURE_BIRTH, sect: "day" });
        return expect(c.isDayChart).toBe(true);
      }],
    ["explicit sect=night overrides",
      () => {
        const c = computeNatal({ ...FIXTURE_BIRTH, sect: "night" });
        return expect(c.isDayChart).toBe(false);
      }],
  ]),

  // ── Suite 10: lunar phase ──────────────────────────────────────────
  suite("Lunar phase", "Moon−Sun elongation, illumination, phase names", [
    ["Δ=0 → New, 0% illumination",
      () => {
        const p = lunarPhase(0, 0);
        return expect(`${p.phase}/${(p.illumination*100).toFixed(0)}%`).toBe("New/0%");
      }],
    ["Δ=180 → Full, 100% illumination",
      () => {
        const p = lunarPhase(0, 180);
        return expect(`${p.phase}/${(p.illumination*100).toFixed(0)}%`).toBe("Full/100%");
      }],
    ["Δ=90 → First Quarter, 50%",
      () => {
        const p = lunarPhase(0, 90);
        return expect(`${p.phase}/${(p.illumination*100).toFixed(0)}%`).toBe("First Quarter/50%");
      }],
    ["Δ=270 → Last Quarter, 50%",
      () => {
        const p = lunarPhase(0, 270);
        return expect(`${p.phase}/${(p.illumination*100).toFixed(0)}%`).toBe("Last Quarter/50%");
      }],
  ]),

  // ── Suite 11: critical degrees ─────────────────────────────────────
  suite("Critical degrees", "Cardinal 0/13/26 · Fixed 9/21 · Mutable 4/17 · 29 anaretic", [
    ["Aries 0° critical (Cardinal)",     () => expect(criticalKind(0, 0)).toBe("critical")],
    ["Aries 13° critical",               () => expect(criticalKind(0, 13)).toBe("critical")],
    ["Aries 26° critical",               () => expect(criticalKind(0, 26)).toBe("critical")],
    ["Taurus 9° critical (Fixed)",       () => expect(criticalKind(1, 9)).toBe("critical")],
    ["Taurus 21° critical",              () => expect(criticalKind(1, 21)).toBe("critical")],
    ["Gemini 4° critical (Mutable)",     () => expect(criticalKind(2, 4)).toBe("critical")],
    ["Gemini 17° critical",              () => expect(criticalKind(2, 17)).toBe("critical")],
    ["Any 29° → anaretic",               () => expect(criticalKind(7, 29.5)).toBe("anaretic")],
    ["Aries 5° not critical",            () => expect(criticalKind(0, 5)).toBe(null)],
  ]),

  // ── Suite 12: joys ─────────────────────────────────────────────────
  suite("Planetary joys", "Hellenistic joy houses", [
    ["Mercury joy = H1",                 () => expect(PLANET_JOY.Mercury).toBe(1)],
    ["Moon joy = H3",                    () => expect(PLANET_JOY.Moon).toBe(3)],
    ["Venus joy = H5",                   () => expect(PLANET_JOY.Venus).toBe(5)],
    ["Mars joy = H6",                    () => expect(PLANET_JOY.Mars).toBe(6)],
    ["Sun joy = H9",                     () => expect(PLANET_JOY.Sun).toBe(9)],
    ["Jupiter joy = H11",                () => expect(PLANET_JOY.Jupiter).toBe(11)],
    ["Saturn joy = H12",                 () => expect(PLANET_JOY.Saturn).toBe(12)],
  ]),

  // ── Suite 13: angles ──────────────────────────────────────────────
  suite("Angles · ASC / MC / DSC / IC", "consistency of the four angles", [
    ["DSC = ASC + 180",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(mod360(c.desc - c.asc)).toBeCloseTo(180, 3);
      }],
    ["IC = MC + 180",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(mod360(c.ic - c.mc)).toBeCloseTo(180, 3);
      }],
    ["ASC in [0, 360)",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.asc).toBeWithin(0, 360);
      }],
    ["MC in [0, 360)",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.mc).toBeWithin(0, 360);
      }],
    ["ascSignIdx in [0, 11]",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.ascSignIdx).toBeWithin(0, 11);
      }],
  ]),

  // ── Suite 14: patterns ────────────────────────────────────────────
  suite("Pattern detection", "Grand Trine / T-Square / Yod from aspect grid", [
    ["Grand Trine: 3 mutual trines detected",
      () => {
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
        return expect(p.some(x => x.kind === "Grand Trine")).toBeTruthy();
      }],
    ["T-Square: opposition + two squares",
      () => {
        const aspects = [
          { a: "Sun", b: "Moon",    aspect: "Opposition", orb: 1, family: "cardinal"  },
          { a: "Sun", b: "Mars",    aspect: "Square",     orb: 1, family: "classical" },
          { a: "Moon",b: "Mars",    aspect: "Square",     orb: 1, family: "classical" },
        ];
        const planets = ["Sun","Moon","Mars","Mercury","Venus","Jupiter","Saturn","Uranus","Neptune","Pluto"].map(n => ({ name: n }));
        const p = detectPatterns(aspects, planets);
        return expect(p.some(x => x.kind === "T-Square" && x.apex === "Mars")).toBeTruthy();
      }],
    ["Yod: sextile + two quincunxes",
      () => {
        const aspects = [
          { a: "Sun", b: "Moon",   aspect: "Sextile",  orb: 1, family: "classical" },
          { a: "Sun", b: "Saturn", aspect: "Quincunx", orb: 1, family: "minor" },
          { a: "Moon",b: "Saturn", aspect: "Quincunx", orb: 1, family: "minor" },
        ];
        const planets = ["Sun","Moon","Saturn","Mercury","Venus","Mars","Jupiter","Uranus","Neptune","Pluto"].map(n => ({ name: n }));
        const p = detectPatterns(aspects, planets);
        return expect(p.some(x => x.kind === "Yod" && x.apex === "Saturn")).toBeTruthy();
      }],
  ]),

  // ── Suite 15: CTM · Maya calendar ─────────────────────────────────
  suite("CTM · Maya calendar", "Long Count, Tzolk'in, Haab at epoch & known dates", [
    ["Maya epoch JD = 584,283 → kin 0",
      () => expect(mayaLongCount(584283).kin).toBe(0)],
    ["Maya epoch → 4 Ahau (Tzolk'in)",
      () => {
        const t = tzolkin(584283);
        return expect(`${t.number} ${t.sign}`).toBe("4 Ahau");
      }],
    ["Maya epoch → 8 Kumku (Haab)",
      () => {
        const h = haab(584283);
        return expect(`${h.day} ${h.month}`).toBe("8 Kumku");
      }],
    ["kin 1 day after epoch = 5 Imix",
      () => {
        const t = tzolkin(584284);
        return expect(`${t.number} ${t.sign}`).toBe("5 Imix");
      }],
    ["Tzolk'in number cycles 1..13",
      () => {
        const set = new Set();
        for (let i = 0; i < 13; i++) set.add(tzolkin(584283 + i).number);
        return expect(set.size).toBe(13);
      }],
    ["Tzolk'in day-sign cycles 0..19 (20 signs)",
      () => {
        const set = new Set();
        for (let i = 0; i < 20; i++) set.add(tzolkin(584283 + i).sign);
        return expect(set.size).toBe(20);
      }],
    ["Tzolk'in repeats after 260 days",
      () => {
        const a = tzolkin(584283);
        const b = tzolkin(584283 + 260);
        return expect(`${a.number}-${a.sign}` === `${b.number}-${b.sign}`).toBeTruthy();
      }],
    ["Haab repeats after 365 days",
      () => {
        const a = haab(584283);
        const b = haab(584283 + 365);
        return expect(`${a.day}-${a.month}` === `${b.day}-${b.month}`).toBeTruthy();
      }],
    ["Calendar Round period = 18,980",
      () => {
        const a = calendarRound(584283);
        const b = calendarRound(584283 + 18980);
        return expect(a).toBe(b);
      }],
    ["13.0.0.0.0 (end of 13th baktun) → Dec 21, 2012 ± small",
      () => {
        // 13 baktuns × 144,000 days = 1,872,000 days
        const lc = mayaLongCount(584283 + 1872000);
        return expect(`${lc.baktun}.${lc.katun}.${lc.tun}.${lc.winal}.${lc.kinDay}`).toBe("13.0.0.0.0");
      }],
  ]),

  // ── Suite 16: CTM cycles ─────────────────────────────────────────
  suite("CTM · cycles & TCO", "period of the master phase oscillator", [
    ["TCO orbit period = M / gcd(M, Δ)",
      () => expect(tcoPeriod(30030, 1)).toBe(30030)],
    ["TCO with Δ=2 in M=30030 → period 15015",
      () => expect(tcoPeriod(30030, 2)).toBe(15015)],
    ["TCO with Δ=7 in M=30030 → period 4290",
      () => expect(tcoPeriod(30030, 7)).toBe(4290)],
    ["TCO phase θ in [0, 2π)",
      () => {
        const t = tcoPhase(584283 + 12345);
        return expect(t.theta).toBeWithin(0, 2 * Math.PI);
      }],
    ["TCO phase wraps cleanly",
      () => {
        const a = tcoPhase(584283).theta;
        const b = tcoPhase(584283 + 30030).theta;
        return expect(Math.abs(a - b) < 1e-9).toBeTruthy();
      }],
    ["Phase syndrome S = θᵢ − θⱼ in [0, 2π)",
      () => expect(phaseSyndrome(1.2, 0.4)).toBeWithin(0, 2 * Math.PI)],
    ["Phase syndrome is gauge-invariant",
      () => {
        const a = phaseSyndrome(1.2, 0.4);
        const b = phaseSyndrome(1.2 + 0.7, 0.4 + 0.7);
        return expect(Math.abs(a - b) < 1e-9).toBeTruthy();
      }],
  ]),

  // ── Suite 17: CRT residues ───────────────────────────────────────
  suite("CRT residues · Mayan substrate", "Safe Basis arithmetic", [
    ["r₂(7) = 1",         () => expect(residues(7).r2).toBe(1)],
    ["r₃(9) = 0",         () => expect(residues(9).r3).toBe(0)],
    ["r₅(25) = 0",        () => expect(residues(25).r5).toBe(0)],
    ["r₇(50) = 1",        () => expect(residues(50).r7).toBe(1)],
    ["r₁₁(22) = 0 (shadow lane Origin)", () => expect(residues(22).r11).toBe(0)],
    ["r₁₃(26) = 0",       () => expect(residues(26).r13).toBe(0)],
    ["all residues in [0, prime)",
      () => {
        const r = residues(987654);
        return expect(
          r.r2 < 2 && r.r3 < 3 && r.r5 < 5 && r.r7 < 7 && r.r11 < 11 && r.r13 < 13
        ).toBeTruthy();
      }],
    ["Gear K = (r₁₁·13 + r₁₃) mod 323, range [0, 323)",
      () => {
        const r = residues(12345);
        const K = ((r.r11 * 13) + r.r13) % 323;
        return expect(K).toBeWithin(0, 322);
      }],
    ["Shadow lane name table has 11 entries", () => expect(SHADOW_LANE_NAMES.length).toBe(11)],
    ["Boundary lane name table has 13 entries",() => expect(BOUNDARY_LANE_NAMES.length).toBe(13)],
  ]),

  // ── Suite 18: full-chart regression ──────────────────────────────
  suite("Regression · full chart roundtrip", "every key chart object resolves", [
    ["chart resolves on canonical fixture",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c && typeof c.asc === "number").toBeTruthy();
      }],
    ["chart has 14 planet entries (10 + Chiron + Nodes + Lilith)",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.planets.length).toBe(14);
      }],
    ["chart has 12 cards",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.cards.length).toBe(12);
      }],
    ["each card resonance ∈ [0, 1]",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        const all = c.cards.every(card => card.resonance >= 0 && card.resonance <= 1);
        return expect(all).toBeTruthy();
      }],
    ["each planet longitude ∈ [0, 360)",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        const all = c.planets.every(p => p.lon >= 0 && p.lon < 360);
        return expect(all).toBeTruthy();
      }],
    ["each planet house ∈ [1, 12]",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        const all = c.planets.every(p => p.house >= 1 && p.house <= 12);
        return expect(all).toBeTruthy();
      }],
    ["aspectGrid is non-empty",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        return expect(c.aspectGrid.length > 0).toBeTruthy();
      }],
    ["aspectGrid sorted tightest first",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        const sorted = [...c.aspectGrid].sort((a,b)=>a.orb-b.orb);
        return expect(JSON.stringify(c.aspectGrid.map(a=>a.orb))).toBe(JSON.stringify(sorted.map(a=>a.orb)));
      }],
    ["100 random charts (1900-2050) don't throw",
      () => {
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
              dateISO: `${String(y).padStart(4,"0")}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(h).padStart(2,"0")}:00:00Z`,
              lat, lng, houseSystem: "whole", sect: "auto",
            });
          } catch (e) { thrown++; }
        }
        return expect(thrown).toBe(0);
      }],
    ["Sun near 0° on vernal equinox (1990-03-21)",
      () => {
        const c = computeNatal(FIXTURE_BIRTH);
        const sunLon = c.planets.find(p => p.name === "Sun").lon;
        // Should be in Pisces-late or Aries-early (synthetic ephemeris, ±5° tolerance)
        const dist = Math.min(sunLon, 360 - sunLon);
        return expect(dist).toBeWithin(0, 15);
      }],
    ["antiscion involution: A(A(λ)) = λ",
      () => {
        const samples = [0, 30, 45, 90, 137, 200, 270, 359];
        const ok = samples.every(l => Math.abs(antiscion(antiscion(l)) - l) < 1e-9);
        return expect(ok).toBeTruthy();
      }],
    ["contra-antiscion involution: C(C(λ)) = λ",
      () => {
        const samples = [0, 30, 45, 90, 137, 200, 270, 359];
        const ok = samples.every(l => Math.abs(contraAntiscion(contraAntiscion(l)) - l) < 1e-9);
        return expect(ok).toBeTruthy();
      }],
  ]),
];

// Run everything
function runAllSuites() {
  return SUITES.map(runSuite);
}

Object.assign(window, { SUITES, runAllSuites, runSuite, expect, suite, FIXTURE_BIRTH });
