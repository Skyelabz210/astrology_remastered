/**
 * ID_p(x) = (r, w). r angular, w axial. x = r + p·w exactly.
 * @param {bigint} x - the value.
 * @param {bigint} p - the lane modulus.
 * @returns {{r: bigint, w: bigint, p: bigint, exact: boolean}}
 */
export function identity(x: bigint, p: bigint): {
    r: bigint;
    w: bigint;
    p: bigint;
    exact: boolean;
};
/**
 * The full identity over a basis: one (r, w) pair per lane.
 * @param {bigint} x - the value.
 * @param {bigint[]} basis - the lane moduli.
 * @returns {{r: bigint, w: bigint, p: bigint, exact: boolean}[]}
 */
export function identityOn(x: bigint, basis: bigint[]): {
    r: bigint;
    w: bigint;
    p: bigint;
    exact: boolean;
}[];
/**
 * Same angular position, different level of the cylinder. This is the whole
 * point: the residue tuple cannot tell these apart, the identity can.
 * @param {bigint} x
 * @param {bigint} y
 * @param {bigint} p - the lane modulus.
 * @returns {{same_residue: boolean, same_winding: boolean, distinct: boolean}}
 */
export function sameAngleDifferentLevel(x: bigint, y: bigint, p: bigint): {
    same_residue: boolean;
    same_winding: boolean;
    distinct: boolean;
};
/**
 * κ = K-Elim(x, M, A) — the winding of x around M, read from A. Exact for κ < A.
 * @param {bigint} x - the value.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus (must be coprime to M).
 * @returns {?bigint} the winding, or null if M is not coprime to A.
 */
export function kElim(x: bigint, M: bigint, A: bigint): bigint | null;
/**
 * D-030 §2.2. The DOUBLE elimination — κ₂ = K-Elim(κ₁, A₁, A₂), the winding of
 * the winding. Both digits are read off x independently; nothing is threaded.
 *
 * Exact while K < A₁·A₂, i.e. x < M·A₁·A₂ — so the second order also widens the
 * corridor, but that is a consequence, not the point. The point is that κ₂ is
 * the ACCELERATION of the identity along the cylinder.
 * @param {bigint} x - the value.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A1 - the first-order anchor.
 * @param {bigint} A2 - the second-order anchor.
 * @returns {?{kappa1: bigint, kappa2: bigint, K: bigint, corridor: bigint, order: bigint}}
 *   null if either elimination fails (a required modulus is not coprime).
 */
export function doubleKElim(x: bigint, M: bigint, A1: bigint, A2: bigint): {
    kappa1: bigint;
    kappa2: bigint;
    K: bigint;
    corridor: bigint;
    order: bigint;
} | null;
/**
 * Mixed-radix digits of the winding from INDEPENDENT eliminations — one per
 * anchor, none depending on the last. This is what makes it not a Garner
 * cascade: Garner's digit i needs digits 0..i−1.
 * @param {bigint} x - the value.
 * @param {bigint} M - the shell modulus.
 * @param {bigint[]} anchors - the anchor moduli, one digit per anchor.
 * @returns {?{digits: bigint[], K: bigint, radix: bigint, corridor: bigint, accumulator_threaded: false}}
 *   null if any elimination or inverse along the way fails.
 */
export function windingDigits(x: bigint, M: bigint, anchors: bigint[]): {
    digits: bigint[];
    K: bigint;
    radix: bigint;
    corridor: bigint;
    accumulator_threaded: false;
} | null;
/**
 * The natal chart: the birth state, (r₀, 0). The winding is zero by definition.
 * @param {bigint} x0 - the natal (birth) value.
 * @param {bigint[]} basis - the lanes to record residues on.
 * @returns {{kind: "NATAL_IDENTITY_V1", residues: bigint[], winding: bigint[], basis: bigint[], origin: bigint}}
 */
export function natalChart(x0: bigint, basis: bigint[]): {
    kind: "NATAL_IDENTITY_V1";
    residues: bigint[];
    winding: bigint[];
    basis: bigint[];
    origin: bigint;
};
/**
 * A carry event: the residue wrapped p, so the winding incremented. A life event.
 * @param {bigint} xBefore - the value before the event.
 * @param {bigint} xAfter - the value after the event.
 * @param {bigint} p - the lane modulus.
 * @returns {{wrapped: boolean, increments: bigint, from: bigint, to: bigint, lane: bigint}}
 */
export function carryEvent(xBefore: bigint, xAfter: bigint, p: bigint): {
    wrapped: boolean;
    increments: bigint;
    from: bigint;
    to: bigint;
    lane: bigint;
};
/**
 * A RETURN: the angular position equals the natal one. Same chart position, and
 * a strictly greater winding — the identity is not the same. The Saturn Return
 * of the tradition is exactly this, and κ at the return measures the journey.
 * @param {bigint} x - the current value.
 * @param {bigint} natalResidue - the natal value (its residue mod p is what is compared).
 * @param {bigint} p - the lane modulus.
 * @returns {{returned: boolean, winding: bigint, changed: boolean, journey: bigint}}
 */
export function isReturn(x: bigint, natalResidue: bigint, p: bigint): {
    returned: boolean;
    winding: bigint;
    changed: boolean;
    journey: bigint;
};
/**
 * Every return of lane p up to a bound, with the winding each one carries.
 * @param {bigint} natal - the natal (birth) value.
 * @param {bigint} p - the lane modulus.
 * @param {bigint} bound - the exclusive upper bound to search up to.
 * @returns {Object[]} one `{x, ...isReturn(x, natal, p)}` entry per return.
 */
export function returns(natal: bigint, p: bigint, bound: bigint): any[];
/**
 * The winding along a trajectory is non-decreasing — it is a Lyapunov function.
 * @param {Iterable<bigint>} trajectory - the values in time order.
 * @param {bigint} p - the lane modulus.
 * @returns {{monotone: boolean, violations: number}}
 */
export function windingMonotone(trajectory: Iterable<bigint>, p: bigint): {
    monotone: boolean;
    violations: number;
};
/**
 * The natal state (r₀, 0) is algebraically unreachable from any later state:
 * no future point on the cylinder carries winding zero once it has wound.
 * @param {Iterable<bigint>} trajectory - the values in time order.
 * @param {bigint} p - the lane modulus.
 * @returns {{wound_states: bigint, any_returned_to_zero: boolean}}
 */
export function natalUnreachable(trajectory: Iterable<bigint>, p: bigint): {
    wound_states: bigint;
    any_returned_to_zero: boolean;
};
