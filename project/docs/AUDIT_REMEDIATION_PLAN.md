# Audit Remediation Plan — astrology_remastered

Response to the external "Comprehensive Audit of astrology_remastered (Astrology App)".
Companion document: [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) — the same plan decomposed
into 29 self-contained work packages executable by independent agents with small context
windows.

---

## 1. What the audit asked for

The audit evaluated the app from three perspectives and demanded, in priority order:

| # | Priority | Demand |
|---|----------|--------|
| 1 | High | Comprehensive unit/integration tests + CI/CD |
| 2 | High | Modular refactor with clear interfaces |
| 3 | High | Documented inputs/outputs, README usage examples |
| 4 | Medium | Robust input validation and error prevention (Nielsen heuristics) |
| 5 | Medium | UX flow feedback, user-familiar terminology |
| 6 | Medium | Multiple house-system / zodiac options, clearly labeled |
| 7 | Low | Performance profiling and benchmarks |
| 8 | Low | Accessibility (WCAG AA) and privacy |
| 9 | Low | Interpretation-engine improvements |

Astronomically, the audit requires benchmarking planetary longitudes and house cusps
against Swiss Ephemeris / JPL-class references (target: agreement within arcminutes),
correct time-standard handling (UTC/UT1/TT, ΔT, sidereal time), precession/nutation
awareness, derivative-based retrograde detection, Placidus support, and defined behavior
at extreme latitudes.

## 2. What the repository actually is

The audit assumed a conventional Python astrology app. The repository is neither Python
nor conventional. It is 100% JavaScript in two deliberately separated layers:

### 2.1 The exact core — rigorous, verified, astronomy-free

`project/src/core/*.js` — 20 BigInt-only modules implementing CRAM/HCRM residue
arithmetic and K-Elimination on the ring of 1,296,000 arcseconds. Verified by
`node test/run.js`: **493/493 assertions**, an exhaustive 1,296,000-point sweep
(0 mismatches), and a live no-float static audit (20/20 files). Mandate **A1**: no
floating point ever enters the core. Exact house systems: Whole Sign, Equal, Vehlow,
Porphyry. Eight quadrant systems (Placidus, Koch, Regiomontanus, Campanus, Alcabitius,
Topocentric, Morinus, Meridian) are registered `status:"OPEN"` — deliberately refused
because oblique ascension needs trigonometry, which A1 forbids.

The core computes **no astronomy**: no ephemeris, no time scales, no dates. It is a
register engine awaiting exact input.

### 2.2 The presentation layer — everything the user sees is scaffold

`project/*.jsx` (React 18 UMD + Babel-standalone via CDN, 7 HTML entry pages, no
bundler):

- **Synthetic toy ephemeris** (`astro.jsx: planetLongitude`): mean circular motion from
  J2000 phase constants. Error grows without bound — tens of degrees for outer planets
  within decades of J2000. Self-labelled "PRESENTATION ONLY" (`src/demo/SYNTHETIC_DEMO.js`).
- **Retrograde** is an elongation-band heuristic; `planetSpeed` is a constant positive
  mean rate — the two are mutually inconsistent.
- **Ascendant** solver is self-described "not a real solver"; GMST uses the linear term
  only; obliquity is hardcoded `23.4393` in three places.
- **No time-scale handling anywhere**: no ΔT, TT, UT1, nutation, precession, leap
  seconds. `cities.jsx` uses fixed UTC offsets with **no DST** — summer births are off
  by an hour.
- **UX gaps**: latitude silently clamped to ±66°, hardcoded city list only, unknown
  birth time silently defaults to noon with houses still computed, errors swallowed to
  `console.error`.

### 2.3 The bridge — designed, empty

`project/src/ledger/` defines the admission contract (`ephemeris-ledger-schema.json`,
`import-ledger.js`): positions enter the core only as decimal-integer arcsecond strings
carrying a certificate (`SYNTHETIC_DEMO | IMPORTED_INTEGER_LEDGER |
CERTIFIED_EXACT_LEDGER`); `admitForCore` throws on synthetic. **No producer and no
ledger data exist.** This is the architecture's intended path for real astronomy, and it
has never been fed.

### 2.4 The leak

`project/hcrm.jsx:134 toArcsec()` = `Math.round(lonDeg * 3600)` — the "exact register"
console is fed rounded synthetic floats, and `hcrm.jsx` re-implements CRT/K-Elimination
in `Number` arithmetic, duplicating `src/core/shell-kelim.js` at 2^53 precision. The
`SYNTHETIC_DEMO.refuseSyntheticForCore` guard is never called on that path.

### 2.5 Infrastructure and claim drift

- **Missing entirely:** CI (`.github/`), `.gitignore`, LICENSE, lockfile, lint/format
  config, `.nvmrc`.
- **Stale claims:** README banner says "441/441 assertions · 17/17 core modules
  float-free"; reality is 493/493 and 20/20. The README repo map omits 6 of 20 core
  modules. `REMEDIATION_LEDGER.md` is scoped P1–P23 while core headers cite P24–P28.
- **Audit-tool drift:** two independent no-float audits; the browser one hardcodes a
  16-file list, so a new core module silently escapes it. No negative test proves the
  audit regex would catch a planted float.
- **Untested critical files:** `src/ledger/import-ledger.js` (the sole admission gate),
  `cram-int.js`, `cram-calc.js`, `cram-api.js`, and all UI. `tests.jsx` (~20
  classical-astrology suites: dignities, terms, faces, lots, sect, patterns) runs only
  in a browser — outside `npm test` and any CI reach.
- A stale committed 2.07 MB bundle (`HCRM Console (standalone).html`) with no
  regeneration path.

## 3. Strategy — complete the architecture, don't fight it

The core's no-float rigor is the repo's strongest asset; the audit's astronomy demands
are met by **building the producer side of the ledger contract the repo already
designed**:

1. **Preserve mandate A1.** No floats ever enter `src/core`. All real astronomy lives in
   a new producer layer (`project/tools/`) and the presentation layer, crossing into the
   core only as certified integer-arcsecond ledger entries via `import-ledger.js`.
2. **Ephemeris: `astronomy-engine`** (npm, MIT, pure JS, ±1 arcminute vs JPL — meets the
   audit's bar). Swiss Ephemeris rejected as a dependency (AGPL, WASM weight); used only
   as the offline source of committed reference fixtures and an optional non-blocking CI
   cross-check. A pinned, hash-recorded browser build replaces the synthetic ephemeris
   in the UI; synthetic remains as a clearly-badged offline fallback.
3. **Time correctness in the producer layer:** UTC→TT via Espenak–Meeus ΔT polynomials;
   full GMST polynomial plus equation of the equinoxes (GAST); IAU-2006 obliquity
   polynomial; DST-correct timezone resolution via IANA zones using
   `Intl.DateTimeFormat` (correct historical offsets without shipping tzdata).
4. **Quadrant houses in the producer layer** (floats permitted there): Placidus by
   semi-arc iteration plus Koch, Regiomontanus, Campanus, Alcabitius, Topocentric,
   Morinus, Meridian — cusps emitted to the ledger as integer arcseconds. Core registry
   entries change `"OPEN"` → `"LEDGER"` (a string-only, audit-safe change). Polar
   latitudes get a typed error, a documented Whole Sign fallback, and a visible UI
   warning instead of today's silent clamp.
5. **Retrograde by derivative:** central-difference speed from the real ephemeris;
   `retrograde ⇔ speed < 0`; station tests against published station dates.
6. **Testing style continuity:** the repo's hand-rolled `run()` suite pattern (zero
   dependencies) is kept for all Node-side tests. No Jest, no bundler. The browser↔core
   seam is a small ESM shim exposing `window.HCRM_CORE`.

## 4. Phases

| Phase | Name | Depends on |
|-------|------|-----------|
| P0 | Truth & hygiene — stale claims, audit unification, repo hygiene | — |
| P1 | CI + lint scaffold | P0 |
| P2 | Astronomy producer — timescales, ledger producer, reference fixtures, accuracy gate | — |
| P3 | House systems — ASC/MC, Placidus + 7 more, cusp ledger | P2 |
| P4 | Seam fix & ledger integration — core shim, hcrm.jsx leak, ledger tests | — |
| P5 | UI/UX — real browser ephemeris, DST + unknown-time, validation, a11y/privacy | P2, P4 |
| P6 | Test expansion + performance — logic extraction, tests.jsx CLI port, cram tests, bench, bundle | P5 (partial) |
| P7 | Docs + interpretation + final CI assembly | all |

Parallelizable groups: {WP-01..03} ∥ {WP-06..08} ∥ {WP-14, WP-16}; then
{WP-04, WP-05} ∥ {WP-09, WP-10} ∥ {WP-11}; then {WP-17..20} ∥ {WP-22, WP-23}; docs last.
Full dependency graph and per-package briefs: [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md).

## 5. Quality gates (final CI)

All jobs blocking except `bench` and `swiss-crosscheck`. `working-directory: project`.
Branch protection requires the blocking jobs.

| Job | Runs | Pass threshold |
|-----|------|----------------|
| `core-tests` (Node 20 + 22) | `npm ci && npm test` | 100% assertions (~493 → 700+), incl. 1,296,000-point sweep + unified no-float audit + negative self-test |
| `lint` | `npm run lint` | 0 errors |
| `accuracy` | `npm run test:accuracy` | planets ≤ 60″, Moon ≤ 120″ (documented exception), cusps ≤ 30″ vs committed reference vectors; retrograde flags exact |
| `ui-logic` | ported presentation suites | 100% |
| `claims` | `node scripts/check-claims.mjs` | README counts == live counts; every public export documented |
| `schema-validate` | `importLedger` over repo `*.ledger.json` | 0 rejects |
| `bench` (non-blocking) | `npm run bench -- --assert` | 3× local thresholds; timings uploaded as artifact |
| `swiss-crosscheck` (non-blocking, optional) | swetest vs producer, 3 charts | report-only (keeps AGPL out of the dependency tree) |

## 6. Accuracy methodology — 20 reference birth points

Per the audit's own methodology, `project/test/fixtures/reference-vectors.json` will
hold 20 diverse birth data points with per-body apparent geocentric ecliptic-of-date
longitudes to 0.1″ from an independent source (JPL Horizons / Swiss Ephemeris), full
provenance per row. Matrix coverage:

- **Centuries & ΔT regimes:** 1700, 1800, 1900, 1912, 1941, 1955, 1969, 1972, 1987,
  1996, 2000 ×2, 2004, 2015, 2021 ×2, 2022, 2023 ×2, 2050 (extrapolated ΔT).
- **Calendar edges:** 1900 non-leap century vs 2000 leap century, leap days, first leap
  second (1972-06-30), leap-second adjacency (2015).
- **Latitude range:** equator (Quito), mid-latitudes, far south (Ushuaia), high-latitude
  non-polar (Reykjavík), above the polar circle (Tromsø 69.65°N, Longyearbyen 78.22°N —
  exercising the Placidus-undefined fallback path).
- **Timezone traps:** New York 2021-03-14 02:30 EST→EDT (nonexistent local time) and
  2021-11-07 01:30 (ambiguous), Sydney southern-hemisphere DST, London 1970 all-year BST,
  Tokyo no-DST.
- **Retrograde stations:** Mercury 2023-04-21 / 2023-05-15, Mars 2022-10-30 /
  2023-01-12, Venus 2023-07-22 — speed sign must flip within ±36 h of the published
  instant.
- **Cross-check anchor:** Meeus Example 12.a (1987-04-10, Greenwich) for GMST; J2000
  epoch (2000-01-01 12:00 TT ≈ UTC) for everything.

## 7. Decisions of record (defaults; owner may override)

1. **LICENSE** — none added by this plan; MIT recommended. Owner decision.
2. **Stale 2.07 MB standalone bundle** — delete + provide regeneration script.
3. **astronomy-engine vendored in-repo** (~330 KB, pinned + sha256) — yes, for offline
   capability and supply-chain stability.
4. **Moon 120″ accuracy exception** — documented astronomy-engine limitation; still well
   inside the audit's "few arcminutes" bar.
5. **HTTP-serve requirement** — the ESM shim breaks `file://` double-click; README
   documents `npx serve project`.
6. **`tests.jsx`** demoted to a browser smoke page after its suites are ported to Node;
   the Node ports are canonical.
7. **Playwright/axe automation** out of scope for now (no bundler); accessibility is
   verified manually and documented. Available as a stretch phase.

## 8. Audit-item → plan traceability

| Audit item | Addressed by |
|------------|--------------|
| Tests + CI/CD | WP-02..05, 10, 16, 22, 23, 26 |
| Modular refactor | WP-21 (presentation logic extraction), WP-07/08/11 (producer modules) |
| Documented inputs/outputs | WP-27, WP-28 |
| Input validation / error prevention | WP-18, WP-19 |
| UX flow feedback / terminology | WP-17 (provenance badges), WP-19 |
| House/zodiac options | WP-11, WP-12, WP-13 |
| Astronomical accuracy vs references | WP-06..10 (ephemeris, timescales, fixtures, gate) |
| Retrograde correctness | WP-08, WP-10 |
| Time standards (ΔT/TT/sidereal/DST) | WP-07, WP-18 |
| Performance benchmarks | WP-24 |
| Accessibility + privacy | WP-20 |
| Interpretation engine | WP-29 |
| Claim integrity (repo-specific) | WP-02, WP-03, WP-15 |
