#!/usr/bin/env node
// scripts/check-claims.mjs — WP-03: claim-consistency gate.
//
// The README banner (root README.md, near the top) makes three numeric
// claims: a total assertion count, a "core modules float-free" count, and a
// fixed "1,296,000 points, 0 mismatches" sweep claim. The first two drift as
// suites are added; this script re-derives the live values from an actual
// `node project/test/run.js` run and `project/src/core/*.js`, then compares
// them against what the README currently says.
//
//   node scripts/check-claims.mjs         CHECK mode (default) — exits 1 on
//                                          any mismatch, prints a diff.
//   node scripts/check-claims.mjs --fix   FIX mode — rewrites the banner
//                                          numbers in place to the live
//                                          values, then exits 0. Does not
//                                          touch anything else in the file.
//
// The banner is located by ANCHORING ON ITS STABLE WORDING ("assertions",
// "full ecliptic sweep 1,296,000 points, 0 mismatches", "core modules
// float-free"), never on the numbers themselves — the numbers are exactly
// the thing expected to change release to release.
//
// Run from the repository root (paths below are relative to this file's
// location, so it also works invoked as `node scripts/check-claims.mjs`
// from anywhere).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RUN_JS = join(ROOT, "project", "test", "run.js");
const CORE_DIR = join(ROOT, "project", "src", "core");
const README = join(ROOT, "README.md");

const fix = process.argv.includes("--fix");

// ---------------------------------------------------------------------------
// 1. Derive the live values.

function runFullSuite() {
  // Full run (no --quick): the README banner's assertion count includes the
  // full ecliptic sweep's own pass/fail assertion, which --quick skips.
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [RUN_JS], {
      cwd: join(ROOT, "project"),
      encoding: "utf8",
    });
  } catch (err) {
    // run.js exits 1 on any failed assertion; we still want its stdout to
    // report what happened.
    stdout = (err.stdout ?? "") + (err.stderr ?? "");
    return { stdout, ok: false };
  }
  return { stdout, ok: true };
}

function parseTotals(stdout) {
  const summary = /\n\s*(PASS|FAIL)\s+(\d+)\/(\d+)\s+assertions/.exec(stdout);
  if (!summary) {
    throw new Error(
      "could not find the '<PASS|FAIL> N/M assertions' summary line in " +
        "`node project/test/run.js` output — its wording changed; update " +
        "the anchor regex in scripts/check-claims.mjs.",
    );
  }
  const audit = /no-float audit\s+(\d+)\/(\d+)/.exec(stdout);
  if (!audit) {
    throw new Error(
      "could not find the 'no-float audit N/M' line in " +
        "`node project/test/run.js` output — its wording changed; update " +
        "the anchor regex in scripts/check-claims.mjs.",
    );
  }
  return {
    status: summary[1],
    assertionsTotal: Number(summary[3]),
    auditPass: Number(audit[1]),
    auditTotal: Number(audit[2]),
  };
}

function countCoreModules() {
  return readdirSync(CORE_DIR).filter((f) => f.endsWith(".js")).length;
}

// ---------------------------------------------------------------------------
// 2. Locate the banner in README.md, anchored on stable wording.

const BANNER_RE =
  /(\d+)\/(\d+)(\s*assertions\s*·\s*full ecliptic sweep 1,296,000 points, 0 mismatches\s*·\s*)(\d+)\/(\d+)(\s*core modules float-free)/;

function readBanner(readmeText) {
  const m = BANNER_RE.exec(readmeText);
  if (!m) {
    throw new Error(
      "could not locate the claim banner in README.md by its stable " +
        "wording ('assertions ... full ecliptic sweep 1,296,000 points, " +
        "0 mismatches ... core modules float-free') — the banner text " +
        "changed; update BANNER_RE in scripts/check-claims.mjs.",
    );
  }
  return {
    match: m,
    assertionsA: Number(m[1]),
    assertionsB: Number(m[2]),
    modulesA: Number(m[4]),
    modulesB: Number(m[5]),
  };
}

// ---------------------------------------------------------------------------
// 3. Compare and report.

const { stdout, ok: suiteOk } = runFullSuite();
const totals = parseTotals(stdout);
const coreModuleCount = countCoreModules();
const readmeText = readFileSync(README, "utf8");
const banner = readBanner(readmeText);

const problems = [];

if (!suiteOk || totals.status !== "PASS") {
  problems.push(
    `\`node project/test/run.js\` did not pass (status: ${totals.status}) — ` +
      "claims cannot be certified against a failing suite. Fix the suite " +
      "first; this script does not touch test code.",
  );
}

if (totals.auditTotal !== coreModuleCount) {
  problems.push(
    "no-float audit file count disagrees with the directory listing: " +
      `audit covered ${totals.auditTotal} file(s), \`ls project/src/core/*.js\` ` +
      `finds ${coreModuleCount}. (This should be structurally impossible per ` +
      "WP-02's manifest self-test — investigate before trusting either number.)",
  );
}

if (totals.auditPass !== totals.auditTotal) {
  problems.push(
    `no-float audit reports ${totals.auditPass}/${totals.auditTotal} float-free — ` +
      "not all core modules are clean. Mandate A1 is violated; fix the " +
      "offending module(s), do not paper over this by editing the README.",
  );
}

const liveAssertions = totals.assertionsTotal;
const liveModules = coreModuleCount;

const assertionsMismatch =
  banner.assertionsA !== liveAssertions || banner.assertionsB !== liveAssertions;
const modulesMismatch =
  banner.modulesA !== liveModules || banner.modulesB !== liveModules;

if (assertionsMismatch) {
  problems.push(
    "README banner assertion count is stale:\n" +
      `    README says : ${banner.assertionsA}/${banner.assertionsB}\n` +
      `    live value  : ${liveAssertions}/${liveAssertions}`,
  );
}

if (modulesMismatch) {
  problems.push(
    "README banner core-module count is stale:\n" +
      `    README says : ${banner.modulesA}/${banner.modulesB}\n` +
      `    live value  : ${liveModules}/${liveModules}`,
  );
}

// ---------------------------------------------------------------------------
// 4. FIX mode: rewrite the banner numbers in place.

if (fix) {
  if (assertionsMismatch || modulesMismatch) {
    const fixedBanner =
      `${liveAssertions}/${liveAssertions}` +
      banner.match[3] +
      `${liveModules}/${liveModules}` +
      banner.match[6];
    const fixedText =
      readmeText.slice(0, banner.match.index) +
      fixedBanner +
      readmeText.slice(banner.match.index + banner.match[0].length);
    writeFileSync(README, fixedText);
    console.log("check-claims --fix: rewrote README banner —");
    console.log(`  assertions   : ${banner.assertionsA}/${banner.assertionsB} -> ${liveAssertions}/${liveAssertions}`);
    console.log(`  core modules : ${banner.modulesA}/${banner.modulesB} -> ${liveModules}/${liveModules}`);
  } else {
    console.log("check-claims --fix: banner already matches live values, no changes made.");
  }
  // Non-banner problems (failing suite, audit disagreement) are not
  // rewritable — still fail loudly even in --fix mode.
  const nonBannerProblems = problems.filter(
    (p) => !p.startsWith("README banner"),
  );
  if (nonBannerProblems.length) {
    console.error("\ncheck-claims: unfixable problems remain:\n");
    nonBannerProblems.forEach((p) => console.error(`  - ${p}\n`));
    process.exit(1);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 5. CHECK mode: report and exit.

if (problems.length) {
  console.error("check-claims: CLAIM MISMATCH\n");
  problems.forEach((p) => console.error(`  - ${p}\n`));
  console.error("Run `node scripts/check-claims.mjs --fix` to correct the README banner.");
  process.exit(1);
}

console.log(
  `check-claims: OK — ${liveAssertions}/${liveAssertions} assertions, ` +
    `${liveModules}/${liveModules} core modules float-free, README banner matches.`,
);
process.exit(0);
