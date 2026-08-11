#!/usr/bin/env node
// project/bench/bench.mjs — WP-24: performance benchmarks.
//
// Measures four things and prints a table:
//   1. Full natal chart   — produceLedgerEntries (10 classical bodies) +
//      produceHouseLedgerEntries (Placidus)              target < 250 ms
//   2. Single-body longitude — produceLedgerEntries with one body   < 5 ms
//   3. astro-core aspect scan over 14 synthetic bodies (91 pairs)  < 10 ms
//   4. Core ring-sweep (test/full-sweep.test.js's exhaustive
//      1,296,000-point BigInt sweep) — wall time, report-only, no threshold
//
// Each timed benchmark (1-3) runs multiple iterations (after a short
// warm-up) and reports min/median/mean/max, not a single noisy sample.
//
// `--assert`: exit non-zero if any of benchmarks 1-3 exceeds its threshold
// at a 3x margin (750 ms / 15 ms / 30 ms) — generous CI-variance headroom
// so this is usable as a gate without being flaky on a loaded machine.
// Without --assert (the default), just print the table and exit 0
// regardless of timings — informational mode.
//
// Usage:
//   node bench/bench.mjs             informational
//   node bench/bench.mjs --assert    CI gate (exit 1 on a >3x-threshold miss)

import { produceLedgerEntries, produceHouseLedgerEntries, DEFAULT_BODIES } from "../tools/ephemeris/produce-ledger.mjs";
import { nearestAspect, mod360 } from "../src/present/astro-core.js";
import { runSweep } from "../test/full-sweep.test.js";

// ── representative instant (per the WP-24 brief) ─────────────────────────
const TIME = "2000-01-01T12:00:00Z";
const LAT = 40;
const LNG = -74;

// 14 synthetic bodies for the aspect scan — 10 classical + NorthNode,
// SouthNode, Chiron, Lilith (astro.jsx's full PLANET_ORDER plus the
// computed SouthNode point; see astro.jsx's `visibleAspectBodies` for the
// closely related in-app list). astro-core's aspect functions
// (nearestAspect/mod360) take plain longitudes, not bodies — they don't
// compute their own ephemeris — so fixed synthetic longitudes exercise the
// real pairwise-scan cost without needing a producer call.
const ASPECT_BODIES = [
  { body: "Sun", longitude: 280.37 },
  { body: "Moon", longitude: 134.68 },
  { body: "Mercury", longitude: 271.99 },
  { body: "Venus", longitude: 243.98 },
  { body: "Mars", longitude: 327.94 },
  { body: "Jupiter", longitude: 25.27 },
  { body: "Saturn", longitude: 40.39 },
  { body: "Uranus", longitude: 314.75 },
  { body: "Neptune", longitude: 303.17 },
  { body: "Pluto", longitude: 251.44 },
  { body: "NorthNode", longitude: 125.04 },
  { body: "SouthNode", longitude: 305.04 },
  { body: "Chiron", longitude: 36.42 },
  { body: "Lilith", longitude: 83.35 },
];

// ── timing harness ────────────────────────────────────────────────────────

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

/** Run `fn` `warmup` times (discarded) then `iterations` times, returning
 * the sorted array of per-call wall times in milliseconds. */
function timeIt(fn, { iterations, warmup = Math.max(3, Math.floor(iterations / 10)) }) {
  for (let i = 0; i < warmup; i++) fn();
  const times = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = nowMs();
    fn();
    times[i] = nowMs() - t0;
  }
  return times.slice().sort((a, b) => a - b);
}

function stats(sortedTimes) {
  const n = sortedTimes.length;
  const min = sortedTimes[0];
  const max = sortedTimes[n - 1];
  const median = n % 2 === 1
    ? sortedTimes[(n - 1) / 2]
    : (sortedTimes[n / 2 - 1] + sortedTimes[n / 2]) / 2;
  const mean = sortedTimes.reduce((a, b) => a + b, 0) / n;
  return { min, median, mean, max, n };
}

function fmt(ms) {
  return ms.toFixed(3);
}

// ── the pairwise aspect scan itself (mirrors astro.jsx's aspect-grid
// loop: nearestAspect(mod360(A.longitude - B.longitude)) over every
// unordered pair) ─────────────────────────────────────────────────────────
function aspectScan(bodies) {
  const grid = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const delta = mod360(bodies[i].longitude - bodies[j].longitude);
      const asp = nearestAspect(delta);
      if (asp) grid.push({ a: bodies[i].body, b: bodies[j].body, aspect: asp.name });
    }
  }
  return grid;
}

// ── benchmarks ─────────────────────────────────────────────────────────────

function benchFullChart() {
  return timeIt(() => {
    const entries = produceLedgerEntries({ time: TIME, lat: LAT, lng: LNG, bodies: DEFAULT_BODIES });
    entries.push(...produceHouseLedgerEntries({ time: TIME, lat: LAT, lng: LNG, systems: ["placidus"] }));
    return entries;
  }, { iterations: 30 });
}

function benchSingleBody() {
  return timeIt(() => {
    return produceLedgerEntries({ time: TIME, lat: LAT, lng: LNG, bodies: ["Sun"] });
  }, { iterations: 200 });
}

function benchAspectScan() {
  return timeIt(() => aspectScan(ASPECT_BODIES), { iterations: 500 });
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const assertMode = process.argv.includes("--assert");

  const rows = [];

  const chartTimes = benchFullChart();
  const chartStats = stats(chartTimes);
  rows.push({
    name: "Full natal chart (10 bodies + Placidus houses)",
    iterations: chartStats.n,
    ...chartStats,
    thresholdMs: 250,
    assertMs: 750,
  });

  const singleTimes = benchSingleBody();
  const singleStats = stats(singleTimes);
  rows.push({
    name: "Single-body longitude (Sun)",
    iterations: singleStats.n,
    ...singleStats,
    thresholdMs: 5,
    assertMs: 15,
  });

  const aspectTimes = benchAspectScan();
  const aspectStats = stats(aspectTimes);
  rows.push({
    name: "astro-core aspect scan (14 bodies, 91 pairs)",
    iterations: aspectStats.n,
    ...aspectStats,
    thresholdMs: 10,
    assertMs: 30,
  });

  console.log("HCRM performance benchmarks");
  console.log(`instant=${TIME} lat=${LAT} lng=${LNG}`);
  console.log("");

  // Ring sweep runs once — it is an exhaustive 1,296,000-point BigInt sweep
  // (test/full-sweep.test.js), expensive by design. Report-only: no
  // threshold, never gates --assert. runSweep() has no await points unless
  // given an onProgress callback, so this runs synchronously start-to-finish.
  const sweepT0 = nowMs();
  const sweepResult = await runSweep();
  const sweep = { elapsed: nowMs() - sweepT0, result: sweepResult };

  const header = ["Benchmark", "N", "min(ms)", "median(ms)", "mean(ms)", "max(ms)", "target", "status"];
  const table = [header];
  let anyFail = false;
  for (const r of rows) {
    const status = r.median <= r.thresholdMs ? "OK" : (r.median <= r.assertMs ? "SLOW (within 3x)" : "FAIL");
    if (r.median > r.assertMs) anyFail = true;
    table.push([
      r.name,
      String(r.iterations),
      fmt(r.min),
      fmt(r.median),
      fmt(r.mean),
      fmt(r.max),
      `< ${r.thresholdMs}ms`,
      status,
    ]);
  }

  table.push([
    "Core ring-sweep (1,296,000-point exhaustive BigInt sweep)",
    "1",
    "-", "-", "-",
    fmt(sweep.elapsed),
    "(report-only)",
    sweep.result.ok ? "OK" : "MISMATCH",
  ]);

  const widths = header.map((_, col) => Math.max(...table.map(row => String(row[col]).length)));
  for (const row of table) {
    console.log(row.map((cell, col) => String(cell).padEnd(widths[col])).join("  "));
  }
  console.log("");
  console.log(`Ring sweep: checked=${sweep.result.checked} mismatches=${sweep.result.mismatches} maxK=${sweep.result.maxK} ok=${sweep.result.ok}`);

  if (!sweep.result.ok) {
    // The sweep is a correctness certificate, not a perf number — a
    // mismatch here means the ring-sweep proof itself broke, which is
    // always worth failing loudly on regardless of --assert.
    console.error("Core ring-sweep reported a mismatch — this is a correctness regression, not a perf issue.");
    process.exitCode = 1;
    return;
  }

  if (assertMode) {
    if (anyFail) {
      console.error("");
      console.error("--assert: one or more benchmarks exceeded their 3x-margin threshold.");
      process.exitCode = 1;
    } else {
      console.log("");
      console.log("--assert: all benchmarks within 3x-margin thresholds.");
    }
  }
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
