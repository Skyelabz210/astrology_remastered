# Technique access map

This report covers the main **Resonance Spread** application. An implemented calculation and a reachable experience are different claims: the directory lists real UI destinations, describes their limits, and does not treat exact integer division helpers as completed astrology techniques.

## Navigation contract and verification status

The persistent **Explore techniques** launcher opens a searchable native dialog. Selecting an implemented technique routes to its existing page, scrolls to its actual section and moves keyboard focus to that section. This takes **two navigation actions**: open the directory, then select the technique. Scrolling inside the directory is additional interaction; the two-action metric counts activation of controls, not pointer travel, scrolling or all keystrokes. Typing into the optional search is additional interaction.

A browser acceptance suite is included at `browser-tests/technique-navigation.spec.mjs`. It independently names 20 techniques, exercises them from a cold launch, and tests each from eight app screen states (160 source/destination pairs). It also tests keyboard entry, Escape/focus return, search, a 390-pixel viewport, synastry prerequisites and unknown-time angle withholding. The suite writes the measured navigation matrices to ignored `test-results/technique-access-cold.json` and `test-results/technique-access-screens.json`.

**Measured on 2026-10-15:** all 20 cold-launch destinations and all 160 source/destination pairs passed in Chromium. Each required two navigation activations and focused its real computed section. The JSON matrices were written to `test-results/technique-access-cold.json` and `test-results/technique-access-screens.json`. The broader browser suite separately checks privacy, ownership, exports and provider behavior; its final CI result is recorded on the release PR.

The eight main-app start states are birth entry, reading, full spread, Persona, behavioral profile, second-birth entry, synastry results, and Persona’s nested Add birth chart form. The directory’s separate React root keeps its launcher present across these views. A Persona route key ensures selecting a destination exits its nested birth-entry state.

Cold-launch access uses the current saved profile or the existing alpha default birth record. A user who has edited the landing form must cast those edits before navigating; the directory says this explicitly. Navigation itself does not modify dates, coordinates, name, settings or residence chapters. Missing inputs and computation failures are not converted into fabricated results.

## Twenty independently selected techniques

Each listed target is present in an actual user-facing component. Several related calculations share a clearly named section; the table identifies that grouping instead of pretending each has a separate page.

| Technique | Destination page and actual section | Navigation activations | Material limits |
| --- | --- | --- | --- |
| Natal aspects | Full spread → Aspect grid (tightest first) | 2, measured | Configured orb policy; first 12 shown. |
| Essential dignities | Full spread → Essential dignities | 2, measured | Configured dignity tables; not a full almuten figuris. |
| Four angles | Full spread → Four angles | 2, measured | Withheld for unknown birth time; house fallback notices remain applicable. |
| Natal Moon phase | Full spread → Sect · phase · void | 2, measured | Computed natal phase; unknown time introduces uncertainty. |
| Void-of-course Moon | Persona → Traditional details | 2, measured | Classical aspects before sign ingress, with source/fallback notices. |
| Hellenistic Lots | Full spread → Hellenistic lots | 2, measured | Seven Hermetic Lots; selected formulas and sect convention. |
| Antiscia and contra-antiscia | Full spread → Antiscia (solstice-axis mirrors, 1° orb) | 2, measured | Longitude mirror contacts within 1°; explicit empty state. |
| Annual profections | Persona → Annual profection | 2, measured | Annual level; birth time is needed for reliable Ascendant anchoring. |
| Firdaria | Persona → Firdaria · major period | 2, measured | Bonatti major order, 75-year cycle; no subperiod UI. |
| Lunar mansions | Persona → Lunar mansion | 2, measured | 28 equal tropical mansions; not a complete stellar mansion system. |
| Mutual receptions | Persona → Traditional details | 2, measured | Domicile or exaltation; displayed with other traditional details. |
| Prenatal New/Full Moon | Persona → Traditional details | 2, measured | Last lunar syzygy before birth; depends on available ephemeris. |
| Fixed-star conjunctions | Persona → Traditional details | 2, measured | Selected catalogue, longitude-only, 1° orb; precession, no proper motion. |
| Zodiacal releasing | Persona → Traditional details | 2, measured | Level 1 from Fortune and Spirit, 360-day years; levels 2–4 and bonds absent. |
| Solar conditions | Persona → Solar conditions | 2, measured | Configured cazimi, combustion and under-beams separation criteria. |
| Live transits | Persona → Live transits to natal | 2, measured | Minute update; 12 tightest current aspects get a 60-day exact-crossing search. |
| Solar return | Full spread → Return charts · the subject, sampled once a cycle | 2, measured | Computed at natal solar degree; residence on each return date, or birthplace. |
| Lunar return | Full spread → same Return charts section | 2, measured | Computed at natal lunar degree; unknown time makes timing approximate. |
| Secondary progressions | Full spread → Secondary progressions at the target age (one day per year of life) | 2, measured | Configured progressed planets; not complete progressed-angle methods. |
| Eclipses | Full spread → Eclipses · geophysical | 2, measured | Prenatal pair, lifetime contacts, future window; full ephemeris required. |

Additional directory destinations are natal placements/houses, sect, chart shape, element and modality balance, patterns/stelliums/joys, transit perfections, behavioral profile, and synastry. Four new destinations—Jyotisha, Mayan calendars, Celestial souvenir and Chart consultant—open the integrated behavioral page and bring the catalogue to 33 entries. They are exercised by the evolution browser suite; the independent two-action matrix remains the 20-technique set above. Navigation utilities are not counted as techniques.

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
