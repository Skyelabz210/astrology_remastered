// eslint.config.mjs — root flat config. (WP-05)
//
// Scope: project/src/**, project/test/**, project/tools/**, scripts/** (the
// latter two are largely empty until WP-06+/WP-03 land — the globs just pick
// their files up automatically once they exist, no edit needed here).
//
// Deliberately excluded:
//   · project/*.jsx           — Babel-standalone JSX, not valid plain JS syntax;
//                                no parser is configured for it here.
//   · project/vendor/**       — third-party vendored code (arrives with WP-17),
//                                not ours to lint.
//   · project/*.js at the project root EXCEPT core-shim.js — api-ref.js,
//     cram-api.js, cram-calc.js, cram-int.js are pre-existing browser-global
//     scripts (IIFEs closing over `window`/`document`, IDs assumed present in
//     the HTML pages that load them). They were tried against this config
//     (browser globals + eslint:recommended) and do not lint clean as-is
//     (undeclared page-specific DOM ids, intentional loose patterns in legacy
//     code) — fixing them is a behavior-risking rewrite out of scope for a
//     tooling-only package, so they stay unlinted for now. core-shim.js IS an
//     ES module (import/export, `typeof window` guard) and lints clean, so it
//     is included.
//
// Invocation note: `files`/`ignores` globs below are resolved relative to
// process.cwd() at the moment eslint runs — NOT relative to this file's own
// location — whenever `--config` is passed explicitly (verified against this
// eslint version's source, lib/config/config-loader.js:
// `locateConfigFileToUse`: basePath = cwd unless eslint auto-discovers the
// config by searching upward, which we don't rely on). `project/package.json`'s
// "lint" script therefore `cd`s to the repo root before invoking eslint, so
// cwd = repo root here and every pattern below is repo-root-relative, matching
// the paths as written.
//
// Resolution note: this file lives at the repo root, but eslint/@eslint/js/
// globals are installed only under project/node_modules (project/package.json
// is the sole package manifest per the plan — see project/tools/README.md and
// EXECUTION_PLAN.md WP-05/06). Plain `import "@eslint/js"` from a file at the
// repo root would walk node_modules from the root's ANCESTORS, never finding a
// CHILD directory — so bare specifiers are loaded via a require() scoped to a
// path inside project/ instead (Node's CJS algorithm checks that directory's
// own node_modules first). Both packages ship as CommonJS, so this is safe.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, "project", "package.json"));

const js = require("@eslint/js");
const globals = require("globals");

// The codebase is BigInt-heavy (Mandate A1 pushes all core arithmetic through
// BigInt rather than Number) — `globals.es2022`/ecmaVersion 2022 covers the
// `BigInt` global plus every other ES2022 builtin (Array, JSON, Map, Set,
// Promise, Reflect, globalThis, ...).
const ES_GLOBALS = globals.es2022;
const NODE_GLOBALS = { ...ES_GLOBALS, ...globals.node };
// no-float-core.test.js is a deliberate browser twin of the Node no-float
// audit (see test/no-float-audit.js) — it uses `fetch()` (a Node global too)
// and `location` (browser-only) to detect file:// vs http serving. Declaring
// just that one extra global keeps test/** otherwise honestly Node-scoped
// instead of pulling in the full browser global set.
const TEST_GLOBALS = { ...NODE_GLOBALS, location: "readonly" };

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "project/vendor/**",
      "project/*.jsx",
      "project/*.js",
      "!project/core-shim.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["project/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: ES_GLOBALS,
    },
  },
  {
    // src/demo is the labelled synthetic/presentation boundary (never src/core
    // — see src/demo/SYNTHETIC_DEMO.js's own header) and logs a console
    // banner when a demo surface boots; console is otherwise deliberately not
    // a global anywhere under src/** so a stray console.log in src/core is
    // still a lint error, not just an A1 audit finding.
    files: ["project/src/demo/**/*.js"],
    languageOptions: {
      globals: { console: "readonly" },
    },
  },
  {
    files: ["project/test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: TEST_GLOBALS,
    },
    rules: {
      // The hand-rolled suites assert self-checking literal arithmetic
      // ("59n * 509n === 30031n && <the actual behavior under test>") as a
      // deliberate convention — the left operand documents the fact being
      // relied on and re-verifies it every run, chained with && into the
      // real assertion. eslint:recommended's no-constant-binary-expression
      // reads that as "left side is always truthy, the && is dead" (a
      // sensible default for hand-written app logic) but it is exactly the
      // pattern this codebase's tests intentionally use throughout — see
      // e.g. test/cram.test.js, test/anchor.test.js, test/variant-coverage.test.js.
      "no-constant-binary-expression": "off",
    },
  },
  {
    // project/bench/** (WP-24) is a Node CLI benchmark script, same shape
    // as project/tools/** and scripts/** — process/console as globals.
    files: ["project/tools/**/*.{js,mjs}", "project/bench/**/*.{js,mjs}", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: NODE_GLOBALS,
    },
  },
  {
    files: ["project/core-shim.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...ES_GLOBALS, window: "readonly" },
    },
  },
  {
    // project/src/present/astro-core.js (WP-21) is, like core-shim.js
    // above, a dual-environment ES module whose bottom guard
    // (`if (typeof window !== "undefined")`) publishes onto `window` for
    // the browser side of the bridge — it needs `window` declared as a
    // global for the same reason core-shim.js does.
    files: ["project/src/present/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...ES_GLOBALS, window: "readonly" },
    },
  },
  {
    // project/tools/ephemeris/houses.js (WP-19) gains the same
    // dual-environment `if (typeof window !== "undefined") window.X = ...`
    // publish tzresolve.js/core-shim.js/astro-core.js use — this file is
    // otherwise plain Node-importable (produce-ledger.mjs, its own test
    // suite), so only it (not the whole tools/ephemeris/**) needs `window`
    // declared as a global.
    files: ["project/tools/ephemeris/houses.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...NODE_GLOBALS, window: "readonly" },
    },
  },
];
