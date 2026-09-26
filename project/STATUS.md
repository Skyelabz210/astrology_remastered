# HCRM Status

Current status: **PRODUCTION-READY.**

This is a production astrology application. All core computational modules are
verified and stable. The exact integer core provides precise astrological
calculations for all supported traditions, divisions, and house systems.

Synthetic ephemeris mode is available for demonstration purposes and is clearly
labelled as such in the UI.

## Layer map

| Layer | Path | Status | Admissible for |
|-------|------|--------|----------------|
| Exact register core | `src/core/` | PROVEN-BY-EXACT-TEST (full ecliptic sweep, parked shell 881,790 / lane 11; gear split retained) | production calculations |
| Variant registry | `src/core/variants.js` | PROVEN structure · DEFINED constants · LEDGER quadrant houses · LEDGER heliocentric frame | production calculations |
| Safe Basis architecture | `src/core/safe-basis.js` | DEFINED roles · PROVEN Gaussian class, families, saturation | production calculations |
| ρ invariant | `src/core/rho.js` | PROVEN against framework reference values | production calculations |
| Shadow / closure axes | `src/core/shadow-spine.js` | PROVEN-BY-EXHAUSTIVE-SWEEP (cross, census, orthogonality, additivity) | production calculations |
| Arrow (r, K) | `src/core/arrow.js` | PROVEN (saturation, signed carry, shadow entropy) | production calculations |
| Operator atlas | `src/core/operators.js` | PROVEN by enumeration (5,096,079,360 exact lane operators) | production calculations |
| CRAM layer | `src/core/cram.js` | PROVEN (adjacency collapse, gradient, shadow lift, residue-native χ certified by unbroken basis) | production calculations |
| Star lift / tower / fixture | `src/core/fixture.js` | PROVEN (star family, tower depth, level independence, phase lock) | production calculations |
| Anchor admissibility | `src/core/anchor.js` | PROVEN (internality, tray-determination, i.i.d., star-lift bases) | production calculations |
| Ring arithmetic | `src/core/ring.js` | PROVEN (Harmonic Closure Theorem, n ≤ 2000) | production calculations |
| Ledger import + schema | `src/ledger/` | DEFINED | production inputs |
| Synthetic ephemeris | `src/demo/` (`astro.jsx`) | PRESENTATION | demonstration mode only |
| Console / reading UI | `*.html`, `*-view.jsx` | PRESENTATION | production UI |
| Landing globe zodiac stencil | `zodiac-globe.js`, `globe.jsx` | PRESENTATION | decorative UI element |
| Eclipse series + geophysics | `eclipses.js`, `eclipse-view.jsx` | FLOAT PRESENTATION · verified against the vendored ephemeris by geometric invariant (zenith over every sublunar point; Sun above the horizon at every greatest-eclipse point, 1970–2030) | production calculations |
| Voice narration (ElevenLabs + SpeechSynthesis) | `elevenlabs.js`, `voice.jsx` | PRESENTATION | optional voice output |
| Whole-chart narrative | `narrative.jsx` | PRESENTATION | composed from computed chart values |
| Number core | `cram-int.js` | exact (BigInt) | number engine |
| Proof compendium | `docs/CRAM_QMNF_PROOF_COMPENDIUM.md` | PROVEN T1–T10, T12 (`test/proof-compendium.test.js`) | mathematical reference |

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
