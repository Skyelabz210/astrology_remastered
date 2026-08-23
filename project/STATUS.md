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
| Exact register core | `src/core/` | PROVEN-BY-EXACT-TEST (full ecliptic sweep, parked shell 881,790 / lane 11; gear split retained) | evidence, extraction |
| Variant registry | `src/core/variants.js` | PROVEN structure · DEFINED constants · LEDGER quadrant houses (WP-12) · OPEN heliocentric frame | evidence for closure claims only |
| Safe Basis architecture | `src/core/safe-basis.js` | DEFINED roles · PROVEN Gaussian class, families, saturation | evidence, extraction |
| ρ invariant | `src/core/rho.js` | PROVEN against framework reference values | evidence, extraction |
| Shadow / closure axes | `src/core/shadow-spine.js` | PROVEN-BY-EXHAUSTIVE-SWEEP (cross, census, orthogonality, additivity) | evidence, extraction |
| Arrow (r, K) | `src/core/arrow.js` | PROVEN (saturation, signed carry, shadow entropy) | evidence, extraction |
| Operator atlas | `src/core/operators.js` | PROVEN by enumeration (5,096,079,360 exact lane operators) | evidence, extraction |
| CRAM layer | `src/core/cram.js` | PROVEN (adjacency collapse, gradient, shadow lift, residue-native χ certified by unbroken basis) | evidence, extraction |
| Star lift / tower / fixture | `src/core/fixture.js` | PROVEN (star family, tower depth, level independence, phase lock) | evidence, extraction |
| Anchor admissibility | `src/core/anchor.js` | PROVEN (internality, tray-determination, i.i.d., star-lift bases) | evidence, extraction |
| Ring arithmetic | `src/core/ring.js` | PROVEN (Harmonic Closure Theorem, n ≤ 2000) | evidence, extraction |
| Ledger import + schema | `src/ledger/` | DEFINED | evidence inputs |
| Synthetic ephemeris | `src/demo/` (`astro.jsx`) | SCAFFOLD / PRESENTATION | UI / layout testing only |
| Console / reading UI | `*.html`, `*-view.jsx` | SCAFFOLD | presentation |
| Number core | `cram-int.js` | exact (BigInt) | number engine |
| Proof compendium | `docs/CRAM_QMNF_PROOF_COMPENDIUM.md` | PROVEN T1–T10, T12 (`test/proof-compendium.test.js`) · ARGUED T11 · OPEN Lean formalization | evidence |

## Axioms

A1 (exactness) and A2 (lane independence preserved) are in force. **A3 (fixed
immutable basis) is not** — it was imported from an external document, briefly
made load-bearing, and has been withdrawn.

**A2 preserves the truth of lane independence; it does not ban reconstruction.**
The i.i.d. property of the residue space is the invariant. What A2 forbids is any
operation that manufactures a non-invertible, data-dependent cross-lane
dependency — which is exactly what the mixed-radix cascade does, and why A2
retires Garner. The yield is O(1) and uncoupled: K-Elimination gives K, and the
number is the pair (r, K). Fusing them into `r + K·M` is a radix composition —
exact and legitimate, confined to declared boundary projections, and not counted
as an operation of the tray.

## Hard gate

`src/core` accepts `longitude_arcsec` only as a decimal integer string or BigInt.
No `Math.round`, `parseFloat`, `Number(`, decimal constants, Date-derived
longitude, or synthetic orbital periods may appear under `src/core`.
