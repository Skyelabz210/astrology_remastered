// src/ledger/import-ledger.js — validate + ingest exact integer ledgers. (P2)
// Rejects synthetic/decimal input from the core path. BigInt only.

import { parseArcsecString } from "../core/validators.js";

const REQUIRED = ["ledger_version", "event_id", "body", "longitude_arcsec", "source", "certificate"];
const STATUSES = ["SYNTHETIC_DEMO", "IMPORTED_INTEGER_LEDGER", "CERTIFIED_EXACT_LEDGER"];

export function validateLedgerEntry(entry) {
  for (const k of REQUIRED) if (!(k in entry)) throw new Error(`ledger entry missing ${k}`);
  if (entry.ledger_version !== "hcrm-ephemeris-ledger-v1") throw new Error("bad ledger_version");
  if (!entry.source || !entry.source.kind || !entry.source.name || !("checksum" in entry.source))
    throw new Error("ledger entry source incomplete");
  if (!entry.certificate || !STATUSES.includes(entry.certificate.status))
    throw new Error("ledger entry certificate.status invalid");
  parseArcsecString(entry.longitude_arcsec);     // throws on non-integer / out of ring
  return true;
}

// Core admits only integer-certified ledgers, never synthetic demo data.
export function admitForCore(entry) {
  validateLedgerEntry(entry);
  if (entry.certificate.status === "SYNTHETIC_DEMO")
    throw new Error("SYNTHETIC_DEMO is not admissible to the HCRM core");
  return entry;
}

export function importLedger(entries) {
  if (!Array.isArray(entries)) throw new Error("ledger must be an array");
  entries.forEach(validateLedgerEntry);
  return entries;
}
