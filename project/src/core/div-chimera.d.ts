/**
 * One root operator, evaluated exactly in one lane mod p. `div`/`inv` are
 * unit-partial: `null` when the second operand (div) or the operand itself
 * (inv) is not invertible mod p.
 * @param {string} op - one of `ROOT_OPS`.
 * @param {bigint} a
 * @param {bigint} b
 * @param {bigint} p - the lane modulus.
 * @returns {?bigint}
 */
export function laneOp(op: string, a: bigint, b: bigint, p: bigint): bigint | null;
/**
 * V1 — K-Elimination division, the flagship. Requires `gcd(d, M) = 1` and
 * `d | aVal`. Each lane's residue is divided by d's own residue in that
 * lane directly — the quotient never leaves residue space.
 * @param {bigint} aVal - the dividend, `aVal >= 0`.
 * @param {bigint} d - the divisor, `d > 0`.
 * @param {bigint[]} basis
 * @returns {{q: bigint, alpha: bigint[]}} the exact quotient and its
 *   lanewise residue tuple over `basis` (certified equal to `q mod p` on
 *   every lane before returning).
 * @throws {NonExactDivisionError} if `d` does not divide `aVal`.
 * @throws {DivisorNotCoprimeError} if `gcd(d, shellModulus(basis)) !== 1`.
 */
export function v1KElim(aVal: bigint, d: bigint, basis: bigint[]): {
    q: bigint;
    alpha: bigint[];
};
/**
 * V2 — Fused Piggyback Division, fused form: `(aVal·bVal)/d` as one
 * multiplication plus one V1-style division — the division piggybacks on a
 * multiplication rather than paying for the product and the quotient
 * separately.
 * @param {bigint} aVal
 * @param {bigint} bVal
 * @param {bigint} d - `d > 0`, `gcd(d, shellModulus(basis)) === 1`.
 * @param {bigint[]} basis
 * @returns {{q: bigint, alpha: bigint[]}} the exact quotient `(aVal*bVal)/d`
 *   and its lanewise residues.
 * @throws {NonExactDivisionError} if `d` does not divide `aVal*bVal`.
 */
export function v2FpdFused(aVal: bigint, bVal: bigint, d: bigint, basis: bigint[]): {
    q: bigint;
    alpha: bigint[];
};
/**
 * V3 — FPD, anchor form: each auxiliary anchor with `gcd(d, anchor) = 1`
 * reads the quotient's residue directly through that anchor — no shared
 * basis with `aVal`'s own encoding is required, only `d | aVal`.
 * @param {bigint} aVal
 * @param {bigint} d - `d > 0`.
 * @param {bigint[]} [anchors] - candidate anchor moduli; defaults to `DEFAULT_ANCHORS`.
 * @returns {{q: bigint, reads: Map<bigint, bigint>}} the exact quotient and
 *   a map from each coprime anchor to `q mod anchor`.
 * @throws {NonExactDivisionError} if `d` does not divide `aVal`.
 * @throws {DivisorNotCoprimeError} if no candidate anchor is coprime to `d`.
 */
export function v3FpdAnchors(aVal: bigint, d: bigint, anchors?: bigint[]): {
    q: bigint;
    reads: Map<bigint, bigint>;
};
/**
 * V4, homogeneous — every lane runs the `div` root operator against a unit
 * divisor. The lanewise tray this produces is exactly `(aVal · d⁻¹) mod p`
 * on each lane, which lifts to plain ring division `(aVal · d⁻¹) mod M`.
 * @param {bigint} aVal
 * @param {bigint} d - `gcd(d, shellModulus(basis)) === 1`.
 * @param {bigint[]} basis
 * @returns {{tray: bigint[], expect: bigint}} the lanewise tray and the
 *   in-ring value `(aVal·d⁻¹) mod M` it's certified to agree with lanewise.
 * @throws {DivisorNotCoprimeError} if `d` is not a unit mod `shellModulus(basis)`.
 */
export function v4LanewiseDivHomogeneous(aVal: bigint, d: bigint, basis: bigint[]): {
    tray: bigint[];
    expect: bigint;
};
/**
 * V4, heterogeneous — a distinct root operator per lane, at the caller's
 * discretion (any of `ROOT_OPS`, `div` where that lane's own divisor
 * happens to be a unit, some other operator elsewhere). Stays entirely
 * in-ring; no cross-lane certificate is possible since each lane may be
 * computing something unrelated to the others.
 * @param {bigint} aVal
 * @param {bigint} bVal
 * @param {string[]} ops - one `ROOT_OPS` entry per basis lane, same length as `basis`.
 * @param {bigint[]} basis
 * @returns {{tray: (?bigint)[], mask: boolean[]}} the per-lane result (`null`
 *   where that lane's operator was undefined there) and a definedness mask.
 */
export function v4LanewiseDivHeterogeneous(aVal: bigint, bVal: bigint, ops: string[], basis: bigint[]): {
    tray: (bigint | null)[];
    mask: boolean[];
};
/**
 * The winding-aware transduction primitive: the exact residue, in lane `b`,
 * of a magnitude carried as `(gamma, K)` over shell modulus `M` — i.e.
 * `(gamma + K·M) mod b`. Exact for ANY `b`, coprime to `M` or not (the
 * Saturation Principle already proven elsewhere in this core — see
 * `cram.js#transduce` for the richer state-object form of the same idea;
 * this is the bare formula, used here because V5's precondition and return
 * shape don't need that richer machinery).
 * @param {bigint} gamma - `0 <= gamma < M`.
 * @param {bigint} K - the winding.
 * @param {bigint} M - the shell modulus `gamma`/`K` were carried over.
 * @param {bigint} b - the target lane.
 * @returns {bigint}
 */
export function transduceLane(gamma: bigint, K: bigint, M: bigint, b: bigint): bigint;
/**
 * V5 — transduction-enriched division: for a divisor `d` sharing a factor
 * with `shellModulus(homeBasis)` (so V1 cannot apply there directly), the
 * carried magnitude transduces — lanewise, value-preserving, no
 * reconstruction — into `altBasis` (coprime to `d`), divides natively there
 * by V1's own mechanism, and transduces the quotient back home.
 * @param {bigint} aVal - `aVal >= 0`.
 * @param {bigint} d - `d > 0`.
 * @param {bigint[]} homeBasis
 * @param {bigint[]} [altBasis] - defaults to `DEFAULT_ALT_BASIS`.
 * @returns {{q: bigint, resHome: bigint[]}} the exact quotient and its
 *   lanewise residues back over `homeBasis`.
 * @throws {NonExactDivisionError} if `d` does not divide `aVal`.
 * @throws {DivisorNotCoprimeError} if `altBasis` is not coprime to `d`.
 */
export function v5Transduced(aVal: bigint, d: bigint, homeBasis: bigint[], altBasis?: bigint[]): {
    q: bigint;
    resHome: bigint[];
};
/**
 * Route an exact integer division to its natural variety: V1 when `d` is
 * coprime to `shellModulus(basis)`, V5 (via `DEFAULT_ALT_BASIS`) otherwise.
 * Handles either operand's sign by dividing the absolute values and
 * reapplying the sign of the (unique) exact quotient.
 * @param {bigint} aVal
 * @param {bigint} d - nonzero.
 * @param {bigint[]} basis
 * @returns {{variety: "V1_k_elim"|"V5_transduced", q: bigint}}
 * @throws {Error} `"division by zero"` if `d === 0n`.
 * @throws {NonExactDivisionError} if `d` does not divide `aVal`.
 */
export function route(aVal: bigint, d: bigint, basis: bigint[]): {
    variety: "V1_k_elim" | "V5_transduced";
    q: bigint;
};
/**
 * DIV³ — modular multiplication from division alone: `mul(a,b) mod p`,
 * synthesized as `DIV(1, DIV(DIV(1,a), b))`. Three `div` root-operator
 * applications, zero `mul` anywhere in the construction; defined exactly
 * when both `a` and `b` are units mod `p`.
 * @param {bigint} a
 * @param {bigint} b
 * @param {bigint} p
 * @returns {?bigint} `(a*b) mod p`, or `null` if either operand is not a unit mod `p`.
 */
export function div3Mul(a: bigint, b: bigint, p: bigint): bigint | null;
/**
 * DIV³ applied lanewise across a basis: noise-free modular multiplication
 * on every lane where both operands are units there.
 * @param {bigint} aVal
 * @param {bigint} bVal
 * @param {bigint[]} basis
 * @returns {(?bigint)[]}
 */
export function div3Schema(aVal: bigint, bVal: bigint, basis: bigint[]): (bigint | null)[];
/**
 * Φ³ — the Zero-Noise triple certification of one exact-division event.
 * Inner: V1's residue-native quotient of `(aVal*d)/d` (which must equal
 * `aVal`). Middle: V2's fused path over the same `(aVal*d)/d` must agree
 * with the inner reading, lane by lane. Outer: both must agree with the
 * carried quotient `q mod p`. A fourth, independent check rides along on
 * the same lanes: DIV³'s multiplication-from-division-alone must agree
 * with plain multiplication wherever both operands are units. The only
 * globally consistent state is discrepancy 0 at every layer, on every lane.
 * @param {bigint} aVal
 * @param {bigint} bVal - used only for the DIV³ cross-check, not the division itself.
 * @param {bigint} d - `d > 0`, `gcd(d, shellModulus(basis)) === 1`.
 * @param {bigint[]} basis
 * @returns {{q: bigint, discrepancies: bigint}} `q === aVal` and
 *   `discrepancies === 0n` on a correct implementation.
 */
export function phi3Certify(aVal: bigint, bVal: bigint, d: bigint, basis: bigint[]): {
    q: bigint;
    discrepancies: bigint;
};
/** The 8 root operators of the distortion alphabet (degree ≤ 2, DKAM-subcritical). */
export const ROOT_OPS: string[];
/**
 * The Four-Division Chimera's lane-role assignment over the eight-lane Safe
 * Basis (`basis.js#B8`) — labels only, informational; no function here reads
 * this table to change behavior.
 */
export const CHIMERA_ROLES: Map<bigint, string>;
/** Anchor lanes V3/V5 fall back to by default: primes just past the Safe Basis. */
export const DEFAULT_ANCHORS: bigint[];
/** Alternate basis V5 transduces into by default, coprime to any Safe-Basis-sharing divisor. */
export const DEFAULT_ALT_BASIS: bigint[];
/** Thrown when a divisor does not evenly divide the dividend. */
export class NonExactDivisionError extends Error {
    constructor(aVal: any, d: any);
    aVal: any;
    d: any;
}
/** Thrown when a variety's coprimality precondition on the divisor fails. */
export class DivisorNotCoprimeError extends Error {
    constructor(message: any);
}
