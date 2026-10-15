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
//
// ── WP-21: data tables + thin AstroCore wrappers ────────────────────────
// This file used to hold the interpretive logic (dignities, terms, faces,
// triplicities, lots, sect, aspect detection + the orb table, pattern
// detection, critical degrees, joys, antiscia, lunar phase, chart shape,
// whole-sign/equal houses, CRT residues) directly. That logic now lives in
// project/src/present/astro-core.js as a portable, dual-environment ES
// module (Node-`import`-able for tests, and bridged onto `window.AstroCore`
// in the browser). Every HTML page that loads this file also loads
// `<script type="module" src="src/present/astro-core.js"></script>` BEFORE
// this script tag (same load-order guarantee as WP-14's core-shim.js:
// module scripts run before DOMContentLoaded, and Babel-standalone only
// transforms/runs `text/babel` tags on DOMContentLoaded) — so `AstroCore` is
// always defined by the time the thin wrapper functions below run.
//
// What STAYS here: the ephemeris-adjacent code — position/speed/retrograde
// computation and which data source (real astronomy-engine vs. the
// synthetic mean-motion model) to use for it — plus the ZODIAC/PLANET_*
// data tables and computeNatal(), the top-level orchestrator that wires
// ephemeris output through AstroCore's interpretation functions.

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
//
// WP-21: this section (dignities, triplicities, terms, faces, lunar phase,
// chart shape, lots, pattern detection) now lives in
// project/src/present/astro-core.js. Everything below is a thin wrapper
// delegating to `window.AstroCore` (guaranteed defined before this script
// runs — see the file header) so every existing call site and every
// existing `window.<name>` export keeps working unchanged.
function dignityFor(planet, signIdx) { return AstroCore.dignityFor(planet, signIdx); }
// computeNatal's mutual-reception detection reads these tables directly
// (not just through dignityFor), so alias them too.
const DOMICILE = AstroCore.DOMICILE;
const EXALT = AstroCore.EXALT;

// Triplicity lords by sect (Dorothean)
const TRIP_DAY   = AstroCore.TRIP_DAY;
const TRIP_NIGHT = AstroCore.TRIP_NIGHT;
const TRIP_PART  = AstroCore.TRIP_PART; // participating

function faceRuler(signIdx, degInSign) { return AstroCore.faceRuler(signIdx, degInSign); }

function termRuler(signIdx, degInSign) { return AstroCore.termRuler(signIdx, degInSign); }

// Lunar phase from Moon − Sun elongation
function lunarPhase(sunLon, moonLon) { return AstroCore.lunarPhase(sunLon, moonLon); }

// Chart shape (Jones gestalt — simplified)
function chartShape(planets) { return AstroCore.chartShape(planets); }

// Lots / Arabic parts (Hellenistic full set, day formulas; night inverts).
function computeLots(asc, sun, moon, isDay) { return AstroCore.computeLots(asc, sun, moon, isDay); }

// Full Hellenistic lots — Fortune, Spirit, Eros, Necessity, Courage,
// Victory, Nemesis. Many compose on the first two.
// AstroCore.computeAllLots returns each lot's `sign` index but not a sign
// name (astro-core.js has no ZODIAC data table); attach `signName` here
// from this file's own ZODIAC so callers see the exact same shape as before.
function computeAllLots(asc, planets, isDay) {
  return AstroCore.computeAllLots(asc, planets, isDay).map(l => ({
    ...l,
    signName: ZODIAC[l.sign].name,
  }));
}

// Pattern detection — Grand Trine, T-Square, Grand Cross, Yod, Stellium.
// Operates on the aspect grid we already built.
function detectPatterns(aspects, planets) { return AstroCore.detectPatterns(aspects, planets); }

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

// ── Real vs. synthetic ephemeris (WP-17) ────────────────────────────────
// project/vendor/astronomy.browser.min.js (vendored astronomy-engine 2.1.19
// — see project/vendor/README.md) is loaded via a plain <script> tag before
// this file's own script tag on every HTML page that uses astro.jsx. When it
// loads successfully, `window.Astronomy` is defined and planetLongitude()/
// planetSpeed()/isRetrograde() below compute REAL apparent geocentric
// ecliptic-of-date longitudes (aberration on) and central-difference speeds,
// using the exact same astronomy-engine call pattern
// project/tools/ephemeris/produce-ledger.mjs (WP-08) uses for the Node
// ledger CLI: Astronomy.GeoVector(body, time, true) → Astronomy.Ecliptic
// (vec).elon for longitude, and a ±6h central difference for speed. That
// Node module is the canonical implementation to keep this in sync with —
// this file duplicates the small amount of logic rather than importing it,
// since there is no bundler here and astro.jsx runs as a Babel-standalone
// classic script, not an ES module that could import a shared file across
// that boundary.
//
// Only the 10 classical bodies astronomy-engine's `Body` enum defines have
// a real-ephemeris path (REAL_EPHEMERIS_BODIES below); NorthNode, Chiron,
// and Lilith are not modeled by astronomy-engine at all and always fall
// back to the synthetic mean-motion model further below, in both REAL and
// SYNTHETIC mode — the same scope boundary produce-ledger.mjs's
// DEFAULT_BODIES already draws for the Node ledger.
//
// If the vendor script failed to load (e.g. offline), `window.Astronomy` is
// undefined and every body uses the synthetic model unchanged from before
// — this is the documented offline fallback per
// project/src/demo/SYNTHETIC_DEMO.js's contract, so it is kept, not deleted.
//
// window.EPHEMERIS_MODE is set unconditionally, as early as this script
// executes (both branches), so a later UI package (WP-19) can surface it as
// a badge regardless of which path any individual planet ends up using.
if (typeof window !== "undefined") {
  window.EPHEMERIS_MODE = window.Astronomy ? "REAL" : "SYNTHETIC";
  // Which ASC/MC path is live. "REAL" = houses.js ascMc(); "APPROX" =
  // this file's approximate GMST/fixed-obliquity closed form.
  Object.defineProperty(window, "ANGLES_MODE", {
    configurable: true,
    get() { return (window.Houses && typeof window.Houses.ascMcFromDate === "function") ? "REAL" : "APPROX"; },
  });
  // Per-chart refinement of the above: REAL says the solver is LOADED, this
  // says whether it actually produced the Ascendant for a given latitude
  // (it declines above |lat| = 66.56°). app.jsx's polar banner is the
  // user-facing half; this is for tests and diagnostics.
  window.ascendantIsExactAt = function (date, lat, lng) {
    return realAngles(date, lat, lng) !== null;
  };
  // Same shape, for the 8 quadrant house systems: does window.Houses
  // actually produce cusps for this (system, instant, latitude), or would
  // computeNatal fall back to Whole? Used by app.jsx's polar banner and by
  // tests; the fallback logic itself lives once, in quadrantCuspsFor().
  window.quadrantHousesAvailableAt = function (systemKey, date, lat, lng) {
    return quadrantCuspsFor(systemKey, date, lat, lng) !== null;
  };
}

const REAL_EPHEMERIS_BODIES = new Set([
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
]);

function mod360(x) { let m = x % 360; if (m < 0) m += 360; return m; }

// J2000 = JD 2451545.0  → convert a UTC date to Julian Day
function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Real apparent geocentric ecliptic-of-date longitude (degrees, [0,360))
// via the vendored astronomy-engine, mirroring produce-ledger.mjs's
// eclipticLongitudeDeg(). `jd` is JD(UT) in the dateToJD() convention above;
// dateToJD() is exactly invertible for the millisecond-resolution Date
// objects this file works with, so we reconstruct the wall-clock instant
// and hand it to Astronomy.MakeTime(), which derives its own JD(TT)/ΔT
// internally (see produce-ledger.mjs's header comment on why that — not
// tools/ephemeris/timescale.js — is the right ΔT source to stay consistent
// with the position actually computed).
// Apparent geocentric ecliptic LATITUDE (degrees), same source and settings
// as realEclipticLongitudeDeg(). Returns null when this body has no real
// model (NorthNode/Chiron/Lilith) or astronomy-engine is absent, so callers
// fall back to the β = 0 assumption rather than a fabricated value.
function realEclipticLatitudeDeg(planet, jd) {
  if (typeof Astronomy === "undefined" || !Astronomy || !REAL_EPHEMERIS_BODIES.has(planet)) {
    return null;
  }
  const time = Astronomy.MakeTime(new Date((jd - 2440587.5) * 86400000));
  const vec = Astronomy.GeoVector(Astronomy.Body[planet], time, true); // aberration on
  return Astronomy.Ecliptic(vec).elat;
}

function realEclipticLongitudeDeg(planet, jd) {
  const Astronomy = window.Astronomy;
  const date = new Date((jd - 2440587.5) * 86400000);
  const time = Astronomy.MakeTime(date);
  const vec = Astronomy.GeoVector(Astronomy.Body[planet], time, true); // aberration on
  return Astronomy.Ecliptic(vec).elon;
}

// Central-difference speed (deg/day) over a ±6h window — same convention as
// produce-ledger.mjs's speed_arcsec_per_day: the shortest signed arc
// between the t+6h and t-6h longitudes, divided by the 0.5-day span.
function realPlanetSpeedDegPerDay(planet, jd) {
  const lonMinus = realEclipticLongitudeDeg(planet, jd - 0.25);
  const lonPlus  = realEclipticLongitudeDeg(planet, jd + 0.25);
  let d = (lonPlus - lonMinus) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d / 0.5;
}

function planetLongitude(planet, jd) {
  if (window.Astronomy && REAL_EPHEMERIS_BODIES.has(planet)) {
    return mod360(realEclipticLongitudeDeg(planet, jd));
  }
  if (window.Astronomy && (planet === "NorthNode" || planet === "Lilith")) {
    const time = window.Astronomy.MakeTime(new Date((jd - 2440587.5) * 86400000));
    const t = time.tt / 36525;
    // Meeus mean elements of date. Lilith is the mean APOGEE (+180°),
    // not the perigee or a physical planetary body. Not a true-node model.
    return planet === "NorthNode"
      ? mod360(125.04452 - 1934.136261*t + 0.0020708*t*t + t*t*t/450000)
      : mod360(83.3532465 + 4069.0137287*t - 0.01032*t*t - t*t*t/80053 + t*t*t*t/18999000 + 180);
  }
  const yearsFromJ2000 = (jd - 2451545.0) / 365.25;
  const period = PLANET_PERIODS[planet];
  const phase0 = PLANET_PHASE0[planet] ?? 0;
  return mod360(phase0 + (360 / period) * yearsFromJ2000);
}

// Simple retrograde model (synthetic-path fallback only — see planetSpeed()
// for the real-ephemeris path): outer planets retrograde whenever Earth's
// heliocentric longitude pulls "ahead" by certain phase. We approximate
// retrograde as a sin-driven boolean against Sun − planet elongation.
function isRetrograde(planet, jd) {
  if (planet === "Sun" || planet === "Moon") return false;
  // Real-ephemeris path: derive retrograde from the *same* central-difference
  // speed value planetSpeed() reports for this planet, so the two can never
  // disagree (this is the fix for the historical bug where the synthetic
  // planetSpeed below was a constant positive mean rate independent of this
  // heuristic flag).
  if (window.Astronomy && (REAL_EPHEMERIS_BODIES.has(planet) || ["NorthNode", "Lilith"].includes(planet))) {
    return planetSpeed(planet, jd) < 0;
  }
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
// Midheaven. Unlike the ascendant, this closed form already had the right
// branch — it agrees with houses.js ascMc() to ~12″, the residual being
// GMST-vs-GAST and a fixed 23.4393° obliquity. It is still routed through the
// real solver when available so ASC and MC come from one consistent
// timescale; the local form remains the offline fallback.
function approxMidheavenDeg(date, lng) {
  const jd = dateToJD(date);
  const gmstDeg = mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  const lst = mod360(gmstDeg + lng);
  const eRad = 23.4393 * Math.PI / 180;
  const lstRad = lst * Math.PI / 180;
  const mc = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(eRad));
  return mod360(mc * 180 / Math.PI);
}

function midheavenDeg(date, lng) {
  // MC is latitude-independent, so this always calls realAngles() with
  // latitude 0 — which also keeps it below ascMc()'s polar guard, letting
  // the MC stay exact even where the Ascendant falls back. There was a
  // third `lat` parameter here; nothing in the body ever read it (real
  // callers pass birth.lat positionally, which then silently went
  // nowhere) — removed rather than left as a documented-but-ignored trap
  // for the next reader, per eslint's no-unused-vars catching it once the
  // *.jsx layer was actually linted.
  const real = realAngles(date, 0, lng);
  return real ? real.mcDeg : approxMidheavenDeg(date, lng);
}

// Declination (degrees) from ecliptic coordinates.
//
// This used to take longitude ALONE, implicitly assuming every body sits
// exactly on the ecliptic (β = 0). Under that assumption |δ| ≤ ε = 23.4393°
// by construction, so the out-of-bounds filter below — which asks for
// |δ| > 23.45° — could never match for ANY input: the feature was
// unsatisfiable, not merely unused. Out-of-bounds declination is precisely a
// statement about bodies OFF the ecliptic, so the latitude term is what the
// test was looking for. See docs/COMPLETION_AUDIT.md section 3, item 2.
//
//   sin δ = sin β · cos ε + cos β · sin ε · sin λ
//
// With β = 0 this reduces to the previous expression exactly, so callers that
// genuinely have no latitude (the synthetic model) are unaffected.
function planetDeclination(lon, eclLatDeg) {
  const eRad = 23.4393 * Math.PI / 180;
  const beta = (Number.isFinite(eclLatDeg) ? eclLatDeg : 0) * Math.PI / 180;
  const lam  = lon * Math.PI / 180;
  return Math.asin(
    Math.sin(beta) * Math.cos(eRad) + Math.cos(beta) * Math.sin(eRad) * Math.sin(lam)
  ) * 180 / Math.PI;
}
// Closed-form fallback uses approximate GMST and fixed J2000 obliquity.
// The eastern horizon branch is selected explicitly; precision is disclosed.
function approxAscendantDeg(date, lat, lng) {
  if (Math.abs(lat) === 90) throw new RangeError("A rising Ascendant is undefined at the geographic poles");
  const jd = dateToJD(date);
  // GMST in degrees, approximate
  const gmstDeg = mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0));
  const lst = mod360(gmstDeg + lng);
  const obliquity = 23.4393;
  const ra = lst;
  const latRad = lat * Math.PI / 180;
  const eRad   = obliquity * Math.PI / 180;
  const raRad  = ra * Math.PI / 180;
  const ascY = -Math.cos(raRad);
  const ascX = Math.sin(raRad) * Math.cos(eRad) + Math.tan(latRad) * Math.sin(eRad);
  if (Math.hypot(ascY, ascX) < 1e-12) throw new RangeError("The horizon and ecliptic coincide; a unique Ascendant is unavailable");
  const ascRad = Math.atan2(ascY, ascX);
  let candidate = ascRad + Math.PI;
  const east = -Math.cos(candidate) * Math.sin(raRad) + Math.sin(candidate) * Math.cos(eRad) * Math.cos(raRad);
  if (Math.abs(east) < 1e-12) throw new RangeError("A unique rising Ascendant is unavailable at this horizon");
  if (east < 0) candidate += Math.PI;
  return mod360(candidate * 180 / Math.PI);
}

// Ascendant. Prefers WP-11's real solver (tools/ephemeris/houses.js ascMc(),
// cross-checked against Swiss Ephemeris to ~12.5″), which every page that
// loads this file now publishes as window.Houses. window.ANGLES_MODE records
// which path produced the number, mirroring window.EPHEMERIS_MODE.
function ascendantDeg(date, lat, lng) {
  const real = realAngles(date, lat, lng);
  return real ? real.ascDeg : approxAscendantDeg(date, lat, lng);
}

// Shared accessor. Loaded horizon solvers choose the eastern intersection
// at polar latitudes; geographic poles/degenerate horizons raise a real fault.
// A legacy solver's explicit polar refusal can still use the corrected
// approximate eastern-horizon fallback, with per-chart source disclosure.
function realAngles(date, lat, lng) {
  const H = typeof window !== "undefined" ? window.Houses : null;
  if (!H || typeof H.ascMcFromDate !== "function") return null;
  try {
    return H.ascMcFromDate(date, lat, lng);
  } catch (e) {
    if (H.PolarLatitudeError && e instanceof H.PolarLatitudeError) return null;
    throw e; // anything else is a real fault; do not swallow it
  }
}

// Same shape as realAngles() above, for one of the 8 quadrant house
// systems. Returns the 12-cusp array, or null when the real solver
// declined (module missing, or PolarLatitudeError — POLAR_FALLBACK_POLICY's
// declared fallback for every "hard" system is Whole, applied by the one
// caller in computeNatal). Any other thrown error is a real fault and is
// not swallowed here either.
function quadrantCuspsFor(systemKey, date, lat, lng) {
  const H = typeof window !== "undefined" ? window.Houses : null;
  if (!H || typeof H.quadrantCuspsFromDate !== "function") return null;
  try {
    return H.quadrantCuspsFromDate(systemKey, date, lat, lng);
  } catch (e) {
    if (H.PolarLatitudeError && e instanceof H.PolarLatitudeError) return null;
    throw e;
  }
}

// Whole-sign houses: ASC sign is house 1, then forward.
function houseForSign(signIdx, ascSignIdx) { return AstroCore.houseForSign(signIdx, ascSignIdx); }

// Equal houses from a longitude
function houseForLongEqual(lon, ascDeg) { return AstroCore.houseForLongEqual(lon, ascDeg); }

// CRT residues — pure integer arithmetic on arcseconds
function residues(arcsec) { return AstroCore.residues(arcsec); }

// Speed (deg/day) for each modeled body.
//
// Real-ephemeris path: a central-difference speed computed from
// window.Astronomy (realPlanetSpeedDegPerDay() above) whenever this body has
// one (REAL_EPHEMERIS_BODIES) and a jd was supplied. isRetrograde() above
// derives retrograde = speed < 0 from this exact same call, so the speed
// number and the retrograde flag can never disagree for a given (planet, jd)
// — this FIXES the historical bug where the synthetic constant rate below
// was always positive regardless of isRetrograde()'s separate heuristic.
//
// Synthetic path (jd omitted, body has no real-ephemeris mapping, or the
// real computation itself throws): the original constant mean rate derived
// from PLANET_PERIODS, unchanged from before — the documented offline
// fallback.
function planetSpeed(name, jd) {
  if (window.Astronomy && ["NorthNode", "Lilith"].includes(name) && jd !== undefined) {
    const delta = mod360(planetLongitude(name, jd + 0.005) - planetLongitude(name, jd - 0.005) + 180) - 180;
    return delta / 0.01;
  }
  if (window.Astronomy && REAL_EPHEMERIS_BODIES.has(name) && jd !== undefined) {
    return realPlanetSpeedDegPerDay(name, jd);
  }
  const p = PLANET_PERIODS[name];
  if (!p || p === 0) return 0;
  return 360 / (p * 365.25);  // signed (NorthNode is negative)
}

// Aspect detection (ASPECTS orb table + nearest-aspect lookup) now lives in
// AstroCore — see this file's header.
function nearestAspect(deltaDeg, orbScale = 1) { return AstroCore.nearestAspect(deltaDeg, orbScale); }

// Is the faster planet moving toward the exact aspect angle?
// Returns "applying" or "separating".
function applyingPhase(lonA, lonB, speedA, speedB, target) { return AstroCore.applyingPhase(lonA, lonB, speedA, speedB, target); }

// Antiscion / contra-antiscion of an ecliptic longitude.
function antiscion(lon)        { return AstroCore.antiscion(lon); }
function contraAntiscion(lon)  { return AstroCore.contraAntiscion(lon); }

// Planet joys — the house each planet "rejoices in" (Hellenistic).
const PLANET_JOY = AstroCore.PLANET_JOY;

// Critical degrees — Cardinal: 0,13,26; Fixed: 9,21; Mutable: 4,17.
// 29° in any sign is the anaretic ("degree of fate").
function criticalKind(signIdx, degInSign) { return AstroCore.criticalKind(signIdx, degInSign); }

// ──────────────────────────────────────────────────────────────────────
// computeNatal — derives everything visible from the natal inputs
// ──────────────────────────────────────────────────────────────────────

// The 8 quadrant systems this presentation layer can compute a real cusp
// array for, matching tools/ephemeris/houses.js's QUADRANT_CUSP_FNS keys —
// the same 8 keys POLAR_FALLBACK_POLICY and validate.js's SYSTEM_LABELS
// already carried before any caller routed through them.
const QUADRANT_HOUSE_SYSTEMS = new Set([
  "placidus", "koch", "regiomontanus", "campanus",
  "alcabitius", "topocentric", "meridian", "morinus",
]);

function computeNatal(birth) {
  birth = { houseSystem: "whole", sect: "auto", ...birth };
  birth.sect = birth.sect || "auto";
  if (!Number.isFinite(new Date(birth.dateISO).getTime()) || !Number.isFinite(birth.lat)
      || Math.abs(birth.lat) > 90 || !Number.isFinite(birth.lng) || Math.abs(birth.lng) > 180)
    throw new RangeError("A valid birth instant and latitude/longitude are required");
  if (!["whole", "equal", "porphyry", ...QUADRANT_HOUSE_SYSTEMS].includes(birth.houseSystem))
    throw new RangeError(`Unsupported house system: ${birth.houseSystem}`);
  const date = new Date(birth.dateISO);
  const jd = dateToJD(date);
  const solvedAngles = realAngles(date, birth.lat, birth.lng);
  const asc = solvedAngles ? solvedAngles.ascDeg : approxAscendantDeg(date, birth.lat, birth.lng);
  const mc  = midheavenDeg(date, birth.lng);
  const desc = mod360(asc + 180);
  const ic   = mod360(mc  + 180);
  const ascSignIdx = Math.floor(asc / 30);
  const mcSignIdx  = Math.floor(mc  / 30);
  // Sect follows the physical solar hemisphere. At polar latitude the
  // eastern Ascendant alone does not identify which ecliptic half is above.
  let solarAltitude = null;
  if (window.Astronomy) {
    const A = window.Astronomy;
    const sunEq = A.EquatorFromVector(A.RotateVector(A.Rotation_EQJ_EQD(A.MakeTime(date)), A.GeoVector(A.Body.Sun, date, true)));
    solarAltitude = A.Horizon(date, new A.Observer(birth.lat, birth.lng, 0), sunEq.ra, sunEq.dec).altitude;
  }
  const isDayChart = birth.sect === "day" || (birth.sect === "auto" && (solarAltitude === null
    ? AstroCore.sectIsDay(planetLongitude("Sun", jd), asc, "auto") : solarAltitude > 0));

  // Quadrant houses (Placidus, Koch, ...). houses.js's cusp functions were
  // built and Swiss-Ephemeris-verified in WP-11/WP-12 but never had a
  // presentation-layer caller — the shipped house picker offered only
  // Whole/Equal even though 8 more systems were sitting fully computed and
  // tested one function call away. See docs/COMPLETION_AUDIT.md §4.
  //
  // POLAR_FALLBACK_POLICY's own declared fallback for every "hard" quadrant
  // system is "WholeSign" — honored here exactly, not re-decided. A missing
  // window.Houses module (offline/failed load) degrades the same way, for
  // the same reason astro.jsx's own ASC/MC fallback exists: a page missing
  // a script tag should render an approximate chart, not a blank one.
  let houseSystemActual = birth.houseSystem;
  let houseCusps = null;
  if (birth.houseSystem === "porphyry") {
    // Fixed ASC/IC/DSC/MC labeling cannot trisect reversed polar quadrants.
    if (window.Houses && window.Houses.porphyryCuspsFloat && mod360(mc - asc) > 180) houseCusps = window.Houses.porphyryCuspsFloat(asc, mc);
    else { houseSystemActual = "whole"; }
  }
  if (QUADRANT_HOUSE_SYSTEMS.has(birth.houseSystem)) {
    houseCusps = quadrantCuspsFor(birth.houseSystem, date, birth.lat, birth.lng);
    if (!houseCusps) houseSystemActual = "whole"; // POLAR_FALLBACK_POLICY / offline fallback
  }
  // Single dispatcher for all 3 house-placement call sites below, so the
  // quadrant/whole/equal choice is made once per chart, not per point.
  const houseOf = (lon, sign) => {
    if (houseCusps) return AstroCore.houseForCusps(lon, houseCusps);
    return houseSystemActual === "whole"
      ? houseForSign(sign, ascSignIdx)
      : houseForLongEqual(lon, asc);
  };

  // The Ascendant's own shadow lane — the chart-specific term inside every
  // card's resonance, returned on the chart so the reading can NAME it
  // instead of only feeling it as glow.
  const ascR11 = (Math.round(asc * 3600) % 1296000) % 11;

  const positionWarnings = [];
  if (!solvedAngles) positionWarnings.push("Ascendant uses the closed-form fallback with approximate sidereal time and fixed J2000 obliquity; the house solver did not supply this chart's angle.");
  if (Math.abs(birth.lat) > 66.56) positionWarnings.push(`Polar chart: Ascendant uses the eastern geometric horizon intersection. ${solarAltitude === null ? "Automatic sect is an approximate ecliptic estimate." : "Automatic sect follows geometric Sun altitude."} Historical polar house conventions differ.`);
  if (houseSystemActual !== birth.houseSystem) positionWarnings.push(`Requested ${birth.houseSystem} houses are unavailable for this chart; using ${houseSystemActual} houses.`);
  if (window.Astronomy) positionWarnings.push("North/South Node use mean lunar nodes; Lilith uses mean lunar apogee. These are approximate elements, not true/osculating positions.");
  if (birth.includeSyntheticBodies) positionWarnings.push("Chiron uses a synthetic demo position; no Chiron ephemeris is installed.");
  const planets = PLANET_ORDER.filter(p => p !== "Chiron" || !window.Astronomy || birth.includeSyntheticBodies).map(p => {
    const lon  = planetLongitude(p, jd);
    const sign = Math.floor(lon / 30);
    const arcsec = Math.round(lon * 3600) % 1296000;
    const degInSign = lon - sign * 30;
    return {
      name: p,
      glyph: PLANET_GLYPH[p],
      lon,
      sign,
      degInSign,
      arcsec,
      speed: planetSpeed(p, jd),
      retrograde: isRetrograde(p, jd),
      house: houseOf(lon, sign),
      dignity: dignityFor(p, sign),
      residues: residues(arcsec),
      declination: window.Astronomy && REAL_EPHEMERIS_BODIES.has(p)
        ? window.Astronomy.EquatorFromVector(window.Astronomy.RotateVector(
          window.Astronomy.Rotation_EQJ_EQD(window.Astronomy.MakeTime(date)),
          window.Astronomy.GeoVector(window.Astronomy.Body[p], date, true))).dec
        : planetDeclination(lon, realEclipticLatitudeDeg(p, jd)),
      positionSource: !window.Astronomy ? "synthetic" : REAL_EPHEMERIS_BODIES.has(p) && window.Astronomy ? "ephemeris" : p === "Chiron" ? "synthetic" : "mean-element",
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
      arcsec: Math.round(snLon * 3600) % 1296000,
      speed: nn.speed,
      retrograde: true,
      house: houseOf(snLon, snSign),
      // dignityFor("SouthNode", snSign) is what this line calls now. It
      // used to call dignityFor("Sun", snSign), which is a real defect, not
      // a documented approximation: the Sun's DOMICILE/EXALT rows made the
      // South Node read as "domicile" in Leo, "exaltation" in Aries,
      // "detriment" in Aquarius, and "fall" in Libra — a fabricated,
      // non-neutral classical dignity a node does not classically carry.
      // dignityFor() already falls through to {kind:"neutral", score:0} for
      // any planet name absent from DOMICILE/EXALT (see astro-core.js), and
      // neither table has a "SouthNode" or "NorthNode" entry, so calling it
      // with the node's own name is both correct and requires no new
      // fallback path — every consumer of `.dignity` already renders
      // "neutral" sensibly, since most planets are neutral in most signs.
      // NorthNode was never affected: it is one of PLANET_ORDER, so it
      // already flows through the same generic, already-correct call above
      // (`dignity: dignityFor(p, sign)`).
      dignity: dignityFor("SouthNode", snSign),
      residues: residues(Math.round(snLon * 3600) % 1296000),
      declination: planetDeclination(snLon), // nodes lie on the ecliptic: β ≡ 0
      criticalDegree: criticalKind(snSign, snLon - snSign * 30),
    });
  }

  // For each sign card, find the dominant planet sitting in it (if any).
  // If none, "ruler" planet's tenancy is referenced.
  const cards = ZODIAC.map((sign, idx) => {
    const tenants = planets.filter(p => p.sign === idx);
    const ruler   = planets.find(p => p.name === sign.ruler);
    const principal = tenants[0] ?? ruler;
    const dignity   = dignityFor(principal.name, principal.sign);
    const house     = houseOf(idx * 30 + 15, idx);

    // Full Ptolemaic dignity table — triplicity, term, face
    const actualSign = ZODIAC[principal.sign];
    const tripLord = isDayChart ? TRIP_DAY[actualSign.element] : TRIP_NIGHT[actualSign.element];
    const tripPart = TRIP_PART[actualSign.element];
    const degInSign = principal.degInSign;
    const term = termRuler(principal.sign, degInSign);
    const face = faceRuler(principal.sign, degInSign);
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
    const aspect = principal.name === "Sun" ? null : nearestAspect(delta, birth.orbScale ?? 1);
    if (aspect) aspect.phase = applyingPhase(principal.lon, sun.lon, principal.speed, sun.speed, aspect.angle);

    // Resonance: a 0..1 scalar that drives glow vibrance.
    // Blends Ptolemaic dignity total, tenancy count, aspect tightness, and the
    // card's shadow-lane (mod 11) residue distance from the chart's Asc residue.
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
    };
  });

  // Chart-level classical material
  const sun  = planets.find(p => p.name === "Sun");
  const moon = planets.find(p => p.name === "Moon");
  const phase = lunarPhase(sun.lon, moon.lon);
  phase.illuminationApproximate = true;
  if (window.Astronomy) {
    phase.illumination = window.Astronomy.Illumination(window.Astronomy.Body.Moon, date).phase_fraction;
    phase.illuminationApproximate = false;
  }
  const shape = chartShape(planets.filter(p => REAL_EPHEMERIS_BODIES.has(p.name)));
  const lots  = computeAllLots(asc, planets, isDayChart);

  // ───── Full aspect grid (every visible pair, applying/separating) ─────
  const visibleAspectBodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];
  const aspectGrid = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const A = planets[i], B = planets[j];
      if (!visibleAspectBodies.includes(A.name) || !visibleAspectBodies.includes(B.name)) continue;
      const delta = mod360(A.lon - B.lon);
      const asp = nearestAspect(delta, birth.orbScale ?? 1);
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
  const obliquity = window.Astronomy ? window.Astronomy.EquatorFromVector(window.Astronomy.RotateVector(
    window.Astronomy.Rotation_ECT_EQD(window.Astronomy.MakeTime(date)),
    new window.Astronomy.Vector(0, 1, 0, window.Astronomy.MakeTime(date)))).dec : 23.4393;
  const outOfBounds = planets.filter(p => REAL_EPHEMERIS_BODIES.has(p.name) && Math.abs(p.declination) > obliquity).map(p => ({
    planet: p.name, declination: p.declination,
  }));

  // A page missing the transit module can still display the snapshot estimate,
  // but its uncertainty is explicit. Main chart pages load the real solver.
  const moonApplyingAspect = aspectGrid.some(a =>
    (a.a === "Moon" || a.b === "Moon") && a.phase === "applying" &&
    ["Conjunction","Opposition","Trine","Square","Sextile"].includes(a.aspect));
  const voidOfCourse = window.Astronomy && window.Transits
    ? window.Transits.calculateVoidOfCourse(jd, window.Astronomy)
    : { isVoc: !moonApplyingAspect, daysToNextSignChange: (30 - moon.degInSign) / Math.abs(moon.speed), approximate: true };

  return {
    jd,
    asc,
    mc,
    desc,
    ic,
    ascSignIdx,
    mcSignIdx,
    isDayChart,
    solarAltitude,
    sectSource: birth.sect !== "auto" ? "explicit override" : solarAltitude === null ? "ecliptic estimate" : "geocentric geometric Sun altitude",
    anglesMode: solvedAngles ? "REAL" : "APPROX",
    angleSource: solvedAngles ? "GAST and mean-obliquity horizon solver" : "approximate GMST and fixed-obliquity horizon",
    angleConvention: "Eastern geometric horizon intersection; geographic poles and degenerate intersections are unavailable",
    // houseSystemActual differs from birth.houseSystem exactly when a
    // requested quadrant system fell back to Whole per
    // POLAR_FALLBACK_POLICY (polar latitude) or window.Houses being
    // unavailable (offline/failed module load) — see the dispatch above.
    positionWarnings,
    houseSystemActual,
    houseCusps,
    planets,
    cards,
    lots,
    phase,
    obliquity,
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
    ascR11,
    outOfBounds,
    voidOfCourse,
    birth,
    // WP-18: an unknown birth time still computes every planetary
    // position at local noon (unchanged), but ASC/MC/houses and the
    // Moon's exact degree are only as precise as the assumed clock time
    // — up to ~1° of ASC drift per 4 minutes of real error, worst case
    // near the equator. This flag lets downstream consumers (WP-19's
    // chart display, WP-29's interpretation engine) suppress or caveat
    // those specific precision claims without this module needing to
    // know anything about how they're presented.
    timeUnknown: !!birth.timeUnknown,
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
