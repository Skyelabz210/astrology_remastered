/**
 * S_n = 6n(n−1) + 1.
 * @param {bigint} n - the star index.
 * @returns {bigint} the nth star number.
 */
export function starNumber(n: bigint): bigint;
/**
 * The adjacency pair carried by S_n: shell 6n(n−1), anchor S_n.
 * @param {bigint} n - the star index.
 * @returns {{n: string, shell: string, anchor: string, adjacent: true}}
 */
export function starPair(n: bigint): {
    n: string;
    shell: string;
    anchor: string;
    adjacent: true;
};
/**
 * @param {bigint} upTo - the highest star index to include.
 * @returns {Object[]} `starPair(n)` for n = 1..upTo.
 */
export function starFamily(upTo: bigint): any[];
/**
 * One level of the tower. Reads the level's winding by the adjacency collapse
 * — one subtraction — and reports whether the single anchor certifies it.
 *
 * Nothing here reads any other level. That is the no-accumulator property.
 * @param {bigint} T - the current tower level's value.
 * @param {bigint} M - the star shell modulus.
 * @returns {{value: bigint, digit: bigint, k_mod_anchor: bigint, k_true: bigint,
 *   identity_holds: boolean, certified: boolean, next: bigint}}
 */
export function towerLevel(T: bigint, M: bigint): {
    value: bigint;
    digit: bigint;
    k_mod_anchor: bigint;
    k_true: bigint;
    identity_holds: boolean;
    certified: boolean;
    next: bigint;
};
/**
 * The full tower, descending until the winding reaches zero.
 * Termination is guaranteed for every finite X because each level divides the
 * magnitude by M ≥ 2.
 * @param {bigint} X - the value to descend.
 * @param {bigint} M - the star shell modulus (M ≥ 2).
 * @returns {Object[]} the tower levels, as `towerLevel` outputs, from X down to zero.
 * @throws {Error} "tower shell must be at least 2" if M < 2.
 */
export function windingTower(X: bigint, M: bigint): any[];
/**
 * BOUNDARY PROJECTION (P20). Horner in base M — this couples every level into a
 * positional composite and is therefore a radix step, exactly like r + K·M. It
 * is exact and it is a useful check that the tower decomposes faithfully, but
 * it is NOT an operation of the tower. The tower's levels stay independent and
 * uncoupled; nothing in the descent forms this.
 * @param {Object[]} levels - a tower from `windingTower`.
 * @param {bigint} M - the star shell modulus.
 * @returns {bigint} the reconstructed original value X.
 */
export function towerRebuild(levels: any[], M: bigint): bigint;
/**
 * Depth/precision report. `handover_depth` is the first level the single
 * adjacent anchor cannot certify — the exact point at which the tower must
 * hand off to a wider fixture via transduction.
 * @param {bigint} X - the value to descend.
 * @param {bigint} M - the star shell modulus.
 * @returns {Object} `STAR_TOWER_V1` — depth, per-level certification counts,
 *   `handover_depth` (first uncertified level, or null if all are certified),
 *   and a boundary-projection self-check.
 */
export function towerReport(X: bigint, M: bigint): any;
/**
 * Level independence, made checkable rather than asserted: recomputing any
 * level from its own value alone reproduces the tower's entry for that level.
 * A Garner cascade cannot pass this — its digit i is a function of digits
 * 0..i−1, so it has no such standalone form.
 * @param {bigint} X - the value to descend.
 * @param {bigint} M - the star shell modulus.
 * @returns {boolean} true iff every level is reproducible from its own value alone.
 */
export function levelsAreIndependent(X: bigint, M: bigint): boolean;
/**
 * Garner's mixed-radix digits, for contrast. The accumulator `acc` threads
 * through every step — this is the positional emission A2 prohibits, and it is
 * the radix that DynCRT was carrying.
 * @param {bigint} X - the value to decompose.
 * @param {bigint[]} basis - the mixed-radix moduli, in digit order.
 * @returns {{digits: bigint[], accumulator_threaded: true}}
 */
export function garnerDigits(X: bigint, basis: bigint[]): {
    digits: bigint[];
    accumulator_threaded: true;
};
/**
 * A CRT fixture: an ordered basis with the unit lane at index 0 and the
 * informative lanes one-indexed after it, so the shadow prime 11 stays on
 * lane 5 no matter what else is adjoined.
 * @param {bigint[]} basis - the informative lanes (unit lane is prepended automatically).
 * @returns {Object} `CRT_FIXTURE_V1` — `{kind, basis, lanes, M, anchor}` where
 *   `lanes` is `[{index, modulus, role}, ...]`.
 * @throws {Error} "fixture basis must be pairwise coprime" if `basis` is not a safe basis.
 */
export function fixture(basis: bigint[]): any;
/**
 * The lane index of a modulus in a fixture, or null.
 * @param {Object} fx - a fixture from `fixture()`.
 * @param {bigint} modulus - the lane modulus to look up.
 * @returns {?bigint} the lane's index, or null if not present.
 */
export function laneOf(fx: any, modulus: bigint): bigint | null;
/**
 * Adjoining the unit lane changes nothing — the identity transduction.
 * @param {bigint[]} basis - the basis to test (before the unit lane is added).
 * @returns {boolean}
 */
export function unitLaneIsIdentity(basis: bigint[]): boolean;
/**
 * Z/1 has one element, so the unit lane carries zero bits.
 * @param {bigint} modulus - a lane modulus.
 * @returns {bigint} the number of distinguishable states of that lane (== modulus).
 */
export function laneStates(modulus: bigint): bigint;
/**
 * @param {bigint} modulus - a lane modulus.
 * @returns {boolean} true iff the lane carries more than one state (modulus > 1).
 */
export function laneIsInformative(modulus: bigint): boolean;
/**
 * The phase lock between two fixtures: the lanes they share.
 * `origin` is the unit lane, always shared, guaranteeing a common zero;
 * `carriers` are the shared informative lanes, which is where the phase
 * actually lives. `strength` is the number of distinguishable phases.
 * @param {Object} fxA - a fixture from `fixture()`.
 * @param {Object} fxB - a fixture from `fixture()`.
 * @returns {Object} `PHASE_LOCK_V1` — origin fields plus `carriers`
 *   (shared informative lanes), `strength` (product of shared lane sizes),
 *   and `locked`.
 */
export function phaseLock(fxA: any, fxB: any): any;
/**
 * A transduction is phase-locked to lane ℓ exactly when Φ fixes the lane:
 * Φ(x) ≡ x (mod ℓ) for all x. For Φ with integer coefficients this is decided
 * by one period, so the check below is exhaustive for that class — and that
 * assumption is stated rather than hidden.
 * @param {function(bigint): bigint} phi - a value map with integer coefficients.
 * @param {bigint} lane - the lane modulus to check the lock against.
 * @returns {boolean} true iff Φ(x) ≡ x (mod lane) for every x in one period.
 */
export function preservesPhase(phi: (arg0: bigint) => bigint, lane: bigint): boolean;
/**
 * The Φ that shift a value while holding the lock: x ↦ x + k·ℓ.
 * @param {bigint} lane - the lane to preserve.
 * @param {bigint} k - the shift multiple.
 * @returns {function(bigint): bigint} the shift function.
 */
export function lockedShift(lane: bigint, k: bigint): (arg0: bigint) => bigint;
/** The recommissioned unit. S_1 = 1, terminal ring, indexed as lane 0. */
export const UNIT_LANE: 1n;
/** The unit lane's fixed index within a fixture's lane array. */
export const UNIT_LANE_INDEX: 0n;
