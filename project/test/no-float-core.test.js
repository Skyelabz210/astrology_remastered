// test/no-float-core.test.js — BROWSER gate for the no-float audit. (P4, WP-02)
//
// The core must be BigInt-only. This fetches every src/core/*.js source over
// http and scans for forbidden tokens that would admit floats, Date-derived
// longitude, rounding, or synthetic orbital periods into the proof path.
//
// The pattern set, comment/string stripping, and file manifest all live in
// test/no-float-audit.js — the same module the Node runner uses — so the two
// gates cannot drift. The Node self-test (no-float-selftest.test.js) asserts
// CORE_MANIFEST matches the real src/core directory, so a new core module
// cannot silently escape this gate.
//
// Browser-only: relative fetch() and `location` do not exist meaningfully under
// Node, so this file is listed in EXCLUDE in test/run.js (which audits the same
// sources from disk instead).

import { CORE_MANIFEST, auditSource } from "./no-float-audit.js";

export async function runNoFloatAudit() {
  const results = [];
  for (const file of CORE_MANIFEST) {
    const path = `src/core/${file}`;
    let src;
    try {
      const res = await fetch(path);
      if (!res.ok) {
        results.push({ name: path, ok: false, detail: `fetch ${res.status} — manifest names a module the server cannot serve` });
        continue;
      }
      src = await res.text();
    } catch (e) {
      // The audit reads its own sources, so the page must be served over http.
      const hint = location.protocol === "file:"
        ? "unreadable under file:// — serve the folder over http to audit"
        : "fetch failed: " + e.message;
      results.push({ name: path, ok: false, detail: hint });
      continue;
    }
    results.push(auditSource(path, src));
  }
  return results;
}
