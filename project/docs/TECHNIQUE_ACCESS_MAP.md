# Technique access map

This report covers the main **Resonance Spread** application. An implemented calculation and a reachable experience are different claims: the directory lists real UI destinations, describes their limits, and does not treat exact integer division helpers as completed astrology techniques.

## Navigation contract and verification status

The persistent **Explore techniques** launcher opens a searchable native dialog. Selecting an implemented technique routes to its existing page, scrolls to its actual section and moves keyboard focus to that section. This takes **two navigation actions**: open the directory, then select the technique. Scrolling inside the directory is additional interaction; the two-action metric counts activation of controls, not pointer travel, scrolling or all keystrokes. Typing into the optional search is additional interaction.

A browser acceptance suite is included at `browser-tests/technique-navigation.spec.mjs`. It independently names 20 techniques, exercises them from a cold launch, and tests each from eight app screen states (160 source/destination pairs). It also tests keyboard entry, Escape/focus return, search, a 390-pixel viewport, synastry prerequisites and unknown-time angle withholding. The suite writes the measured navigation matrices to ignored `test-results/technique-access-cold.json` and `test-results/technique-access-screens.json`.

**At report authoring, browser measurement is pending.** The first browser invocation was blocked in a network-permission request needed for the local preview socket and then cancelled. No passing browser result is claimed here until those tests actually run. Syntax checking of the new browser spec and whitespace checks of the patch passed. The intended two-action contract remains a proposed acceptance condition until measured.

The eight main-app start states are birth entry, reading, full spread, Persona, behavioral profile, second-birth entry, synastry results, and Persona’s nested Add birth chart form. The directory’s separate React root keeps its launcher present across these views. A Persona route key ensures selecting a destination exits its nested birth-entry state.

Cold-launch access uses the current saved profile or the existing alpha default birth record. A user who has edited the landing form must cast those edits before navigating; the directory says this explicitly. Navigation itself does not modify dates, coordinates, name, settings or residence chapters. Missing inputs and computation failures are not converted into fabricated results.

## Twenty independently selected techniques

Each listed target is present in an actual user-facing component. Several related calculations share a clearly named section; the table identifies that grouping instead of pretending each has a separate page.

| Technique | Destination page and actual section | Navigation activations | Material limits |
| --- | --- | --- | --- |
| Natal aspects | Full spread → Aspect grid (tightest first) | 2, pending measurement | Configured orb policy; first 12 shown. |
| Essential dignities | Full spread → Essential dignities | 2, pending measurement | Configured dignity tables; not a full almuten figuris. |
| Four angles | Full spread → Four angles | 2, pending measurement | Withheld for unknown birth time; house fallback notices remain applicable. |
| Natal Moon phase | Full spread → Sect · phase · void | 2, pending measurement | Computed natal phase; unknown time introduces uncertainty. |
| Void-of-course Moon | Persona → Traditional details | 2, pending measurement | Classical aspects before sign ingress, with source/fallback notices. |
| Hellenistic Lots | Full spread → Hellenistic lots | 2, pending measurement | Seven Hermetic Lots; selected formulas and sect convention. |
| Antiscia and contra-antiscia | Full spread → Antiscia (solstice-axis mirrors, 1° orb) | 2, pending measurement | Longitude mirror contacts within 1°; explicit empty state. |
| Annual profections | Persona → Annual profection | 2, pending measurement | Annual level; birth time is needed for reliable Ascendant anchoring. |
| Firdaria | Persona → Firdaria · major period | 2, pending measurement | Bonatti major order, 75-year cycle; no subperiod UI. |
| Lunar mansions | Persona → Lunar mansion | 2, pending measurement | 28 equal tropical mansions; not a complete stellar mansion system. |
| Mutual receptions | Persona → Traditional details | 2, pending measurement | Domicile or exaltation; displayed with other traditional details. |
| Prenatal New/Full Moon | Persona → Traditional details | 2, pending measurement | Last lunar syzygy before birth; depends on available ephemeris. |
| Fixed-star conjunctions | Persona → Traditional details | 2, pending measurement | Selected catalogue, longitude-only, 1° orb; precession, no proper motion. |
| Zodiacal releasing | Persona → Traditional details | 2, pending measurement | Level 1 from Fortune and Spirit, 360-day years; levels 2–4 and bonds absent. |
| Solar conditions | Persona → Solar conditions | 2, pending measurement | Configured cazimi, combustion and under-beams separation criteria. |
| Live transits | Persona → Live transits to natal | 2, pending measurement | Minute update; 12 tightest current aspects get a 60-day exact-crossing search. |
| Solar return | Full spread → Return charts · the subject, sampled once a cycle | 2, pending measurement | Computed at natal solar degree; residence on each return date, or birthplace. |
| Lunar return | Full spread → same Return charts section | 2, pending measurement | Computed at natal lunar degree; unknown time makes timing approximate. |
| Secondary progressions | Full spread → Secondary progressions at the target age (one day per year of life) | 2, pending measurement | Configured progressed planets; not complete progressed-angle methods. |
| Eclipses | Full spread → Eclipses · geophysical | 2, pending measurement | Prenatal pair, lifetime contacts, future window; full ephemeris required. |

Additional directory destinations are natal placements/houses, sect, chart shape, element and modality balance, patterns/stelliums/joys, transit perfections, behavioral profile, and synastry. They bring the current catalogue to 29 entries, without counting navigation utilities as techniques.

Synastry has a separate prerequisite: both birth records must be entered. Its directory item opens results when a partner is already entered; otherwise it opens the second-birth form. Reaching that form in two activations is not a claim that computed synastry exists before the second birth is provided. The browser matrix prepares a real second record before using synastry results as a start screen.

## Before the directory

From a cold launch, full-spread sections required casting the chart and opening Full spread, followed by scrolling. Persona required casting then selecting Persona. From a behavioral or Persona page, reaching a spread technique required returning to the reading and opening Full spread, again followed by scrolling. From nested second-birth entry, some destinations required returning through another route first. There was no shared technique inventory or measured all-screen navigation contract. Accessibility tables and chart labels solved a different problem: obtaining readable data once a user had reached the correct screen.

The antiscia section previously vanished when no contacts were found. It now remains present with an explicit no-contact result, so absence of contacts is distinguishable from absence of the technique.

## Boundaries and remaining gaps

- The separately built **HCRM Console**, API Reference, CRAM Calculator and test-harness pages are technical surfaces outside this main-app navigation matrix. Their independent navigation must be measured before claiming a universal two-action contract across every HTML file in the repository.
- Horary judgement, electional search, primary directions, solar arcs, translation and collection of light, full releasing subperiods, and complete sidereal/Jyotish or other non-Western traditions are not implemented user experiences here. They are labelled unavailable in the directory rather than counted toward coverage.
- Configured mathematical divisions or invariant tests are not evidence that a tradition has a full personal-reading workflow. Neither exact integer residues nor successful navigation establish empirically measured personality traits, diagnosis or future events.
- This navigation suite is not a full accessibility conformance audit. It measures destination activation, keyboard focus, native-modal dismissal and narrow-screen behavior. Screen-reader testing, complete contrast checks, zoom/reflow and motor-access evaluation remain separate work.
- The action-count contract assumes a healthy active chart and available implementation. Unknown birth time produces withholding notices. Unavailable ephemeris or invalid records must retain clear errors rather than satisfy the metric with invented values.

## Source ownership

`technique-directory.jsx` owns the catalogue, native modal and validated navigation events. `App` owns the current screen and chart. Actual computed sections remain in `app.jsx` (TraditionalPanel), `persona.jsx`, `live.jsx`, `eclipse-view.jsx`, `behavioral-profile.jsx` and `synastry-view.jsx`. The directory reuses those surfaces; it does not recompute independent copies of their facts.
