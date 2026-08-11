# UX validation checklist — WP-19

Twelve input/error scenarios, what the user now sees for each, where it is
handled in code, and how it was verified. "Verified: LIVE" means exercised
through real, running code (Node unit tests against the actual modules, or a
Node + real React + `react-dom/server` harness that renders the actual
components with the actual `validate.js`/`houses.js` imports — see
"Verification method" below). "Verified: TRACED" means confirmed by reading
the final code path end-to-end (and, where noted, confirming the file
transpiles cleanly with `@babel/core`) rather than exercising it — this
sandbox has no browser, so DOM interaction (typing into a field, clicking a
button, watching `onChange` fire) could not be driven directly. Every scenario
below states which parts are which; several combine both (the underlying
logic is LIVE-tested, the screen wiring is TRACED).

## Verification method

1. **Node unit tests** — `project/test/validate.test.js` (49 assertions,
   registered automatically by `test/run.js`'s auto-discovery) exercises
   `project/validate.js`'s `isValidCalendarDate`, `validateLatitude`,
   `validateLongitude`, and `polarHouseWarning` directly, including
   `polarHouseWarning` against the REAL `POLAR_FALLBACK_POLICY` imported
   straight from `project/tools/ephemeris/houses.js` (not a hand-copied
   duplicate table — see `validate.js`'s module header).
2. **React rendering harness** (ad-hoc, not part of the committed test suite —
   lives only in the session's scratchpad) — transpiles the actual
   `ChartStatusBanners` function extracted from `app.jsx` and the actual
   `errors.jsx` source with `@babel/core`'s `preset-react`, runs the result in
   a `node:vm` sandbox with the real `react` package, and renders it with
   `react-dom/server`'s `renderToStaticMarkup` under different `window` mocks
   (`EPHEMERIS_MODE`, `Validate`, `HousesPolicy`, `dstNote`, `chart.timeUnknown`,
   pushed error banners). This proved 14/14 checks pass: the SYNTHETIC badge,
   the polar-latitude warning (using the real policy table), the DST note,
   the unknown-time note, the error banner, and `ErrorBoundary`'s
   `getDerivedStateFromError`/`render()` contract all produce the expected
   markup from the real component code — not simulated expectations.
   Caveat: `react-dom/server`'s legacy synchronous `renderToStaticMarkup`
   does not run React's error-boundary *catching* mechanism (only the newer
   streaming SSR APIs do — confirmed directly by reproducing the same
   limitation with a textbook error boundary, unrelated to this package's
   code); that catching itself is React's own client-side reconciler
   behavior (`ReactDOM.createRoot(...).render()`, exactly what `app.jsx`'s
   last line calls), not custom code, so it was not separately re-verified.
3. **Babel syntax check** — every touched `.jsx` file
   (`app.jsx`, `landing.jsx`, `errors.jsx`, `hcrm-app.jsx`) was transformed
   with `@babel/core` + `preset-react` and confirmed to compile with no
   syntax errors.
4. **Code tracing** — for structural guarantees (e.g. "the Day picker cannot
   offer day 30 for February") and for full end-to-end click-through
   (landing form submit → tzresolve.js → app.jsx state → rendered banner),
   confirmed by reading the actual code path, since no browser is available
   in this sandbox to click through it live.

---

### 1. Invalid date entered (Feb 30, day 32, month 13, …)

**What the user sees:** In `landing.jsx`'s form (the primary entry point,
used for the main chart, the partner/synastry flow, and the HCRM console),
this is structurally impossible: the Day picker's option list is generated
from `daysInMonth = new Date(year, month, 0).getDate()` — leap-year aware —
so a bad combination can never be *selected*, only avoided. As a defensive
second layer (in case `initial` hands the form a stale day before the
`daysInMonth`-correction effect runs), `submit()` re-validates with
`Validate.isValidCalendarDate` and shows `"<Month> <day>, <year> is not a
real calendar date."` inline (`.lf-err`, red-amber text under the date
fieldset) instead of proceeding.
In `app.jsx`'s advanced "Tweaks" panel, the one genuinely free-entry date
field (`<input type="date">`) is validated the same way in `setDate()`,
showing `"<value> is not a real calendar date."` inline (`.tw-err`) and
leaving the chart's actual date unchanged until corrected.

**Where handled:** `project/validate.js` `isValidCalendarDate()` · called
from `project/landing.jsx` (`Landing` → `submit`) and `project/app.jsx`
(`NatalTweaks` → `setDate`).

**Verified:** LIVE (validator: 14 date assertions in
`test/validate.test.js`, including Feb 30, day 32, month 13, month/day 0,
leap-year edge cases 1900/2000/2020/2021/2024, and a full 2024
every-day-of-every-month sweep). Screen wiring: TRACED + babel-clean.

---

### 2. Out-of-range latitude (outside [-90, 90])

**What the user sees:** In `app.jsx`'s Tweaks panel, latitude now has a
paired slider (full -90..90 range, see scenario 4 below for why the old ±66°
clamp is gone) **and** a free-entry text field. Typing a non-numeric value
(`"abc"`) or an out-of-range value (`91`, `-200`) shows
`"Latitude must be a number."` / `"Latitude must be between -90 and 90
degrees."` inline (`.tw-err`, `.tw-inp-invalid` red border) and does **not**
change the chart's actual latitude — the last valid value stays in effect
until the field validates again.

**Where handled:** `project/validate.js` `validateLatitude()` · called from
`project/app.jsx` (`LatLngTweak` component, used twice in `NatalTweaks`).

**Verified:** LIVE — 13 assertions in `test/validate.test.js` (boundary
values ±90 exactly valid, ±90.0001 rejected, non-numeric, empty string,
NaN, Infinity, numeric strings with whitespace/degree-sign tolerated).
Field wiring: TRACED + babel-clean.

---

### 3. Out-of-range longitude (outside [-180, 180])

**What the user sees:** Same mechanism as scenario 2, mirrored for
longitude: `"Longitude must be a number."` / `"Longitude must be between
-180 and 180 degrees."` inline, chart unchanged until corrected.

**Where handled:** `project/validate.js` `validateLongitude()` · called from
`project/app.jsx` (`LatLngTweak`).

**Verified:** LIVE — 7 assertions in `test/validate.test.js`. Field wiring:
TRACED + babel-clean.

---

### 4. Polar latitude with an incompatible house system selected

**What the user sees, and an important honest caveat:** `app.jsx`'s house
system picker (`NatalTweaks` → `TweakRadio label="House system"`) currently
offers only **Whole** and **Equal** — the two systems `astro.jsx` (owned by
a different, concurrently-running package; out of scope to touch here)
actually computes. Neither Whole nor Equal appears in
`houses.js`'s `POLAR_FALLBACK_POLICY` table at all, because neither ever
breaks down at any latitude (Whole Sign in particular is the documented
fallback for every quadrant system that does). **This means the
polar-latitude warning banner cannot currently be triggered through any
reachable path in the shipped UI** — there is no way to select a house
system this package's warning would flag.

What WAS built, and genuinely works: the ±66° silent latitude clamp is
removed (`TweakSlider`'s `min`/`max` for latitude are now -90/90, the true
polar range — previously `min={-66} max={66}`, silently making entry of any
higher latitude impossible). The warning function itself,
`polarHouseWarning(latDeg, houseSystemKey, policyTable)`, is wired to the
REAL `POLAR_FALLBACK_POLICY` object (published by a small, additive
`window.HousesPolicy` export added to `houses.js` for this package,
mirroring `tzresolve.js`'s `window.TzResolve` pattern), and is proven
correct against every entry in that table — for `placidus`/`koch`/
`alcabitius` (`enforced: "hard"`) it says the house cusps are *undefined*;
for `regiomontanus`/`campanus`/`topocentric` (`enforced: "soft"`) it says
*unreliable*, honoring the same hard/soft distinction `houses.js`'s own
comments draw. `ChartStatusBanners` (`app.jsx`) / `HcrmStatusBanners`
(`hcrm-app.jsx`) render it the moment `settings.houseSystem` names a system
in the table — the wiring will light up automatically if/when a future
package extends both the house-system picker and `astro.jsx`'s computation
to the quadrant systems (a change this package deliberately did not make,
since it requires touching `astro.jsx`, off-limits here).

**Where handled:** `project/tools/ephemeris/houses.js` (`POLAR_FALLBACK_POLICY`,
`window.HousesPolicy` export) · `project/validate.js` `polarHouseWarning()`
· `project/app.jsx` (`ChartStatusBanners`, `LatLngTweak`'s slider range) ·
`project/hcrm-app.jsx` (`HcrmStatusBanners`).

**Verified:** LIVE for the function itself — 12 assertions in
`test/validate.test.js` against the real policy table (including an exact
boundary check at 66.56°N and a sweep confirming every hard/soft entry
warns just past its own `validLatRange`), plus the React harness rendering
`ChartStatusBanners({settings:{lat:70,houseSystem:"placidus"}})` and
confirming the output text names Placidus and Whole Sign. Reachability
through the shipped picker: TRACED, and honestly documented above as
currently unreachable.

---

### 5. DST-nonexistent local time (spring-forward gap)

**What the user sees:** Unchanged from WP-18 for the resolution itself
(the earlier note — `dstNote` — was computed but only carried on the
`onCast` payload, never displayed). Now: after casting a chart whose local
birth time fell inside a spring-forward gap, a banner appears at the top of
the chart screen reading e.g. `"02:30 did not exist that day at Chicago
(spring-forward) — used the nearest valid time after the jump."` — the exact
string `landing.jsx` already built from `tzresolve.js`'s `nearestValid[1]`.

**Where handled:** `project/tzresolve.js` `resolveUtcInstant()` (`kind:
"nonexistent"`, unchanged, pre-existing WP-18) · `project/landing.jsx`
(`submit`, builds `dstNote`, unchanged) · `project/app.jsx` (`App`'s new
`dstNote` state, set in `onCast`, threaded to `SessionScreen`/`Spread`/
`SynastryScreen` → `ChartStatusBanners`) · `project/hcrm-app.jsx`
(`birth.dstNote`, set in `onCast` → `HcrmStatusBanners`).

**Verified:** LIVE for the resolver (`test/tzresolve.test.js`, 24/24,
pre-existing, unchanged, includes the exact NY 2021-03-14 02:30
spring-forward case) and for the banner rendering (React harness: a
`dstNote` string is rendered verbatim). Full click-through (landing submit
→ app state → visible banner) TRACED.

---

### 6. DST-ambiguous local time (fall-back repeat)

**What the user sees:** Same mechanism as scenario 5: a banner reading e.g.
`"01:30 occurred twice that day at Chicago (fall-back) — used the earlier of
the two."`

**Where handled:** Same as scenario 5, `kind: "ambiguous"` branch.

**Verified:** LIVE for the resolver (`test/tzresolve.test.js`'s NY
2021-11-07 01:30 case) and the banner rendering (same harness path as
scenario 5). Click-through: TRACED.

---

### 7. Unknown birth time

**What the user sees:** The "Time unknown" checkbox and its hint text in
`landing.jsx` are unchanged (pre-existing WP-18 UI). New in this package:
once the chart is cast, a banner now appears on the chart screen —
`"Birth time unknown — positions computed for 12:00 local. Ascendant,
Midheaven, houses, and the Moon's exact degree are not reliable on this
chart."` — reading the `chart.timeUnknown` flag `astro.jsx` already sets
(unchanged, pre-existing; this package only added the display).

**Where handled:** `project/landing.jsx` (checkbox, unchanged) ·
`astro.jsx`'s `computeNatal()` → `chart.timeUnknown` (unchanged, not
touched by this package) · `project/app.jsx` (`ChartStatusBanners`) ·
`project/hcrm-app.jsx` (`HcrmStatusBanners`).

**Verified:** LIVE — React harness confirms `ChartStatusBanners({chart:
{timeUnknown: true}})` renders the note. Checkbox behavior: TRACED
(unchanged code).

---

### 8. Offline / vendor ephemeris script failed to load (SYNTHETIC mode)

**What the user sees:** A neutral, non-alarming badge at the top of every
chart screen: `"Offline / synthetic ephemeris — planetary positions come
from the built-in mean-motion model, not the verified astronomy-engine
vendor data. Expect lower precision (typically a few arcminutes to roughly
a degree)."` This reads `window.EPHEMERIS_MODE` (set unconditionally by
`astro.jsx`, unchanged, pre-existing WP-17) **fresh on every render**, not
once at module load — `ChartStatusBanners`/`HcrmStatusBanners` are plain
function components that re-evaluate the check on each render, satisfying
the brief's requirement that this be checked at chart-render time.

**Where handled:** `astro.jsx` (`window.EPHEMERIS_MODE`, unchanged, not
touched by this package) · `project/app.jsx` (`ChartStatusBanners`) ·
`project/hcrm-app.jsx` (`HcrmStatusBanners`).

**Verified:** LIVE — React harness renders the badge when the mock
`window.EPHEMERIS_MODE === "SYNTHETIC"` and confirms it is absent when
`"REAL"`. `test/astro-ephemeris.test.js` (pre-existing, unchanged, 67/67)
separately confirms `astro.jsx` itself sets the flag correctly in both the
vendor-present and vendor-absent sandboxes.

---

### 9. Empty / no city selected

**What the user sees:** This cannot happen. `landing.jsx`'s `place` state
initializes to `DEFAULT_CITY_KEY` (San Antonio · TX) and the
`SearchablePicker` only ever changes it via an explicit `commit(o)` call on
a real, listed option — typing into the search box filters a `query` string
that is entirely separate from the committed `place`, and closing/blurring
without picking an option leaves `place` exactly as it was. There is no code
path that sets `place` to an empty or invalid value.

**Where handled:** `project/landing.jsx` (`Landing`'s `place` state,
`SearchablePicker`'s `commit`).

**Verified:** TRACED (structural guarantee — no test was written because
there is no invalid state to construct; the guarantee comes from `place`
only ever being written by `commit(o)`, which requires `o` to be a member
of the `CITIES` array).

---

### 10. Future date far beyond reasonable range

**What the user sees:** In `landing.jsx`'s primary form, this cannot happen
either: the Year picker's option list is `for (let y = 1950; y <= 
currentYear; y++)`, so no year beyond the current one is ever offered.
In `app.jsx`'s advanced free-entry date tweak, there is intentionally no
upper bound — any real calendar date validates, including far-future ones —
this package did not add a hard block there, treating it as an
expert/advanced control rather than a user-facing input needing a
reasonableness clamp (unlike scenarios 1-3, nothing in the brief asked for
a *range* restriction on dates, only real-calendar validity).

**Where handled:** `project/landing.jsx` (`Landing`'s `years` array).

**Verified:** TRACED.

---

### 11. Historic date (pre-1900)

**What the user sees:** `landing.jsx`'s Year picker starts at 1950, so
**no date before 1950** (not just before 1900) is enterable through the
primary form at all — a stricter bound than the scenario asks about.
`app.jsx`'s free-entry date tweak has no lower bound and correctly validates
historic dates, including historic leap years (e.g. 1600-02-29 is valid,
1900-02-29 is correctly rejected — 1900 is divisible by 100 but not 400, so
it is NOT a leap year under the Gregorian rule, and `isValidCalendarDate`
gets this right via its `Date.UTC` round-trip).

**Where handled:** `project/landing.jsx` (`years` array, lower-bounds to
1950) · `project/validate.js` `isValidCalendarDate()` (no lower bound,
correct for any year including pre-1900).

**Verified:** LIVE — `test/validate.test.js` explicitly checks 1900-02-29
(invalid) and 1600-02-29 (valid, divisible by 400). Landing.jsx's 1950
floor: TRACED.

---

### 12. Chart-computation exception (forced error)

**What the user sees:** Previously: nothing — a bare, generic "substrate
failed to resolve" / "chart unresolved" message with zero detail about why,
because the `catch` block did `console.error(e); return null`. Now: the
same fallback screen additionally shows a dismissible banner with the
**real caught error's message** (e.g. `"natal chart: <the actual thrown
Error's .message>"`), so a genuine bug or bad input state is diagnosable
from the UI instead of silently invisible. Separately, if a component
*renders* incorrectly (a bug in a downstream presentational component, not
a caught `try`/`catch`), the render-time `ErrorBoundary` (wrapping every
screen via `app.jsx`'s `Boundary` / `hcrm-app.jsx`'s `HBoundary`) shows a
titled fallback card with the real error message and a "reset" button,
instead of a blank white screen.

**Where handled:** `project/errors.jsx` (`ErrorBoundary`, `useErrorBanner`,
`ErrorBanner`) · `project/app.jsx` — all four `try { computeNatal(...) }
catch (e) { ... }` blocks (`SynastryScreen`'s `chartA`/`chartB`,
`SessionScreen`, `Spread`) now call `pushError(e, context)` instead of
`console.error(e); return null` (the `return null` still happens, but the
error is no longer discarded) · `project/hcrm-app.jsx` (`HCRMApp`'s chart
`useMemo`, same change).

**Verified:** LIVE for both mechanisms via the React harness: `ErrorBanner`
rendered with a pushed `{message: "computeNatal is not defined", context:
"natal chart"}` shows both strings; `ErrorBoundary.getDerivedStateFromError`
+ `.render()` correctly turn a forced `Error("forced render-time
failure")` into the visible fallback card. **Not** live-verified: actually
forcing `computeNatal()` itself (defined in `astro.jsx`, off-limits to this
package, owned by a concurrently-running package) to throw inside a real
running app — that would require either editing `astro.jsx` or a live
browser session, neither available here. The `try`/`catch`/`pushError`
wiring around it was instead TRACED: it catches ANY exception thrown
anywhere inside the `try` block, regardless of cause, by ordinary
JavaScript `try`/`catch` semantics — nothing about `computeNatal`'s
specific implementation matters to whether the catch fires.

---

## Test counts

- Baseline before this package: **4137/4137** assertions (`npm test`,
  full), 4136/4136 (`--quick`).
- After this package: **4186/4186** (full), 4185/4185 (`--quick`) — +49
  from the new `project/test/validate.test.js` (auto-discovered, no `run.js`
  edit needed).
- Verified isolated (this package's diff alone, in a throwaway
  `git worktree add --detach` off the pre-WP-19 merge commit, per the
  process note in `EXECUTION_STATUS.md`): **4186/4186**, matching the
  shared working tree exactly — no contamination from the two
  concurrently-running sibling packages (WP-21, WP-25) touching other
  files in the same tree.
- `node scripts/check-claims.mjs --fix` then `node scripts/check-claims.mjs`:
  **OK** — README banner rewritten to 4186/4186, 20/20 core modules
  float-free.
- `cd project && npm run lint`: clean (one fix required —
  `tools/ephemeris/houses.js`'s new `window.HousesPolicy` publish needed a
  `window: "readonly"` global declared for that one file in the root
  `eslint.config.mjs`, mirroring the existing carve-outs for
  `core-shim.js`/`src/present/**`).
