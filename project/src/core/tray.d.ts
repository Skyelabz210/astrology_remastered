/**
 * 100% saturation: the CRT map is a bijection onto ℤ/Mℤ with no slack. The
 * product of the lane sizes equals the span exactly.
 * @param {bigint[]} basis - candidate lanes (unit lane, if present, is excluded from the product).
 * @returns {{lanes: string[], states: bigint, span: bigint, bijective: boolean,
 *   saturated: boolean, slack: bigint}}
 */
export function saturationOf(basis: bigint[]): {
    lanes: string[];
    states: bigint;
    span: bigint;
    bijective: boolean;
    saturated: boolean;
    slack: bigint;
};
/**
 * The first tray. This is the one that must be unbroken and saturated; it is
 * what every downstream tray inherits from.
 * @param {bigint[]} basis - the candidate first-tray basis.
 * @returns {{kind: "FIRST_TRAY_V1", basis: string[], M: bigint, saturated: boolean,
 *   slack: string, unbroken: boolean, carries_phase: boolean, admissible: boolean}}
 */
export function firstTray(basis: bigint[]): {
    kind: "FIRST_TRAY_V1";
    basis: string[];
    M: bigint;
    saturated: boolean;
    slack: string;
    unbroken: boolean;
    carries_phase: boolean;
    admissible: boolean;
};
/**
 * The lock between trays: the phase rides on lane 11, the origin on lane 1.
 * The origin is shared by every fixture (gcd(1, n) = 1 always) and carries zero
 * bits, so it fixes the zero but cannot relate two windings by itself. Lane 11
 * is what carries the phase.
 * @param {bigint[]} first - the first tray's lane set.
 * @param {bigint[]} second - the second tray's lane set.
 * @returns {{origin_shared: true, origin_bits: bigint, phase_lane: bigint,
 *   phase_shared: boolean, locked: boolean, strength: bigint}}
 */
export function phaseLockBetween(first: bigint[], second: bigint[]): {
    origin_shared: true;
    origin_bits: bigint;
    phase_lane: bigint;
    phase_shared: boolean;
    locked: boolean;
    strength: bigint;
};
/**
 * Φ holds the lock exactly when it fixes the phase lane: Φ(x) ≡ x (mod 11).
 * @param {function(bigint): bigint} phi - the candidate value map.
 * @param {bigint[]} sample - sample points to test Φ against.
 * @returns {boolean} true iff Φ fixes lane 11 on every sample point.
 */
export function preservesLock(phi: (arg0: bigint) => bigint, sample: bigint[]): boolean;
/**
 * What the second tray inherits. It does NOT have to be a safe basis, be
 * pairwise coprime, or be prime — those properties are held by the first tray
 * and reach the second through the lock.
 * @param {bigint[]} firstBasis - the unbroken, saturated source basis.
 * @param {bigint[]} secondModuli - the (possibly arbitrary-composite) target moduli.
 * @returns {Object} `TRAY_INHERITANCE_V1` — source_unbroken/source_saturated,
 *   the `lock`, target's own (non-gating) properties, and `admissible`.
 */
export function inheritance(firstBasis: bigint[], secondModuli: bigint[]): any;
/**
 * Read an arbitrary set of moduli off a value whose identity is held by the
 * first tray. Every lane is exact — x mod q is exact for EVERY q — and the
 * lanes need not be independent. Redundancy is fine; inconsistency is
 * impossible, because all lanes read one value.
 *
 * The second tray is not self-standing: it carries the inherited identity, and
 * that is what makes it a tray rather than a bag of readings.
 * @param {bigint} x - the value whose identity is held by the first tray.
 * @param {bigint[]} moduli - the second tray's (arbitrary) moduli.
 * @param {bigint[]} firstBasis - the source basis.
 * @returns {?Object} `DERIVED_TRAY_V1`, or null if `inheritance(...)` is not admissible.
 */
export function deriveTray(x: bigint, moduli: bigint[], firstBasis: bigint[]): any | null;
/**
 * Redundant lanes agree, because they are readings of one value, not estimates.
 * @param {bigint} x - the value.
 * @param {bigint[]} moduli - the (possibly non-coprime) lane moduli.
 * @returns {boolean} true iff every pair of lanes agrees on their overlap.
 */
export function lanesConsistent(x: bigint, moduli: bigint[]): boolean;
/**
 * The arrow of time is instantiated by the pair: a saturated unbroken first
 * tray, and the 36/37 star lift giving the tower arbitrary depth. Monotone
 * winding on unbounded depth is what makes the natal state unreachable.
 * @param {bigint[]} basis - the first-tray basis.
 * @param {bigint} [shell=36n] - the star shell (default the 36/37 lift).
 * @param {bigint} [anchor=37n] - the star anchor.
 * @returns {{kind: "ARROW_V1", saturated: boolean, star_shell: bigint,
 *   star_anchor: bigint, adjacent: boolean, star_number: boolean,
 *   depth_unbounded: true, instantiated: boolean}}
 */
export function arrowOfTime(basis: bigint[], shell?: bigint, anchor?: bigint): {
    kind: "ARROW_V1";
    saturated: boolean;
    star_shell: bigint;
    star_anchor: bigint;
    adjacent: boolean;
    star_number: boolean;
    depth_unbounded: true;
    instantiated: boolean;
};
/** The phase carrier: the shadow prime, on lane 5. */
export const PHASE_LANE: 11n;
/** The origin carrier: the recommissioned unit, lane 0, zero bits, always shared. */
export const ORIGIN_LANE: 1n;
