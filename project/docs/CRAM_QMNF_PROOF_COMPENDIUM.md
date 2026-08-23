# CRAM/QMNF — Formal Proof Compendium

Anthony Diaz (Acid) — HackFate.us / Skyelabz210
Axiomatic foundation: **A1** (exact integer primacy) · **A2** (lane independence preserved)

**Evidence:** `test/proof-compendium.test.js` — 24 rows, exhaustive exact sweeps,
BigInt only. Every PROVEN tag below points at rows in that suite.

## What this document is, and what it is not

This is the compendium of the twelve core arithmetic identities that let CRAM
dissolve the classical RNS constraints: universal projection, K-Elimination,
the star-family inverses, adjacency, shared-factor syndromes, and one-wave digit
extraction.

Claim tags follow `CLAIM_BOUNDARY.md`. Two of them matter here:

- **PROVEN** — proven by exhaustive exact test *in this repo*. That is what the
  suite delivers: a full sweep of a bounded exact range, not a sample.
- **LEAN-PROVEN** — machine-checked in `cram-substrate`. **Nothing here carries
  that tag.** There is no Lean toolchain in this repository, so no proof in this
  document has been machine-checked here. The Lean fragments circulated with the
  source draft do not compile as written — they call lemmas that do not exist in
  Mathlib (`Nat.div_mod_identity`, `Nat.modeq_sub_one_of_succ`,
  `Nat.mod_eq_zero_iff_dvd`), state `ℕ` subtraction where the mathematics needs
  `ℤ`, and in one case close a goal with a term of the wrong type. They are
  retained upstream as proof *sketches*; formalization is an OPEN obligation,
  tracked below.

Three statements in the source draft are arithmetically **false as written** and
are corrected here. Each correction is pinned in the suite from both sides: the
corrected form holds everywhere in range, and the original fails on a named
counterexample.

## The axioms, as they actually operate

### A1 — exact integer primacy

No floating-point type appears anywhere in the computational substrate. Every
quantity is an exact integer, a residue tuple, or an exact algebraic-integer
extension element. Enforced mechanically by the no-float gate over `src/core`
(`test/no-float-audit.js`), and the proof suite holds to the same standard.

### A2 — lane independence preserved

**A2 is about preserving the truth of lane independence. It is not a ban on
reconstruction.** The i.i.d. property of the residue space is the invariant; what
A2 forbids is any operation that manufactures *non-invertible, data-dependent
cross-lane dependencies* and thereby destroys it.

So:

- **Permitted** — exact invertible parallel operations; K-Elimination (a phase
  differential read from two independent residues); transduction (a parallel
  dot-product against precomputed constants); the fifth operator (lane-wise
  quotient with per-lane inverses); universal projection (a linear combination
  of independent residues).
- **Permitted, and named as what it is** — reconstruction at a declared
  boundary. Forming `r + K·M` is a *radix composition*: exact, legitimate, and
  confined to boundary projections (`projectToInteger` in `src/core/cram.js`).
  It is not a violation of A2. It is simply not an operation *of* the tray, and
  calling it "the yield" is the error A2 guards against.
- **Prohibited** — the Garner/MRC cascade, where digit *i* consumes digits
  *0..i−1*; approximate or non-invertible division; non-bijective operations on
  the core arithmetic state; any synthetic state not derivable from the residue
  tuple.

The distinction is the whole content of Theorem 3: K-Elimination and a Garner
digit both produce a quotient-like quantity, and only one of them couples lanes.

## The theorems

| # | Theorem | Status | Suite rows | Code |
|---|---------|--------|-----------|------|
| 1 | Universal projection (T0) | PROVEN | 2 | — |
| 2 | K-Elimination soundness | PROVEN | 2 | `generalRecover` |
| 3 | K-Elimination is not a Garner digit | PROVEN (structural) | 2 | `yieldCost` |
| 4 | Star-family message transparency | PROVEN | 1 | — |
| 5 | Star-family free inverse | PROVEN | 1 | `inverse` (cross-check) |
| 6 | Adjacency lane residue — **corrected** | PROVEN | 2 | — |
| 7 | Adjacency anchor inverse — **corrected** | PROVEN | 2 | `adjacencyRecover` |
| 8 | Shared-factor forward implication — **corrected** | PROVEN | 2 | — |
| 9 | One-wave digit extraction (T38) — **sign corrected** | PROVEN | 3 | `adjacencyRecover` |
| 10 | Arbitrary plaintext modulus | PROVEN | 1 | — |
| 11 | Scheme migration as transduction | ARGUED · exercised | 2 | `transduce`, `certifyTransduction` |
| 12 | Unified rescale pipeline — **citation corrected** | PROVEN | 2 | `generalRecover` |

---

### Theorem 1 — Universal projection (T0)

For integers `X = γ + K·M` and any `A > 0`:

    X mod A = ((γ mod A) + ((K·M) mod A)) mod A

**Proof.** `X ≡ γ + K·M (mod A)` by definition, and the right-hand side is the
canonical residue of `γ + K·M` modulo `A`. No coprimality and no primality enter
the argument, so the identity holds for every positive `A`. ∎

**Corollary.** Every modulus is a view lane. The classical requirement that
moduli be pairwise coprime (or prime) to be projected through does not apply to
projection — it applies to *recovery*, which is Theorem 2.

Swept over 20,280 `(γ,K,M,A)` points, plus the extreme case `gcd(M,A) = M`.

### Theorem 2 — K-Elimination soundness

Let `gcd(M,A) = 1` and `0 ≤ X < M·A`. With `r = X mod M`, `s = X mod A`:

    K = ((s − r) · M⁻¹) mod A  =  ⌊X/M⌋

**Proof.** Write `X = qM + r`, `q = ⌊X/M⌋`; `X < M·A` gives `q < A`. Reducing mod
`A`: `s ≡ qM + r`, so `qM ≡ s − r (mod A)`. Multiplying by `M⁻¹ mod A` gives
`q ≡ (s − r)M⁻¹ (mod A)`, and since `0 ≤ q < A` the least non-negative residue
*is* `q`. ∎

**The range hypothesis is load-bearing.** At `X = M·A` the quotient leaves
`[0,A)` and K wraps: `M=5, A=7, X=35` recovers `0`, not `7`. The suite pins this
rather than leaving it as an unstated side condition.

Swept over 312 coprime `(M,A)` pairs, 52,546 values, against the shipped
`generalRecover`.

### Theorem 3 — K-Elimination is not a Garner digit

| | K-Elimination | Garner digit |
|---|---|---|
| form | `(s − r)·M⁻¹ mod A` | `dᵢ = (rᵢ − Σ_{j<i} dⱼ∏_{t<j} p_t)·(∏_{t<i} p_t)⁻¹ mod pᵢ` |
| inputs | two independent residues | all previously computed digits |
| cost | O(1), lane-count independent | O(k²), grows with the basis |
| A2 | compliant | violates — synthetic cross-lane state |

**Proof.** Garner's digit *i* requires digits `0..i−1`, which are *computed
outputs of other lanes*; that is precisely a data-dependent cross-lane
dependency, and it destroys i.i.d. K-Elimination reads `r` and `s`, two raw lane
values. No lane reads another lane's computed output. ∎

Asserted two ways: K is invariant under changing everything except the residue
pair, and the repo's own cost model reports `depends_on_lane_count: false` for
both K-Elimination modes and `true` for Garner (2 and 3 ops against 48 at eight
lanes).

### Theorem 4 — Star-family message transparency

For `q = c·t + 1`: `q ≡ 1 (mod t)`. Immediate. Every drop is
message-transparent — no scale ledger is needed. Swept over 3,540 `(t,c)` pairs.

### Theorem 5 — Star-family free inverse

For `q = c·t + 1`: `t⁻¹ ≡ q − c (mod q)`.

**Proof.** `c·t = q − 1`, so `t(q − c) = tq − tc = tq − (q − 1) ≡ 1 (mod q)`. ∎

The inverse is *construction-read*: no extended Euclid. Swept over 3,540 star
pairs, each cross-checked against `inverse` (egcd) — they agree on every point.

### Theorem 6 — Adjacency lane residue (corrects U3)

Let `A = P + 1`. For `X = γ + K·P`:

    X ≡ γ − K  (mod A)

**Proof.** `A = P + 1` gives `P ≡ −1 (mod A)`, hence `K·P ≡ −K`, hence
`X ≡ γ − K`. ∎

**Correction.** The identity is `γ − K`, not `γ + K`. The withdrawn form is not
a rarer variant of the same map: it coincides only where `2K ≡ 0 (mod A)` —
2,677 of 33,579 swept points — and is wrong on the rest.

### Theorem 7 — Adjacency anchor inverse (corrects U6)

For `A = P + 1`: `P² ≡ 1 (mod A)`, so `P⁻¹ ≡ P (mod A)` — `P` is its own
inverse, and the anchor inverse is free.

**Correction.** The correct identity is `P⁻¹ mod (P+1) = P`. The earlier
`(P·A) mod P = 1` is withdrawn.

**Consequence.** This is exactly why the adjacency collapse is one subtraction:
with `M⁻¹ ≡ −1`, `(s − r)·M⁻¹ ≡ r − s`, so general K-Elimination and
`adjacencyRecover` are the *same map*. Verified identical over every `(r,s)` pair
for `M ≤ 60`.

### Theorem 8 — Shared-factor forward implication (corrects U4)

With `d = gcd(Bᵢ, Bⱼ)`: if `X ≡ Y (mod Bᵢ)` and `X ≡ Y (mod Bⱼ)` then
`X ≡ Y (mod d)`.

**Proof.** `Bᵢ | (X−Y)` and `Bⱼ | (X−Y)`; `d` divides both, so `d | (X−Y)`. ∎

**Correction — the converse is false.** `Bᵢ = 4`, `Bⱼ = 6`, `d = 2`, `X = 0`,
`Y = 2`: the two agree mod 2 and differ mod 4. Only the forward implication
holds, so a shared-factor lane is a *syndrome channel* — it can witness
disagreement, never certify agreement. E-X2 is a regime router, not a wall, and
a reading that inverts the implication is unsound.

Forward direction swept over 65,112 agreeing `(X,Y)` pairs.

### Theorem 9 — One-wave digit extraction, T38 (**sign corrected**)

Let `A_t = P_t + 1` and `0 ≤ X < P_t·A_t`. Then:

    κ_t = ((X mod P_t) − (X mod A_t)) mod A_t  =  ⌊X/P_t⌋ mod A_t

**Proof.** This is K-Elimination with `M = P_t`, `A = A_t`; `gcd(P, P+1) = 1`
always, and the range hypothesis is given. By Theorem 7, `P⁻¹ ≡ −1 (mod A)`,
so `(s − r)·P⁻¹ ≡ r − s`. ∎

**Correction — the sign is inverted in the source draft.** The draft states
`κ_t = ((X mod A_t) − (X mod P_t)) mod A_t`. That is a different map, and it is
wrong: it fails on 21,740 of 22,958 swept points, the smallest counterexample
being `P = 2, A = 3, X = 2`, which the draft form gives as `2` where the true
digit is `1`. The multiplication by `P⁻¹ ≡ −1` is not a no-op — it flips the
difference. `adjacencyRecover` in `src/core/cram.js` already had the sign right;
the corrected statement and the shipped function agree on every point in range.

**The one-wave property.** `κ_t` is a function of `(X mod P_t, X mod A_t)` alone.
There is no digit-to-digit edge, so all digits are extracted in parallel from `X`
in a single wave.

### Theorem 10 — Arbitrary plaintext modulus

For any `t > 1` with factorization `t = ∏ pᵢ^eᵢ`, CRT gives
`ℤ/tℤ ≅ ∏ ℤ/pᵢ^eᵢℤ`. Verified as a bijection — not quoted — for every `t ≤ 200`
(139 of them composite): factors multiply back to `t`, are pairwise coprime, and
the residue map is injective over the whole range.

**Corollary.** `t` may be arbitrary composite; slot packing is a design variable,
not a constraint.

### Theorem 11 — Scheme migration as transduction

Given bases `𝔅_A`, `𝔅_B` with products `M_A`, `M_B` and a common anchor
`A₀ = M_A·M_B + 1`, a CRAM state `(γ_A, K_A)` migrates to `(γ_B, K_B)` by a
linear operation, without ever forming `X`:

1. Project onto the anchor (Theorem 1) to read `X mod A₀` from available
   residues.
2. K-Eliminate at `M_A` and at `M_B` against `A₀` (Theorem 2).
3. Both required inverses are construction-read: `A₀ = M_A·M_B + 1` is a star
   modulus, so `M_A⁻¹ ≡ A₀ − M_B` and `M_B⁻¹ ≡ A₀ − M_A` by Theorem 5.

Status: **ARGUED**, and exercised against the shipped `transduce` — B6 → B8 with
`ω = preserve` preserves the carried value on every sampled state, and
`certifyTransduction` gates the migration before it runs. A full proof that the
sketch's three steps are what `transduce` performs is **OPEN**.

### Theorem 12 — Unified rescale pipeline (corrects U1)

Let `Q = t·Δ`, `A = Q + 1`, and `Y = x·t + ⌊Δ/2⌋` for `0 ≤ x < Q`. Where
`Y < Δ·A`, K-Elimination with `M = Δ` against `A` recovers

    K = ⌊Y/Δ⌋ = ⌊(x·t + ⌊Δ/2⌋)/Δ⌋

and the BFV rescale is `K mod t`.

**Correction — the inverse citation.** The draft cites the adjacency anchor
inverse (Theorem 7) for `Δ⁻¹ mod A`. That is wrong: `A = tΔ + 1` is adjacent to
`tΔ`, not to `Δ`, so `Δ² ≢ 1 (mod A)` — it fails on all 529 swept `(t,Δ)` pairs.
The correct inverse is the *star-family* inverse of Theorem 5 with the roles
swapped: `Δ⁻¹ ≡ A − t (mod A)`. Still construction-read, so nothing about the
pipeline's cost changes — only the justification.

**Correction — the shape of the claim.** This is not a single algebraic equality
but a pipeline construction. The BFV rescale and the BGV modulus switch are one
primitive with two exits.

**Range.** `Y < Δ·A` holds when `t ≤ Δ`; the sweep respects that hypothesis
instead of assuming it away — 20,383 in-range points, all exact.

## Certification

**A1.** Every quantity is `ℕ`/BigInt. No float type, no rounding, no truncation,
no approximation in any proof path. Mechanically enforced over `src/core` by the
no-float gate; held to by the proof suite.

**A2.** Lane independence preserved throughout. No Garner reconstruction appears
in any proof. Universal projection, K-Elimination and transduction are all
lane-independent or exact precomputed-linear. Boundary projection
(`projectToInteger`) is named as a radix composition where it occurs, and is not
counted as a tray operation.

## Open obligations

| Obligation | Status |
|---|---|
| Lean 4 formalization of T1–T10 in `cram-substrate` | OPEN — no toolchain here; circulated fragments do not compile |
| Theorem 11 full proof (that `transduce` performs the three sketched steps) | OPEN |
| Theorem 12 pipeline stated end-to-end as a single certified primitive | OPEN |

## References

1. Brakerski, Z., & Vaikuntanathan, V. (2011). Efficient FHE from (standard) LWE. FOCS 2011.
2. Fan, J., & Vercauteren, F. (2012). Somewhat practical fully homomorphic encryption. IACR ePrint 2012/144.
3. Geelen, R., & Vercauteren, F. (2023). Bootstrapping for BGV and BFV. Journal of Cryptology.
4. CRAM Recumbent Execution Model (2026). HackFate.us.
5. K-Elimination Theorem (2026). Skyelabz210/k-elimination-lean4.
6. Universal Projection T0; star-family construction and T37/T38 (2026). HackFate.us.
7. `CLAIM_BOUNDARY.md`, `STATUS.md` — this package's claim vocabulary and layer map.
