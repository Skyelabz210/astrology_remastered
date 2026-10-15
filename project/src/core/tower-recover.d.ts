/**
 * lcm of a list.
 * @param {bigint[]} ms
 * @returns {bigint} lcm(ms), or 1n for an empty list.
 */
export function lcmAll(ms: bigint[]): bigint;
/**
 * CRT over moduli that need NOT be pairwise coprime.
 * @param {bigint[]} residues - x mod moduli[i] for each i.
 * @param {bigint[]} moduli - the (possibly non-coprime) moduli.
 * @returns {?bigint} the unique residue mod lcm(moduli) consistent with every
 *   congruence, or null when they conflict.
 */
export function crtCombine(residues: bigint[], moduli: bigint[]): bigint | null;
/**
 * The corridor an anchor set buys: R = lcm(anchors) / gcd(M, lcm(anchors)).
 * @param {bigint} M - the shell modulus.
 * @param {bigint[]} anchors - the anchor moduli.
 * @returns {{L: bigint, d: bigint, R: bigint, span: bigint}} L=lcm(anchors),
 *   d=gcd(M,L), R=L/d (the winding resolution), span=M*R (the total corridor).
 */
export function anchorSetCorridor(M: bigint, anchors: bigint[]): {
    L: bigint;
    d: bigint;
    R: bigint;
    span: bigint;
};
/**
 * T-COMP-1. Recover the winding K = ⌊X/M⌋ from the shell residue r = X mod M
 * and the anchor residues {X mod Aᵢ}. Exact while K < R.
 *
 * @param {bigint} r - the shell residue, X mod M.
 * @param {bigint[]} anchorResidues - X mod anchors[i] for each i.
 * @param {bigint} M - the shell modulus.
 * @param {bigint[]} anchors - the anchor moduli.
 * @returns {?{K: bigint, R: bigint, L: bigint, d: bigint, corridor: bigint}}
 *   null when the anchor residues are mutually inconsistent, or when
 *   d ∤ (v_L − r) — both of which mean the inputs cannot come from one integer.
 */
export function towerRecover(r: bigint, anchorResidues: bigint[], M: bigint, anchors: bigint[]): {
    K: bigint;
    R: bigint;
    L: bigint;
    d: bigint;
    corridor: bigint;
} | null;
/**
 * Driven from the integer — for encoding and for tests.
 * @param {bigint} x - the source integer.
 * @param {bigint} M - the shell modulus.
 * @param {bigint[]} anchors - the anchor moduli.
 * @returns {?Object} `towerRecover(...)` result.
 */
export function towerRecoverFrom(x: bigint, M: bigint, anchors: bigint[]): any | null;
/**
 * Extend an anchor set until the corridor covers `need`. Each added anchor is
 * one pairwise combine — linear cost for a multiplicative gain in R.
 * @param {bigint} M - the shell modulus.
 * @param {bigint[]} anchors - the starting anchor set.
 * @param {bigint} need - the target corridor span.
 * @param {bigint[]} candidates - candidate anchors to add, tried in order.
 * @returns {{anchors: bigint[], L: bigint, d: bigint, R: bigint, span: bigint}}
 *   the extended anchor set and its resulting corridor.
 */
export function extendAnchors(M: bigint, anchors: bigint[], need: bigint, candidates: bigint[]): {
    anchors: bigint[];
    L: bigint;
    d: bigint;
    R: bigint;
    span: bigint;
};
/**
 * E-DIV-4. The tracked winding and the extracted winding must agree; a
 * disagreement is an implementation fault, not a domain error.
 * @param {bigint} tracked - the winding as independently tracked.
 * @param {bigint} extracted - the winding as recovered by K-Elimination.
 * @returns {{tracked: bigint, extracted: bigint, agree: boolean, fault: ?string}}
 */
export function crossCheckWinding(tracked: bigint, extracted: bigint): {
    tracked: bigint;
    extracted: bigint;
    agree: boolean;
    fault: string | null;
};
