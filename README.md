# Astrology Remastered

A browser astrology application combining astronomical planetary positions,
traditional interpretation, and CRAM (Configurable Residue Arithmetic Machines).
Release **2026.10 · v1.2.0** is recorded in the page and export metadata.

The integer core preserves quantized arcseconds using BigInt. Floating-point
ephemerides remain outside that core. Exact arithmetic does not make the input
observations exact or establish the truth of an astrological interpretation.

## Verification

```
7885/7885 assertions · full ecliptic sweep 1,296,000 points, 0 mismatches · 21/21 core modules float-free
```

The assertion total above was reported by the full suite for the phase-direction
repair. `scripts/check-claims.mjs` re-runs the suite and enforces this banner;
adding or removing tests requires synchronizing it. Passing tests are evidence
for their assertions, not a proof of every mathematical or interpretive claim.

The phase repair covers both shortest-arc orientations, body-order symmetry,
wraparound, conjunction/opposition cusps, and stationary exact geometry. Its
regression suite uses an independent exact rational-time oracle rather than
only comparing two implementations with each other.

## Run locally

```bash
cd project
npm ci
npm test
npm run test:accuracy
npm run lint
npm run build
npx playwright install chromium
npm run test:browser
```

Tests support Node 20+. The Babel 8 standalone build requires Node 22.18+ or
Node 24.11+. Serve the source directory over HTTP to use the source pages:

```bash
npx serve project
# Open Resonance%20Spread.html on the server's displayed origin.
```

Source pages use native ES modules and cannot be opened reliably through
`file://`. The build creates offline assets in `project/dist`.

## Architecture and documentation

The complete previous README is preserved, byte-for-byte, in
[`README_ARCHITECTURE_2026_11_10.md`](README_ARCHITECTURE_2026_11_10.md).
It is a historical architecture snapshot, including its historical test banner;
the current assertion count is the checked banner above. Its original relative
links remain valid because the snapshot stays at the repository root.

| Reference | Contents |
| --- | --- |
| [Current status](project/STATUS.md) | Classification of the implemented layers. |
| [Claim boundary](project/CLAIM_BOUNDARY.md) | Proven, open, and rejected claims with supporting calculations. |
| [Remediation ledger](project/REMEDIATION_LEDGER.md) | Corrective-pass history. |
| [Function reference](project/docs/INPUTS_OUTPUTS.md) | Exported functions, inputs, and outputs. |
| [Whole-app audit](project/docs/FULL_APP_AUDIT.md) | Coverage and personal-reading review. |
| [Reading audit](project/docs/SYSTEM_READING_AUDIT.md) | Evidence, interpretation, and delivery requirements. |
| [Worldline model](project/docs/WORLDLINE_MODEL.md) | Birth-anchored clocks, exact CRAM coordinates, and model limits. |
| [Living avatar](project/docs/LIVING_AVATAR.md) | User-authored observations, preferences, and private journal controls. |
| [Technique access](project/docs/TECHNIQUE_ACCESS_MAP.md) | Navigation to existing calculated techniques. |
| [Framework review](project/docs/FRAMEWORK_REVIEW.md) | Calculation boundaries and remaining gaps. |
| [Contributing](CONTRIBUTING.md) | Test-first workflow and integer-core requirements. |

The main chart uses Astronomy Engine for ten bodies, mean lunar elements for
nodes and Lilith, and omits unsupported Chiron by default. The producer and
validated ledger are distinct from the browser presentation path; the exact
register accepts only admitted inputs. The core no-float audit remains enabled.

Local profiles and reading histories are browser-local. AI interpretation is
optional; review the chosen provider's data-sharing settings before enabling it.
Private journal sharing requires its own consent. Calculation history and exports
retain their owner and reading instant.

## Review and release gate

Pull requests require repository-owner merge approval. A previously successful
workflow does not certify a newer commit. Inspect the checks attached to the
actual candidate head before merging or deploying it.
