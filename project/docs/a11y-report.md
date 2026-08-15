# Accessibility report — browser audit notes

**Deliverable of WP-20** (`docs/EXECUTION_PLAN.md`: *CREATE
`project/docs/a11y-report.md` — manual audit notes (axe browser pass)*;
ACCEPT: *report committed*). WP-20 shipped its code but never produced this
file, so its own acceptance criterion was unmet — see
[`COMPLETION_AUDIT.md`](./COMPLETION_AUDIT.md) §3 item 8. Written 2026-08-15.

## Method

Real browser pass, not a code read.

- **Engine:** axe-core 4.13 driven by Playwright/Chromium.
- **Target:** `project/dist/standalone.html`, produced by
  `node tools/build-standalone.mjs` and opened over `file://`.
- **Ruleset:** `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.
- **Why the standalone bundle and not the served pages:** `HCRM Console.html`
  and `Resonance Spread.html` load React, ReactDOM, and Babel-standalone from
  `unpkg.com`. In an egress-restricted environment those three requests fail
  (`ERR_CONNECTION_RESET`), Babel never runs, no `text/babel` script is
  transformed, and the pages render an empty shell — axe then reports a clean
  scan of nothing. The standalone bundle inlines local React/ReactDOM and
  pre-transpiles the JSX, so it renders the real component tree offline. It is
  built from the same sources by the same tool, so what it renders is what the
  served pages render.
- **Verification that the scan was real:** the audited document measured
  345,514 characters of rendered text. A scan is only meaningful against a
  mounted tree; an empty shell was treated as a failed run, not a pass.

## Findings

### Fixed — `aria-conditional-attr` (serious), 14 nodes

```
<tr class=" " tabindex="0" aria-expanded="false">
  → "This attribute is supported with treegrid rows, but not table: aria-expanded"
```

`hcrm-view.jsx`'s `Ledger` gave every register row `aria-expanded`.
`aria-expanded` is only defined for `treegrid` rows; on a row of a plain
`<table>` it is invalid, and a screen reader is told the row discloses nested
content that does not exist. The rows disclose nothing — clicking one *selects*
it and drives the detail panel.

Fixed by replacing it with `aria-current`, which is valid on any role and
states what the control actually does. Promoting the table to a real
`treegrid` was rejected: that role additionally requires row/gridcell roles and
full arrow-key grid navigation, which would have traded one violation for
several.

**Re-scan after the fix: 0 violations, 15 rule groups passing.**

### Open — `color-contrast` reported *incomplete*, 268 nodes

Not a violation and not a pass: axe could not compute a contrast ratio for
these nodes and declined to guess. The cause is environmental — the design
loads Google Fonts over the network (the one CDN dependency
`build-standalone.mjs` documents as remaining), and text rendered in a
substituted fallback face over layered gradient backgrounds gives axe no stable
foreground/background pair to sample.

This is **not** an unmeasured surface. `src/present/contrast.js` computes real
OKLCH→sRGB→relative-luminance ratios for the `styles.css` design tokens, and
`test/wcag-contrast.test.js` asserts them against the live CSS on every
`npm test` (24 assertions) — that is what caught and fixed `--ink-dim` at
4.15:1 during WP-20. The gap between the two is scope, and it is real: the
token test covers 9 token pairs from `:root`, while `hcrm.css` and
component-level colours are not machine-checked by either gate. Recorded as
open rather than papered over.

### Not covered by this pass

- **The post-submit chart view.** The scan covers the landing view. No submit
  control matched this harness's selectors, so the rendered chart/register
  screens were not scanned. This is the larger surface and remains unaudited.
- **Screen-reader behaviour.** axe checks machine-verifiable rules; it does not
  establish that a NVDA/VoiceOver user can complete a task. No assistive-tech
  session was run.
- **The served (non-bundle) pages** in an environment with CDN access.

## Standing keyboard-accessibility notes

- 26 focusable controls in the landing view.
- `card.jsx`'s whole-card flip control was a mouse-only `<div onClick>` with no
  keyboard path; WP-20 made it a focusable, Enter/Space-operable control.
- `a11y-table.jsx` provides a real `<table>` alternative to the visual chart —
  though it is mounted on only one of the two chart pages, which
  `COMPLETION_AUDIT.md` records as open.

## Reproducing

The audit tooling is deliberately **not** added to `package.json`: it pulls
Playwright and axe-core, and the repo's dependency surface is audit-enforced to
stay minimal (`tools/README.md`). Install them outside the repo:

```sh
cd project && node tools/build-standalone.mjs     # -> project/dist/standalone.html
mkdir -p /tmp/a11y && cd /tmp/a11y
npm init -y && npm i playwright axe-core
# then drive project/dist/standalone.html with axe.run(document, {
#   runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] } })
# asserting the rendered body is non-empty before trusting the result.
```
