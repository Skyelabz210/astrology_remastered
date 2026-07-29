// test/no-float-core.test.js — static audit: no floating point in src/core. (P4)
//
// The core must be BigInt-only. This fetches every src/core/*.js source and
// scans for forbidden tokens that would admit floats, Date-derived longitude,
// rounding, or synthetic orbital periods into the proof path.

const CORE_FILES = [
  "src/core/basis.js",
  "src/core/residues.js",
  "src/core/gear-class.js",
  "src/core/shell-kelim.js",
  "src/core/validators.js",
  "src/core/hcrm-core.js",
];

// Forbidden tokens. validators.js legitimately *names* the things it rejects,
// so we scan for the CONSTRUCTS, not words in strings/comments — we strip
// line comments and string literals before matching.
const FORBIDDEN = [
  { tok: "Math.round", re: /\bMath\.round\b/ },
  { tok: "Math.floor", re: /\bMath\.floor\b/ },
  { tok: "parseFloat", re: /\bparseFloat\b/ },
  { tok: "parseInt",   re: /\bparseInt\b/ },
  { tok: "Number(",    re: /\bNumber\s*\(/ },
  { tok: "Date",       re: /\bnew\s+Date\b|\bDate\.now\b/ },
  { tok: "decimal literal", re: /(^|[^0-9eExXn.])[0-9]+\.[0-9]+/ },
  { tok: "float exponent", re: /[0-9]+\.[0-9]+e/i },
];

function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\/[^\n]*/g, "")             // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")        // block comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')    // double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")    // single-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");   // template strings
}

export async function runNoFloatAudit() {
  const results = [];
  for (const path of CORE_FILES) {
    let src;
    try { src = await (await fetch(path)).text(); }
    catch (e) { results.push({ name: path, ok: false, detail: "fetch failed: " + e.message }); continue; }
    const clean = stripCommentsAndStrings(src);
    const hits = [];
    for (const f of FORBIDDEN) if (f.re.test(clean)) hits.push(f.tok);
    results.push({ name: path, ok: hits.length === 0, detail: hits.length ? "FORBIDDEN: " + hits.join(", ") : "clean (BigInt only)" });
  }
  return results;
}
