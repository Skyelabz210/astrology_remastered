/**
 * r — the shell residue, over {2,3,5,7,13,17,19}.
 * @param {bigint} x - a longitude (BigInt arcseconds) or any integer.
 * @returns {bigint} x mod M_SHELL.
 */
export function parkedShellResidue(x: bigint): bigint;
/**
 * s — the anchor residue, read straight off the parked lane.
 * @param {bigint} x
 * @returns {bigint} x mod 11.
 */
export function parkResidue(x: bigint): bigint;
/**
 * K-Elimination on the parked split. Returns K only; the number is the pair
 * (r, K) and nothing here fuses them.
 * @param {bigint} r - shell residue, x mod M_SHELL.
 * @param {bigint} s - parked-lane residue, x mod 11.
 * @returns {bigint} K mod 11.
 */
export function recoverShellWinding(r: bigint, s: bigint): bigint;
/**
 * The same, driven from the integer — for encoding and for tests.
 * @param {bigint} x
 * @returns {bigint} K mod 11, as `recoverShellWinding`.
 */
export function recoverShellWindingFrom(x: bigint): bigint;
/**
 * The yield: the identity pair, uncoupled.
 * @param {bigint} x
 * @returns {{r: bigint, K: bigint, shell: bigint, anchor: bigint}}
 */
export function shellIdentity(x: bigint): {
    r: bigint;
    K: bigint;
    shell: bigint;
    anchor: bigint;
};
/**
 * @param {bigint} x
 * @returns {bigint} ⌊x / M_SHELL⌋ — the true (non-reduced) winding, for verification.
 */
export function actualShellWinding(x: bigint): bigint;
/**
 * 11^e — the parked lane carried at depth e.
 * @param {bigint} levels - the depth e.
 * @returns {bigint} 11^levels.
 */
export function parkPower(levels: bigint): bigint;
/**
 * Derive the winding by an e-fold K-Elimination lift on the parked lane.
 * `levels = 2n` is the double lift. Nothing is carried: r and s are read off
 * the tray, and K falls out of them.
 *
 *   r  = x mod M_SHELL   — from the shell lanes
 *   s  = x mod 11^levels — from the parked lane, carried at that depth
 *
 * Exact while K < 11^levels. Returns the base-11 digits alongside K so the
 * lift is auditable level by level.
 * @param {bigint} r - shell residue, x mod M_SHELL.
 * @param {bigint} s - parked-lane residue, x mod 11^levels.
 * @param {bigint} [levels=2n] - the lift depth (2 = the "double lift").
 * @returns {{K: bigint, digits: bigint[], phases: bigint[], levels: bigint,
 *   depth: bigint, shell: bigint, anchor: bigint, corridor: bigint}}
 * @throws {Error} "the lift needs at least one level" if levels < 1.
 */
export function liftWinding(r: bigint, s: bigint, levels?: bigint): {
    K: bigint;
    digits: bigint[];
    phases: bigint[];
    levels: bigint;
    depth: bigint;
    shell: bigint;
    anchor: bigint;
    corridor: bigint;
};
/**
 * The double lift, named — two eliminations, K < 121.
 * @param {bigint} r - shell residue.
 * @param {bigint} s - parked-lane residue mod 121.
 * @returns {Object} `liftWinding(r, s, 2n)` result.
 */
export function doubleLiftWinding(r: bigint, s: bigint): any;
/**
 * Derive the winding straight from the tray at the given depth. The parked lane
 * is read at 11^levels; every other lane is untouched.
 * @param {bigint} x - the source integer.
 * @param {bigint} [levels=2n] - the lift depth.
 * @returns {Object} `liftWinding(...)` result.
 */
export function windingFromTray(x: bigint, levels?: bigint): any;
/**
 * The register carried by the tray alone. There is no K field — `winding` is a
 * getter-shaped derivation, recomputed from r and s every time it is asked for.
 * @param {bigint} x - the source integer.
 * @param {bigint} [levels=2n] - the parked-lane depth to read s at.
 * @returns {{kind: "PARKED_TRAY_V1", shell_lanes: string[], r: string,
 *   parked_lane: string, parked_depth: string, s: string,
 *   derive: function(): Object, carries_winding: false}}
 */
export function trayRegister(x: bigint, levels?: bigint): {
    kind: "PARKED_TRAY_V1";
    shell_lanes: string[];
    r: string;
    parked_lane: string;
    parked_depth: string;
    s: string;
    derive: () => any;
    carries_winding: false;
};
/**
 * Self-check: does the parked-split K-Elimination recovery agree with the
 * directly computed (unbounded) winding?
 * @param {bigint} x
 * @returns {{split: "parked", shell: string, anchor: string, recovered: string, actual: string, ok: boolean}}
 */
export function verifyShellWinding(x: bigint): {
    split: "parked";
    shell: string;
    anchor: string;
    recovered: string;
    actual: string;
    ok: boolean;
};
/** @param {bigint} x @returns {bigint} x mod M6. */
export function shellResidue(x: bigint): bigint;
/** @param {bigint} x @returns {bigint} x mod GEAR_PRODUCT (323). */
export function gearResidue(x: bigint): bigint;
/**
 * K-Elimination on the legacy gear split.
 * @param {bigint} x
 * @returns {bigint} K mod 323.
 */
export function recoverShellWindingFromGear(x: bigint): bigint;
/** @param {bigint} x @returns {bigint} ⌊x / M6⌋. */
export function actualLegacyWinding(x: bigint): bigint;
/**
 * Self-check for the legacy gear-split recovery.
 * @param {bigint} x
 * @returns {{split: "gear (legacy)", shell: string, anchor: string, recovered: string, actual: string, ok: boolean}}
 */
export function verifyLegacyShellWinding(x: bigint): {
    split: "gear (legacy)";
    shell: string;
    anchor: string;
    recovered: string;
    actual: string;
    ok: boolean;
};
/** The canonical internal anchor: the parked lane. */
export const SHELL_ANCHOR: 11n;
/** Legacy shell modulus (= M6, 30,030). */
export const LEGACY_SHELL: 30030n;
/** Legacy anchor modulus (= GEAR_PRODUCT, 323). */
export const LEGACY_ANCHOR: 323n;
