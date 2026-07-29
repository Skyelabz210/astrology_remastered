# Claim Boundary

Every claim in this package carries exactly one status tag.

| Tag | Meaning |
|-----|---------|
| CLASSICAL | established classical astrology / number theory |
| DEFINED | a definition, not a claim |
| PROVEN | proven by exhaustive exact test in this repo |
| LEAN-PROVEN | machine-checked in cram-substrate |
| MEASURED | empirical, with a declared test |
| SCAFFOLD | prototype / interface, not evidence |
| ARGUED | reasoned but unproven |
| OPEN | unresolved obligation |
| REJECTED | disproven or withdrawn |
| PRESENTATION | narrative / UI surface only |

## Current classification

- **HCRM register core** (`src/core`) — PROVEN over the full ecliptic arcsecond
  ring [0, 1,296,000): SafeS8 residues + M6 shell-winding recovered through the
  17·19 gear anchor with zero failures, no floating point.
- **SafeS8 injectivity over the ring** — PROVEN (CRT; ARC < M8).
- **Shell winding bound 0 ≤ K ≤ 43** — PROVEN (⌊(ARC−1)/M6⌋ = 43).
- **Gear anchor sufficiency (A = 323 > K)** — PROVEN.
- **Synthetic ephemeris** (`src/demo`, `astro.jsx`) — SCAFFOLD / PRESENTATION.
  Decimal longitudes for UI only; never evidence.
- **Interpretive reading engine** — PRESENTATION / HYPOTHESIS.
- **Codex / Dresden correspondence** — OPEN.
- **180-fold operator periodicity** — coefficient periodicity PROVEN (ord_p(4)
  lcm = 180 over SafeS8); full-operator folding is OPEN (see docs).

Synthetic output must never be labelled verified, exact, or evidence-grade.
