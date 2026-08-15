// test/shadow-spine-sweep.test.js — run the exhaustive spine/frame sweeps in
// Node, not only in a browser page.
//
// STATUS.md tags src/core/shadow-spine.js "PROVEN-BY-EXHAUSTIVE-SWEEP (cross,
// census, orthogonality, additivity)" and CLAIM_BOUNDARY.md carries four
// claims resting on those sweeps. Both sweeps live in shadow-spine.test.js as
// `runSpineSweep()` / `runFrameSweep()` — exported, but named neither `run`
// nor listed anywhere the Node runner looks, so the ONLY caller was
// "Core Test Harness.html". No CI job serves the pages, so the evidence for
// the repo's strongest wording was never executed by any automated gate:
// `npm test` and CI ran the 40 static assertions and stopped.
//
// They are not expensive — ~0.4s and ~1.9s here, against the ecliptic sweep's
// ~140ms-per-100k pace — so there was no performance reason to keep them out.
// This file is the documented extension mechanism (drop a *.test.js exporting
// run(); no runner edit), so the sweeps now execute on every `npm test` and in
// the core-tests CI job on both Node versions.
//
// See project/docs/COMPLETION_AUDIT.md section 3, item 3.

import { runSpineSweep, runFrameSweep } from "./shadow-spine.test.js";

export async function run() {
  const rows = [];

  // Both sweeps return { name, results: [{name, ok, detail}] }. Flatten, and
  // prefix each row with its sweep so a failure is locatable in the runner's
  // one-line-per-suite output.
  for (const sweep of [await runSpineSweep(), await runFrameSweep()]) {
    const results = Array.isArray(sweep?.results) ? sweep.results : [];
    // A sweep that silently returned nothing must fail loudly rather than
    // contribute zero rows and read as "passed".
    rows.push({
      name: `${sweep?.name || "sweep"}: produced assertions`,
      ok: results.length > 0,
      detail: `${results.length} rows`,
    });
    for (const r of results) {
      rows.push({ name: `${sweep.name} · ${r.name}`, ok: !!r.ok, detail: r.detail || "" });
    }
  }

  return rows;
}
