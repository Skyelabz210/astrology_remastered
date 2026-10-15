/**
 * Decompose X into its identity (r, K) against a modulus.
 * @param {bigint} x - the integer to decompose.
 * @param {bigint} [m=M6] - the modulus (lap length).
 * @returns {{r: bigint, K: bigint}} r = x mod m (the phase), K = ⌊x/m⌋ (the winding).
 */
export function identity(x: bigint, m?: bigint): {
    r: bigint;
    K: bigint;
};
/**
 * Rebuild X from its identity. reconstruct(identity(x)) === x, always.
 * @param {bigint} r - the phase.
 * @param {bigint} k - the winding.
 * @param {bigint} [m=M6] - the modulus.
 * @returns {bigint} r + k*m.
 */
export function reconstruct(r: bigint, k: bigint, m?: bigint): bigint;
/**
 * The residue tuple of a phase over a basis — the faithful label.
 * @param {bigint} x - the value to reduce.
 * @param {bigint[]} [basis=B6] - the lane moduli.
 * @returns {bigint[]} the per-lane residues, in basis order.
 */
export function tuple(x: bigint, basis?: bigint[]): bigint[];
/**
 * One forward step, residue-native. Add 1 to every lane; when the phase lands
 * on the all-zeros boundary the winding increments.
 * @param {{r: bigint, K: bigint}} state - the current identity.
 * @param {bigint} [m=M6] - the modulus.
 * @returns {{r: bigint, K: bigint}} the successor identity.
 */
export function stepForward(state: {
    r: bigint;
    K: bigint;
}, m?: bigint): {
    r: bigint;
    K: bigint;
};
/**
 * One backward step. Same boundary, opposite sign: if sitting on all-zeros the
 * winding decrements first, then every lane subtracts 1.
 * @param {{r: bigint, K: bigint}} state - the current identity.
 * @param {bigint} [m=M6] - the modulus.
 * @returns {{r: bigint, K: bigint}} the predecessor identity.
 */
export function stepBackward(state: {
    r: bigint;
    K: bigint;
}, m?: bigint): {
    r: bigint;
    K: bigint;
};
/**
 * The arrow order on (K, r): K orders the laps, r orders within a lap.
 * This is a total order and it agrees with comparing the reconstructed
 * integers — which is the point.
 * @param {{r: bigint, K: bigint}} a
 * @param {{r: bigint, K: bigint}} b
 * @returns {-1|0|1} -1 if a < b, 0 if equal, 1 if a > b.
 */
export function arrowCompare(a: {
    r: bigint;
    K: bigint;
}, b: {
    r: bigint;
    K: bigint;
}): -1 | 0 | 1;
/**
 * Coordinatewise tuple comparison — deliberately provided so the distinction
 * can be demonstrated rather than described. It does NOT order the lap:
 * x=2 → (0,2,2,2,2,2) sorts below x=1 → (1,1,1,1,1,1).
 * @param {bigint} x
 * @param {bigint} y
 * @param {bigint[]} [basis=B6] - the lane moduli.
 * @returns {-1|0|1} lexicographic comparison of the two residue tuples.
 */
export function tupleCompare(x: bigint, y: bigint, basis?: bigint[]): -1 | 0 | 1;
/**
 * Whether every pair of lanes in `basis` is coprime.
 * @param {bigint[]} basis - candidate lane moduli.
 * @returns {boolean} true iff gcd(basis[i], basis[j]) === 1n for every i≠j.
 */
export function pairwiseCoprime(basis: bigint[]): boolean;
/**
 * Measure whether a basis gives a faithful clock over a range.
 *
 * A pairwise-coprime basis is a bijection over [0, ∏p): distinct readings equal
 * the range, collisions zero. A pseudo-basis collides: distinct readings drop to
 * lcm(basis) and the collision count is range − lcm. The classic witness
 * {4, 6, 10} over its product 240 has lcm 60 and therefore 180 collisions.
 * @param {bigint[]} basis - candidate lane moduli.
 * @param {?bigint} [range=null] - span to test over; defaults to the basis product.
 * @returns {Object} `SATURATION_V1` report (all numeric fields decimal strings):
 *   product, lcm, range, distinct_readings, collisions, pairwise_coprime, faithful.
 */
export function saturation(basis: bigint[], range?: bigint | null): any;
/**
 * Fibre multiplicity of a step map over a domain. H_shadow = 0 exactly when
 * every fibre is a singleton. `keyOf` maps a domain point to what the observer
 * retains — carry K and it is injective; discard K and laps collapse.
 * @param {Iterable<*>} domain - the points to classify (e.g. `carriedDomain(...)` output).
 * @param {function(*): *} keyOf - maps a domain point to the retained key (e.g. `keyIdentity` or `keyPhaseOnly`).
 * @returns {{fibres: number, fibre_max: number, bijection: boolean, h_shadow_zero: boolean}}
 */
export function fibreProfile(domain: Iterable<any>, keyOf: (arg0: any) => any): {
    fibres: number;
    fibre_max: number;
    bijection: boolean;
    h_shadow_zero: boolean;
};
/**
 * H_shadow in bits, exactly, when the fibre size is a power of two; null
 * otherwise. Reporting an integer exponent keeps this A1-clean — no logarithm
 * is evaluated anywhere.
 * @param {bigint|number} fibreSize - the fibre size to test (coerced to BigInt).
 * @returns {?string} the exponent (as a decimal string) if fibreSize is a
 *   power of two and ≥ 1; null otherwise.
 */
export function shadowEntropyBits(fibreSize: bigint | number): string | null;
/**
 * The clean carried successor over `laps` laps: state (r, K) → next state.
 * Its fibre profile is a bijection, so the arrow is pure orientation.
 * @param {bigint} laps - number of laps (K values 0..laps-1) to enumerate.
 * @param {bigint} [m=M6] - the modulus.
 * @returns {{r: bigint, K: bigint}[]} every (r, K) pair over the range, K-major.
 */
export function carriedDomain(laps: bigint, m?: bigint): {
    r: bigint;
    K: bigint;
}[];
/**
 * The synthetic that breaks it: retain the phase, discard the winding.
 * @param {{r: bigint, K: bigint}} s
 * @returns {string} the phase alone, as a string — collapses distinct laps together.
 */
export function keyPhaseOnly(s: {
    r: bigint;
    K: bigint;
}): string;
/**
 * The clean key: retain the whole identity.
 * @param {{r: bigint, K: bigint}} s
 * @returns {string} "K:r", injective over the whole domain.
 */
export function keyIdentity(s: {
    r: bigint;
    K: bigint;
}): string;
