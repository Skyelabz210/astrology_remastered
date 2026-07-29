// src/core/validators.js — admit only exact integer arcseconds. (P2)
// No Number, no Math.round, no parseFloat.

export const ARCSEC_CIRCLE = 1296000n;

export function parseArcsecString(value) {
  if (typeof value === "bigint") {
    if (value < 0n || value >= ARCSEC_CIRCLE)
      throw new Error("longitude_arcsec outside ecliptic arcsecond ring");
    return value;
  }
  if (typeof value !== "string")
    throw new Error("longitude_arcsec must be a decimal integer string");
  if (!/^(0|[1-9][0-9]*)$/.test(value))
    throw new Error("longitude_arcsec must contain only decimal digits");
  const x = BigInt(value);
  if (x < 0n || x >= ARCSEC_CIRCLE)
    throw new Error("longitude_arcsec outside ecliptic arcsecond ring");
  return x;
}

export function assertIntegerString(value, fieldName) {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string")
    throw new Error(`${fieldName} must be a decimal integer string`);
  if (!/^-?(0|[1-9][0-9]*)$/.test(value))
    throw new Error(`${fieldName} must contain only decimal integer digits`);
  return BigInt(value);
}
