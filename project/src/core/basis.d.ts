/** The classical six-lane Safe Basis (legacy shell lanes). BigInt primes. */
export const B6: bigint[];
/** The legacy gear-pair extender lanes, used as the legacy external anchor. */
export const GEAR: bigint[];
/** The full eight-lane Safe Basis ("the Colony"): B6 ∪ GEAR. BigInt primes. */
export const B8: bigint[];
/** ∏ B6 = 30,030 — legacy shell modulus. */
export const M6: 30030n;
/** 17 · 19 = 323 — legacy external anchor modulus. */
export const GEAR_PRODUCT: 323n;
/** ∏ B8 = 9,699,690 — the Colony (full-basis modulus). */
export const M8: 9699690n;
/** The ecliptic arcsecond ring: 1,296,000 arcsec = 360°. Every core longitude lives in [0, ARCSEC_CIRCLE). */
export const ARCSEC_CIRCLE: 1296000n;
/** M6 mod GEAR_PRODUCT = 314 — precomputed for the legacy K-Elimination recovery. */
export const M6_MOD_GEAR: bigint;
/** Modular inverse of M6_MOD_GEAR mod GEAR_PRODUCT: 314⁻¹ ≡ 287 (mod 323). */
export const M6_INV_MOD_GEAR: 287n;
/** The parked lane: in the basis, out of the shell, carrying the winding. */
export const PARK: 11n;
/** Shell lanes once lane 11 is parked. */
export const SHELL_LANES: bigint[];
/** ∏ SHELL_LANES = M8 / 11. */
export const M_SHELL: 881790n;
/** M_SHELL mod 11 = 8, and 8 · 7 ≡ 1 (mod 11). */
export const M_SHELL_MOD_PARK: bigint;
export const M_SHELL_INV_MOD_PARK: 7n;
/** Winding bound over the ecliptic ring with the parked shell: ⌊(ARC−1)/M_SHELL⌋. */
export const K_MAX_PARKED: bigint;
/** Winding bound with the legacy gear shell. */
export const K_MAX_LEGACY: bigint;
