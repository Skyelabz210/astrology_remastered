// Geometric phase approximations and ephemeris-backed lunar information.
// A rounded BigInt fraction represents the computed float, not exact astronomy.
import { normalizeArcsec, angularSeparationArcsec, ARCSECONDS_PER_DEGREE,
  ARCSECONDS_PER_CIRCLE, jdToDate, dateToJd } from './angles.js';
export { normalizeArcsec, angularSeparationArcsec, ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE };
const MONTH = 29.530588853;
export const PHASE_BOUNDARIES = [
  { name: 'New', startDeg: 337.5, endDeg: 22.5, waxing: true },
  { name: 'Waxing Crescent', startDeg: 22.5, endDeg: 67.5, waxing: true },
  { name: 'First Quarter', startDeg: 67.5, endDeg: 112.5, waxing: true },
  { name: 'Waxing Gibbous', startDeg: 112.5, endDeg: 157.5, waxing: true },
  { name: 'Full', startDeg: 157.5, endDeg: 202.5, waxing: false },
  { name: 'Waning Gibbous', startDeg: 202.5, endDeg: 247.5, waxing: false },
  { name: 'Last Quarter', startDeg: 247.5, endDeg: 292.5, waxing: false },
  { name: 'Waning Crescent', startDeg: 292.5, endDeg: 337.5, waxing: false },
];
export function getPhaseName(deg) {
  const angle = normalizeArcsec(deg * 3600) / 3600;
  return PHASE_BOUNDARIES[Math.floor((angle + 22.5) / 45) % 8].name;
}
export function isWaxing(deg) { return normalizeArcsec(deg * 3600) < 648000; }
function fraction(value) {
  let numerator = BigInt(Math.round(value * 1e12)), denominator = 1000000000000n;
  let a = numerator, b = denominator;
  while (b) [a, b] = [b, a % b];
  numerator /= a; denominator /= a;
  return { numerator, denominator };
}
// Compatibility name: this is a rounded approximation, not exact trigonometry.
export function calculateExactIllumination(elongationArcsec) {
  return fraction((1 - Math.cos(normalizeArcsec(elongationArcsec) * Math.PI / 648000)) / 2);
}
export function fractionToFloat(numerator, denominator) {
  if (denominator === 0n) throw new RangeError('Zero denominator');
  return Number(numerator) / Number(denominator);
}
export function calculateLunarDay(elongationArcsec, knownNewMoonJd = 0, currentJd = 0) {
  if (knownNewMoonJd && currentJd) {
    if (knownNewMoonJd > currentJd) throw new RangeError('New Moon must precede observation');
    return currentJd - knownNewMoonJd;
  }
  return normalizeArcsec(elongationArcsec) / ARCSECONDS_PER_CIRCLE * MONTH;
}
// Observer faces the +z hemisphere; waxing light falls on screen-right.
export function calculateTerminator(elongationArcsec) {
  const angle = normalizeArcsec(elongationArcsec) * Math.PI / 648000;
  const normal = { x: Math.sin(angle), y: 0, z: -Math.cos(angle) };
  return { normal, distance: 0, illuminationFraction: (1 - Math.cos(angle)) / 2,
    isIlluminated: (x, y, z) => x * normal.x + y * normal.y + z * normal.z > 0 };
}
export function createMoonShadingFunction(elongationArcsec) {
  const { normal } = calculateTerminator(elongationArcsec);
  return (x, y, z) => {
    const length = Math.hypot(x, y, z);
    if (!length) return 0;
    const dot = (x * normal.x + y * normal.y + z * normal.z) / length;
    return Math.max(0, Math.min(1, 0.5 + dot / 0.02));
  };
}
export function calculateMoonPhase(sunLonArcsec, moonLonArcsec, moonLatArcsec = 0,
  currentJd = 0, lastNewMoonJd = 0) {
  const elongationArcsec = normalizeArcsec(moonLonArcsec - sunLonArcsec);
  const elongationDeg = elongationArcsec / 3600;
  const illuminationFloat = (1 - Math.cos(moonLatArcsec * Math.PI / 648000)
    * Math.cos(elongationDeg * Math.PI / 180)) / 2;
  return { elongationArcsec, elongationDeg, illumination: fraction(illuminationFloat),
    illuminationFloat, phase: getPhaseName(elongationDeg), waxing: isWaxing(elongationDeg),
    lunarDay: calculateLunarDay(elongationArcsec, lastNewMoonJd, currentJd),
    synodicPhase: elongationDeg / 360, terminatorAngle: (elongationDeg + 90) % 360,
    nextNewMoonDays: (360 - elongationDeg) / 360 * MONTH,
    nextFullMoonDays: ((180 - elongationDeg + 360) % 360) / 360 * MONTH,
    approximate: true };
}
// Astronomy Engine handles lunar latitude, distance, light time and irregular
// lunations. Searches use UTC Date instants; the engine manages TT internally.
export function moonPhaseAt(date, astronomy = globalThis.Astronomy) {
  if (!astronomy) throw new Error('Astronomical ephemeris is unavailable');
  const jd = dateToJd(date);
  const elongationDeg = astronomy.MoonPhase(date);
  const info = astronomy.Illumination(astronomy.Body.Moon, date);
  const previous = astronomy.SearchMoonPhase(0, date, -40);
  const nextNew = astronomy.SearchMoonPhase(0, date, 40);
  const nextFull = astronomy.SearchMoonPhase(180, date, 40);
  if (!previous || !nextNew || !nextFull) throw new Error('Could not locate lunar phases');
  const physicalAngle = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * info.phase_fraction))) * 180 / Math.PI;
  return { ...calculateMoonPhase(0, elongationDeg * 3600),
    shadingElongationArcsec: (elongationDeg < 180 ? physicalAngle : 360 - physicalAngle) * 3600,
    illumination: fraction(info.phase_fraction), illuminationFloat: info.phase_fraction,
    lunarDay: jd - dateToJd(previous.date), nextNewMoonDays: dateToJd(nextNew.date) - jd,
    nextFullMoonDays: dateToJd(nextFull.date) - jd, approximate: false };
}
export function prenatalSyzygy(birthJd, astronomy = globalThis.Astronomy) {
  if (!astronomy) throw new Error('Astronomical ephemeris is unavailable');
  const date = jdToDate(birthJd);
  const phases = [0, 180].map(angle => ({ angle, time: astronomy.SearchMoonPhase(angle, date, -40) }));
  const last = phases.filter(p => p.time).sort((a, b) => b.time.ut - a.time.ut)[0];
  if (!last) throw new Error('Could not locate prenatal syzygy');
  const jd = dateToJd(last.time.date);
  const moon = astronomy.Ecliptic(astronomy.GeoVector(astronomy.Body.Moon, last.time, true));
  return { type: last.angle === 0 ? 'newMoon' : 'fullMoon', jd,
    longitudeArcsec: moon.elon * 3600, daysBeforeBirth: birthJd - jd };
}
if (typeof window !== 'undefined') window.MoonPhase = { moonPhaseAt, calculateMoonPhase,
  calculateTerminator, createMoonShadingFunction, getPhaseName, prenatalSyzygy };
