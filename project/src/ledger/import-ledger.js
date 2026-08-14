// src/ledger/import-ledger.js — validate + ingest exact integer ledgers. (P2)
// Rejects synthetic/decimal input from the core path. BigInt only.

import { parseArcsecString } from "../core/validators.js";

const REQUIRED = ["ledger_version", "event_id", "body", "longitude_arcsec", "source", "certificate"];
const STATUSES = ["SYNTHETIC_DEMO", "IMPORTED_INTEGER_LEDGER", "CERTIFIED_EXACT_LEDGER"];

/**
 * Structural validation of one ledger entry against the schema shape (see
 * `ephemeris-ledger-schema.json`) — required top-level fields present and
 * correctly typed, a matching `ledger_version`, a complete `source` object,
 * a `certificate` with a recognized `status` and a string `notes` (both
 * schema-required — see `certificate.required` in the schema), and a
 * `longitude_arcsec` that parses as an integer arcsecond in [0, 1296000)
 * (delegated to `parseArcsecString`, so the BigInt-arcsecond regime starts
 * being enforced right here). This does NOT gate on certificate status —
 * `SYNTHETIC_DEMO` entries validate fine; only `admitForCore` rejects those.
 * @param {Object} entry - a candidate ledger entry (see the schema for the
 *   full field list: ledger_version, event_id, body, longitude_arcsec,
 *   house_system?, source, certificate, meta?).
 * @returns {true} on success.
 * @throws {Error} `"ledger entry missing ${k}"` if a required top-level key
 *   is absent; `"bad ledger_version"` if it isn't
 *   "hcrm-ephemeris-ledger-v1"; `"ledger entry event_id must be a string"` /
 *   `"ledger entry body must be a string"` if either isn't a string;
 *   `"ledger entry source incomplete"` if `source.kind`/`source.name`/
 *   `source.checksum` aren't all present AND strings; `"ledger entry
 *   certificate.status invalid"` if `certificate.status` isn't one of
 *   SYNTHETIC_DEMO/IMPORTED_INTEGER_LEDGER/CERTIFIED_EXACT_LEDGER;
 *   `"ledger entry certificate.notes must be a string"` if `notes` is
 *   absent or not a string; or any error thrown by `parseArcsecString` on
 *   `longitude_arcsec`.
 */
export function validateLedgerEntry(entry) {
  for (const k of REQUIRED) if (!(k in entry)) throw new Error(`ledger entry missing ${k}`);
  if (entry.ledger_version !== "hcrm-ephemeris-ledger-v1") throw new Error("bad ledger_version");
  if (typeof entry.event_id !== "string") throw new Error("ledger entry event_id must be a string");
  if (typeof entry.body !== "string") throw new Error("ledger entry body must be a string");
  if (
    !entry.source ||
    typeof entry.source.kind !== "string" ||
    typeof entry.source.name !== "string" ||
    typeof entry.source.checksum !== "string"
  )
    throw new Error("ledger entry source incomplete");
  if (!entry.certificate || !STATUSES.includes(entry.certificate.status))
    throw new Error("ledger entry certificate.status invalid");
  if (typeof entry.certificate.notes !== "string")
    throw new Error("ledger entry certificate.notes must be a string");
  parseArcsecString(entry.longitude_arcsec);     // throws on non-integer / out of ring
  return true;
}

/**
 * The sole gate by which a ledger entry may be treated as trustworthy input
 * to `src/core/`. Core admits only integer-certified ledgers, never synthetic
 * demo data — this is what enforces that at the boundary. Runs
 * `validateLedgerEntry` first (so every structural check above applies),
 * then additionally rejects `SYNTHETIC_DEMO`-status entries: only
 * `IMPORTED_INTEGER_LEDGER` and `CERTIFIED_EXACT_LEDGER` pass.
 * @param {Object} entry - a candidate ledger entry.
 * @returns {Object} `entry`, unchanged, on success.
 * @throws {Error} anything `validateLedgerEntry` throws, plus
 *   `"SYNTHETIC_DEMO is not admissible to the HCRM core"` when
 *   `entry.certificate.status === "SYNTHETIC_DEMO"`.
 */
export function admitForCore(entry) {
  validateLedgerEntry(entry);
  if (entry.certificate.status === "SYNTHETIC_DEMO")
    throw new Error("SYNTHETIC_DEMO is not admissible to the HCRM core");
  return entry;
}

/**
 * Validate a whole ledger (an array of entries) in one call. Does not filter
 * by certificate status — use `admitForCore` per-entry for that.
 * @param {Object[]} entries - the candidate ledger entries.
 * @returns {Object[]} `entries`, unchanged, if every one validates.
 * @throws {Error} `"ledger must be an array"` if `entries` is not an array;
 *   otherwise whatever `validateLedgerEntry` throws on the first invalid entry.
 */
export function importLedger(entries) {
  if (!Array.isArray(entries)) throw new Error("ledger must be an array");
  entries.forEach(validateLedgerEntry);
  return entries;
}
