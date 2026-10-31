// src/astro/worldline.js
//
// NATAL_WORLDLINE_V2 — integrated QMNF / CRAM / GR chart-time engine.
// Exact integer coordinates stay in BigInt; floating-point arithmetic is
// confined to timestamp, geodesy, and relativistic presentation calculations.

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
  safeBasis: Object.freeze([2n, 3n, 5n, 7n, 11n, 13n]),
  safeModulus: 30030n,
});


function modPow(base, exponent, modulus) {
  let b = mod(base, modulus);
  let e = exponent;
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

function legendreSymbol(value, prime) {
  const a = mod(value, prime);
  if (a === 0n) return 0;
  return modPow(a, (prime - 1n) / 2n, prime) === 1n ? 1 : -1;
}

/**
 * Map one exact integer onto the QMNF residue torus and its integer lift.
 * The quotient coordinate is the residue modulo 30030; the lift is K.
 * The M+1 anchor gives K = v_M - v_A (mod M+1).
 */
export function buildQmnfCoordinates(value) {
  const X = typeof value === "bigint" ? value : BigInt(value);
  const basis = WORLDLINE_CONSTANTS.safeBasis;
  const M = WORLDLINE_CONSTANTS.safeModulus;
  const A = M + 1n;
  const residue = mod(X, M);
  const winding = floorDiv(X, M);
  const anchorResidue = mod(X, A);
  const eliminatedWinding = mod(residue - anchorResidue, A);
  const crt = basis.map((prime) => ({
    prime: prime.toString(),
    residue: mod(X, prime).toString(),
  }));
  const oddPrimes = basis.filter((prime) => prime % 4n === 3n);
  const reciprocity = [];
  for (let i = 0; i < oddPrimes.length; i++) {
    for (let j = i + 1; j < oddPrimes.length; j++) {
      const p = oddPrimes[i];
      const q = oddPrimes[j];
      const pq = legendreSymbol(p, q);
      const qp = legendreSymbol(q, p);
      reciprocity.push({
        p: p.toString(),
        q: q.toString(),
        symbolPQ: pq,
        symbolQP: qp,
        edge: pq === -1 ? p.toString() + "→" + q.toString()
          : qp === -1 ? q.toString() + "→" + p.toString() : null,
      });
    }
  }
  return {
    integer: X.toString(),
    modulus: M.toString(),
    residue: residue.toString(),
    winding: winding.toString(),
    reconstruction: residue.toString() + " + " + winding.toString() + " × " + M.toString(),
    anchor: A.toString(),
    anchorResidue: anchorResidue.toString(),
    eliminatedWinding: eliminatedWinding.toString(),
    eliminationVerified: mod(winding - eliminatedWinding, A) === 0n,
    basis: basis.map(String),
    crt,
    reciprocity,
    observerQuotient: {
      map: "X ↦ X mod 30030",
      fiberCoordinate: winding.toString(),
      exactLift: true,
    },
  };
}

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
  const qmnf = buildQmnfCoordinates(elapsedDays);
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
    schema: "NATAL_WORLDLINE_V2",
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
    qmnf,
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
  window.WorldlineCore = { buildNatalWorldline, buildQmnfCoordinates, WORLDLINE_CONSTANTS };
}
