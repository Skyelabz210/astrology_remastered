// test/no-float-selftest.test.js — the no-float audit audits itself. (WP-02)
//
// Negative self-test: planted float constructs are fed through the shared
// pattern set IN MEMORY (no file writes) and each must be caught — proving the
// gate actually bites. A clean BigInt sample must pass, comments/strings that
// merely *name* forbidden constructs must not trip it, and the manifest the
// browser gate audits must equal the real src/core directory listing.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CORE_MANIFEST, auditSource } from "./no-float-audit.js";

// Each planted snippet is a float construct Mandate A1 forbids in src/core.
const PLANTED = [
  "const x = 0.5",
  "Math.floor(y)",
  "Number(z)",
  "parseFloat(s)",
  "new Date()",
  "v.toFixed(2)",
];

// Mentions of forbidden constructs in comments/strings are legitimate
// (validators.js names what it rejects) and must NOT be flagged.
const IMMUNE = [
  ["line comment", "const k = 7n; // Math.floor would be wrong here"],
  ["block comment", "/* parseFloat( and 0.5 are banned */ const j = 3n;"],
  ["string literal", 'const label = "Math.floor / new Date() / 1.5";'],
];

// A representative slice of legal core code: BigInt literals, integer
// division, modular wrap — nothing the audit should object to.
const CLEAN_BIGINT_SAMPLE = [
  "// exact register arithmetic — BigInt only",
  "export function wrap(a, m) {",
  "  const RING = 1296000n;",
  "  const r = ((a % m) + m) % m;",
  "  return (r * RING) / m;",
  "}",
].join("\n");

export function run() {
  const rows = [];

  for (const snippet of PLANTED) {
    const r = auditSource("planted", snippet);
    rows.push({
      name: `catches planted ${JSON.stringify(snippet)}`,
      ok: !r.ok,
      detail: r.ok ? "planted float construct escaped the audit" : `flagged: ${r.detail}`,
    });
  }

  for (const [kind, snippet] of IMMUNE) {
    const r = auditSource(kind, snippet);
    rows.push({
      name: `ignores forbidden tokens in ${kind}`,
      ok: r.ok,
      detail: r.ok ? "not flagged (correct)" : `false positive: ${r.detail}`,
    });
  }

  {
    const r = auditSource("clean sample", CLEAN_BIGINT_SAMPLE);
    rows.push({
      name: "clean BigInt sample passes",
      ok: r.ok,
      detail: r.detail,
    });
  }

  // Manifest sync: the browser gate audits exactly CORE_MANIFEST; the Node
  // side asserts here that the manifest equals the actual directory listing,
  // so a new core module cannot silently escape the browser gate.
  {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const actual = readdirSync(join(HERE, "..", "src", "core"))
      .filter((f) => f.endsWith(".js"))
      .sort();
    const manifest = [...CORE_MANIFEST].sort();
    const missing = actual.filter((f) => !manifest.includes(f));
    const extra = manifest.filter((f) => !actual.includes(f));
    const ok = missing.length === 0 && extra.length === 0 && manifest.length === actual.length;
    rows.push({
      name: "CORE_MANIFEST equals src/core directory listing",
      ok,
      detail: ok
        ? `${actual.length} modules, in sync`
        : `missing from manifest: [${missing.join(", ")}] · not in directory: [${extra.join(", ")}]`,
    });
  }

  return rows;
}
