# Execution Status — Audit Remediation

Live todo ledger for [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md). Last updated
2026-08-11: **all 29 work packages complete, verified, and merged to `main`.**
The plan is done. This file is kept as the historical record of what was
built and how — see "Flagged for owner decision" below for the one item this
plan deliberately left for the repo owner rather than resolving unilaterally.

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
      |lat| > 66.56°. **Known gap (closed by WP-12, see below):** at landing
      time Placidus was verified only against an independent exact closed
      form at the equator and internal consistency checks (cusp1/4/7/10 vs.
      `ascMc`, opposite-cusp symmetry) — no external reference was available.
- [x] **WP-09** Reference vectors — `project/test/fixtures/reference-vectors.json`
      (20 points × 10 bodies, built from the already-committed
      `horizons-prefetch.json`, full provenance) + `project/tools/ephemeris/
      fetch-horizons.mjs` (the regeneration path — **live-tested against the
      real Horizons API in this session**, not just written blind; that
      testing caught and fixed a real bug in the barycenter-substitution
      cutoff instants) + `project/test/fixtures.test.js` (1727 shape/range/
      provenance assertions over the fixture itself).
- [x] **WP-12** Remaining quadrant house systems — `houses.js` gains Koch,
      Regiomontanus, Campanus, Alcabitius, Topocentric, Morinus, Meridian,
      and a float Porphyry cross-checked against the exact core's
      `porphyryCusps` (~1e-10″ agreement). Registry `"OPEN"` → `"LEDGER"` in
      `variants.js` (string-only). **Closes WP-11's disclosed gap:**
      `pip install pyswisseph` worked in this session; every system (incl.
      Placidus) is now cross-checked against genuine Swiss Ephemeris output
      at 5 diverse charts (540 comparisons), worst residual ~12.5″, well
      inside the ≤30″ bar — residual attributed to mean-vs-true obliquity,
      confirmed uniform across systems/charts (not a per-system bug).
- [x] **WP-17** Real ephemeris in the browser — vendored astronomy-engine
      2.1.19 UMD build (`project/vendor/`, MIT, SHA-256 recorded) loads before
      `astro.jsx` on the 5 pages that use it. `planetLongitude`/`planetSpeed`/
      `isRetrograde` now compute real positions when `window.Astronomy` is
      present, with `isRetrograde` deriving from `planetSpeed`'s own sign —
      **the actual fix for the historical speed/retrograde-flag
      inconsistency**. Synthetic fallback verified byte-for-byte unchanged
      for offline/unmodeled bodies (NorthNode/Chiron/Lilith).
      `window.EPHEMERIS_MODE` set unconditionally for WP-19's future badge.
- [x] **WP-10** Accuracy gate + retrograde/station tests — `project/test/
      accuracy.test.js` (212 assertions): 200 circular-difference comparisons
      (20 JPL Horizons fixture points × 10 bodies) between `produce-ledger.mjs`
      and independent reference data, 60″ tolerance (120″ Moon, documented
      astronomy-engine-vs-DE441 lunar-theory divergence). **Observed:** worst
      mean error Neptune ~10.4″, worst single-point error Pluto ~29.5″ — both
      well inside tolerance and inside the audit's own "few arcminutes" bar by
      an order of magnitude. `project/test/retrograde.test.js` (258
      assertions): station sign-flips within ±36h for all 5 published
      stations, retro-flag ≡ (speed<0) across all 200 fixtures, Sun/Moon never
      retrograde. Corruption-discriminator check confirmed the tolerance
      actually catches a >5′ error.
- [x] **WP-13** House cusps into the ledger — schema v1.1 (additive:
      `body` documents ASC/MC/CUSP_1..12, optional `house_system` field;
      confirmed backward compatible against WP-16's `ledger.test.js`
      unmodified). `produce-ledger.mjs` gains `--houses <systems>` and
      exported `produceHouseLedgerEntries()`; sample run emits 24 entries
      (10 planets + 14 house points), all independently re-validated through
      the real `admitForCore()` gate. `accuracy.test.js` gains a house-cusp
      block reusing `houses.test.js`'s proven Swiss Ephemeris reference data.
      **Process note:** this package ran concurrently with WP-18 in the same
      working tree; its true isolated assertion count (4113) was computed in
      a throwaway `git worktree` to avoid the README banner claiming a count
      that included WP-18's not-yet-committed assertions — see that commit's
      message for the mechanics if this pattern recurs.
- [x] **WP-18** DST-correct time + unknown-time flag — `project/tzresolve.js`:
      dependency-free local-civil-time → UTC-instant resolver (guess-and-
      correct against `Intl`'s tzdata), correctly classifying spring-forward
      gaps (`kind:"nonexistent"`) and fall-back overlaps
      (`kind:"ambiguous"`) rather than silently picking a wrong instant.
      `cities.jsx`'s 339 entries gain a verified IANA `tz` field (0
      Jan/Jul-offset mismatches against the legacy `off` field). `landing.jsx`
      gains a "Time unknown" checkbox; `chart.timeUnknown` threads through to
      `computeNatal()` for a future package (WP-19/29) to suppress ASC/MC
      precision claims. Verified: NY spring-forward/fall-back, London 1970
      permanent-BST (actually verified against Node's ICU, not assumed),
      Sydney southern DST.
- [x] **WP-25** Standalone bundle regeneration — deleted the stale,
      un-regeneratable 2.07 MB `HCRM Console (standalone).html`; replaced
      with `project/tools/build-standalone.mjs`, which generically discovers
      `HCRM Console.html`'s own script/link tags (no hardcoded file list —
      proven by picking up WP-19's and WP-21's new tags with zero code
      changes when re-run after both landed) and inlines everything needed
      to run offline: CSS, pre-transpiled JSX, the ESM graph bundled via
      esbuild, the vendored astronomy-engine build, and local React/ReactDOM
      UMD builds in place of the CDN tags. Only Google Fonts remains
      CDN-referenced (cosmetic-only, documented). **Verified in a real
      browser** (Chromium/Playwright, `file://`): the regenerated bundle
      renders the actual register console with live computed data.
- [x] **WP-21** Extract presentation logic to `src/present/astro-core.js` —
      dignities, terms, faces, triplicities, lots, sect, aspects, patterns,
      critical degrees, joys, antiscia, lunar phase, chart shape, and CRT
      residues moved out of `astro.jsx` into a dual-environment ES module;
      `astro.jsx` becomes data tables + thin wrappers, with all
      ephemeris-adjacent code (WP-17's real/synthetic branching,
      `EPHEMERIS_MODE`) and `computeNatal`'s orchestration (WP-18's
      `timeUnknown`) left untouched. `src/present/` confirmed outside the
      no-float audit's scan. Zero net assertions (pure refactor) — verified
      via a throwaway worktree, and WP-17's `astro-ephemeris.test.js`
      passes with the exact same 67/67 pinned values, proving ephemeris
      behavior is unaffected.
- [x] **WP-19** Input validation & visible errors — `validate.js`
      (real-calendar-date, lat/lng range validation, `polarHouseWarning`
      reading the actual `POLAR_FALLBACK_POLICY` table); the ±66°
      latitude clamp is **gone** — the full -90..90 range is enterable, with
      keystroke-level validation that never corrupts chart state on an
      invalid mid-edit value. `ChartStatusBanners`/`HcrmStatusBanners`
      surface the SYNTHETIC-ephemeris badge, a polar house-system warning,
      and WP-18's DST ambiguous/nonexistent + unknown-time notes.
      `errors.jsx` replaces all four `console.error → return null`
      chart-builder catches with a visible error banner, plus a real
      `ErrorBoundary` for render-time failures. All 12 required UX scenarios
      documented in `project/docs/ux-validation-checklist.md`, most verified
      live via a real React/`react-dom/server` render against the actual
      components. **Honest caveat on record:** the polar-latitude warning is
      fully implemented and tested, but the shipped house picker only
      offers Whole/Equal (the only two `astro.jsx` computes), so it's not
      yet reachable through the live UI — flagged, not hidden.
      **End-to-end confirmation:** the WP-25 standalone bundle, rebuilt
      against the full combined tree, rendered correctly in a real browser
      — proof all three packages compose.

- [x] **WP-24** Performance benchmarks — `project/bench/bench.mjs`: full
      natal chart, single-body longitude, and a 14-body aspect scan, each
      with warm-up + multiple iterations (min/median/mean/max). `--assert`
      gates CI at 3× the target for variance headroom. **Observed:** every
      threshold passes by 2+ orders of magnitude (full chart ~1.3ms vs
      250ms target; single-body ~0.04ms vs 5ms; aspect scan ~0.01ms vs
      10ms). Ring-sweep wall time (~272ms) reported informationally.
- [x] **WP-22** Port `tests.jsx` to CLI — all ~20 browser-only suites
      (155 assertions) ported faithfully to `project/test/present/` across
      4 files, split by actual source module (`astro-core.js`, `astro.jsx`
      itself via `node:vm`, `readings.jsx`, `time.jsx` — not all of
      `tests.jsx` tested `astro-core.js` alone). Nothing dropped:
      89+18+31+17 = 155 matches the original total exactly.
      **Bug fix of record:** `test/run.js`'s suite discovery was not
      actually recursive (`readdirSync(HERE)` without `{recursive: true}`)
      — verified empirically with a probe file before fixing; without this,
      the new `test/present/` subdirectory would have been silently
      invisible to `npm test`.
- [x] **WP-20** Accessibility & privacy — real WCAG AA contrast math
      (OKLCH→sRGB→luminance, `project/src/present/contrast.js`) found and
      fixed two failing pairs in `styles.css` (`--ink-dim` was 4.15:1/
      4.00:1 against its two backgrounds, needs 4.5:1; raised to
      5.10:1/4.92:1), cross-checked against the live CSS token by a test so
      the two can't drift apart again. Keyboard-accessibility gap fixed:
      `card.jsx`'s whole-card flip control was mouse-only (`<div onClick>`,
      no keyboard path at all) — now a real focusable, Enter/Space-operable
      control. `project/a11y-table.jsx` gives screen readers a real
      `<table>` alternative to the visual chart.
      **Bug caught during integration verification, not by any automated
      gate:** a JSX comment placed directly inside `return (...)` in
      `hcrm-view.jsx` is invalid syntax and silently broke Babel parsing of
      the whole file — eslint didn't catch it (JSX parse happens in a
      different tool); only rebuilding WP-25's standalone bundle against
      the combined tree surfaced it. Fixed and reverified with a live
      Chromium render.
      **Privacy finding — flagged for owner decision, not silently fixed
      or hidden (see "Flagged for owner decision" below).**
- [x] **WP-26** CI final assembly — `.github/workflows/ci.yml` activated
      into its final form: `core-tests`/`claims`/`lint`/`accuracy`/
      `schema-validate` all blocking, `bench` non-blocking with artifact
      upload. `ui-logic` and `swiss-crosscheck` deliberately NOT made
      separate jobs — both reasoned through and documented inline in
      `ci.yml` rather than silently dropped (WP-22's port made `ui-logic`
      redundant with `core-tests`; the pyswisseph cross-check's results are
      already baked into `accuracy`'s committed assertions, so a live
      Python job would add fragile toolchain risk for zero new coverage).
      New `project/tools/validate-ledgers.mjs` for the `schema-validate`
      job. Every blocking job's exact command reproduced locally.
- [x] **WP-27** Inputs/outputs documentation + JSDoc —
      `project/docs/INPUTS_OUTPUTS.md`: every exported function across all
      20 core modules plus the ledger/producer/houses/timescale layers,
      organized around the one distinction that matters (BigInt arcsec vs.
      float degrees, stated explicitly per entry). JSDoc added to all 20
      `src/core/*.js` files — **verified line-by-line that every changed
      line is a comment**, no-float audit reconfirmed 20/20 independently
      of the subagent's own report. `check-claims.mjs` gained a new,
      un-fixable CHECK that every core export is named somewhere in the
      doc; verified with a real negative test (planted a fake export,
      confirmed it's caught and named precisely, reverted, reconfirmed
      pass). **Process note:** an orchestrator error during review
      (`git checkout --` used to revert a deliberate test-only change)
      accidentally reverted this package's own legitimate JSDoc on
      `residues.js` along with it — caught immediately by checking the
      file's diff was empty when it shouldn't have been, and the missing
      documentation was rewritten to match the same convention used
      elsewhere before committing. Worth remembering: `git checkout --
      <path>` discards the *entire* working-tree diff for that path, not
      just the change you're trying to undo — prefer reverting a specific
      hunk, or re-applying just the intended change, when a file has other
      legitimate uncommitted work on it.
- [x] **WP-29** Interpretation engine improvements — `readings.jsx` now
      surfaces sect/triplicity/term/face statements astro.jsx already
      computed but never showed; every statement is `{text, sourceTag}`
      naming its actual method (including honest non-classical tags for
      this app's own mod-11/13 substrate aspects, not a false classical
      label). `chart.timeUnknown` now genuinely suppresses house/Ascendant
      language (statements are absent, not caveated) since astro.jsx
      assigns a house number even with an assumed birth time. Phrasing
      softened per the audit's anti-overclaiming guidance. `card.jsx`
      (the only other consumer) updated for the new statement shape.

**Assertion count: 493/493 → 4404/4404** (+13 timescale, +169 producer, +794
houses total, +1727 fixtures, +67 astro-ephemeris, +212 accuracy, +258
retrograde, +277 house-cusp-ledger, +24 tzresolve, +49 validate, +155
tests.jsx-port, +44 a11y/contrast, +19 readings; WP-03/05/06/15/04/25/21/24/26/27
were doc/tooling/CI/refactor/bench packages, no new assertions). README banner
is machine-checked by `scripts/check-claims.mjs`; `npm run lint` is clean.
**Process notes:**
(1) WP-07's PR (#4) shipped with a stale README banner because
`check-claims.mjs --fix` wasn't re-run after adding tests — CI caught it
before merge; the `claims` CI job itself was also missing `npm ci` and broke
on PR #5 the same way, once the suite gained a real dependency. (2) When two
packages run concurrently in the same working tree and one extends a file the
other creates (WP-10→WP-13) or both add test suites simultaneously
(WP-13/WP-18, and again WP-19/WP-21 in Batch G), the shared tree's live
`npm test` count is contaminated by whichever sibling's files are also
sitting uncommitted — verify a package's *own* isolated count via a
throwaway `git worktree` (`git worktree add --detach <path> HEAD`, apply
just that package's diff, test, discard) before trusting its README banner.
(3) When 3 packages share a batch and two of them touch the *same* shared
file (e.g. HTML `<script>` tags, `eslint.config.mjs` carve-outs) in small,
practically-inseparable hunks, don't fight the diff — commit that shared
file once, in its final combined state, in whichever package's commit lands
last, and say so explicitly in both commit messages. (4) End-to-end
smoke-testing across concurrently-landed UI packages is worth doing once,
after all of them land: WP-25's real-browser render of the fully combined
tree caught nothing broken here, but it's the only check that would have.
Every package has run `--fix` + verify as a mandatory last step since; keep
doing this.

## Flagged for owner decision

- **`agent.jsx`'s LLM interpretation feature is on by default and sends raw
  birth data.** `app.jsx`'s `DEFAULT_SETTINGS.agentOn = true`; the instant a
  chart resolves, `useAgentChartReading` calls `window.claude.complete()`
  with a prompt (`buildChartPrompt`, `agent.jsx`) that embeds
  `chart.birth.dateISO`, `chart.birth.lat`, `chart.birth.lng` **verbatim**.
  The only in-repo opt-out (`SubstrateTweaks`'s "Agent interpreter" toggle)
  lives inside `tweaks-panel.jsx`, which only opens on an
  `__activate_edit_mode` `postMessage` from a *host* iframe — in a
  standalone deployment (`npx serve project`, no host frame) there is **no
  reachable UI control** to turn this off. WP-20 (Batch H) verified this by
  reading the code directly (not just trusting a prior report) and chose to
  disclose it honestly in the landing-page privacy note rather than
  silently changing the default or bolting on a new opt-out mechanism —
  both are product decisions outside a single work package's scope. If this
  matters to you: options are (a) flip the default to `agentOn: false`,
  (b) add a standalone-reachable toggle (e.g. a visible settings icon, not
  only the iframe-host protocol), or (c) accept the current behavior with
  the disclosure as sufficient. Not resolved by any later package unless
  explicitly requested.

## Prefetched assets (do not re-fetch)

- **`project/test/fixtures/horizons-prefetch.json`** — parsed JPL Horizons (DE441)
  apparent geocentric ecliptic-of-date longitudes/latitudes for all 20 reference
  instants × 10 bodies (5 pre-1800 outer-planet cells substituted from system
  barycenters, each carrying a `note`; offset < 0.1″), plus retrograde-station
  sign-change brackets for Mercury/Mars/Venus (2022–2023). Full provenance in
  `meta`. **WP-09 should build `reference-vectors.json` from this file** rather
  than re-querying Horizons; the committed `fetch-horizons.mjs` script it writes
  remains the regeneration path.

## Remaining

None. **WP-28** (README rewrite + CONTRIBUTING, the final package) landed
last: `README.md` gained a Quickstart, a real Architecture diagram of the
four layers this plan built, an Accuracy statement with the actual observed
numbers and the CI job enforcing them, a documentation map, and an honest
pointer to the one flagged-not-resolved item below; `CONTRIBUTING.md` is new,
covering the test-first workflow, Mandate A1 and the `CORE_MANIFEST`
mechanism, and the pre-commit checklist.

## Standing conventions for whoever resumes (or extends this plan)

1. `cd project && npm test` must stay green; count only grows (baseline now 4404).
2. Mandate A1: no float constructs under `src/core/` — the audit + self-test enforce.
3. New test suites: drop `test/<name>.test.js` exporting `run()`; no runner edit.
4. New core modules: add to `CORE_MANIFEST` in `test/no-float-audit.js` (the
   self-test fails until you do).
5. Commit per package, message prefixed `WP-NN:`; no LICENSE file (owner decision
   pending).
6. Batch structure, file-conflict notes, and full briefs: `EXECUTION_PLAN.md`.
