/**
 * @param {string} id - a frame id (see `FRAMES`).
 * @returns {Object} the matching `FRAMES` entry.
 * @throws {Error} `"unknown frame: ${id}"` if not found.
 */
export function frame(id: string): any;
/**
 * Rotate a ring position into a frame. A frame change subtracts the offset
 * modulo the ring — a bijection that preserves every difference, hence every
 * aspect. Only attribution (which sign, which nakshatra, which house) moves.
 * BigInt arcsecond regime: x and offset are integer arcseconds in [0, RING).
 * @param {bigint} x - a tropical ring position, in arcseconds.
 * @param {bigint} offset - the frame's offset, in arcseconds.
 * @returns {bigint} x rotated into the frame, in [0, RING).
 */
export function toFrame(x: bigint, offset: bigint): bigint;
/**
 * Rotation is invertible on the ring; this is its exact inverse.
 * @param {bigint} x - a frame-relative ring position, in arcseconds.
 * @param {bigint} offset - the frame's offset, in arcseconds.
 * @returns {bigint} x rotated back to tropical, in [0, RING).
 */
export function fromFrame(x: bigint, offset: bigint): bigint;
/**
 * Separation between two ring positions, as the shorter arc in [0, RING/2].
 * Frame-independent by construction.
 * @param {bigint} a - a ring position, in arcseconds.
 * @param {bigint} b - a ring position, in arcseconds.
 * @returns {bigint} the angular separation, in arcseconds, in [0, RING/2].
 */
export function separation(a: bigint, b: bigint): bigint;
/**
 * @param {string} id - a division id (see `DIVISIONS`).
 * @returns {Object} the matching `DIVISIONS` entry.
 * @throws {Error} `"unknown division: ${id}"` if not found.
 */
export function division(id: string): any;
/**
 * Which cut of a division does x fall in? Exact; null when the cut does not close.
 * @param {bigint} x - a ring position, in arcseconds.
 * @param {bigint} n - the division divisor.
 * @returns {?bigint} the 0-indexed cut number, or null if n does not divide RING.
 */
export function divisionIndex(x: bigint, n: bigint): bigint | null;
/**
 * Sign index 0–11 in a given frame.
 * @param {bigint} x - a tropical ring position, in arcseconds.
 * @param {bigint} offset - the frame's offset, in arcseconds.
 * @returns {bigint} the 0-indexed sign (0 = Aries in the tropical frame).
 */
export function signIndex(x: bigint, offset: bigint): bigint;
/**
 * Exact aspect angles for a family, in arcseconds; non-closing divisors yield null.
 * @param {Object} fam - an `ASPECT_FAMILIES` entry.
 * @returns {Object[]} one `{divisor, angle_arcsec, closes, defect_arcsec, off_ring_primes}` per divisor.
 */
export function familyAngles(fam: any): any[];
/**
 * Whole-sign house 1–12 of x given the ascendant, in a frame. Exact.
 * @param {bigint} x - a tropical ring position, in arcseconds.
 * @param {bigint} asc - the ascendant, in tropical arcseconds.
 * @param {bigint} offset - the frame's offset, in arcseconds.
 * @returns {bigint} the house number, 1–12.
 */
export function wholeSignHouse(x: bigint, asc: bigint, offset: bigint): bigint;
/**
 * Equal house 1–12 measured from a cusp origin. Exact.
 * @param {bigint} x - a ring position, in arcseconds.
 * @param {bigint} origin - the house-1 cusp origin, in arcseconds.
 * @returns {bigint} the house number, 1–12.
 */
export function equalHouse(x: bigint, origin: bigint): bigint;
/**
 * Vehlow: equal houses with the ascendant at the mid-point of house 1.
 * @param {bigint} x - a ring position, in arcseconds.
 * @param {bigint} asc - the ascendant, in arcseconds.
 * @returns {bigint} the house number, 1–12.
 */
export function vehlowHouse(x: bigint, asc: bigint): bigint;
/**
 * Porphyry: trisect each ecliptic quadrant. Houses run in increasing
 * longitude ASC(1) → IC(4) → DSC(7) → MC(10) — a FIXED labeling, not a
 * choice — so the twelve arcs sum to exactly one ring only when IC and MC
 * are actually encountered in that order walking forward from ASC.
 *
 * ASC/DSC and MC/IC are each an antipodal pair, so going around the ring
 * from ASC they interleave in exactly one of two ways: IC before MC (the
 * ordinary case for every non-polar chart — MC leads ASC by more than half
 * the ring) or MC before IC (MC leads by less than half). An earlier
 * version of this function assumed the first case unconditionally; when fed
 * an (asc, mc) pair from the second case (reachable at extreme/polar
 * latitudes, where the semi-arc geometry ASC/MC derive from becomes
 * asymmetric enough to invert this), the four arcs computed under the FIXED
 * asc→ic→dsc→mc labeling stop being the genuine local quadrants — one or
 * more balloons to cover most of the ring — and silently sum to a multiple
 * of the ring (verified: 3x) instead of exactly one ring, corrupting every
 * cusp. Rather than silently emit that corrupted output, this function now
 * validates the precondition and throws — the same "refuse rather than be
 * silently wrong" choice this codebase already makes for the float quadrant
 * systems beyond the polar circle (see project/tools/ephemeris/houses.js's
 * PolarLatitudeError). In the normal producer pipeline this is unreachable
 * in practice: ascMc() itself now throws before producing an asc/mc pair
 * that could violate this precondition (see houses.js) — this check exists
 * because porphyryCusps() is a general pure function callable with any
 * (asc, mc), not only ones that came from ascMc().
 *
 * Exact integer arithmetic — each quadrant arc is divided by 3 and the
 * remainder (0, 1, or 2 arcseconds) is distributed to the earliest houses of
 * that quadrant, so every cusp stays on the arcsecond lattice and the twelve
 * houses partition the ring with no gap and no overlap.
 * @param {bigint} asc - the ascendant, in arcseconds.
 * @param {bigint} mc - the midheaven, in arcseconds.
 * @returns {bigint[]} the twelve house cusps, in arcseconds, house 1 first.
 * @throws {DegenerateAnglesError} if MC does not lead ASC by more than half the ring.
 */
export function porphyryCusps(asc: bigint, mc: bigint): bigint[];
/**
 * @param {{lord: string, years: bigint}[]} table - a time-lord table (`FIRDARIA_YEARS` or `VIMSHOTTARI_YEARS`).
 * @returns {bigint} the sum of every lord's years.
 */
export function totalYears(table: {
    lord: string;
    years: bigint;
}[]): bigint;
/**
 * @param {string} id - a variant id (see `VARIANTS`).
 * @returns {Object} the matching `VARIANTS` entry.
 * @throws {Error} `"unknown variant: ${id}"` if not found.
 */
export function variant(id: string): any;
/**
 * Exact coverage report for one variant: its frame, every division it cuts with
 * closure verdict and defect, its house systems split exact/ledger-gated, and
 * its aspect families with per-divisor closure.
 * @param {string} id - a variant id.
 * @returns {Object} `HCRM_VARIANT_REPORT_V1` — frame, divisions (each with a
 *   `divisionReport`), houses (split exact vs ledger-gated), and aspects
 *   (each with `familyAngles`).
 * @throws {Error} propagated from `variant(id)` if id is unknown.
 */
export function variantReport(id: string): any;
/** @returns {Object[]} `variantReport(id)` for every entry in `VARIANTS`. */
export function allVariantReports(): any[];
export const ARCSEC_PER_DEGREE: 3600n;
export const ARCSEC_PER_SIGN: 108000n;
export const FRAMES: {
    id: string;
    label: string;
    offset_arcsec: bigint;
    status: string;
}[];
export const DIVISIONS: ({
    id: string;
    n: bigint;
    label: string;
    traditions: string[];
    convention?: undefined;
} | {
    id: string;
    n: bigint;
    label: string;
    traditions: string[];
    convention: string;
})[];
export const ASPECT_FAMILIES: {
    id: string;
    short: string;
    label: string;
    divisors: bigint[];
    status: string;
}[];
export const HOUSE_SYSTEMS: {
    id: string;
    label: string;
    exact: boolean;
    status: string;
}[];
/**
 * Thrown by porphyryCusps() when (asc, mc) do not stand in the cyclic
 * relationship quadrant-trisection houses require — see that function's
 * comment.
 */
export class DegenerateAnglesError extends Error {
    constructor(asc: any, mc: any);
    asc: any;
    mc: any;
}
export const FIRDARIA_YEARS: {
    lord: string;
    years: bigint;
}[];
export const VIMSHOTTARI_YEARS: {
    lord: string;
    years: bigint;
}[];
export const VARIANTS: ({
    id: string;
    name: string;
    tradition: string;
    frame: string;
    houses: string[];
    aspects: string[];
    divisions: string[];
    note: string;
    timeLords?: undefined;
} | {
    id: string;
    name: string;
    tradition: string;
    frame: string;
    houses: string[];
    aspects: string[];
    divisions: string[];
    timeLords: string;
    note: string;
})[];
