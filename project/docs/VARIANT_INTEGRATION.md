# HCRM-Formal and Prime Resonance integration

Release 2026.10 · v1.2.0 combines selected compatible features with Astrology Remastered's existing calculation, ownership and reading contracts. This is a reviewed adaptation, not a merge of two unrelated application roots or a claim that all three apps are equivalent.

## Reviewed sources

| Variant | Reviewed revision | Relevant source |
| --- | --- | --- |
| [Prime Resonance](https://github.com/Skyelabz210/prime-resonance) | `8e544954b41321277bd9b12b882ddc00adf446e1` | `src/lib/qmnf/`, `src/features/resonance-reading-theatre/` |
| [HCRM-Formal / Celestial Registry](https://github.com/Skyelabz210/hcrm-formal) | `51088cae5a3bf7f6f8bdeba623e94143067ec253` | `src/core/`, `src/cram/`, `src/astro/`, calculator/proofs/Persona routes |

The owner explicitly authorized publishing selected compatible adaptations from the private HCRM-Formal repository. Original credentials, service configuration, database integrations and private data were not copied. The mathematical and visual concepts are attributed to those variants; the adapters below use this repository's established core and ephemeris.

## Integrated capabilities

| Capability | Destination and implementation | Calculation contract |
| --- | --- | --- |
| Celestial Registry residue/decomposition inspector | Explore techniques → Exact register inspector; `variant-lab.jsx`, `src/present/register-inspector.js` | The personal inspector starts from a chart-matched admitted ephemeris record and exposes all eight residues, canonical parked-shell winding, double lift and retained legacy gear split. A separate sandbox accepts signed integers and pairwise-coprime composite or prime moduli, reconstructs by direct CRT, shows centered transport, and checks every individual shell/anchor quotient. |
| Prime Resonance midpoint composite | Explore techniques → Composite relationship chart after entering a partner; `src/astro/variant-calculations.js`, `synastry-view.jsx` | Symmetric short-arc midpoints of ten whole-arcsecond natal coordinates, stored as rational half-arcseconds. Exact antipodes are ambiguous and withheld. Ptolemaic contacts use a 1° orb. No invented epoch, houses, retrograde flag, applying/separating phase or physical certificate. |
| Prime Resonance solar-arc directions | Explore techniques → Solar-arc directions; behavioral domain reflections, shared reading context, keepsakes | True solar arc uses the real apparent progressed Sun at one ephemeris day per 365.25-day year. The alternative defines a Naibod key of 59′08.33″ per year and evaluates it rationally before rounding. The same arc shifts each of ten natal coordinates; contacts are directed-to-natal within 1°. Supported ages: birth through 200 years. |
| Prime Resonance planetary stations | Explore techniques → Planetary stations | Mercury–Pluto apparent longitude speed from Astronomy Engine; central differences ±0.005 day, daily brackets and root refinement to a bracket no wider than one second. The search spans at most 366 days, includes its start and excludes its end. This tolerance is numerical, not physical timing accuracy. |
| Prime Resonance theatre views | Existing card → Chart geometry and exact lanes; `prime-theatre.jsx` | Previously adapted aspect geometry, house-depth arc and depth-phase views retain admitted local data and geometric fractions. |

All four new destinations are in the persistent technique directory. Unknown birth time withholds precise composite, directed and admitted natal register outputs; the independent mathematical sandbox and geocentric station search remain available.

## Personal reading and retention

The frozen personal context computes the true solar arc alongside natal, transit, progression, residence, traditional and behavioral evidence. The five behavioral domains receive an owned solar-arc reflection and contacts to their natal principal. These stay distinct from current transits and from self-reported observations. Keepsakes include that reflection. Disagreeing with an interpretation continues to earn the same participation credit as agreement; the integration adds no personality or compatibility score.

Register inspections, each solar-arc method and each station window create distinct owned calculation runs containing their actual parameters and results. The existing 50-run browser retention cap applies. Their source context and results are included in private ZIP exports. Mathematical sandbox inputs do not alter the natal chart, avatar or reading history. Composite results are retained inside the relationship run with both birth records, separate from natal history. Stale station searches cannot save after switching profiles or leaving the page.

The local reading includes the computed symbolic direction. Existing AI prose validation continues to cover natal and supported transit claims; the expanded behavioral AI prompt excludes the constructed-direction block until a dedicated directed-chart prose validator exists. The source-linked consultant still cites admitted natal facts. This avoids presenting a directed position as a natal or current astronomical placement.

## Corrections and exclusions

* Prime Resonance's midpoint formula can return 180° for 350° and 10° in one order, and 0° in the reverse order. The adapter uses the signed short arc and tests symmetry across the ring. Odd arcsecond sums are not truncated.
* Its Naibod constant is rounded to 3548″ while described as exact. This adapter declares the selected 3548.33″ key explicitly. A conventional direction key is not an observed solar speed.
* Its station search returns a sampled day at a sign change of forward daily displacement. The adapter refines a centered-speed zero crossing and validates bounded steps and intervals.
* HCRM-Formal's `HCRM_REGISTER_V1` uses the older 30,030 shell. Replacing this app's `HCRM_REGISTER_V2` would regress the canonical parked lane and double lift. The inspector compares the two valid splits through the existing core instead.
* HCRM-Formal's centered recombinant states carry winding explicitly; this app's parked register derives it from the tray. Centered transport is available as an independently labeled mathematical view, without replacing the canonical register.
* Runtime arithmetic sweeps and theorem labels are not imported as verified Lean proof artifacts. The new inspector reports the actual arithmetic and scope of its checks. No Lean source or build was found in the reviewed HCRM-Formal snapshot.
* HCRM-Formal's mean-motion sky, Prime Resonance's truncated orbital model/correction atlas and approximate Chiron are not imported. Current real ten-body positions and disclosed unsupported-body limits remain authoritative.
* Existing sign/house/aspect, dignity, Lots, antiscia, return, progression, sidereal division and calendar capabilities are reconciled through current implementations rather than duplicated. Symbolic prime and calendar identities do not establish psychological traits or prove astronomical period claims.
* Davison remains open: the reviewed implementation computes a midpoint date but does not implement its advertised spatial midpoint. A future adapter needs an explicit geographic midpoint/antipode convention and independently tested houses before becoming a personal reading surface.
* Supabase accounts, Lovable AI gateway, remote MCP endpoints, simulated narration timing and uncalibrated confidence vectors do not fit this standalone, local-first app and were not copied. A pixel-identical full theatre port and word-level audio scrubbing remain separate roadmap work.

## Verification

`test/present/variant-integration.test.js` checks midpoint symmetry/wrapping/half-arcseconds, antipodal uncertainty, true and Naibod directions, behavioral ownership, synthetic root refinement, independently dated March/April 2025 Mercury stations, signed large-integer round trips, unsafe bases and admitted chart matching. Browser tests exercise all four destinations, both direction methods, sandbox errors, station saving, relationship ownership, unknown-time withholding, a 390-pixel viewport and exported calculation contents. Full native, accuracy, lint, type, schema, catalogue, build and browser results are recorded with the release PR.
