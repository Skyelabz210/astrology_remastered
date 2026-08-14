// test/no-float-audit.js — single source of truth for the no-float audit. (WP-02)
//
// Mandate A1: nothing under src/core/ may contain floats, Math.*, Number(),
// parseFloat, parseInt, Date, or decimal literals. Two gates enforce this:
//
//   · Node    — test/run.js reads src/core/*.js from disk and audits each file.
//   · Browser — Core Test Harness.html (via test/no-float-core.test.js) fetches
//               the same sources over http and runs the same audit.
//
// Both gates import THIS module, so the pattern list, the comment/string
// stripping, and the audited file list can never drift apart again. The Node
// side (test/no-float-selftest.test.js) asserts CORE_MANIFEST equals the actual
// src/core directory listing, so a new core module cannot silently escape the
// browser gate either.
//
// The audit scans for float CONSTRUCTS, not words: validators.js legitimately
// *names* the things it rejects, so comments and string literals are blanked
// before matching. No BigInt-hostile syntax is used here — but this file is not
// itself under src/core and is not part of the audited surface.

/**
 * Every .js module under src/core, by bare filename, sorted. The browser gate
 * fetches `src/core/<name>` for each entry. ADD NEW CORE MODULES HERE — the
 * Node self-test fails until this list matches the directory exactly.
 */
export const CORE_MANIFEST = [
  "anchor.js",
  "arrow.js",
  "basis.js",
  "carry.js",
  "cram.js",
  "fixture.js",
  "gear-class.js",
  "hcrm-core.js",
  "identity.js",
  "operators.js",
  "residues.js",
  "rho.js",
  "ring.js",
  "safe-basis.js",
  "shadow-spine.js",
  "shell-kelim.js",
  "tower-recover.js",
  "tray.js",
  "validators.js",
  "variants.js",
];

/**
 * Forbidden float constructs as [regex, label] pairs — the union of the two
 * pattern sets that previously lived (and drifted) in run.js and
 * no-float-core.test.js. Applied line-by-line to stripped source.
 */
export const FLOAT_PATTERNS = [
  [/\bNumber\s*\(/, "Number()"],
  [/\bparseFloat\s*\(/, "parseFloat()"],
  [/\bparseInt\s*\(/, "parseInt()"],
  [/\bMath\s*\./, "Math."],
  [/\.toFixed\s*\(/, ".toFixed()"],
  [/\bnew\s+Date\b/, "new Date"],
  [/\bDate\s*\.\s*now\b/, "Date.now"],
  [/(^|[^\w.])\d+\.\d+/, "decimal literal"],
  // Bare-dot form of the same literal (`.5`, `-.25`, …) — JS accepts a
  // decimal point with no leading digit as a valid float literal, but the
  // pattern above requires a digit before the dot and so never saw it. In
  // any syntactically valid JS, a `.` immediately followed by digits and
  // not preceded by a word character or another `.` can only be this: no
  // legal construct (property access, spread, optional chaining, member
  // chains) puts a bare digit run right after a lone `.` any other way.
  [/(^|[^\w.])\.\d+/, "decimal literal (bare-dot)"],
  [/\d+\.\d+[eE][+-]?\d+/, "float exponent"],
  // NOTE: an integer-mantissa exponent with no decimal point (`5e3`) is
  // ALSO a float-typed literal in JS and is deliberately not patterned
  // here — \d+[eE][+-]?\d+ collides with hex literals containing a
  // digit-E-digit run (e.g. 0x1E5), which are legitimate in this repo's
  // BigInt-hex-literal style (0x...n) and would false-positive. If this
  // codebase starts using scientific notation without a decimal point,
  // this gap should be revisited with a hex-aware pattern.
];

// One alternation, applied left-to-right, so a `//` inside a string or a quote
// inside a comment cannot confuse the stripper (whichever token starts first
// wins). Matches are blanked to spaces with newlines kept, so line numbers in
// audit hits stay true. Known parity limitation (same as the audits this file
// replaced): regex literals and `${…}` template interpolations are not lexed.
const LEXER =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\[\s\S])*`/g;

/** Blank comments and string literals, preserving newlines. */
export function stripCommentsAndStrings(src) {
  return src.replace(LEXER, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Audit one (filename, sourceText) pair. Returns a suite-shaped row
 * `{name, ok, detail}`; hits carry 1-based line numbers.
 */
export function auditSource(name, sourceText) {
  const hits = [];
  stripCommentsAndStrings(sourceText)
    .split("\n")
    .forEach((line, i) => {
      for (const [re, label] of FLOAT_PATTERNS) {
        if (re.test(line)) hits.push(`${label} @${i + 1}`);
      }
    });
  return {
    name,
    ok: hits.length === 0,
    detail: hits.length ? "FORBIDDEN: " + hits.join(", ") : "clean (BigInt only)",
  };
}

/** Audit many `[filename, sourceText]` pairs; one row per pair. */
export function auditPairs(pairs) {
  return pairs.map(([name, src]) => auditSource(name, src));
}
