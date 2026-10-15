/**
 * The 2×2 cross-classification of the Safe Basis. Every cell is occupied.
 * @returns {{shadow_closing: string[], shadow_off_ring: string[],
 *   nonshadow_closing: string[], nonshadow_off_ring: string[]}} each cell as
 *   an array of stringified basis primes.
 */
export function crossClassify(): {
    shadow_closing: string[];
    shadow_off_ring: string[];
    nonshadow_closing: string[];
    nonshadow_off_ring: string[];
};
/**
 * @param {string} id - an event class id (see `CLASS_IDS`).
 * @returns {Object} the matching `EVENT_CLASSES` entry.
 * @throws {Error} `"unknown event class: ${id}"` if not found.
 */
export function eventClass(id: string): any;
/**
 * @param {string} id - an event class id.
 * @returns {string} its axis ("shadow"|"boundary"|"saturation"|"none").
 */
export function axisOf(id: string): string;
/** @returns {string[]} every event-class id with body scope. */
export function bodyClassVocabulary(): string[];
/** @returns {string[]} every event-class id with edge scope. */
export function edgeClassVocabulary(): string[];
/**
 * The residue tray on the off-ring lanes.
 * @param {bigint} x
 * @returns {Object<string, string>} `{ mod_<p>: "<x mod p>", ... }` for each `OFF_RING_LANES` prime.
 */
export function laneResidues(x: bigint): {
    [x: string]: string;
};
/**
 * The residue tray on the shadow spine — including lane 3, which the ring absorbs.
 * @param {bigint} x
 * @returns {Object<string, string>} `{ mod_<p>: "<x mod p>", ... }` for each `SPINE` prime.
 */
export function shadowResidues(x: bigint): {
    [x: string]: string;
};
/**
 * Body-level events. Order is significant and mirrored exactly by the census
 * classifier in test/shadow-spine.test.js.
 * @param {bigint} x - the ring position (arcseconds) to classify.
 * @param {?string} [label] - an optional body label attached to each event.
 * @returns {Object[]} event records `{eventClass, axis, trigger, scope, body, prime, value, proofStatus}`.
 */
export function bodyEvents(x: bigint, label?: string | null): any[];
/**
 * Edge-level events — residue preservation across an aspect edge.
 * @param {bigint} x - first ring position.
 * @param {bigint} y - second ring position.
 * @param {?string} [label] - an optional edge label attached to each event.
 * @returns {Object[]} event records `{eventClass, axis, trigger, scope, edge, prime, value, proofStatus}`.
 */
export function edgeEvents(x: bigint, y: bigint, label?: string | null): any[];
/**
 * Why a division of the zodiac fails to close — the CLOSURE axis only.
 * Says nothing about shadow; use divisionShadow for that.
 * @param {bigint} n - the division divisor.
 * @returns {Object} axis:"closure", closes, defect_arcsec, off_ring_lanes,
 *   off_ring_primes, alien_factor (a non-basis prime factor, if any).
 */
export function divisionClosure(n: bigint): any;
/**
 * The SHADOW axis for a division: which inert primes it carries, its q, δ, ω,
 * ρ and stability band. This is the classifier the framework actually defines,
 * and it is independent of whether the division closes.
 * @param {bigint} n - the division divisor.
 * @returns {Object} axis:"shadow", omega, q, delta, rho, band, band_label, anchored, escalated.
 */
export function divisionShadow(n: bigint): any;
/**
 * Both axes at once, kept as separate objects so they cannot be merged.
 * @param {bigint} n - the division divisor.
 * @returns {{divisor: string, closure: Object, shadow: Object}}
 */
export function divisionProfile(n: bigint): {
    divisor: string;
    closure: any;
    shadow: any;
};
/**
 * Closed-form census of body events over the ring. The exhaustive sweep must
 * reproduce these exactly — arithmetic checking arithmetic, no magic numbers.
 * @returns {Object<string, string>} event-class id → decimal-string count over the full ring.
 */
export function censusClosedForm(): {
    [x: string]: string;
};
/**
 * The classical attribution of a ring position. Deliberately independent of
 * everything above: the spine functions never call this, and this never calls
 * them. That separation is what the non-interference certificate checks.
 * @param {bigint} x - the ring position in arcseconds.
 * @param {bigint} offset - a frame offset in arcseconds (e.g. an ayanamsa).
 * @returns {{sign: string, decan: string, dwad: string, degree_in_sign: string, arcsec_in_degree: string}}
 */
export function classicalAttribution(x: bigint, offset: bigint): {
    sign: string;
    decan: string;
    dwad: string;
    degree_in_sign: string;
    arcsec_in_degree: string;
};
export const SPINE: {
    prime: bigint;
    id: string;
    role: any;
    anchor: boolean;
    escalation: boolean;
    closes_ring: boolean;
    ring_defect: bigint;
}[];
/**
 * The lanes that block exact closure — the closure axis, named as such.
 * @type {{prime: bigint, id: string, role: string, shadow: boolean}[]}
 */
export const OFF_RING_LANES: {
    prime: bigint;
    id: string;
    role: string;
    shadow: boolean;
}[];
export const EVENT_CLASSES: {
    id: string;
    axis: string;
    scope: string;
    prime: bigint;
    trigger: string;
}[];
export const CLASS_IDS: string[];
import { SHADOW_SPINE } from "./safe-basis.js";
import { SHADOW_ANCHOR } from "./safe-basis.js";
import { SHADOW_ESCALATION } from "./safe-basis.js";
import { isShadowPrime } from "./safe-basis.js";
import { gaussianClass } from "./safe-basis.js";
import { sumOfTwoSquares } from "./safe-basis.js";
import { OFF_RING_PRIMES } from "./ring.js";
export { SHADOW_SPINE, SHADOW_ANCHOR, SHADOW_ESCALATION, isShadowPrime, gaussianClass, sumOfTwoSquares, OFF_RING_PRIMES };
