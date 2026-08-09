// test/run.js — Node entry point for the whole suite. BigInt only.
//
// The browser gate (`Core Test Harness.html`) runs the same modules; this is the
// headless path so CI and `npm test` exercise exactly what the gate does.
//
//   node test/run.js          full suite + the exhaustive ring sweep
//   node test/run.js --quick  skip the 1,296,000-point sweep

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");

const SUITES = [
  ["core", "core.test.js"],
  ["variant coverage", "variant-coverage.test.js"],
  ["safe basis · ρ · arrow", "safe-basis.test.js"],
  ["shadow spine", "shadow-spine.test.js"],
  ["operator atlas", "operators.test.js"],
  ["CRAM layer", "cram.test.js"],
  ["star · tower · fixture", "fixture.test.js"],
  ["anchor", "anchor.test.js"],
  ["hidden carry", "carry.test.js"],
];

// The no-float audit reads source; in the browser it fetches, here it reads the
// filesystem. Same rule either way: no float construct may appear in src/core.
const FLOAT_PATTERNS = [
  [/\bNumber\s*\(/, "Number()"],
  [/\bparseFloat\s*\(/, "parseFloat()"],
  [/\bparseInt\s*\(/, "parseInt()"],
  [/\bMath\s*\./, "Math."],
  [/\.toFixed\s*\(/, ".toFixed()"],
  [/\bnew\s+Date\b/, "new Date"],
  [/\bDate\s*\.\s*now\b/, "Date.now"],
  [/(^|[^\w.])\d+\.\d+/, "decimal literal"],
];

/** Blank out block comments, keeping newlines so line numbers stay true. */
function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function auditNoFloat() {
  const files = readdirSync(CORE).filter((f) => f.endsWith(".js")).sort();
  const rows = [];
  for (const f of files) {
    const src = stripBlockComments(readFileSync(join(CORE, f), "utf8"));
    const hits = [];
    src.split("\n").forEach((line, i) => {
      // strip line comments and string literals before testing
      const code = line.replace(/\/\/.*$/, "").replace(/"[^"]*"|'[^']*'|`[^`]*`/g, '""');
      for (const [re, label] of FLOAT_PATTERNS) {
        if (re.test(code)) hits.push(`${label} @${i + 1}`);
      }
    });
    rows.push({ name: `src/core/${f}`, ok: hits.length === 0, detail: hits.join(", ") });
  }
  return rows;
}

const quick = process.argv.includes("--quick");
let total = 0, failed = 0;
const failures = [];

for (const [label, file] of SUITES) {
  const mod = await import(`./${file}`);
  const fn = mod.run || Object.values(mod).find((v) => typeof v === "function");
  const rows = await fn();
  const pass = rows.filter((r) => r.ok).length;
  total += rows.length;
  failed += rows.length - pass;
  rows.filter((r) => !r.ok).forEach((r) => failures.push(`${label} :: ${r.name} — ${r.detail}`));
  console.log(`  ${pass === rows.length ? "ok " : "FAIL"} ${label.padEnd(24)} ${pass}/${rows.length}`);
}

const audit = auditNoFloat();
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
