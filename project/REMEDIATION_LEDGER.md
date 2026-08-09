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
