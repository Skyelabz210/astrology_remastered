/**
 * Centred residue: the representative of x mod p in (−p/2, p/2].
 * @param {bigint} x
 * @param {bigint} p - the lane modulus.
 * @returns {bigint} the centred residue.
 */
export function centeredResidue(x: bigint, p: bigint): bigint;
/**
 * The K-Elimination winding under the centred convention: w = (x − r)/p.
 * @param {bigint} x
 * @param {bigint} p - the lane modulus.
 * @returns {bigint} the signed winding (may be negative).
 */
export function signedWinding(x: bigint, p: bigint): bigint;
/**
 * x = r + p·w, exactly, for every x — the identity the pair must satisfy.
 * @param {bigint} x
 * @param {bigint} p - the lane modulus.
 * @returns {{r: bigint, w: bigint, p: bigint, exact: boolean}} the centred
 *   residue, the signed winding, the modulus, and a self-check flag.
 */
export function carrySplit(x: bigint, p: bigint): {
    r: bigint;
    w: bigint;
    p: bigint;
    exact: boolean;
};
/**
 * The unsigned winding, for contrast: ⌊x/M⌋ with r ∈ [0,M).
 * @param {bigint} x
 * @param {bigint} p - the lane modulus.
 * @returns {bigint} the non-negative winding.
 */
export function unsignedWinding(x: bigint, p: bigint): bigint;
/**
 * v_A = (r − K) mod A, for any anchor A with M ≡ −1 (mod A).
 * K enters with a sign; this is what makes the anchor a carry readout and not
 * merely another residue.
 * @param {bigint} r - the phase.
 * @param {bigint} K - the winding.
 * @param {bigint} A - the anchor modulus.
 * @returns {bigint} the anchor readout.
 */
export function signedAnchorResidue(r: bigint, K: bigint, A: bigint): bigint;
/**
 * Whether an anchor is in the signed regime: M ≡ −1 (mod A).
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus.
 * @returns {boolean}
 */
export function isSignedAnchor(M: bigint, A: bigint): boolean;
/**
 * The closed-shell descent. At r = 0 the anchor reads (−K) mod A, so successive
 * closed shells walk the anchor DOWNWARD one step at a time. Returns the readout
 * for the first `count` closed shells.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the anchor modulus (typically M+1).
 * @param {bigint} count - how many closed shells (K = 0..count-1) to report.
 * @returns {{N: bigint, K: bigint, r: bigint, v: bigint, predicted: bigint}[]}
 */
export function closedShellDescent(M: bigint, A: bigint, count: bigint): {
    N: bigint;
    K: bigint;
    r: bigint;
    v: bigint;
    predicted: bigint;
}[];
/**
 * Reduce a lane value and keep BOTH halves. The residue is what a lane
 * normally reports; `carry` is the quotient it normally discards.
 * @param {bigint} value
 * @param {bigint} p - the lane modulus.
 * @returns {{residue: bigint, carry: bigint, lane: bigint}}
 */
export function emitWithCarry(value: bigint, p: bigint): {
    residue: bigint;
    carry: bigint;
    lane: bigint;
};
/**
 * The shadow of a lane operation: the discarded quotient alone.
 * @param {bigint} value
 * @param {bigint} p - the lane modulus.
 * @returns {bigint} ⌊value/p⌋ computed via the unsigned residue.
 */
export function laneShadow(value: bigint, p: bigint): bigint;
/**
 * C(field, p) = Σ w_p(x)² over the field — the total winding energy.
 * Non-negative and integer-valued, and zero exactly when every value is a pure
 * centred residue (no value has wound past its shell).
 * @param {Iterable<bigint>} field - the values to sum over.
 * @param {bigint} p - the lane modulus.
 * @returns {bigint} the total winding energy, ≥ 0.
 */
export function carryFunctional(field: Iterable<bigint>, p: bigint): bigint;
/**
 * C is zero iff nothing wound — the certificate that a field is residue-pure.
 * @param {Iterable<bigint>} field
 * @param {bigint} p - the lane modulus.
 * @returns {boolean}
 */
export function isResiduePure(field: Iterable<bigint>, p: bigint): boolean;
/**
 * The image of r ↦ r² mod p. Squaring is 2-to-1 on nonzero residues, so the
 * image covers (p+1)/2 of p values — non-uniform even for uniform r.
 * @param {bigint} p - the lane modulus.
 * @returns {{p: bigint, distinct: bigint, of: bigint, expected: bigint}}
 */
export function squareImage(p: bigint): {
    p: bigint;
    distinct: bigint;
    of: bigint;
    expected: bigint;
};
/**
 * The shadow law of squaring: how often each discarded quotient ⌊r²/p⌋ occurs.
 * @param {bigint} p - the lane modulus.
 * @returns {Map<bigint, bigint>} quotient → occurrence count.
 */
export function squareShadowLaw(p: bigint): Map<bigint, bigint>;
/**
 * An additive shift absorbs into uniformity (Lemma 3) and its emission is flat;
 * squaring does not. Returns whether each lane's emission law is uniform.
 * @param {bigint} p - the lane modulus.
 * @param {function(bigint): bigint} op - the lane operation to test, e.g. `(r) => r + 1n`.
 * @returns {{uniform: boolean, distinct: bigint}}
 */
export function emissionIsUniform(p: bigint, op: (arg0: bigint) => bigint): {
    uniform: boolean;
    distinct: bigint;
};
