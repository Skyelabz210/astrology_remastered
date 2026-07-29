# HCRM Math Extract (purified for `cram-substrate`) — P7

Only the exact, proof-bearing components below are eligible for extraction into
`cram-substrate`. Everything else in this project is SCAFFOLD or PRESENTATION
and must not be carried across.

## Admissible objects

All defined over `src/core/`, BigInt-only, no floating point, no Date, no
synthetic periods.

### Basis constants (`src/core/basis.js`) — DEFINED
```
B6   = {2, 3, 5, 7, 11, 13}        M6   = 30030
GEAR = {17, 19}                    A    = 323            (= 17·19)
B8   = B6 ∪ GEAR                   M8   = 9 699 690      (= ∏ B8)
ARCSEC_CIRCLE = 1 296 000          M6⁻¹ mod 323 = 287    (since M6 mod 323 = 314)
```

### Residue map (`src/core/residues.js`) — DEFINED
`mod(x, m)` is the non-negative representative; `residues(x, B)` the tray.

### Shell winding recovery (`src/core/shell-kelim.js`) — PROVEN
For `x ∈ [0, 1 296 000)` and `K = ⌊x / M6⌋`:

```
K ≡ (x mod 323  −  x mod 30030) · 287   (mod 323)
```

Proof obligations, all discharged by exhaustive test (`test/full-sweep.test.js`):

1. **SafeS8 injectivity on the ring** — `M8 = 9 699 690 > 1 296 000`, so by CRT
   the 8 residues uniquely determine `x`. PROVEN.
2. **Winding bound** — `K_max = ⌊(1 296 000 − 1)/30030⌋ = 43`. PROVEN.
3. **Anchor sufficiency** — the gear product `A = 323 > 43 = K_max`, so `K mod A`
   determines `K`. PROVEN.
4. **Recovery identity** — `K ≡ (x_A − x_M)·M6⁻¹ (mod A)` holds for every
   `x` in the ring. PROVEN by full sweep: 1 296 000 / 1 296 000, zero mismatches.

### Gear classification (`src/core/gear-class.js`) — DEFINED
On `(r17, r19)`: `G-zero` (0,0), `G-pre` (16,18), `G-low` (both ≤ 1), else none.

## Extraction rule

Port the five core modules and their exact tests verbatim. Do **not** port:
`astro.jsx` (synthetic), any `*-view.jsx` (UI), any `.html` surface,
`cram-calc.js` UI glue, or interpretive prose. The number engine `cram-int.js`
is exact but is a general CRAM integer ADT, not HCRM-specific — extract it
separately under its own claim.

## Status
PROVEN-BY-EXACT-TEST. Re-run `Core Test Harness.html` → "run full gate" to
reproduce the sweep before any extraction.
