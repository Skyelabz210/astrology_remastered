// test/ledger.test.js — ledger admission: only exact integer ledgers reach the core. (WP-16)
//
// The contract (see src/ledger/ephemeris-ledger-schema.json): positions enter the
// core only as schema-conformant entries with longitude_arcsec a decimal-integer
// string in [0, 1296000) and certificate.status one of SYNTHETIC_DEMO /
// IMPORTED_INTEGER_LEDGER / CERTIFIED_EXACT_LEDGER — and admitForCore refuses
// SYNTHETIC_DEMO unconditionally. Decimal strings, negatives, out-of-ring values,
// bare numbers, incomplete sources and unknown certificates are all turned away
// at the door.

import { validateLedgerEntry, admitForCore, importLedger } from "../src/ledger/import-ledger.js";

const REQUIRED = ["ledger_version", "event_id", "body", "longitude_arcsec", "source", "certificate"];

// A fully valid entry; `over` patches fields, listing a field as undefined deletes it.
function entry(over = {}) {
  const e = {
    ledger_version: "hcrm-ephemeris-ledger-v1",
    event_id: "2000-01-01T12:00:00Z#sun",
    body: "Sun",
    longitude_arcsec: "1009440",
    source: { kind: "test-fixture", name: "wp16-ledger-suite", checksum: "sha256:deadbeef" },
    certificate: { status: "IMPORTED_INTEGER_LEDGER", notes: "hand-built test fixture" },
  };
  for (const k of Object.keys(over)) {
    if (over[k] === undefined) delete e[k];
    else e[k] = over[k];
  }
  return e;
}

// Run fn expecting a throw; report whether it threw and what it said.
function trap(fn) {
  try { fn(); return { threw: false, msg: "no throw" }; }
  catch (err) { return { threw: true, msg: String((err && err.message) || err) }; }
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── admission: exact integer ledgers pass ────────────────────────
  t("valid IMPORTED_INTEGER_LEDGER entry validates",
    validateLedgerEntry(entry()) === true,
    "all six required fields, integer string in ring, known certificate");
  {
    const e = entry({ certificate: { status: "CERTIFIED_EXACT_LEDGER", notes: "certified" } });
    t("valid CERTIFIED_EXACT_LEDGER entry is admitted to the core",
      admitForCore(e) === e,
      "admitForCore returns the entry unchanged");
  }
  {
    const e = entry({ certificate: { status: "SYNTHETIC_DEMO", notes: "demo only" } });
    const r = trap(() => admitForCore(e));
    t("admitForCore throws on SYNTHETIC_DEMO",
      r.threw && r.msg.includes("SYNTHETIC_DEMO"),
      r.msg);
  }

  // ── rejection: each missing required field ───────────────────────
  for (const k of REQUIRED) {
    const r = trap(() => validateLedgerEntry(entry({ [k]: undefined })));
    t(`rejects entry missing ${k}`,
      r.threw && r.msg.includes(`missing ${k}`),
      r.msg);
  }

  // ── rejection: malformed fields ──────────────────────────────────
  {
    const r = trap(() => validateLedgerEntry(entry({ ledger_version: "hcrm-ephemeris-ledger-v0" })));
    t("rejects bad ledger_version", r.threw && r.msg.includes("ledger_version"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ longitude_arcsec: "123.5" })));
    t("rejects decimal longitude_arcsec \"123.5\"",
      r.threw && r.msg.includes("decimal digits"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ longitude_arcsec: "-1" })));
    t("rejects negative longitude_arcsec \"-1\"",
      r.threw && r.msg.includes("decimal digits"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ longitude_arcsec: "1296000" })));
    t("rejects longitude_arcsec at the ring boundary 1296000",
      r.threw && r.msg.includes("outside"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ longitude_arcsec: 123 })));
    t("rejects non-string number longitude_arcsec",
      r.threw && r.msg.includes("string"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ source: { kind: "test-fixture", name: "wp16-ledger-suite" } })));
    t("rejects incomplete source (checksum absent)",
      r.threw && r.msg.includes("source incomplete"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ certificate: { status: "TRUST_ME_BRO", notes: "" } })));
    t("rejects invalid certificate status",
      r.threw && r.msg.includes("certificate.status"), r.msg);
  }

  // ── rejection: schema-required fields the validator previously let
  // through unchecked (found during a correctness audit: certificate.notes
  // is schema-required but was never actually checked; event_id/body/
  // source.* were only checked for presence, not for being strings) ──────
  {
    const r = trap(() => validateLedgerEntry(entry({ certificate: { status: "IMPORTED_INTEGER_LEDGER" } })));
    t("rejects certificate missing notes (schema-required)",
      r.threw && r.msg.includes("certificate.notes"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ certificate: { status: "IMPORTED_INTEGER_LEDGER", notes: 42 } })));
    t("rejects non-string certificate.notes",
      r.threw && r.msg.includes("certificate.notes"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ event_id: 12345 })));
    t("rejects non-string event_id",
      r.threw && r.msg.includes("event_id"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ body: ["Sun"] })));
    t("rejects non-string body",
      r.threw && r.msg.includes("body"), r.msg);
  }
  {
    const r = trap(() => validateLedgerEntry(entry({ source: { kind: 1, name: "wp16-ledger-suite", checksum: "sha256:deadbeef" } })));
    t("rejects non-string source.kind",
      r.threw && r.msg.includes("source incomplete"), r.msg);
  }

  // ── importLedger: array in, array out — nothing else ─────────────
  {
    const r = trap(() => importLedger(entry()));
    t("importLedger throws on non-array input",
      r.threw && r.msg.includes("must be an array"), r.msg);
  }
  {
    const batch = [entry(), entry({ event_id: "2000-01-01T12:00:00Z#moon", body: "Moon", longitude_arcsec: "0" })];
    t("importLedger validates and returns a well-formed batch",
      importLedger(batch) === batch,
      "two entries, longitude 0 admitted at the low edge of the ring");
  }
  {
    const r = trap(() => importLedger([entry(), entry({ longitude_arcsec: "9.99" })]));
    t("importLedger rejects a batch containing one bad entry",
      r.threw && r.msg.includes("decimal digits"), r.msg);
  }

  return R;
}
