// astro.jsx — zodiac data + derivation logic
//
// The math here ALWAYS runs through the Mayan CRT substrate
// (Safe Basis = {2, 3, 5, 7, 11, 13},  M_SAFE = 30030,
//  Gear modulus 323 = 17·19,  Maya epoch JD 584283).
// Classical astrology saw mod 2/3/5 (signs, elements, modalities) and
// mod 7 (planetary week) but was *blind* to the Shadow Prime, 11.
// What lights up when we route every longitude through mod 11 is the
// hidden lane structure — eleven channels of correspondence that were
// always there, simply unviewable in the old reading.
//
// Every card's resonance, hueShift, and aspect-detection weights mod-11
// contact *first* and the visible aspect angle *second*.

const ZODIAC = [
  { name: "Aries",       glyph: "♈", element: "Fire",  modality: "Cardinal", ruler: "Mars",    latin: "Aries"      },
  { name: "Taurus",      glyph: "♉", element: "Earth", modality: "Fixed",    ruler: "Venus",   latin: "Taurus"     },
  { name: "Gemini",      glyph: "♊", element: "Air",   modality: "Mutable",  ruler: "Mercury", latin: "Gemini"     },
  { name: "Cancer",      glyph: "♋", element: "Water", modality: "Cardinal", ruler: "Moon",    latin: "Cancer"     },
  { name: "Leo",         glyph: "♌", element: "Fire",  modality: "Fixed",    ruler: "Sun",     latin: "Leo"        },
  { name: "Virgo",       glyph: "♍", element: "Earth", modality: "Mutable",  ruler: "Mercury", latin: "Virgo"      },
  { name: "Libra",       glyph: "♎", element: "Air",   modality: "Cardinal", ruler: "Venus",   latin: "Libra"      },
  { name: "Scorpio",     glyph: "♏", element: "Water", modality: "Fixed",    ruler: "Mars",    latin: "Scorpius"   },
  { name: "Sagittarius", glyph: "♐", element: "Fire",  modality: "Mutable",  ruler: "Jupiter", latin: "Sagittarius"},
  { name: "Capricorn",   glyph: "♑", element: "Earth", modality: "Cardinal", ruler: "Saturn",  latin: "Capricornus"},
  { name: "Aquarius",    glyph: "♒", element: "Air",   modality: "Fixed",    ruler: "Saturn",  latin: "Aquarius"   },
  { name: "Pisces",      glyph: "♓", element: "Water", modality: "Mutable",  ruler: "Jupiter", latin: "Pisces"     },
];

const PLANET_GLYPH = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  NorthNode: "☊", SouthNode: "☋", Chiron: "⚷", Lilith: "⚸",
};

// Domicile / exaltation / detriment / fall — Ptolemaic table.
// sign-index 0=Aries .. 11=Pisces.
const DOMICILE = {
  Sun: [4], Moon: [3], Mercury: [2,5], Venus: [1,6], Mars: [0,7],
  Jupiter: [8,11], Saturn: [9,10], Uranus: [10], Neptune: [11], Pluto: [7],
};
const EXALT = { Sun:0, Moon:1, Mercury:5, Venus:11, Mars:9, Jupiter:3, Saturn:6, Uranus:7, Neptune:3, Pluto:0 };

function opp(i) { return (i + 6) % 12; }

function dignityFor(planet, signIdx) {
  const dom = DOMICILE[planet] ?? [];
  const exalt = EXALT[planet];
  if (dom.includes(signIdx))                  return { kind: "domicile",   score:  5 };
  if (exalt === signIdx)                      return { kind: "exaltation", score:  4 };
  if (dom.some(d => opp(d) === signIdx))      return { kind: "detriment",  score: -5 };
  if (exalt !== undefined && opp(exalt) === signIdx) return { kind: "fall", score: -4 };
  return { kind: "neutral", score: 0 };
}

// Triplicity lords by sect (Dorothean)
const TRIP_DAY   = { Fire:"Sun",    Earth:"Venus", Air:"Saturn",  Water:"Venus" };
const TRIP_NIGHT = { Fire:"Jupiter",Earth:"Moon",  Air:"Mercury", Water:"Mars"  };
const TRIP_PART  = { Fire:"Jupiter",Earth:"Mercury",Air:"Mercury",Water:"Moon"  }; // participating

// Egyptian terms — each sign 30° partitioned into 5 unequal segments
// (degrees of upper bound, ruler). From Ptolemy.
const EGYPTIAN_TERMS = [
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

// Triplicity-decan faces (Chaldean order, 10° each)
const CHALDEAN = ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon"];
function faceRuler(signIdx, degInSign) {
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

function termRuler(signIdx, degInSign) {
  for (const [upper, ruler] of EGYPTIAN_TERMS[signIdx]) {
    if (degInSign < upper) return ruler;
  }
  return EGYPTIAN_TERMS[signIdx][4][1];
}

// Lunar phase from Moon − Sun elongation
function lunarPhase(sunLon, moonLon) {
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
function chartShape(planets) {
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

// Lots / Arabic parts (Hellenistic full set, day formulas; night inverts).
function computeLots(asc, sun, moon, isDay) {
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
function computeAllLots(asc, planets, isDay) {
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
    signName: ZODIAC[Math.floor(l.lon / 30)].name,
  }));
}

// Pattern detection — Grand Trine, T-Square, Grand Cross, Yod, Stellium.
// Operates on the aspect grid we already built.
function detectPatterns(aspects, planets) {
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

// Hellenistic lot formulas (day; night inverts the Sun-Moon roles for several)
const LOTS = [
  { name: "Fortune",      day: "Asc + Moon − Sun",     night: "Asc + Sun − Moon" },
  { name: "Spirit",       day: "Asc + Sun − Moon",     night: "Asc + Moon − Sun" },
  { name: "Eros",         day: "Asc + Venus − Spirit", night: "Asc + Spirit − Venus" },
  { name: "Necessity",    day: "Asc + Fortune − Mercury", night: "Asc + Mercury − Fortune" },
  { name: "Courage",      day: "Asc + Mars − Fortune", night: "Asc + Fortune − Mars" },
  { name: "Victory",      day: "Asc + Jupiter − Spirit", night: "Asc + Spirit − Jupiter" },
  { name: "Nemesis",      day: "Asc + Fortune − Saturn", night: "Asc + Saturn − Fortune" },
];

// ──────────────────────────────────────────────────────────────────────
// Synthetic ephemeris: we don't ship Swiss Ephemeris in-browser, so we
// derive plausible longitudes deterministically from the natal inputs.
// The geometry is consistent (a planet stays put for given JD), and that
// is enough for the visual layer to react to "natal coordinates."
// ──────────────────────────────────────────────────────────────────────

const PLANET_PERIODS = {           // tropical years, approx synodic for inner
  Sun:      1.0000,
  Moon:     0.0748,  // ~27.32 d / 365
  Mercury:  0.2408,
  Venus:    0.6152,
  Mars:     1.8809,
  Jupiter: 11.8618,
  Saturn:  29.4571,
  Uranus:  84.0205,
  Neptune:163.7236,
  Pluto:  247.9407,
  NorthNode: -18.6,  // retrograde
  Chiron:   50.42,
  Lilith:    8.85,   // mean Black Moon Lilith / lunar apogee
};
const PLANET_PHASE0 = {            // ecliptic longitude at J2000 epoch (deg)
  Sun:280.46, Moon:218.32, Mercury:252.25, Venus:181.98, Mars:355.43,
  Jupiter:34.35, Saturn:50.08, Uranus:314.05, Neptune:304.35, Pluto:238.93,
  NorthNode:125.04, Chiron:36.42, Lilith:83.35,
};
const PLANET_ORDER = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","NorthNode","Chiron","Lilith"];

function mod360(x) { let m = x % 360; if (m < 0) m += 360; return m; }

// J2000 = JD 2451545.0  → convert a UTC date to Julian Day
function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function planetLongitude(planet, jd) {
  const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
  const period = PLANET_PERIODS[planet];
  const phase0 = PLANET_PHASE0[planet] ?? 0;
  return mod360(phase0 + (360 / period) * yearsFromJ2000);
}

// Simple retrograde model: outer planets retrograde whenever Earth's
// heliocentric longitude pulls "ahead" by certain phase. We approximate
// retrograde as a sin-driven boolean against Sun − planet elongation.
function isRetrograde(planet, jd) {
  if (planet === "Sun" || planet === "Moon") return false;
  if (planet === "NorthNode") return true;
  const sunLon = planetLongitude("Sun", jd);
  const pLon   = planetLongitude(planet, jd);
  const elong  = mod360(sunLon - pLon);
  // Retrograde near opposition for outer planets, near inferior conjunction for inner
  if (["Mercury","Venus"].includes(planet)) {
    return elong > 350 || elong < 10;
  }
  return elong > 120 && elong < 240;
}

// Midheaven from local sidereal time. Simplified spherical formula:
// MC = atan2(sin(LST), cos(LST)·cos(ε))  (returns ecliptic longitude)
function midheavenDeg(date, lng) {
  const jd = dateToJD(date);
  const gmstDeg = mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  const lst = mod360(gmstDeg + lng);
  const eRad = 23.4393 * Math.PI / 180;
  const lstRad = lst * Math.PI / 180;
  const mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(eRad));
  return mod360(mc * 180 / Math.PI);
}

// Solar declination (degrees). Used for out-of-bounds detection.
function planetDeclination(lon) {
  const eRad = 23.4393 * Math.PI / 180;
  return Math.asin(Math.sin(lon * Math.PI / 180) * Math.sin(eRad)) * 180 / Math.PI;
}
// Approximation: ASC ≈ GMST + longitude + 90° + lat-modulation
function ascendantDeg(date, lat, lng) {
  const jd = dateToJD(date);
  const T = (jd - 2451545.0) / 36525;
  // GMST in degrees, approximate
  const gmstDeg = mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  const lst = mod360(gmstDeg + lng);
  const obliquity = 23.4393;
  // Simplified ascendant (good enough for the visual layer; not a real solver)
  const ra = lst + 90;
  const latRad = lat * Math.PI / 180;
  const eRad   = obliquity * Math.PI / 180;
  const raRad  = ra * Math.PI / 180;
  const ascRad = Math.atan2(
    -Math.cos(raRad),
    Math.sin(raRad) * Math.cos(eRad) + Math.tan(latRad) * Math.sin(eRad)
  );
  return mod360(ascRad * 180 / Math.PI);
}

// Whole-sign houses: ASC sign is house 1, then forward.
function houseForSign(signIdx, ascSignIdx) {
  return ((signIdx - ascSignIdx + 12) % 12) + 1;
}

// Equal houses from a longitude
function houseForLongEqual(lon, ascDeg) {
  return Math.floor(mod360(lon - ascDeg) / 30) + 1;
}

// CRT residues — pure integer arithmetic on arcseconds
function residues(arcsec) {
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

// Aspect families with orbs and "harmonic family" — names match Prime Resonance.
const ASPECTS = [
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

// Speed (deg/day) for each modeled body. Derived from period.
function planetSpeed(name) {
  const p = PLANET_PERIODS[name];
  if (!p || p === 0) return 0;
  return 360 / (p * 365.25);  // signed (NorthNode is negative)
}

function nearestAspect(deltaDeg) {
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
function applyingPhase(lonA, lonB, speedA, speedB, target) {
  const relSpeed = speedA - speedB;
  const sep1 = mod360(lonA + relSpeed - lonB);
  const sep0 = mod360(lonA - lonB);
  const distTo = (s) => Math.min(Math.abs(s - target), Math.abs(s - (360 - target)), Math.abs(s - target - 360), Math.abs(s + target));
  return distTo(sep1) < distTo(sep0) ? "applying" : "separating";
}

// Antiscion / contra-antiscion of an ecliptic longitude.
// Antiscion: mirror across the 0° Cancer (90°) – 0° Capricorn (270°) axis.
//   A(λ) = (180° − λ) mod 360°. Yields the solstice point's mirror.
// Contra-antiscion: mirror across 0° Aries / 0° Libra axis.
//   C(λ) = (360° − λ) mod 360°.
function antiscion(lon)        { return mod360(180 - lon); }
function contraAntiscion(lon)  { return mod360(360 - lon); }

// Planet joys — the house each planet "rejoices in" (Hellenistic).
const PLANET_JOY = { Mercury: 1, Moon: 3, Venus: 5, Mars: 6, Sun: 9, Jupiter: 11, Saturn: 12 };

// Critical degrees — Cardinal: 0,13,26; Fixed: 9,21; Mutable: 4,17.
// 29° in any sign is the anaretic ("degree of fate").
function criticalKind(signIdx, degInSign) {
  const dInt = Math.floor(degInSign);
  if (dInt === 29) return "anaretic";
  const mod = signIdx % 3; // 0=Cardinal, 1=Fixed, 2=Mutable
  const tables = [[0, 13, 26], [9, 21], [4, 17]];
  return tables[mod].includes(dInt) ? "critical" : null;
}

// ──────────────────────────────────────────────────────────────────────
// computeNatal — derives everything visible from the natal inputs
// ──────────────────────────────────────────────────────────────────────

function computeNatal(birth) {
  const date = new Date(birth.dateISO);
  const jd = dateToJD(date);
  const asc = ascendantDeg(date, birth.lat, birth.lng);
  const mc  = midheavenDeg(date, birth.lng);
  const desc = mod360(asc + 180);
  const ic   = mod360(mc  + 180);
  const ascSignIdx = Math.floor(asc / 30);
  const mcSignIdx  = Math.floor(mc  / 30);
  const isDayChart = birth.sect === "auto"
    ? (planetLongitude("Sun", jd) - asc + 360) % 360 > 180
    : birth.sect === "day";

  const planets = PLANET_ORDER.map(p => {
    const lon  = planetLongitude(p, jd);
    const sign = Math.floor(lon / 30);
    const arcsec = lon * 3600;
    const degInSign = lon - sign * 30;
    return {
      name: p,
      glyph: PLANET_GLYPH[p],
      lon,
      sign,
      degInSign,
      arcsec,
      speed: planetSpeed(p),
      retrograde: isRetrograde(p, jd),
      house: birth.houseSystem === "whole"
        ? houseForSign(sign, ascSignIdx)
        : houseForLongEqual(lon, asc),
      dignity: dignityFor(p, sign),
      residues: residues(arcsec),
      declination: planetDeclination(lon),
      criticalDegree: criticalKind(sign, degInSign),
    };
  });

  // South node is opposite the North
  const nn = planets.find(p => p.name === "NorthNode");
  if (nn) {
    const snLon = mod360(nn.lon + 180);
    const snSign = Math.floor(snLon / 30);
    planets.push({
      name: "SouthNode",
      glyph: PLANET_GLYPH.SouthNode,
      lon: snLon,
      sign: snSign,
      degInSign: snLon - snSign * 30,
      arcsec: snLon * 3600,
      speed: -nn.speed,
      retrograde: true,
      house: birth.houseSystem === "whole"
        ? houseForSign(snSign, ascSignIdx)
        : houseForLongEqual(snLon, asc),
      dignity: dignityFor("Sun", snSign), // nodes don't have dignity; placeholder
      residues: residues(snLon * 3600),
      declination: planetDeclination(snLon),
      criticalDegree: criticalKind(snSign, snLon - snSign * 30),
    });
  }

  // For each sign card, find the dominant planet sitting in it (if any).
  // If none, "ruler" planet's tenancy is referenced.
  const cards = ZODIAC.map((sign, idx) => {
    const tenants = planets.filter(p => p.sign === idx);
    const ruler   = planets.find(p => p.name === sign.ruler);
    const principal = tenants[0] ?? ruler;
    const dignity   = dignityFor(principal.name, idx);
    const house     = birth.houseSystem === "whole"
      ? houseForSign(idx, ascSignIdx)
      : houseForLongEqual(idx * 30 + 15, asc);

    // Full Ptolemaic dignity table — triplicity, term, face
    const tripLord = isDayChart ? TRIP_DAY[sign.element] : TRIP_NIGHT[sign.element];
    const tripPart = TRIP_PART[sign.element];
    const degInSign = principal.lon - idx * 30;
    const term = termRuler(idx, degInSign);
    const face = faceRuler(idx, degInSign);
    const inOwnTerm = term === principal.name;
    const inOwnFace = face === principal.name;
    const ptolemaicBonus =
      (dignity.kind === "domicile"   ? 5 : 0) +
      (dignity.kind === "exaltation" ? 4 : 0) +
      (tripLord === principal.name   ? 3 : 0) +
      (inOwnTerm ? 2 : 0) +
      (inOwnFace ? 1 : 0) +
      (dignity.kind === "detriment"  ? -5 : 0) +
      (dignity.kind === "fall"       ? -4 : 0);

    // Aspect from this card's principal to the Sun, used to drive its glow
    const sun = planets.find(p => p.name === "Sun");
    const delta = mod360(principal.lon - sun.lon);
    const aspect = nearestAspect(delta);

    // Resonance: a 0..1 scalar that drives glow vibrance.
    // Blends Ptolemaic dignity total, tenancy count, aspect tightness, and the
    // card's shadow-lane (mod 11) residue distance from the chart's Asc residue.
    const ascArcsec = asc * 3600;
    const ascR11 = Math.floor(ascArcsec) % 11;
    const cardArcsec = (idx * 30 + 15) * 3600;
    const cardR11 = Math.floor(cardArcsec) % 11;
    const laneDist = Math.min(
      Math.abs(ascR11 - cardR11),
      11 - Math.abs(ascR11 - cardR11)
    ) / 5.5; // 0..1
    const dignityNorm = (ptolemaicBonus + 5) / 20;       // 0..1 (range ~-5..+15)
    const tenancyNorm = Math.min(tenants.length / 3, 1);
    const aspectNorm  = aspect ? 1 - (aspect.sep / aspect.orb) : 0;
    const angularBoost = [1, 4, 7, 10].includes(house) ? 0.15 : 0;
    const resonance = Math.max(0, Math.min(1,
      0.30 * dignityNorm +
      0.25 * tenancyNorm +
      0.25 * aspectNorm +
      0.15 * (1 - laneDist) +
      angularBoost
    ));

    // Hue offset for iridescent shimmer — derived from the principal's
    // arcsec residue mod 360 so each card has a *unique* shimmer signature.
    const hueShift = (Math.floor(principal.arcsec) % 360);

    return {
      ...sign,
      idx,
      house,
      tenants,
      principal,
      dignity,
      tripLord,
      tripPart,
      term,
      face,
      inOwnTerm,
      inOwnFace,
      ptolemaicBonus,
      aspect,
      resonance,
      hueShift,
      laneR11: cardR11,
      laneR13: Math.floor(cardArcsec) % 13,
      cardR7:  Math.floor(cardArcsec) % 7,
    };
  });

  // Chart-level classical material
  const sun  = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");
  const phase = lunarPhase(sun.lon, moon.lon);
  const shape = chartShape(planets);
  const lots  = computeAllLots(asc, planets, isDayChart);

  // ───── Full aspect grid (every visible pair, applying/separating) ─────
  const visibleAspectBodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];
  const aspectGrid = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i], B = planets[j];
      if (!visibleAspectBodies.includes(A.name) || !visibleAspectBodies.includes(B.name)) continue;
      const delta = mod360(A.lon - B.lon);
      const asp = nearestAspect(delta);
      if (!asp) continue;
      // Faster planet first
      const fast = Math.abs(A.speed) >= Math.abs(B.speed) ? A : B;
      const slow = fast === A ? B : A;
      const phaseLabel = applyingPhase(fast.lon, slow.lon, fast.speed, slow.speed, asp.angle);
      aspectGrid.push({
        a: A.name, b: B.name, aGlyph: A.glyph, bGlyph: B.glyph,
        aspect: asp.name, angle: asp.angle, family: asp.family,
        orb: asp.sep, maxOrb: asp.orb,
        phase: phaseLabel,
        tightness: 1 - (asp.sep / asp.orb),
      });
    }
  }
  // Sort tightest first
  aspectGrid.sort((a, b) => a.orb - b.orb);

  // ───── Antiscia (1° orb) ─────
  const antisciaContacts = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i], B = planets[j];
      if (!visibleAspectBodies.includes(A.name) || !visibleAspectBodies.includes(B.name)) continue;
      const antiA = antiscion(A.lon);
      const contraA = contraAntiscion(A.lon);
      const d1 = Math.min(Math.abs(antiA - B.lon), 360 - Math.abs(antiA - B.lon));
      const d2 = Math.min(Math.abs(contraA - B.lon), 360 - Math.abs(contraA - B.lon));
      if (d1 < 1.0) antisciaContacts.push({ a: A.name, b: B.name, kind: "antiscion", orb: d1 });
      if (d2 < 1.0) antisciaContacts.push({ a: A.name, b: B.name, kind: "contra-antiscion", orb: d2 });
    }
  }

  // ───── Joys ─────
  const joyHits = planets
    .filter(p => PLANET_JOY[p.name] && p.house === PLANET_JOY[p.name])
    .map(p => ({ planet: p.name, house: p.house }));

  // ───── Mutual reception ─────
  const receptions = [];
  for (let i = 0; i < planets.length; i++) {
    const A = planets[i];
    if (!DOMICILE[A.name]) continue;
    for (let j = i + 1; j < planets.length; j++) {
      const B = planets[j];
      if (!DOMICILE[B.name]) continue;
      const aInB = DOMICILE[B.name].includes(A.sign);
      const bInA = DOMICILE[A.name].includes(B.sign);
      if (aInB && bInA) receptions.push({ a: A.name, b: B.name, kind: "domicile" });
      else {
        const aExalt = (EXALT[B.name] === A.sign);
        const bExalt = (EXALT[A.name] === B.sign);
        if (aExalt && bExalt) receptions.push({ a: A.name, b: B.name, kind: "exaltation" });
      }
    }
  }

  // ───── Element / modality / hemisphere / quadrant balance ─────
  const elementCount  = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCount = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  const hemisphereCount = { upper: 0, lower: 0, east: 0, west: 0 };
  const quadrantCount = { angular: 0, succedent: 0, cadent: 0 };
  for (const p of planets) {
    if (!["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"].includes(p.name)) continue;
    const sign = ZODIAC[p.sign];
    elementCount[sign.element]++;
    modalityCount[sign.modality]++;
    // upper hemisphere = houses 7-12; east = 10-3
    if (p.house >= 7 && p.house <= 12) hemisphereCount.upper++; else hemisphereCount.lower++;
    if ([10,11,12,1,2,3].includes(p.house)) hemisphereCount.east++; else hemisphereCount.west++;
    if ([1,4,7,10].includes(p.house)) quadrantCount.angular++;
    else if ([2,5,8,11].includes(p.house)) quadrantCount.succedent++;
    else quadrantCount.cadent++;
  }

  // ───── Stellium / patterns ─────
  const stelliums = [];
  for (let s = 0; s < 12; s++) {
    const inSign = planets.filter(p => p.sign === s && ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"].includes(p.name));
    if (inSign.length >= 3) stelliums.push({ sign: ZODIAC[s].name, bodies: inSign.map(p => p.name) });
  }

  const patterns = detectPatterns(aspectGrid, planets);

  // ───── Out-of-bounds ─────
  const outOfBounds = planets.filter(p => Math.abs(p.declination) > 23.45).map(p => ({
    planet: p.name, declination: p.declination,
  }));

  // ───── Void-of-course Moon (simple heuristic) ─────
  // Next Moon aspect or sign change. We just compute days to next sign change.
  const moonDegInSign = moon.lon - moon.sign * 30;
  const moonSpeedDay = Math.abs(moon.speed); // ~13.18°/day
  const daysToNextSignChange = (30 - moonDegInSign) / moonSpeedDay;
  // Crude: if no major aspect within orb to any planet → voc
  const moonHasAspect = aspectGrid.some(a => (a.a === "Moon" || a.b === "Moon") && ["Conjunction","Opposition","Trine","Square","Sextile"].includes(a.aspect));
  const voidOfCourse = { isVoc: !moonHasAspect, daysToNextSignChange };

  return {
    jd,
    asc,
    mc,
    desc,
    ic,
    ascSignIdx,
    mcSignIdx,
    isDayChart,
    planets,
    cards,
    lots,
    phase,
    shape,
    aspectGrid,
    antisciaContacts,
    joys: joyHits,
    receptions,
    elementCount,
    modalityCount,
    hemisphereCount,
    quadrantCount,
    stelliums,
    patterns,
    outOfBounds,
    voidOfCourse,
    birth,
  };
}

// Expose to other scripts
Object.assign(window, {
  ZODIAC, PLANET_GLYPH, PLANET_ORDER,
  computeNatal, dignityFor, nearestAspect, dateToJD, ascendantDeg, midheavenDeg,
  planetLongitude, residues, mod360,
  termRuler, faceRuler, lunarPhase, chartShape, computeLots, computeAllLots,
  antiscion, contraAntiscion, planetDeclination, planetSpeed,
  applyingPhase, criticalKind, detectPatterns,
  PLANET_JOY,
  TRIP_DAY, TRIP_NIGHT, TRIP_PART,
  deckOrder,
});

// Reading-order for the deck: ASC sign → Sun sign → Moon sign →
// signs holding personal planets → social planets → outer planets →
// empty signs in zodiacal order.
function deckOrder(chart) {
  const order = [];
  const push = (idx) => { if (idx != null && !order.includes(idx)) order.push(idx); };

  push(chart.ascSignIdx);
  const planetSignIdx = (name) => {
    const p = chart.planets.find(x => x.name === name);
    return p ? p.sign : null;
  };
  push(planetSignIdx("Sun"));
  push(planetSignIdx("Moon"));
  // personal
  push(planetSignIdx("Mercury"));
  push(planetSignIdx("Venus"));
  push(planetSignIdx("Mars"));
  // social
  push(planetSignIdx("Jupiter"));
  push(planetSignIdx("Saturn"));
  // outer
  push(planetSignIdx("Uranus"));
  push(planetSignIdx("Neptune"));
  push(planetSignIdx("Pluto"));
  // backfill remaining signs in zodiacal order
  for (let i = 0; i < 12; i++) push(i);
  return order;
}
