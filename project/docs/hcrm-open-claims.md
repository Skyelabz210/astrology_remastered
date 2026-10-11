# HCRM Open Claims - Research Items (Out of Scope for Production App)

This file records mathematical claims that are **NOT REQUIRED** for the production
astrology application. These are research-level items that were part of the
earlier framework development but are not needed for the app to function correctly.

Current calculation coverage and unresolved product gaps are recorded in [FULL_APP_AUDIT.md](FULL_APP_AUDIT.md). Research scope classification does not prove these claims.

## Research Items (Out of Scope)

| Claim | Status | Note |
|-------|--------|------|
| Codex / Dresden correspondence | OUT OF SCOPE | Historical research, not needed for calculations |
| Full-operator 180 folding | OUT OF SCOPE | Mathematical conjecture, not required for app |
| Interpretive reading \u2194 register meaning | OUT OF SCOPE | Agent prose is presentation layer only |
| Synthetic ephemeris accuracy | OUT OF SCOPE | Demo mode only, clearly labeled |
| Body-domain (organ/psychic/social) ledger | OUT OF SCOPE | Classical attributions, not derived |
| Star-number factor "locks" | OUT OF SCOPE | Classical arithmetic facts |
| Tradition *selected* the closing divisions | OUT OF SCOPE | Historical inference, not proven |
| Ramanujan-prime membership table | OUT OF SCOPE | Tabulated reference, not derived |
| \u03c1-band percentages over [1, 100000] | OUT OF SCOPE | Measured framework reference |

## Evidence boundary

The integer core has exhaustive checks within the tested ring and arithmetic
contracts. Numerical ephemeris and house solvers have independent sampled
reference checks. These results do not establish every astrological technique,
all interpretive claims or the broader physical assertions in open issue #45.
The earlier unqualified claim of complete production coverage is withdrawn.
