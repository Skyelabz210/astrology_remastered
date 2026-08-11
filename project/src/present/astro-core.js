// project/src/present/astro-core.js — pure interpretation logic. (WP-21)
//
// Extracted out of project/astro.jsx, which is being decomposed into "data
// tables + thin wrapper functions that call into AstroCore" (astro.jsx's own
// header explains the split). This module holds astrology's INTERPRETIVE
// layer: given already-computed ecliptic longitudes (from whichever
// ephemeris source astro.jsx chose — real astronomy-engine or the synthetic
// mean-motion fallback, see astro.jsx's WP-17 header comment), derive
// dignities, terms, faces, triplicities, Hellenistic lots, day/night sect,
// aspect detection (incl. the orb table), and pattern detection (Grand
// Trine / T-Square / Grand Cross / Yod) — plus a handful of closely related
// classical techniques that likewise operate purely on longitudes/signs/
// degrees and never touch a clock, a time zone, or an ephemeris source:
// critical degrees, planetary joys, antiscia, lunar phase, chart shape
// (Jones gestalt), whole-sign/equal houses, and the CRT (mod 2/3/5/7/11/13)
// residues. That is the boundary WP-21 draws between "which data source"
// (position/speed/retrograde computation — stays in astro.jsx) and "what
// does the position mean" (this file).
//
// Dual-environment export, mirroring project/core-shim.js's (WP-14) ES side
// of the same bridge pattern: every function/table below is a named ES
// `export` (for `import` from Node, e.g. a future
// project/test/present/astro-core.test.js — WP-22) AND assembled onto
// `window.AstroCore` when a `window` exists, so the classic
// (Babel-standalone `text/babel`) astro.jsx script — which cannot `import`
// anything, since it is not itself a module — can call
// `AstroCore.dignityFor(...)` etc. after a
// `<script type="module" src="src/present/astro-core.js"></script>` tag runs
// before it. That ordering is safe for the same reason core-shim.js's is:
// module scripts execute (in document order among themselves) after parsing
// completes but before `DOMContentLoaded`, and Babel-standalone only
// transforms/runs `text/babel` tags on `DOMContentLoaded`.
//
// Floats and Math.* are fully legal here — this directory is
// project/src/present/, NOT project/src/core/, and is outside the no-float
// audit's CORE_MANIFEST (see project/test/no-float-audit.js — it scans only
// the src/core directory listing, never src/present).

// ── shared angle helper ─────────────────────────────────────────────────
// Deliberately duplicated (not imported) from astro.jsx's own copy: this
// file has no bundler/build step, astro.jsx is a classic script that cannot
// export anything for this module to import back, and the function is a
// trivial one-liner — duplication is cheaper and safer here than inventing a
// shared-utility import path across that module/classic-script boundary.
export function mod360(x) {
  let m = x % 360;
  if (m < 0) m += 360;
  return m;
}

// ──────────────────────────────────────────────────────────────────────
// Dignities — Ptolemaic domicile / exaltation / detriment / fall.
// sign-index 0=Aries .. 11=Pisces.
// ──────────────────────────────────────────────────────────────────────
export const DOMICILE = {
  Sun: [4], Moon: [3], Mercury: [2,5], Venus: [1,6], Mars: [0,7],
  Jupiter: [8,11], Saturn: [9,10], Uranus: [10], Neptune: [11], Pluto: [7],
};
export const EXALT = { Sun:0, Moon:1, Mercury:5, Venus:11, Mars:9, Jupiter:3, Saturn:6, Uranus:7, Neptune:3, Pluto:0 };

export function opp(i) { return (i + 6) % 12; }

export function dignityFor(planet, signIdx) {
  const dom = DOMICILE[planet] ?? [];
  const exalt = EXALT[planet];
  if (dom.includes(signIdx))                  return { kind: "domicile",   score:  5 };
  if (exalt === signIdx)                      return { kind: "exaltation", score:  4 };
  if (dom.some(d => opp(d) === signIdx))      return { kind: "detriment",  score: -5 };
  if (exalt !== undefined && opp(exalt) === signIdx) return { kind: "fall", score: -4 };
  return { kind: "neutral", score: 0 };
}

// Triplicity lords by sect (Dorothean)
export const TRIP_DAY   = { Fire:"Sun",    Earth:"Venus", Air:"Saturn",  Water:"Venus" };
export const TRIP_NIGHT = { Fire:"Jupiter",Earth:"Moon",  Air:"Mercury", Water:"Mars"  };
export const TRIP_PART  = { Fire:"Jupiter",Earth:"Mercury",Air:"Mercury",Water:"Moon"  }; // participating

// Egyptian terms — each sign 30° partitioned into 5 unequal segments
// (degrees of upper bound, ruler). From Ptolemy.
export const EGYPTIAN_TERMS = [
  // Aries
  [[6,"Jupiter"],[12,"Venus"],[20,"Mercury"],[25,"Mars"],[30,"Saturn"]],
  // Taurus
  [[8,"Venus"],[14,"Mercury"],[22,"Jupiter"],[27,"Saturn"],[30,"Mars"]],
  // Gemini
  [[6,"Mercury"],[12,"Jupiter"],[17,"Venus"],[24,"Mars"],[30,"Saturn"]],
  // Cancer
  [[7,"Mars"],[13,"Venus"],[19,"Mercury"],[26,"Jupiter"],[30,"Saturn"]],
  // Leo
  [[6,"Jupiter"],[11,"Venus"],[18,"Saturn"],[24,"Mercury"],[30,"Mars"]],
  // Virgo
  [[7,"Mercury"],[17,"Venus"],[21,"Jupiter"],[28,"Mars"],[30,"Saturn"]],
  // Libra
  [[6,"Saturn"],[14,"Mercury"],[21,"Jupiter"],[28,"Venus"],[30,"Mars"]],
  // Scorpio
  [[7,"Mars"],[11,"Venus"],[19,"Mercury"],[24,"Jupiter"],[30,"Saturn"]],
  // Sagittarius
  [[12,"Jupiter"],[17,"Venus"],[21,"Mercury"],[26,"Saturn"],[30,"Mars"]],
  // Capricorn
  [[7,"Mercury"],[14,"Jupiter"],[22,"Venus"],[26,"Saturn"],[30,"Mars"]],
  // Aquarius
  [[7,"Mercury"],[13,"Venus"],[20,"Jupiter"],[25,"Mars"],[30,"Saturn"]],
  // Pisces
  [[12,"Venus"],[16,"Jupiter"],[19,"Mercury"],[28,"Mars"],[30,"Saturn"]],
];

export function termRuler(signIdx, degInSign) {
  for (const [upper, ruler] of EGYPTIAN_TERMS[signIdx]) {
    if (degInSign < upper) return ruler;
  }
  return EGYPTIAN_TERMS[signIdx][4][1];
}

// Triplicity-decan faces (Chaldean order, 10° each)
export const CHALDEAN = ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon"];
export function faceRuler(signIdx, degInSign) {
  // Face 0 of Aries = Mars (Aries' lord). Subsequent faces continue
  // in Chaldean order from each sign's lord, traditional Ptolemaic.
  // For simplicity we use the canonical face table:
  // Aries: Mars, Sun, Venus  /  Taurus: Mercury, Moon, Saturn  /  …
  const FACES = [
    ["Mars","Sun","Venus"],
    ["Mercury","Moon","Saturn"],
    ["Jupiter","Mars","Sun"],
    ["Venus","Mercury","Moon"],
    ["Saturn","Jupiter","Mars"],
    ["Sun","Venus","Mercury"],
    ["Moon","Saturn","Jupiter"],
    ["Mars","Sun","Venus"],
    ["Mercury","Moon","Saturn"],
    ["Jupiter","Mars","Sun"],
    ["Venus","Mercury","Moon"],
    ["Saturn","Jupiter","Mars"],
  ];
  const faceIdx = Math.floor(degInSign / 10);
  return FACES[signIdx][faceIdx];
}

// ──────────────────────────────────────────────────────────────────────
// Lots / Arabic parts (Hellenistic full set, day formulas; night inverts).
// ──────────────────────────────────────────────────────────────────────

// Hellenistic lot formulas (day; night inverts the Sun-Moon roles for several)
export const LOTS = [
  { name: "Fortune",      day: "Asc + Moon − Sun",     night: "Asc + Sun − Moon" },
  { name: "Spirit",       day: "Asc + Sun − Moon",     night: "Asc + Moon − Sun" },
  { name: "Eros",         day: "Asc + Venus − Spirit", night: "Asc + Spirit − Venus" },
  { name: "Necessity",    day: "Asc + Fortune − Mercury", night: "Asc + Mercury − Fortune" },
  { name: "Courage",      day: "Asc + Mars − Fortune", night: "Asc + Fortune − Mars" },
  { name: "Victory",      day: "Asc + Jupiter − Spirit", night: "Asc + Spirit − Jupiter" },
  { name: "Nemesis",      day: "Asc + Fortune − Saturn", night: "Asc + Saturn − Fortune" },
];

export function computeLots(asc, sun, moon, isDay) {
  const lot = (a, x, y) => mod360(a + x - y);
  // We need other planet longitudes in scope; the caller passes them in
  // via the chart-level wrapper. Here we expose Fortune/Spirit primarily;
  // additional lots use Fortune/Spirit as inputs and are computed at the
  // chart level (computeAllLots).
  return [
    { name: "Fortune", lon: isDay ? lot(asc, moon, sun) : lot(asc, sun, moon),
      formula: isDay ? "Asc + Moon − Sun" : "Asc + Sun − Moon" },
    { name: "Spirit",  lon: isDay ? lot(asc, sun, moon) : lot(asc, moon, sun),
      formula: isDay ? "Asc + Sun − Moon" : "Asc + Moon − Sun" },
  ];
}

// Full Hellenistic lots — Fortune, Spirit, Eros, Necessity, Courage,
// Victory, Nemesis. Many compose on the first two.
//
// Returns each lot's `sign` (index, 0..11) but NOT a sign name — this file
// has no zodiac-name data table (ZODIAC stays a data table in astro.jsx per
// WP-21's own split), so the astro.jsx thin wrapper attaches `signName`
// after calling this function. Everything else (lon, formula, sign) is
// byte-identical to the pre-WP-21 implementation.
export function computeAllLots(asc, planets, isDay) {
  const lot = (a, x, y) => mod360(a + x - y);
  const lonOf = (n) => planets.find(p => p.name === n).lon;
  const sun  = lonOf("Sun"), moon = lonOf("Moon");
  const fortune = isDay ? lot(asc, moon, sun) : lot(asc, sun, moon);
  const spirit  = isDay ? lot(asc, sun, moon) : lot(asc, moon, sun);
  const lots = [
    { name: "Fortune",   lon: fortune, formula: isDay ? "Asc + Moon − Sun" : "Asc + Sun − Moon" },
    { name: "Spirit",    lon: spirit,  formula: isDay ? "Asc + Sun − Moon" : "Asc + Moon − Sun" },
    { name: "Eros",      lon: isDay ? lot(asc, lonOf("Venus"), spirit) : lot(asc, spirit, lonOf("Venus")),
      formula: isDay ? "Asc + Venus − Spirit" : "Asc + Spirit − Venus" },
    { name: "Necessity", lon: isDay ? lot(asc, fortune, lonOf("Mercury")) : lot(asc, lonOf("Mercury"), fortune),
      formula: isDay ? "Asc + Fortune − Mercury" : "Asc + Mercury − Fortune" },
    { name: "Courage",   lon: isDay ? lot(asc, lonOf("Mars"), fortune) : lot(asc, fortune, lonOf("Mars")),
      formula: isDay ? "Asc + Mars − Fortune" : "Asc + Fortune − Mars" },
    { name: "Victory",   lon: isDay ? lot(asc, lonOf("Jupiter"), spirit) : lot(asc, spirit, lonOf("Jupiter")),
      formula: isDay ? "Asc + Jupiter − Spirit" : "Asc + Spirit − Jupiter" },
    { name: "Nemesis",   lon: isDay ? lot(asc, fortune, lonOf("Saturn")) : lot(asc, lonOf("Saturn"), fortune),
      formula: isDay ? "Asc + Fortune − Saturn" : "Asc + Saturn − Fortune" },
  ];
  return lots.map(l => ({
    ...l,
    sign: Math.floor(l.lon / 30),
  }));
}

// ──────────────────────────────────────────────────────────────────────
// Sect — day/night chart determination.
// ──────────────────────────────────────────────────────────────────────
// `sectOption` is the birth-data `sect` field: "day" / "night" force the
// chart's sect explicitly; anything else other than "auto" behaves like an
// explicit "not day" (matches the pre-WP-21 ternary's else branch exactly,
// including for unexpected values) — only "auto" evaluates the Sun's
// position relative to the Ascendant (above the horizon, houses 7-12, is a
// day chart).
export function sectIsDay(sunLon, ascDeg, sectOption) {
  return sectOption === "auto"
    ? mod360(sunLon - ascDeg) > 180
    : sectOption === "day";
}

// ──────────────────────────────────────────────────────────────────────
// Aspect detection — orb table + nearest-aspect lookup + applying/separating.
// ──────────────────────────────────────────────────────────────────────

// Aspect families with orbs and "harmonic family" — names match Prime Resonance.
export const ASPECTS = [
  { name: "Conjunction", angle:   0, orb: 8, family: "cardinal"  },
  { name: "Opposition",  angle: 180, orb: 8, family: "cardinal"  },
  { name: "Trine",       angle: 120, orb: 7, family: "classical" },
  { name: "Square",      angle:  90, orb: 7, family: "classical" },
  { name: "Sextile",     angle:  60, orb: 5, family: "classical" },
  { name: "Quincunx",    angle: 150, orb: 3, family: "minor"     },
  { name: "Semisquare",  angle:  45, orb: 2, family: "minor"     },
  { name: "Quintile",    angle:  72, orb: 2, family: "quintile"  },
  { name: "BiQuintile",  angle: 144, orb: 2, family: "quintile"  },
  { name: "Septile",     angle: 360/7,  orb: 1.5, family: "septile"   },
  { name: "Undecile",    angle: 360/11, orb: 1.2, family: "undecile"  },
  { name: "Tredecile",   angle: 360/13, orb: 1.2, family: "tredecile" },
];

export function nearestAspect(deltaDeg) {
  const d = Math.abs(((deltaDeg + 180) % 360) - 180);
  let best = null;
  for (const a of ASPECTS) {
    const sep = Math.abs(d - a.angle);
    if (sep <= a.orb && (!best || sep < best.sep)) best = { ...a, sep, exact: a.angle };
  }
  return best;
}

// Is the faster planet moving toward the exact aspect angle?
// Returns "applying" or "separating".
export function applyingPhase(lonA, lonB, speedA, speedB, target) {
  const relSpeed = speedA - speedB;
  const sep1 = mod360(lonA + relSpeed - lonB);
  const sep0 = mod360(lonA - lonB);
  const distTo = (s) => Math.min(Math.abs(s - target), Math.abs(s - (360 - target)), Math.abs(s - target - 360), Math.abs(s + target));
  return distTo(sep1) < distTo(sep0) ? "applying" : "separating";
}

// ──────────────────────────────────────────────────────────────────────
// Pattern detection — Grand Trine, T-Square, Grand Cross, Yod, Stellium.
// Operates on the aspect grid we already built.
// ──────────────────────────────────────────────────────────────────────
export function detectPatterns(aspects, planets) {
  const patterns = [];
  const major = aspects.filter(a => ["Conjunction","Opposition","Trine","Square","Sextile"].includes(a.aspect));
  const has = (n1, n2, type) =>
    major.some(a => ((a.a === n1 && a.b === n2) || (a.a === n2 && a.b === n1)) && a.aspect === type);

  const visibleNames = planets
    .filter(p => ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"].includes(p.name))
    .map(p => p.name);

  // Grand Trine — 3 planets mutually in trine
  for (let i = 0; i < visibleNames.length; i++)
    for (let j = i + 1; j < visibleNames.length; j++)
      for (let k = j + 1; k < visibleNames.length; k++) {
        const A = visibleNames[i], B = visibleNames[j], C = visibleNames[k];
        if (has(A, B, "Trine") && has(B, C, "Trine") && has(A, C, "Trine"))
          patterns.push({ kind: "Grand Trine", bodies: [A, B, C] });
      }

  // T-Square — opposition + two squares to a third
  for (let i = 0; i < visibleNames.length; i++)
    for (let j = i + 1; j < visibleNames.length; j++) {
      const A = visibleNames[i], B = visibleNames[j];
      if (!has(A, B, "Opposition")) continue;
      for (const C of visibleNames) {
        if (C === A || C === B) continue;
        if (has(A, C, "Square") && has(B, C, "Square"))
          patterns.push({ kind: "T-Square", bodies: [A, B, C], apex: C });
      }
    }

  // Grand Cross — 4 in square/opposition cross
  for (let i = 0; i < visibleNames.length; i++)
    for (let j = i + 1; j < visibleNames.length; j++)
      for (let k = j + 1; k < visibleNames.length; k++)
        for (let l = k + 1; l < visibleNames.length; l++) {
          const [A, B, C, D] = [visibleNames[i], visibleNames[j], visibleNames[k], visibleNames[l]];
          if (has(A, C, "Opposition") && has(B, D, "Opposition") &&
              has(A, B, "Square") && has(B, C, "Square") &&
              has(C, D, "Square") && has(A, D, "Square"))
            patterns.push({ kind: "Grand Cross", bodies: [A, B, C, D] });
        }

  // Yod — two planets in sextile both forming quincunxes to a third
  for (let i = 0; i < visibleNames.length; i++)
    for (let j = i + 1; j < visibleNames.length; j++) {
      const A = visibleNames[i], B = visibleNames[j];
      if (!has(A, B, "Sextile")) continue;
      for (const C of visibleNames) {
        if (C === A || C === B) continue;
        const quincunx = (n1, n2) => aspects.some(a =>
          ((a.a === n1 && a.b === n2) || (a.a === n2 && a.b === n1)) && a.aspect === "Quincunx"
        );
        if (quincunx(A, C) && quincunx(B, C))
          patterns.push({ kind: "Yod", bodies: [A, B, C], apex: C });
      }
    }

  // De-duplicate (sort body names)
  const seen = new Set();
  return patterns.filter(p => {
    const k = p.kind + ":" + [...p.bodies].sort().join(",");
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Critical degrees — Cardinal: 0,13,26; Fixed: 9,21; Mutable: 4,17.
// 29° in any sign is the anaretic ("degree of fate").
// ──────────────────────────────────────────────────────────────────────
export function criticalKind(signIdx, degInSign) {
  const dInt = Math.floor(degInSign);
  if (dInt === 29) return "anaretic";
  const mod = signIdx % 3; // 0=Cardinal, 1=Fixed, 2=Mutable
  const tables = [[0, 13, 26], [9, 21], [4, 17]];
  return tables[mod].includes(dInt) ? "critical" : null;
}

// Planet joys — the house each planet "rejoices in" (Hellenistic).
export const PLANET_JOY = { Mercury: 1, Moon: 3, Venus: 5, Mars: 6, Sun: 9, Jupiter: 11, Saturn: 12 };

// Antiscion / contra-antiscion of an ecliptic longitude.
// Antiscion: mirror across the 0° Cancer (90°) – 0° Capricorn (270°) axis.
//   A(λ) = (180° − λ) mod 360°. Yields the solstice point's mirror.
// Contra-antiscion: mirror across 0° Aries / 0° Libra axis.
//   C(λ) = (360° − λ) mod 360°.
export function antiscion(lon)        { return mod360(180 - lon); }
export function contraAntiscion(lon)  { return mod360(360 - lon); }

// Lunar phase from Moon − Sun elongation
export function lunarPhase(sunLon, moonLon) {
  const elong = mod360(moonLon - sunLon);
  const illumination = (1 - Math.cos(elong * Math.PI / 180)) / 2;
  const waxing = elong < 180;
  let phase;
  if      (elong < 45)  phase = "New";
  else if (elong < 90)  phase = "Waxing Crescent";
  else if (elong < 135) phase = "First Quarter";
  else if (elong < 180) phase = "Waxing Gibbous";
  else if (elong < 225) phase = "Full";
  else if (elong < 270) phase = "Waning Gibbous";
  else if (elong < 315) phase = "Last Quarter";
  else                  phase = "Waning Crescent";
  return { elongDeg: elong, illumination, waxing, phase };
}

// Chart shape (Jones gestalt — simplified)
export function chartShape(planets) {
  const lons = planets.map(p => p.lon).sort((a,b) => a-b);
  let largestGap = 0;
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i];
    const b = lons[(i+1) % lons.length];
    const gap = mod360(b - a);
    if (gap > largestGap) largestGap = gap;
  }
  const occupied = 360 - largestGap;
  let shape = "Splash";
  if (largestGap >= 240) shape = "Bundle";
  else if (largestGap >= 180) shape = "Bowl";
  else if (largestGap >= 120) shape = "Locomotive";
  else if (largestGap >= 90)  shape = "Bucket";
  else if (occupied < 270 && occupied > 180) shape = "Splay";
  return { shape, largestGapDeg: largestGap, occupiedArcDeg: occupied };
}

// Whole-sign houses: ASC sign is house 1, then forward.
export function houseForSign(signIdx, ascSignIdx) {
  return ((signIdx - ascSignIdx + 12) % 12) + 1;
}

// Equal houses from a longitude
export function houseForLongEqual(lon, ascDeg) {
  return Math.floor(mod360(lon - ascDeg) / 30) + 1;
}

// CRT residues — pure integer arithmetic on arcseconds
export function residues(arcsec) {
  // arcsec is a Number for our purposes (max 1_296_000)
  const a = Math.floor(arcsec);
  return {
    r2:  a % 2,
    r3:  a % 3,
    r5:  a % 5,
    r7:  a % 7,
    r11: a % 11,
    r13: a % 13,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Browser bridge — see the file header for the load-order guarantee.
// ──────────────────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.AstroCore = {
    mod360,
    DOMICILE, EXALT, opp, dignityFor,
    TRIP_DAY, TRIP_NIGHT, TRIP_PART,
    EGYPTIAN_TERMS, termRuler,
    CHALDEAN, faceRuler,
    LOTS, computeLots, computeAllLots,
    sectIsDay,
    ASPECTS, nearestAspect, applyingPhase,
    detectPatterns,
    criticalKind,
    PLANET_JOY,
    antiscion, contraAntiscion,
    lunarPhase,
    chartShape,
    houseForSign, houseForLongEqual,
    residues,
  };
}
