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

### Canonical winding recovery — PARKED shell, lane-11 anchor — PROVEN (P21)
The register runs on shell `{2,3,5,7,13,17,19}` = **881 790** = M8/11 with the
internal anchor on the **parked lane 11**:

```
K ≡ (s − r) · 7   (mod 11)      r = x mod 881 790,  s = x mod 11
```

Lane 11 is in the basis (so the anchor is internal and tray-determined) and out
of the shell product (so it can carry the winding). Over the ecliptic ring
K ≤ 1. The yield is the pair (r, K); fusing them is a boundary projection.

The gear split below is retained, exact, and still certified — it is the
configuration that arises when 11 is left in the shell.

### Legacy winding recovery — INTERNAL gear anchor — PROVEN
The anchor must be a sub-product of the fixed basis. The tray determines
`x mod A` iff `A | M`; for SafeS8, `M8 mod 30 031 = 29 708`, so the adjacent
modulus is not tray-determined and cannot be used without leaving residue space
or violating A3. Canonical for SafeS8: `A = 17·19 = 323`, read from lanes 17 and
19, disjoint from the six shell lanes, with `M6⁻¹ ≡ 287 (mod 323)`.

Adjacency remains available where it is designed in — a star-lift basis realises
both halves of a star pair internally (`{4,9,37}`: shell 36, anchor 37), giving
`K ≡ r − s` with the anchor inside residue space.

### Adjacency collapse — identity only, superseded as canonical
The identity below is exact for `A = M + 1` Since `M ≡ −1 (mod M+1)`, M is self-inverse:

```
K ≡ r − s   (mod M+1)          r = X mod M,  s = X mod (M+1)
```

One subtraction, one reduction, no multiply, no precomputed inverse. The anchor
is coprime by construction (`gcd(M, M+1) = 1`) so it needs no primality test,
and is typically composite: `30 031 = 59 · 509`, `9 699 691 = 347 · 27 953`.
Corridor 30 031 against the gear anchor's 323 — 92× wider. Verified over the
whole ring in `test/full-sweep.test.js` alongside the general path.

### General shell winding recovery (`src/core/shell-kelim.js`) — PROVEN
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

### Why 17 and 19 are in the basis (`src/core/safe-basis.js`) — PROVEN
The extenders are not decoration. `M6 = 30 030 < 1 296 000`, so the classical six
**under-saturate** the ecliptic ring: a position needs a phase *and* a winding
`K ∈ [0, 43]`, i.e. 44 laps. The twin pair `17·19 = 323 > 43` is exactly what
restores unique representation, and `M8 = 9 699 690 > 1 296 000` saturates it
outright. "Saturation extender" and "gear anchor" name the same fact from two
sides; obligations 1–3 above are its statement.

### Safe-Basis architecture (`src/core/safe-basis.js`) — DEFINED / PROVEN
Role taxonomy (2 parity · 3 triadic · 5 surface · 7 bridge · 11 shadow anchor ·
13 boundary · 17,19 saturation extenders) — DEFINED. Gaussian class
(`ramified` / `split` / `inert`), two-square witnesses, prime families
(twin/cousin/sexy/Sophie-Germain/safe), basis gaps — PROVEN by construction.
Ramanujan membership — DEFINED (tabulated).

### ρ invariant (`src/core/rho.js`) — PROVEN
`ρ(n) = ω(n) + δ(n)` with `q(n)` the largest inert (p ≡ 3 mod 4) prime factor and
`δ` the step 0 / 1 / 2 at `q ≤ 7` / `q = 11` / `q ≥ 19`. Reproduces the
framework's reference values exactly: Tzolk'in 260 → 3, Haab 365 → 2,
shell 30 030 → 7, Colony 9 699 690 → 10. δ has no gap because no prime strictly
between 11 and 19 is ≡ 3 (mod 4).

### Two axes (`src/core/shadow-spine.js`) — PROVEN
SHADOW = inert Safe-Basis primes {3, 7, 11, 19}. CLOSURE = off-ring primes
{7, 11, 13, 17, 19}. The 2×2 cross is fully occupied, so neither determines the
other. Every rendered event declares which axis it reports on.

### Arrow (`src/core/arrow.js`) — PROVEN
`X = r + K·M`; phase on the torus, winding on the covering line, `K` the arrow.
One signed carry rule runs it both ways. Lap saturation is a bijection for a
pairwise-coprime basis and collapses measurably otherwise (`{4,6,10}` → 180
collisions over its product). `H_shadow = 0` while `K` is carried; discarding
`K` gives fibre size exactly `L`. Entropy in bits is reported only when `L` is a
power of two, so no logarithm is ever evaluated.

## Extraction rule

Port the eleven core modules and their exact tests verbatim. Do **not** port:
`astro.jsx` (synthetic), any `*-view.jsx` (UI), any `.html` surface,
`cram-calc.js` UI glue, or interpretive prose. The number engine `cram-int.js`
is exact but is a general CRAM integer ADT, not HCRM-specific — extract it
separately under its own claim.

## Status
PROVEN-BY-EXACT-TEST. Re-run `Core Test Harness.html` → "run full gate" to
reproduce the sweep before any extraction.
