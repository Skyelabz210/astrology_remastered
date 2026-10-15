/**
 * Validate and parse a ledger longitude field. This is the sole entry point
 * by which an ecliptic-longitude value crosses from string/BigInt input into
 * the BigInt-arcsecond regime the rest of `src/core/` assumes.
 * @param {string|bigint} value - a decimal-integer string (digits only, no
 *   sign, no leading zero unless the value is "0") or a BigInt already in range.
 * @returns {bigint} the value as a BigInt in [0, ARCSEC_CIRCLE).
 * @throws {Error} if `value` is neither a bigint nor a string; if a string
 *   value contains anything but decimal digits; or if the numeric value is
 *   negative or ≥ ARCSEC_CIRCLE.
 */
export function parseArcsecString(value: string | bigint): bigint;
/**
 * Validate and parse a generic (non-longitude) ledger integer field — signed,
 * unbounded, decimal only. Unlike `parseArcsecString` this allows negative
 * values and does not range-check against the ring.
 * @param {string|bigint} value - a decimal integer string (optional leading
 *   "-", digits only, no leading zero unless the value is "0"/"-0"-shaped) or
 *   a BigInt.
 * @param {string} fieldName - used only to compose the thrown error message.
 * @returns {bigint} the value as a BigInt.
 * @throws {Error} if `value` is neither a bigint nor a valid decimal integer string.
 */
export function assertIntegerString(value: string | bigint, fieldName: string): bigint;
/** The ecliptic ring: 1,296,000 arcseconds = 360°. All core longitudes are BigInt residues in [0, ARCSEC_CIRCLE). */
export const ARCSEC_CIRCLE: 1296000n;
