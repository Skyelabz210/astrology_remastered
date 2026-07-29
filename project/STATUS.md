# HCRM Status

Current status: **GREEN-2 scaffold.**

This package contains a visual HCRM register prototype. It is not evidence-grade
until all chart inputs are supplied by exact integer ephemeris ledgers.

Synthetic ephemeris output, decimal longitudes, rounded arcseconds, and
presentation geometry are **not admissible** as proof-facing CRAM inputs.

Valid mathematical components may be extracted into `cram-substrate` only after
isolation, tests, and claim-status tagging.

## Layer map

| Layer | Path | Status | Admissible for |
|-------|------|--------|----------------|
| Exact register core | `src/core/` | PROVEN-BY-EXACT-TEST (full ecliptic sweep) | evidence, extraction |
| Ledger import + schema | `src/ledger/` | DEFINED | evidence inputs |
| Synthetic ephemeris | `src/demo/` (`astro.jsx`) | SCAFFOLD / PRESENTATION | UI / layout testing only |
| Console / reading UI | `*.html`, `*-view.jsx` | SCAFFOLD | presentation |
| Number core | `cram-int.js` | exact (BigInt) | number engine |

## Hard gate

`src/core` accepts `longitude_arcsec` only as a decimal integer string or BigInt.
No `Math.round`, `parseFloat`, `Number(`, decimal constants, Date-derived
longitude, or synthetic orbital periods may appear under `src/core`.
