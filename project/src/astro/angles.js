// Presentation-layer angles are floating point arcseconds; the exact core
// quantizes only at its input boundary. Never confuse measurement with precision.
export const ARCSECONDS_PER_DEGREE = 3600;
export const ARCSECONDS_PER_CIRCLE = 1296000;
export function normalizeArcsec(value) {
  if (!Number.isFinite(value)) throw new RangeError("Angle must be finite");
  return ((value % ARCSECONDS_PER_CIRCLE) + ARCSECONDS_PER_CIRCLE) % ARCSECONDS_PER_CIRCLE;
}
export function signedArcsec(value) {
  return normalizeArcsec(value + ARCSECONDS_PER_CIRCLE / 2) - ARCSECONDS_PER_CIRCLE / 2;
}
export function angularSeparationArcsec(a, b) { return Math.abs(signedArcsec(a - b)); }
export function dateToJd(date) {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("Invalid date");
  return ms / 86400000 + 2440587.5;
}
export function jdToDate(jd) {
  if (!Number.isFinite(jd)) throw new RangeError("Invalid Julian day");
  const date = new Date((jd - 2440587.5) * 86400000);
  if (!Number.isFinite(date.getTime())) throw new RangeError("Date is outside supported range");
  return date;
}
