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

## Axioms actually in force

A1 (exactness — integers/rationals only, no floating point) and A2 (Garner
retirement — no mixed-radix cascade, no synthetic positional emission) are in
force and are enforced by `test/no-float-core.test.js` and by the tower/radix
separation in `src/core/fixture.js`.

**A3 (fixed immutable basis) is NOT in force.** It was imported from an external
framework document and briefly made load-bearing in the P17 anchor argument.
That premise is withdrawn; no claim in this package depends on it.

**A2 retires Garner, not the yield.** The yield is O(1) and it does **not**
couple: K-Elimination gives K, r is already there, and the number IS the pair
(r, K). On an adjacent anchor that is one modular subtraction —
`K = (r − s) mod (M+1)` — two operations, no inverse, no dependence on lane
count or magnitude.

**CORRECTED (P20).** A previous pass wrote the yield as "K-Elimination plus one
multiply-add, X = r + K·M". That multiply-add is a **radix composition**: r is
the low digit, K the high digit, M the radix. It reintroduced the positional
emission A2 retires, inside the very function meant to avoid it. Forming
`r + K·M` is a BOUNDARY PROJECTION, costs two further operations, and is now
named as such. The same applies to `towerRebuild` — Horner in base M, a radix
step, a faithfulness check at the boundary and not an operation of the tower.

The pair needs no composite to be useful: it is injective over the whole span
(verified without ever forming the integer), and equality and ordering read
straight off it — lexicographic (K, r) reproduces integer order exactly.

| | ops | couples |
|---|---|---|
| yield, adjacent anchor | 2 | no |
| yield, general anchor | 3 | no |
| boundary projection `r + K·M` | +2 | **yes** |
| Garner, 8 lanes | 48 | **yes** |

## Current classification

- **HCRM register core** (`src/core`) — **RE-BASED (P21)** onto the parked
  split and PROVEN over the full ecliptic arcsecond ring [0, 1,296,000) with
  zero failures and no floating point. Canonical: shell {2,3,5,7,13,17,19} =
  **881,790** with the internal anchor on the **parked lane 11**,
  `K ≡ (s − r)·7 (mod 11)`. The register (`HCRM_REGISTER_V2`) reports the
  identity **pair** (r, K) — the two are never fused.
- **Parked winding bound 0 ≤ K ≤ 1** — PROVEN (⌊(ARC−1)/881,790⌋ = 1). The ring
  spans two laps of the parked shell, so the bare lane-11 anchor covers it with
  an order of magnitude to spare.
- **Parked anchor admissibility** — PROVEN: 11 is a lane of SafeS8 (internal,
  tray-determined) and is disjoint from the shell lanes, so i.i.d. survives —
  `laneDependency(B8, 11)` is exactly {11}.
- **SafeS8 injectivity over the ring** — PROVEN (CRT; ARC < M8). Unchanged: the
  basis did not move, only the shell/anchor split.
- **Legacy gear split** — RETAINED and still PROVEN: shell M6 = 30,030, anchor
  17·19 = 323, inverse 287, K ≤ 43. Both splits are swept together over the
  whole ring, so the re-base loses nothing. The wider 323 anchor was needed only
  because 11 sat in the shell.

### Astrology Remastered (`ring.js`, `variants.js`, `safe-basis.js`, `rho.js`, `shadow-spine.js`, `arrow.js`)

**Correction of record.** An earlier pass defined "the shadow spine" as the
off-ring set {7, 11, 13, 17, 19}. That claim is **REJECTED**. Shadow is the
Gaussian/mod-4 class — inert primes, p ≡ 3 (mod 4) — which in the Safe Basis is
{3, 7, 11, 19}, anchored at 11. Off-ring is a separate closure axis. Both are
now carried, separately, and the entries below are stated on the correct axis.

- **Ring factorisation R = 2⁷·3⁴·5³ = 1,296,000** — PROVEN (recomputed from
  factors, not asserted).
- **Harmonic Closure Theorem** — PROVEN for every n ≤ 2000: the n-fold division
  of the zodiac closes on the integer arcsecond ring **iff** n = 2^a·3^b·5^c
  with a ≤ 7, b ≤ 4, c ≤ 3. Ring-smoothness alone is not sufficient (2⁸ ∤ R).
- **Off-ring set is derived** — PROVEN: {7, 11, 13, 17, 19} are exactly the
  SafeS8 primes in which R has a nonzero residue, with defects 6, 2, 4, 5, 10
  arcseconds. This is the CLOSURE axis.
- **Shadow spine** — PROVEN: {3, 7, 11, 19} are exactly the SafeS8 primes inert
  in Z[i]; the split primes {5, 13, 17} carry two-square witnesses (5 = 1²+2²,
  13 = 2²+3², 17 = 1²+4²) and 2 ramifies. 11 is the Shadow Anchor (δ = 1), 19
  the escalation (δ = 2).
- **The two axes cross, fully** — PROVEN: all four cells of shadow × closure are
  occupied — {3} absorbed shadow (the trine), {7,11,19} irreducible shadow,
  {2,5} plain ring primes, {13,17} boundary and saturation. Neither axis
  determines the other.
- **Role taxonomy** — DEFINED: 2 parity · 3 triadic · 5 surface · 7 bridge ·
  11 shadow anchor · 13 boundary · 17, 19 saturation extenders.
- **Saturation** — PROVEN: M6 = 30,030 < 1,296,000, so the classical six
  under-saturate the ring (44 laps, K ≤ 43); the twin extenders 17·19 = 323 > 43
  restore unique representation, and M8 saturates outright.
- **ρ(n) = ω(n) + δ(n)** — PROVEN against the framework's reference values:
  Tzolk'in 260 → 3, Haab 365 → 2, shell 30,030 → 7, Colony 9,699,690 → 10.
  δ has no gap: no prime strictly between 11 and 19 is ≡ 3 (mod 4).
- **Every registered division is Stable** — PROVEN: all 36 divisions across all
  13 traditions have ρ ≤ 4. The ring itself is ρ = 3 Stable, its basis shell
  ρ = 7 Strong, the Colony ρ = 10 Chaotic.
- **The arrow** — PROVEN: X = r + K·M carries forward and backward under one
  signed rule; lap saturation is a bijection for a pairwise-coprime basis and
  collapses measurably otherwise ({4,6,10} → 180 collisions); H_shadow = 0 while
  K is carried, and equals log₂ L exactly when K is discarded over L laps.
- **Closure ⟺ no off-ring factor, across the whole variant registry** — PROVEN
  over every division of every registered tradition.
- **Lane orthogonality** — PROVEN by exhaustive ring sweep: every sign contains
  every residue of every off-ring lane, and every event class fires in every
  sign. The lanes are therefore a genuinely independent axis, not a re-encoding
  of sign, decan or house.
- **Event census** — PROVEN: swept counts equal the BigInt closed form
  (SH-body 117,819 · B13-zero 99,693 · B13-pre 99,692 · H7-body 185,143 ·
  G19-body 68,211 · G-zero 4,013 · G-pre 4,012). Every event declares the axis
  it reports on, so shadow, boundary and saturation can never render as one.
- **Classifier completeness** — PROVEN: body classification has period
  7·11·13·17·19 = 323,323, and `bodyEvents` agrees with the census classifier
  exhaustively over one full period, hence over the whole ring.
- **Frame additivity** — PROVEN by exhaustive sweep over the ring × every
  declared sidereal frame: separations and degree-based house placement are
  invariant; sign naming shifts by exactly ⌊ω/30°⌋ or one more; whole-sign house
  placement shifts by exactly δ_asc − δ_body, hence never more than one house.
- **Ayanamsa constants** (Lahiri, Fagan–Bradley, Raman, Krishnamurti at J2000.0)
  — DEFINED. Adopted here as exact integer arcseconds, not derived. The frame
  certification above is universal in the offset, so ayanamsa accuracy is
  orthogonal to it.
- **Quadrant house systems** (Placidus, Koch, Regiomontanus, Campanus,
  Alcabitius, Topocentric, Morinus, Meridian) — OPEN. They require oblique
  ascension; the exact core will not synthesise them. Five systems (whole sign,
  equal from ASC, equal from MC, Vehlow, Porphyry) are PROVEN integer-exact.
- **Heliocentric frame** — OPEN. A change of origin, not a ring rotation;
  admissible only from a certified ledger.
- **Tradition-selection claim** — ARGUED. That the received apparatus closes and
  the marginal families do not is PROVEN arithmetic; the inference that the
  tradition *selected* for closure is historical reasoning, not a theorem.

### The parked lane (`src/core/anchor.js`) — P18

**A lane cannot be both the anchor and part of the shell.** The shadow lane 11
is left EMPTY — in the basis, so the tray reaches it and internality holds, but
excluded from the shell product so it can carry the winding.

- **Parked shell** — PROVEN: M = 2·3·5·7·13·17·19 = **881,790 = M₈/11**, with
  lane 11 as the anchor. Shell and anchor disjoint and coprime.
- **Ecliptic ring needs K ≤ 1** — PROVEN exhaustively: with 11 parked the ring
  spans two laps of the shell, so the bare lane-11 anchor covers it outright.
  The K ≤ 43 corridor and the gear pair 323 were solving a problem created by
  loading 11 into the shell (M₆ = 30,030 → 44 laps).
- **The shadow lift needs no Hensel step** — PROVEN: gcd(11⁶, 881,790) = 1, so
  the lift is plain coprime K-Elimination. Same corridor,
  881,790 · 11⁶ = 9,699,690 · 11⁵ = 1,562,144,774,190, obtained without the
  divide-by-11.
- **Widening to 11⁶ is a lane widening, not a basis extension** — PROVEN:
  11⁶ ∤ M₈, so the lane must be carried at that power; the basis
  {2,3,5,7,13,17,19,11⁶} is pairwise coprime and the anchor is tray-determined
  by construction. This is what Sh = {11⁶, 13, 17, 19} has always meant.
- **Refusal** — PROVEN: `parkedRecover` throws when the parked prime is still in
  the shell, because no inverse exists there.
- **The winding is DERIVED, not carried (P23)** — PROVEN. K is not a stored
  field; it is a function of the tray, recovered on demand by K-Elimination on
  the parked lane. Depth comes from LIFTING the same lane to 11^e and
  eliminating again — level e yields one base-11 digit of K:

  ```
  level 1:   K ≡ (s₁ − r)·M⁻¹  (mod 11)      level 2:   K ≡ (s₂ − r)·M⁻¹  (mod 11²)
  ```

  The levels agree because the lane is PHASE LOCKED: s₂ ≡ s₁ (mod 11), so
  lifting never moves the phase the fixture was affixed to. Level e is the same
  single modular subtraction as level 1 at a higher power of the same prime —
  not a new lane, not a basis extension. No Hensel step at any depth, because
  parking makes gcd(M_SHELL, 11) = 1 and M invertible mod 11^e for every e.
  Corridors: level 1 → 9,699,690 (the full Colony, since 881,790 · 11 = M₈),
  level 2 → 106,696,590, level 6 → 1,562,144,774,190 (the SD-11 anchor).
  Verified exact across the whole double-lift corridor and at level 6 out to
  1.56 × 10¹². `trayRegister` carries no K field at all.
- **CORRECTED (P22) — parking moves a lane out of the shell; it cannot conjure
  one.** `parkingReport` gated admissibility on coprimality alone, so an
  off-basis prime passed: `parkingReport(B8, [23])` returned
  `admissible: true` — gcd(M₈, 23) = 1 — while 23 ∤ M₈, so the tray has no
  mod-23 lane to read. That is precisely the EXTERNAL anchor this module rejects
  three sections down; the report contradicted `trayDeterminesAnchor`. Nothing
  was in fact parked either: filtering the shell by a prime the basis lacks
  removes nothing, so the report also showed all eight lanes still in the shell.
  Admissibility now requires the parked lane to be **in the basis** —
  `parked_in_basis`, with any offenders named in `external_lanes`. Widening an
  existing lane to p^k stays admissible (it is read off the tray at more
  precision); importing a new prime does not.

### The hidden carry (`src/core/carry.js`) — P25

Every reduction emits a residue **and** a quotient. The residue was kept and the
quotient discarded; the quotient is the carry.

- **The carry is SIGNED** — PROVEN. Under least-nonnegative residues the winding
  is always ≥ 0 and the sign is gone. The centred residue `r ∈ (−p/2, p/2]` with
  `w = (x − r)/p` keeps it: `w` counts to the *nearest* shell, so it goes
  negative below one. `x = r + p·w` exact over 401 consecutive values at p = 7.
- **It is the K-Elimination winding, not the p-adic valuation** — PROVEN:
  `w_7(49) = 7` where `v_7(49) = 2`. Different objects.
- **The anchor reads the carry NEGATED** — PROVEN (Lemma 1). For any anchor with
  `M ≡ −1 (mod A)`, `v_A = (r − K) mod A`. Verified over `[0, 5000)` at
  M = 36, A = 37, zero mismatches.
- **The closed-shell descent** — PROVEN. At `r = 0` the anchor reads `(−K) mod A`,
  so successive closed shells walk it *downward*: `v₃₇ = 36, 35, 34, 33` at
  `N = 36, 72, 108, 144`. In the residue lane those shells are indistinguishable
  — each reads `r = 0` — and the descending anchor is what separates them. The
  ecliptic ring holds exactly two closed shells of `M_SHELL`, and only the parked
  lane tells them apart.
- **The shadow is the readable channel** — PROVEN. Under a uniform ensemble an
  additive lane's residues are exactly i.i.d., so the digit channel is featureless
  *by construction* and absence of structure there proves nothing. Squaring is not
  an additive shift: `r ↦ r² mod p` is 2-to-1 on nonzero residues and its image
  covers only `(p+1)/2` of `p` values (7 of 13, 19 of 37 — recomputed), and the
  discarded quotient `⌊r²/p⌋` inherits that structure.
- **CORRECTED — `transduce` discarded the lane shadow.** It computed
  `mod(phiLane(v,b), b)` and dropped `⌊Φ(v)/b⌋` on the floor, which is precisely
  the one channel that is not blind. The lineage now carries `lane_carry` and
  `carry_energy`. No value changes; the quotient is simply no longer lost.
- **The carry functional** — PROVEN: `C = Σ w²` is non-negative, integer-valued,
  and zero exactly when every value is a pure centred residue.

### Anchor admissibility (`src/core/anchor.js`) — P17, REVERSES P14

**Correction of record.** P14 called the adjacent anchor A = M+1 canonical and
dismissed the gear pair 17·19 = 323 as "an RNS move, drawn from inside the
basis". That is backwards, and the reason is stronger than cost.

- **The tray determines x mod A iff A | M** — PROVEN. x and x + M share the
  entire tray; their residues mod A differ by M mod A.
- **A = M₆ + 1 = 30,031 is not tray-determined over SafeS8** — PROVEN.
  M₈ mod 30,031 = 29,708 ≠ 0. Witness: x = 123,456 and x + M₈ = 9,823,146 agree
  on every one of the eight lanes yet read 3,332 and 3,009 modulo 30,031.
- **AMENDED (P19) — "it cannot be evaluated in residue space at all."** Withdrawn
  as an overclaim. It IS reachable: reconstruct in O(1) and reduce. What stands
  is the i.i.d. objection — reconstruction couples all eight lanes, so an
  external anchor belongs at a declared boundary and not in the hot path. The
  A3-based half of the original argument is withdrawn with the axiom.
- **O(1) uncoupled yield** — PROVEN: `K = (r − s) mod (M+1)` exhaustive over
  all 1,332 states of the 36/37 lift, giving 1,332 distinct pairs with no
  composite formed; general form verified over the internal shell/anchor pair.
  2 and 3 ops, independent of lane count, neither coupling r to K.
- **The pair is sufficient** — PROVEN: injective over the span, and equality and
  order both computed directly on (K, r) with zero mismatches against integer
  order. Nothing downstream needs the composite.
- **i.i.d.** — PROVEN by lane-dependency enumeration: the internal anchor 323 is
  pinned by exactly lanes {17, 19}, disjoint from the six shell lanes, so every
  lane is still produced by its own reduction of x. The external anchor couples
  all eight lanes and is still undetermined.
- **CANONICAL for SafeS8: the internal gear anchor** — PROVEN. Shell 30,030 ·
  anchor 323, internal, disjoint, tray-determined, coprime. The precomputed
  inverse 287 is the price of internality and is not optional. This restores the
  original configuration; P14's designation is withdrawn.
- **Adjacency is not lost — it is designed in** — PROVEN. A star pair
  (6n(n−1), S_n) is adjacent and realisable as sub-products of one pairwise-
  coprime basis: S₂ {4,3,13}, S₃ {4,9,37}, S₄ {8,9,73}, S₆ {4,9,5,181}. On those
  bases K ≡ r − s is exact, exhaustively verified over every state, with the
  anchor internal and tray-determined. SafeS8 is simply not such a basis.
- **Refusal** — PROVEN: `internalAdjacencyRecover` throws on a non-internal
  anchor, on a non-adjacent one, and on overlapping shell/anchor lane sets,
  rather than performing an operation the tray cannot support.

### CRAM layer (`src/core/cram.js`, canonical path in `shell-kelim.js`)

**Correction of record.** The project used the Safe Basis the way an RNS uses
moduli: a flat set of PRIMES, with the winding recovered through an anchor drawn
from *inside* the basis (17·19 = 323) and a precomputed inverse (287). Correct
arithmetic, wrong architecture. Four mechanisms were being missed.

- **Adjacency collapse identity** — PROVEN exhaustively over the ecliptic ring:
  with A = M + 1, M ≡ −1 (mod A) so M is its own inverse and
  `K ≡ r − s (mod M+1)`, 1,296,000/1,296,000. **Superseded by P17 as to
  canonicity**: exact arithmetic, but admissible only where the anchor is
  internal. Over SafeS8 it reads the integer, not the tray.
- **The adjacent modulus is coprime for free** — PROVEN: gcd(M, M+1) = 1 always,
  and it is usually composite (30,031 = 59·509, 9,699,691 = 347·27,953).
  Coprimality is necessary, not sufficient — admissibility also needs
  internality.
- **Corridor** — PROVEN: 30,031 against 323 is 92× wider. A corridor the tray
  cannot reach is not usable; the star-lift bases are how the saving is taken.
- **Coprimality, not primality** — PROVEN: adjacency K-Elim is exact on the
  all-composite basis {8, 9, 25, 49, 11, 13} (M = 12,612,600), where no lane is
  a field. Primality is required by the FIELD layer (square root, Legendre,
  index), not by CRT, winding, comparison or division-by-constant.
- **Resolution gradient** — PROVEN exhaustively: gcd(M, A) = d > 1 degrades
  resolution to A/d rather than failing. gcd(260, 365) = 5 → resolution 73, and
  73 · 260 = 52 · 365 = lcm = 18,980, verified over the full period. The Maya
  Calendar Round is a K-Elimination result, not a narrative one; 73 is the star
  number S₄ = 6·4·3 + 1 and Haab 365 = 5 · 73. Adjacency is the d = 1 extreme of
  this same law.
- **Shadow lift** — PROVEN as arithmetic; **SUPERSEDED as canonical (P18)**.
  The Hensel form pins K modulo 11⁵ = 161,051 with a divide-by-11 step, needed
  only because 11 was left in the shell. See the parked-lane section: with 11
  parked the shadow anchor is coprime and the lift is plain K-Elimination.
  Anchor product 11⁶·13·17·19 = 7,438,784,639 is unchanged.
- **REJECTED — "gcd(11⁶, M₈) = 11, the non-coprimality is intentional."** It is
  self-inflicted. gcd(11⁶, 881,790) = 1 once lane 11 is parked.
- **State tuple** — DEFINED: the state is (B, r, K, Σ, T, Sh, L, F), not (r, K).
  Per-lane operator topology is first-class (A4); homogeneous operation is the
  special case. Carrying only (r, K) is the RNS reduction.
- **Transduction χ** — PROVEN on the reference cases: pure (Φ = id) preserves the
  integer across bases; active (Φ ≠ id) changes it by an exact integer map;
  Φ then Φ⁻¹ round-trips; the "project" winding policy discards K and is
  recorded as irreversible rather than silently lossy.
- **The gear path is retained, not withdrawn** — PROVEN as the general
  K-Elimination case, for anchors fixed by something other than adjacency.

### Transduction certification (P16 — correction of record)

**Two corrections.** (1) The first `transduce` computed `value(state)` and
re-reduced — a full reconstruction, materialising K·M, so its cost scaled with
the value rather than the basis. It has been rewritten residue-native. (2) The
prior write-up said the winding tower's handover point is what tells you to
transduce, which implied the tower certifies the bridge. It does not.

- **What certifies a transduction is an UNBROKEN SAFE BASIS** — PROVEN.
  Pairwise coprimality with no repeated modulus, on both sides, is exactly what
  makes the CRT idempotents exist, and the idempotents are the whole bridge.
  The tower certifies DEPTH inside one fixture and says nothing about the bridge
  between two. `certifyTransduction` returns `certified_by: "unbroken safe basis"`.
- **Boot gates B001–B004 are the unbroken check** — PROVEN: colony product
  9,699,690; SD-11 anchor 11⁶·13·17·19 = 7,438,784,639 (and ≠ the known
  transcription error 7,437,683,639, which differs by 1,101,000); no repeated
  lane; auxiliary lanes coprime to the basis.
- **The bridge is residue-native** — PROVEN: with e_i the idempotents of A and
  W = K_A − ⌊Σr_i e_i / M_A⌋, every target residue is
  `x mod b = (Σ r_i·(e_i mod b) + W·(M_A mod b)) mod b`. The largest integer
  formed is Σ r_i e_i < M_A·Σa_i — a basis constant. A 43-digit value transduces
  with a 4-digit intermediate.
- **Disjointness is NOT required** — PROVEN: a lane present in both bases is
  copied across untouched. Sharing is a feature and is exactly where the phase
  lock lives. (The circulated transduction sheet states gcd(M_A, M_B) = 1 as a
  domain constraint; that is stronger than necessary.)
- **REJECTED — the sheet's α formula and worked example.** `α_ij = (M_A/a_i)⁻¹
  mod b_j` does not reproduce `x mod b_j` (checked: gives 3,5,6 where the answer
  is 2,7,12). The sheet's example is separately inconsistent — residues (1,2,4,6)
  over {2,3,5,7} are 209, not the stated 46, and 46 mod (11,13,17) is (2,7,12),
  not the stated (8,3,11). The algorithm above is the corrected one.
- **The target winding has its own corridor** — PROVEN: `omega:"recompute"`
  recovers K_B by native adjacency K-Elim in the target frame, exact while
  K_B < M_B+1, and **refuses** outside it, naming the corridor and the remedy
  rather than returning a wrong K. `omega:"lift"` accepts an explicit boundary
  touch, flagged in the lineage.
- **Lane-wise Φ has a unit condition on the ANCHOR lane too** — PROVEN: any
  integer-coefficient Φ acts lane-wise, but Φ⁻¹ requires its divisor to be a
  unit in every lane the bridge touches, including M+1. Over {2,5,7,11},
  M+1 = 771 = 3·257 breaks a divide-by-3 even though no basis lane contains 3.
- **CORRECTED (P22) — the corridor was certified against the wrong magnitude.**
  Φ acting lane-wise pins the target RESIDUES, but the winding K_B = ⌊Φ(x)/M_B⌋
  is a magnitude fact and lane-wise action says nothing about it. The test used
  `M_A(K_A+1)/M_B`, a bound on **x**, to certify a corridor holding **Φ(x)**.
  Counter-computation: source {2,3,5,7}, target {3,5,7,11}, x = 1000,
  Φ(v) = 10000·v. The old bound reads 210·5/1155 = **0 < 1156**, so the lineage
  said `corridor_certified: true` — while the adjacency K-Elim had recovered
  K_B only mod 1156 and `value()` returned **653,740** instead of 10,000,000.
  A wrong value, marked certified. The true bound is 10000·1050/1155 = **9090**,
  which refuses.
  **The P22 remedy was itself wrong and is WITHDRAWN (P24).** P22 required the
  caller to declare `phiBound`, an analytic bound on Φ's growth. That inverts
  K-Elimination's own theorem: in `X = r + k·M`, k is not lost information
  awaiting an estimate — it is already implicit in the complete residue
  representation, and an anchor coprime to the shell gives an **independent
  exact view** of the same value. That is precisely what retires k-tracking.
  Φ(x)'s magnitude is no different, and is recovered the same way:

  ```
  K_B ≡ (s − γ_B)·M_B⁻¹  (mod A),     s = Φ(x) mod A
  ```

  and `Φ(x) mod A` is reachable for **any** A from the source tray alone, since
  the bridge gives `x mod A` exactly and `Φ(x) mod A = Φ(x mod A) mod A`.

  What the theorem does require is the **range hypothesis** — `hRange : X < M*A`
  in `kElimination_core`. So the caller declares **depth**, a property of the
  target fixture, and the anchor lifts to `(M_B+1)^depth`. Nothing about Φ need
  be known. — PROVEN: the P22 counterexample now derives `Φ(1000) = 10,000,000`
  exactly at the default depth 2, with no declaration of any kind.

  The derivation is **double**: one elimination at `depth` yields the winding, a
  second at `depth+1` certifies it. `K mod A^d = K mod A^(d+1)` means the leading
  digit is zero — the winding stopped growing rather than wrapping. A difference
  **proves** the corridor was too narrow and refuses; depth 1 on that example
  gives 566 against 8658, a leading digit of 7, which is exactly the wrap that
  produced 653,740. A zero leading digit is necessary for containment and is
  reported as `leading_digit_zero`, not asserted as a proof of it.

  `phiBound` survives as an **optional** strengthening: supplied, it proves
  containment outright and the lineage records `bound_supplied`. `phiMagnitude`
  is required only by `omega:"lift"` past the certified corridor, where the
  boundary touch genuinely forms a magnitude. Under `preserve`/`project` the
  winding is not recomputed at all and is flagged `winding_asserted` — the
  caller's claim, never presented as a result.

### Safe Basis tiers and S_R (P16 — correction of record)

- **REJECTED — "Ramanujan primes {2, 11, 17}".** An earlier pass read this as
  OEIS A104272. The architecture means the RAMANUJAN PARTITION CONGRUENCES, so
  **S_R = {5, 7, 11}** — PROVEN on exact partition numbers: p(5n+4) ≡ 0 (mod 5),
  p(7n+5) ≡ 0 (mod 7), p(11n+6) ≡ 0 (mod 11).
- **13 has no partition congruence at any offset** — PROVEN by checking all 13
  residue classes. This is why 13 is capacity, not structure.
- **Three-tier structure** — PROVEN disjoint and exhaustive over S6:
  T_fabric {2,3} (structural integrity) · T_measurement {5,7,11} = S_R
  (analyzability) · T_boundary {13} (capacity only). 13 must never be treated as
  equivalent to {5,7,11} in a structural argument.
- **Fibonacci entry** — PROVEN: 2 = F(3), 3 = F(4), 5 = F(5), 13 = F(7) enter
  directly; 7 and 11 enter ONLY through composite Fibonacci values,
  F(8) = 21 = 3·7 and F(10) = 55 = 5·11.

### Star lift · winding tower · fixture (`src/core/fixture.js`)

- **The star family is an adjacency family** — PROVEN: S_n = 6n(n−1) + 1, so
  S_n − 1 = 6n(n−1) and every star number is adjacent to its own shell. The
  whole family is self-inverse, K ≡ r − s, for free.
- **Every anchor this project already used lives in that family** — PROVEN:
  S₁ = 1 (the unit lane), S₂ = 13 (boundary witness), S₃ = 37 (the 36/37 star
  lift), S₄ = 73 (the Maya resolution modulus), S₅ = 121 = 11² (the shadow prime
  squared, at n = 5 — the shadow lane), S₆ = 181 (shell 180 = the N-refinement
  folding period). Derived, not designed in.
- **The winding tower gives arbitrary depth** — PROVEN: iterating the star lift
  T₀ = X, T_{d+1} = ⌊T_d / M⌋ terminates at zero for every finite X, with the
  adjacency identity holding at every level and the digits rebuilding X exactly.
  Depth 25 on 2¹²⁸−1 over 36/37, depth 39 on 2²⁰⁰−1.
- **Depth and precision are different resources** — PROVEN: a single adjacent
  anchor corridor-certifies a level only while that level's winding is below
  M+1. On 2¹²⁸−1 only 2 of 25 levels are certified; `towerReport.handover_depth`
  names the first level that is not, and the anchor level 0 would need outright.
  The tower supplies depth, transduction supplies width; neither substitutes.
- **The tower is not a radix** — PROVEN: every level recomputes standalone from
  its own (r, s) pair, so no accumulator threads across levels. Contrasted
  directly against `garnerDigits`, whose digit i depends on digits 0..i−1 —
  the positional emission A2 prohibits and the radix DynCRT was carrying.
- **The unit lane is a legitimate recommission** — PROVEN: gcd(1, n) = 1 for
  every n, so lane 1 is admissible in every fixture and can never collide with
  an extension; adjoining it leaves M unchanged (the identity transduction);
  Z/1 is terminal, so it is the canonical common quotient of any two fixtures.
- **What the unit lane does NOT do** — PROVEN: Z/1 has one element, so lane 1
  carries zero bits and cannot by itself relate two windings. It fixes the
  ORIGIN. The PHASE requires a shared informative lane.
- **Lane indexing** — DEFINED: the unit is indexed as lane 0, which keeps the
  shadow prime 11 on lane 5 in every fixture. Prepending it as an ordinary lane
  would have shifted 11 to lane 6.
- **Phase lock is a constraint on Φ, not a label** — PROVEN: a transduction is
  phase-locked to lane ℓ exactly when Φ(x) ≡ x (mod ℓ). x ↦ x + 11k holds the
  lock; x ↦ 2x + 1 breaks it. (Decided over one period, which is exhaustive for
  Φ with integer coefficients — stated, not assumed silently.)

### Lane-wise operator atlas (`src/core/operators.js`)

Assessed against the circulated paper *"The 14 174 742 Exact Operators of CRAM."*

- **Exact lane operator count** — PROVEN by exhaustive enumeration of function
  tables, matched against the closed form in every lane: an exact lane operator
  (bijection on Z/p fixing 0, multiplicative) is exactly `x ↦ c·x^e` with
  `gcd(e, p−1) = 1`, so the per-lane count is `(p−1)·φ(p−1)` = 1, 2, 8, 12, 40,
  48, 128, 108 and the global count is **5,096,079,360**. Pure monomials:
  `∏φ(p−1)` = 3,072. Pure multiplications: `∏(p−1)` = φ(M) = 1,658,880.
- **Group structure** — PROVEN: the lane operators close under composition (the
  holomorph of C_{p−1}), verified by composing every pair in every lane.
- **"14 primitive operations per lane"** — REJECTED. The count is φ(p−1) for
  monomials and (p−1)·φ(p−1) with twists; it is not uniform across lanes and
  equals 14 in none of them. Lane 2's multiplicative group is trivial, so it
  admits exactly one; lane 3 admits two.
- **"Raw space 14^8 = 1,475,789,056"** — the arithmetic is right, the object is
  not. REJECTED as a description of this operator space, which is larger
  (5,096,079,360) and not a power of a uniform per-lane count.
- **"14,174,742 verified operators"** — REJECTED. `14,174,742 = 2 · 3 ·
  2,362,457`; no product of lane counts over S8 carries a seven-digit prime
  factor. The paper's family table sums to its own total, which is internal
  consistency, not derivation.
- **"Native exact square roots"** — REJECTED. Square root is not a lane
  operator: only 181,440 of 9,699,690 residues are squares in every lane
  (undefined on 98.13% of the torus), and a generic square has 2⁷ = 128 roots
  mod M. A fixed per-lane branch returns the intended root for 181,440/9,699,690
  ≈ 1.87% of inputs — confirmed empirically as well as in closed form.
- **"Frobenius maps"** — REJECTED. On a prime field `x^p = x`, so Frobenius is
  the identity in every lane. It is non-trivial only over F_{p^n}, n > 1.
- **"Operator-level cryptography"** — REJECTED as a security claim. The claimed
  space is a 23-bit keyspace; even the true space is 32-bit. Neither is a
  cryptographic parameter.
- **What survives** — PROVEN: the atlas is real, derivable, and larger than
  claimed. The operators are exact, reversible, single-step (one modular
  exponentiation per lane) and need no iterative algorithm.

- **Synthetic ephemeris** (`src/demo`, `astro.jsx`) — SCAFFOLD / PRESENTATION.
  Decimal longitudes for UI only; never evidence.
- **Interpretive reading engine** — PRESENTATION / HYPOTHESIS.
- **Codex / Dresden correspondence** — OPEN.
- **180-fold operator periodicity** — coefficient periodicity PROVEN over the
  odd part of SafeS8 (4 is not a unit mod 2; the earlier `ord_2(4)=1` was wrong,
  the value 180 stands); full-operator folding is OPEN (see docs).
- **Renormalisation sub-period lcm(ord_p(4)) = 30 over {7,11,13}** — PROVEN, and
  a different statement from the 180 above, not a competing one.

Synthetic output must never be labelled verified, exact, or evidence-grade.
