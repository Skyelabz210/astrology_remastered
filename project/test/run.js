// test/run.js — Node entry point for the whole suite. BigInt only.
//
// The browser gate (`Core Test Harness.html`) runs the same modules; this is the
// headless path so CI and `npm test` exercise exactly what the gate does.
//
// Suites are DISCOVERED, not registered: every *.test.js file in this directory
// (minus EXCLUDE below) is imported and its exported run() executed. To add a
// suite, drop a file in test/ that exports run() returning [{name, ok, detail}]
// rows — no edit here needed. Discovered suite names are printed so drift is
// visible.
//
//   node test/run.js          full suite + the exhaustive ring sweep
//   node test/run.js --quick  skip the 1,296,000-point sweep
//
// The no-float audit shares its pattern set, stripping logic, and file manifest
// with the browser gate via test/no-float-audit.js (single source of truth).

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { auditPairs } from "./no-float-audit.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");

// Files discovery must skip. Keep this list short and each entry justified:
//   no-float-core.test.js — browser-only twin of the no-float audit (relative
//     fetch() + `location`; cannot run under Node). The audit below covers the
//     same ground from disk through the shared no-float-audit.js module.
//   full-sweep.test.js — exports runSweep(), not run(); special-cased after the
//     suites so --quick can skip the 1,296,000-point sweep.
const EXCLUDE = new Set(["no-float-core.test.js", "full-sweep.test.js"]);

const discovered = readdirSync(HERE)
  .filter((f) => f.endsWith(".test.js") && !EXCLUDE.has(f))
  .sort();

const quick = process.argv.includes("--quick");
let total = 0, failed = 0;
const failures = [];

console.log(`  discovered ${discovered.length} suites: ${discovered.map((f) => f.replace(/\.test\.js$/, "")).join(", ")}`);

for (const file of discovered) {
  const label = file.replace(/\.test\.js$/, "");
  const mod = await import(`./${file}`);
  if (typeof mod.run !== "function") {
    // A discovered suite with no run() is contributor error, not a skip — fail
    // loudly instead of silently dropping coverage. Browser-only files belong
    // in EXCLUDE above.
    total += 1;
    failed += 1;
    failures.push(`${label} :: no run() export — export run() or add the file to EXCLUDE in test/run.js`);
    console.log(`  FAIL ${label.padEnd(24)} 0/1 (no run() export)`);
    continue;
  }
  const rows = await mod.run();
  const pass = rows.filter((r) => r.ok).length;
  total += rows.length;
  failed += rows.length - pass;
  rows.filter((r) => !r.ok).forEach((r) => failures.push(`${label} :: ${r.name} — ${r.detail}`));
  console.log(`  ${pass === rows.length ? "ok " : "FAIL"} ${label.padEnd(24)} ${pass}/${rows.length}`);
}

// Unified no-float audit: read every src/core/*.js from disk and feed the
// (filename, sourceText) pairs through the shared audit module. The audited
// file count therefore always equals the directory listing; the manifest the
// browser gate uses is asserted against the same listing in
// no-float-selftest.test.js.
const coreFiles = readdirSync(CORE).filter((f) => f.endsWith(".js")).sort();
const audit = auditPairs(coreFiles.map((f) => [`src/core/${f}`, readFileSync(join(CORE, f), "utf8")]));
const auditPass = audit.filter((r) => r.ok).length;
total += audit.length;
failed += audit.length - auditPass;
audit.filter((r) => !r.ok).forEach((r) => failures.push(`no-float :: ${r.name} — ${r.detail}`));
console.log(`  ${auditPass === audit.length ? "ok " : "FAIL"} ${"no-float audit".padEnd(24)} ${auditPass}/${audit.length}`);

if (!quick) {
  const { runSweep } = await import("./full-sweep.test.js");
  const s = await runSweep();
  console.log(`  ${s.ok ? "ok " : "FAIL"} ${"full ecliptic sweep".padEnd(24)} ${s.checked} checked, ${s.mismatches} mismatches`);
  console.log(`       parked  shell ${s.parked.shell} anchor ${s.parked.anchor}  K ≤ ${s.parked.maxK}`);
  console.log(`       legacy  shell ${s.legacy.shell} anchor ${s.legacy.anchor}  K ≤ ${s.legacy.maxK}`);
  if (!s.ok) { failed++; failures.push("full ecliptic sweep"); }
  total++;
}

console.log(`\n  ${failed === 0 ? "PASS" : "FAIL"}  ${total - failed}/${total} assertions`);
if (failures.length) {
  console.log("\n  failures:");
  failures.forEach((f) => console.log(`    ${f}`));
}
process.exit(failed === 0 ? 0 : 1);
