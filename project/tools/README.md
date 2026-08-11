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
- `build-standalone.mjs` (arriving with WP-25) — pre-transpiles the JSX bundle
  and vendors `astronomy-engine` into a single offline HTML file.

## Using astronomy-engine here

```js
import * as Astronomy from "astronomy-engine";
```

`project/package.json` is the sole `package.json` for this repository (there is
no root-level one); `npm ci` run from `project/` is what installs this
dependency, and `project/package-lock.json` pins its resolved tree.
