# Execution Status — Audit Remediation

Live todo ledger for [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md). Update this file as
packages land. Last updated: 2026-08-11 (hold point requested by owner; Batch A
complete and merged).

## Done (verified, committed)

- [x] **WP-01** Repo hygiene — `.gitignore`, `.nvmrc` (22), `.editorconfig`, `engines`
      in `project/package.json`.
- [x] **WP-02** No-float audit unified — `test/no-float-audit.js` single source
      (patterns + stripping + `CORE_MANIFEST`) consumed by both the Node runner and
      the browser gate; negative self-test (planted floats caught, manifest ==
      directory listing). **Amendment of record:** `test/run.js` now AUTO-DISCOVERS
      `*.test.js` suites exporting `run()` (justified EXCLUDE list; `--quick`
      preserved). Never edit `run.js` to register a suite — just drop the file in
      `test/`.
- [x] **WP-14** Core browser shim — `project/core-shim.js` exposes
      `window.HCRM_CORE` (42 core exports + `importLedger` / `validateLedgerEntry` /
      `admitForCore`); loaded as a `type=module` script in all pages except the
      standalone bundle. Pages require HTTP serving (`npx serve project`).
- [x] **WP-16** Ledger admission tests — `test/ledger.test.js`, 19 assertions
      pinning the core's sole admission gate.
- [x] **WP-23** CRAM tools tests — `test/cram-tools.test.js`, 73 assertions;
      browser scripts evaluated UNMODIFIED via `node:vm` in page-faithful order.
      **Bug fix of record:** `cram-int.js` `cramStarIndex` Newton isqrt was seeded
      at N instead of the radicand d — returned null for genuine star numbers
      (13, 37, 73). Fixed; pinned by regression test.

**Assertion count: 493/493 → 596/596.** README banner corrected to live numbers
(manual interim fix; the machine check arrives with WP-03).

## Prefetched assets (do not re-fetch)

- **`project/test/fixtures/horizons-prefetch.json`** — parsed JPL Horizons (DE441)
  apparent geocentric ecliptic-of-date longitudes/latitudes for all 20 reference
  instants × 10 bodies (5 pre-1800 outer-planet cells substituted from system
  barycenters, each carrying a `note`; offset < 0.1″), plus retrograde-station
  sign-change brackets for Mercury/Mars/Venus (2022–2023). Full provenance in
  `meta`. **WP-09 should build `reference-vectors.json` from this file** rather
  than re-querying Horizons; the committed `fetch-horizons.mjs` script it writes
  remains the regeneration path.

## In progress at hold (no tree changes landed — restart these clean)

- [ ] **WP-03** Claims-consistency script + stale doc fixes — `scripts/check-claims.mjs`
      (CHECK mode + `--fix` amendment), complete README repo map (6 missing modules),
      REMEDIATION_LEDGER retitle P1–P28 with P24–P28 stub rows. *(Interim: banner
      numbers hand-corrected to 596/596 · 20/20; script still needed to keep them
      honest.)*
- [ ] **WP-05 + WP-06** (combined; share lockfile) — root ESLint flat config + `lint`
      script; pinned `astronomy-engine@2.1.19` dependency + `package-lock.json` +
      `project/tools/README.md`.
- [ ] **WP-15** `hcrm.jsx` float-leak fix — delete Number-based CRT/K-Elim
      duplicates, route through `window.HCRM_CORE`, SYNTHETIC provenance badge via
      `admitForCore` rejection. (WP-14's shim is already in place for this.)

## Remaining (per plan order; briefs in EXECUTION_PLAN.md)

- [ ] **WP-04** GitHub Actions CI (initial) — needs WP-03
- [ ] **WP-07** Timescale module (ΔT, GMST/GAST, IAU-2006 obliquity) — needs WP-06
- [ ] **WP-08** Ledger producer CLI — needs WP-07
- [ ] **WP-09** Reference vectors — needs WP-08; **consume horizons-prefetch.json**
- [ ] **WP-10** Accuracy gate + retrograde/station tests — needs WP-09
- [ ] **WP-11** ASC/MC + Placidus — needs WP-07
- [ ] **WP-12** Remaining quadrant systems + registry `"OPEN"` → `"LEDGER"` — needs WP-11
- [ ] **WP-13** House cusps into the ledger (schema v1.1) — needs WP-08, WP-12
- [ ] **WP-17** Real ephemeris in the browser (vendored astronomy-engine) — needs WP-06
- [ ] **WP-18** DST-correct time + unknown-time flag — needs WP-17
- [ ] **WP-19** Input validation & visible errors — needs WP-18
- [ ] **WP-20** Accessibility & privacy — needs WP-19
- [ ] **WP-21** Extract presentation logic to `src/present/astro-core.js` — needs WP-17
- [ ] **WP-22** Port `tests.jsx` suites to CLI — needs WP-21
- [ ] **WP-24** Performance benchmarks — needs WP-08, WP-21
- [ ] **WP-25** Standalone bundle: delete stale 2.07 MB file + regeneration script
- [ ] **WP-26** CI final assembly — needs WP-10, WP-13, WP-22, WP-24
- [ ] **WP-27** Inputs/outputs documentation + JSDoc — needs WP-08, WP-13
- [ ] **WP-28** README rewrite + CONTRIBUTING — needs WP-27
- [ ] **WP-29** Interpretation engine improvements — needs WP-18, WP-21

## Standing conventions for whoever resumes

1. `cd project && npm test` must stay green; count only grows (baseline now 596).
2. Mandate A1: no float constructs under `src/core/` — the audit + self-test enforce.
3. New test suites: drop `test/<name>.test.js` exporting `run()`; no runner edit.
4. New core modules: add to `CORE_MANIFEST` in `test/no-float-audit.js` (the
   self-test fails until you do).
5. Commit per package, message prefixed `WP-NN:`; no LICENSE file (owner decision
   pending).
6. Batch structure, file-conflict notes, and full briefs: `EXECUTION_PLAN.md`.
