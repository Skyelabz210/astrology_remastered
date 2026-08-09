# HCRM Open Claims & Overclaim Corrections — P8

This file records claims that are **not** PROVEN, and corrects earlier
overclaims so nothing in the package reads as evidence-grade by accident.

## Corrected overclaim: "180-fold operator periodicity"

**Earlier statement (withdrawn):** "the HCRM operator has period 180."

**Correct statement (split by what is actually proven):**

- **Coefficient periodicity — PROVEN**, with one correction to the earlier
  statement. 4 is **not a unit mod 2** (gcd(4,2)=2), so `ord_2(4)` is undefined;
  the earlier table's `ord_2(4)=1` was wrong. The order is taken over the primes
  where 4 *is* invertible — the odd part of SafeS8:
  ```
  ord_3(4)=1  ord_5(4)=2  ord_7(4)=3   ord_11(4)=5
  ord_13(4)=6 ord_17(4)=4 ord_19(4)=9
  lcm(1,2,3,5,6,4,9) = 180
  ```
  The value 180 is unchanged; only the justification is repaired. This is a
  statement about the **coefficient** `4` only.

- **Renormalisation sub-period — PROVEN.** Over the sub-basis {7, 11, 13}:
  `lcm(ord_7(4), ord_11(4), ord_13(4)) = lcm(3, 5, 6) = 30`. This is the
  Copernican ×4 renormalisation invariant and is a *different* number from the
  180 above — different sub-basis, not a competing claim. Conflating them was an
  error of record.

- **Full-operator folding — OPEN.** That the *entire* HCRM operator (not just the
  coefficient) folds with period 180 is **not** proven here. It is ARGUED at
  best and must be labelled OPEN until a machine-checked proof exists in
  `cram-substrate`.

## Open obligations

| Claim | Status | Note |
|-------|--------|------|
| Codex / Dresden correspondence | OPEN | no exact map defined |
| Full-operator 180 folding | OPEN | only coefficient order proven |
| Interpretive reading ↔ register meaning | PRESENTATION / HYPOTHESIS | agent prose is not evidence |
| Synthetic ephemeris accuracy | REJECTED for evidence | `src/demo` is presentation only |
| Body-domain (organ/psychic/social) ledger | SCAFFOLD | classical attributions, not derived |
| Star-number factor "locks" (e.g. f⋆(77)=13·37·73) | CLASSICAL | true arithmetic facts; their HCRM significance is ARGUED |
| "Shadow spine = the off-ring primes {7,11,13,17,19}" | REJECTED | withdrawn. Shadow is the Gaussian/mod-4 class (inert, p ≡ 3 mod 4) = {3,7,11,19}; off-ring is a separate closure axis. See `src/core/shadow-spine.js`. |
| Tradition *selected* the closing divisions | ARGUED | the closure arithmetic is PROVEN; the historical inference is not |
| Ramanujan-prime membership table | DEFINED | tabulated (OEIS A104272), not derived here |
| ρ-band percentages over [1, 100000] | MEASURED | reported in the framework; not recomputed here |

## Rule

No OPEN or PRESENTATION item may appear in user-facing copy with the words
*proven*, *exact*, *verified*, or *evidence-grade*. Only `src/core` results
carry PROVEN.
