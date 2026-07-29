// src/core/basis.js — exact HCRM basis constants. BigInt only.
// No floats, no Date, no synthetic periods. (P3)

export const B6 = [2n, 3n, 5n, 7n, 11n, 13n];
export const GEAR = [17n, 19n];
export const B8 = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n];

export const M6 = 30030n;            // ∏ B6
export const GEAR_PRODUCT = 323n;    // 17 · 19
export const M8 = 9699690n;          // ∏ B8
export const ARCSEC_CIRCLE = 1296000n;

export const M6_MOD_GEAR = M6 % GEAR_PRODUCT;   // 314
export const M6_INV_MOD_GEAR = 287n;            // 314⁻¹ mod 323
