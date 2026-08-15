# Independent completion audit

**Date:** 2026-08-15 · **Audited at:** `0643ac5` (branch even with `origin/main`)
**Question asked:** is the framework actually 100% complete, and are any todo
lists still open?

**Answer: no.** All 29 work packages are genuinely built and every automated
gate is genuinely green, but the shipped chart computes the **Ascendant with a
self-disclaimed non-solver that is wrong by up to 109°** — the verified solver
WP-11/WP-12 built and cross-checked against Swiss Ephemeris is never called by
any browser page. Ten further items are open, plus a large standing register of
deliberately-OPEN mathematical claims.

This document is an *external* audit. It does not supersede
[`EXECUTION_STATUS.md`](./EXECUTION_STATUS.md), which remains the record of what
the remediation plan built; it records what that plan's own completion claim
does not cover.

---

## 1. What genuinely checks out

Re-run from a clean checkout, not taken from any status document:

| Gate | Command | Result |
|------|---------|--------|
| Full suite | `cd project && npm test` | **PASS 4404/4404**, 31 suites |
| No-float audit | (in `npm test`) | 20/20 core modules clean |
| Exhaustive ring sweep | (in `npm test`) | 1,296,000 checked, **0 mismatches** |
| Lint | `npm run lint` | clean, exit 0 |
| Claim banner | `node scripts/check-claims.mjs` | OK |
| Benchmarks | `node bench/bench.mjs --assert` | all within thresholds |
| Ledger schema | `node tools/validate-ledgers.mjs` | OK |
| Unchecked `- [ ]` boxes | repo-wide grep | **none** (27/27 ticked) |
| UX checklist | `docs/ux-validation-checklist.md` | 12/12 scenarios carry a verdict |

The exact integer core is real, and its headline claim is real: the ring sweep
is a genuine exhaustive proof over all 1,296,000 arcseconds, it runs in `npm
test` and in CI, and it passes. Nothing below disputes the core.

---

## 2. Blocker — the shipped Ascendant is wrong

`project/astro.jsx:269` defines `ascendantDeg()` under its own comment:

```js
// Simplified ascendant (good enough for the visual layer; not a real solver)
```

`computeNatal()` calls it unconditionally at `astro.jsx:350`. Meanwhile
`tools/ephemeris/houses.js:289` exports `ascMc()` — the solver WP-11 built,
whose 180°-branch bug was caught pre-ship and which WP-12 cross-checked against
`pyswisseph` at 5 charts × 9 systems (worst residual ~12.5″). It is never
reached from a page: `houses.js:836` publishes **only** the policy table.

```js
if (typeof window !== "undefined") {
  window.HousesPolicy = { POLAR_FALLBACK_POLICY };   // not ascMc, not any cusp fn
}
```

Measured directly (shipped `astro.jsx` under `node:vm` with the vendored
ephemeris loaded, vs. `ascMc` at the same instant):

| Chart | shipped ASC | verified ASC | error |
|---|---|---|---|
| San Antonio 1990-03-21 (the suite's own fixture) | 358.26° Pisces | 100.91° Cancer | **−102.65°** |
| London 2000-01-01 | 304.12° Aquarius | 24.27° Aries | −80.15° |
| New York 1985-07-04 | 69.96° Gemini | 178.89° Virgo | **−108.93°** |
| Sydney 1971-11-02 | 327.97° Aquarius | 57.02° Taurus | −89.05° |
| Reykjavík 2010-02-14 | 277.60° Capricorn | 250.80° Sagittarius | +26.80° |

**The rising sign is wrong on all five.** Because the ASC seeds whole-sign and
equal houses, this propagates into every planet's house number, sect
determination, all seven Hellenistic Lots, the angle readings, and the HCRM
register's ASC row.

Root cause is a wrong `atan2` branch. `astro.jsx` computes
`atan2(sin RAMC, cos RAMC·cos ε + tan φ·sin ε)`; the correct relation is
`atan2(cos RAMC, −(sin RAMC·cos ε + tan φ·sin ε))`.

**Why no gate caught it:** the suite pins the Ascendant only for range and
self-consistency, never against an external reference. `houses.test.js`'s 794
assertions test `houses.js` — the module the UI does not call.

---

## 3. Confirmed open items

| # | Item | Evidence | Severity |
|---|------|----------|----------|
| 1 | Shipped ASC wrong by up to 109°; verified solver unwired | `astro.jsx:269,350` vs `houses.js:836` | **blocker** |
| 2 | `outOfBounds` can never be non-empty — declination is derived from longitude alone, so `\|dec\| ≤ 23.4393°` against a `23.45°` threshold | `astro.jsx:264,591` | major |
| 3 | Four `PROVEN-BY-EXHAUSTIVE-SWEEP` claims rest on sweeps `npm test` and CI never run — `runSpineSweep`/`runFrameSweep` are called only by `Core Test Harness.html` | `STATUS.md:22`, `shadow-spine.test.js:242,399` | major |
| 4 | README states `accuracy.test.js` asserts the gate catches a >5′ error; no such assertion exists in its 489 | `README.md:175` | major |
| 5 | Vacuous assertion counted in the 4404: `gearClass(16n) === null \|\| true` can never fail, and its "tested by sweep" alibi is false — the sweep never calls `gearClass` | `test/core.test.js:68` | minor |
| 6 | Second vacuous assertion: `c.isDayChart === true \|\| c.isDayChart === false` accepts any boolean while its name promises "night chart" | `test/present/astro-chart.test.js:95` | minor |
| 7 | `schema-validate` is a blocking CI job that validates **zero** files — no `*.ledger.json` is committed | `tools/validate-ledgers.mjs` | minor |
| 8 | WP-20's promised `docs/a11y-report.md` was never created, though its ACCEPT criterion is "report committed" | `EXECUTION_PLAN.md:399` | minor |
| 9 | Quadrant house systems are `LEDGER` in code but still `OPEN` in the two documents README sends readers to first | `variants.js:237` vs `STATUS.md:19` | minor |
| 10 | Void-of-course Moon is a self-labelled "Crude" heuristic computing a different quantity than VOC, rendered as fact | `astro.jsx:600` | minor |
| 11 | South/North Node ship the Sun's dignity as an admitted placeholder | `astro.jsx:401` | minor |

---

## 4. Open by disclosure — real gaps the project already documents

These are **not** oversights; the repo states each one plainly. They are listed
because "100% complete" is not true while they stand.

- **LLM birth-data egress.** `app.jsx:19` sets `agentOn: true`; a resolved chart
  sends raw `dateISO`/`lat`/`lng` to `window.claude.complete()`
  (`agent.jsx:204`). The only opt-out lives in `tweaks-panel.jsx`, which opens
  solely on an `__activate_edit_mode` `postMessage` from a host iframe — so a
  standalone deployment has **no reachable off-switch**. Explicitly flagged for
  owner decision and closed by nobody.
- **Quadrant houses unreachable.** The picker offers Whole/Equal only; the 9
  verified cusp solvers are Node-only.
- **Polar house warning unreachable.** Fully implemented and tested, but no
  reachable path can trigger it.
- **No LICENSE**, recorded as a standing owner decision.
- **Lint excludes the whole JSX layer** — "lint is clean" covers 69 files and
  none of the browser application code.
- **`gastDeg`** carries a ~0.3–0.5″ accuracy note and an explicit "upgrade
  before any sub-arcsecond consumer" obligation.
- **NorthNode / Chiron / Lilith** stay synthetic even in REAL ephemeris mode.

## 5. Standing mathematical register — open by design

`docs/hcrm-open-claims.md` keeps 10 obligations, 9 still open (full-operator
180-folding, the Dresden/Codex correspondence, the body-domain ledger, the
tradition-selection inference, and others). `STATUS.md` still classifies the
whole package as a **GREEN-2 scaffold**, not evidence-grade. These are correctly
labelled and must not be read as defects — but they are the reason the project
itself never claims to be finished in the scientific sense.

---

## 6. Verdict

The remediation plan did what it said, and the honesty culture in this repo is
unusually good — most of §4 exists because the project wrote it down itself.
What the plan's "all 29 complete" does not cover is that **WP-11's deliverable
never reached the product**: a verified solver was built, tested to 12.5″, and
left unplugged behind a 100°-wrong approximation that no test compares against
it. Everything in §3 is fixable; item 1 should be fixed before anyone reads a
chart from this app.
