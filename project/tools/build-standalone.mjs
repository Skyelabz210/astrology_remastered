#!/usr/bin/env node
// tools/build-standalone.mjs — WP-25: regenerate the offline standalone bundle.
//
// Replaces the deleted, stale "HCRM Console (standalone).html" (a 2.07 MB
// artifact from an unrelated auto-bundler tool, never reproducible from
// source). This script builds a fresh equivalent from the live,
// server-hosted page and inlines everything it needs to open straight off
// disk (file://), no `npx serve` required.
//
// Source-of-truth strategy (documented per the WP-25 brief, option chosen:
// PARSE, not hardcode): this script reads "HCRM Console.html" itself and
// walks its <link rel="stylesheet"> and <script> tags in document order,
// so the standalone bundle automatically tracks whichever .jsx/.css files
// the live page actually loads — it does not hardcode that file list. If a
// future package adds/removes a <script> tag on the live page, re-running
// this build picks the change up for free.
//
// What gets inlined and how:
//   - local <link rel="stylesheet" href="*.css">   -> raw content in <style>
//   - local <script type="text/babel" src="*.jsx">  -> transpiled via
//     @babel/core + @babel/preset-react (classic runtime, matching what
//     babel-standalone does for `data-presets="react"` in the browser),
//     inlined as a plain <script>
//   - local <script type="module" src="*.js">       -> the ES module graph
//     (core-shim.js -> src/core/*.js, src/ledger/*.js; tzresolve.js) is
//     bundled into a single IIFE via esbuild (`buildSync`, bundle:true,
//     format:'iife'), then inlined as a plain <script>. This is required
//     for real offline use: core-shim.js's own header notes ES-module
//     `import` is blocked on file:// URLs even when served, so leaving it
//     as `type="module"` would leave `window.HCRM_CORE` undefined offline.
//   - local <script src="vendor/astronomy.browser.min.js"> (plain UMD,
//     no `type`) -> inlined byte-for-byte, unchanged.
//   - CDN <script src="https://unpkg.com/react@.../react.development.js">
//     and react-dom equivalent -> swapped for the matching version's local
//     `node_modules/react{,-dom}/umd/*.development.js` UMD build (same
//     18.3.1 dev build the live page pins), inlined. This is the one place
//     where "regenerate the bundle" implicitly depends on `npm install`
//     having fetched those packages as devDependencies first (see below).
//   - CDN <script src="https://unpkg.com/@babel/standalone/babel.min.js">
//     -> dropped entirely. It exists on the live page only to transpile
//     JSX in-browser; since this script pre-transpiles with @babel/core,
//     it is dead weight in the standalone bundle and the CDN dependency
//     goes away for free.
//   - Google Fonts <link rel="preconnect">/<link rel="stylesheet"
//     href="https://fonts.googleapis.com/..."> -> left untouched. Fonts
//     fall back to the browser's default serif/sans stack when offline;
//     this is a cosmetic gap only, called out below and in the printed
//     build summary. Actually vendoring the font files was judged out of
//     scope for this package (they are not part of the app's own JS/CSS
//     graph the brief asks us to inline).
//
// Known / honestly-disclosed limitations:
//   1. React, ReactDOM, and Babel-standalone are inlined ONLY IF the
//      matching npm packages (`react`, `react-dom` for their UMD dev
//      builds; `@babel/core` + `@babel/preset-react` for transpilation)
//      are present in node_modules/. If `npm install` could not reach the
//      registry in a given sandbox, this script FAILS LOUDLY (see
//      requireLocalPackages() below) rather than silently emitting a
//      bundle that still points at unpkg.com and calling that "offline".
//      In *this* build/session, network access to the npm registry
//      worked, so devDependencies on `react@18.3.1`, `react-dom@18.3.1`,
//      `@babel/core`, `@babel/preset-react`, and `esbuild` (for the
//      core-shim ESM bundling step) were added and the emitted bundle has
//      no CDN <script> tags left at all.
//   2. Google Fonts remain CDN-hosted (cosmetic only, see above).
//   3. This produces a *build-time snapshot*. If astro.jsx / cities.jsx /
//      etc. change later, re-run this script to refresh dist/standalone.html
//      (it is git-ignored, not committed).
//
// Usage (from project/):
//   node tools/build-standalone.mjs
// Output: project/dist/standalone.html (git-ignored, per project/.gitignore
// "dist/" rule from WP-01).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as babel from "@babel/core";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, ".."); // project/
// Which page to bundle. Defaults to the console, but the parse-don't-hardcode
// strategy above means any page in project/ that lists its own assets works:
//   node tools/build-standalone.mjs "Resonance Spread.html" resonance-spread.html
// The second argument is the output filename inside dist/; omit it and the
// source page's own name is slugified.
const [ARG_PAGE, ARG_OUT] = process.argv.slice(2);
const SOURCE_PAGE = ARG_PAGE || "HCRM Console.html";
const SOURCE_HTML = path.join(PROJECT_ROOT, SOURCE_PAGE);
const OUT_DIR = path.join(PROJECT_ROOT, "dist");
const OUT_NAME =
  ARG_OUT ||
  (ARG_PAGE
    ? path.basename(SOURCE_PAGE, ".html").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".html"
    : "standalone.html");
const OUT_FILE = path.join(OUT_DIR, OUT_NAME);

if (!existsSync(SOURCE_HTML)) {
  throw new Error(`No such page in project/: ${SOURCE_PAGE}`);
}

const REACT_VERSION = "18.3.1"; // must match the version pinned on the live page

function readLocal(relPath) {
  return readFileSync(path.join(PROJECT_ROOT, relPath), "utf8");
}

// Defensive escaping: a literal "</script" inside inlined JS/CSS text would
// otherwise prematurely close the wrapping <script>/<style> tag when the
// HTML is parsed. None of the current source files break out of a string
// or comment when this substitution is applied (verified by grep before
// writing this script), but it costs nothing to guard every inlined blob.
function escapeClosingTags(code) {
  return code.replace(/<\/(script|style)/gi, "<\\/$1");
}

function requireLocalPackage(relNodeModulesPath, humanName) {
  const full = path.join(PROJECT_ROOT, "node_modules", relNodeModulesPath);
  if (!existsSync(full)) {
    throw new Error(
      `Missing devDependency artifact: ${full}\n` +
      `${humanName} is required to produce a genuinely offline bundle.\n` +
      `Run "npm install --save-dev react@${REACT_VERSION} react-dom@${REACT_VERSION} ` +
      `@babel/core @babel/preset-react esbuild" from project/ first ` +
      `(requires npm-registry network access). Refusing to fall back to a ` +
      `CDN <script src="https://unpkg.com/..."> silently, since that would ` +
      `not actually be offline-openable — see the header comment in this ` +
      `file for the full policy.`
    );
  }
  return readFileSync(full, "utf8");
}

function transpileJsx(relPath) {
  const src = readLocal(relPath);
  const out = babel.transformSync(src, {
    filename: relPath,
    babelrc: false,
    configFile: false,
    // "classic" runtime -> React.createElement(...), matching what
    // babel-standalone's data-presets="react" does in the live page (it
    // relies on the global `React` from the UMD build, not automatic JSX
    // runtime imports).
    presets: [["@babel/preset-react", { runtime: "classic" }]],
  });
  return out.code;
}

function bundleEsModule(relPath) {
  // core-shim.js and tzresolve.js are real ES modules (import/export).
  // esbuild resolves and inlines their whole local module graph
  // (src/core/*.js, src/ledger/*.js, ...) into one IIFE so the result
  // works as a plain <script> with no runtime `import` at all — required
  // for file:// use, see header comment.
  const result = esbuild.buildSync({
    entryPoints: [path.join(PROJECT_ROOT, relPath)],
    absWorkingDir: PROJECT_ROOT,
    bundle: true,
    format: "iife",
    platform: "browser",
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

// --- Parse the live page for its asset list -------------------------------

const sourceHtml = readFileSync(SOURCE_HTML, "utf8");

function parseAttrs(tagSource) {
  const attrs = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tagSource))) attrs[m[1].toLowerCase()] = m[2];
  return attrs;
}

const report = { css: [], scripts: [], skippedCdn: [], droppedCdn: [] };

// 1) inline local stylesheet <link> tags
let html = sourceHtml.replace(/<link\b[^>]*>/gi, (tag) => {
  const attrs = parseAttrs(tag);
  if ((attrs.rel || "").toLowerCase() !== "stylesheet") return tag; // e.g. preconnect
  const href = attrs.href || "";
  if (/^https?:\/\//i.test(href)) {
    report.skippedCdn.push(href);
    return tag; // Google Fonts — left as CDN, see header comment
  }
  const css = escapeClosingTags(readLocal(href));
  report.css.push(href);
  return `<style>\n${css}\n</style>`;
});

// 2) inline <script> tags (local jsx/js, or known CDN react/react-dom/babel)
html = html.replace(/<script\b[^>]*>\s*<\/script>/gi, (tag) => {
  const attrs = parseAttrs(tag);
  const src = attrs.src;
  if (!src) return tag; // no external src, nothing to inline

  if (/^https?:\/\//i.test(src)) {
    if (/\/react-dom@/.test(src) || /\breact-dom\//.test(src)) {
      const code = requireLocalPackage(
        "react-dom/umd/react-dom.development.js",
        "React-DOM UMD dev build"
      );
      report.scripts.push(`${src} -> node_modules/react-dom/umd/react-dom.development.js`);
      return `<script>\n${escapeClosingTags(code)}\n</script>`;
    }
    if (/\/react@/.test(src)) {
      const code = requireLocalPackage(
        "react/umd/react.development.js",
        "React UMD dev build"
      );
      report.scripts.push(`${src} -> node_modules/react/umd/react.development.js`);
      return `<script>\n${escapeClosingTags(code)}\n</script>`;
    }
    if (/@babel\/standalone/.test(src)) {
      report.droppedCdn.push(src);
      return `<!-- ${src} dropped: JSX is pre-transpiled at build time, babel-standalone is not needed offline -->`;
    }
    // Unknown CDN script: leave in place, but flag it loudly.
    report.skippedCdn.push(src);
    return tag;
  }

  // Local file.
  const type = (attrs.type || "").toLowerCase();
  if (type === "module") {
    const code = bundleEsModule(src);
    report.scripts.push(`${src} (ESM, bundled via esbuild)`);
    return `<script>\n${escapeClosingTags(code)}\n</script>`;
  }
  if (type === "text/babel") {
    const code = transpileJsx(src);
    report.scripts.push(`${src} (JSX, transpiled via @babel/core)`);
    return `<script>\n${escapeClosingTags(code)}\n</script>`;
  }
  // Plain script, e.g. vendor/astronomy.browser.min.js — inline verbatim.
  const code = escapeClosingTags(readLocal(src));
  report.scripts.push(`${src} (verbatim)`);
  return `<script>\n${code}\n</script>`;
});

// --- Emit -------------------------------------------------------------

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, html, "utf8");

const bytes = Buffer.byteLength(html, "utf8");
console.log(`Wrote ${path.relative(PROJECT_ROOT, OUT_FILE)} (${(bytes / 1024).toFixed(1)} KiB)`);
console.log(`Inlined CSS: ${report.css.join(", ") || "(none)"}`);
console.log(`Inlined scripts:\n  ${report.scripts.join("\n  ")}`);
if (report.droppedCdn.length) {
  console.log(`Dropped CDN scripts (superseded by build-time step): ${report.droppedCdn.join(", ")}`);
}
if (report.skippedCdn.length) {
  console.log(`Still CDN-dependent (not fully offline for these): ${report.skippedCdn.join(", ")}`);
}
