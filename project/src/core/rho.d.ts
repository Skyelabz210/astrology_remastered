/**
 * ω(n) — the count of distinct prime factors.
 * @param {bigint} n
 * @returns {bigint}
 */
export function omega(n: bigint): bigint;
/**
 * q(n) — the largest shadow (inert, p ≡ 3 mod 4) prime factor; 0n when none.
 * @param {bigint} n
 * @returns {bigint}
 */
export function largestShadowFactor(n: bigint): bigint;
/**
 * δ(n) — the shadow step: 0 for q ≤ 7, 1 at the anchor 11, 2 from 19 up.
 * @param {bigint} n
 * @returns {bigint} 0n, 1n, or 2n.
 */
export function delta(n: bigint): bigint;
/**
 * ρ(n) = ω(n) + δ(n).
 * @param {bigint} n
 * @returns {bigint}
 */
export function rho(n: bigint): bigint;
/**
 * @param {bigint} r - a ρ value.
 * @returns {Object} the `BANDS` entry containing r.
 * @throws {Error} "ρ outside every band" — structurally unreachable since BANDS is exhaustive.
 */
export function band(r: bigint): any;
/**
 * Full ρ report for one integer. All numeric fields are decimal strings.
 * @param {bigint} n
 * @returns {Object} factorisation, omega, shadow_factors, q, delta, rho, band, band_label, band_note.
 */
export function rhoReport(n: bigint): any;
export const BANDS: {
    id: string;
    label: string;
    min: bigint;
    max: bigint;
    note: string;
}[];
