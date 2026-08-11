// project/tools/ephemeris/houses.js — WP-11: Ascendant/Midheaven + Placidus
// house cusps. Lives under project/tools/ (Mandate A1 in
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
//   PolarLatitudeError
//
// All returned angles are float degrees, normalized to [0, 360). This layer
// is float-legal per the Conventions (it is not under src/core/).
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
 * Thrown by placidusCusps() when |latDeg| exceeds the latitude beyond which
 * the Placidus semi-arc trisection is undefined for some ecliptic
 * longitudes (see the module header for why). Not thrown by ascMc(), whose
 * formulas remain well-defined at these latitudes — see module header.
 */
export class PolarLatitudeError extends Error {
  constructor(latDeg) {
    super(
      `PolarLatitudeError: Placidus house cusps are undefined at |lat|=${Math.abs(latDeg)}° ` +
        `(limit ${POLAR_LATITUDE_LIMIT_DEG}° ≈ 90° - mean obliquity): some ecliptic ` +
        `longitudes are circumpolar (never rise/set) at this latitude, so their diurnal/nocturnal ` +
        `semi-arc trisection has no real solution.`
    );
    this.name = "PolarLatitudeError";
    this.latDeg = latDeg;
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
