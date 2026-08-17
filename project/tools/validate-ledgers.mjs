#!/usr/bin/env node
// project/tools/validate-ledgers.mjs — WP-26: schema-validate CI job.
//
// Two checks, run from anywhere (paths below are resolved relative to this
// file's own location so it works whether invoked as
// `node tools/validate-ledgers.mjs` from project/ or via a longer path):
//
//   1. JSON-parse project/src/ledger/ephemeris-ledger-schema.json and sanity
//      check it has the shape of a JSON Schema object (not just "valid
//      JSON" — an empty object or a stray array would pass JSON.parse but
//      is not a schema).
//   2. Find every *.ledger.json file anywhere in the repo (excluding
//      node_modules/, .git/) and run its contents through importLedger()
//      (project/src/ledger/import-ledger.js), which validates each entry
//      against the ledger contract (schema shape, decimal-integer
//      longitude_arcsec, known certificate.status, ...). If none are
//      found, the script still succeeds and reports "0 ledger files
//      found" rather than failing on an empty set — the schema check
//      above is real either way, so an empty repo state is not itself a
//      failure. But this job was blocking in CI for a long stretch while
//      that was ALWAYS the actual case (see docs/COMPLETION_AUDIT.md §3
//      item 7): "OK" never once meant "a real ledger passed," because none
//      existed. test/fixtures/j2000-nyc-placidus.ledger.json — produced by
//      this same repo's own tools/ephemeris/produce-ledger.mjs at
//      2000-01-01T12:00:00Z / NYC, the same instant+location
//      test/houses.test.js's SWISSEPH_REFERENCE.nyc_2000 cross-checks
//      against Swiss Ephemeris — closes that gap: this job now genuinely
//      exercises importLedger() on every run, and was confirmed to
//      actually reject a corrupted entry before being committed.
//
// Exits non-zero if the schema fails its sanity check, if any discovered
// ledger file fails to parse as JSON, or if importLedger() throws for any
// entry in any discovered ledger file.
//
// Usage:
//   node tools/validate-ledgers.mjs

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { importLedger } from "../src/ledger/import-ledger.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, "..");
const REPO_ROOT = join(PROJECT_ROOT, "..");
const SCHEMA_PATH = join(PROJECT_ROOT, "src", "ledger", "ephemeris-ledger-schema.json");

// Directories never worth descending into when hunting for *.ledger.json.
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

let failed = false;

function fail(msg) {
  failed = true;
  console.error(`FAIL: ${msg}`);
}

// ── 1. Schema sanity check ─────────────────────────────────────────────────

function checkSchema() {
  let raw;
  try {
    raw = readFileSync(SCHEMA_PATH, "utf8");
  } catch (err) {
    fail(`could not read schema file ${SCHEMA_PATH}: ${err.message}`);
    return;
  }

  let schema;
  try {
    schema = JSON.parse(raw);
  } catch (err) {
    fail(`schema file is not valid JSON: ${err.message}`);
    return;
  }

  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    fail("schema file must JSON-parse to an object");
    return;
  }
  if (schema.type !== "object") {
    fail(`schema "type" must be "object", got ${JSON.stringify(schema.type)}`);
  }
  if (!Array.isArray(schema.required) || schema.required.length === 0) {
    fail('schema must declare a non-empty "required" array');
  }
  if (typeof schema.properties !== "object" || schema.properties === null) {
    fail('schema must declare a "properties" object');
  }

  if (!failed) {
    console.log(`OK: schema ${relative(REPO_ROOT, SCHEMA_PATH)} is valid JSON with an object/required/properties shape`);
  }
}

// ── 2. Find + validate every *.ledger.json in the repo ─────────────────────

function findLedgerFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // unreadable directory (permissions, race) — not our problem here
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findLedgerFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".ledger.json")) {
      out.push(full);
    }
  }
  return out;
}

function checkLedgers() {
  const files = findLedgerFiles(REPO_ROOT).sort();

  if (files.length === 0) {
    console.log("OK: 0 ledger files found (*.ledger.json) — nothing to validate");
    return;
  }

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch (err) {
      fail(`${rel}: could not read file: ${err.message}`);
      continue;
    }

    let entries;
    try {
      entries = JSON.parse(raw);
    } catch (err) {
      fail(`${rel}: not valid JSON: ${err.message}`);
      continue;
    }

    // A ledger file is a JSON array of entries per
    // tools/ephemeris/produce-ledger.mjs's own --out format; accept a bare
    // single entry object too (wrap it) so a hand-authored fixture isn't
    // forced to be a one-element array.
    const asArray = Array.isArray(entries) ? entries : [entries];

    try {
      importLedger(asArray);
      console.log(`OK: ${rel} (${asArray.length} ${asArray.length === 1 ? "entry" : "entries"})`);
    } catch (err) {
      fail(`${rel}: importLedger() rejected this ledger: ${err.message}`);
    }
  }

  if (!failed) {
    console.log(`OK: ${files.length} ledger file(s) validated`);
  }
}

// ── main ────────────────────────────────────────────────────────────────

checkSchema();
checkLedgers();

if (failed) {
  console.error("\nschema-validate: FAILED");
  process.exitCode = 1;
} else {
  console.log("\nschema-validate: OK");
}
