# HCRM Open Claims & Overclaim Corrections — P8

This file records claims that are **not** PROVEN, and corrects earlier
overclaims so nothing in the package reads as evidence-grade by accident.

## Corrected overclaim: "180-fold operator periodicity"

**Earlier statement (withdrawn):** "the HCRM operator has period 180."

**Correct statement (split by what is actually proven):**

- **Coefficient periodicity — PROVEN.** Over SafeS8 the multiplicative order of
  4 modulo each prime, `ord_p(4)`, has `lcm = 180`:
  ```
  ord_2(4)=1  ord_3(4)=1  ord_5(4)=2  ord_7(4)=3
  ord_11(4)=5 ord_13(4)=6 ord_17(4)=4 ord_19(4)=9
  lcm(1,1,2,3,5,6,4,9) = 180
  ```
  This is a statement about the **coefficient** `4` only.

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

## Rule

No OPEN or PRESENTATION item may appear in user-facing copy with the words
*proven*, *exact*, *verified*, or *evidence-grade*. Only `src/core` results
carry PROVEN.
