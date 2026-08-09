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
| P11 | Astrology Remastered — variant coverage + closure certification | DONE |
| P12 | Safe-Basis correction — roles, Gaussian class, ρ, arrow; shadow/closure split | DONE — 221/221 |
| P13 | Operator-atlas assessment — enumeration replaces assertion | DONE — 247/247 |
| P14 | CRAM-not-RNS correction — adjacency anchor, coprimality, gradient, shadow lift, state tuple, χ | DONE — 279/279 |
| P15 | Star lift, winding tower, phase-locked fixture, recommissioned unit lane | DONE — 311/311 |
| P16 | Residue-native transduction; certification by unbroken safe basis; S_R and tier corrections | DONE — 325/325 |
| P17 | Anchor must be INTERNAL — reverses P14's canonical designation | DONE — 346/346 |
| P18 | Lane 11 parked — anchor lane carries no value; shadow lift loses its Hensel step | DONE — 358/358 |
| P19 | A3 withdrawn as a premise; O(1) yield; P17 overclaim amended | DONE — 367/367 |
| P20 | Yield uncoupled — `r + K·M` named as a radix boundary projection, not the yield | DONE — 368/368 |
| P21 | Core RE-BASED on the parked shell — 881,790 / lane 11 | DONE — 386/386 |

## Acceptance evidence

- `src/core` no-float audit: clean across all sixteen modules (see
  `test/no-float-core.test.js` token list).
- Full-sweep, every x in [0, 1,296,000), zero mismatches on BOTH splits:
  canonical parked `K ≡ (s − r)·7 (mod 11)` with K_max = 1, and legacy gear
  `K ≡ (s − r)·287 (mod 323)` with K_max = 43.
- Variant coverage: 78 assertions over 13 traditions, 36 divisions, 7 frames,
  13 house systems, 7 aspect families.
- Safe Basis / ρ / arrow: 62 assertions.
- Lanes: 40 static assertions + 5 exhaustive-sweep certificates
  (classifier agreement over the 323,323 period, census vs closed form,
  orthogonality, independence) + 4 frame-additivity certificates.
- P11 timings on the reference machine: lane sweep 0.5 s, frame sweep 1.9 s,
  K-Elim sweep 0.1 s.
- P12 correction: the earlier "shadow spine = {7,11,13,17,19}" is REJECTED and
  replaced. Shadow is the Gaussian/mod-4 class {3,7,11,19} anchored at 11;
  {7,11,13,17,19} is the off-ring closure axis. Both are carried, separately,
  and the 2×2 cross is verified fully occupied.
- P12 additions: `src/core/safe-basis.js` (roles, Gaussian class, families,
  saturation), `src/core/rho.js` (ω, q, δ, ρ, bands), `src/core/arrow.js`
  ((r,K), lap saturation, shadow entropy). 62 new assertions; no-float audit
  clean across all 12 core modules.
- P13: `src/core/operators.js` + 26 assertions. The circulated figure of
  14,174,742 operators is REJECTED (= 2·3·2,362,457); the derived count of
  exact lane operators over S8 is 5,096,079,360, enumerated as function tables
  and matched against ∏(p−1)φ(p−1) in every lane. Native sqrt and in-lane
  Frobenius are REJECTED on structural grounds with the counter-computations
  attached.
- P14: `src/core/cram.js` + 32 assertions. The basis was being used as an RNS —
  prime lanes, anchor from inside the basis, precomputed inverse. Canonical
  path is now the adjacent anchor A = M+1 (K ≡ r − s, one subtraction, no
  inverse, 92× corridor), certified alongside the gear path over the full ring.
  Adds coprimality-not-primality (verified on an all-composite basis), the
  resolution gradient (Maya Calendar Round exhaustive over 18,980), the 11⁶
  shadow lift (K mod 161,051), the eight-field state tuple with first-class
  per-lane topology, and the fifth operator χ with Φ/Θ/Π/Ω.
- P15: `src/core/fixture.js` + 32 assertions. Star numbers S_n = 6n(n−1)+1 are
  an adjacency family, and every anchor already in use is one of them (1, 13,
  37, 73, 121 = 11², 181). The 36/37 lift iterated to zero is the winding tower
  — arbitrary depth, terminating, level-independent, explicitly NOT a radix
  (contrasted against Garner's threaded accumulator). Depth and precision are
  separated: `towerReport` names the level at which a single anchor stops
  certifying and transduction must take over. The recommissioned unit lane is
  the frame-independent origin (0 bits, indexed lane 0 so 11 stays on lane 5);
  the phase lock rides on the shared shadow lane and constrains Φ to
  Φ(x) ≡ x (mod 11).
- P16: two corrections. (a) `transduce` was reconstructing — it called
  `value(state)` and re-reduced, materialising K·M. Rewritten residue-native via
  idempotents plus the effective winding W; the largest integer formed is now a
  basis constant (43-digit value → 4-digit intermediate). (b) Certification was
  attributed to the winding tower; it belongs to the UNBROKEN SAFE BASIS.
  `certifyTransduction` + boot gates B001–B004 are the certificate; the tower
  certifies depth inside one fixture only. Also REJECTED: the circulated
  transduction sheet's α formula (does not reproduce x mod b) and its worked
  example (internally inconsistent), and "Ramanujan primes {2,11,17}" — the
  architecture means the partition congruences, S_R = {5,7,11}, with 13 having
  no congruence at any offset. Adds the three-tier structure and Fibonacci
  entry paths.
- P17: `src/core/anchor.js` + 21 assertions, REVERSING P14's canonical call.
  The anchor must be an internal sub-product of the fixed basis, because the
  tray determines x mod A iff A | M — and M₈ mod 30,031 = 29,708, so the
  adjacent modulus is not a function of the tray at all (witness: x and x + M₈
  share all eight lanes, read 3,332 vs 3,009). Internal 323 is pinned by lanes
  {17,19} alone, disjoint from the shell, so i.i.d. survives; the external
  anchor couples all eight and is still undetermined. Adjacency is recovered by
  designing the basis for it — star-lift bases {4,3,13}, {4,9,37}, {8,9,73},
  {4,9,5,181} are adjacent AND internal, verified exhaustively. 16/16 core
  modules BigInt-clean.
- P18: a lane cannot be both anchor and shell. Lane 11 is PARKED — in the basis
  but out of the shell product — so it can anchor. Shell becomes
  2·3·5·7·13·17·19 = 881,790 = M₈/11; over the ecliptic ring K ≤ 1 and the bare
  lane-11 anchor suffices, so the K ≤ 43 corridor and the gear pair were
  artefacts of loading 11 into the shell. The shadow lift at 11⁶ becomes plain
  coprime K-Elimination — gcd(11⁶, 881,790) = 1 — retiring the divide-by-11
  Hensel step and withdrawing the "intentional non-coprimality" claim. Same
  corridor, 1,562,144,774,190.
- P19: A3 ("fixed immutable basis") was imported from an external framework doc
  and made load-bearing in P17. It was never adopted here — withdrawn as a
  premise, and the P17 argument restated on i.i.d. alone. Also corrects the
  overclaim that an external anchor "cannot be evaluated in residue space at
  all": it is reachable, because reconstruction is O(1). A2 retires Garner, not
  reconstruction. `reconstructAdjacent` / `reconstructGeneral` added with op
  counts — 4 and 5 ops, independent of lane count, against Garner's 48 over the
  same eight lanes.
- P20: the P19 yield was written as "K-Elim plus one multiply-add, X = r + K·M".
  That multiply-add is a radix composition — r the low digit, K the high, M the
  radix — so the positional emission A2 retires had been put back inside the
  function meant to avoid it. The yield now returns the identity PAIR and stops:
  2 ops adjacent, 3 general, neither coupling. `projectToInteger` and
  `towerRebuild` are relabelled BOUNDARY PROJECTIONS and carry a `couples: true`
  flag. Verified that the pair alone is injective over the span and that
  equality and ordering read straight off (K, r) — the composite is never
  needed.
- P21: the P4 register is re-based on the parked shell. `basis.js` gains PARK,
  SHELL_LANES, M_SHELL = 881,790 and M_SHELL_INV_MOD_PARK = 7; `shell-kelim.js`
  makes the parked split canonical and keeps the gear split as LEGACY;
  `hcrm-core.js` emits HCRM_REGISTER_V2 carrying the identity pair (r, K) plus
  the retained legacy block. The full sweep certifies both splits over the whole
  ring. Core unit suite 32 → 48 assertions, anchor suite 43 → 46.
- P22: two review findings, both confirmed by counter-computation and both
  cases of a certificate that was checking the wrong thing.
  (1) `transduce` certified the target winding corridor with a bound on the
  SOURCE magnitude while the tray held the TRANSFORMED one. Φ acting lane-wise
  fixes residues; it says nothing about ⌊Φ(x)/M_B⌋. With x = 1000, {2,3,5,7} →
  {3,5,7,11}, Φ(v) = 10000·v, the old bound read 0 < 1156 and the lineage said
  `corridor_certified: true` while `value()` returned 653,740 instead of
  10,000,000 — K_B had been recovered only mod 1156. A non-trivial `phiLane`
  now requires `phiBound` under `omega:"recompute"` and `phiMagnitude` under
  `omega:"lift"`, and is refused without them; `preserve`/`project` flag the
  winding `winding_asserted`. Φ = id defaults to the identity, unchanged.
  (2) `parkingReport` gated admissibility on coprimality alone, so an off-basis
  prime passed: `parkingReport(B8, [23])` said admissible although 23 ∤ M₈ and
  no mod-23 lane exists — the external anchor the module rejects elsewhere.
  Admissibility now also requires `parked_in_basis`. Lane widening to p^k is
  still admissible; importing a new prime is not.
  CRAM suite 39 → 47, anchor suite 46 → 51. Total 378 → 391.
- P23: the winding is DERIVED, not carried. The register reported K as a value it
  held; it is a function of the tray and is now recovered on demand by a
  K-Elimination lift on the phase-locked parked lane. `shell-kelim.js` gains
  `liftWinding` / `doubleLiftWinding` / `windingFromTray` / `trayRegister`:
  level e eliminates at 11^e and yields one base-11 digit of K, and the levels
  agree because s_e ≡ s_1 (mod 11) — lifting never moves the phase the fixture
  was affixed to. Depth is arbitrary and needs no Hensel step at any level,
  because parking the lane makes gcd(M_SHELL, 11) = 1 and M invertible mod 11^e
  for every e. Corridors: level 1 → 9,699,690 (the full Colony), level 2 →
  106,696,590, level 6 → 1,562,144,774,190 (the SD-11 anchor). `trayRegister`
  has no K field at all. Verified exact across the entire double-lift corridor
  and at level 6 out to 1.56 × 10¹².
  Also added `test/run.js`, a headless Node runner (`npm test`) executing the
  same modules as the browser gate, with the no-float audit done by reading
  source rather than fetching it. Core suite 48 → 56; 416 assertions total.
  Repository README replaced: the Claude Design handoff boilerplate is gone and
  the README now documents the architecture, leading with the five ways CRAM
  departs from RNS, since reading it as RNS makes the rest look wrong.
- P24: the P22 remedy is WITHDRAWN. P22 fixed a real defect — the corridor was
  certified against the source magnitude — but fixed it the wrong way, by
  requiring the caller to declare `phiBound`, an analytic bound on Φ's growth.
  That inverts K-Elimination's own theorem (Skyelabz210/k-elimination-lean4,
  §2.2 and §4.1): k is not lost information awaiting an estimate, it is already
  implicit in the complete residue representation, and an anchor coprime to the
  shell gives an independent exact view. Magnitude is derived, not declared.
  `transduce` now recovers K_B by K-Elimination against an anchor lifted to
  (M_B+1)^depth, using Φ(x) mod A — reachable for any A from the source tray,
  since the bridge gives x mod A exactly and Φ(x) mod A = Φ(x mod A) mod A. The
  caller declares DEPTH, a property of the fixture, which is the range
  hypothesis `hRange : X < M*A` the Lean theorem actually carries. The
  derivation is double: one elimination at `depth` yields the winding, a second
  at `depth+1` certifies it — equal values mean the leading digit is zero and
  the winding stopped growing rather than wrapping; a difference proves the
  corridor was too narrow and refuses. The P22 counterexample now derives
  Φ(1000) = 10,000,000 exactly at the default depth 2 with no declaration at
  all, and depth 1 refuses with the wrap made explicit (566 vs 8658, leading
  digit 7 — the wrap that produced 653,740). `phiBound` survives as an optional
  strengthening and was removed from every test to demonstrate it is not needed;
  `phiMagnitude` is required only by omega:'lift' past the certified corridor.
  An off-by-one was caught during implementation: a non-zero leading digit at
  depth d proves depth d−1 was too narrow, not depth d, so the certifying
  elimination must sit one level ABOVE the working one.
  CRAM suite 47 → 49. 418 assertions total.
- P25: the hidden carry was not accounted for. Every reduction emits a residue
  AND a quotient; the residue was kept and the quotient dropped. Three separate
  omissions, all now closed in `src/core/carry.js`:
  (1) THE CARRY IS SIGNED. Everything ran on least-nonnegative residues, where
  the winding is always ≥ 0 and the sign is gone. The centred residue
  r ∈ (−p/2, p/2] with w = (x − r)/p keeps it — w counts to the NEAREST shell,
  so it goes negative below one. It is the K-Elimination winding, not the p-adic
  valuation: w_7(49) = 7 where v_7(49) = 2.
  (2) THE ANCHOR READS THE CARRY NEGATED. Lemma 1: v_A = (r − K) mod A whenever
  M ≡ −1 (mod A). At a closed shell r = 0 this is (−K) mod A, so the anchor
  counts DOWN as the carry counts up. That descent is the readout separating the
  closed shells 0, M, 2M, … which are identical in the residue lane. Recomputed
  over [0,5000) at M=36/A=37, zero mismatches; the descent reads 36,35,34,33 at
  N = 36,72,108,144, and k_elim(36,37,73) = 1,1,2. The ecliptic ring holds
  exactly two closed shells of M_SHELL and only the parked lane separates them.
  (3) THE SHADOW WAS DISCARDED IN TRANSDUCTION. `transduce` computed
  `mod(phiLane(v,b), b)` and threw ⌊Φ(v)/b⌋ away. Under a uniform ensemble an
  additive lane's residues are exactly i.i.d., so the digit channel is
  featureless BY CONSTRUCTION and the shadow is where signal actually lives —
  squaring is 2-to-1, its image covers only (p+1)/2 of p values (7/13, 19/37,
  recomputed), and the discarded quotient inherits that structure. The lineage
  now carries `lane_carry` and `carry_energy`; values are unchanged, the
  quotient is simply no longer lost. Also added the carry functional C = Σ w²,
  zero exactly when no value wound past its shell.
  New suite: 22 assertions. 441 total; no-float audit 16 → 17 modules.
- P26: T-COMP-1 supersedes the P24 anchor-power lift. P24 grew the corridor by
  raising ONE anchor to a power, (M+1)^depth, and certified with a leading-digit
  heuristic I invented — necessary but never sufficient, as noted at the time.
  Wrong mechanism. The corridor is grown by EXTENDING THE ANCHOR SET:
      M = ∏ basis, anchors {A₁..A_t}, L = lcm(Aᵢ), d = gcd(M,L), R = L/d
      K ≡ ((v_L − r)/d)·(M/d)⁻¹ (mod R),   exact while K < R
  Two things this fixes. (M/d) is invertible mod R UNCONDITIONALLY — gcd(M/d,
  L/d) = 1 always, since per prime one exponent is exhausted by the min
  (verified over 90,000 (M,L) pairs) — so no coprimality precondition is needed
  between shell and anchor set, and the gradient case d > 1 is not an exception
  to route around but the general case. And R is COMPUTED, not guessed: K < R is
  a declared corridor of the same shape as the Lean `hRange`, replacing the digit
  heuristic. Reach is unbounded by adding anchors: each coprime anchor multiplies
  R at one pairwise combine — 1,156 → 15,028 → 285,532 on the worked example —
  linear cost for multiplicative corridor, against one enormous modulus before.
  Raising a single anchor to a power is the special case {A, A², …} with d = 1.
  New src/core/tower-recover.js with crtCombine over non-coprime moduli,
  anchorSetCorridor, towerRecover, extendAnchors, and the E-DIV-4 winding
  cross-check. `transduce` rewired onto it: `opts.anchors` replaces `opts.depth`.
  Verified exhaustively over the full period M·L per the composition document,
  including a case whose anchors are non-coprime to each other AND share d = 12
  with the shell.
  Two self-inflicted bugs caught while wiring: the falsification test as first
  written compared K mod R against K mod R — a tautology that never fired; and a
  test expected crtCombine([1,3],[4,6]) = 3 when it is 9.
  New suite: 14 assertions. 455 total; no-float audit 18 modules.
- P27: D-030, the identity of a number. An integer on the CRT ring is not a
  magnitude but a COMPOUND STATE ID_p(x) = (r, w) with r = x mod p and
  w = ⌊x/p⌋. ℤ_p is a cylinder: r is the ANGULAR coordinate, w the AXIAL one.
  Two integers with the same residue and different windings are distinct states
  at the same angle on different levels; the residue tuple is a projection that
  discards the axial coordinate.
  CORRECTS P23/P24. "Double K-Elimination" is SECOND ORDER, not two levels of
  one lane: κ₁ = K-Elim(x, M, A₁) is the winding, κ₂ = K-Elim(κ₁, A₁, A₂) is the
  winding OF the winding — the acceleration along the cylinder, and the third
  mixed-radix digit. P23 read it as 11 then 11², which is precision on the same
  κ₁. Verified exhaustively over the full two-digit corridor x < M·A₁·A₂.
  Both digits are read off x by independent eliminations, so `windingDigits`
  gives mixed-radix WITHOUT a Garner cascade — digit i never reads digit i−1.
  §6.1 settles the "leak" framing with a mechanism: Garner reconstruction
  DESTROYS the winding; staying residue-native and using K-Elimination PRESERVES
  it, and the windings are a deterministic source of noise that MASKS power and
  timing side channels. An attacker's trace measures the residue; the winding is
  invisible to them. Structure in the carry is the defence, not an escape. The
  word "leak" never entered the repo but the framing was mine and was inverted.
  §4 binds the substrate to the astrology layer, and the document is explicit
  that it is not metaphor: the natal chart is (r₀, 0); a carry event is a life
  event; a RETURN is r_p(t) = r_p(t₀) with w > 0 — same angle as birth, changed
  identity — and κ at the return measures the journey. Implemented as
  natalChart / carryEvent / isReturn / returns, with the ring's own parked lane
  carrying the same structure.
  §3 irreversibility: the winding is non-decreasing under integer-polynomial
  dynamics and acts as a Lyapunov function, so the natal state is algebraically
  unreachable once wound — the arrow of time is arithmetic.
  Also added Ω = "bound" (bounded but not retained), the fourth winding policy;
  only preserve and recompute are reversible.
  New suite: 16 assertions. 471 total; no-float audit 19 modules.
- P28: the two-tray architecture. Everything reduces to it, and it corrects the
  transduction certificate.
  (1) The FIRST tray — the CRT fixture — holds the Safe Basis, 100% SATURATED at
  30,030: the CRT map is a bijection with zero slack, ∏ lane sizes = span. Span
  is the LCM, not the product — that is what makes saturation a bijection claim
  rather than an arithmetic identity, and {4,6,10} shows the difference: 240
  states over a span of 60, 180 slack. (Caught as a bug: `saturationOf` first
  used the product for both sides and reported every bag as saturated.)
  (2) Saturation coupled with the 36/37 star lift instantiates the ARROW OF
  TIME: S₃ = 37 with shell 36 = S₄ − S₃, adjacent hence coprime, depth
  unbounded, winding monotone. Both halves are load-bearing — a broken tray does
  not instantiate it.
  (3) The first tray is left UNBROKEN. It is the only thing that has to be.
  (4) A second tray is PHASE LOCKED through the prime 11 lane (phase, 11 states)
  and the recommissioned unit lane 1 (origin, zero bits, shared by every fixture
  since gcd(1,n) = 1).
  (5) The second tray INHERITS primality, coprimality and the identity of a
  number through that lock.
  (6) So the second tray may hold ARBITRARY COMPOSITES with no heed of primality
  or coprimality.
  CORRECTS the certificate. `certifyTransduction` required BOTH bases to be
  unbroken safe bases and so refused valid configurations — {4,6,10} as a target
  was rejected outright. Only the SOURCE must be unbroken. A lane of the target
  is a READING, and x mod q is exact for every q whether or not q is prime or
  coprime to its neighbours; what coprimality buys is reconstruction FROM THE
  TRAY ALONE, and the target never needs it because the identity (r, w) lives in
  the first tray and rides along. Now TRANSDUCTION_CERTIFICATE_V2 with
  `target_inherits`; a broken SOURCE is still refused, and that asymmetry is the
  architecture. Verified: every lane of a deliberately non-coprime tray
  {1,11,4,6,10} reads exactly over 3,000 values, redundant lanes always agree on
  their overlaps, and dropping lane 11 refuses the inheritance — composites are
  unlocked BY the lock, not instead of it.
  New suite: 19 assertions. 493 total; no-float audit 20 modules.
