/**
 * Does the residue tray over `basis` determine x mod A?
 * Yes iff A | M. Otherwise x and x+M share the tray and differ mod A.
 * @param {bigint[]} basis - the lane moduli.
 * @param {bigint} A - the candidate anchor modulus.
 * @returns {boolean}
 */
export function trayDeterminesAnchor(basis: bigint[], A: bigint): boolean;
/**
 * A witness that an external anchor is undetermined: two values sharing the
 * whole tray whose anchor residues differ. Returns null for internal anchors.
 * @param {bigint[]} basis - the lane moduli.
 * @param {bigint} A - the candidate anchor modulus.
 * @param {bigint} [x=123456n] - the sample value to witness with.
 * @returns {?{x: string, y: string, tray_identical: boolean, anchor_x: string, anchor_y: string, differ_by: string}}
 *   null when A is internal (tray-determined); otherwise the witnessing pair
 *   x, y = x+M and their (differing) anchor residues.
 */
export function undeterminedWitness(basis: bigint[], A: bigint, x?: bigint): {
    x: string;
    y: string;
    tray_identical: boolean;
    anchor_x: string;
    anchor_y: string;
    differ_by: string;
} | null;
/**
 * The lanes of `basis` whose product is A, or null when A is not internal.
 * @param {bigint[]} basis - the lane moduli.
 * @param {bigint} A - the candidate anchor modulus.
 * @returns {?bigint[]} the sub-basis multiplying to A, or null if none does.
 */
export function anchorLanes(basis: bigint[], A: bigint): bigint[] | null;
/**
 * An anchor is internal when it is a sub-product of the fixed basis.
 * @param {bigint[]} basis - the lane moduli.
 * @param {bigint} A - the candidate anchor modulus.
 * @returns {boolean}
 */
export function isInternalAnchor(basis: bigint[], A: bigint): boolean;
/**
 * Which lanes must be read to pin x mod A? For an internal anchor this is
 * exactly its own lane set; for an external one the answer is "all of them,
 * and it is still not determined".
 * @param {bigint[]} basis - the lane moduli.
 * @param {bigint} A - the candidate anchor modulus.
 * @returns {bigint[]} the lanes whose value affects x mod A.
 */
export function laneDependency(basis: bigint[], A: bigint): bigint[];
/**
 * The i.i.d. verdict for a (shell, anchor) split of one fixed basis.
 *
 * Admissible when: the basis is unbroken, both parts are internal, the two lane
 * sets are disjoint, and the anchor is determined by the tray. Then each lane is
 * still produced by its own reduction and the anchor reads a disjoint subset —
 * no lane depends on another, so i.i.d. survives.
 * @param {bigint[]} basis - the fixed basis both splits are drawn from.
 * @param {bigint[]} shellLanes - the lanes assigned to the shell.
 * @param {bigint[]} anchorLanes_ - the lanes assigned to the anchor.
 * @returns {Object} `ANCHOR_ADMISSIBILITY_V1` — internal/disjoint/tray-determines-anchor/
 *   coprime/adjacent flags, plus `iid_preserved` and `admissible` verdicts and
 *   a `recovery` mechanism label.
 */
export function anchorReport(basis: bigint[], shellLanes: bigint[], anchorLanes_: bigint[]): any;
/**
 * Prime-power lanes of n — the coarsest pairwise-coprime factorisation.
 * @param {bigint} n - the value to factor.
 * @returns {bigint[]} [p1^e1, p2^e2, ...] for n = p1^e1 * p2^e2 * ...
 */
export function primePowerLanes(n: bigint): bigint[];
/**
 * The safe basis realising the star pair (6n(n−1), S_n) internally, so the
 * adjacency collapse runs without ever leaving residue space.
 * @param {bigint} n - the star index (S_n = 6n(n−1)+1).
 * @returns {?{n: string, basis: bigint[], shell_lanes: bigint[], anchor_lanes: bigint[],
 *   shell: bigint, anchor: bigint, report: Object}} null when the shell would be < 2
 *   (n ≤ 1); otherwise the internal-adjacency configuration and its `anchorReport`.
 */
export function starLiftBasis(n: bigint): {
    n: string;
    basis: bigint[];
    shell_lanes: bigint[];
    anchor_lanes: bigint[];
    shell: bigint;
    anchor: bigint;
    report: any;
} | null;
/**
 * Internal adjacency recovery: K ≡ r − s (mod M+1), admissible only when the
 * anchor is an internal sub-product. Throws otherwise rather than silently
 * performing an operation the tray cannot support.
 * @param {bigint[]} basis - the fixed basis.
 * @param {bigint[]} shellLanes - the shell's lane set.
 * @param {bigint[]} anchorLanes_ - the anchor's lane set.
 * @param {bigint} r - the shell residue.
 * @param {bigint} s - the anchor residue.
 * @returns {bigint} K = (r − s) mod anchor.
 * @throws {Error} "anchor not admissible: ..." if `anchorReport` is not admissible;
 *   "anchor is not adjacent to the shell" if it is admissible but not adjacent (A ≠ M+1).
 */
export function internalAdjacencyRecover(basis: bigint[], shellLanes: bigint[], anchorLanes_: bigint[], r: bigint, s: bigint): bigint;
/**
 * The parked lane carried at power e. e = 1 is the bare lane.
 * @param {bigint} e - the power to carry lane 11 at.
 * @returns {bigint} 11^e.
 */
export function shadowAnchor(e: bigint): bigint;
/**
 * Lane occupancy for a basis: which lanes carry value (shell) and which are
 * parked (anchor). A lane may not be both.
 * @param {bigint[]} basis - the full lane set.
 * @param {bigint[]} parked - the sublanes to park as the anchor.
 * @param {bigint} [power=1n] - the power to carry each parked lane at.
 * @returns {Object} `LANE_OCCUPANCY_V1` — shell/anchor moduli, coprimality,
 *   whether the parked lanes are actually in the basis, and `admissible`.
 */
export function parkingReport(basis: bigint[], parked: bigint[], power?: bigint): any;
/**
 * K-Elimination with the parked lane as anchor. Plain coprime form — no Hensel
 * division, because the shell does not contain the parked prime.
 * @param {bigint} r - shell residue, x mod M.
 * @param {bigint} s - anchor residue, x mod A.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the parked anchor modulus.
 * @returns {bigint} K mod A.
 * @throws {Error} if M is not coprime to A (the anchor prime was not actually parked out of the shell).
 */
export function parkedRecover(r: bigint, s: bigint, M: bigint, A: bigint): bigint;
/**
 * The same, driven from the integer.
 * @param {bigint} x - the source integer.
 * @param {bigint} M - the shell modulus.
 * @param {bigint} A - the parked anchor modulus.
 * @returns {bigint} K mod A, as `parkedRecover`.
 */
export function parkedRecoverFrom(x: bigint, M: bigint, A: bigint): bigint;
/** The shadow lane, parked: in the basis, excluded from the shell. */
export const PARKED_LANE: 11n;
/** Shell lanes of SafeS8 once lane 11 is parked. */
export const SHELL_LANES_PARKED: bigint[];
/** ∏ SHELL_LANES_PARKED = M8 / 11 = 881,790. */
export const SHELL_PARKED: 881790n;
