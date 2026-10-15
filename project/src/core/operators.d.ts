/**
 * Euclidean greatest common divisor.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} gcd(|a|, |b|), non-negative.
 */
export function gcd(a: bigint, b: bigint): bigint;
/**
 * Euler's totient, by direct counting (n is expected small — lane orders here).
 * @param {bigint} n
 * @returns {bigint} |{k in [1,n] : gcd(k,n)=1}|.
 */
export function totient(n: bigint): bigint;
/**
 * Modular exponentiation by repeated squaring.
 * @param {bigint} base
 * @param {bigint} exp - exponent, ≥ 0.
 * @param {bigint} m - modulus.
 * @returns {bigint} base^exp mod m.
 */
export function powMod(base: bigint, exp: bigint, m: bigint): bigint;
/**
 * Exponents in [1, p−1] that permute the multiplicative group: gcd(e, p−1) = 1.
 * @param {bigint} p - the lane prime.
 * @returns {bigint[]} the admissible exponents.
 */
export function bijectiveExponents(p: bigint): bigint[];
/**
 * The function table of x ↦ c·x^e mod p, as an array of length p.
 * @param {bigint} p - the lane prime.
 * @param {bigint} c - the multiplicative constant.
 * @param {bigint} e - the exponent.
 * @returns {bigint[]} table[x] = c·x^e mod p, for x = 0..p-1.
 */
export function laneTable(p: bigint, c: bigint, e: bigint): bigint[];
/**
 * Is this table a bijection on Z/p that fixes 0?
 * @param {bigint[]} table - a candidate lane function table.
 * @param {bigint} p - the lane prime.
 * @returns {boolean}
 */
export function isExactLaneOperator(table: bigint[], p: bigint): boolean;
/**
 * Every exact lane operator of the form c·x^e, enumerated as distinct function
 * tables. Deduplicated, so the returned count is the true number of distinct
 * maps rather than the number of (c, e) labels.
 * @param {bigint} p - the lane prime.
 * @returns {{c: string, e: string, table: bigint[]}[]} the distinct operators.
 */
export function laneOperators(p: bigint): {
    c: string;
    e: string;
    table: bigint[];
}[];
/**
 * Pure monomials only (c = 1): the maps x ↦ x^e. Count is φ(p−1).
 * @param {bigint} p - the lane prime.
 * @returns {{e: string, table: bigint[]}[]}
 */
export function laneMonomials(p: bigint): {
    e: string;
    table: bigint[];
}[];
/**
 * Per-lane and global operator counts over a basis. Every number is derived by
 * enumeration or by the closed form it is checked against — none is asserted.
 * @param {bigint[]} [basis=B8] - the lanes to profile.
 * @returns {Object} `CRAM_OPERATOR_ATLAS_V1` — per-lane counts (monomials,
 *   twisted, enumerated, units) and basis-wide totals.
 */
export function atlas(basis?: bigint[]): any;
/**
 * Read a lane table at a BigInt index without leaving BigInt arithmetic.
 * @param {bigint[]} table - a lane function table.
 * @param {bigint} v - the index to read (BigInt, converted internally to compare).
 * @returns {bigint} table[v].
 * @throws {Error} "index outside the lane" if v is not a valid index of `table`.
 */
export function at(table: bigint[], v: bigint): bigint;
/**
 * Composition closure check: the exact lane operators form a group under
 * composition (the holomorph of C_{p−1}). Verified by composing every pair and
 * confirming the result is already in the set.
 * @param {bigint} p - the lane prime.
 * @returns {boolean} true iff the operator set is closed under composition.
 */
export function laneClosesUnderComposition(p: bigint): boolean;
/**
 * Exact diagnostics for the square-root claim, as integer ratios only — no
 * logarithm, no division to a decimal, anywhere.
 *
 *   squares_per_lane      how many of the p residues are squares: (p+1)/2 odd, 2 at p=2
 *   defined_everywhere    |{x ∈ Z/M : x is a square in every lane}|
 *   root_multiplicity     number of square roots a generic square has mod M
 *   branch_hits/branch_of the exact fraction of Y for which a fixed per-lane
 *                         branch rule returns Y itself rather than another root
 * @param {bigint[]} [basis=B8] - the lanes to profile.
 * @returns {Object} `CRAM_SQRT_DIAGNOSTICS_V1` — per-lane square counts plus
 *   basis-wide totality/single-valuedness verdicts. All numeric fields decimal strings.
 */
export function sqrtDiagnostics(basis?: bigint[]): any;
/**
 * On a prime field x^p = x, so Frobenius is the identity map. Verified exhaustively.
 * @param {bigint} p - the lane prime.
 * @returns {boolean}
 */
export function frobeniusIsIdentity(p: bigint): boolean;
/**
 * Keyspace size of "each operator is a secret permutation", in bits, floored.
 * Returned as an integer bit-count so the figure can be compared against a
 * security level without evaluating a logarithm.
 * @param {bigint} count - the number of possibilities.
 * @returns {bigint} ⌊log2(count)⌋.
 */
export function keyspaceBitsFloor(count: bigint): bigint;
