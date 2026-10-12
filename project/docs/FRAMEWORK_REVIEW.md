# Framework review and release 2026.10 / v1.0.0

The supplied *Astrology Remastered Framework: An Architectural and Theoretical
Guide to Exact-Integer Astrological Computation* was compared with the repository
and its calculation tests. It is a theoretical guide, not an independent
reference ephemeris or a validated assessment of personality.

| Guide claim | Verified boundary or correction |
| --- | --- |
| Ring of 1,296,000 integer arcseconds; `src/core` excludes floats | Preserved and tested exhaustively. Numerical ephemeris positions are rounded before integer residue operations. Integer arithmetic cannot remove error already present in an astronomical input. |
| Eight-prime product versus canonical shell | The full S8 product is 9,699,690. The canonical seven-prime shell is 881,790, with parked anchor 11. These are different products. |
| Exact closure proves harmonious or chaotic behavior | Integer divisibility and quantization remainders are mathematical facts; their psychological or physical significance is unvalidated. Non-integral subdivisions can also be represented as rational angles. |
| Orbs compensate for floating-point error | Orbs are interpretive angular tolerances. They are much larger than ordinary floating-point error. The app retains explicit aspect conventions and numerical crossing searches. |
| Every astrological calculation and lunar illumination is BigInt-exact | The exact register is BigInt. Astronomy, lunar illumination, houses, timing searches, and much of the traditional presentation use numerical calculations outside the core. Illumination is not an exact rational output of the ring. |
| Firdaria order depends on birth weekday | This implementation uses day/night sect and the documented Bonatti order; a weekday is not the ordering rule. Unknown-time sect-dependent results are withheld. |
| Zodiacal releasing supplies levels L1–L4 and all bond events | The implemented convention is level 1 with 360-day Egyptian years. Full subperiods and bond-event handling remain future work. |
| Mercury falls in Scorpio | Mercury's traditional fall is Pisces; Scorpio is not its fall. Computed dignity tables take precedence over the example narrative. |
| A Jupiterian almuten and Sun above the horizon prove full hayz | Essential-point scoring is not a complete almuten figuris or lord-of-geniture calculation. Hayz requires additional planet/hemisphere/sect conditions. |
| Structural resonance proves fated events or unconscious friction | Residues and carries describe mathematical operations. They do not establish fate, a diagnosis, or an empirically measured behavioral trait. |
| An admitted ledger certifies physical truth | Admission verifies the declared integer data contract and certificate category. External reference fixtures and astronomical model limits still matter. |

The release therefore adds an explicitly astrological behavioral reflection,
with each section anchored to an actual computed planet/sign. Unknown birth
time marks the Moon's uncertainty. OpenRouter expansion receives the calculated
chart, a PNG representation, and the frozen personal reading context. Generated
text is checked against the chart; unsupported explicit placements, houses, or
aspects are rejected, with one repair attempt. This check does not prove the
psychological interpretation or catch every possible misleading prose claim.

## Interaction and interpreter changes

- Removed the splash's `Resonance` wordmark (the reported “Residence” label).
  A phosphorescent phase icon sits above the interactive birthplace globe and
  refreshes each minute using Astronomy Engine lunar geometry. The detailed
  Moon globe remains available through its toggle.
- Added a native calendar and pointer/keyboard/wheel birth controls. The native
  selects remain available for precise entry. Leap days and unknown-time
  disabling retain the existing validation path. Birth years start at 1800.
- Earth dragging adjusts longitude and latitude viewing direction; city pins
  and the canonical list commit coordinates and an IANA time zone. A drag
  does not silently select the nearest city. Alias and typo matching suggest
  registry entries without accepting arbitrary misspelled coordinates. Saved
  historical aliases are normalized; an unknown saved birthplace blocks casting
  rather than substituting San Antonio. A conflicting residence region is
  rejected instead of borrowing coordinates from the named city elsewhere.
- Removed random zodiac stencils from the location globe. The reading's zodiac,
  planetary, and aspect glyphs are recognizable standard symbols. Card tooltips
  and the behavioral page's guide identify their meaning.
- OpenRouter uses a live catalogue of zero-price, image-capable models from
  known open-weight model families. Both token prices must be explicitly zero,
  the ID must be a `:free` variant, and requests disallow paid provider fallback.
  Free-model availability, licenses, quotas and provider policies can change.
- Users enter their own key in interpreter settings. It remains in memory,
  clears from the input after connection, and never enters calculation inputs,
  history, ZIPs, or repository files. Reload requires reconnecting. Requests are
  serialized, have a 45-second timeout, and queued work is cancelled when AI
  permission is withdrawn. Already transmitted data cannot be recalled.
- The Behavioral profile page provides five local domains and an optional
  chart-checked multimodal expansion. Both are stored with their user's birth
  record and calculation evidence and exported with the user's saved runs.
- A shared release/version stamp appears on all seven source pages, both built
  apps, calculation input snapshots, offline reports, and ZIP manifests.

## Remaining gaps

See [FULL_APP_AUDIT.md](FULL_APP_AUDIT.md) for the complete calculation inventory.
True-node/Lilith and Chiron ephemerides, fuller time-lord subperiods, complete
sidereal/Vedic and other traditions, a wider fixed-star catalogue, composite
charts, primary/solar-arc directions, and fully validated horary remain open.
The city registry is curated, not a worldwide geocoder or street-address
selector. It should be expanded with verified coordinates, name aliases, and
historical time-zone fixtures as users request locations.

Personal profiles and the latest 50 calculation runs are browser-local. There
is no authenticated cross-device account or hosted personal-site backend;
exports provide portable snapshots. The OpenRouter integration is exercised
with mocked catalogue/completion responses, including images, fact checks,
quota failure, and permission withdrawal. A user's live key and provider quota
must be verified in their own browser; no key is needed for local readings.
