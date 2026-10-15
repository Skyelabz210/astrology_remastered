/**
 * Exact integer square root by binary search.
 * @param {bigint} n - a non-negative integer.
 * @returns {bigint} ⌊√n⌋.
 * @throws {Error} "isqrt of a negative integer" if n < 0.
 */
export function isqrt(n: bigint): bigint;
/**
 * Trial-division primality test.
 * @param {bigint} n
 * @returns {boolean}
 */
export function isPrime(n: bigint): boolean;
/**
 * "ramified" (p=2) · "split" (p≡1 mod 4) · "inert" (p≡3 mod 4).
 * @param {bigint} p - a prime.
 * @returns {"ramified"|"split"|"inert"} its class in Z[i].
 */
export function gaussianClass(p: bigint): "ramified" | "split" | "inert";
/**
 * A shadow prime is inert in Z[i]: p ≡ 3 (mod 4). Fermat excludes exactly these.
 * @param {bigint} p - a prime.
 * @returns {boolean}
 */
export function isShadowPrime(p: bigint): boolean;
/**
 * The witness that a split prime is a sum of two squares, e.g. 13 = 2² + 3².
 * Returns null for inert primes — that absence IS the shadow.
 * @param {bigint} p - a prime.
 * @returns {?[bigint, bigint]} [a, b] with p = a² + b², or null if p is inert (or 2 gives [1,1]).
 */
export function sumOfTwoSquares(p: bigint): [bigint, bigint] | null;
/**
 * Family partners of p inside a given prime set (both directions).
 * @param {bigint} p - the prime to find partners for.
 * @param {bigint[]} set - the candidate partner pool.
 * @returns {{family: string, partner: string}[]} twin/cousin/sexy partners of p found in `set`.
 */
export function familyPartners(p: bigint, set: bigint[]): {
    family: string;
    partner: string;
}[];
/**
 * Sophie Germain: p is SG when 2p+1 is prime.
 * @param {bigint} p
 * @returns {boolean}
 */
export function isSophieGermain(p: bigint): boolean;
/**
 * Safe prime: p = 2q+1 with q prime. (The other half of the SG pair.)
 * @param {bigint} p
 * @returns {boolean}
 */
export function isSafePrime(p: bigint): boolean;
/**
 * @param {bigint} p - a prime.
 * @returns {boolean} true iff p ∈ S_R = {5, 7, 11}.
 */
export function hasRamanujanCongruence(p: bigint): boolean;
/**
 * Exact partition numbers via the pentagonal number theorem. Integers only.
 * @param {bigint} N - compute p(0)..p(N).
 * @returns {Map<bigint, bigint>} n → p(n), keyed by BigInt.
 */
export function partitionNumbers(N: bigint): Map<bigint, bigint>;
/**
 * @param {bigint} p - a Safe Basis prime.
 * @returns {"fabric"|"measurement"|"boundary"|"extender"} its structural tier.
 */
export function tierOf(p: bigint): "fabric" | "measurement" | "boundary" | "extender";
/**
 * @param {bigint} p
 * @returns {boolean} true iff p's tier is "fabric" or "measurement" (not boundary/extender).
 */
export function providesStructure(p: bigint): boolean;
/**
 * Fibonacci entry path. 7 and 11 enter only through COMPOSITE Fibonacci values.
 * @param {bigint} upTo - compute F(0)..F(upTo).
 * @returns {Map<bigint, bigint>} index → Fibonacci value, keyed by BigInt.
 */
export function fibonacci(upTo: bigint): Map<bigint, bigint>;
/**
 * B001–B004: the "unbroken safe basis" boot-gate check.
 * @param {bigint[]} [basis=B8] - the basis to certify.
 * @param {bigint[]} [auxiliary=[]] - extra values (e.g. shadow-lattice moduli) to check coprime to the basis.
 * @returns {Object} `SAFE_BASIS_BOOT_GATES_V1` — B001_colony/B002_sd11_anchor/
 *   B003_no_repeat/B004_aux_coprime pass/fail detail, plus overall `unbroken`.
 */
export function bootGates(basis?: bigint[], auxiliary?: bigint[]): any;
/**
 * @param {bigint} p - a Safe Basis prime.
 * @returns {Object} the matching `ROLES` entry: `{prime, role, tier, note}`.
 * @throws {Error} `"${p} is not in the Safe Basis"` if p is not one of the 8 basis primes.
 */
export function role(p: bigint): any;
/**
 * Consecutive gaps across the basis: 1, 2, 2, 4, 2, 4, 2.
 * @returns {bigint[]} B8[i] − B8[i-1] for i = 1..7.
 */
export function basisGaps(): bigint[];
/**
 * The full attribute record for one basis prime. All strings — JSON-safe.
 * @param {bigint} p - a Safe Basis prime.
 * @returns {Object} role, Gaussian class, shadow/family/Sophie-Germain/safe-prime/
 *   Ramanujan flags, tier, and ring-divisibility, all as decimal strings where numeric.
 * @throws {Error} propagated from `role(p)` if p is not a basis prime.
 */
export function primeProfile(p: bigint): any;
/**
 * @returns {Object} `SAFE_BASIS_PROFILE_V1` — the whole basis, its tiers,
 *   shadow/split subsets, gaps, and per-prime `primeProfile` records.
 */
export function basisProfile(): any;
/**
 * Saturation report against a target range (default: the ecliptic ring).
 *
 *   shell_saturates : does M6 alone give unique representation over the range?
 *   colony_saturates: does M8?
 *   winding_bound   : K_max = ⌊(range−1)/M6⌋, the lift the shell cannot carry
 *   anchor_suffices : gear product 323 > K_max, so K mod 323 determines K
 *
 * For the ecliptic ring this reads: the classical six under-saturate by a
 * factor of 44 laps; the twin extenders carry exactly that deficit.
 * @param {bigint} [range=ARCSEC_CIRCLE] - the target range (default the ecliptic ring).
 * @returns {Object} `SAFE_BASIS_SATURATION_V1` — saturation flags and the
 *   winding bound the shell alone cannot carry, plus whether the extenders suffice.
 */
export function saturationReport(range?: bigint): any;
/** The Colony: the product of the full Safe Basis. */
export const COLONY: 9699690n;
/** The shell: the product of the classical six. */
export const SHELL: 30030n;
export const FAMILY_GAPS: {
    id: string;
    gap: bigint;
}[];
/**
 * CORRECTION OF RECORD (P16). An earlier pass read "Ramanujan prime" as OEIS
 * A104272 — the counting-function primes {2, 11, 17, 29, …}. That is the wrong
 * notion for this architecture. S_R here means the RAMANUJAN PARTITION
 * CONGRUENCE primes: the p for which the partition function satisfies an exact
 * congruence on an arithmetic progression,
 *
 *     p(5n+4) ≡ 0 (mod 5)    p(7n+5) ≡ 0 (mod 7)    p(11n+6) ≡ 0 (mod 11)
 *
 * so S_R = {5, 7, 11}. There is no such congruence for 13 at any offset —
 * verified exhaustively over every residue class in test/safe-basis.test.js —
 * which is exactly why 13 is capacity and not structure.
 */
export const RAMANUJAN_CONGRUENCE: {
    prime: bigint;
    offset: bigint;
}[];
export const S_R: bigint[];
export const T_FABRIC: bigint[];
export const T_MEASUREMENT: bigint[];
export const T_BOUNDARY: bigint[];
export const FIBONACCI_ENTRY: {
    prime: bigint;
    index: bigint;
    value: bigint;
    direct: boolean;
}[];
export const SD11_ANCHOR: bigint;
export const SD11_REJECT: 7437683639n;
export const ROLES: {
    prime: bigint;
    role: string;
    tier: string;
    note: string;
}[];
/** The shadow spine of the Safe Basis: its inert primes, in order. */
export const SHADOW_SPINE: bigint[];
/** The split primes of the Safe Basis. */
export const SPLIT_PRIMES: bigint[];
/** The shadow anchor — the δ = 1 threshold and the disambiguating lane. */
export const SHADOW_ANCHOR: 11n;
/** The δ = 2 threshold — the first shadow prime above the anchor. */
export const SHADOW_ESCALATION: 19n;
