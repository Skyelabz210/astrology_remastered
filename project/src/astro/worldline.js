// src/astro/worldline.js
//
// NATAL_WORLDLINE_V1
//
// Three registers are deliberately kept separate:
//   1. Chart epoch/place: an astronomical event and its geodetic coordinates.
//   2. CRAM cycle: exact integer day index N -> (r, K), with M=36 and A=37.
//   3. GR clock: an idealized proper-time rate for an Earth-fixed observer.
//
// The CRAM register is a chosen coordinate on the chart's history. It is not
// a physical 36-day period and does not alter the relativistic metric.
//
// BigInt is retained through the CRAM decomposition. Floating point enters
// only at the astronomical timestamp / geodesy / GR presentation boundary.

import { identity } from "../core/arrow.js";
import { mod } from "../core/residues.js";

export const WORLDLINE_CONSTANTS = Object.freeze({
  shell: 36n,
  anchor: 37n,
  earthSemiMajorAxisM: 6378137,
  earthFlattening: 1 / 298.257223563,
  earthGMm3s2: 3.986004418e14,
  earthAngularVelocityRadS: 7.292115e-5,
  speedOfLightMS: 299792458,
  secondsPerDay: 86400,
  millisecondsPerDay: 86400000,
});

function parseInstant(value, name) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new TypeError(name + " must be an ISO-8601 timestamp with an explicit UTC offset.");
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError(name + " is not a valid timestamp.");
  return { ms, iso: new Date(ms).toISOString() };
}

function finiteRange(value, name, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RangeError(name + " must be finite and between " + min + " and " + max + ".");
  }
  return n;
}

function floorDiv(a, b) {
  let q = a / b;
  const r = a % b;
  if (r !== 0n && a < 0n) q -= 1n;
  return q;
}

function geodeticRadius(latitudeDeg, altitudeM) {
  const { earthSemiMajorAxisM: a, earthFlattening: f } = WORLDLINE_CONSTANTS;
  const phi = latitudeDeg * Math.PI / 180;
  const e2 = f * (2 - f);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const primeVerticalRadius = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const rho = (primeVerticalRadius + altitudeM) * cosPhi;
  const z = (primeVerticalRadius * (1 - e2) + altitudeM) * sinPhi;
  return {
    geocentricRadiusM: Math.hypot(rho, z),
    distanceFromRotationAxisM: Math.abs(rho),
    polarCoordinateM: z,
  };
}

/**
 * Build the birth-anchored worldline coordinate and idealized GR clock result.
 *
 * targetISO defaults to the current UTC instant. altitudeM defaults to sea
 * level because the chart schema does not currently retain birthplace
 * elevation. Date elapsed time uses POSIX milliseconds (no leap-second model).
 *
 * GR approximation: spherical Schwarzschild exterior field plus the local
 * Earth-rotation velocity term. It omits Earth's J2 multipoles, frame dragging,
 * tides, terrain/elevation uncertainty, Earth-orientation parameters and
 * relativistic time-scale conversion. It is an educational estimate, not a
 * precision clock-transfer or navigation solution.
 */
export function buildNatalWorldline({
  birthISO,
  targetISO = new Date().toISOString(),
  latitudeDeg,
  longitudeDeg,
  altitudeM = 0,
} = {}) {
  const birth = parseInstant(birthISO, "birthISO");
  const target = parseInstant(targetISO, "targetISO");
  const latitude = finiteRange(latitudeDeg, "latitudeDeg", -90, 90);
  const longitude = finiteRange(longitudeDeg, "longitudeDeg", -180, 180);
  const altitude = finiteRange(altitudeM, "altitudeM", -500, 100000);

  const elapsedMilliseconds = BigInt(target.ms) - BigInt(birth.ms);
  if (elapsedMilliseconds > BigInt(Number.MAX_SAFE_INTEGER) ||
      elapsedMilliseconds < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Elapsed interval exceeds the safe presentation range.");
  }

  // The integer day index is a birth-relative, 86,400-second coordinate tick.
  // It is not a statement that the physical clock rate or day length is fixed.
  const elapsedDays = floorDiv(
    elapsedMilliseconds,
    BigInt(WORLDLINE_CONSTANTS.millisecondsPerDay)
  );
  const shell = WORLDLINE_CONSTANTS.shell;
  const anchor = WORLDLINE_CONSTANTS.anchor;
  const { r, K } = identity(elapsedDays, shell);
  const signedAnchor = mod(r - K, anchor);
  const elapsedMsNumber = Number(elapsedMilliseconds);
  const coordinateSeconds = elapsedMsNumber / 1000;
  const coordinateDays = elapsedMsNumber / WORLDLINE_CONSTANTS.millisecondsPerDay;
  const phaseDegrees = Number(r) * 360 / Number(shell);
  const daysToNextBoundary = r === 0n ? shell : shell - r;

  // Convert geodetic latitude/elevation to an ellipsoidal Earth position.
  // A chart without elevation uses the explicit sea-level reference.
  const earthPosition = geodeticRadius(latitude, altitude);
  const radius = earthPosition.geocentricRadiusM;
  const tangentialSpeed =
    WORLDLINE_CONSTANTS.earthAngularVelocityRadS *
    earthPosition.distanceFromRotationAxisM;
  const c = WORLDLINE_CONSTANTS.speedOfLightMS;
  const mu = WORLDLINE_CONSTANTS.earthGMm3s2;
  const gravitationalTerm = 2 * mu / (radius * c * c);
  const rotationalTerm = (tangentialSpeed / c) ** 2;
  const radicand = 1 - gravitationalTerm - rotationalTerm;
  if (!(radicand > 0 && radicand <= 1)) {
    throw new RangeError("The selected reference point is outside the supported timelike model.");
  }
  const properTimeRate = Math.sqrt(radicand);
  const properSeconds = coordinateSeconds * properTimeRate;
  const clockOffsetSeconds = coordinateSeconds - properSeconds;

  // Rotation phase is shown relative to the natal meridian. A full inertial
  // Earth-orientation reconstruction would require UT1/GMST and IERS data.
  const rotationAngleRad = (
    WORLDLINE_CONSTANTS.earthAngularVelocityRadS * coordinateSeconds
  ) % (2 * Math.PI);
  const relativePositionM = {
    x: earthPosition.distanceFromRotationAxisM * Math.cos(rotationAngleRad),
    y: earthPosition.distanceFromRotationAxisM * Math.sin(rotationAngleRad),
    z: earthPosition.polarCoordinateM,
  };

  return {
    schema: "NATAL_WORLDLINE_V1",
    frame: "Earth-fixed observer at the natal chart location",
    input: {
      birthISO: birth.iso,
      targetISO: target.iso,
      latitudeDeg: latitude,
      longitudeDeg: longitude,
      altitudeM: altitude,
      altitudeSource: altitudeM === 0 ? "assumed sea level" : "provided",
    },
    interval: {
      elapsedMilliseconds: elapsedMilliseconds.toString(),
      elapsedSeconds: coordinateSeconds,
      elapsedWholeDays: elapsedDays.toString(),
      elapsedDays: coordinateDays,
      elapsedJulianYears: coordinateSeconds / (365.25 * 86400),
      timeScale: "POSIX milliseconds interpreted as UTC; leap seconds omitted",
    },
    cram: {
      N: elapsedDays.toString(),
      M: shell.toString(),
      A: anchor.toString(),
      r: r.toString(),
      K: K.toString(),
      vA: signedAnchor.toString(),
      direction: "down",
      phaseDegrees,
      daysToNextBoundary: daysToNextBoundary.toString(),
      identity: "N = r + K·M",
      signedCarry: "v_A = (r − K) mod A",
    },
    relativity: {
      model: "Schwarzschild exterior metric + Earth-rotation velocity term",
      coordinateSeconds,
      properSeconds,
      clockOffsetSeconds,
      properTimeRate,
      gravitationalTerm,
      rotationalTerm,
      geocentricRadiusM: radius,
      distanceFromRotationAxisM: earthPosition.distanceFromRotationAxisM,
      localTangentialSpeedMS: tangentialSpeed,
      assumptions: [
        "spherical Schwarzschild gravitational field using Earth's GM",
        "WGS84 ellipsoid for the reference-point radius",
        "constant Earth angular velocity",
        "fixed Earth-surface observer at constant geodetic latitude and elevation",
        "no J2 multipoles, frame dragging, tides or local geopotential corrections",
        "no IERS Earth-orientation or relativistic time-scale conversion",
      ],
    },
    geometry: {
      rotationAngleRad,
      relativePositionM,
      projection: "illustrative Earth-spin phase relative to the natal meridian",
    },
  };
}

if (typeof window !== "undefined") {
  window.WorldlineCore = { buildNatalWorldline, WORLDLINE_CONSTANTS };
}
