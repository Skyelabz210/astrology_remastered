# project/vendor/

Vendored third-party browser scripts loaded directly by `<script src="...">` tags
in the HTML pages (no bundler, no npm resolution at serve time — see
`project/tools/README.md` for why astronomy-engine is a Node **and** browser
dependency here).

## astronomy.browser.min.js

- **Source package:** `astronomy-engine` **v2.1.19** (pinned in
  `project/package.json`/`package-lock.json`, WP-05/WP-06).
- **Source path copied from:**
  `project/node_modules/astronomy-engine/astronomy.browser.min.js`
- **Why this file and not `astronomy.js`/`astronomy.min.js`/`esm/astronomy.js`:**
  the package's own `package.json` ships four browser/Node build variants:
  - `astronomy.js` (`main`) / `esm/astronomy.js` (`module`) — Node CommonJS and
    ESM entry points; not meant for a bare `<script>` tag (no UMD global export,
    and Node-oriented).
  - `astronomy.browser.js` / `astronomy.browser.min.js` — UMD builds whose
    closing line
    (`("undefined"!==typeof window?window:...).Astronomy=r()`) assigns the
    library to `window.Astronomy` when loaded as a plain classic script with no
    `module`/`define` environment present, which is exactly the no-bundler
    `<script src="...">` loading model this repo's HTML pages use (see
    `project/core-shim.js` and how the HTML pages script-tag it).
  - Picked `.min.js` over the unminified `.browser.js` (422 KB vs 116 KB) purely
    to keep the vendored payload smaller; behavior is identical (same UMD
    wrapper, same `window.Astronomy` export).
- **SHA-256** of the vendored file (`project/vendor/astronomy.browser.min.js`):

  ```
  f41139a87941ea017ab902b954c9389fa27ea72083d7fab4971756d7769d14e6
  ```

  Reproduce with either:

  ```
  sha256sum project/vendor/astronomy.browser.min.js
  ```

  or (no `sha256sum` binary required):

  ```
  node -e "console.log(require('node:crypto').createHash('sha256').update(require('fs').readFileSync('project/vendor/astronomy.browser.min.js')).digest('hex'))"
  ```

- **License:** MIT (Don Cross), reproduced verbatim in the vendored file's
  leading comment block — unmodified from upstream.
- **Global exposed:** `window.Astronomy` (when loaded via a plain, non-module
  `<script src="vendor/astronomy.browser.min.js"></script>` tag, placed before
  `astro.jsx`'s script tag so `window.Astronomy` exists by the time
  `astro.jsx` runs). See `project/astro.jsx` for the `window.Astronomy`
  presence check and the resulting `window.EPHEMERIS_MODE` flag
  (`"REAL"` when present, `"SYNTHETIC"` when it failed to load — e.g. offline).
- **API used by `astro.jsx`:** the same `Astronomy.GeoVector(body, time, true)`
  (aberration on) → `Astronomy.Ecliptic(vector).elon` pattern
  `project/tools/ephemeris/produce-ledger.mjs` uses for the Node ledger
  producer (WP-08) — geocentric apparent ecliptic-of-date longitude, degrees,
  `[0, 360)`. Only the 10 classical bodies astronomy-engine's `Body` enum
  defines (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune,
  Pluto) get real longitudes this way; `NorthNode`, `Chiron`, and `Lilith`
  have no corresponding `Astronomy.Body` member (astronomy-engine does not
  model them) and stay on the synthetic mean-motion model even in `"REAL"`
  mode — same scope boundary `produce-ledger.mjs`'s `DEFAULT_BODIES` already
  draws for the Node ledger.

## Updating this file

1. Bump `astronomy-engine` in `project/package.json` and reinstall.
2. `cp project/node_modules/astronomy-engine/astronomy.browser.min.js project/vendor/astronomy.browser.min.js`
3. Recompute the SHA-256 with one of the commands above and update this file.
4. Update the version string in this README and anywhere else it's cited
   (e.g. the comment in `astro.jsx`).
