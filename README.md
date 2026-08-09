# Astrology Remastered

An exact-integer astrological engine built on **CRAM** — Configurable Residue
Arithmetic Machines — covering every major astrological variant, surfacing the
shadow spine that falls out of the arithmetic, and using both to *reinforce*
traditional astrology rather than replace it.

Nothing in the core touches a float. Positions are integer arcseconds on a ring
of 1,296,000; every lane is a BigInt residue; every claim is either exhaustively
swept or explicitly marked open.

```
416/416 assertions · full ecliptic sweep 1,296,000 points, 0 mismatches · 16/16 core modules float-free
```

---

## If you know residue number systems, read this first

CRAM looks like RNS and is not RNS. Five differences decide how everything else
reads, and skipping them will make the rest of this repo look wrong.

**1. The winding is derived, never carried.** A value's position is a tray of
residues. The lap count `K` is *not a stored field* — it is a function of the
tray, recovered on demand by K-Elimination on the parked lane. Storing it would
be a denormalisation that can go out of sync with the lanes that determine it.

**2. What matters is the split, not the basis.** The safe basis
`S8 = {2,3,5,7,11,13,17,19}` is fixed. The design question is which lanes carry
value (the *shell*) and which lane anchors the winding. Lane 11 is **parked** —
in the basis, out of the shell. A lane cannot be both.

**3. There is no Garner cascade.** Reconstruction is one modular subtraction and
one multiply, not a sequential digit cascade whose cost scales with lane count.
This retires the *cascade*, not the yield.

**4. The yield is a PAIR, not a number.** K-Elimination returns `(r, K)`.
Forming `r + K·M` is a **radix composition** — `r` the low digit, `K` the high,
`M` the radix — which is exactly the positional emission the design avoids. That
projection exists (`projectToInteger`) but is labelled a boundary step and kept
off the hot path. Equality and ordering read straight off `(K, r)`; the
composite is never needed.

**5. Coprimality is the requirement — primality is incidental.** The lanes
happen to be primes. Nothing depends on their being prime except where noted
(field structure in the operator atlas). Adjacency `A = M+1` and the resolution
gradient `gcd(M,A) = d > 1` both work on composites.

---

## The register

| | shell lanes | shell product | anchor | K over the ring |
|---|---|---|---|---|
| **canonical** | `{2,3,5,7,13,17,19}` | **881,790** | lane **11**, parked | **≤ 1** |
| legacy | `{2,3,5,7,11,13}` | 30,030 | 17·19 = 323 | ≤ 43 |

The ecliptic ring is `R = 1,296,000″ = 2⁷ · 3⁴ · 5³`.

Both splits are exact and both are swept over the whole ring on every run. The
legacy gear split is retained and still proven — it is valid arithmetic, simply
not what the register is built on. Its wider anchor and `K ≤ 43` were artefacts
of loading lane 11 into the shell.

**The anchor is internal.** The tray determines `x mod A` if and only if
`A | M`. An anchor drawn from outside the basis is not a function of the tray at
all — there are values sharing every lane that disagree on it — so i.i.d. is
gone and the split is inadmissible however clean its arithmetic looks. Both
881,790/11 and 30,030/323 are sub-products of the fixed basis, and their lane
sets are disjoint from their shells.

---

## K-Elimination and the lift

For shell `M`, anchor `A`, residues `r = x mod M` and `s = x mod A`:

```
K ≡ (s − r) · M⁻¹   (mod A)          exact ⟺ K < A  ⟺  x < M·A
```

On the canonical split `M⁻¹ ≡ 7 (mod 11)`, since `881,790 ≡ 8 (mod 11)` and
`8·7 = 56 ≡ 1`. When `A = M+1` the inverse collapses entirely — `M ≡ −1`, so
`K ≡ r − s`, a single subtraction.

### Depth: the double lift

One elimination reaches `K < 11`. Depth does not come from a wider basis or a
new lane — it comes from **lifting the same parked lane to `11^e` and
eliminating again**. Two levels is the double lift:

```
level 1:   K ≡ (s₁ − r) · M⁻¹   (mod 11)      s₁ = x mod 11
level 2:   K ≡ (s₂ − r) · M⁻¹   (mod 11²)     s₂ = x mod 11²
```

Each level yields one base-11 digit of `K`. The levels agree because the lane is
**phase locked**: `s₂ ≡ s₁ (mod 11)`, so lifting never moves the phase the
fixture was affixed to. Level `e` is the same single modular subtraction as
level 1, taken at a higher power of the same prime — not a new lane, not a basis
extension.

| levels | depth | corridor `M · 11^e` |
|---|---|---|
| 1 | 11 | 9,699,690 — the full Colony |
| 2 | 121 | 106,696,590 |
| 6 | 1,771,561 | 1,562,144,774,190 — the SD-11 anchor |

Parking the lane is what makes this work: `gcd(881,790, 11) = 1`, so `M⁻¹`
exists mod `11^e` for every `e` and the lift is plain K-Elimination at every
depth. There is no Hensel step and no divide-by-11 anywhere. (An earlier pass
had one; it was self-inflicted by leaving 11 in the shell.)

Worked example — `x = 100,000,000`, `K = 113`:

```
digits (base 11) = [3, 10]     10·11 + 3 = 113
```

Verified exact across the entire double-lift corridor and, at level 6, out to
1.56 × 10¹².

---

## What this does with astrology

The arithmetic is not decoration. It decides which parts of the traditional
apparatus are exact and which are not.

### Harmonic Closure Theorem

An n-fold division of the zodiac closes on integer arcseconds **iff**
`n = 2^a · 3^b · 5^c` with `a ≤ 7, b ≤ 4, c ≤ 3` — the exponents of the ring
itself. Verified for all `n ≤ 2000`.

This is why the tradition looks the way it does. The divisions astrologers
actually use close exactly:

| n | step | | n | closes? |
|---|---|---|---|---|
| 12 signs | 108,000″ | | 7 | no — off-ring, defect 6″ |
| 16 | 81,000″ | | 11 | no |
| 36 decans | 36,000″ | | 13 | no |
| 9 (navāṁśa) | 144,000″ | | 45 | yes, 28,800″ |

The septile and the thirteen-sign zodiac are not arbitrary outliers — they are
the ones the ring cannot represent. Traditional practice is *reinforced* by
showing its divisions are exactly the closing ones.

### Two axes, and they are not the same axis

A persistent error — one I made and had to reverse — is treating "shadow spine"
and "off-ring" as one set. They are independent:

- **shadow** = Gaussian-inert, `p ≡ 3 (mod 4)`: `{3, 7, 11, 19}`
- **closure** = off-ring, does not divide `R`: `{7, 11, 13, 17, 19}`

All four cells of the 2×2 cross are occupied, so neither determines the other:

| | on-ring | off-ring |
|---|---|---|
| **shadow** | 3 | 7, 11, 19 |
| **non-shadow** | 2, 5 | 13, 17 |

### ρ — the stability invariant

```
ρ(n) = ω(n) + δ(n)        ω = distinct prime factors
                          δ = 0 for q ≤ 7 · 1 at q = 11 · 2 for q ≥ 19
                          q = largest shadow prime dividing n
```

δ is not arbitrary: shadow primes are exactly those Fermat's two-square theorem
excludes, so δ measures the obstruction to representing `n` in the Gaussian
integers. No prime strictly between 11 and 19 is `≡ 3 (mod 4)`, so the
definition has no gap.

Bands — Stable `ρ ≤ 4` · Mild 5–6 · Strong 7–8 · Chaotic `ρ ≥ 9`. Tzolk'in 260
lands Stable (ρ 3), Haab 365 Stable (ρ 2), the legacy shell 30,030 Strong (ρ 7),
the Colony 9,699,690 Chaotic (ρ 10).

### Coverage

**13 traditions** — Western Tropical, Hellenistic, Medieval/Perso-Arabic,
Vedic/Jyotiṣa, Krishnamurti Paddhati, Maya/Mesoamerican, Chinese Four Pillars,
Uranian, Draconic, Harmonic (Addey), Heliocentric, Western Sidereal, Thirteen-sign.

**36 divisions** · **7 aspect families** · **7 frames** with ayanāṁśas as exact
arcseconds (Lahiri 85,871″ · Fagan–Bradley 86,741″ · Raman 80,568″ · KP 85,691″).

**13 house systems, 5 exact and 8 gated OPEN.** Whole sign, Equal from ASC,
Equal from MC, Vehlow, and Porphyry are exact integer constructions. Placidus,
Koch, Regiomontanus, Campanus, Alcabitius, Topocentric, Morinus and Meridian
require an obliquity model, which would put a float in the path — so they are
declared OPEN rather than faked.

---

## Claim discipline

Every claim in `CLAIM_BOUNDARY.md` is tagged **PROVEN**, **OPEN**, or
**REJECTED**, and rejected claims stay in the document with the computation that
killed them rather than being edited away. `REMEDIATION_LEDGER.md` records each
corrective pass (P1–P23).

**Axioms actually in force:** A1 exactness (no floats, ever) and A2 Garner
retirement (retires the cascade, not the yield). **A3 (immutable basis) is not
in force** — it was imported from an external document and made load-bearing
before the author had approved it; it has been withdrawn as a premise, and no
claim here depends on it.

### Corrections of record — a sample

- **"shadow spine = the off-ring primes"** — REJECTED. Separate axes; the cross is fully occupied.
- **"14,174,742 exact operators"** — REJECTED. Per lane the count is `(p−1)·φ(p−1)`; the derived total over S8 is **5,096,079,360**.
- **Native sqrt and in-lane Frobenius** — REJECTED. sqrt is undefined on 98.13% of the torus and 128-valued where defined; `x^p = x` on a prime field makes Frobenius the identity.
- **"Ramanujan primes {2,11,17}"** — REJECTED. `S_R` is the partition-congruence set `{5,7,11}`: `p(5n+4) ≡ 0 (mod 5)`, `p(7n+5) ≡ 0 (mod 7)`, `p(11n+6) ≡ 0 (mod 11)`. 13 has no congruence at any offset.
- **"Sidereal frames don't move whole-sign houses"** — FALSE, mine. Counterexample: asc 0, body 107,999″, ayanāṁśa 100,000″ → house 1 becomes house 2. Degree-based houses are invariant; whole-sign shifts by `δ_asc − δ_body`, bounded to ±1 house.
- **The transduction corridor was certified against the wrong magnitude** — Φ acting lane-wise pins target *residues* but says nothing about `⌊Φ(x)/M_B⌋`. A magnifying Φ was reported `corridor_certified: true` while returning 653,740 instead of 10,000,000. A non-trivial `phiLane` now must declare `phiBound` or `phiMagnitude`, or it is refused.
- **`parkingReport` admitted an off-basis prime** — it gated admissibility on coprimality alone, so lane 23 passed although `23 ∤ M₈` and no such lane exists in the tray.

---

## Repo map

```
project/
  src/core/            the exact core — BigInt only, no UI, no prose
    basis.js             S8, both splits, the parked constants
    shell-kelim.js       K-Elimination, the lift, the tray register
    hcrm-core.js         HCRM_REGISTER_V2
    cram.js              adjacency, gradient, state tuple, transduction χ
    anchor.js            anchor admissibility, i.i.d., the parked lane
    fixture.js           star lift, winding tower, phase lock, unit lane
    ring.js              ring factorisation, Harmonic Closure
    variants.js          traditions, divisions, frames, houses, aspects
    safe-basis.js        role taxonomy, Gaussian class, tiers, boot gates
    rho.js               ρ(n) and the stability bands
    shadow-spine.js      shadow and closure axes, event classes
    arrow.js             the (r,K) identity, lap saturation, shadow entropy
    operators.js         lane-operator atlas, enumerated not asserted
  test/
    run.js               headless runner  →  npm test
    *.test.js            the suites the browser gate also runs
  Core Test Harness.html the gate — same modules, in a browser
  CLAIM_BOUNDARY.md      every claim, tagged, with counter-computations
  REMEDIATION_LEDGER.md  the corrective passes, P1–P23
  STATUS.md              current classification per module
```

---

## Running it

```bash
cd project
npm test           # full suite + the exhaustive 1,296,000-point ring sweep
npm run test:quick # skip the sweep
```

No dependencies and no build step — Node ≥ 18 for BigInt and ES modules. For the
browser gate, serve the folder over HTTP (the no-float audit reads source, which
`file://` blocks) and open `Core Test Harness.html`:

```bash
cd project && python3 -m http.server 8000
```

---

## Provenance

CRAM was reverse-engineered from the **Dresden Codex** by the repository author,
who is the authority on its design. Where this implementation and an external
write-up disagree, the disagreement is recorded in `CLAIM_BOUNDARY.md` with the
computation that settles it.

This repository began as a Claude Design export bundle; `chats/` retains the
original design transcripts. The core under `project/src/core/` is
implementation, not prototype.
