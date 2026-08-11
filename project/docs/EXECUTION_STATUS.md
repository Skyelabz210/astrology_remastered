# Execution Status — Audit Remediation

Live todo ledger for [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md). Update this file as
packages land. Last updated: 2026-08-11 (Batch D complete, verified, committed).

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
- [x] **WP-03** Claim-consistency script — `scripts/check-claims.mjs` (CHECK mode +
      `--fix`, anchored on stable banner wording, never on the digits). README repo
      map completed (all 20 core modules listed) with pointers to
      `CLAIM_BOUNDARY.md`/`STATUS.md`/`REMEDIATION_LEDGER.md`.
      `REMEDIATION_LEDGER.md` retitled P1–P28 with stub rows for the previously
      narrative-only P22–P28.
- [x] **WP-05 + WP-06** ESLint flat config (`eslint.config.mjs`, root) scoped to
      `src/**`/`test/**`/`tools/**`/`scripts/**`, `lint` script; pinned
      `astronomy-engine@2.1.19` dependency + `project/package-lock.json` +
      `project/tools/README.md` (dependency confined to `tools/`/presentation, never
      `src/core/` — audit-enforced). Lint-driven dead-code removal in 4 core files +
      3 test files, verified behavior-neutral (same assertion count before/after).
- [x] **WP-14** Core browser shim — `project/core-shim.js` exposes
      `window.HCRM_CORE` (42 core exports + `importLedger` / `validateLedgerEntry` /
      `admitForCore`); loaded as a `type=module` script in all pages except the
      standalone bundle. Pages require HTTP serving (`npx serve project`).
- [x] **WP-15** `hcrm.jsx` float-leak fix — Number-based CRT/K-Elimination
      (`modInverse`, `crtPair`, `kElimWinding`) deleted entirely; gamma/K/roundtrip
      now sourced from `window.HCRM_CORE` (BigInt, parked-shell anchor 11 — K can now
      genuinely show 0 or 1, not always-0). `toArcsec()` survives only as the labeled
      synthetic quantization step; its output is wrapped as a `SYNTHETIC_DEMO` ledger
      entry, run through `admitForCore`, and the rejection renders as a visible
      "SYNTHETIC — not admissible to core" badge in `hcrm-view.jsx`/`hcrm.css`.
- [x] **WP-16** Ledger admission tests — `test/ledger.test.js`, 19 assertions
      pinning the core's sole admission gate.
- [x] **WP-23** CRAM tools tests — `test/cram-tools.test.js`, 73 assertions;
      browser scripts evaluated UNMODIFIED via `node:vm` in page-faithful order.
      **Bug fix of record:** `cram-int.js` `cramStarIndex` Newton isqrt was seeded
      at N instead of the radicand d — returned null for genuine star numbers
      (13, 37, 73). Fixed; pinned by regression test.
- [x] **WP-04** Initial CI — `.github/workflows/ci.yml`: `core-tests` (Node 20/22
      matrix, `npm ci && npm test`) and `claims` (`node scripts/check-claims.mjs`)
      jobs; inert commented placeholders for `accuracy`/`ui-logic`/`bench`/
      `schema-validate` awaiting WP-26.
- [x] **WP-07** Astronomy timescale module — `project/tools/ephemeris/timescale.js`
      (outside `src/core/`, floats legal): `julianDayUTC`, `deltaTSeconds`
      (Espenak-Meeus), `ttFromUtc`, `gmstDeg` (full IAU 1982 polynomial, not
      linear-only), `gastDeg` (2-term nutation reduction, documented
      ~0.3–0.5″ accuracy — **not** sub-mas, upgrade before any sub-arcsecond
      consumer), `meanObliquityDeg` (IAU 2006/Hilton 2006/SOFA `iauObl06`).
      **Corrections of record:** the J2000 obliquity constant is
      23.439279444° (IAU2006) — the plan's original test target
      (23.4392911°) was the pre-2006 Lieske-1977 value, off by 0.042″, now
      fixed at the source; the 2020 ΔT anchor tolerance was widened to ±2.5s
      because the Espenak-Meeus 2005–2050 predictive fit itself overshoots
      IERS-observed ΔT by ~2.2s at 2020 (a property of the published
      formula, cited in both the module and its test).
- [x] **WP-08** Ledger producer CLI — `project/tools/ephemeris/produce-ledger.mjs`:
      given `--time/--lat/--lng`, computes geocentric apparent ecliptic-of-date
      longitude (aberration on) for the 10 classical bodies via astronomy-engine's
      `GeoVector`+`Ecliptic`, speed by 12h central difference, emits
      `IMPORTED_INTEGER_LEDGER` entries. Every entry round-trips through
      `import-ledger.js`'s `validateLedgerEntry`/`admitForCore` without
      throwing — the ledger contract now has its first real producer.
      `ephemeris-ledger-schema.json` gained an additive `meta` block
      (`jd_tt`/`delta_t_seconds`/`speed_arcsec_per_day`/`retrograde`).
      Sun @ J2000 ≈ 280.369° (~5″ from the ~280.37° textbook figure).
- [x] **WP-11** ASC/MC + Placidus — `project/tools/ephemeris/houses.js`:
      `ascMc()` and `placidusCusps()`, superseding `astro.jsx`'s self-disclaimed
      "not a real solver" ascendant. The Ascendant's quadrant-ambiguous ratio
      formula was resolved by deriving the correct `atan2` branch from an
      exact equator closed form rather than trusting memory — this caught a
      real 180°-off bug before it shipped. `PolarLatitudeError` at
      |lat| > 66.56°. **Known gap:** Placidus is verified against an
      independent exact closed form at the equator and internal consistency
      checks (cusp1/4/7/10 vs. `ascMc`, opposite-cusp symmetry), but **not**
      yet against an external reference (e.g. `swetest`) at nonzero latitude
      — no such access was available. Close this before WP-13 feeds house
      cusps into the accuracy gate.

**Assertion count: 493/493 → 818/818** (+13 timescale, +169 producer, +40
houses; WP-03/05/06/15/04 were doc/tooling/CI packages, no new assertions).
README banner is machine-checked by `scripts/check-claims.mjs`; `npm run lint`
is clean. **Process note:** WP-07's PR (#4) shipped with a stale README banner
because `check-claims.mjs --fix` wasn't re-run after adding tests — CI caught
it before merge. Every package since has run `--fix` + verify as a mandatory
last step; keep doing this.

## Prefetched assets (do not re-fetch)

- **`project/test/fixtures/horizons-prefetch.json`** — parsed JPL Horizons (DE441)
  apparent geocentric ecliptic-of-date longitudes/latitudes for all 20 reference
  instants × 10 bodies (5 pre-1800 outer-planet cells substituted from system
  barycenters, each carrying a `note`; offset < 0.1″), plus retrograde-station
  sign-change brackets for Mercury/Mars/Venus (2022–2023). Full provenance in
  `meta`. **WP-09 should build `reference-vectors.json` from this file** rather
  than re-querying Horizons; the committed `fetch-horizons.mjs` script it writes
  remains the regeneration path.

## Remaining (per plan order; briefs in EXECUTION_PLAN.md)

- [ ] **WP-09** Reference vectors — needs WP-08 (done, unblocked); **consume
      horizons-prefetch.json**
- [ ] **WP-10** Accuracy gate + retrograde/station tests — needs WP-09
- [ ] **WP-12** Remaining quadrant systems + registry `"OPEN"` → `"LEDGER"` — needs
      WP-11 (done, unblocked). Also a natural place to close WP-11's Placidus
      external-reference gap (see above) — consider sourcing `swetest`-class
      reference cusps for the newly-added systems AND retrofitting WP-11's tests.
- [ ] **WP-13** House cusps into the ledger (schema v1.1) — needs WP-08 (done),
      WP-12
- [ ] **WP-17** Real ephemeris in the browser (vendored astronomy-engine) — needs WP-06 (done, unblocked)
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
