# Execution Plan — Decomposed Work Packages

Companion to [`AUDIT_REMEDIATION_PLAN.md`](./AUDIT_REMEDIATION_PLAN.md). Each work
package below is a **self-contained brief for an independent agent with a small context
window**: it lists the *complete* required reading (READ), the files to CREATE/MODIFY,
the task, and machine-checkable acceptance criteria (ACCEPT).

## Conventions (read this once; every package assumes it)

- All paths are relative to the repository root. All ACCEPT commands run from
  `project/` unless stated otherwise.
- **Standing invariant for every package:** `cd project && npm test` exits 0
  (baseline 493/493 assertions, count only ever grows) and the no-float audit stays
  green. If your change breaks either, the package is not done.
- **Mandate A1:** nothing under `project/src/core/` may contain floats, `Math.*`,
  `Number(`, `parseFloat`, `parseInt`, `Date`, or decimal literals. The test runner's
  no-float audit enforces this mechanically. New astronomy code goes in
  `project/tools/`, `project/src/present/`, or presentation `.jsx` — never `src/core/`.
- **Test style:** hand-rolled suites. Each suite file exports `run()` returning
  `[{name, ok, detail}]` rows and is registered in the `SUITES` list in
  `project/test/run.js`. Copy the pattern from any existing `project/test/*.test.js`.
  No Jest/Mocha/Vitest.
- **Ledger contract:** positions enter the core only as schema-conformant entries
  (see `project/src/ledger/ephemeris-ledger-schema.json`) with `longitude_arcsec` a
  decimal-integer string in `[0, 1296000)` and
  `certificate.status ∈ {SYNTHETIC_DEMO, IMPORTED_INTEGER_LEDGER, CERTIFIED_EXACT_LEDGER}`.
  `admitForCore` (in `project/src/ledger/import-ledger.js`) throws on `SYNTHETIC_DEMO`.
- Do not add a LICENSE file in any package (open owner decision).
- Commit per package with a message referencing the package id (e.g.
  `WP-07: producer timescale module (ΔT, GMST/GAST, IAU2006 obliquity)`).

## Dependency graph

```
P0: WP-01  WP-02 ──→ WP-03 ──→ WP-04            (P1)
          WP-01 ──→ WP-05                        (P1)
          WP-01 ──→ WP-06 ──→ WP-07 ──→ WP-08 ──→ WP-09 ──→ WP-10   (P2)
                              WP-07 ──→ WP-11 ──→ WP-12 ──→ WP-13   (P3; WP-13 also needs WP-08)
P4: WP-14 ──→ WP-15          WP-16 (independent)
P5: WP-06 ──→ WP-17 ──→ WP-18 ──→ WP-19 ──→ WP-20
P6: WP-17 ──→ WP-21 ──→ WP-22   WP-23 (independent)   WP-08+WP-21 ──→ WP-24   WP-25
P7: {WP-10, WP-13, WP-22, WP-24} ──→ WP-26
    {WP-08, WP-13} ──→ WP-27 ──→ WP-28
    {WP-18, WP-21} ──→ WP-29
```

Safe parallel batches (no file overlap):
1. **Batch A:** WP-01, WP-02, WP-14, WP-16, WP-23
2. **Batch B:** WP-03, WP-05, WP-06, WP-15
3. **Batch C:** WP-04, WP-07
4. **Batch D:** WP-08, WP-11
5. **Batch E:** WP-09, WP-12, WP-17
6. **Batch F:** WP-10, WP-13, WP-18
7. **Batch G:** WP-19, WP-21, WP-25
8. **Batch H:** WP-20, WP-22, WP-24
9. **Batch I:** WP-26, WP-27, WP-29 → then WP-28

(Packages sharing `package.json`/lockfile — WP-05, WP-06, WP-25 — rebase the lockfile
if they land concurrently.)

---

## Phase 0 — Truth & hygiene

### WP-01 · Repo hygiene files · S · deps: none
- **READ:** `project/package.json` (10 lines).
- **CREATE:** root `.gitignore` (`node_modules/`, `dist/`, `*.log`, `.DS_Store`,
  `coverage/`), `.nvmrc` containing `22`, `.editorconfig` (utf-8, lf, 2-space indent).
- **MODIFY:** `project/package.json` — add `"engines": {"node": ">=20"}`.
- **TASK:** Standard hygiene only. No LICENSE.
- **ACCEPT:** `npm test` green; `git status` shows only the new/modified files.

### WP-02 · Unify no-float audit + negative self-test · S · deps: none
- **READ:** `project/test/run.js` (~104 lines — contains `FLOAT_PATTERNS` and
  `auditNoFloat()` using dynamic `readdirSync` over `src/core`),
  `project/test/no-float-core.test.js` (~68 lines — browser twin with a hardcoded
  16-file `CORE_FILES` list and its own pattern copy).
- **CREATE:** `project/test/no-float-audit.js` — single source of truth: exports the
  pattern list, the comment/string-stripping logic, and an audit function that takes
  `(filename, sourceText)` pairs so both the Node runner (readdirSync) and the browser
  page (fetch) can drive it.
- **MODIFY:** `run.js` and `no-float-core.test.js` to import it. The browser file must
  derive its file list from a manifest exported by `no-float-audit.js` (which the Node
  side asserts equals the actual directory listing) — this kills the drift where a new
  core module silently escapes the browser gate.
- **TASK also:** add a negative self-test suite (registered in `run.js`): feed planted
  strings — `"const x = 0.5"`, `"Math.floor(y)"`, `"Number(z)"`, `"parseFloat(s)"`,
  `"new Date()"`, `"v.toFixed(2)"` — through the pattern set **in memory** (no file
  writes) and assert each is caught; also assert a clean BigInt sample passes.
- **ACCEPT:** `npm test` green with assertion count > 493; audited-file count reported
  equals `ls project/src/core/*.js | wc -l`.

### WP-03 · Claim-consistency script + stale doc fixes · M · deps: WP-02
- **READ:** root `README.md` (360 lines; focus banner line ~13 and repo-map section
  ~lines 305–329), `project/REMEDIATION_LEDGER.md` (title/headers only),
  `project/STATUS.md` (skim), output of `cd project && node test/run.js --quick`.
- **CREATE:** root `scripts/check-claims.mjs` — runs `node project/test/run.js --quick`,
  parses the total assertion count and the audited core-module count, counts
  `project/src/core/*.js`, greps README for the banner numbers, exits 1 on any mismatch
  with a diff-style message.
- **MODIFY:** root `README.md` — banner to live numbers; complete the repo map (add the
  6 missing core modules: `residues.js`, `gear-class.js`, `validators.js`,
  `identity.js`, `tower-recover.js`, `tray.js`); add an early pointer to
  `project/CLAIM_BOUNDARY.md`, `project/STATUS.md`, `project/REMEDIATION_LEDGER.md`.
  `project/REMEDIATION_LEDGER.md` — retitle to P1–P28 and add stub rows P24–P28 (locate
  citations: `grep -rn "P2[4-8]" project/src/core/`).
- **ACCEPT:** `node scripts/check-claims.mjs` (from repo root) exits 0; temporarily
  editing a README banner number makes it exit 1 (then restore).

## Phase 1 — CI scaffold

### WP-04 · GitHub Actions CI (initial) · S · deps: WP-03
- **READ:** `project/package.json`, `scripts/check-claims.mjs` (CLI contract only).
- **CREATE:** `.github/workflows/ci.yml` — job `core-tests`
  (`working-directory: project`, `actions/setup-node` matrix Node 20/22, `npm test` —
  note: no lockfile yet unless WP-05/06 landed; use `npm install` if `npm ci` has no
  lockfile) and job `claims` (`node scripts/check-claims.mjs` from root, Node 22).
  Commented placeholder jobs for `accuracy`, `ui-logic`, `bench`, `schema-validate`
  (filled by WP-26).
- **ACCEPT:** YAML parses (`node -e` with a YAML lib via `npx`, or push and observe);
  both job command sequences reproduce locally.

### WP-05 · ESLint · S · deps: WP-01
- **READ:** `project/package.json`; style samples: `project/src/core/ring.js`,
  `project/test/core.test.js` (skim).
- **CREATE:** root `eslint.config.mjs` (flat config) scoped to `project/src/**`,
  `project/test/**`, `project/tools/**`, `scripts/**`; **exclude** `project/*.jsx` and
  the browser-global `project/*.js` files for now (they use non-module browser globals).
- **MODIFY:** `project/package.json` — `"lint": "eslint --config ../eslint.config.mjs ."`
  (or root-run equivalent), pinned `eslint` devDependency; commit
  `project/package-lock.json`.
- **ACCEPT:** `npm ci && npm run lint` exits 0; `npm test` green.

## Phase 2 — Astronomy producer

### WP-06 · Add astronomy-engine dependency · S · deps: WP-01
- **READ:** `project/package.json`.
- **MODIFY:** add pinned `"astronomy-engine": "2.1.19"` to `dependencies`; commit
  `project/package-lock.json`.
- **CREATE:** `project/tools/README.md` — states: this dependency is used ONLY in
  `project/tools/` and the presentation layer; it must never be imported from
  `src/core/` (the no-float audit enforces the core side mechanically).
- **ACCEPT:** `npm ci`; `node -e "import('astronomy-engine').then(m=>console.log(!!m.GeoVector))"`
  prints `true`; `npm test` green.

### WP-07 · Timescale module · M · deps: WP-06
- **READ:** `project/tools/README.md`; the suite-registration pattern at the top of
  `project/test/run.js`. No other repo code needed — this is a pure new math module
  (floats are fine here; it is not under `src/core/`).
- **CREATE:** `project/tools/ephemeris/timescale.js` exporting:
  - `julianDayUTC(isoUtcString)` → JD (UTC-based)
  - `deltaTSeconds(decimalYear)` — Espenak–Meeus piecewise polynomials, valid
    −1999..+3000, with the source cited in JSDoc
  - `ttFromUtc(jdUtc)` → JD(TT)
  - `gmstDeg(jdUt1)` — full IAU 1982/2000 polynomial (T², T³ terms — not linear-only)
  - `gastDeg(jdUt1, jdTt)` — GMST + equation of the equinoxes using the dominant IAU
    1980 nutation terms (Δψ from the Ω and 2L terms is sufficient; document the
    truncation and its < 0.003″ effect in JSDoc)
  - `meanObliquityDeg(jdTt)` — IAU 2006 polynomial (replaces the UI's hardcoded 23.4393)
- **CREATE:** `project/test/timescale.test.js` validating against published values:
  Meeus Example 12.a — 1987-04-10 19:21:00 UT → GMST 128.737 873 5° (±0.000 1°);
  ΔT anchors: 1900 ≈ −2.7 s, 1955 ≈ +31.1 s, 2000 ≈ +63.83 s, 2020 ≈ +69.4 s (±2 s);
  mean obliquity at J2000 = 23.439 279 4° (±0.1″).
- **MODIFY:** `project/test/run.js` — register the suite.
- **ACCEPT:** `npm test` green with the new suite counted.

### WP-08 · Ledger producer CLI · M · deps: WP-07
- **READ:** `project/src/ledger/ephemeris-ledger-schema.json` (~30 lines),
  `project/src/ledger/import-ledger.js` (33 lines), the `parseArcsecString` export in
  `project/src/core/validators.js` (that function only),
  `project/tools/ephemeris/timescale.js` export list.
- **CREATE:** `project/tools/ephemeris/produce-ledger.mjs` — CLI:
  `node tools/ephemeris/produce-ledger.mjs --time 1994-01-11T14:30:00Z --lat 29.4241 --lng -98.4936 [--bodies Sun,Moon,Mercury,...] [--out file.json]`.
  Uses astronomy-engine for **geocentric apparent ecliptic-of-date** longitudes
  (aberration on; nutation per the engine — document in header). Speed in °/day by
  central difference (±6 h); `retrograde = speed < 0`. Emits an array of
  schema-conformant entries: `longitude_arcsec` decimal-integer string (rounded),
  `certificate.status: "IMPORTED_INTEGER_LEDGER"`,
  `source: {kind:"astronomy-engine", name:"2.1.19", checksum:<sha256 of payload>}`,
  plus a `meta` block (`jd_tt`, `delta_t_seconds`, `speed_arcsec_per_day` integer
  string, `retrograde` boolean).
- **CREATE:** `project/test/producer.test.js` — runs the producer in-process for one
  datetime; pipes the result through `importLedger()` and `admitForCore()`; asserts
  every entry validates, and speed/retrograde sign consistency.
- **MODIFY:** `run.js` — register the suite.
- **ACCEPT:** `npm test` green;
  `node tools/ephemeris/produce-ledger.mjs --time 2000-01-01T12:00:00Z --lat 0 --lng 0`
  prints JSON accepted by `importLedger`.

### WP-09 · Reference vectors (fixtures) · M · deps: WP-08 · ⚠ needs network or supplied data
- **READ:** `produce-ledger.mjs` CLI contract; the 20-point matrix in
  `AUDIT_REMEDIATION_PLAN.md` §6 (embedded again below).
- **CREATE:** `project/test/fixtures/reference-vectors.json` — for each of the 20 birth
  points: all 10 planets' apparent geocentric ecliptic-of-date longitude to 0.1″ from an
  **independent** source (JPL Horizons API `https://ssd.jpl.nasa.gov/api/horizons.api`,
  observer quantity 31 / ObsEclLon, geocentric; or an offline Swiss Ephemeris `swetest`
  run), speed sign, and per-row provenance (`source`, `retrieved`, exact query).
- **CREATE:** `project/tools/ephemeris/fetch-horizons.mjs` — the fetch script itself is
  committed so vectors are regenerable; it is **not** run in CI.
- **The 20 points** (UTC instant · lat, lng · what it stresses):
  1. 1700-03-20T12:00 · Paris 48.85, 2.35 · large-ΔT regime, century boundary
  2. 1800-01-01T00:00 · London 51.5, −0.13 · century, ΔT ≈ 13.7 s
  3. 1900-02-28T23:00 · Rome 41.9, 12.5 · non-leap century year
  4. 1912-04-15T05:00 · 41.7, −49.9 (N. Atlantic) · free ocean lat/lng
  5. 1941-12-07T18:00 · Honolulu 21.3, −157.86 · pre-modern-tzdb offsets
  6. 1955-06-15T12:00 · Quito −0.18, −78.47 · equator, ΔT plateau
  7. 1969-07-20T20:17 · Cape Canaveral 28.4, −80.6 · pre-leap-second UTC era
  8. 1972-06-30T23:59 · Sydney −33.87, 151.21 · first leap second, southern hemisphere
  9. 1987-04-10T19:21 · Greenwich 51.48, 0.0 · Meeus GMST worked example
  10. 1996-02-29T12:00 · Tokyo 35.68, 139.69 · leap day, no-DST zone
  11. 2000-01-01T12:00 · Greenwich 51.48, 0.0 · J2000 anchor
  12. 2000-02-29T06:00 · Nairobi −1.29, 36.82 · 400-rule century leap day
  13. 2004-06-08T08:20 · Longyearbyen 78.22, 15.63 · polar (Placidus-undefined path)
  14. 2015-06-30T23:59 · Ushuaia −54.8, −68.3 · leap-second adjacency, far south
  15. 2021-03-14T07:30 · New York 40.71, −74.01 · pairs with nonexistent local 02:30 EDT
  16. 2021-11-07T05:30 · New York 40.71, −74.01 · pairs with ambiguous local 01:30
  17. 2023-04-21T00:00 · Reykjavík 64.15, −21.94 · Mercury station; high-lat non-polar
  18. 2022-10-30T13:26 · Berlin 52.52, 13.40 · Mars station + EU DST transition day
  19. 2023-07-22T01:00 · Tromsø 69.65, 18.96 · Venus station; above polar circle
  20. 2050-01-01T00:00 · San Antonio 29.42, −98.49 · extrapolated ΔT, future date
- **ACCEPT:** fixture file JSON-parses and every row has provenance; spot-check Sun
  longitude 2000-01-01T12:00Z ≈ 280.37° (±0.02°).

### WP-10 · Accuracy gate + retrograde/station tests · M · deps: WP-09
- **READ:** head of `project/test/fixtures/reference-vectors.json` (structure only),
  `produce-ledger.mjs` contract, `run.js` registration pattern.
- **CREATE:** `project/test/accuracy.test.js` — for all 20 fixtures × bodies, circular
  difference |producer − reference|: Sun/Mercury/Venus/Mars/Jupiter/Saturn/Uranus/
  Neptune/Pluto ≤ 60″; Moon ≤ 120″ (documented astronomy-engine exception). Cusp rows
  arrive with WP-13.
- **CREATE:** `project/test/retrograde.test.js` — stations: Mercury 2023-04-21 &
  2023-05-15, Mars 2022-10-30 & 2023-01-12, Venus 2023-07-22 — speed sign flips within
  ±36 h of the published instant; retro flag ≡ (speed < 0) at every fixture; Sun and
  Moon never flagged.
- **MODIFY:** `run.js` registration; `project/package.json` script
  `"test:accuracy": "node test/accuracy.test.js"` (file must be runnable standalone and
  via the runner).
- **ACCEPT:** `npm test` green; deliberately corrupting one fixture value by 5′ fails
  the suite (then restore).

## Phase 3 — House systems

### WP-11 · ASC/MC + Placidus · L · deps: WP-07
- **READ:** `project/tools/ephemeris/timescale.js` export list only.
- **CREATE:** `project/tools/ephemeris/houses.js`:
  - `ascMc(jdUt1, jdTt, latDeg, lngDeg)` — exact spherical formulas from GAST → ARMC and
    true obliquity (this supersedes the UI's "not a real solver")
  - `placidusCusps(jdUt1, jdTt, latDeg, lngDeg)` — semi-arc iterative
    oblique-ascension method, convergence ≤ 1e-7°, full math documented in JSDoc
  - throws typed `PolarLatitudeError` for |lat| > 66.56°
  - all returns in float degrees (this layer is float-legal)
- **CREATE:** `project/test/houses.test.js` — ASC/MC and Placidus cusps vs 4 published
  Swiss Ephemeris `swetest -house` reference charts (values committed in-file with
  provenance), tolerance ≤ 30″; the polar throw is tested.
- **MODIFY:** `run.js` registration.
- **ACCEPT:** `npm test` green.

### WP-12 · Remaining quadrant systems + core registry honesty · M · deps: WP-11
- **READ:** `project/tools/ephemeris/houses.js`; in `project/src/core/variants.js` only
  the `HOUSE_SYSTEMS` registry section (locate via `grep -n OPEN`), and the exact
  `porphyryCusps` export.
- **CREATE (extend `houses.js`):** Koch, Regiomontanus, Campanus, Alcabitius,
  Topocentric, Morinus, Meridian; a float Porphyry cross-checked against the core's
  exact Porphyry (agreement ≤ 1″ given identical ASC/MC); a polar fallback policy table
  `{system, validLatRange, fallback: "WholeSign"}`.
- **MODIFY:** `project/src/core/variants.js` — the eight `status:"OPEN"` entries become
  `status:"LEDGER"` with a comment pointing at `tools/ephemeris/houses.js` and the
  admission contract. **String/comment change only — the no-float audit must stay
  green.** Update `project/test/variant-coverage.test.js` if it asserts `"OPEN"`.
- **MODIFY:** `houses.test.js` — per-system reference values (swetest, provenance
  in-file), ≤ 30″.
- **ACCEPT:** `npm test` green including the no-float audit and variant coverage.

### WP-13 · House cusps into the ledger · S · deps: WP-08, WP-12
- **READ:** `project/src/ledger/ephemeris-ledger-schema.json`, `produce-ledger.mjs`,
  `import-ledger.js`.
- **MODIFY:** schema → additive v1.1: allow `body` values `ASC`, `MC`,
  `CUSP_1`..`CUSP_12` and an optional `house_system` field (backward compatible —
  existing entries stay valid); producer gains `--houses placidus,koch,...`;
  `accuracy.test.js` gains cusp rows (≤ 30″) from the WP-11/12 reference charts.
- **ACCEPT:** `npm test` green; producer output with `--houses placidus` passes
  `importLedger`.

## Phase 4 — Seam fix & ledger integration

### WP-14 · Core browser shim · S · deps: none
- **READ:** the `<script>` block of `project/HCRM Console.html` (lines ~15–42); export
  lists only (`grep ^export`) of `project/src/core/shell-kelim.js`, `ring.js`,
  `residues.js`, `validators.js`; `project/src/ledger/import-ledger.js`.
- **CREATE:** `project/core-shim.js` — an ES module that imports the needed core +
  ledger functions and assigns `window.HCRM_CORE = { ... }` (guard `typeof window`).
  Header comment documents that pages must be served over HTTP (`npx serve project`) —
  ESM imports are blocked on `file://`.
- **MODIFY:** all 7 HTML pages — add
  `<script type="module" src="core-shim.js"></script>` **before** the `text/babel`
  tags. (Timing is safe: module scripts execute before `DOMContentLoaded`;
  Babel-standalone transforms on `DOMContentLoaded`.)
- **ACCEPT:** `npm test` green; served page shows `window.HCRM_CORE` defined in the
  console.

### WP-15 · hcrm.jsx float-leak fix · M · deps: WP-14
- **READ:** `project/hcrm.jsx` targeted sections only — lines 1–160 (constants,
  `modInverse`, `crtReconstruct`/`crtPair`, `toArcsec` at ~134) plus
  `grep -n "toArcsec(\|crtPair(\|modInverse(\|kElim" project/hcrm.jsx` call sites;
  export list of `project/src/core/shell-kelim.js`;
  `project/src/demo/SYNTHETIC_DEMO.js` (52 lines).
- **MODIFY:** `project/hcrm.jsx` —
  1. delete the local Number-based CRT/K-Elimination (`modInverse`, `crtReconstruct`,
     `cramStep`, `kElimWinding` duplicates) and route through `window.HCRM_CORE` BigInt
     functions, converting at the boundary (`BigInt(arcsecString)`);
  2. keep `toArcsec` only as the explicitly-labeled synthetic quantization step, its
     output wrapped as a `SYNTHETIC_DEMO`-certified ledger entry;
  3. the "exact register" display path calls `admitForCore` and renders its rejection
     as a visible SYNTHETIC badge — rounded synthetic floats are never presented as
     exact register data.
- **ACCEPT:** `npm test` green; `grep -n "crtPair\|modInverse" project/hcrm.jsx`
  returns nothing; served HCRM Console page renders with the SYNTHETIC badge.

### WP-16 · Ledger admission tests · S · deps: none
- **READ:** `project/src/ledger/import-ledger.js` (33 lines), `parseArcsecString` in
  `project/src/core/validators.js`, suite pattern from `project/test/anchor.test.js`
  (top 40 lines).
- **CREATE:** `project/test/ledger.test.js` (~15 assertions) — valid
  IMPORTED/CERTIFIED entries accepted; `admitForCore` throws on SYNTHETIC_DEMO;
  rejections: each missing required field, bad `ledger_version`, decimal
  `longitude_arcsec` (`"123.5"`), negative, ≥ 1296000, non-string number, incomplete
  `source`, invalid certificate status, non-array to `importLedger`.
- **MODIFY:** `run.js` registration.
- **ACCEPT:** `npm test` green with the suite counted.

## Phase 5 — UI/UX

### WP-17 · Real ephemeris in the browser · M · deps: WP-06
- **READ:** in `project/astro.jsx` only: `PLANET_PERIODS`/`PLANET_PHASE0` tables,
  `planetLongitude`, `isRetrograde`, `planetSpeed`, `dateToJD` (locate via grep,
  lines ~290–340, ~420); one HTML page's script block.
- **CREATE:** `project/vendor/astronomy.browser.min.js` — copied from the pinned npm
  package (`node_modules/astronomy-engine/astronomy.browser.min.js`), with version and
  sha256 recorded in `project/vendor/README.md`.
- **MODIFY:** HTML pages load the vendor script before `astro.jsx`; `astro.jsx` — when
  `window.Astronomy` exists, compute apparent ecliptic-of-date longitude and
  central-difference speed from it (`retrograde = speed < 0`, fixing the
  speed/retro-flag inconsistency); otherwise fall back to the synthetic model **and set
  `window.EPHEMERIS_MODE = "SYNTHETIC"`** for the UI badge (WP-19 surfaces it).
- **ACCEPT:** `npm test` green; served chart for 2000-01-01 12:00 UTC shows Sun ≈ 280.4°
  ecliptic (≈ 10.4° Capricorn); removing the vendor script still renders, with
  SYNTHETIC mode set.

### WP-18 · DST-correct time + unknown-time flag · M · deps: WP-17
- **READ:** `project/cities.jsx` header + entry shape (first 30 lines);
  `project/time.jsx` (full, ~200 lines); `grep -n "12:00\|noon" project/*.jsx` hits.
- **MODIFY:** `cities.jsx` — add an IANA `tz` name per city (e.g. `"America/Chicago"`).
- **CREATE:** `project/tzresolve.js` (plain script, dual-environment export) —
  `resolveUtcInstant(localParts, ianaTz)` via `Intl.DateTimeFormat(...,{timeZone})`
  offset-search; handles historical DST; returns explicit
  `{kind: "ok" | "nonexistent" | "ambiguous", instants: [...]}` that the UI must
  surface.
- **MODIFY:** `time.jsx` (and wherever the birth instant is composed) to use it instead
  of the fixed `off` hours. Add a `timeUnknown` flag to birth-data state: planets
  computed at 12:00 local, but ASC/MC/houses and Moon-degree precision claims are
  suppressed downstream (`chart.timeUnknown` honored by WP-19 and WP-29).
- **CREATE:** `project/test/tzresolve.test.js` (Node-testable; register in `run.js`):
  New York 2021-03-14T02:30 → nonexistent; 2021-11-07T01:30 → ambiguous; London
  1970-06-01 offset +01:00 (all-year BST); Sydney 2021-01-15 → +11:00 (southern DST).
- **ACCEPT:** `npm test` green.

### WP-19 · Input validation & visible errors · M · deps: WP-18
- **READ:** the birth-data form sections (locate via
  `grep -ln "lat" project/landing.jsx project/app.jsx` then read matching sections);
  `project/tzresolve.js` contract; `TweakSlider` clamp at `project/app.jsx:352`.
- **MODIFY:** free-entry lat/lng fields with range validation (lat ∈ [−90, 90],
  lng ∈ [−180, 180]) and inline messages; **remove the ±66° silent clamp** — allow
  polar latitudes with a warning banner ("Placidus/Koch undefined above the polar
  circle; using Whole Sign") wired to WP-12's fallback policy; real-calendar date
  validation (leap years); surface SYNTHETIC badge and DST ambiguous/nonexistent
  prompts.
- **CREATE:** `project/errors.jsx` — error-boundary + toast component replacing the
  `try/catch → console.error → null` swallowing in `app.jsx` chart builders;
  `project/docs/ux-validation-checklist.md` — 12 scenarios (bad date, bad lat, polar
  lat, nonexistent DST time, ambiguous DST time, unknown time, offline/no vendor,
  synthetic mode, empty city, future date, historic date, chart error) each with the
  expected visible behavior.
- **ACCEPT:** `npm test` green; each checklist scenario demonstrably handled on the
  served page.

### WP-20 · Accessibility & privacy · M · deps: WP-19
- **READ:** grep-driven skim of `project/landing.jsx`, `project/card.jsx`
  (`<svg|<img|<button|onClick`), the color-variable section of `project/styles.css`.
- **MODIFY:** aria-labels on interactive elements, `role`/`alt` on chart SVGs/canvas,
  keyboard operability of the form, WCAG-AA contrast fixes for text tokens in
  `styles.css`.
- **CREATE:** `project/a11y-table.jsx` — a textual chart alternative (table: body,
  sign, degree, house, retrograde), toggleable, screen-reader-first; a landing privacy
  note ("all computation runs client-side; birth data never leaves this page") —
  verify truthfulness first:
  `grep -rn "fetch(\|XMLHttpRequest\|sendBeacon" project/*.jsx` must show no
  birth-data egress (CDN asset loads excepted; note `agent.jsx` if it calls an LLM —
  if it does, the privacy note must disclose it or the call must be opt-in).
- **CREATE:** `project/docs/a11y-report.md` — manual audit notes (axe browser pass).
- **ACCEPT:** `npm test` green; report committed.

## Phase 6 — Test expansion & performance

### WP-21 · Extract presentation logic to a testable module · L · deps: WP-17
- **READ:** `project/astro.jsx` (full — the one large read in this plan; the file is
  being decomposed); `project/tests.jsx` suite names and the functions they call.
- **CREATE:** `project/src/present/astro-core.js` — pure logic moved out of
  `astro.jsx`: dignities, terms, faces, lots, sect, aspect detection (incl. the orb
  table), pattern detection. Dual-environment: ES `export` +
  `if (typeof window !== "undefined") window.AstroCore = {...}`; loaded in HTML via a
  module shim alongside WP-14's.
- **MODIFY:** `astro.jsx` becomes data tables + thin wrappers calling `AstroCore`;
  HTML pages updated. **Must live in `src/present/`, never `src/core/`** (the no-float
  audit scans `src/core` only — confirm it does not pick the new directory up).
- **ACCEPT:** `npm test` green; all 7 served pages smoke-render;
  `node -e "import('./src/present/astro-core.js').then(m=>console.log(typeof m.dignityFor))"`
  prints `function` (adjust to a real export name).

### WP-22 · Port tests.jsx to CLI · M · deps: WP-21
- **READ:** `project/tests.jsx` (full), `project/src/present/astro-core.js` export
  list, `run.js` pattern.
- **CREATE:** `project/test/present/astro-core.test.js` (split if > 400 lines) porting
  the ~20 browser suites (zodiac, dignities, triplicities, terms, faces,
  aspects/orbs, lots, whole-sign houses, sect, lunar phase, critical degrees, joys,
  angles, patterns, Maya calendar, TCO, CRT residues, chart roundtrip) to Node against
  `astro-core.js`.
- **MODIFY:** `run.js` registration; `tests.jsx` gains a header comment marking the
  Node port as canonical (browser battery demoted to smoke page).
- **ACCEPT:** `npm test` green with ported suites counted.

### WP-23 · CRAM tools tests · S · deps: none
- **READ:** export/table-of-contents greps of `project/cram-int.js`,
  `project/cram-calc.js`, `project/cram-api.js`
  (`grep -n "^export\|^function\|window\." <file>`); read only the function bodies
  under test.
- **CREATE:** `project/test/cram-tools.test.js` — round-trips and edge cases: 0,
  ring−1, wrap-around, invalid input; pin the header-advertised regressions
  (`modInv` null-before-`Number()` coercion; exact-integer sqrt in the star-number
  test). If the files are browser-global scripts, add guarded dual-environment
  exports (same pattern as WP-21) without changing browser behavior.
- **MODIFY:** `run.js` registration.
- **ACCEPT:** `npm test` green; pages unaffected.

### WP-24 · Performance benchmarks · S · deps: WP-08, WP-21
- **READ:** `produce-ledger.mjs` and `astro-core.js` contracts only.
- **CREATE:** `project/bench/bench.mjs` — timings: full natal chart (producer, all
  bodies + Placidus) target < 250 ms local; single-body longitude < 5 ms; `astro-core`
  aspect scan for 14 bodies < 10 ms; core ring-sweep wall time (report-only). Prints a
  table; `--assert` enforces thresholds ×3 for CI variance.
- **MODIFY:** `project/package.json` — `"bench": "node bench/bench.mjs"`.
- **ACCEPT:** `npm run bench -- --assert` exits 0 locally.

### WP-25 · Standalone bundle regeneration · S · deps: none (decision of record: delete + regenerate)
- **READ:** nothing beyond `ls -la "project/HCRM Console (standalone).html"`.
- **TASK:** `git rm` the stale 2.07 MB bundle. CREATE
  `project/tools/build-standalone.mjs` — pre-transpiles the JSX via a pinned
  `@babel/core` devDependency, inlines CSS + vendored React/astronomy, emits
  git-ignored `dist/standalone.html`. Document in `project/tools/README.md`.
- **ACCEPT:** `node tools/build-standalone.mjs` emits a `dist/standalone.html` that
  opens offline; the stale file is gone from git.

## Phase 7 — Docs, interpretation, CI assembly

### WP-26 · CI final assembly · S · deps: WP-10, WP-13, WP-22, WP-24
- **READ:** `.github/workflows/ci.yml`, `project/package.json` scripts.
- **MODIFY:** final job set — `core-tests` (Node 20+22), `lint`, `accuracy`
  (`npm run test:accuracy`), `ui-logic`, `claims`, `schema-validate` (runs
  `importLedger` over any `*.ledger.json` in the repo + JSON-parses the schema),
  `bench` (non-blocking, artifact upload), optional non-blocking `swiss-crosscheck`.
  All blocking jobs required; thresholds as in `AUDIT_REMEDIATION_PLAN.md` §5.
- **ACCEPT:** YAML parses; every blocking job's command passes locally from a clean
  clone + `npm ci`.

### WP-27 · Inputs/outputs documentation + JSDoc · M · deps: WP-08, WP-13
- **READ:** export lists (`grep ^export`) of all `project/src/core/*.js`,
  `import-ledger.js`, the producer and houses CLI contracts.
- **CREATE:** `project/docs/INPUTS_OUTPUTS.md` — every public function: parameters,
  units (**BigInt arcsecond vs float degree — state which layer**), ranges, error
  modes; ledger schema field reference; producer CLI reference.
- **MODIFY:** JSDoc on core public functions (**comments only** — no-float-safe);
  extend `scripts/check-claims.mjs`: every exported core name appears in the doc.
- **ACCEPT:** `npm test` green (audit unaffected); `node scripts/check-claims.mjs`
  green.

### WP-28 · README rewrite + CONTRIBUTING · S · deps: WP-27
- **READ:** root `README.md`, `project/STATUS.md`, `project/CLAIM_BOUNDARY.md`
  (headers).
- **MODIFY:** root `README.md` — quickstart (serve pages, run tests, produce a
  ledger), architecture diagram (core / ledger / producer / presentation), accuracy
  statement with CI-enforced thresholds, links to claim documents.
- **CREATE:** `CONTRIBUTING.md` — test-first workflow, mandate A1, how to add a core
  module so both no-float audits see it, commit conventions.
- **ACCEPT:** `node scripts/check-claims.mjs` green.

### WP-29 · Interpretation engine improvements · M · deps: WP-18, WP-21
- **READ:** `project/readings.jsx` (full, ~200 lines); dignity/sect/aspect exports of
  `astro-core.js`.
- **MODIFY:** `readings.jsx` — ground generated text in computed dignities, sect, and
  aspects (available post WP-21) rather than sign-only boilerplate; honor
  `chart.timeUnknown` (no house/ASC language when set); per-statement source tags
  ("Ptolemaic dignity", "Dorothean triplicity", …); soften deterministic phrasing per
  the audit's UX guidance.
- **CREATE:** `project/test/present/readings.test.js` — given fixed placements:
  unknown-time output contains no house/ascendant language; every statement carries a
  source tag.
- **ACCEPT:** `npm test` green.

---

## Definition of done (whole plan)

1. All blocking CI jobs green from a clean clone.
2. `node tools/ephemeris/produce-ledger.mjs --time 2000-01-01T12:00:00Z --lat 51.48 --lng 0 --houses placidus`
   → output passes `importLedger` + `admitForCore` → accuracy suite within thresholds.
3. Served UI renders a real chart (astronomy-engine positions, DST-correct instant,
   real ASC/MC and chosen house system) with visible provenance badges; synthetic mode
   only ever appears labeled.
4. README claims are machine-checked against reality; the no-float audit is unified,
   self-testing, and still 100% green over `src/core`.
