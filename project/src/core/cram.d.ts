/**
 * Euclidean greatest common divisor.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {bigint} gcd(|a|, |b|), non-negative.
 */
export function gcd(a: bigint, b: bigint): bigint;
/**
 * Extended Euclidean algorithm.
 * @param {bigint} a
 * @param {bigint} b
 * @returns {[bigint, bigint, bigint]} [g, x, y] with g = gcd(a,b) = a*x + b*y.
 */
export function egcd(a: bigint, b: bigint): [bigint, bigint, bigint];
/**
 * Modular inverse, or null when a is not a unit mod m.
 * @param {bigint} a
 * @param {bigint} m - the modulus.
 * @returns {?bigint} a⁻¹ mod m, or null if gcd(a, m) ≠ 1.
 */
export function inverse(a: bigint, m: bigint): bigint | null;
/**
 * A safe basis is pairwise coprime. It is NOT required to be prime.
 * @param {bigint[]} basis - candidate lane moduli.
 * @returns {boolean} true iff every element is ≥ 2 and every pair is coprime.
 */
export function isSafeBasis(basis: bigint[]): boolean;
/**
 * The shell modulus of a basis: the product of its lanes.
 * @param {bigint[]} basis
 * @returns {bigint} ∏ basis.
 */
export function shellModulus(basis: bigint[]): bigint;
/**
 * The canonical CRAM anchor: adjacent to the shell, coprime by construction.
 * @param {bigint} M - the shell modulus.
 * @returns {bigint} M + 1.
 */
export function canonicalAnchor(M: bigint): bigint;
/**
 * ADJACENCY COLLAPSE — the governing CRAM configuration.
 *
 *     A = M + 1  ⟹  M ≡ −1 (mod A)  ⟹  M⁻¹ ≡ M ≡ −1  ⟹  K ≡ r − s (mod A)
 *
 * One subtraction and one reduction. Exact whenever 0 ≤ K < A.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} s - anchor residue, x mod (M+1).
 * @param {bigint} M - the shell modulus.
 * @returns {bigint} K = (r − s) mod (M+1).
 */
export function adjacencyRecover(r: bigint, s: bigint, M: bigint): bigint;
/**
 * The same, from the integer, for testing and for encoding.
 * @param {bigint} x - the source integer.
 * @param {bigint} M - the shell modulus.
 * @returns {bigint} K, as `adjacencyRecover`.
 */
export function adjacencyRecoverFrom(x: bigint, M: bigint): bigint;
/**
 * GENERAL K-ELIMINATION — any anchor A coprime to M.
 * Costs a subtract, a multiply by the precomputed M⁻¹ mod A, and a reduction.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} s - anchor residue, x mod A.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus.
 * @returns {?bigint} K mod A, or null when A is not coprime to M (use `gradientRecover` instead).
 */
export function generalRecover(r: bigint, s: bigint, M: bigint, A: bigint): bigint | null;
/**
 * RESOLUTION GRADIENT — anchors that share a factor with the shell.
 * With d = gcd(M, A) and R = A/d, K is recovered modulo R rather than A:
 *
 *     K ≡ ((v − r)/d) · (M/d)⁻¹   (mod R)
 *
 * (M/d)⁻¹ mod R always exists because dividing out the full gcd leaves coprime
 * cofactors.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} v - anchor residue, x mod A.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus (need not be coprime to M).
 * @returns {?bigint} K mod R (R = A/gcd(M,A)), or null when the residue pair is inconsistent.
 */
export function gradientRecover(r: bigint, v: bigint, M: bigint, A: bigint): bigint | null;
/**
 * The resolution a given (shell, anchor) pair achieves.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus.
 * @returns {{d: string, resolution: string, exact_when_K_below: string}} decimal-string fields.
 */
export function resolution(M: bigint, A: bigint): {
    d: string;
    resolution: string;
    exact_when_K_below: string;
};
/**
 * SHADOW LIFT — the Hensel form, needed ONLY when the shadow prime was left in
 * the shell. SUPERSEDED (P18): park lane 11 out of the shell and the shadow
 * anchor is coprime, so `parkedRecover` in anchor.js does the same job as plain
 * K-Elimination with no division step. Retained because the identity is exact
 * and because it is what a shell that already carries 11 must use.
 *
 * The earlier claim that the non-coprimality is "intentional" is withdrawn: it
 * is an artefact of loading 11 into the shell.
 * With M = q·M′, gcd(M′, q) = 1, and shadow modulus q^e:
 *
 *     K ≡ ((s − γ) / q) · (M′)⁻¹   (mod q^{e−1})
 *
 * For B8 with q = 11, e = 6 this pins K modulo 161,051 — a corridor of
 * M8 · 11⁵ ≈ 1.56 × 10¹².
 * @param {bigint} gamma - the CRT representative of the tray (see `gamma`/`gammaOf`).
 * @param {bigint} s - the shadow-lane residue x mod q^e.
 * @param {bigint} M - the shell modulus (which contains q as a factor).
 * @param {bigint} q - the shadow prime.
 * @param {bigint} e - the power q is carried at.
 * @returns {?{K: bigint, modulus: bigint, corridor: bigint}} the lifted
 *   winding and its modulus/corridor, or null on an inconsistent pair.
 */
export function shadowLift(gamma: bigint, s: bigint, M: bigint, q: bigint, e: bigint): {
    K: bigint;
    modulus: bigint;
    corridor: bigint;
} | null;
/**
 * The yield, adjacent anchor. One modular subtraction. Returns the identity
 * pair — r and K are NOT combined.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} s - anchor residue, x mod (M+1).
 * @param {bigint} M - the shell modulus.
 * @returns {{r: bigint, K: bigint, shell: bigint, anchor: bigint}}
 */
export function yieldAdjacent(r: bigint, s: bigint, M: bigint): {
    r: bigint;
    K: bigint;
    shell: bigint;
    anchor: bigint;
};
/**
 * The yield, any coprime anchor. K-Elimination only. Returns the identity pair.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} s - anchor residue, x mod A.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus.
 * @returns {?{r: bigint, K: bigint, shell: bigint, anchor: bigint}} null when A is not coprime to M.
 */
export function yieldGeneral(r: bigint, s: bigint, M: bigint, A: bigint): {
    r: bigint;
    K: bigint;
    shell: bigint;
    anchor: bigint;
} | null;
/**
 * Equality on the identity pair. No composite is formed.
 * @param {{r: bigint, K: bigint}} a
 * @param {{r: bigint, K: bigint}} b
 * @returns {boolean}
 */
export function identityEquals(a: {
    r: bigint;
    K: bigint;
}, b: {
    r: bigint;
    K: bigint;
}): boolean;
/**
 * Order on the identity pair: K orders the laps, r orders within a lap.
 * Reproduces integer order exactly, without forming either integer.
 * @param {{r: bigint, K: bigint}} a
 * @param {{r: bigint, K: bigint}} b
 * @returns {-1|0|1}
 */
export function identityCompare(a: {
    r: bigint;
    K: bigint;
}, b: {
    r: bigint;
    K: bigint;
}): -1 | 0 | 1;
/**
 * BOUNDARY PROJECTION — this is the radix step. It couples r and K into a
 * base-M positional composite. Exact, but it is not the yield and must not be
 * treated as one. Two operations on top of the yield.
 * @param {{r: bigint, K: bigint, shell: bigint}} id - an identity pair with its shell modulus.
 * @returns {bigint} the reconstructed integer id.r + id.K * id.shell.
 */
export function projectToInteger(id: {
    r: bigint;
    K: bigint;
    shell: bigint;
}): bigint;
/**
 * Costs, split so the coupling is visible rather than folded into a total.
 * `couples` is the field that matters.
 * @param {"adjacent"|"general"|"projection"|"garner"} mode
 * @param {bigint} [lanes=8n] - lane count, only used by the "garner" mode's cost.
 * @returns {Object} an op-count breakdown for the given mode.
 * @throws {Error} if `mode` is not one of the four recognized strings.
 */
export function yieldCost(mode: "adjacent" | "general" | "projection" | "garner", lanes?: bigint): any;
/**
 * Op counts for one winding recovery, so the adjacency claim is auditable
 * rather than rhetorical. Counts are structural, not timed.
 * @param {"adjacency"|"general"} mode
 * @returns {Object} an op-count breakdown for the given mode.
 * @throws {Error} if `mode` is neither "adjacency" nor "general".
 */
export function recoveryCost(mode: "adjacency" | "general"): any;
/**
 * Build a `CRAM_STATE_V1` from an integer and a basis.
 * @param {bigint} x - the value to encode.
 * @param {bigint[]} basis - the lane moduli (need not be prime, must be pairwise coprime for downstream use).
 * @param {{sigma?: Object, topology?: string[], shadow?: *, lineage?: Array, support?: number[]}} [opts]
 *   - optional extra state fields; each defaults per `STATE_FIELDS`.
 * @returns {Object} a `CRAM_STATE_V1` object: `{kind, basis, r, K, sigma, topology, shadow, lineage, support}`.
 */
export function encode(x: bigint, basis: bigint[], opts?: {
    sigma?: any;
    topology?: string[];
    shadow?: any;
    lineage?: any[];
    support?: number[];
}): any;
/**
 * Canonical CRT representative of the tray — the boundary touch, not the hot path.
 * @param {{basis: bigint[], r: bigint[]}} state - a CRAM state (or any object with basis/r).
 * @returns {bigint} the unique value in [0, shellModulus(state.basis)) with that residue tray.
 */
export function gamma(state: {
    basis: bigint[];
    r: bigint[];
}): bigint;
/**
 * The full reconstructed integer of a state: gamma(state) + K·M — a boundary
 * projection, not a hot-path operation.
 * @param {{basis: bigint[], r: bigint[], K: bigint}} state
 * @returns {bigint}
 */
export function value(state: {
    basis: bigint[];
    r: bigint[];
    K: bigint;
}): bigint;
/**
 * Structural well-formedness check for a `CRAM_STATE_V1`.
 * @param {Object} state
 * @returns {boolean} true iff `state` has the right kind tag, every
 *   `STATE_FIELDS` key, a pairwise-coprime basis, residues in range for their
 *   lanes, and a topology array matching the basis length.
 */
export function wellFormed(state: any): boolean;
/**
 * CRT idempotents of a basis. They exist iff the basis is unbroken.
 * @param {bigint[]} basis - a pairwise-coprime, no-repeated-modulus basis.
 * @returns {bigint[]} one idempotent e_i per lane, with e_i ≡ 1 (mod basis[i])
 *   and e_i ≡ 0 (mod basis[j]) for j ≠ i.
 * @throws {Error} "broken basis: idempotent does not exist" if any lane
 *   shares a factor with the shell built from the others.
 */
export function idempotents(basis: bigint[]): bigint[];
/**
 * The certificate. CORRECTED (P28): only the SOURCE tray must be an unbroken
 * safe basis. The target inherits primality and coprimality from it through the
 * phase lock, so the target may hold arbitrary composites.
 *
 * The earlier version required both. That refused valid configurations — a lane
 * of the target is a READING, and x mod q is exact for every q whether or not q
 * is prime or coprime to its neighbours. Coprimality buys RECONSTRUCTION FROM
 * THE TRAY ALONE, and the target never needs it: the identity (r, w) lives in
 * the first tray and rides along.
 *
 * Disjointness is not required either; the shared lanes are where the lock is.
 * @param {bigint[]} A - the source basis.
 * @param {bigint[]} B - the target basis.
 * @returns {Object} `TRANSDUCTION_CERTIFICATE_V2` — source/target unbroken
 *   flags, shared lanes, and `admissible` (true iff the source is unbroken).
 */
export function certifyTransduction(A: bigint[], B: bigint[]): any;
/**
 * The basis bridge. Residue-native: no reconstruction, nothing proportional to
 * the value. `phiLane` applies a lane-wise value map (any polynomial with
 * integer coefficients acts lane-wise, since Φ(x) mod b = Φ(x mod b) mod b).
 * Ω selects the winding policy: recompute · preserve · project.
 *
 * MAGNITUDE IS DERIVED BY K-ELIMINATION, NOT DECLARED. (P24, corrects P22)
 * ───────────────────────────────────────────────────────────────────────
 * P22 required the caller to declare `phiBound` — an analytic bound on Φ's
 * growth — before the target winding could be certified. That was the wrong
 * framing, and it is withdrawn.
 *
 * K-Elimination's own theorem says why. In `X = r + k·M`, k is not lost
 * information waiting to be estimated: it is already implicit in the complete
 * residue representation, and an anchor coprime to the shell provides an
 * INDEPENDENT EXACT VIEW of the same value. That is what retires k-tracking.
 * The magnitude of Φ(x) is no different from any other magnitude — it is
 * recovered the same way, by eliminating against an anchor:
 *
 *     K_B ≡ (s − γ_B) · M_B⁻¹   (mod A),      s = Φ(x) mod A
 *
 * and Φ(x) mod A is available for ANY A from the source tray alone, because the
 * bridge gives x mod A exactly and Φ(x) mod A = Φ(x mod A) mod A.
 *
 * What the theorem does require is the RANGE HYPOTHESIS — `X < M·A` in
 * `kElimination_core`. K-Elimination is exact inside a corridor, and the
 * corridor has to be wide enough. So the caller declares DEPTH, a property of
 * the target fixture, and the anchor is lifted to A = (M_B+1)^depth. Depth is
 * the same lever the parked lane uses; nothing about Φ needs to be known.
 *
 * The lift is self-checking. The leading base-A digit of the recovered winding
 * is zero exactly when the previous depth already sufficed, so a NON-ZERO
 * leading digit proves the corridor was too narrow and the transduction is
 * refused. A zero leading digit is necessary for being inside the corridor, and
 * is reported as such — `leading_digit_zero`, not a proof of containment.
 *
 * `phiBound` survives as an OPTIONAL strengthening: supplied, it proves
 * containment outright and the lineage says so. It is no longer required, and
 * its absence no longer refuses anything.
 * @param {Object} state - a `CRAM_STATE_V1` (from `encode`), source of the bridge.
 * @param {bigint[]} targetBasis - the basis to transduce into.
 * @param {{theta?: function, pi?: function, omega?: ("recompute"|"preserve"|"project"|"bound"|"lift"),
 *   phiLane?: function(bigint, bigint): bigint, phiBound?: function(bigint): bigint,
 *   phiMagnitude?: function(bigint): bigint, depth?: bigint, anchors?: bigint[]}} [opts]
 *   - `theta` maps sigma forward; `pi` maps topology forward; `omega` selects
 *   the winding policy (default "recompute"); `phiLane` is an optional
 *   lane-wise value map; `depth` (default 2n) sets the default single-anchor
 *   lift depth when `opts.anchors` is not supplied; `anchors` overrides the
 *   anchor set used for K-Elimination.
 * @returns {Object} a new `CRAM_STATE_V1` over `targetBasis`, with an extended `lineage`.
 * @throws {Error} "transduction refused: basis is broken" if the source basis
 *   is not an unbroken safe basis; "transduction refused: the target winding
 *   wrapped the corridor" under `omega:"recompute"` when the winding exceeds
 *   the anchor set's certified corridor; "transduction refused: omega:'lift'
 *   past the certified corridor needs phiMagnitude" when lifting past the
 *   corridor under a non-trivial Φ without `opts.phiMagnitude`; "unknown
 *   winding policy" for an unrecognized `omega`.
 */
export function transduce(state: any, targetBasis: bigint[], opts?: {
    theta?: Function;
    pi?: Function;
    omega?: ("recompute" | "preserve" | "project" | "bound" | "lift");
    phiLane?: (arg0: bigint, arg1: bigint) => bigint;
    phiBound?: (arg0: bigint) => bigint;
    phiMagnitude?: (arg0: bigint) => bigint;
    depth?: bigint;
    anchors?: bigint[];
}): any;
/**
 * Canonical representative of a tray over a basis.
 * @param {bigint[]} r - the residue tray, one entry per basis lane.
 * @param {bigint[]} basis - the lane moduli.
 * @returns {bigint} the unique value in [0, shellModulus(basis)) with that tray.
 */
export function gammaOf(r: bigint[], basis: bigint[]): bigint;
/**
 * @param {string} omega - a winding policy (see `WINDING_POLICIES`, plus "lift").
 * @returns {boolean} true iff `omega` is "recompute", "preserve", or "lift".
 */
export function isReversiblePolicy(omega: string): boolean;
/**
 * The state tuple is not (r, K). It is
 *
 *     S = (B, r, K, Σ, T, Sh, L, F)
 *
 * basis · residue tray · winding · property signature · operator topology ·
 * shadow state · lineage · finite support. A4 makes the topology first-class:
 * each lane may carry an independent operator, and homogeneous operation is the
 * special case, not the rule. Carrying only (r, K) is the RNS reduction of this.
 */
export const STATE_FIELDS: string[];
/** A transduction is reversible exactly when Ω preserves the winding. */
/**
 * Ω has four settings — preserve · recompute · project · bound — and only the
 * first two are reversible. `lift` is recompute with a declared boundary touch,
 * so it reverses too. Projection discards a known winding; bound never forms
 * one. Neither can be undone.
 */
export const WINDING_POLICIES: string[];
export namespace SHELL_6 {
    export { B6 as basis };
    export { M6 as M };
    export let anchor: bigint;
}
export namespace SHELL_8 {
    export { B8 as basis };
    export { M8 as M };
    let anchor_1: bigint;
    export { anchor_1 as anchor };
}
import { B6 } from "./basis.js";
import { M6 } from "./basis.js";
import { B8 } from "./basis.js";
import { M8 } from "./basis.js";
