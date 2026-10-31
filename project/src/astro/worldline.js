// Earth-surface worldline and CRAM directional coordinate.
// The GR calculation is a deliberately explicit weak-field model:
// spherical, non-rotating Earth gravity plus the observer's rotational
// kinematic term in Schwarzschild coordinates. It is not a full geoid,
// Kerr, solar-system, or N-body integration.
export const WORLDLINE_CONSTANTS = Object.freeze({
  G: 6.67430e-11,                 // m^3 kg^-1 s^-2
  earthMassKg: 5.9722e24,         // kg
  earthRadiusM: 6_371_000,        // mean spherical radius; altitude assumed 0
  cMps: 299_792_458,              // m s^-1
  earthRotationRadS: 7.2921150e-5 // rad s^-1
});

export function positiveMod(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Evaluate a chart subject's idealized Earth-surface worldline between
 * the natal event and a selected target event.
 *
 * Julian days are the chart engine's UT-like coordinate. Latitude/longitude
 * are geographic birth-place coordinates. The observer remains at that
 * surface location, co-rotating with Earth.
 */
export function calculateWorldline(birthJd, targetJd, latitudeDeg, longitudeDeg = 0) {
  for (const [name, value] of Object.entries({ birthJd, targetJd, latitudeDeg, longitudeDeg })) {
    if (!Number.isFinite(value)) throw new TypeError(name + " must be finite");
  }
  if (latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError("latitudeDeg must be in [-90, 90]");

  const C = WORLDLINE_CONSTANTS;
  const elapsedDays = targetJd - birthJd;
  const coordinateSeconds = elapsedDays * 86_400;
  const latitudeRad = latitudeDeg * Math.PI / 180;
  const longitudeRad = positiveMod(longitudeDeg, 360) * Math.PI / 180;
  const radiusM = C.earthRadiusM;
  const angularVelocity = C.earthRotationRadS;
  const tangentialSpeedMps = angularVelocity * radiusM * Math.cos(latitudeRad);
  const schwarzschildRadiusM = 2 * C.G * C.earthMassKg / (C.cMps * C.cMps);

  // Schwarzschild g_tt plus the azimuthal g_phiphi term for
  // phi(t) = phi_0 + Omega_Earth * t at fixed r and latitude.
  const metricRateSquared =
    1 - schwarzschildRadiusM / radiusM -
    (tangentialSpeedMps * tangentialSpeedMps) / (C.cMps * C.cMps);
  if (!(metricRateSquared > 0)) throw new RangeError("Worldline is not timelike under this model");

  const properRate = Math.sqrt(metricRateSquared);
  const properSeconds = coordinateSeconds * properRate;
  const elapsedDaysInteger = Math.floor(elapsedDays);
  const shell = 36;
  const anchor = 37;
  const residue = positiveMod(elapsedDaysInteger, shell);
  const winding = Math.floor(elapsedDaysInteger / shell);
  const signedAnchor = positiveMod(residue - winding, anchor);
  const longitudeAtTargetRad = positiveMod(
    longitudeRad + angularVelocity * coordinateSeconds,
    2 * Math.PI
  );
  const lagSeconds = coordinateSeconds - properSeconds;

  return {
    elapsedDays,
    coordinateSeconds,
    properSeconds,
    lagSeconds,
    properRate,
    metricRateSquared,
    schwarzschildRadiusM,
    radiusM,
    latitudeDeg,
    longitudeDeg,
    latitudeRad,
    longitudeAtBirthRad: longitudeRad,
    longitudeAtTargetRad,
    angularVelocityRadS: angularVelocity,
    tangentialSpeedMps,
    coordinates: {
      rM: radiusM,
      thetaRad: Math.PI / 2 - latitudeRad,
      phiBirthRad: longitudeRad,
      phiTargetRad: longitudeAtTargetRad
    },
    cram: {
      tick: "whole elapsed UT-like days",
      N: elapsedDaysInteger,
      M: shell,
      A: anchor,
      residue,
      winding,
      signedAnchor,
      identity: "v_A = (r - K) mod A"
    },
    assumptions: [
      "spherical Earth with mean radius; altitude set to 0 m",
      "Earth gravity represented by the exterior Schwarzschild metric",
      "observer co-rotates at fixed geographic latitude and longitude",
      "solar, lunar, planetary, geoid, frame-dragging and local-gravity effects omitted",
      "the surface observer is accelerated, not a freely falling geodesic"
    ]
  };
}

if (typeof window !== "undefined") {
  window.Worldline = { calculateWorldline, WORLDLINE_CONSTANTS };
}
