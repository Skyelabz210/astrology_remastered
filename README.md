# Astrology Remastered

An exact-integer astrological engine built on **CRAM** — Configurable Residue
Arithmetic Machines — covering every major astrological variant, surfacing the
shadow spine that falls out of the arithmetic, and using both to *reinforce*
traditional astrology rather than replace it.

Nothing in the core touches a float. Positions are integer arcseconds on a ring
of 1,296,000; every lane is a BigInt residue; every claim is either exhaustively
swept or explicitly marked open.

```
5913/5913 assertions · full ecliptic sweep 1,296,000 points, 0 mismatches · 21/21 core modules float-free
```

**Before taking any claim below at face value, read:**
[`project/CLAIM_BOUNDARY.md`](project/CLAIM_BOUNDARY.md) (every claim in this
repo, tagged PROVEN / MEASURED / ARGUED / OPEN / REJECTED, with the
counter-computation where one applies), [`project/STATUS.md`](project/STATUS.md)
(current classification per layer/module), and
[`project/REMEDIATION_LEDGER.md`](project/REMEDIATION_LEDGER.md) (the
corrective-pass history, P1–P28, including what was wrong and how it was found).
The banner above is machine-checked by [`scripts/check-claims.mjs`](scripts/check-claims.mjs).

### Documentation map

| Doc | What it's for |
|---|---|
| [`project/CLAIM_BOUNDARY.md`](project/CLAIM_BOUNDARY.md) | Every claim in the repo, tagged, with counter-computations for rejected ones. |
| [`project/STATUS.md`](project/STATUS.md) | Current evidence classification per layer/module. |
| [`project/REMEDIATION_LEDGER.md`](project/REMEDIATION_LEDGER.md) | The corrective-pass history, P1–P28. |
| [`project/docs/AUDIT_REMEDIATION_PLAN.md`](project/docs/AUDIT_REMEDIATION_PLAN.md) | The external audit this whole remediation effort responds to. |
| [`project/docs/EXECUTION_PLAN.md`](project/docs/EXECUTION_PLAN.md) | The 29-work-package plan that built the architecture described below. |
| [`project/docs/EXECUTION_STATUS.md`](project/docs/EXECUTION_STATUS.md) | Live status of every package — what actually landed, including an unresolved item flagged for the repo owner (see [Presentation layer](#presentation-layer) below). |
| [`project/docs/INPUTS_OUTPUTS.md`](project/docs/INPUTS_OUTPUTS.md) | Field reference for every exported function/class/constant across core, ledger, producer, houses, and timescale. |
| [`project/docs/CRAM_QMNF_PROOF_COMPENDIUM.md`](project/docs/CRAM_QMNF_PROOF_COMPENDIUM.md) | The twelve core CRAM/QMNF arithmetic identities, with three corrections to the circulated draft, each swept exhaustively by `project/test/proof-compendium.test.js`. |

---

## Quickstart

```bash
# 1. Serve the pages — required. ES module <script> tags (the core shim,
#    the real ephemeris vendor bundle, …) are blocked by browsers on
#    file://, so opening the .html files directly will not work.
npx serve project
#   or: cd project && python3 -m http.server 8000
# then open e.g. http://localhost:3000/HCRM%20Console.html

# 2. Run the tests (from project/)
cd project
npm test              # full suite + the exhaustive 1,296,000-point ring sweep
npm run test:quick    # same suite, skips the ring sweep (faster iteration)
npm run test:accuracy # just the ephemeris/house-cusp accuracy gate (see below)
npm run bench          # performance timings (add -- --assert for CI-style pass/fail)

# 3. Produce a real ephemeris ledger — the only path real astronomical data
#    takes into the exact BigInt core (see Architecture below)
node tools/ephemeris/produce-ledger.mjs \
  --time 1994-01-11T14:30:00Z --lat 29.4241 --lng -98.4936 \
  [--bodies Sun,Moon,Mercury,...] [--houses placidus] [--out file.json]
```

No install beyond `npm ci` in `project/` is required for tests; the producer
CLI needs the pinned `astronomy-engine` dependency, which `npm ci` also
installs.

---

## Architecture

Four layers, with a hard rule about which ones floats are allowed in:

```
┌──────────────────────────────────────────────────────────────────────┐
│ PRESENTATION   *.jsx, *.html — React, floats legal                   │
│  astro.jsx / src/present/astro-core.js — dignities, aspects, chart   │
│  logic; real ephemeris in-browser via a vendored astronomy-engine    │
│  build when present, else a labeled SYNTHETIC fallback               │
│  hcrm.jsx / hcrm-view.jsx — the exact-register console UI            │
└──────────────────────────────────────────────────────────────────────┘
                 │ float degrees, rounded to an integer arcsecond,
                 │ wrapped as a schema-conformant ledger entry
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PRODUCER       project/tools/ephemeris/ — floats legal                │
│  produce-ledger.mjs — real geocentric apparent ecliptic-of-date       │
│    longitudes via astronomy-engine, speed by central difference       │
│  houses.js — ASC/MC, Placidus, Koch, Regiomontanus, Campanus, …       │
│  timescale.js — ΔT, GMST/GAST, IAU2006 obliquity                      │
└──────────────────────────────────────────────────────────────────────┘
                 │ IMPORTED_INTEGER_LEDGER / CERTIFIED_EXACT_LEDGER
                 │ JSON entries, longitude_arcsec as a decimal-integer
                 │ string in [0, 1296000)
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ LEDGER         project/src/ledger/ — the only door into the core      │
│  ephemeris-ledger-schema.json — the entry shape                       │
│  import-ledger.js — validateLedgerEntry() / admitForCore(): throws    │
│    on any malformed entry, and unconditionally on SYNTHETIC_DEMO      │
└──────────────────────────────────────────────────────────────────────┘
                 │ admitForCore()-accepted entry only
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CORE           project/src/core/ — BigInt only, Mandate A1            │
│  basis.js, shell-kelim.js, ring.js, variants.js, … (21 modules)       │
│  no floats, no Math.*, no Date, no Number()/parseFloat/parseInt,      │
│  no decimal literals — mechanically enforced by the no-float audit    │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow, concretely:** a real planetary position is computed once, in
float degrees, in `tools/ephemeris/produce-ledger.mjs` (which calls
astronomy-engine — the only place in this repo that talks to a real
ephemeris library outside the browser). It is rounded to the nearest integer
arcsecond and emitted as a `longitude_arcsec` decimal-integer string inside a
ledger entry (`certificate.status: "IMPORTED_INTEGER_LEDGER"`). That entry is
the only thing `project/src/core/` is allowed to trust: `admitForCore()` in
`project/src/ledger/import-ledger.js` re-validates it and is the sole
admission gate — anything tagged `SYNTHETIC_DEMO` (a quantized-but-uncertified
float, e.g. from the browser demo path) is rejected there, not silently
passed through. `project/hcrm.jsx` demonstrates this rejection directly: its
synthetic values run through `admitForCore()`, the throw is caught, and the
UI renders a visible "SYNTHETIC — not admissible to core" badge rather than
presenting rounded floats as exact register data.

### Presentation layer

The chart UI (`astro.jsx`, `app.jsx`, and friends) is a separate, more
conventional presentation path: when a vendored astronomy-engine build is
loaded in the browser it computes real positions client-side (not through the
ledger — that path is specific to the exact-register demo); otherwise it
falls back to a synthetic orbital model and sets `window.EPHEMERIS_MODE =
"SYNTHETIC"` so the UI can badge it honestly.

`agent.jsx`'s optional LLM chart-interpretation feature defaults to on and
sends raw birth data to it (`window.claude.complete()`). This was originally
shipped as a disclosed, unresolved finding — no reachable off-switch existed
in a standalone deployment, and (found while fixing it) some screens ignored
the in-repo toggle entirely. Both gaps are now fixed: a real checkbox on the
landing form and an `agent` toggle pill on every reading screen turn it off,
and every agent call site now honors that setting, falling back to the
existing local, non-AI reading. Full history: see ["Resolved: agent.jsx
opt-out" in `project/docs/EXECUTION_STATUS.md`](project/docs/EXECUTION_STATUS.md#resolved-agentjsx-opt-out-owner-requested-2026-08-12).

#### Eclipses and geophysical coordinates

`eclipses.js` walks both eclipse series — solar and lunar — off the vendored
astronomy-engine and answers three questions the chart layer could not:
which eclipses **preceded** a birth (the prenatal solar and lunar pair),
which eclipses across a lifetime **land on** that chart (conjunction or
opposition to a natal body or angle, within a configurable orb), and **where
on Earth** each one happened. `eclipse-view.jsx` renders that as a panel in
the full spread.

The "where" is two different answers and the panel never conflates them: a
total or annular solar eclipse has a real shadow axis, so its coordinate is
the point of **greatest eclipse**; a purely partial solar eclipse has no axis
touching Earth and a lunar eclipse has no ground track at all, so those show
the **subsolar / sublunar** point — where the eclipsed body stood at zenith.
Every coordinate is printed with the basis that produced it, alongside the
great-circle distance and bearing from the birthplace and whether the body
was above that horizon at peak (necessary for visibility, not sufficient —
the panel says "above horizon", never "you saw it"). Eclipse geometry runs
only on the real ephemeris; under `EPHEMERIS_MODE === "SYNTHETIC"` the panel
says so rather than printing invented coordinates.

The module takes the astronomy engine as a parameter rather than importing
it, so `project/test/present/eclipses.test.js` drives the shipped code
against the real ephemeris — checking, among other things, that the Moon is
at zenith over every computed sublunar point and the Sun above the horizon at
every greatest-eclipse point across 1970–2030, which is what actually catches
a flipped east/west longitude convention.

#### Voice narration

Readings are narrated by **ElevenLabs** (`elevenlabs.js`), with the browser's
own `SpeechSynthesis` as the fallback (`voice.jsx`). The configured reading
voice is **Nerissa**, resolved to an ElevenLabs voice ID *by name at runtime*
— against the account's own voice list first, then the public Voice Library —
because that ID is account-visible and a hard-coded literal would be a guess.

Narration is on by default and costs nothing until an ElevenLabs API key is
entered: with no key the provider is unreachable, `voice.jsx` narrates
through the browser engine, and no request is made. Add a key under
**Tweaks → Substrate · reading → ElevenLabs key**; it is stored in
`localStorage` only, shown masked, and deliberately kept out of the settings
object, because `useTweaks()` persists settings back into `app.jsx`'s source
via the host and a secret must never travel that path.

When the ElevenLabs provider *is* active it sends the reading text and that
key to `api.elevenlabs.io` — and nothing else: no birth data, no
coordinates, no placements. That is the app's second and last egress path
(the first is `agent.jsx`), and the landing form's privacy note names both,
conditioned on whether a key is actually stored. Every way the provider can
fail — no key, unresolvable voice, refused request, network down, blocked
playback — falls back to the browser voice rather than going silent; that
fallback is what `project/test/present/voice-provider.test.js` exists to
pin.

#### The chart plays as one narrative

A reading is not twelve things to trigger one at a time. `narrative.jsx`
composes the whole chart as a single piece — an opening that places the
nativity (date, place, sect, rising sign, lunar phase, chart shape), the
twelve signs in deck order, and a closing that names what the shape came to
— and `voice.jsx`'s `speakNarrative()` plays it end to end.

The deck follows the voice rather than a timer. Each segment carries its
character range within the joined text; ElevenLabs' `with-timestamps`
endpoint returns a start time per character, so the card on screen changes
when the narration actually reaches that sign. Where a model returns no
alignment, the same ranges scale against the clip's measured duration; on
the browser fallback each segment is its own utterance and the cue comes
from its `onstart`, which is exact. Long narratives are split into
request-sized chunks at segment boundaries — never mid-sentence — and the
next chunk is synthesized while the current one plays.

Because playback is driven by the audio element's own clock, pausing and
resuming keep the deck in sync for free: the reading holds mid-sentence and
the card holds with it. Stepping by hand stops the narration rather than
fighting it.

The page shows the sentence being spoken, not the source-tagged per-card
table underneath it — those say different things, one written for the ear
and one for the eye, and showing one while hearing the other made the
reading feel like two apps at once. The table returns when narration stops.

#### The default chart

The app opens on the owner's own nativity — 21 October 1980, 17:31 EDT, Fort
Liberty (Bragg), NC. Four files carry a copy of that fact (`app.jsx`'s
`DEFAULT_SETTINGS`, `hcrm-app.jsx`'s `HCRM_DEFAULTS`, `landing.jsx`'s initial
pickers, `cities.jsx`'s `DEFAULT_CITY_KEY`) and they cannot be collapsed into
one constant — two are EDITMODE blocks the host tooling rewrites in place, and
the pickers are calendar fields rather than an instant. So
`project/test/present/defaults.test.js` is the coupling instead: it resolves
the pickers through the same `tzresolve.js` call the submit handler uses and
requires the result to be the DEFAULT_SETTINGS instant, which is what catches
a hand-written −05:00 where that date is actually −04:00.

---

## Accuracy statement

Real positions are checked against independent references, and that check
runs on **every push and pull request**, not just once at implementation
time — the `accuracy` job in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs
`npm run test:accuracy` as a blocking CI gate.

- **Planetary longitudes** (Sun through Pluto) — checked against JPL
  Horizons (DE441) apparent geocentric ecliptic-of-date longitudes at 20
  reference instants spanning 1700–2050
  (`project/test/fixtures/reference-vectors.json`). Tolerance: **≤ 60″**
  for every body, Moon included (documented in
  `project/test/accuracy.test.js`, including why the Moon no longer gets a
  separate, wider budget). Observed: worst single-point error **~29.5″
  (Pluto)**; worst per-body mean error **~10.4″ (Neptune)**; Moon's own
  worst single-point error **~15.4″** — all well inside tolerance.
- **House cusps** (`tools/ephemeris/houses.js`: Placidus, Koch,
  Regiomontanus, Campanus, Alcabitius, Topocentric, Morinus, Meridian,
  Porphyry) — checked against genuine Swiss Ephemeris (`pyswisseph`) output
  across 5 charts × 8 systems × 12 cusps. Tolerance: **≤ 30″**. Observed
  worst case: **~12.4″**, attributed uniformly to a mean-vs-true-obliquity
  difference (confirmed not a per-system bug). Above ~66.56° latitude,
  Placidus/Koch/Alcabitius/Regiomontanus/Campanus/Topocentric refuse
  outright (`PolarLatitudeError`) rather than return a number at all — see
  `tools/ephemeris/houses.js`'s `POLAR_FALLBACK_POLICY`.
- **Retrograde/station timing** — 5 published stationary instants (Mercury,
  Mars, Venus; 2022–2023): the sign of the computed speed flips within
  ±36 h of each published instant, and `retrograde ≡ (speed < 0)` holds
  across every fixture.

These thresholds are enforced mechanically: `npm run test:accuracy` (and the
full `npm test`) fails the build the moment a regression pushes any
comparison out of tolerance — a deliberately corrupted fixture value is
itself part of the test (`accuracy.test.js` asserts the gate actually
catches a >5′ error), so the check is verified to work, not just present.

---

## If you know residue number systems, read this first

CRAM looks like RNS and is not RNS. Five differences decide how everything else
reads, and skipping them will make the rest of this repo look wrong.

**1. Magnitude is derived, never carried.** A value's position is a tray of
residues. The lap count `K` is *not a stored field* — it is a function of the
tray, recovered on demand by K-Elimination on the parked lane. This is not a
storage preference: `k` was never separate information in the first place, and
an anchor coprime to the shell gives an independent exact view of the same
value. That is what retires k-tracking, and with it the sixty-year "impossibility"
of exact RNS division.

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

### Deriving magnitude — you never declare it

This generalises past the winding. **k was never separate information.** In
`X = r + k·M` the classical reading treats `k` as erased by the reduction and
sets out to estimate it; that reading is what made RNS division "impossible" for
sixty years (Szabó & Tanaka, 1967). It is wrong for integer-only arithmetic. An
anchor coprime to the shell supplies an *independent exact view* of the same
value, and the pair of views pins it. Nothing is estimated and nothing is
approximated.

So any magnitude question — division, comparison, overflow, sign, or the
magnitude of a transformed value `Φ(x)` — is answered by eliminating against an
anchor, not by tracking a bound:

```
K ≡ (s − γ) · M⁻¹   (mod A)          s = Φ(x) mod A
```

`Φ(x) mod A` is reachable for **any** `A` from the source tray alone, because
the bridge gives `x mod A` exactly and `Φ(x) mod A = Φ(x mod A) mod A` for any
integer-coefficient Φ. So the transform's growth never has to be known
analytically.

What *is* required is the range hypothesis the theorem actually carries —
`X < M·A`. The caller therefore declares **depth**, a property of the fixture,
and the anchor lifts to `(M_B+1)^depth`. The derivation is **double**: one
elimination at `depth` yields the winding, a second at `depth+1` certifies it.
Equal results mean the leading digit is zero — the winding stopped growing
rather than wrapping. A difference *proves* the corridor was too narrow, and the
transduction is refused rather than certified.

```js
// no declaration about Φ of any kind
transduce(encode(1000n, [2n,3n,5n,7n]), [3n,5n,7n,11n], { phiLane: v => 10000n*v })
// → value 10,000,000, K = 8658, leading_digit 0, corridor_certified: true
// depth 1 refuses: K-Elim gives 566 vs 8658 — a leading digit of 7 is the wrap
```

The formal development is at
[`Skyelabz210/k-elimination-lean4`](https://github.com/Skyelabz210/k-elimination-lean4)
— 27 Lean 4 theorems and 10 Coq lemmas, zero `sorry`, zero axioms, cross-verified
in both systems.

### The hidden carry

Every reduction emits **two** things: a residue and a quotient. Keeping only the
residue is what makes the carry "hidden", and three consequences follow.

**The carry is signed.** Under least-nonnegative residues the winding is always
`≥ 0` and the sign is gone. The centred residue `r ∈ (−p/2, p/2]` with
`w = (x − r)/p` keeps it — `w` counts to the *nearest* shell, so it goes negative
below one. It is the K-Elimination winding, not the p-adic valuation:
`w₇(49) = 7` where `v₇(49) = 2`.

**The anchor reads it negated.** For any anchor with `M ≡ −1 (mod A)`:

```
v_A = (r − K) mod A
```

At a closed shell (`r = 0`) that is `(−K) mod A` — **the anchor counts down as
the carry counts up**. This matters because in the residue lane the closed shells
`0, M, 2M, …` are *indistinguishable*; each reads `r = 0`, and only the
descending anchor separates them. On the Dresden pair `M = 36, A = 37` the
descent reads `36, 35, 34, 33` at `N = 36, 72, 108, 144`. The ecliptic ring holds
exactly two closed shells of `M_SHELL`, and only the parked lane tells them apart.

**The shadow is the readable channel.** Under a uniform ensemble an additive
lane's residues are exactly i.i.d. uniform, so the digit channel is featureless
*by construction* — absence of structure there proves nothing. Squaring is not an
additive shift, so that argument does not apply: `r ↦ r² mod p` is 2-to-1 on
nonzero residues, its image covers only `(p+1)/2` of `p` values (7 of 13, 19 of
37), and the discarded quotient `⌊r²/p⌋` inherits that structure. The shadow is
where signal actually lives — which is why discarding it costs you the one
channel worth reading.

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

**13 house systems, 5 exact in the core and 8 via the ledger.** Whole sign,
Equal from ASC, Equal from MC, Vehlow, and Porphyry are exact integer
constructions inside `src/core/`. Placidus, Koch, Regiomontanus, Campanus,
Alcabitius, Topocentric, Morinus and Meridian require an obliquity model,
which would put a float in the path — so `src/core/` never computes them
itself. They are real, float-legal solvers in `tools/ephemeris/houses.js`
(cross-checked against genuine Swiss Ephemeris output, see
[Accuracy statement](#accuracy-statement)), and reach `src/core/` only as
certified ledger entries — the registry marks them `LEDGER`, not the earlier
placeholder `OPEN`, to reflect that the fulfillment path now exists (see
[Architecture](#architecture)).

---

## Claim discipline

Every claim in `CLAIM_BOUNDARY.md` is tagged **PROVEN**, **OPEN**, or
**REJECTED**, and rejected claims stay in the document with the computation that
killed them rather than being edited away. `REMEDIATION_LEDGER.md` records each
corrective pass (P1–P28).

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
- **The transduction corridor was certified against the wrong magnitude** — a magnifying Φ was reported `corridor_certified: true` while returning 653,740 instead of 10,000,000. Real defect; but the **first remedy was also wrong** and is withdrawn. It required the caller to declare Φ's growth, which inverts the theorem — magnitude is *derived*, by K-Elimination against a lifted anchor. See [Deriving magnitude](#deriving-magnitude-you-never-declare-it).
- **`parkingReport` admitted an off-basis prime** — it gated admissibility on coprimality alone, so lane 23 passed although `23 ∤ M₈` and no such lane exists in the tray.

---

## Repo map

```
project/
  src/core/            the exact core — BigInt only, no UI, no prose (Mandate A1)
    basis.js             S8, both splits, the parked constants
    shell-kelim.js       K-Elimination, the lift, the tray register
    residues.js          pure integer residue helpers (mod), shared primitive
    gear-class.js        gear-pair classification on (r17, r19)
    validators.js        admit only exact integer arcseconds — no Number/round
    carry.js             the hidden carry — signed winding, shadow, C = Σw²
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
    tower-recover.js     T-COMP-1 — winding recovery from an anchor SET
    identity.js          identity of a number, ID_p(x)=(r,w) — D-030
    tray.js              the two-tray architecture — fixture + phase lock
  src/ledger/          the admission contract — the only door into src/core/
    ephemeris-ledger-schema.json
    import-ledger.js     validateLedgerEntry() / admitForCore()
  src/present/          pure presentation logic, dual Node+browser (float-legal)
    astro-core.js         dignities, terms, faces, lots, sect, aspects, patterns
    contrast.js            WCAG-AA contrast math backing styles.css
  src/demo/            explicitly-labeled synthetic demo data (never core input)
  tools/
    ephemeris/            the producer — astronomy-engine, floats legal
      produce-ledger.mjs    CLI: real positions + house cusps → ledger JSON
      houses.js              ASC/MC, Placidus, Koch, Regiomontanus, …
      timescale.js            ΔT, GMST/GAST, IAU2006 obliquity
      fetch-horizons.mjs      regenerates the JPL Horizons reference fixtures
    validate-ledgers.mjs   schema-validates every *.ledger.json (CI's schema-validate job)
    build-standalone.mjs   bundles an offline dist/standalone.html
  vendor/              vendored astronomy-engine UMD build for the in-browser chart UI
  test/
    run.js               headless runner → npm test; auto-discovers *.test.js
    no-float-audit.js    single source of truth for Mandate A1 enforcement
    fixtures/             JPL Horizons + Swiss Ephemeris reference data
    present/              tests against src/present/ and the .jsx presentation layer
    *.test.js             suites — drop a new one in, no registration needed
  bench/bench.mjs      performance thresholds → npm run bench
  docs/
    EXECUTION_PLAN.md      the 29-work-package plan
    EXECUTION_STATUS.md    live status of every package (start here for "what's built")
    INPUTS_OUTPUTS.md      function-level reference for every export
    AUDIT_REMEDIATION_PLAN.md  the original external audit
  eclipses.js          eclipse series, greatest-eclipse/sub-body coordinates, natal contacts
  elevenlabs.js        ElevenLabs TTS provider for the reading voice (Nerissa)
  narrative.jsx        the whole chart composed as one continuous spoken narrative
  tzresolve.js         DST-aware wall-clock → UTC instant resolution
  validate.js          birth-input validation, polar house-system warnings
  zodiac-globe.js      the zodiac sign stencilled into the landing globe's dots
  *.jsx, *.html        the presentation layer — chart UI, HCRM register console
  Core Test Harness.html the core's own gate — same modules, in a browser
  CLAIM_BOUNDARY.md    every claim, tagged, with counter-computations
  REMEDIATION_LEDGER.md the corrective passes, P1–P28
  STATUS.md            current classification per module
CONTRIBUTING.md        how to add a test suite, a core module, or a PR
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

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the test-first workflow, Mandate
A1 in detail, and how to add a new core module so both no-float audits (Node
and browser) see it.
