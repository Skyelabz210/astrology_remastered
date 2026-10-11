# Persona and astronomy repair

Audited base: `517fc2e647c6f6d6ddf29346f770192a116f3df1` (main, October 2026).

The supplied excerpt describes a different preview layout. This repository has
classic browser JSX scripts and a Node test runner, not TanStack routes or a
TypeScript build. There is no `src/routes/__root.tsx`, and the three newly added
TypeScript modules had no usable build integration. Their new tests imported an
undeclared Vitest dependency from incorrect paths and prevented the full suite
from running. They have been replaced by executable JavaScript modules and
native `run()` suites, following CONTRIBUTING.md. Previously passing assertions
are retained; the new suites validate boundaries, known events and failure modes
instead of preserving incorrect expectations in the unexecutable tests.

## Corrected behavior

- Persona and Moon scripts are actually loaded. No ES exports appear in classic
  JSX scripts, no duplicate global planet tables or React hook bindings exist,
  and the Persona callback reaches the session header.
- Persona honors the current chart, accepts real second birth records, validates
  local storage, reports failed saves, and cleans up its watcher and speech.
  No fabricated planet placements, transits, time lords or reading text remain.
- Geocentric tropical positions come from the existing vendored Astronomy Engine
  2.1.19. Daily speeds are central differences; natal return aspects are retained.
  Actual aspect error, allowed orb, applying/separating phase and stationarity
  have separate meanings. Minor aspects share the natal/transit definitions.
- Transit dates are roots of actual geocentric longitude against fixed natal
  points, on both aspect branches, including retrograde loops. Only the twelve
  tightest aspects are searched over sixty days, with one-second numerical
  stopping tolerance. This is numerical resolution, not a claim of one-second
  astronomical accuracy. Unsearched/unbracketed crossings display a dash.
- Lunar phase preserves directed longitude difference through the waning half
  of the cycle. Illumination, age and next lunar events use Astronomy Engine's
  physical geometry and phase search. The globe uses observer-facing shading;
  New/Full Moon and both quarters render the appropriate illuminated area.
  The lower-level angle-only API explicitly marks its output approximate. BigInt
  illumination fractions are rounded representations, not exact trigonometry.
- Lilly orbs use summed moieties of classical planetary orbs. Declination
  parallels have a separate coordinate API. Classical rulerships, cumulative
  dignity scoring, sect, hayz, firdaria and equal tropical mansions are corrected.
  Almuten in the UI is explicitly the almuten of Sun/Moon/Ascendant, not an
  undocumented claim to full almuten figuris. Tied rulers/elements are retained.
- Firdaria uses the Bonatti major-period order and 75-year cycle. Annual
  profections use completed calendar ages in the birth time zone. Zodiacal
  releasing exposes level 1 for Fortune and Spirit using 360-day Egyptian years;
  it does not invent subperiods or loosing-of-the-bond dates.
- Fixed stars use J2000 equatorial catalogue coordinates precessed to birth date.
  Previously several listed longitudes were wrong by many degrees. Proper motion
  is omitted and the approximation is disclosed. Prenatal syzygy is the most
  recent solved New/Full Moon, replacing a hard-coded birth-minus-15-days result.
- Main chart VOC evaluates the moving Moon against the other six classical
  planets, searching all five Ptolemaic aspects before lunar sign ingress.
  Missing-module/demo fallbacks explicitly identify their snapshot estimate.
- Mean node and mean Lilith positions use mean lunar-element polynomials of
  date. Lilith is the apogee, 180° from perigee. Both lunar nodes now share the
  same longitudinal velocity; opposing position does not reverse velocity.
  Unsupported Chiron is omitted in real charts by default. Explicit synthetic
  demo mode remains available and clearly disclosed. Real ephemeris failures
  raise errors instead of quietly swapping in illustrative planetary positions.
- CRAM lane events use prime identifiers, integer residues, winding quotients
  and the requested observation timestamp. Their default boundary tolerance is
  zero, after rounding arcseconds, with a separate one-degree aspect gate. These
  are mathematical register events, not evidence of physical resonance. A
  future timeline requires a position sampler rather than repeating a snapshot.
- Unknown birth times suppress angles and sect-dependent time lords. Solar
  conditions and angular Moon calculations still carry birth-time uncertainty.
  Mobile layout and table overflow are covered in browser tests.

## Verification

Run from `project/`:

```sh
npm ci
npm test
npm run lint
npm run test:accuracy
node tools/validate-ledgers.mjs
npm run build
npx playwright install chromium
npm run test:browser
```

Run `node scripts/check-claims.mjs` at the repository root to verify the live
banner. Browser tests cover actual navigation, Moon/Earth switching, Persona
transits, adding/removing/persisting charts, reading generation, mobile layout,
residence-aware run history, admitted ledgers and the HCRM console. A separate
Sydney profile exports its real Porphyry chart and reading as a ZIP; the test
checks user isolation and opens the offline report. CI builds both pages and
runs those browser tests.
New calculations are outside `src/core`; its BigInt-only audit and exhaustive
1,296,000-position ring sweep remain mandatory.

## Scope and limits

This repair does not certify every theoretical claim in CRAM papers or prove
superiority over all other astrology software. Astronomical accuracy follows
the installed engine and its model; astrological conventions vary by school.
No true/osculating nodes, Chiron ephemeris, proper-motion stellar catalogue,
full almuten figuris, multilevel zodiacal releasing, or full horary adjudication
of translation/collection of light is included. The code does not manufacture
results for those missing inputs or techniques.

Open issue #45's six-prime basis, modulus, lane arithmetic and K-Elimination
have existing implementations and automated coverage. Its broader physics and
proof claims are not established by application tests; the issue was not closed
on that basis. The router error quoted in the request can only be checked in
the other preview's source because that file does not exist here.
