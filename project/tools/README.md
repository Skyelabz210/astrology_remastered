# project/tools/

Build- and producer-side tooling. This directory (plus the presentation layer —
`project/src/present/` and the `.jsx` pages) is the **only** place the
`astronomy-engine` npm dependency (pinned `2.1.19` in `project/package.json`)
may be imported from.

## The boundary rule

`astronomy-engine` computes float-degree ephemeris positions. `project/src/core/`
is BigInt-only exact integer arithmetic (Mandate A1: no floats, `Math.*`,
`Number(`, `parseFloat`, `parseInt`, `Date`, or decimal literals — see the
repository root `README.md` and `EXECUTION_PLAN.md`'s Conventions section).
Astronomy code therefore never lives in `src/core/` and `src/core/` never
imports `astronomy-engine` (directly or transitively).

The float positions this dependency produces cross into the exact-integer core
by exactly one door: rounded to an integer arcsecond string and admitted
through `project/src/ledger/import-ledger.js` (`importLedger` /
`admitForCore`), which validates the ledger schema
(`project/src/ledger/ephemeris-ledger-schema.json`) and rejects anything not
schema-conformant — including `SYNTHETIC_DEMO`-certified entries. Nothing
downstream of that gate is allowed to still be a float.

Enforcement is mechanical, not aspirational: `project/test/no-float-audit.js`
scans every file listed in its `CORE_MANIFEST` (i.e. every module actually
under `src/core/`) for the forbidden constructs above, and
`project/test/no-float-selftest.test.js` asserts that manifest equals the real
`src/core/` directory listing — so a new core module can't quietly opt out of
the scan, and an accidental `import "astronomy-engine"` inside `src/core/`
would trip the audit the moment it used anything the engine returns (a float
degree, `Math.*`, or similar) in that file.

## What's here

- `ephemeris/` (arriving with WP-07/WP-08) — `timescale.js` (ΔT, GMST/GAST,
  obliquity), `produce-ledger.mjs` (the CLI that calls `astronomy-engine` and
  emits schema-conformant ledger entries), `houses.js` (WP-11/12),
  `fetch-horizons.mjs` (WP-09, reference-vector regeneration; not run in CI).
- `build-standalone.mjs` (WP-25) — regenerates a single-file, offline-openable
  `dist/standalone.html` from the live `HCRM Console.html` page. See below.

## build-standalone.mjs (WP-25)

`HCRM Console.html` (the live page) is normally served over HTTP
(`npx serve project`) and loads its `.jsx` files via a `<script
type="text/babel">` + babel-standalone CDN combo, plus a `type="module"`
`core-shim.js` that imports the real `src/core/`/`src/ledger/` ESM graph.
Both of those load paths are broken when the HTML is opened directly off
disk (`file://`): module `import` is blocked cross-origin under `file://`,
and the babel-standalone/React/ReactDOM `<script src="https://unpkg.com/...">`
tags need network access.

Run from `project/`:

```sh
node tools/build-standalone.mjs
```

This reads `HCRM Console.html` and, walking its `<link>`/`<script>` tags in
document order (so it tracks whatever the live page actually loads — nothing
about the asset list is hardcoded), inlines everything into
`project/dist/standalone.html` (git-ignored, per the root `.gitignore`
`dist/` rule from WP-01 — re-run the build after pulling changes, don't
expect a stale copy to be committed):

- **CSS** (`styles.css`, `hcrm.css`) — inlined as `<style>`.
- **JSX pages** (`astro.jsx`, `cities.jsx`, `globe.jsx`, `landing.jsx`,
  `hcrm.jsx`, `hcrm-view.jsx`, `hcrm-app.jsx`) — pre-transpiled with
  `@babel/core` + `@babel/preset-react` (classic runtime, matching
  babel-standalone's `data-presets="react"` behavior) and inlined as plain
  `<script>`.
- **`core-shim.js` / `tzresolve.js`** (real ES modules, importing the
  `src/core/`/`src/ledger/` graph) — bundled into a single IIFE with
  `esbuild` (`buildSync`, `bundle: true, format: "iife"`) and inlined as a
  plain `<script>`, so `window.HCRM_CORE` / `window.TzResolve` are populated
  with no runtime `import` left at all.
- **`vendor/astronomy.browser.min.js`** — inlined verbatim (already a plain
  UMD script, WP-17).
- **React / ReactDOM** — swapped from the live page's
  `unpkg.com/react@18.3.1`/`react-dom@18.3.1` CDN `<script>` tags for the
  matching local `node_modules/react{,-dom}/umd/*.development.js` UMD
  builds and inlined.
- **babel-standalone** — dropped entirely (JSX is already pre-transpiled at
  build time, so the in-browser transpiler is dead weight offline).

Requires `@babel/core`, `@babel/preset-react`, `esbuild`, `react`, and
`react-dom` as devDependencies (pinned to `react`/`react-dom` `18.3.1` to
match the live page). If they're missing, `npm install --save-dev
@babel/core @babel/preset-react esbuild react@18.3.1 react-dom@18.3.1` from
`project/` first — check `ls node_modules/@babel/core` etc. before
re-installing. The script fails loudly (does not silently fall back to a
CDN `<script>`) if a required local package is missing, rather than
emitting a bundle it can't honestly call offline-capable.

**Known gap:** the Google Fonts `<link rel="stylesheet"
href="https://fonts.googleapis.com/...">` on the live page is left as-is —
cosmetic only (falls back to the system serif/sans stack offline), and
vendoring webfont files was judged out of scope for this package.

Verified (this session): the emitted `dist/standalone.html` was smoke-tested
with a real headless Chromium (`playwright-core`, installed with
`--no-save` for the one-off check, not a project dependency) opened via a
`file://` URL — the app rendered its full register-ledger UI with real
computed chart data and no JS console errors other than the expected
Google Fonts network failure.

## Using astronomy-engine here

```js
import * as Astronomy from "astronomy-engine";
```

`project/package.json` is the sole `package.json` for this repository (there is
no root-level one); `npm ci` run from `project/` is what installs this
dependency, and `project/package-lock.json` pins its resolved tree.
