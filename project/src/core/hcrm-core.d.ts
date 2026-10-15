/**
 * Build the full HCRM register for one ledger entry — every residue lane,
 * both the canonical (parked) and legacy (gear) shell splits, and their
 * K-Elimination winding certificates. Pure BigInt arithmetic throughout;
 * `entry.longitude_arcsec` is the sole numeric input and is expected as a
 * decimal-integer string or BigInt (see `parseArcsecString` in validators.js)
 * — an integer arcsecond in [0, 1296000), never a float degree.
 * @param {{longitude_arcsec: (string|bigint), body?: string, source?: *, certificate?: *}} entry
 *   - a schema-conformant ledger entry (see project/src/ledger/ephemeris-ledger-schema.json).
 *   `body` and `source`/`certificate` are passed through verbatim into the result.
 * @returns {Object} `HCRM_REGISTER_V2` — basis constants, residue trays
 *   (B8/shell/B6/gear), the canonical parked-shell identity pair (r, K) with
 *   its double K-Elimination lift, the legacy gear-shell identity pair, the
 *   gear class of the value, and the passed-through source/certificate.
 * @throws {Error} if `entry.longitude_arcsec` is not a valid integer-string in
 *   range (via `parseArcsecString`), or if the internal winding-recovery
 *   self-checks (parked-shell / legacy-shell / tray-lift) disagree with the
 *   directly computed windings — an implementation-fault signal, not a normal
 *   domain error.
 */
export function computeHcrmRegister(entry: {
    longitude_arcsec: (string | bigint);
    body?: string;
    source?: any;
    certificate?: any;
}): any;
