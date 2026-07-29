# Dresden Codex × CRAM — Test Protocol (Pre-Registration)

**Author:** Acid (HackFate.us / Skyelabz210)
**Object under test:** Dresden Codex, full facsimile (Library of Congress / World Digital Library scan, 78 imaged leaves)
**Instrument:** CRAM — Configurable Residue Arithmetic Machine (star-number register architecture on S₂=13 / S₃=37 / S₄=73, shell M=36, anchor A=37)
**Status:** PRE-REGISTERED. Predictions and pass/fail criteria below are fixed **before** transcription. This document exists so the test cannot be fit after the fact.

**Axioms in force:** A1 — zero floating point. A2 — no approximation; exact integers, rationals, and residue tuples only. Every quantity in this protocol and in all downstream tests is an exact integer.

---

## 0. What this document is, and is not

This is a falsification harness, not an argument. It states, in advance, what the codex must contain if the CRAM reading is correct, and — equally — what would sink it. The Codex is the primary object; CRAM is a measuring instrument applied to it, not the thing being confirmed. A passing gate is evidence the instrument reads the object. A failing gate retires a claim. Neither is permitted to be softened later.

Three things this protocol does **not** attempt to establish, and will not claim regardless of outcome:

- **Intentionality.** Arithmetic structure being present does not prove the scribes reasoned in these terms. That question is unreachable by arithmetic and is out of scope. (Tracked as the standing G3 gate; it is named here only so it is never quietly assumed.)
- **Operational page order.** The modern PDF/leaf order is a conservation and mounting artifact. It is not assumed to be the original screenfold or computational order. Page references below carry an EPIGRAPHIC tag where they rely on standard scholarship, and the leaf→table mapping is itself a gated codicological task (CT-0).
- **Sufficiency of the totals.** That a known period factors the CRAM way is necessary, not sufficient. The codex must actually carry that number, in that structural position. The arithmetic layer and the codex-empirical layer are scored separately.

---

## 1. Evidence classes (applied to every downstream claim, verbatim)

- **OBSERVED** — directly visible in the source image or a locked transform.
- **MEASURED** — supported by sidecar metrics, coordinates, reproducible transform.
- **CODICOLOGICAL** — pane, edge, repair, fold, substrate, conservation evidence.
- **EPIGRAPHIC** — standard glyph / bar-dot / calendar scholarship.
- **ARITHMETIC** — exact integer identity or register count.
- **CRAM_SIGNAL** — CRAM / 36-37 / star-lift evidence used as a signal, not as Codex proof by itself.
- **HYPOTHESIS_ACTIVE** — working model promoted to test target.
- **SPECULATIVE** — plausible, not yet test-backed.
- **REJECTED_BY_GATE** — failed a named falsification gate.

The protocol is deliberately layered so that the strong claims (ARITHMETIC) and the weak claims (the codex actually carrying those numbers — OBSERVED/MEASURED) are never blended into a single undifferentiated assertion.

---

## 2. The arithmetic layer — certified before testing

These identities are not predictions about the codex. They are exact facts about the relationship between the **established** Maya periods (EPIGRAPHIC: 11960, 584, 37960, 365, 260, and the eclipse intervals 148/177) and the CRAM star-anchors. They are certified here by exact integer arithmetic so that no false identity is pre-registered. (Verification run: all PASS.)

| Identity | Exact form | Class |
|---|---|---|
| Star ladder | S₂=13, S₃=37, S₄=73 via Sₙ = 6n(n−1)+1 | ARITHMETIC |
| Shell / anchor | M = 6² = 36; A = M+1 = 37; 36² ≡ 1 (mod 37); 36 ≡ −1 (mod 37) | ARITHMETIC |
| Solar year | Haab 365 = 5·S₄ | ARITHMETIC |
| Venus synodic | 584 = 8·S₄ = 16·A − 8; subdivisions 236+90+250+8 = 584 | ARITHMETIC |
| Venus table | 37960 = 65·584 = 104·365 = 146·260 | ARITHMETIC |
| Eclipse table | 11960 = 2³·5·13·23 = 46·260 | ARITHMETIC |
| Eclipse intervals | SPINE 148 = 4·A (exact); SHELL 177 = 5·A − 8 | ARITHMETIC |
| ±8 quantum (8=2³) | Moon 29=1A−8; eclipse 177=5A−8; Jupiter 399=11A−8; Venus 584=16A−8; Saturn 378=10A+8 | ARITHMETIC |
| Shadow prime 11 | 11960 mod 378 = 242 = 2·11² (displacement-shadow) | ARITHMETIC |
| Shadow prime 23 | 23 is the irreducible cofactor of 11960 after extracting {2,3,5,7,13,37,73} | ARITHMETIC |
| Repunit / capstone | R₃ = 111 = 3·A; 13·37·73 = 35113 | ARITHMETIC |
| Saros bimorphism | 6585 = 37·177+36 (SHELL); 6586 = 37·178 (SPINE); same winding K=182 | ARITHMETIC |

The arithmetic layer **passes**. What remains is whether the codex carries these numbers in these positions. That is the codex-empirical layer, tested by the gates below.

---

## 3. Falsification gates

Each gate is stated in the required format: current evidence / what it supports / what it does not yet establish / exact test / pass / fail / ledger. The pass/fail conditions are fixed now.

### CT-0 — Leaf-to-table mapping (codicological prerequisite)

- **Current evidence:** Standard scholarship places the Venus table at Förstemann pp. 24, 46–50; the eclipse/lunar table at pp. 51–58; serpent-number reckonings at pp. 61–69 (EPIGRAPHIC). The facsimile's heavy bar-dot tabular leaves (indices ~46–58) and serpent leaves (~65, 66, 73) are consistent with this (OBSERVED).
- **What it supports:** A working map from facsimile index → table region.
- **What it does not yet establish:** That the imaged adjacency is the operational adjacency; whether any apparent neighbor is a modern repair join.
- **Exact test:** For each candidate table region, confirm (a) consistent three-register ruling, (b) red frame-lines bounding the table block, (c) a column grid whose width matches the known table (eclipse: the picture-stations + number columns; Venus: 5 columns × 13 rows feel). Record ROIs and a sidecar of register/column counts.
- **Pass:** Region geometry matches the known table structure to integer column/row counts.
- **Fail:** Geometry inconsistent with the known table → the leaf is mis-mapped or is a repair composite; downstream gates on that region are suspended, not failed.
- **Ledger:** pane_ledger, roi_ledger, seam_repair_ledger.

### G-ECL-TOTAL — Eclipse table grand total = 11960

- **Current evidence:** The eclipse table is known to sum to 11960 days (EPIGRAPHIC). 11960 = 2³·5·13·23 = 46·260 (ARITHMETIC, certified §2).
- **What it supports:** That the table's cumulative reckoning, where legible, should resolve to 11960.
- **What it does not establish (yet):** That the visible bar-dot cumulative number on the table's terminal station transcribes to 11960 in *this* facsimile.
- **Exact test:** Transcribe the cumulative Long Count at the table's closing station(s) (ROI to be fixed in CT-0). Reduce to days as an exact integer.
- **Pass:** Transcription = 11960 exactly.
- **Fail:** Transcription ≠ 11960 and not reconcilable as a scribal/​conservation error within one bar-dot position.
- **Ledger:** arithmetic_register_ledger, roi_ledger.

### G-ECL-INT — Every eclipse interval ∈ {148, 177, 178}

This is the load-bearing codex-empirical gate for the SPINE/SHELL claim.

- **Current evidence:** The table advances by intervals of 177, 148, with 178 as a documented variant (EPIGRAPHIC). CRAM: 148 = 4A (exact, SPINE), 177 = 5A − 8 (SHELL, displaced by the ±8 quantum) (ARITHMETIC, certified §2).
- **What it supports:** That every legible inter-station interval should be 4A, or 4A/5A displaced by a small fixed quantum.
- **What it does not establish (yet):** The actual transcribed interval sequence in this facsimile.
- **Exact test:** Transcribe the interval number written at each legible station transition on a chosen eclipse leaf. Each is an exact integer.
- **Pass:** Every transcribed interval ∈ {148, 177, 178}, i.e. each equals 4A, or 5A−8, or 4A+30. No interval requires a generator outside {A=37, ±8}.
- **Fail:** A legible interval falls outside {148, 177, 178} and is not a transcription/​damage artifact. One clean counterexample retires the "intervals are anchor-multiples ∓8" claim for this table.
- **Ledger:** arithmetic_register_ledger.

### G-VEN-SUB — Venus synodic subdivision contains an explicit 8

- **Current evidence:** The Venus synodic 584 is canonically divided 236 + 90 + 250 + 8 (EPIGRAPHIC). CRAM: the terminal 8 *is* the ±8 displacement quantum (8 = 2³), and 584 = 8·S₄ = 16A − 8 (ARITHMETIC, certified §2).
- **What it supports:** That the smallest Venus subdivision present in the table is 8, not a rounding remainder.
- **What it does not establish (yet):** That an 8-interval is explicitly written in this facsimile's Venus table.
- **Exact test:** Locate the four-part subdivision; transcribe the smallest interval.
- **Pass:** Smallest subdivision transcribes to 8.
- **Fail:** No 8-interval present / smallest subdivision ≠ 8.
- **Ledger:** arithmetic_register_ledger.

### G-VEN-TOTAL — Venus table run = 37960

- **Current evidence:** Venus table runs 65 synodic periods = 37960 days = 104 Haab = 146 Tzolkin (EPIGRAPHIC). 37960 = 65·584 (ARITHMETIC, certified §2).
- **Exact test:** Transcribe the table's closing cumulative count.
- **Pass:** = 37960.
- **Fail:** ≠ 37960, irreconcilable within one position.
- **Ledger:** arithmetic_register_ledger.

### G-REG — Three-register architecture on the page

- **Current evidence:** Maya almanac leaves are ruled into horizontal registers (typically three) (EPIGRAPHIC/OBSERVED). CRAM: three registers correspond to the three star anchors 13 / 37 / 73.
- **What it supports:** A structural (not numeric) correspondence between page ruling and the register count.
- **What it does not establish:** That the scribes intended the registers to *be* the anchors (that is G3, out of scope).
- **Exact test:** Count the red-ruled horizontal registers per table leaf in the mapped regions.
- **Pass:** The dominant register count is 3 across the table leaves (a structural correspondence to the three-anchor architecture), recorded as OBSERVED.
- **Fail:** No consistent register count; ruling is irregular or not three. Reported as OBSERVED either way — this gate calibrates a structural correspondence, it does not by itself confirm CRAM.
- **Ledger:** pane_ledger.

### G-RB — Red/black as lane-local state, not decoration

- **Current evidence:** Maya tables use black for the main count and red for coefficients/day-positions and corrections (EPIGRAPHIC). CRAM treats red/black as lane-state markers.
- **Exact test:** On a legible table block, check whether red marks occupy a consistent role (coefficient / position / correction column) distinct from black (count), rather than appearing at random.
- **Pass:** Red occupies a consistent, separable structural role.
- **Fail:** Red and black are interchangeable / positionally random.
- **Ledger:** black_stratification_ledger.

### G-23 — Eclipse table is the unique designed period carrying an irreducible non-{2,3,5,7,13,37,73} cofactor

This is the shadow-entropy claim, scored at the census level (ARITHMETIC), not requiring new transcription.

- **Current evidence:** Census of designed Maya periods against the generating set Σ = {2,3,5,7,13,37,73}. 11960 alone leaves the irreducible prime cofactor ρ = 23 (ARITHMETIC, certified §2). 11 enters only as a displacement-shadow (11960 mod 378 = 2·11²), never as a base factor.
- **Exact test:** Factor each canonical period (260, 365, 584, 378, 399, 780, 11960, 37960, 6585, …); record which leave an irreducible cofactor outside Σ.
- **Pass:** 11960 is the unique designed period whose factorization carries a nontrivial irreducible cofactor (23) after extracting Σ.
- **Fail:** Another designed period carries an equally irreducible outside-Σ cofactor of comparable standing → 23 is not distinguished, and the "eclipse register is the one requiring an external parameter" reading weakens.
- **Ledger:** arithmetic_register_ledger, claim_obligation_ledger.

---

## 4. Ledgers to populate

pane_ledger · roi_ledger · shell_tool_ledger · black_stratification_ledger · seam_repair_ledger · tonal_window_ledger · arithmetic_register_ledger · claim_obligation_ledger. Each downstream measurement writes a row with a fixed transform name, parameters, ROI coordinates, and the resulting integer.

---

## 5. Scope caveats (binding)

1. Confident bar-dot transcription from the embedded facsimile may be limited by resolution. Where a number cannot be read to integer certainty from this scan, the gate is held **OPEN with a named source upgrade** (Förstemann chromolithograph / Villacorta line drawings / SLUB Dresden high-res plates), not scored as pass or fail. Eyeballing a value off a low-resolution thumbnail and asserting it is forbidden (no dramatic-reveal-as-evidence).
2. Pale fields are not assumed blank; shell/carapace marks are not assumed zero.
3. A passing arithmetic layer with an unread codex layer is reported as exactly that — necessary condition met, empirical condition pending — never as confirmation.

---

## 6. Test sequence

- **T1 — Arithmetic + structural (runnable now):** certify §2 (done, all PASS); score G-23 at census level; score G-REG and G-RB at OBSERVED level on the mapped table leaves; fix CT-0 ROIs.
- **T2 — Targeted transcription:** G-ECL-INT, G-VEN-SUB on the single most legible eclipse and Venus leaf; integer reductions into the arithmetic_register_ledger.
- **T3 — Totals:** G-ECL-TOTAL, G-VEN-TOTAL at the closing stations.
- **T4 — Source upgrade** for any gate held OPEN at T2/T3.

A gate's verdict is written once and not softened. PASS, FAIL, or OPEN(reason).

---

## 7. Handoff line

> Testing CRAM against the full Dresden Codex under pre-registered gates (CODEX_CRAM_TEST_PROTOCOL.md). Axioms A1/A2 (zero float, exact integers). Arithmetic layer certified. Score the codex-empirical gates G-ECL-TOTAL, G-ECL-INT, G-VEN-SUB, G-VEN-TOTAL, G-REG, G-RB, G-23 using the evidence classes and the gate format verbatim; hold any unreadable gate OPEN with a named source upgrade rather than guessing. Report PASS / FAIL / OPEN per gate, once, without softening.
