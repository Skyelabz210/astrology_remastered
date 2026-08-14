# Inputs / Outputs Reference

A field reference for every publicly exported function, class, and constant
across this repo's computational surface: the 20 `project/src/core/` modules,
the ledger admission layer, the ephemeris producer CLI, and the house/
timescale solvers it depends on.

**This document exists to be called from, not read as prose.** If you are
about to `import` something from this codebase, find it here first.

## The two regimes — read this before anything else

This codebase has exactly two numeric regimes, and the boundary between them
is the whole point of the architecture (see `project/CLAIM_BOUNDARY.md` and
the `Conventions` section of `project/docs/EXECUTION_PLAN.md`):

- **Core regime — `project/src/core/*.js`.** Every value is a native
  **BigInt** (literals like `12n`, `1296000n`). Longitudes are **integer
  arcseconds** in `[0, 1,296,000)` (1,296,000 arcsec = 360°), never float
  degrees. No `Number()`, no `Math.*`, no `Date`, no decimal literals, no
  `parseFloat`/`parseInt` — enforced mechanically by the no-float audit
  (`npm test`, 20/20 modules). Every function below that lives in
  `project/src/core/` is explicitly marked **[core · BigInt]**.
- **Tooling/presentation regime — `project/tools/`, `.jsx` files.** Floats,
  `Math.*`, `Date`, and third-party astronomy libraries are legal here. Values
  are native JS **numbers**, and angles are **float degrees**
  (`[0, 360)` unless stated otherwise). A float value only becomes usable by
  the core after it is rounded to an integer arcsecond, wrapped in a
  schema-conformant ledger entry, and passed through `admitForCore()` — see
  [Ledger](#ledger). Every function below that lives in `project/tools/` is
  explicitly marked **[tools · float degrees]**.

There is no third regime and no silent conversion between them: a value
crosses from float to BigInt exactly once, at ledger admission, and never
crosses back inside `src/core/`.

## Table of contents

- [Core modules](#core-modules)
  - [basis.js](#basisjs) — fixed BigInt constants (the Safe Basis, shells, anchors)
  - [residues.js](#residuesjs) — `mod`, residue trays
  - [validators.js](#validatorsjs) — ledger-field parsing/validation
  - [gear-class.js](#gear-classjs) — legacy gear-pair event classification
  - [shell-kelim.js](#shell-kelimjs) — shell winding recovery (parked + legacy)
  - [hcrm-core.js](#hcrm-corejs) — `computeHcrmRegister`, the full per-entry register
  - [ring.js](#ringjs) — ecliptic-ring exact division arithmetic
  - [variants.js](#variantsjs) — astrological variant/frame/division/house registry
  - [safe-basis.js](#safe-basisjs) — Safe Basis architecture, roles, families
  - [rho.js](#rhojs) — the ρ(n) stability invariant
  - [shadow-spine.js](#shadow-spinejs) — shadow vs. closure axis, event classes
  - [arrow.js](#arrowjs) — the (r, K) identity, saturation, shadow entropy
  - [operators.js](#operatorsjs) — exact lane-wise operator atlas
  - [cram.js](#cramjs) — K-Elimination, CRAM state, transduction
  - [anchor.js](#anchorjs) — anchor admissibility, internal/parked anchors
  - [fixture.js](#fixturejs) — star lift, winding tower, CRT fixtures
  - [carry.js](#carryjs) — the hidden carry, signed winding, carry functional
  - [tower-recover.js](#tower-recoverjs) — T-COMP-1 anchor-set winding recovery
  - [identity.js](#identityjs) — the cylinder identity, double K-Elimination, natal chart
  - [tray.js](#trayjs) — two-tray architecture, phase lock, arrow of time
- [Ledger](#ledger)
  - [import-ledger.js](#import-ledgerjs)
  - [ephemeris-ledger-schema.json](#ephemeris-ledger-schemajson)
- [Ephemeris tools](#ephemeris-tools)
  - [produce-ledger.mjs](#produce-ledgermjs) — CLI + programmatic entry points
  - [houses.js](#housesjs) — house-cusp float solvers
  - [timescale.js](#timescalejs) — ΔT, GMST/GAST, obliquity

All object-valued returns below list only the fields load-bearing enough to
matter for a caller; most `*Report`/`*_V1` objects also carry a `kind` tag
and stringified copies of their inputs for JSON-safety (BigInt does not
serialize with `JSON.stringify`) — see each module's source for the exhaustive
field list.

---

## Core modules

All modules in this section are **[core · BigInt]**: every parameter and
return value below is a `bigint` (or an array/object of them) unless noted.
Object fields ending in a numeric role (e.g. `r`, `K`, `M_shell`) are BigInt
in the live object and are stringified only in `*_V1`/`*Report` output
objects, which is called out per-function where it applies.

### basis.js

Fixed constants only — no functions. The canonical basis and its two splits.

| Export | Value | Meaning |
|---|---|---|
| `B6` | `[2,3,5,7,11,13]n` | classical six-lane basis (legacy shell lanes) |
| `GEAR` | `[17,19]n` | legacy gear-pair extender lanes |
| `B8` | `[2,3,5,7,11,13,17,19]n` | the full eight-lane Safe Basis ("the Colony") |
| `M6` | `30030n` | ∏B6 — legacy shell modulus |
| `GEAR_PRODUCT` | `323n` | 17·19 — legacy external anchor |
| `M8` | `9699690n` | ∏B8 — the Colony |
| `ARCSEC_CIRCLE` | `1296000n` | the ecliptic ring; every core longitude ∈ `[0, ARCSEC_CIRCLE)` |
| `M6_MOD_GEAR` / `M6_INV_MOD_GEAR` | `314n` / `287n` | precomputed legacy K-Elimination constants |
| `PARK` | `11n` | the parked lane: in the basis, excluded from the canonical shell |
| `SHELL_LANES` | `[2,3,5,7,13,17,19]n` | shell lanes once lane 11 is parked |
| `M_SHELL` | `881790n` | ∏SHELL_LANES = M8/11 |
| `M_SHELL_MOD_PARK` / `M_SHELL_INV_MOD_PARK` | `8n` / `7n` | precomputed parked-split K-Elimination constants |
| `K_MAX_PARKED` | `1n` | max winding over the ecliptic ring, parked shell |
| `K_MAX_LEGACY` | `43n` | max winding over the ecliptic ring, legacy (M6) shell |

### residues.js

| Function | Params | Returns | Notes |
|---|---|---|---|
| `mod(x, m)` | `x: bigint`, `m: bigint` (nonzero) | `bigint` in `[0, m)` | least-nonnegative remainder; unlike native `%`, never negative |
| `residues(x, basis)` | `x: bigint`, `basis: bigint[]` | `bigint[]` | per-lane residues, basis order |
| `residueObject(x, basis)` | `x: bigint`, `basis: bigint[]` | `Object<string,string>` | `{mod_<p>: "<x mod p>", ...}`, JSON-safe |

### validators.js

The sole entry point by which a longitude/integer field crosses from
string/BigInt ledger input into the BigInt regime the rest of `src/core/`
assumes.

| Function | Params | Returns | Throws |
|---|---|---|---|
| `parseArcsecString(value)` | `value: string\|bigint` — decimal-integer string or BigInt | `bigint` in `[0, ARCSEC_CIRCLE)` | non-bigint/non-digit-string; negative or ≥ 1,296,000 |
| `assertIntegerString(value, fieldName)` | `value: string\|bigint`, `fieldName: string` (error-message label only) | `bigint`, unbounded, may be negative | non-bigint/invalid decimal-integer string |

`ARCSEC_CIRCLE` (`1296000n`) is also re-exported here.

### gear-class.js

| Function | Params | Returns |
|---|---|---|
| `gearClass(x)` | `x: bigint` | `"G-zero"\|"G-pre"\|"G-low"\|null` — classifies x by residues on legacy lanes 17/19 |

### shell-kelim.js

Shell winding recovery, both the **canonical parked split** (shell
`{2,3,5,7,13,17,19}`=881,790, anchor lane 11) and the **legacy gear split**
(shell M6=30,030, anchor 323).

| Function | Params | Returns | Notes |
|---|---|---|---|
| `SHELL_ANCHOR` | — | `11n` | the canonical internal anchor |
| `parkedShellResidue(x)` | `x: bigint` | `bigint` | r = x mod M_SHELL |
| `parkResidue(x)` | `x: bigint` | `bigint` | s = x mod 11 |
| `recoverShellWinding(r, s)` | `r, s: bigint` | `bigint` | K mod 11, plain coprime K-Elimination |
| `recoverShellWindingFrom(x)` | `x: bigint` | `bigint` | same, driven from the integer |
| `shellIdentity(x)` | `x: bigint` | `{r, K, shell, anchor}` | the uncoupled identity pair |
| `actualShellWinding(x)` | `x: bigint` | `bigint` | ⌊x/M_SHELL⌋, for verification |
| `parkPower(levels)` | `levels: bigint` | `bigint` | 11^levels |
| `liftWinding(r, s, levels=2n)` | `r, s: bigint`, `levels: bigint` | `{K, digits, phases, levels, depth, shell, anchor, corridor}` | e-fold K-Elimination lift on lane 11; throws if `levels < 1n` |
| `doubleLiftWinding(r, s)` | `r, s: bigint` | same shape as `liftWinding` | `liftWinding(r, s, 2n)` — K < 121 |
| `windingFromTray(x, levels=2n)` | `x: bigint`, `levels: bigint` | same as `liftWinding` | derives r/s from x directly |
| `trayRegister(x, levels=2n)` | `x: bigint`, `levels: bigint` | `{kind, shell_lanes, r, parked_lane, parked_depth, s, derive(), carries_winding: false}` | `derive()` is a getter-shaped closure, not a stored K |
| `verifyShellWinding(x)` | `x: bigint` | `{split, shell, anchor, recovered, actual, ok}` | self-check: recovered K vs. actual K |
| `LEGACY_SHELL` / `LEGACY_ANCHOR` | — | `M6` / `GEAR_PRODUCT` | legacy constants, re-exported |
| `shellResidue(x)` / `gearResidue(x)` | `x: bigint` | `bigint` | x mod M6 / x mod 323 |
| `recoverShellWindingFromGear(x)` | `x: bigint` | `bigint` | K mod 323, legacy gear split |
| `actualLegacyWinding(x)` | `x: bigint` | `bigint` | ⌊x/M6⌋ |
| `verifyLegacyShellWinding(x)` | `x: bigint` | `{split, shell, anchor, recovered, actual, ok}` | legacy self-check |

### hcrm-core.js

| Function | Params | Returns | Throws |
|---|---|---|---|
| `computeHcrmRegister(entry)` | `entry: {longitude_arcsec: string\|bigint, body?, source?, certificate?}` — a ledger entry (see [Ledger](#ledger)) | `HCRM_REGISTER_V2` object: basis constants, residue trays (B8/shell/B6/gear), canonical parked-shell `{r, K, lift, anchor, K_certificate}`, legacy gear-shell `{r_M6, K, K_certificate}`, `gear_class`, plus `source`/`certificate` passed through | invalid `longitude_arcsec` (via `parseArcsecString`); internal winding-recovery self-check disagreement (implementation-fault signal) |

This is the single highest-level entry point in `src/core/`: given one
ledger entry it returns the complete HCRM register for that longitude.

### ring.js

Exact arithmetic of the ecliptic arcsecond ring `RING = 1,296,000 = 2⁷·3⁴·5³`.

| Function | Params | Returns | Notes |
|---|---|---|---|
| `RING` | — | `1296000n` | same value as `ARCSEC_CIRCLE` |
| `RING_PRIMES` / `RING_EXPONENTS` | — | `[2,3,5]n` / `[7,4,3]n` | ring's prime factorisation |
| `RING_RADICAL` | — | `30n` | squarefree kernel |
| `OFF_RING_PRIMES` | — | `[7,11,13,17,19]n` | Safe-Basis primes NOT dividing the ring (closure axis, not shadow — see shadow-spine.js) |
| `ipow(base, exp)` | `base, exp: bigint` (exp ≥ 0) | `bigint` | exact integer power |
| `ringFromFactors()` | — | `bigint` | recomputes RING from its factorisation (self-check) |
| `factorise(n)` | `n: bigint` (≥ 1) | `[bigint, bigint][]` — `[[p,e],...]`, p ascending | throws if n < 1 |
| `isRingSmooth(n)` | `n: bigint` | `boolean` | true iff every prime factor ∈ {2,3,5} |
| `closes(n)` | `n: bigint` | `boolean` | true iff n divides RING exactly |
| `stepArcsec(n)` | `n: bigint` | `?bigint` | RING/n if it closes, else `null` |
| `defect(n)` | `n: bigint` | `bigint` | RING mod n (0 iff closes) |
| `offRingPrimes(n)` | `n: bigint` | `bigint[]` | n's prime factors the ring cannot absorb |
| `divisionReport(n)` | `n: bigint` | `{n, closes, step_arcsec, defect_arcsec, ring_smooth, off_ring_primes, exponent_overflow, factorisation}` (strings) | full exact report on one zodiac division |
| `laneDefects(primes)` | `primes: bigint[]` | `Object<string,string>` | RING mod p per lane |
| `residueClassCount(m, target)` | `m, target: bigint` | `bigint` | closed-form count of x ∈ [0,RING) with x≡target (mod m) |

### variants.js

The astrological variant/frame/division/house-system/aspect-family registry
— every tradition entered as checkable integer arithmetic on the arcsecond
ring.

| Export | Kind | Notes |
|---|---|---|
| `ARCSEC_PER_DEGREE` (`3600n`), `ARCSEC_PER_SIGN` (`108000n`) | constants | |
| `FRAMES` | array | ayanamsa/frame registry; each `{id, label, offset_arcsec, status}` |
| `frame(id)` | fn(`id: string`) → `Object`, throws `"unknown frame: ${id}"` | |
| `toFrame(x, offset)` | fn(`x, offset: bigint`) → `bigint` in `[0,RING)` | rotate tropical → frame |
| `fromFrame(x, offset)` | fn(`x, offset: bigint`) → `bigint` | inverse of `toFrame` |
| `separation(a, b)` | fn(`a, b: bigint`) → `bigint` in `[0, RING/2]` | shorter-arc separation, frame-independent |
| `DIVISIONS` | array | every named zodiac cut, `{id, n, label, traditions}` |
| `division(id)` | fn(`id: string`) → `Object`, throws `"unknown division: ${id}"` | |
| `divisionIndex(x, n)` | fn(`x, n: bigint`) → `?bigint` | which cut of an n-fold division x falls in; `null` if n does not close |
| `signIndex(x, offset)` | fn(`x, offset: bigint`) → `bigint` (0–11) | |
| `ASPECT_FAMILIES` | array | `{id, short, label, divisors, status}` |
| `familyAngles(fam)` | fn(`fam: Object`) → array of `{divisor, angle_arcsec, closes, defect_arcsec, off_ring_primes}` | |
| `HOUSE_SYSTEMS` | array | `{id, label, exact, status}`; 5 exact/PROVEN systems + 8 `status:"LEDGER"` systems (quadrant systems, computed only in `houses.js` and admitted via the ledger) |
| `wholeSignHouse(x, asc, offset)` | fn(`bigint,bigint,bigint`) → `bigint` (1–12) | exact |
| `equalHouse(x, origin)` | fn(`bigint,bigint`) → `bigint` (1–12) | exact |
| `vehlowHouse(x, asc)` | fn(`bigint,bigint`) → `bigint` (1–12) | exact, ASC at house-1 midpoint |
| `porphyryCusps(asc, mc)` | fn(`bigint,bigint`) → `bigint[12]` cusps, throws `DegenerateAnglesError` | exact integer trisection with remainder distribution — every cusp stays on the arcsecond lattice; throws instead of silently corrupting the partition if MC does not lead ASC by more than half the ring (the ordinary case for every non-polar chart — see the function's own comment) |
| `DegenerateAnglesError` | class extends `Error` | thrown by `porphyryCusps` for the degenerate (asc, mc) case above; carries `.asc`/`.mc` |
| `FIRDARIA_YEARS` / `VIMSHOTTARI_YEARS` | arrays | `{lord, years}` time-lord tables |
| `totalYears(table)` | fn(array) → `bigint` | |
| `VARIANTS` | array | one entry per tradition: `{id, name, tradition, frame, houses, aspects, divisions, note}` |
| `variant(id)` | fn(`id: string`) → `Object`, throws `"unknown variant: ${id}"` | |
| `variantReport(id)` | fn(`id: string`) → coverage report (frame/divisions/houses/aspects) | throws propagated from `variant(id)` |
| `allVariantReports()` | fn() → `Object[]` | `variantReport` for every `VARIANTS` entry |

**House-system status vocabulary** (also documented at the top of the file):
`CLASSICAL`/`DEFINED`/`PROVEN` are computed directly by this core.
`LEDGER` means the value requires a float solver (`project/tools/ephemeris/houses.js`)
and can only reach the core through `admitForCore()` — this core never
computes house-circle trigonometry itself. `OPEN` means no certified path
exists yet.

### safe-basis.js

The Safe Basis as architecture: Gaussian classes, prime families, tiers, and
boot-gate certification — not just a flat prime list.

| Function/Const | Params | Returns | Notes |
|---|---|---|---|
| `COLONY` / `SHELL` | — | `M8` / `M6` | aliases |
| `isqrt(n)` | `n: bigint` (≥0) | `bigint` | ⌊√n⌋; throws on negative n |
| `isPrime(n)` | `n: bigint` | `boolean` | trial division |
| `gaussianClass(p)` | `p: bigint` (prime) | `"ramified"\|"split"\|"inert"` | Z[i] class |
| `isShadowPrime(p)` | `p: bigint` | `boolean` | p ≡ 3 (mod 4), p > 2 |
| `sumOfTwoSquares(p)` | `p: bigint` (prime) | `?[bigint,bigint]` | witness a²+b²=p; `null` for inert primes |
| `FAMILY_GAPS` | — | array | twin(2)/cousin(4)/sexy(6) gap definitions |
| `familyPartners(p, set)` | `p: bigint`, `set: bigint[]` | `{family,partner}[]` | |
| `isSophieGermain(p)` / `isSafePrime(p)` | `p: bigint` | `boolean` | 2p+1 prime / p=2q+1, q prime |
| `RAMANUJAN_CONGRUENCE` / `S_R` | — | array / `[5,7,11]n` | partition-congruence primes |
| `hasRamanujanCongruence(p)` | `p: bigint` | `boolean` | p ∈ S_R |
| `partitionNumbers(N)` | `N: bigint` | `Map<bigint,bigint>` | p(0)..p(N) via pentagonal number theorem |
| `T_FABRIC`/`T_MEASUREMENT`/`T_BOUNDARY` | — | arrays | the three-tier structure `{2,3}` / `{5,7,11}` / `{13}` |
| `tierOf(p)` | `p: bigint` | `"fabric"\|"measurement"\|"boundary"\|"extender"` | |
| `providesStructure(p)` | `p: bigint` | `boolean` | tier ≠ boundary/extender |
| `fibonacci(upTo)` | `upTo: bigint` | `Map<bigint,bigint>` | F(0)..F(upTo) |
| `FIBONACCI_ENTRY` | — | array | which basis primes enter via composite Fibonacci values |
| `SD11_ANCHOR` / `SD11_REJECT` | — | `bigint` | shadow-lattice anchor 11⁶·13·17·19, and its known-wrong transcription |
| `bootGates(basis=B8, auxiliary=[])` | `basis: bigint[]`, `auxiliary: bigint[]` | `SAFE_BASIS_BOOT_GATES_V1` — B001–B004 pass/fail + `unbroken` | the "unbroken safe basis" certification |
| `ROLES` | — | array | `{prime, role, tier, note}` per basis prime |
| `role(p)` | `p: bigint` | `Object`, throws if p not in basis | |
| `SHADOW_SPINE` / `SPLIT_PRIMES` / `SHADOW_ANCHOR` (`11n`) / `SHADOW_ESCALATION` (`19n`) | — | arrays/consts | |
| `basisGaps()` | — | `bigint[]` | consecutive gaps across B8 |
| `primeProfile(p)` | `p: bigint` | full attribute record (strings) | throws if p not in basis |
| `basisProfile()` | — | `SAFE_BASIS_PROFILE_V1` | whole-basis summary |
| `saturationReport(range=ARCSEC_CIRCLE)` | `range: bigint` | `SAFE_BASIS_SATURATION_V1` — saturation flags, winding bound, extender sufficiency | |

### rho.js

The ρ(n) = ω(n) + δ(n) stability invariant.

| Function | Params | Returns |
|---|---|---|
| `omega(n)` | `n: bigint` | `bigint` — count of distinct prime factors |
| `largestShadowFactor(n)` | `n: bigint` | `bigint` — largest inert (shadow) prime factor, 0 if none |
| `delta(n)` | `n: bigint` | `bigint` — 0/1/2 shadow step |
| `rho(n)` | `n: bigint` | `bigint` — ω+δ |
| `BANDS` | — | array — stable(≤4)/mild(5-6)/strong(7-8)/chaotic(≥9) |
| `band(r)` | `r: bigint` | matching `BANDS` entry; throws if unreachable (structurally impossible) |
| `rhoReport(n)` | `n: bigint` | full ρ report: factorisation, omega, shadow_factors, q, delta, rho, band |

### shadow-spine.js

Separates the **shadow** axis (Gaussian mod-4 inertness) from the
**closure** axis (does p divide the ring) — two independent classifications
of Safe Basis primes that a previous version of this codebase conflated.

| Export | Notes |
|---|---|
| `SPINE` | shadow-spine primes with role/anchor/escalation/ring-closure flags |
| `OFF_RING_LANES` | the 5 closure-axis lanes, each tagged with whether it is also shadow |
| `crossClassify()` → `{shadow_closing, shadow_off_ring, nonshadow_closing, nonshadow_off_ring}` | the 2×2 cross-classification, all 4 cells occupied |
| `EVENT_CLASSES` / `CLASS_IDS` | the event-class vocabulary (13 classes: R, SH-*, H7-*, G19-body, B13-*, G-*) |
| `eventClass(id)` | throws `"unknown event class: ${id}"` if not found |
| `axisOf(id)` | → `"shadow"\|"boundary"\|"saturation"\|"none"` |
| `bodyClassVocabulary()` / `edgeClassVocabulary()` | → `string[]` |
| `laneResidues(x)` / `shadowResidues(x)` | `x: bigint` → `Object<string,string>` residue trays on off-ring / shadow-spine lanes |
| `bodyEvents(x, label?)` | `x: bigint`, `label?: string` → event records; order is significant (mirrored by tests) |
| `edgeEvents(x, y, label?)` | `x, y: bigint`, `label?: string` → event records (aspect-edge residue preservation) |
| `divisionClosure(n)` | `n: bigint` → closure-axis-only report |
| `divisionShadow(n)` | `n: bigint` → shadow-axis-only report (ω, q, δ, ρ, band) |
| `divisionProfile(n)` | `n: bigint` → `{divisor, closure, shadow}`, kept as separate objects |
| `censusClosedForm()` | → closed-form event counts over the full ring, for cross-checking an exhaustive sweep |
| `classicalAttribution(x, offset)` | `x, offset: bigint` → `{sign, decan, dwad, degree_in_sign, arcsec_in_degree}` — deliberately independent of the spine machinery |

Also re-exports `SHADOW_SPINE`, `SHADOW_ANCHOR`, `SHADOW_ESCALATION`,
`isShadowPrime`, `gaussianClass`, `sumOfTwoSquares` (from safe-basis.js) and
`OFF_RING_PRIMES` (from ring.js), so one import covers the whole shadow
story.

### arrow.js

The (r, K) identity, saturation (faithful-clock) measurement, and shadow
entropy (fibre multiplicity).

| Function | Params | Returns |
|---|---|---|
| `identity(x, m=M6)` | `x, m: bigint` | `{r, K}` — phase and winding |
| `reconstruct(r, k, m=M6)` | `r, k, m: bigint` | `bigint` — r + k·m |
| `tuple(x, basis=B6)` | `x: bigint`, `basis: bigint[]` | `bigint[]` — residue tuple |
| `stepForward(state, m=M6)` / `stepBackward(state, m=M6)` | `{r,K}`, `m: bigint` | `{r, K}` — successor/predecessor |
| `arrowCompare(a, b)` | `{r,K}` × 2 | `-1\|0\|1` — orders by (K, r) |
| `tupleCompare(x, y, basis=B6)` | `x,y: bigint`, `basis: bigint[]` | `-1\|0\|1` — coordinatewise, does NOT order the lap |
| `pairwiseCoprime(basis)` | `basis: bigint[]` | `boolean` |
| `saturation(basis, range=null)` | `basis: bigint[]`, `range: ?bigint` | `SATURATION_V1` — product/lcm/distinct_readings/collisions/faithful |
| `fibreProfile(domain, keyOf)` | `domain: Iterable`, `keyOf: fn` | `{fibres, fibre_max, bijection, h_shadow_zero}` |
| `shadowEntropyBits(fibreSize)` | `fibreSize: bigint\|number` | `?string` — exponent if fibreSize is a power of 2, else `null` (no logarithm ever taken) |
| `carriedDomain(laps, m=M6)` | `laps, m: bigint` | `{r,K}[]` — all (r,K) pairs, K-major |
| `keyPhaseOnly(s)` / `keyIdentity(s)` | `s: {r,K}` | `string` — the "breaks it" vs. "clean" key functions for `fibreProfile` |

### operators.js

Exhaustively-enumerated exact lane-wise operators `x ↦ c·x^e mod p`.

| Function | Params | Returns |
|---|---|---|
| `gcd(a,b)` / `totient(n)` / `powMod(base,exp,m)` | `bigint`s | `bigint` — standard number-theory helpers |
| `bijectiveExponents(p)` | `p: bigint` | `bigint[]` — exponents coprime to p−1 |
| `laneTable(p, c, e)` | `p,c,e: bigint` | `bigint[]` (length p) — the function table |
| `isExactLaneOperator(table, p)` | `table: bigint[]`, `p: bigint` | `boolean` — bijection fixing 0? |
| `laneOperators(p)` | `p: bigint` | `{c,e,table}[]` — every distinct exact operator, deduplicated |
| `laneMonomials(p)` | `p: bigint` | `{e,table}[]` — pure monomials (c=1) only |
| `atlas(basis=B8)` | `basis: bigint[]` | `CRAM_OPERATOR_ATLAS_V1` — per-lane and basis-wide operator counts |
| `at(table, v)` | `table: bigint[]`, `v: bigint` | `bigint`; throws `"index outside the lane"` |
| `laneClosesUnderComposition(p)` | `p: bigint` | `boolean` — group-closure check |
| `sqrtDiagnostics(basis=B8)` | `basis: bigint[]` | `CRAM_SQRT_DIAGNOSTICS_V1` — exact ratios: squares-per-lane, defined-everywhere, root-multiplicity |
| `frobeniusIsIdentity(p)` | `p: bigint` | `boolean` — always true on a prime field |
| `keyspaceBitsFloor(count)` | `count: bigint` | `bigint` — ⌊log2(count)⌋, integer only |

### cram.js

The CRAM layer proper: K-Elimination (adjacent, general, resolution
gradient, shadow-lift), the CRAM state tuple, and residue-native
transduction between fixtures.

| Function | Params | Returns / Throws |
|---|---|---|
| `gcd(a,b)` / `egcd(a,b)` / `inverse(a,m)` | `bigint`s | standard; `inverse` returns `?bigint` (null if not a unit) |
| `isSafeBasis(basis)` | `basis: bigint[]` | `boolean` — pairwise coprime, no requirement of primality |
| `shellModulus(basis)` | `basis: bigint[]` | `bigint` — ∏basis |
| `canonicalAnchor(M)` | `M: bigint` | `bigint` — M+1 |
| `adjacencyRecover(r,s,M)` | `r,s,M: bigint` | `bigint` — K = (r−s) mod (M+1); one subtraction |
| `adjacencyRecoverFrom(x,M)` | `x,M: bigint` | `bigint` — same, from the integer |
| `generalRecover(r,s,M,A)` | `r,s,M,A: bigint` | `?bigint` — K mod A; `null` if gcd(M,A)≠1 |
| `gradientRecover(r,v,M,A)` | `r,v,M,A: bigint` | `?bigint` — K mod (A/gcd(M,A)) when gcd(M,A)>1; `null` if inconsistent |
| `resolution(M,A)` | `M,A: bigint` | `{d, resolution, exact_when_K_below}` (strings) |
| `shadowLift(gamma,s,M,q,e)` | `bigint`s | `?{K, modulus, corridor}` — Hensel-form recovery for a non-coprime shadow prime left in the shell; `null` if inconsistent |
| `yieldAdjacent(r,s,M)` / `yieldGeneral(r,s,M,A)` | `bigint`s | `{r,K,shell,anchor}` / `?{...}` — the uncoupled identity-pair "yield" |
| `identityEquals(a,b)` / `identityCompare(a,b)` | `{r,K}` × 2 | `boolean` / `-1\|0\|1` |
| `projectToInteger(id)` | `{r,K,shell}` | `bigint` — the BOUNDARY PROJECTION r+K·shell (not the yield; a radix step) |
| `yieldCost(mode, lanes=8n)` | `mode: "adjacent"\|"general"\|"projection"\|"garner"`, `lanes: bigint` | op-count breakdown; throws on unknown mode |
| `recoveryCost(mode)` | `mode: "adjacency"\|"general"` | op-count breakdown; throws on unknown mode |
| `STATE_FIELDS` | — | `["basis","r","K","sigma","topology","shadow","lineage","support"]` |
| `encode(x, basis, opts={})` | `x: bigint`, `basis: bigint[]`, `opts: {sigma?,topology?,shadow?,lineage?,support?}` | `CRAM_STATE_V1` |
| `gamma(state)` | `{basis,r}` | `bigint` — CRT representative (boundary touch, not hot path) |
| `value(state)` | `{basis,r,K}` | `bigint` — gamma(state) + K·shellModulus(basis) |
| `wellFormed(state)` | `Object` | `boolean` — structural CRAM_STATE_V1 check |
| `idempotents(basis)` | `basis: bigint[]` | `bigint[]`; throws `"broken basis: idempotent does not exist"` |
| `certifyTransduction(A, B)` | `A,B: bigint[]` (source, target bases) | `TRANSDUCTION_CERTIFICATE_V2` — `admissible` iff source is unbroken (target may be arbitrary) |
| `transduce(state, targetBasis, opts={})` | `state: CRAM_STATE_V1`, `targetBasis: bigint[]`, `opts: {theta?, pi?, omega?, phiLane?, phiBound?, phiMagnitude?, depth?, anchors?}` | new `CRAM_STATE_V1` over targetBasis; throws on a broken source basis, a corridor-wrapped winding under `omega:"recompute"`, a missing `phiMagnitude` under `omega:"lift"` past the corridor with a non-trivial Φ, or an unknown `omega` |
| `gammaOf(r, basis)` | `r: bigint[]`, `basis: bigint[]` | `bigint` — CRT representative of an explicit tray |
| `WINDING_POLICIES` | — | `["preserve","recompute","project","bound"]` |
| `isReversiblePolicy(omega)` | `omega: string` | `boolean` — true for recompute/preserve/lift |
| `SHELL_6` / `SHELL_8` | — | `{basis, M, anchor}` convenience descriptors |

**Winding policies (`omega`) for `transduce`:** `"recompute"` derives the
target winding by K-Elimination against an anchor set (refuses on wrap);
`"lift"` is the same but reconstructs past a non-certified corridor instead
of refusing; `"preserve"` copies the source winding as-is (an assertion, not
a derivation, when Φ moves magnitude); `"project"` sets K=0; `"bound"`
records a corridor without ever committing to a winding value.

### anchor.js

Anchor admissibility: only an INTERNAL anchor (a sub-product of the fixed
basis) preserves i.i.d. lane independence.

| Function | Params | Returns |
|---|---|---|
| `trayDeterminesAnchor(basis, A)` | `basis: bigint[]`, `A: bigint` | `boolean` — A \| shellModulus(basis)? |
| `undeterminedWitness(basis, A, x=123456n)` | `bigint[]`, `bigint`, `bigint` | `?Object` witness pair (x, x+M) with differing anchor residues; `null` for internal anchors |
| `anchorLanes(basis, A)` | `basis: bigint[]`, `A: bigint` | `?bigint[]` — sub-basis multiplying to A, or `null` |
| `isInternalAnchor(basis, A)` | `bigint[]`, `bigint` | `boolean` |
| `laneDependency(basis, A)` | `bigint[]`, `bigint` | `bigint[]` — lanes whose value affects x mod A |
| `anchorReport(basis, shellLanes, anchorLanes_)` | `bigint[]` × 3 | `ANCHOR_ADMISSIBILITY_V1` — internal/disjoint/coprime/adjacent flags + `iid_preserved`/`admissible` verdicts |
| `primePowerLanes(n)` | `n: bigint` | `bigint[]` — coarsest pairwise-coprime factorisation |
| `starLiftBasis(n)` | `n: bigint` | `?{n, basis, shell_lanes, anchor_lanes, shell, anchor, report}` — internal-AND-adjacent star-pair basis; `null` for n≤1 |
| `internalAdjacencyRecover(basis, shellLanes, anchorLanes_, r, s)` | `bigint[]` × 3, `bigint` × 2 | `bigint` — K≡r−s (mod M+1); throws if not admissible or not adjacent |
| `PARKED_LANE` (`11n`), `SHELL_LANES_PARKED`, `SHELL_PARKED` (`881790n`) | — | canonical parked-split constants |
| `shadowAnchor(e)` | `e: bigint` | `bigint` — 11^e |
| `parkingReport(basis, parked, power=1n)` | `bigint[]`, `bigint[]`, `bigint` | `LANE_OCCUPANCY_V1` — shell/anchor moduli, coprimality, `admissible` |
| `parkedRecover(r, s, M, A)` | `bigint` × 4 | `bigint` — K mod A; throws if M not coprime to A |
| `parkedRecoverFrom(x, M, A)` | `bigint` × 3 | `bigint` — same, from the integer |

### div-chimera.js

The Division Chimera: exact integer division `a/d` for an arbitrary divisor
`d`, entirely in residue space, by five distinct mechanisms that all reach
the same quotient (V1–V5), plus two distortion-catalog constructs riding on
the same primitives (DIV³, Φ³). Ported from the external CRAM reference
implementation's `div_family.py` (`cram_review_20260616`, 2026-07-22) — see
that package's `PROOF_CERTIFICATE.md` Part V/VI for the formal theorems this
module's own test suite (`test/div-chimera.test.js`) mirrors. Genuinely new
relative to `cram.js`/`identity.js`: those recover a WINDING NUMBER K from
an integer and an anchor; this module divides an integer by an arbitrary
divisor, lane by lane, never leaving residue space.

| Function | Params | Returns / Throws |
|---|---|---|
| `ROOT_OPS` | — | `["add","sub","id","neg","mul","div","sqr","inv"]` — the 8-operator alphabet, degree ≤ 2 |
| `CHIMERA_ROLES` | — | `Map<bigint,string>` — the Four-Division Chimera's lane-role labels over `basis.js#B8`; informational only |
| `DEFAULT_ANCHORS` | — | `bigint[]` — `[23n,29n,31n,37n,41n]`, V3's default auxiliary anchors |
| `DEFAULT_ALT_BASIS` | — | `bigint[]` — `[23n,29n,31n,37n,41n,43n]`, V5's default alternate basis |
| `NonExactDivisionError` | `class extends Error`, `new NonExactDivisionError(aVal, d)` | thrown whenever `d` does not evenly divide the dividend; carries `.aVal`/`.d` |
| `DivisorNotCoprimeError` | `class extends Error`, `new DivisorNotCoprimeError(message)` | thrown when a variety's coprimality precondition on the divisor fails (V1/V4-homogeneous: `gcd(d,M)≠1`; V3: no candidate anchor coprime to `d`; V5: alternate basis not coprime to `d`) |
| `laneOp(op, a, b, p)` | `op: string` (one of `ROOT_OPS`), `a,b,p: bigint` | `?bigint` — one root operator, exact mod `p`; `div`/`inv` return `null` when undefined there |
| `v1KElim(aVal, d, basis)` | `aVal,d: bigint` (`d>0`), `basis: bigint[]` | `{q, alpha}` — V1, the flagship: `gcd(d,shellModulus(basis))=1` and `d\|aVal` required; throws `NonExactDivisionError`/`DivisorNotCoprimeError` |
| `v2FpdFused(aVal, bVal, d, basis)` | `bigint`s, `basis: bigint[]` | `{q, alpha}` — V2: `(aVal·bVal)/d` as one multiplication + one V1-style division; throws `NonExactDivisionError` if `d` doesn't divide the product |
| `v3FpdAnchors(aVal, d, anchors=DEFAULT_ANCHORS)` | `aVal,d: bigint`, `anchors: bigint[]` | `{q, reads: Map<bigint,bigint>}` — V3: quotient residues read directly through each coprime anchor; throws `NonExactDivisionError`/`DivisorNotCoprimeError` |
| `v4LanewiseDivHomogeneous(aVal, d, basis)` | `aVal,d: bigint`, `basis: bigint[]` | `{tray, expect}` — V4 homogeneous: every lane runs `div` against the unit divisor `d`; `expect` is the in-ring value `(aVal·d⁻¹) mod M`; throws `DivisorNotCoprimeError` if `d` is not a unit mod `shellModulus(basis)` |
| `v4LanewiseDivHeterogeneous(aVal, bVal, ops, basis)` | `bigint`s, `ops: string[]` (one `ROOT_OPS` entry per lane), `basis: bigint[]` | `{tray, mask}` — V4 heterogeneous: a distinct operator per lane, in-ring, `mask[i]` false where `tray[i]` is `null` |
| `transduceLane(gamma, K, M, b)` | `bigint`s | `bigint` — `(gamma + K·M) mod b`, exact for arbitrary `b` coprime to `M` or not (the bare formula V5 uses; see `cram.js#transduce` for the richer state-object form) |
| `v5Transduced(aVal, d, homeBasis, altBasis=DEFAULT_ALT_BASIS)` | `aVal,d: bigint`, `basis: bigint[]` × 2 | `{q, resHome}` — V5: transduces the carried magnitude to `altBasis` (coprime to `d`), divides there via V1, transduces the quotient home; throws `NonExactDivisionError`/`DivisorNotCoprimeError` |
| `route(aVal, d, basis)` | `aVal,d: bigint` (`d` may be negative or zero), `basis: bigint[]` | `{variety: "V1_k_elim"\|"V5_transduced", q}` — dispatches to V1 when `gcd(\|d\|,M)=1`, else V5; handles sign via absolute-value routing; throws `"division by zero"` at `d=0n`, `NonExactDivisionError` otherwise |
| `div3Mul(a, b, p)` | `bigint`s | `?bigint` — `(a·b) mod p` synthesized as `DIV(1,DIV(DIV(1,a),b))`, zero `mul` anywhere; `null` unless both `a`,`b` are units mod `p` |
| `div3Schema(aVal, bVal, basis)` | `bigint`s, `basis: bigint[]` | `(?bigint)[]` — `div3Mul` applied lanewise |
| `phi3Certify(aVal, bVal, d, basis)` | `bigint`s, `basis: bigint[]` | `{q, discrepancies}` — Φ³ triple certification of the division event `(aVal·d)/d`; `discrepancies===0n` on a correct implementation (also cross-checks `div3Mul` against plain multiplication on every lane where both operands are units) |

### fixture.js

Star numbers, the winding tower (unbounded-depth K recovery via
independent, non-accumulating levels), and CRT fixtures with a
recommissioned unit lane.

| Function | Params | Returns |
|---|---|---|
| `starNumber(n)` | `n: bigint` | `bigint` — S_n = 6n(n−1)+1 |
| `starPair(n)` | `n: bigint` | `{n, shell, anchor, adjacent:true}` (strings) |
| `starFamily(upTo)` | `upTo: bigint` | `Object[]` — `starPair` for n=1..upTo |
| `towerLevel(T, M)` | `T, M: bigint` | `{value, digit, k_mod_anchor, k_true, identity_holds, certified, next}` — one tower level |
| `windingTower(X, M)` | `X, M: bigint` (M≥2) | `Object[]` — full descent to zero; throws if M<2 |
| `towerRebuild(levels, M)` | `Object[]`, `bigint` | `bigint` — BOUNDARY PROJECTION reconstruction (not a tower operation) |
| `towerReport(X, M)` | `X, M: bigint` | `STAR_TOWER_V1` — depth, per-level certification, `handover_depth` |
| `levelsAreIndependent(X, M)` | `X, M: bigint` | `boolean` — each level reproducible standalone |
| `garnerDigits(X, basis)` | `X: bigint`, `basis: bigint[]` | `{digits, accumulator_threaded:true}` — Garner's cascade, for contrast |
| `UNIT_LANE` (`1n`) / `UNIT_LANE_INDEX` (`0n`) | — | the recommissioned unit lane and its fixed index |
| `fixture(basis)` | `basis: bigint[]` | `CRT_FIXTURE_V1` — `{lanes, M, anchor}`; throws if basis not pairwise coprime |
| `laneOf(fx, modulus)` | `Object`, `bigint` | `?bigint` — lane index or null |
| `unitLaneIsIdentity(basis)` | `basis: bigint[]` | `boolean` |
| `laneStates(modulus)` / `laneIsInformative(modulus)` | `bigint` | `bigint` / `boolean` |
| `phaseLock(fxA, fxB)` | two fixtures | `PHASE_LOCK_V1` — shared carrier lanes, `strength`, `locked` |
| `preservesPhase(phi, lane)` | `phi: fn(bigint):bigint`, `lane: bigint` | `boolean` — Φ(x)≡x (mod lane) exhaustively over one period |
| `lockedShift(lane, k)` | `lane, k: bigint` | `fn(bigint):bigint` — x ↦ x + k·lane |

### carry.js

The hidden carry (the discarded quotient of every reduction), signed
winding, and the carry functional (total winding energy).

| Function | Params | Returns |
|---|---|---|
| `centeredResidue(x, p)` | `x, p: bigint` | `bigint` in `(−p/2, p/2]` |
| `signedWinding(x, p)` | `x, p: bigint` | `bigint` — may be negative |
| `carrySplit(x, p)` | `x, p: bigint` | `{r, w, p, exact}` |
| `unsignedWinding(x, p)` | `x, p: bigint` | `bigint` — ⌊x/p⌋, r∈[0,p) convention |
| `signedAnchorResidue(r, K, A)` | `bigint` × 3 | `bigint` — v_A = (r−K) mod A |
| `isSignedAnchor(M, A)` | `M, A: bigint` | `boolean` — M ≡ −1 (mod A)? |
| `closedShellDescent(M, A, count)` | `M, A, count: bigint` | `Object[]` — anchor readout for the first `count` closed shells |
| `emitWithCarry(value, p)` | `value, p: bigint` | `{residue, carry, lane}` |
| `laneShadow(value, p)` | `value, p: bigint` | `bigint` — the discarded quotient alone |
| `carryFunctional(field, p)` | `field: Iterable<bigint>`, `p: bigint` | `bigint` — Σw² ≥ 0, "winding energy" |
| `isResiduePure(field, p)` | same | `boolean` — carryFunctional = 0 |
| `squareImage(p)` | `p: bigint` | `{p, distinct, of, expected}` |
| `squareShadowLaw(p)` | `p: bigint` | `Map<bigint,bigint>` — discarded-quotient occurrence counts |
| `emissionIsUniform(p, op)` | `p: bigint`, `op: fn(bigint):bigint` | `{uniform, distinct}` |

### tower-recover.js

T-COMP-1: winding recovery from an arbitrary **anchor set** (supersedes the
single-anchor-power lift), with the exact resolution bound R computed rather
than guessed.

| Function | Params | Returns |
|---|---|---|
| `lcmAll(ms)` | `ms: bigint[]` | `bigint` |
| `crtCombine(residues, moduli)` | `bigint[]`, `bigint[]` (need not be coprime) | `?bigint` — unique residue mod lcm(moduli), or `null` if inconsistent |
| `anchorSetCorridor(M, anchors)` | `M: bigint`, `anchors: bigint[]` | `{L, d, R, span}` — the corridor an anchor set buys |
| `towerRecover(r, anchorResidues, M, anchors)` | `r: bigint`, `anchorResidues: bigint[]`, `M: bigint`, `anchors: bigint[]` | `?{K, R, L, d, corridor}` — `null` if the anchor residues are inconsistent |
| `towerRecoverFrom(x, M, anchors)` | `x: bigint`, `M: bigint`, `anchors: bigint[]` | `?Object` — same, from the integer |
| `extendAnchors(M, anchors, need, candidates)` | `bigint`, `bigint[]`, `bigint`, `bigint[]` | `{anchors, L, d, R, span}` — extended set covering `need` |
| `crossCheckWinding(tracked, extracted)` | `bigint`, `bigint` | `{tracked, extracted, agree, fault}` |

### identity.js

The (r, w) cylinder identity, first- and second-order K-Elimination
(κ₁ = velocity, κ₂ = acceleration of the identity), and the natal-chart /
return / irreversibility vocabulary that binds the substrate to the
astrology layer.

| Function | Params | Returns |
|---|---|---|
| `identity(x, p)` | `x, p: bigint` | `{r, w, p, exact}` |
| `identityOn(x, basis)` | `x: bigint`, `basis: bigint[]` | `Object[]` — one (r,w) per lane |
| `sameAngleDifferentLevel(x, y, p)` | `bigint` × 3 | `{same_residue, same_winding, distinct}` |
| `kElim(x, M, A)` | `x, M, A: bigint` | `?bigint` — winding of x around M, read from A |
| `doubleKElim(x, M, A1, A2)` | `bigint` × 4 | `?{kappa1, kappa2, K, corridor, order}` |
| `windingDigits(x, M, anchors)` | `x, M: bigint`, `anchors: bigint[]` | `?{digits, K, radix, corridor, accumulator_threaded:false}` |
| `natalChart(x0, basis)` | `x0: bigint`, `basis: bigint[]` | `{kind, residues, winding, basis, origin}` — winding is zero by definition |
| `carryEvent(xBefore, xAfter, p)` | `bigint` × 3 | `{wrapped, increments, from, to, lane}` |
| `isReturn(x, natalResidue, p)` | `bigint` × 3 | `{returned, winding, changed, journey}` |
| `returns(natal, p, bound)` | `bigint` × 3 | `Object[]` — every return of lane p up to `bound` |
| `windingMonotone(trajectory, p)` | `trajectory: Iterable<bigint>`, `p: bigint` | `{monotone, violations}` — Lyapunov check |
| `natalUnreachable(trajectory, p)` | same | `{wound_states, any_returned_to_zero}` |

### tray.js

The two-tray architecture: an unbroken, saturated first tray (the Safe
Basis) phase-locked (via lane 11) to a second tray that may hold arbitrary
composites.

| Function | Params | Returns |
|---|---|---|
| `PHASE_LANE` (`11n`) / `ORIGIN_LANE` (`1n`) | — | the phase and origin carrier lanes |
| `saturationOf(basis)` | `basis: bigint[]` | `{lanes, states, span, bijective, saturated, slack}` |
| `firstTray(basis)` | `basis: bigint[]` | `FIRST_TRAY_V1` — `{M, saturated, unbroken, carries_phase, admissible}` |
| `phaseLockBetween(first, second)` | `bigint[]` × 2 | `{origin_shared, phase_lane, phase_shared, locked, strength}` |
| `preservesLock(phi, sample)` | `phi: fn`, `sample: bigint[]` | `boolean` — Φ fixes lane 11 on every sample point |
| `inheritance(firstBasis, secondModuli)` | `bigint[]` × 2 | `TRAY_INHERITANCE_V1` — `admissible` iff first tray unbroken+saturated and locked (second tray's own properties are reported, never required) |
| `deriveTray(x, moduli, firstBasis)` | `x: bigint`, `moduli: bigint[]`, `firstBasis: bigint[]` | `?DERIVED_TRAY_V1`; `null` if not admissible |
| `lanesConsistent(x, moduli)` | `x: bigint`, `moduli: bigint[]` | `boolean` — redundant (possibly non-coprime) lanes agree on their overlap |
| `arrowOfTime(basis, shell=36n, anchor=37n)` | `basis: bigint[]`, `shell,anchor: bigint` | `ARROW_V1` — saturated + adjacent star lift ⟹ `instantiated` |

---

## Ledger

**[not core — plain JS numbers/strings; the validation boundary itself]**

### import-ledger.js

`project/src/ledger/import-ledger.js` is the sole gate by which a value
computed anywhere (float tools, third-party libraries, hand-entered data)
may be treated as trustworthy input to `src/core/`.

| Function | Params | Returns | Throws |
|---|---|---|---|
| `validateLedgerEntry(entry)` | `entry: Object` — a candidate ledger entry | `true` | `"ledger entry missing ${k}"` for any absent required field; `"bad ledger_version"`; `"ledger entry source incomplete"`; `"ledger entry certificate.status invalid"`; or anything `parseArcsecString` throws on `longitude_arcsec`. Structural only — does **not** gate on certificate status; `SYNTHETIC_DEMO` entries pass this check. |
| `admitForCore(entry)` | `entry: Object` | `entry`, unchanged | everything `validateLedgerEntry` throws, plus `"SYNTHETIC_DEMO is not admissible to the HCRM core"` — **this is what "admission" actually checks**: structural conformance AND a certificate status other than `SYNTHETIC_DEMO` |
| `importLedger(entries)` | `entries: Object[]` | `entries`, unchanged | `"ledger must be an array"`, or whatever `validateLedgerEntry` throws on the first invalid entry — validates a whole ledger in one call, does not filter by status |

**What "admission" checks, precisely:** (1) every required top-level field
is present and correctly shaped (`ledger_version`, `event_id`, `body`,
`longitude_arcsec`, `source`, `certificate`); (2) `longitude_arcsec` parses
as a decimal-integer string (or BigInt) in `[0, 1296000)`; (3)
`certificate.status` is one of the three recognized values; (4) that status
is specifically **not** `SYNTHETIC_DEMO` — only `IMPORTED_INTEGER_LEDGER`
and `CERTIFIED_EXACT_LEDGER` are admissible to the core.

### ephemeris-ledger-schema.json

`project/src/ledger/ephemeris-ledger-schema.json` — the JSON Schema
(draft 2020-12) `validateLedgerEntry`/`admitForCore` implement by hand.
Schema version **v1.1** (WP-13, additive over the WP-08 v1 shape).

| Field | Required? | Type / valid values | Notes |
|---|---|---|---|
| `ledger_version` | **required** | `const: "hcrm-ephemeris-ledger-v1"` | |
| `event_id` | **required** | `string` | free-form; producer convention is `"<isoTime>#<body>"` or `"<isoTime>#<system>#<body>"` for house entries |
| `body` | **required** | `string`, open (no enum) | a planet/point name ("Sun", "Moon", ...) **or**, since v1.1, a house-cusp point name: `"ASC"`, `"MC"`, or `"CUSP_1"`..`"CUSP_12"` |
| `longitude_arcsec` | **required** | `string`, pattern `^(0\|[1-9][0-9]*)$` | decimal-integer arcseconds; range `[0, 1296000)` is enforced by `validateLedgerEntry`/`parseArcsecString`, not by the JSON Schema pattern itself |
| `house_system` | optional (**v1.1 addition**) | `string` | present only on ASC/MC/CUSP_* entries produced by a *quadrant* house system; value must exactly match a `HOUSE_SYSTEMS` id from `src/core/variants.js` (e.g. `"placidus"`, `"koch"`, `"whole_sign"` — snake_case); absent on planet entries |
| `source` | **required** | object, requires `kind`, `name`, `checksum` (all `string`) | provenance: e.g. `{kind:"astronomy-engine", name:"2.1.19", checksum:"<sha256 hex>"}` |
| `certificate` | **required** | object, requires `status`, `notes` | `status ∈ {SYNTHETIC_DEMO, IMPORTED_INTEGER_LEDGER, CERTIFIED_EXACT_LEDGER}`; `notes: string` (free text) |
| `meta` | optional (WP-08 addition) | object | producer diagnostics, not consumed by `validateLedgerEntry`/`admitForCore`, carried for downstream tooling: `jd_tt` (number), `delta_t_seconds` (number), `speed_arcsec_per_day` (signed decimal-integer string), `retrograde` (boolean) |

**Backward compatibility:** every entry that validated under schema v1
still validates unchanged under v1.1 — `house_system` is optional and
`body` was already an unrestricted string in v1, so v1.1 is a
documentation-only widening plus one new optional field, not a breaking
change.

---

## Ephemeris tools

**[tools · float degrees]** — everything in this section lives under
`project/tools/ephemeris/`, outside `src/core/`, so Mandate A1 (no floats)
does not apply here. Floats, `Math.*`, and `Date` are legal and used
throughout. Values only become admissible to the core after rounding to
integer arcseconds and passing through `admitForCore()`.

### produce-ledger.mjs

CLI + programmatic producer for schema-conformant ledger entries, backed by
the `astronomy-engine` npm package (planet positions) and this repo's own
`houses.js`/`timescale.js` (house cusps).

**CLI usage:**

```
node tools/ephemeris/produce-ledger.mjs \
  --time <ISO-8601 UTC instant>          # required, e.g. 1994-01-11T14:30:00Z
  --lat <degrees, [-90,90]>               # required
  --lng <degrees, [-180,180]>             # required
  [--bodies Sun,Moon,Mercury,...]         # optional; default = 10 classical bodies
  [--houses placidus,koch,...]            # optional; one or more HOUSE_SYSTEMS "LEDGER" ids
  [--out <file.json>]                     # optional; default = stdout
```

Emits a JSON array of ledger entries (schema v1.1) to `--out` or stdout.
`--bodies` names must be keys of `Astronomy.Body` (e.g. `Sun`, `Moon`,
`Mercury`, ... `Pluto`; `SSB`/`EMB` are explicitly rejected). `--houses`
names must be keys of the ledger-gated `HOUSE_SYSTEMS` in
`src/core/variants.js` (`placidus`, `koch`, `regiomontanus`, `campanus`,
`alcabitius`, `topocentric`, `morinus`, `meridian`).

| Export | Signature | Notes |
|---|---|---|
| `DEFAULT_BODIES` | `string[]` | the 10 classical bodies (Sun..Pluto) |
| `produceLedgerEntries(opts)` | `opts: {time: string\|Date, lat: number\|string, lng: number\|string, bodies?: string[]}` → `Object[]` (ledger entries) | geocentric apparent ecliptic-of-date longitude via `astronomy-engine`'s `GeoVector`+`Ecliptic` (aberration on); each entry's `meta` carries `jd_tt`, `delta_t_seconds`, `speed_arcsec_per_day` (central difference over ±6h), `retrograde` (derived from that rounded integer's sign, not the raw float) |
| `produceHouseLedgerEntries(opts)` | `opts: {time: string\|Date, lat: number\|string, lng: number\|string, systems: string[]}` → `Object[]` | one ASC/MC/CUSP_1..12 set **per requested system**, each tagged with that system's `house_system` id (duplicate ASC/MC values across systems is the deliberate tradeoff for "one system id → one complete, filterable chart"); a system whose cusp function throws `PolarLatitudeError` at the given latitude is **skipped** (console.error, run continues) rather than aborting |
| `main(argv)` | `argv: string[]` → `Object[]` | the CLI entry point; also importable for in-process testing without a subprocess |

Both `produceLedgerEntries` and `produceHouseLedgerEntries` throw on a
missing/unparseable `--time`, an out-of-range `--lat`/`--lng`
(`requireFiniteNumber` enforces `[-90,90]`/`[-180,180]`), or an unknown
body/house-system name.

### houses.js

Float house-cusp solvers — Placidus, Koch, Regiomontanus, Campanus,
Alcabitius, Topocentric, Meridian, Morinus — plus `ascMc` (Ascendant/
Midheaven, used by all of them) and a float Porphyry cross-check. Every
`*Cusps` function shares the signature `(jdUt1, jdTt, latDeg, lngDeg)`.

| Export | Signature | Notes |
|---|---|---|
| `PolarLatitudeError` | `class extends Error`, `new PolarLatitudeError(latDeg, systemLabel="Placidus")` | thrown by `ascMc`, Placidus, Koch, Alcabitius, Regiomontanus, Campanus, and Topocentric when `\|latDeg\| > 66.56°` (≈ 90° − mean obliquity). Placidus/Koch/Alcabitius: ecliptic longitudes are circumpolar at that latitude so the semi-arc trisection has no real solution (a domain limit). `ascMc`/Regiomontanus/Campanus/Topocentric: corrected from an earlier version that didn't throw — `ascMc`'s atan2 branch was found to silently return the Descendant (a 180° error) beyond this latitude for some RAMC values, and the other three inherit it since their angular cusps are exact identities of `ascMc()`. |
| `ascMc(jdUt1, jdTt, latDeg, lngDeg)` | `number` × 4 → `{ascDeg, mcDeg}`, throws `PolarLatitudeError` above 66.56° | Ascendant/Midheaven, float degrees `[0,360)` |
| `placidusCusps(jdUt1, jdTt, latDeg, lngDeg)` | same signature → `number[12]` | semi-arc trisection (iterative); throws `PolarLatitudeError` above 66.56° |
| `kochCusps(...)` | same | Midheaven-declination-based semi-arc variant; same 66.56° limit |
| `alcabitiusCusps(...)` | same | non-iterative closed form using the Ascendant's declination; same 66.56° limit; cusps 1/4/7/10 = ASC/IC/DSC/MC exactly |
| `regiomontanusCusps(...)` | same | equator-based; cusp1===ASC and cusp10===MC exactly by construction; throws `PolarLatitudeError` above 66.56° (cusp1 inherits ascMc()'s failure mode) |
| `campanusCusps(...)` | same | prime-vertical-based; house1/house10 exact identities; throws `PolarLatitudeError` above 66.56° (same reason as Regiomontanus) |
| `topocentricCusps(...)` | same | Polich-Page scaled-latitude approximation to Placidus; no `asin()`, but cusps 1/4/7/10 are ascMc()'s ASC/IC/DSC/MC exactly, so it throws `PolarLatitudeError` above 66.56° the same as the others |
| `meridianCusps(...)` | same | pure function of RAMC+obliquity (no latitude dependence); cusp10===MC exactly; cusp1 is the "equatorial ascendant", NOT the true ASC; never throws |
| `morinusCusps(...)` | same | ecliptic-pole projection variant of Meridian; no latitude dependence; none of cusp1/4/7/10 match `ascMc()`; never throws |
| `porphyryCuspsFloat(ascDeg, mcDeg)` | `number, number` → `number[12]` | float cross-check of the exact-integer `src/core/variants.js#porphyryCusps` |
| `POLAR_FALLBACK_POLICY` | `Object<string, {validLatRange, enforced, fallback}>` | per-system polar-latitude guidance table; `enforced` is `"hard"` for Placidus/Koch/Alcabitius/Regiomontanus/Campanus/Topocentric (all six now actually throw at the table's stated boundary) or `"none"` for Meridian/Morinus (no latitude dependence at all); also published to `window.HousesPolicy` in a browser context |

All angle parameters/returns are float **degrees**, `[0, 360)` unless noted;
`latDeg` is geographic latitude (north positive), `lngDeg` is geographic
longitude (**east** positive).

### timescale.js

ΔT (Espenak-Meeus), GMST/GAST, and IAU 2006 mean obliquity — a from-scratch
implementation `produce-ledger.mjs`'s own timescale path deliberately does
NOT use for planet positions (to stay bit-consistent with
`astronomy-engine`'s internal ΔT), but which `houses.js` requires for GAST.

| Function | Signature | Notes |
|---|---|---|
| `julianDayUTC(isoUtcString)` | `string` → `number` | Julian Day Number (UTC-based); `isoUtcString` must denote UTC (trailing `Z` or no zone suffix, per this repo's convention) |
| `deltaTSeconds(y)` | `y: number` (decimal year, e.g. 1987.27) → `number` | ΔT = TT−UT1, Espenak-Meeus polynomial; accuracy degrades for years beyond ~2010 (documented in-source) |
| `ttFromUtc(jdUtc)` | `number` → `number` | JD(TT) from JD(UTC) via ΔT (UT1≈UTC conflation) |
| `gmstDeg(jdUt1)` | `number` → `number` in `[0,360)` | Greenwich Mean Sidereal Time, degrees; verified against Meeus Example 12.a to ~0.02″ |
| `gastDeg(jdUt1, jdTt)` | `number, number` → `number` in `[0,360)` | Greenwich Apparent Sidereal Time (GMST + 2-term nutation-in-RA correction); callers needing better than ~0.5″ should upgrade to a full nutation series |
| `meanObliquityDeg(jdTt)` | `number` → `number` (degrees) | IAU 2006 polynomial, genuine 84381.406″ constant (not the brief's slightly different value — see in-source citation) |

All `jd*` parameters/returns are Julian Day numbers (float, fractional days);
`jdUt1` ≈ UTC-referenced, `jdTt` ≈ Terrestrial-Time-referenced. Angles are
float degrees.
