# Contributing

This repo has two regimes with a hard boundary between them (see
[`README.md`'s Architecture section](README.md#architecture)): an exact
BigInt core under `project/src/core/` that may never touch a float, and
everything else — `project/tools/`, `project/src/present/`, `project/src/ledger/`,
and the `.jsx`/`.html` presentation layer — where floats, `Date`, and
third-party libraries are fine. Most of what follows exists to keep that
boundary honest as the codebase grows.

---

## Test-first workflow

Tests are hand-rolled suites, not a framework (no Jest/Mocha/Vitest). Each
suite is a file `project/test/<name>.test.js` that exports a `run()`
function returning an array of `{name, ok, detail}` rows — one row per
assertion.

**To add a new test suite:** drop a `*.test.js` file in `project/test/`
(or a subdirectory, e.g. `project/test/present/`) that exports `run()`.
That's it — `project/test/run.js` auto-discovers every `*.test.js` file
under `test/` (recursively) and runs it. There is no registration step and
no file to edit; the runner even prints the discovered suite list on every
run so drift is visible. (A small, justified `EXCLUDE` list in `run.js`
exists for files that genuinely cannot run under Node — e.g.
`no-float-core.test.js`, the browser-only twin of the no-float audit — but
adding a suite of your own should never require touching that list.)

Copy the pattern from any existing suite, e.g. `project/test/ledger.test.js`
or `project/test/timescale.test.js`.

**Standing invariant:** `cd project && npm test` must exit 0. The assertion
count only ever grows — a change that reduces it (short of a documented,
deliberate test removal explained in the PR) is a regression, not a
refactor. Run `npm run test:quick` while iterating (skips the exhaustive
1,296,000-point ring sweep) and the full `npm test` before you're done.

---

## Mandate A1 — nothing under `src/core/` touches a float

**Rule:** no file under `project/src/core/` may contain floats, `Math.*`,
`Number(`, `parseFloat`, `parseInt`, `Date` (`new Date`, `Date.now`), a
`.toFixed()` call, or a decimal literal (`0.5`, `1.5e3`, …). Longitudes in
the core are integer arcseconds (`BigInt`, `[0, 1296000)`), never float
degrees. New astronomy/ephemeris code belongs in `project/tools/`,
`project/src/present/`, or a presentation `.jsx` file — never `src/core/`.

This is not a style guideline; it's mechanically enforced by the **no-float
audit**, and there are two independent gates that both have to see every
core file:

- **Node** — `project/test/run.js` reads every file in
  `project/src/core/` from disk (via `readdirSync`) and audits it.
- **Browser** — `Core Test Harness.html` (via
  `project/test/no-float-core.test.js`) fetches the same sources over HTTP
  and runs the identical audit.

Both gates import a single shared module, `project/test/no-float-audit.js`,
which is the one place the forbidden-pattern list, the comment/string
stripping logic (so a *comment* naming `Math.floor` isn't itself flagged),
and — critically — the list of audited files (`CORE_MANIFEST`) all live.

**How to add a new core module so both gates see it:**

1. Add the file under `project/src/core/`.
2. Add its bare filename to `CORE_MANIFEST` in `project/test/no-float-audit.js`
   (an alphabetically-sorted array near the top of the file).
3. Run `npm test`. `project/test/no-float-selftest.test.js` asserts
   `CORE_MANIFEST` equals the real `project/src/core/` directory listing —
   it fails loudly if you forget step 2, so a new module cannot silently
   escape the browser gate.

That's the entire mechanism — there is no separate browser-side file list
to hunt down and update by hand.

---

## Commit conventions

This repo's own execution plan (`project/docs/EXECUTION_PLAN.md`,
`project/docs/EXECUTION_STATUS.md`) was built as 29 work packages, each
committed with a `WP-NN:` prefix and a body explaining *why*, not just what
changed — e.g. `WP-08: ledger producer CLI` with a body describing the
admission contract it fulfills. That's a reasonable model to follow loosely
(a short, specific subject line; a body that explains the reasoning,
especially for anything touching the core/ledger boundary or an accuracy
threshold) — it is not a format this repo enforces on outside
contributions, so don't feel obligated to invent a `WP-NN` id for your own
change.

---

## Before committing

- **`node scripts/check-claims.mjs`** (run from the repo root) — keeps the
  README banner (`N/N assertions · ... · M/M core modules float-free`)
  honest against the live test output, and (since WP-27) additionally
  checks that every exported name from `project/src/core/*.js` appears
  somewhere in `project/docs/INPUTS_OUTPUTS.md`. If your change adds or
  removes test assertions, run `node scripts/check-claims.mjs --fix` to
  rewrite the banner numbers in place (it touches only those numbers, never
  the rest of the file), then re-run without `--fix` to confirm it now
  reports `OK`. If you add a new core export, add it to
  `project/docs/INPUTS_OUTPUTS.md` yourself first — there is deliberately
  no `--fix` for missing documentation.
- **`cd project && npm run lint`** — must be clean. The flat ESLint config
  (`eslint.config.mjs`, repo root) covers `project/src/**`, `project/test/**`,
  `project/tools/**`, and `scripts/**`.
- **`cd project && npm test`** — must exit 0 with the assertion count
  unchanged or increased.
