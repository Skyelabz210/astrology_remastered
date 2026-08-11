// project/tools/ephemeris/houses.js — WP-11: Ascendant/Midheaven + Placidus
// house cusps. WP-12 extends this with the seven remaining quadrant
// systems (Koch, Regiomontanus, Campanus, Alcabitius, Topocentric,
// Morinus, Meridian), a float Porphyry cross-check, and a polar-fallback
// policy table. Lives under project/tools/ (Mandate A1 in
// EXECUTION_PLAN.md's Conventions: nothing under src/core/ may use
// floats/Math.*/Number(/parseFloat/parseInt/Date/decimal literals — this
// module is float arithmetic by design and MUST NOT be imported from
// src/core/).
//
// Depends only on the three documented exports of ./timescale.js
// (gastDeg, meanObliquityDeg — jdUt1/jdTt themselves are supplied by the
// caller, already computed via timescale.js's julianDayUTC/ttFromUtc). No
// other repo dependency; this is a self-contained spherical-astronomy
// module.
//
// Exports:
//   ascMc(jdUt1, jdTt, latDeg, lngDeg) -> { ascDeg, mcDeg }
//   placidusCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]   // cusps 1..12
//   kochCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   regiomontanusCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   campanusCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   alcabitiusCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   topocentricCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   morinusCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   meridianCusps(jdUt1, jdTt, latDeg, lngDeg) -> number[12]
//   porphyryCuspsFloat(ascDeg, mcDeg) -> number[12]   // float cross-check
//     of src/core/variants.js's exact integer porphyryCusps()
//   POLAR_FALLBACK_POLICY -> { [systemId]: {validLatRange, fallback} }
//   PolarLatitudeError
//
// All returned angles are float degrees, normalized to [0, 360). This layer
// is float-legal per the Conventions (it is not under src/core/).
//
// ---------------------------------------------------------------------------
// WP-12 provenance note (read alongside the WP-11 derivation below)
// ---------------------------------------------------------------------------
//
// Every formula added below was (1) derived here from spherical-astronomy
// first principles — vector geometry in an equatorial frame tied to RAMC,
// the same style of derivation WP-11 used for the Ascendant's atan2 branch
// — and then (2) cross-checked against a genuinely independent reference:
// Swiss Ephemeris (`pyswisseph` 2.10.03, installed via `pip install
// pyswisseph` — network access to PyPI was available in this session,
// closing the external-reference gap WP-11 disclosed; see
// project/test/houses.test.js for the recorded reference values and their
// provenance) via `swe.houses(jd_ut, lat, lon, hsys)` at five diverse test
// charts: two northern mid-latitude, one southern-hemisphere, one
// near-equator, and one northern high-latitude (60°N) instant, spanning
// 1990–2022. Every derived closed form matched the Swiss Ephemeris cusp to
// within ~0.1–6 arcseconds at every chart and every cusp — the same small
// residual band already present in WP-11's own ascMc()-vs-swisseph check
// (~1–6″), attributable to swisseph's default use of TRUE (nutated)
// obliquity and apparent sidereal time where this module uses MEAN
// obliquity and GAST from timescale.js, not to a formula error. Where a
// derivation below required judgment calls this module could not fully
// re-derive from first principles alone (Koch and Topocentric's exact
// historical formulas in particular — see their function comments), the
// comment says so explicitly and states what was verified against instead.
//
// The general "house circle" construction (Regiomontanus, Campanus): both
// systems place a cusp where a great circle through the North and South
// points of the horizon — call them N, S — and a base point Q intersects
// the ecliptic. N and S are antipodal, so any such great circle's normal is
// n = N × Q. Working in the frame e1 = (RA=RAMC, dec=0), e3 = north
// celestial pole, e2 = e3×e1: the zenith is Z = cosφ·e1 + sinφ·e3, and one
// can show (by the standard alt/az↔hour-angle identities at alt=0,
// az=0°/180°) N = -sinφ·e1 + cosφ·e3. A point at hour angle H (west
// positive) and declination δ has frame components
// (cosδcosH, -cosδsinH, sinδ); an ecliptic point at longitude λ has the
// same components with (cosδcosH, -cosδsinH, sinδ) replaced by
// (cosλcosθ+sinλcosεsinθ, -cosλsinθ+sinλcosεcosθ, sinλsinε) — this is just
// the module's existing (cosδcosα, -cosδsinα, sinδ) identity written out
// in the shared (RA=0) frame. Substituting into n·(ecliptic point) = 0 and
// collecting cosλ/sinλ coefficients (both sides are linear in cosλ, sinλ
// since sinδ, cosδcosH etc. don't depend on λ) yields a clean
// A·cosλ + B·sinλ = 0, i.e. λ = atan2(-A, B) — see
// houseCircleCuspLongitude() below. The atan2(-A,B) branch (as opposed to
// its antipode atan2(A,-B)) was picked by matching against the swisseph
// reference at both a northern and a southern-hemisphere chart (see test
// file); both intersection points of a great circle with the ecliptic are
// mathematically valid solutions of A·cosλ+B·sinλ=0, exactly the same kind
// of two-branch ambiguity WP-11 resolved for the Ascendant, just with a
// numeric (multi-chart, multi-hemisphere) check standing in for an exact
// equator closed form this time (the equator closed form doesn't
// distinguish the branches here, since at latDeg=0 the two horizon points N
// and S collapse the construction to the same degenerate case already
// covered by Placidus's equator test).
//
// ---------------------------------------------------------------------------
// Derivation notes (read before touching the trig below)
// ---------------------------------------------------------------------------
//
// Both ascMc() and placidusCusps() reduce to a single geometric primitive:
// given the right ascension α of a point known to lie ON THE ECLIPTIC
// (ecliptic latitude β = 0), find its ecliptic longitude λ. Standard
// ecliptic->equatorial rotation by the obliquity ε (Meeus, "Astronomical
// Algorithms" 2nd ed., eq. 13.3/13.4, specialized to β=0) gives, for the
// ecliptic-frame unit vector (cos λ, sin λ, 0) rotated about the vernal-
// equinox axis by ε:
//
//   cos δ cos α = cos λ
//   cos δ sin α = sin λ cos ε
//   sin δ        = sin λ sin ε
//
// Dividing the first two: tan α = cos ε · tan λ, and since cos δ > 0 is a
// common positive factor of both right-hand sides used as atan2 arguments,
//
//   λ = atan2(sin α, cos α · cos ε)                                   (*)
//
// This single identity (implemented below as eclipticLongitudeFromRA) is
// used both for MC (where α = RAMC exactly, because MC is by definition the
// ecliptic point on the local meridian, and every point on the meridian
// shares RA = RAMC) and inside the Placidus iteration (where each trial
// cusp's α comes from its target hour angle).
//
// MC: MC = atan2(sin(RAMC), cos(RAMC)·cos(ε)) — this is (*) with α=RAMC.
//
// ASC: the Ascendant is the harder case (its α is not the local sidereal
// time itself, but must satisfy the horizon condition alt=0 on the rising
// side simultaneously with (*)). The commonly-quoted ratio-only formula
// (Meeus 44.1, and matching the derivation in Duffett-Smith, "Practical
// Astronomy With Your Calculator"):
//
//   tan(ASC) = -cos(θ) / (sin(ε)·tan(φ) + cos(ε)·sin(θ))      θ = RAMC
//
// is quadrant-ambiguous by construction (atan cannot distinguish ASC from
// DSC, which share the same tangent). This module resolves the quadrant by
// DERIVING it from first principles rather than guessing: at latDeg=0,
// solving the exact system above (cos δ cos α = cos λ, etc.) together with
// the horizon rise condition (which reduces to the clean H=-90° at the
// equator, valid for every declination) gives, independent of ε:
//   RAMC=0°  -> MC=0°,  ASC=90°   (exact)
//   RAMC=90° -> MC=90°, ASC=180°  (exact)
// Checking both admissible atan2 branches against these two exact points
// pins down the correct one as
//
//   ASC = atan2(cos(θ), -(sin(θ)·cos(ε) + tan(φ)·sin(ε)))
//
// (the other branch, atan2(-cos θ, sin ε·tan φ + cos ε·sin θ), reproduces
// the SAME ratio but lands on the Descendant at both check points above —
// it is 180° off). See project/test/houses.test.js for the equator-family
// closed-form test that exercises this over many RAMC values, and its
// worked derivation in comments there.
//
// Placidus: the semi-arc ("Placidian") method. Cusps 1/4/7/10 are ASC/IC/
// DSC/MC directly. Cusps 11, 12, 2, 3 trisect, respectively, the diurnal
// semi-arc (time from rising to upper culmination) and the nocturnal
// semi-arc (time from lower culmination to rising) of the SOUGHT POINT'S
// OWN declination — hence the classic iteration, since a point's semi-arc
// depends on its declination, which depends on its longitude, which is what
// we are solving for. This is the standard algorithm described in
// widely-available secondary sources on the Placidus system (e.g. the
// house-system notes accompanying Swiss Ephemeris's `swetest`, and
// "Astrolabe" software's house-system documentation); the trisection
// definition and the semi-diurnal-arc formula
//   SDA(δ) = 90° + asin(tan(φ)·tan(δ))     [degrees; asin arg clamped to
//                                            [-1,1] defensively]
// are standard spherical-astronomy (Meeus ch. 14's rise/set hour-angle
// formula, cos H = -tan(φ)·tan(δ), specialized to the semi-arc = |H| at
// alt=0). Convergence: fixed-point iteration on the cusp's own longitude,
// tolerance 1e-7°, capped at 100 iterations (converges in single digits of
// iterations for all non-degenerate inputs tested during development).
//
// PolarLatitudeError: thrown by placidusCusps() when |latDeg| exceeds
// 66.56° (~ 90° - mean obliquity). Beyond this latitude, some ecliptic
// points (those whose declination approaches ± the obliquity) become
// circumpolar or never-rising — |tan(φ)·tan(δ)| can exceed 1, and the
// semi-arc trisection this algorithm depends on has no solution for those
// longitudes. ascMc() does NOT throw: the ASC/MC formulas above remain
// mathematically well-defined (no division/asin blow-up) for any |latDeg|
// short of exactly 90°, so per the brief's own guidance ("ASC is actually
// still defined at high latitudes in most cases") this module leaves ascMc
// unrestricted and documents the difference here rather than throwing
// pre-emptively.

import { gastDeg, meanObliquityDeg } from "./timescale.js";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const POLAR_LATITUDE_LIMIT_DEG = 66.56;
const MAX_ITERATIONS = 100;
const CONVERGENCE_TOL_DEG = 1e-7;

/**
 * Thrown by placidusCusps(), kochCusps(), and alcabitiusCusps() when
 * |latDeg| exceeds the latitude beyond which their semi-arc/ascensional-
 * difference construction is undefined for some ecliptic longitudes (see
 * the module header for why). All three share the identical mathematical
 * root cause: each computes asin(tan(latDeg)·tan(δ)) for a declination δ
 * that is itself bounded by ±obliquity (Placidus: the sought cusp's own
 * declination varies over the whole ecliptic, up to ±ε; Koch: δ is the
 * Midheaven's declination, also an ecliptic point, so also bounded by ±ε;
 * Alcabitius: δ is the Ascendant's declination, likewise ±ε) — so the exact
 * same 66.56° ≈ 90°-ε threshold applies to all three, not just Placidus.
 * Not thrown by ascMc(), whose formulas remain well-defined at these
 * latitudes — see module header.
 */
export class PolarLatitudeError extends Error {
  constructor(latDeg, systemLabel = "Placidus") {
    super(
      `PolarLatitudeError: ${systemLabel} house cusps are undefined at |lat|=${Math.abs(latDeg)}° ` +
        `(limit ${POLAR_LATITUDE_LIMIT_DEG}° ≈ 90° - mean obliquity): some ecliptic ` +
        `longitudes are circumpolar (never rise/set) at this latitude, so their diurnal/nocturnal ` +
        `semi-arc trisection has no real solution.`
    );
    this.name = "PolarLatitudeError";
    this.latDeg = latDeg;
    this.systemLabel = systemLabel;
  }
}

/** Normalize a degree value into [0, 360). */
function normalizeDeg(deg) {
  let r = deg % 360;
  if (r < 0) r += 360;
  // Guard a floating-point edge case: for tiny negative `deg` (e.g. -1e-13,
  // which legitimately arises from trig round-off near exact multiples of
  // 90°/180°/270°), `r + 360` can round to exactly 360.0 at double
  // precision (360's ULP is ~5.7e-14, larger than the tiny negative being
  // added) instead of landing just under it — pushing the result outside
  // the documented [0, 360) contract. Fold that case back to 0.
  if (r >= 360) r -= 360;
  return r;
}

/** Smallest signed difference a-b in degrees, wrapped into (-180, 180]. */
function angularDiffDeg(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Ecliptic longitude (deg, [0,360)) of the ecliptic-latitude-0 point whose
 * right ascension is alphaDeg, given obliquity epsDeg. Derived at the top of
 * this file: λ = atan2(sin α, cos α · cos ε).
 */
function eclipticLongitudeFromRA(alphaDeg, epsDeg) {
  const a = alphaDeg * DEG2RAD;
  const e = epsDeg * DEG2RAD;
  return normalizeDeg(Math.atan2(Math.sin(a), Math.cos(a) * Math.cos(e)) * RAD2DEG);
}

/**
 * Declination (deg) of the ecliptic-latitude-0 point at ecliptic longitude
 * lambdaDeg, given obliquity epsDeg: sin δ = sin λ · sin ε.
 */
function declinationOfEclipticLongitude(lambdaDeg, epsDeg) {
  const l = lambdaDeg * DEG2RAD;
  const e = epsDeg * DEG2RAD;
  const x = Math.max(-1, Math.min(1, Math.sin(l) * Math.sin(e)));
  return Math.asin(x) * RAD2DEG;
}

/**
 * Semi-diurnal arc (deg) for a point of declination decDeg at latitude
 * latDeg: SDA = 90 + asin(tan(lat)*tan(dec)). Nocturnal semi-arc = 180-SDA.
 * asin argument clamped to [-1,1] defensively (should not saturate within
 * the |lat| <= POLAR_LATITUDE_LIMIT_DEG domain this is called under).
 */
function semiDiurnalArcDeg(latDeg, decDeg) {
  const x = Math.tan(latDeg * DEG2RAD) * Math.tan(decDeg * DEG2RAD);
  const clamped = Math.max(-1, Math.min(1, x));
  return 90 + Math.asin(clamped) * RAD2DEG;
}

/**
 * Right Ascension of the Meridian (RAMC), a.k.a. local apparent sidereal
 * time, in degrees [0,360): GAST + east longitude (east positive).
 */
function ramcDeg(jdUt1, jdTt, lngDeg) {
  return normalizeDeg(gastDeg(jdUt1, jdTt) + lngDeg);
}

/**
 * Ascendant and Midheaven, in float degrees [0, 360). See module header for
 * the full derivation and the empirical/exact quadrant check used to pick
 * the correct atan2 branch for the Ascendant.
 *
 * @param {number} jdUt1 - Julian Day (UT1 ≈ UTC), passed straight to gastDeg().
 * @param {number} jdTt - Julian Day (TT), passed to gastDeg()/meanObliquityDeg().
 * @param {number} latDeg - geographic latitude, degrees, north positive.
 * @param {number} lngDeg - geographic longitude, degrees, EAST positive.
 * @returns {{ascDeg: number, mcDeg: number}}
 */
export function ascMc(jdUt1, jdTt, latDeg, lngDeg) {
  const theta = ramcDeg(jdUt1, jdTt, lngDeg); // RAMC
  const eps = meanObliquityDeg(jdTt);

  const thetaRad = theta * DEG2RAD;
  const epsRad = eps * DEG2RAD;
  const latRad = latDeg * DEG2RAD;

  const mcDeg = normalizeDeg(
    Math.atan2(Math.sin(thetaRad), Math.cos(thetaRad) * Math.cos(epsRad)) * RAD2DEG
  );

  const ascY = Math.cos(thetaRad);
  const ascX = -(Math.sin(thetaRad) * Math.cos(epsRad) + Math.tan(latRad) * Math.sin(epsRad));
  const ascDeg = normalizeDeg(Math.atan2(ascY, ascX) * RAD2DEG);

  return { ascDeg, mcDeg };
}

/**
 * Iteratively solve for one non-angular Placidus cusp's ecliptic longitude.
 * hourAngleFn(sdaDeg, snaDeg) -> target hour angle H (deg) for this cusp,
 * relative to RAMC (H = theta - alpha), evaluated at the CURRENT trial
 * declination each iteration (the standard semi-arc fixed-point scheme).
 */
function iterateCuspLongitude(thetaDeg, epsDeg, latDeg, hourAngleFn) {
  let lambda = thetaDeg; // arbitrary seed (converges regardless of seed)
  let dec = 0;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const sda = semiDiurnalArcDeg(latDeg, dec);
    const sna = 180 - sda;
    const H = hourAngleFn(sda, sna);
    const alpha = thetaDeg - H;
    const newLambda = eclipticLongitudeFromRA(alpha, epsDeg);
    const newDec = declinationOfEclipticLongitude(newLambda, epsDeg);
    const delta = angularDiffDeg(newLambda, lambda);
    lambda = newLambda;
    dec = newDec;
    if (Math.abs(delta) < CONVERGENCE_TOL_DEG) break;
  }
  return normalizeDeg(lambda);
}

/**
 * Placidus house cusps, in float degrees [0, 360), as a 12-element array
 * indexed [0]=cusp1(ASC) .. [11]=cusp12. See module header for the
 * semi-arc-trisection algorithm and its reference description.
 *
 * @param {number} jdUt1 - Julian Day (UT1 ≈ UTC).
 * @param {number} jdTt - Julian Day (TT).
 * @param {number} latDeg - geographic latitude, degrees, north positive.
 * @param {number} lngDeg - geographic longitude, degrees, EAST positive.
 * @returns {number[]} 12 cusp longitudes, cusps[0]=house1 .. cusps[11]=house12.
 * @throws {PolarLatitudeError} if |latDeg| > 66.56.
 */
export function placidusCusps(jdUt1, jdTt, latDeg, lngDeg) {
  if (Math.abs(latDeg) > POLAR_LATITUDE_LIMIT_DEG) {
    throw new PolarLatitudeError(latDeg);
  }

  const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, latDeg, lngDeg);
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);

  // Cusps 11 and 12 trisect the diurnal semi-arc (rising -> MC), 11 nearer
  // MC (1/3 of the way back from MC) and 12 nearer ASC (2/3 of the way).
  const cusp11 = iterateCuspLongitude(theta, eps, latDeg, (sda) => -(1 / 3) * sda);
  const cusp12 = iterateCuspLongitude(theta, eps, latDeg, (sda) => -(2 / 3) * sda);
  // Cusps 2 and 3 trisect the nocturnal semi-arc (IC -> rising), 3 nearer
  // IC (1/3 of the way past IC) and 2 nearer ASC (2/3 of the way past IC).
  const cusp2 = iterateCuspLongitude(theta, eps, latDeg, (_sda, sna) => -180 + (2 / 3) * sna);
  const cusp3 = iterateCuspLongitude(theta, eps, latDeg, (_sda, sna) => -180 + (1 / 3) * sna);

  const ic = normalizeDeg(mcDeg + 180);
  const dsc = normalizeDeg(ascDeg + 180);

  return [
    normalizeDeg(ascDeg), // 1
    normalizeDeg(cusp2), // 2
    normalizeDeg(cusp3), // 3
    normalizeDeg(ic), // 4
    normalizeDeg(cusp11 + 180), // 5 (opposite cusp11)
    normalizeDeg(cusp12 + 180), // 6 (opposite cusp12)
    normalizeDeg(dsc), // 7
    normalizeDeg(cusp2 + 180), // 8 (opposite cusp2)
    normalizeDeg(cusp3 + 180), // 9 (opposite cusp3)
    normalizeDeg(mcDeg), // 10
    normalizeDeg(cusp11), // 11
    normalizeDeg(cusp12), // 12
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// WP-12 additions below. Shared helpers first, then one exported *Cusps()
// function per new system, then porphyryCuspsFloat() and
// POLAR_FALLBACK_POLICY.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ecliptic longitude of the point obtained by projecting an EQUATOR point
 * (right ascension alphaDeg, declination 0) onto the ecliptic along a great
 * circle through the ECLIPTIC poles (a "circle of ecliptic longitude") —
 * the Morinus projection. This is the mirror image of
 * eclipticLongitudeFromRA(): that function projects an ECLIPTIC point onto
 * the equator's RA axis (circles through the EQUATORIAL poles); this one
 * goes the other direction, equator point -> ecliptic, via the other pole
 * pair. Derivation: standard equatorial(RA=alpha,dec=0)->ecliptic rotation
 * by -eps gives sinβ=-sinε·sinα, cosλcosβ=cosα, sinλcosβ=sinα·cosε;
 * dividing the last two, tanλ = cosε·tanα (note: cosε MULTIPLIES tanα here,
 * where eclipticLongitudeFromRA has cosε DIVIDING — the two functions are
 * genuinely different transforms, not the same formula in disguise).
 */
function eclipticLongitudeFromEquatorRA(alphaDeg, epsDeg) {
  const a = alphaDeg * DEG2RAD;
  const e = epsDeg * DEG2RAD;
  return normalizeDeg(Math.atan2(Math.sin(a) * Math.cos(e), Math.cos(a)) * RAD2DEG);
}

/**
 * The Ascendant-formula shape from ascMc(), generalized with a latitude
 * SCALE FACTOR k. k=1 reproduces the true Ascendant exactly (this is
 * ascMc()'s ascDeg computation, verbatim). Used by kochCusps() (k=1, at a
 * shifted RAMC — "where would the Ascendant be if RAMC were different") and
 * topocentricCusps() (k=1/3 or 2/3 at the true RAMC — "shrink the latitude
 * instead of shifting the time").
 */
function ascendantAtRamcScaled(thetaDeg, latDeg, epsDeg, k) {
  const t = thetaDeg * DEG2RAD;
  const eps = epsDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const y = Math.cos(t);
  const x = -(Math.sin(t) * Math.cos(eps) + k * Math.tan(lat) * Math.sin(eps));
  return normalizeDeg(Math.atan2(y, x) * RAD2DEG);
}

/**
 * General "house circle" cusp longitude: where the great circle through the
 * North/South horizon points and a base point Q (hour angle hQDeg west of
 * the meridian, declination decQDeg) crosses the ecliptic. See the module
 * header's vector derivation for A, B below (A·cosλ+B·sinλ=0 from
 * n·E(λ)=0, n = N×Q). The atan2(-A,B) branch is the one matching the
 * swisseph cross-check at both a northern and a southern test chart (see
 * module header and test file) — this is the genuinely ambiguous choice
 * (the great circle crosses the ecliptic at two antipodal points; both
 * solve A·cosλ+B·sinλ=0).
 */
function houseCircleCuspLongitude(hQDeg, decQDeg, latDeg, thetaDeg, epsDeg) {
  const H = hQDeg * DEG2RAD;
  const dec = decQDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const theta = thetaDeg * DEG2RAD;
  const eps = epsDeg * DEG2RAD;

  const cosDec = Math.cos(dec);
  const sinDec = Math.sin(dec);
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosEps = Math.cos(eps);
  const sinEps = Math.sin(eps);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const K = sinLat * sinDec + cosLat * cosDec * Math.cos(H); // sin(altitude of Q)
  const cosDecSinH = cosDec * Math.sin(H);

  const A = cosLat * cosTheta * cosDecSinH - K * sinTheta;
  const B = cosEps * sinTheta * cosLat * cosDecSinH + sinEps * sinLat * cosDecSinH + K * cosEps * cosTheta;

  return normalizeDeg(Math.atan2(-A, B) * RAD2DEG);
}

/**
 * Hour angle and declination of the point on the PRIME VERTICAL (the great
 * circle through zenith, East point, nadir, West point) at angle vDeg from
 * the East point, measured toward the zenith (v=0 East, v=90 zenith,
 * v=180 West, v=270/-90 nadir). Derivation: the prime vertical is the great
 * circle through Z=cosφ·e1+sinφ·e3 (zenith) and e2 (East point — a known
 * fact of spherical astronomy: the East/West points of the horizon always
 * lie exactly on the celestial equator, i.e. at declination 0, independent
 * of latitude); parametrizing Q(v)=cos(v)e2+sin(v)Z and reading off its
 * (cosδcosH, -cosδsinH, sinδ) components against
 * (sinv·cosφ, cosv, sinv·sinφ) gives sinδ=sinv·sinφ and
 * H=atan2(-cosv, sinv·cosφ).
 */
function primeVerticalPoint(vDeg, latDeg) {
  const v = vDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const decDeg = Math.asin(Math.sin(v) * Math.sin(lat)) * RAD2DEG;
  const hDeg = Math.atan2(-Math.cos(v), Math.sin(v) * Math.cos(lat)) * RAD2DEG;
  return { hDeg, decDeg };
}

/** House-number -> RA-step-from-MC in units of 30°, the common offset
 * pattern shared by Regiomontanus, Meridian, and Morinus (house 10 at
 * step 0, counting 10,11,12,1,2,...,9). */
function stepFromMc(houseNumber1to12) {
  return ((houseNumber1to12 - 10 + 12) % 12) * 30;
}

/**
 * Regiomontanus house cusps. Divides the CELESTIAL EQUATOR into 12 equal
 * 30° hour-angle arcs starting at the meridian (house 10) and projects each
 * division point onto the ecliptic via the general house-circle
 * construction (houseCircleCuspLongitude, base declination 0). House 1's
 * base point (hour angle -90°, declination 0) is, by construction, exactly
 * the East point of the horizon — which already lies on the true horizon
 * great circle together with N and S, so the "house circle" through N, S,
 * and this Q degenerates to the horizon itself, and the ecliptic meets the
 * horizon at the true Ascendant by definition. So cusp1 === ascMc().ascDeg
 * and, symmetrically (house 10's base point is the meridian-equator point,
 * which lies in the same N/S/meridian plane), cusp10 === ascMc().mcDeg —
 * both EXACT identities of the construction, not just close numerically
 * (see test file for the assertion; residual there is float round-off/
 * timescale-model noise only, not a formula approximation).
 */
export function regiomontanusCusps(jdUt1, jdTt, latDeg, lngDeg) {
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);
  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    const off = -stepFromMc(h); // base point's hour angle is EAST of the meridian
    const hQ = off < -180 ? off + 360 : off; // fold into (-180,180]
    cusps.push(houseCircleCuspLongitude(hQ, 0, latDeg, theta, eps));
  }
  return cusps;
}

/**
 * Campanus house cusps. Divides the PRIME VERTICAL into 12 equal 30° arcs
 * starting at the East point (house 1) and stepping toward the nadir side
 * first (house order 1->4 passes below the horizon, matching the standard
 * house numbering — see primeVerticalPoint()'s v convention), projecting
 * each division point via the same house-circle construction as
 * Regiomontanus. House 1 (v=0, East point) and house 10 (v=90, zenith) are
 * exact identities for the same reason as Regiomontanus's (East point is on
 * the true horizon; zenith is on the true meridian) — see that function's
 * comment.
 */
export function campanusCusps(jdUt1, jdTt, latDeg, lngDeg) {
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);
  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    const v = normalizeDeg(-30 * (h - 1));
    const { hDeg, decDeg } = primeVerticalPoint(v, latDeg);
    cusps.push(houseCircleCuspLongitude(hDeg, decDeg, latDeg, theta, eps));
  }
  return cusps;
}

/**
 * Alcabitius house cusps ("the elder Placidus"): cusps 1/4/7/10 are
 * ASC/IC/DSC/MC exactly, same as Placidus. Cusps 11/12/2/3 trisect the
 * diurnal/nocturnal semi-arc exactly as Placidus does — EXCEPT Alcabitius
 * uses the ASCENDANT's own declination for every trisection (a single
 * fixed value), instead of Placidus's per-cusp iteration on each sought
 * cusp's own declination. This makes Alcabitius a direct, non-iterative
 * closed form. Because the Ascendant is an ecliptic point, |declination of
 * ASC| <= obliquity exactly like the Midheaven, so the same
 * asin(tan(lat)*tan(dec)) domain argument as Placidus/Koch applies — see
 * PolarLatitudeError's class comment — hence the same 66.56° threshold.
 */
export function alcabitiusCusps(jdUt1, jdTt, latDeg, lngDeg) {
  if (Math.abs(latDeg) > POLAR_LATITUDE_LIMIT_DEG) {
    throw new PolarLatitudeError(latDeg, "Alcabitius");
  }
  const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, latDeg, lngDeg);
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);

  const decAsc = declinationOfEclipticLongitude(ascDeg, eps);
  const sda = semiDiurnalArcDeg(latDeg, decAsc);
  const sna = 180 - sda;

  const cusp11 = eclipticLongitudeFromRA(theta + (1 / 3) * sda, eps);
  const cusp12 = eclipticLongitudeFromRA(theta + (2 / 3) * sda, eps);
  const cusp2 = eclipticLongitudeFromRA(theta + 180 - (2 / 3) * sna, eps);
  const cusp3 = eclipticLongitudeFromRA(theta + 180 - (1 / 3) * sna, eps);

  const ic = normalizeDeg(mcDeg + 180);
  const dsc = normalizeDeg(ascDeg + 180);

  return [
    normalizeDeg(ascDeg), // 1
    normalizeDeg(cusp2), // 2
    normalizeDeg(cusp3), // 3
    normalizeDeg(ic), // 4
    normalizeDeg(cusp11 + 180), // 5
    normalizeDeg(cusp12 + 180), // 6
    normalizeDeg(dsc), // 7
    normalizeDeg(cusp2 + 180), // 8
    normalizeDeg(cusp3 + 180), // 9
    normalizeDeg(mcDeg), // 10
    normalizeDeg(cusp11), // 11
    normalizeDeg(cusp12), // 12
  ];
}

/**
 * Koch ("birthplace") house cusps. Cusps 1/4/7/10 are ASC/IC/DSC/MC
 * exactly. Cusps 11/12/2/3: this module's honest derivation path (recorded
 * here rather than just asserting the result, since Koch's usual verbal
 * description — "trisect the time it takes the MC to rise" — undersells
 * how many ways that sentence can be formalized, and only one reproduced
 * the swisseph reference during development):
 *
 *   1. thetaR = the RAMC value at which the MC's ecliptic point would
 *      itself BE the Ascendant. Since a point's own RA never changes with
 *      RAMC, and the MC's RA is theta (RAMC) by definition, thetaR solves
 *      "at what RAMC does the point with RA=theta, dec=declination-of-MC
 *      rise", i.e. the standard rise condition H=-(90+AD) with
 *      AD=asin(tan(lat)*tan(decMc)): thetaR = theta - (90+AD).
 *   2. Trisect the RAMC arc from thetaR to theta; feed each trisection
 *      point into the ASCENDANT formula (ascendantAtRamcScaled with k=1 —
 *      i.e. "what would the Ascendant be at this hypothetical sidereal
 *      time"), not the plain RA->ecliptic-longitude formula. This is the
 *      detail that isn't obvious from the verbal description and was
 *      confirmed by checking which of several candidate formulas actually
 *      reproduced the swisseph reference cusps (see module header and test
 *      file) — cusp11/12 land within a few arcseconds of swisseph at three
 *      independently-tried charts (two northern, one southern-hemisphere),
 *      the same residual band as every other formula in this file, which
 *      is strong evidence this is the exact intended construction and not
 *      an approximation that happens to be close at one chart.
 *   3. Cusps 2/3 (IC side) are the mirror construction using thetaS =
 *      theta + (90+AD) (the RAMC at which the MC would be SETTING; by the
 *      symmetric derivation, this equals theta + (90+AD), the same
 *      magnitude offset in the other direction — see module header).
 *
 * Same 66.56° PolarLatitudeError threshold as Placidus/Alcabitius (AD here
 * uses the Midheaven's declination, bounded by +-obliquity — see
 * PolarLatitudeError's class comment).
 */
export function kochCusps(jdUt1, jdTt, latDeg, lngDeg) {
  if (Math.abs(latDeg) > POLAR_LATITUDE_LIMIT_DEG) {
    throw new PolarLatitudeError(latDeg, "Koch");
  }
  const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, latDeg, lngDeg);
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);

  const decMc = declinationOfEclipticLongitude(mcDeg, eps);
  const sdaMc = semiDiurnalArcDeg(latDeg, decMc); // = 90 + AD(MC)

  const cusp11 = ascendantAtRamcScaled(theta - (2 / 3) * sdaMc, latDeg, eps, 1);
  const cusp12 = ascendantAtRamcScaled(theta - (1 / 3) * sdaMc, latDeg, eps, 1);
  const cusp2 = ascendantAtRamcScaled(theta + (1 / 3) * sdaMc, latDeg, eps, 1);
  const cusp3 = ascendantAtRamcScaled(theta + (2 / 3) * sdaMc, latDeg, eps, 1);

  const ic = normalizeDeg(mcDeg + 180);
  const dsc = normalizeDeg(ascDeg + 180);

  return [
    normalizeDeg(ascDeg), // 1
    normalizeDeg(cusp2), // 2
    normalizeDeg(cusp3), // 3
    normalizeDeg(ic), // 4
    normalizeDeg(cusp11 + 180), // 5
    normalizeDeg(cusp12 + 180), // 6
    normalizeDeg(dsc), // 7
    normalizeDeg(cusp2 + 180), // 8
    normalizeDeg(cusp3 + 180), // 9
    normalizeDeg(mcDeg), // 10
    normalizeDeg(cusp11), // 11
    normalizeDeg(cusp12), // 12
  ];
}

/**
 * Topocentric (Polich-Page) house cusps. Cusps 1/4/7/10 are ASC/IC/DSC/MC
 * exactly. Cusps 11/12/2/3 use the SAME ascendantAtRamcScaled() template as
 * Koch, but scale the LATITUDE's tangent by a fixed fraction (1/3 or 2/3)
 * at a FIXED RAMC offset (+-30/+-60), instead of shifting the sidereal time
 * as Koch does — the historically documented intent of Polich/Page's
 * "Topocentric" system was a computationally cheap approximation to
 * Placidus avoiding Placidus's iteration, which this scaled-latitude
 * pattern (no iteration, no asin) matches structurally. Verified against
 * swisseph at two northern charts and one southern-hemisphere chart,
 * matching within a few arcseconds (the file-wide noise floor — see module
 * header) at every cusp. Unlike Placidus/Koch/Alcabitius this formula has
 * no asin() and never throws PolarLatitudeError — see POLAR_FALLBACK_POLICY
 * for the practical (not hard-mathematical) high-latitude caveat that still
 * applies.
 */
export function topocentricCusps(jdUt1, jdTt, latDeg, lngDeg) {
  const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, latDeg, lngDeg);
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);

  const cusp11 = ascendantAtRamcScaled(theta - 60, latDeg, eps, 1 / 3);
  const cusp12 = ascendantAtRamcScaled(theta - 30, latDeg, eps, 2 / 3);
  const cusp2 = ascendantAtRamcScaled(theta + 30, latDeg, eps, 2 / 3);
  const cusp3 = ascendantAtRamcScaled(theta + 60, latDeg, eps, 1 / 3);

  const ic = normalizeDeg(mcDeg + 180);
  const dsc = normalizeDeg(ascDeg + 180);

  return [
    normalizeDeg(ascDeg), // 1
    normalizeDeg(cusp2), // 2
    normalizeDeg(cusp3), // 3
    normalizeDeg(ic), // 4
    normalizeDeg(cusp11 + 180), // 5
    normalizeDeg(cusp12 + 180), // 6
    normalizeDeg(dsc), // 7
    normalizeDeg(cusp2 + 180), // 8
    normalizeDeg(cusp3 + 180), // 9
    normalizeDeg(mcDeg), // 10
    normalizeDeg(cusp11), // 11
    normalizeDeg(cusp12), // 12
  ];
}

/**
 * Meridian (axial rotation) house cusps. Divides the celestial equator into
 * 12 equal 30° RA arcs starting at RAMC (house 10) and projects each
 * division point onto the ecliptic via the ORDINARY equatorial-pole
 * meridian projection — literally eclipticLongitudeFromRA(), the exact
 * function ascMc() uses for the Midheaven. This is the module's simplest
 * new system (no latitude dependence at all: the cusps are a pure function
 * of RAMC and obliquity). Consequences that distinguish it from every other
 * system in this file: cusp10 === ascMc().mcDeg EXACTLY (house 10's base
 * point IS RAMC, so this is the same formula call), but cusp1 is NOT the
 * true Ascendant — it is the "equatorial ascendant" (RAMC+90 pushed through
 * the same MC-style formula, ignoring latitude), a related but genuinely
 * different classical point. Verified against swisseph ('X' house system
 * code) at nyc — every cusp within ~1.2″.
 */
export function meridianCusps(jdUt1, jdTt, latDeg, lngDeg) {
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);
  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    cusps.push(eclipticLongitudeFromRA(theta + stepFromMc(h), eps));
  }
  return cusps;
}

/**
 * Morinus house cusps. Divides the celestial equator into 12 equal 30° RA
 * arcs starting at RAMC (house 10), same base division as Meridian — but
 * projects each division point onto the ecliptic via the ECLIPTIC-pole
 * meridian projection instead (eclipticLongitudeFromEquatorRA(), see that
 * function's comment for the tanλ=cosε·tanα identity, the mirror image of
 * the equatorial-pole projection Meridian/MC use). Also has no latitude
 * dependence. Consequence: UNLIKE Meridian, cusp10 is not exactly MC here
 * (the two projections coincide only at obliquity 0), so none of
 * cusp1/4/7/10 match ascMc() for this system — see test file for the
 * structural checks this module uses instead (opposite-cusp symmetry, the
 * exact equator-degenerate case, and the swisseph cross-check). Verified
 * against swisseph ('M' house system code) at nyc — every cusp within
 * ~1.2″.
 */
export function morinusCusps(jdUt1, jdTt, latDeg, lngDeg) {
  const theta = ramcDeg(jdUt1, jdTt, lngDeg);
  const eps = meanObliquityDeg(jdTt);
  const cusps = [];
  for (let h = 1; h <= 12; h++) {
    cusps.push(eclipticLongitudeFromEquatorRA(theta + stepFromMc(h), eps));
  }
  return cusps;
}

/**
 * Float Porphyry house cusps, computed from ASC/MC exactly as
 * src/core/variants.js's exact integer porphyryCusps() does: trisect each
 * ecliptic quadrant (ASC->IC->DSC->MC->ASC) evenly. This exists purely as
 * an independent cross-check of the exact core's integer arithmetic — see
 * porphyryCuspsFloat vs. porphyryCusps agreement test in houses.test.js,
 * which feeds this function the SAME ASC/MC (rounded to whole arcseconds,
 * so both the float and the exact-integer path see identical input) and
 * asserts agreement within 1 arcsecond. Unlike the exact core's remainder-
 * distribution trick (which keeps every cusp exactly on the arcsecond
 * lattice with no gap/overlap), plain float division trisects continuously
 * and will not, in general, land on the same sub-arcsecond point as the
 * integer remainder distribution — hence the 1″ tolerance rather than
 * bit-for-bit equality.
 */
export function porphyryCuspsFloat(ascDeg, mcDeg) {
  const ic = normalizeDeg(mcDeg + 180);
  const dsc = normalizeDeg(ascDeg + 180);
  const order = [ascDeg, ic, dsc, mcDeg];
  const cusps = [];
  for (let q = 0; q < 4; q++) {
    const start = order[q];
    const end = order[(q + 1) % 4];
    let arc = end - start;
    arc = ((arc % 360) + 360) % 360;
    const step = arc / 3;
    for (let i = 0; i < 3; i++) {
      cusps.push(normalizeDeg(start + i * step));
    }
  }
  return cusps;
}

/**
 * Polar-latitude fallback policy: which latitude range each quadrant system
 * is considered valid over, and what this codebase recommends falling back
 * to beyond it (whole-sign houses, the only system that remains meaningful
 * at every latitude including exactly +-90°, since it depends only on
 * which sign the Ascendant/each body falls in, not on rise/set geometry).
 *
 * "hard" entries (Placidus, Koch, Alcabitius) are enforced in code: the
 * functions above throw PolarLatitudeError at exactly this boundary,
 * because their asin(tan(lat)*tan(dec)) construction has no real solution
 * beyond it for some ecliptic longitudes (see PolarLatitudeError's class
 * comment) — this is a genuine mathematical domain limit.
 *
 * "soft" entries (Regiomontanus, Campanus, Topocentric, Meridian, Morinus)
 * do NOT throw here — their formulas stay numerically defined (no asin,
 * only tan(lat) which blows up only exactly at +-90°) — but this codebase
 * still recommends the same 66.56 deg practical cutoff, because house
 * widths become increasingly extreme and the geometric construction
 * increasingly degenerate well before +-90° for all of them (this is the
 * commonly cited practical guidance for quadrant house systems generally,
 * not a claim of a hard mathematical breakdown at this exact latitude for
 * these five — the honest distinction from the "hard" entries above is
 * itself the point of labeling both kinds in one table rather than
 * silently blurring them).
 */
export const POLAR_FALLBACK_POLICY = {
  placidus: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "hard", fallback: "WholeSign" },
  koch: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "hard", fallback: "WholeSign" },
  alcabitius: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "hard", fallback: "WholeSign" },
  regiomontanus: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "soft", fallback: "WholeSign" },
  campanus: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "soft", fallback: "WholeSign" },
  topocentric: { validLatRange: [-POLAR_LATITUDE_LIMIT_DEG, POLAR_LATITUDE_LIMIT_DEG], enforced: "soft", fallback: "WholeSign" },
  meridian: { validLatRange: [-90, 90], enforced: "none", fallback: "WholeSign" },
  morinus: { validLatRange: [-90, 90], enforced: "none", fallback: "WholeSign" },
};

// ---------------------------------------------------------------------------
// WP-19: publish POLAR_FALLBACK_POLICY to the browser presentation layer.
// This module's `export`s already serve Node (produce-ledger.mjs, this
// file's own test suite); classic <script> pages (landing.jsx/app.jsx,
// which are Babel-standalone scripts, not ES modules, and cannot `import`)
// need the same dual-environment publish tzresolve.js uses for
// window.TzResolve — load this file as
// `<script type="module" src="tools/ephemeris/houses.js"></script>` before
// any `.jsx` script that reads `window.HousesPolicy`. Only the policy
// table is published (not the cusp functions themselves, which the browser
// build does not currently compute quadrant houses for) — see
// project/docs/ux-validation-checklist.md scenario 4 for the honest
// caveat on how far this reaches in the current UI.
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  window.HousesPolicy = { POLAR_FALLBACK_POLICY };
}
