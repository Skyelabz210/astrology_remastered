# Remediation Ledger

Tracks the HCRM evidence-boundary remediation. Flat-file project (no git):
`git mv` steps in the source plan are realized as file creation under `src/`,
leaving the existing browser apps working against the demo layer.

| Phase | Action | State |
|-------|--------|-------|
| P0 | STATUS / CLAIM_BOUNDARY / REMEDIATION_LEDGER markers | DONE |
| P1 | Layer split — `src/core`, `src/ledger`, `src/demo`, `src/ui` | DONE (core + ledger) |
| P2 | Integer-arcsec validators; ephemeris ledger schema | DONE |
| P3 | Pure-integer HCRM core (basis, residues, shell-kelim, gear, core) | DONE |
| P4 | Exact tests + full ecliptic sweep | DONE — sweep passes 1,296,000/1,296,000 |
| P5 | Synthetic demo demotion + warning | DONE (warning module) |
| P6 | Claim-status tagging | DONE (CLAIM_BOUNDARY, docs) |
| P7 | Purified math extract for cram-substrate | DONE (docs/hcrm-math-extract.md) |
| P8 | 180-fold overclaim correction | DONE (docs/hcrm-open-claims.md) |
| P9 | Commit sequence | N/A (no git) |
| P10 | Final classification | DONE (STATUS.md) |

## Acceptance evidence

- `src/core` no-float audit: clean (see `test/no-float-core.test.js` token list).
- Full-sweep K-Elim: every x in [0, 1,296,000) recovers K = ⌊x/M6⌋ via
  K ≡ (x mod 323 − x mod 30030)·287 (mod 323). Zero mismatches.
