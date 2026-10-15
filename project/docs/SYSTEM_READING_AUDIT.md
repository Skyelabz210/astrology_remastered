# Complete-system reading audit and corrective release 1.1.0

Baseline: `42b1479855920485a6b0e067f0ee3df9bc0b775d` (release 1.0.0).
Scope: birth and residence input; planetary/horizon/house calculations; traditional
conditions and aspect patterns; live and frozen contexts; local cards and spoken
narration; five-domain behavioral profiles; optional AI and voice providers;
profile-scoped history, historical calculations and ZIP export; navigation and
build/verification gates. This is a source, independent-probe and browser audit,
not a claim that every astrology tradition or every possible defect is covered.

## Reading diagnosis

The original behavioral fallback had five planetary domains and twelve sign
phrases. Element is determined by sign, so multiplying by four elements does
not create independent variations. The fallback did not distinguish the same
planet/sign in different houses, degrees or aspect networks. The main natal
cards were already richer than that fallback, but mostly narrated Sun-relative
aspects. Their small backs also clamped the reading to five lines.

Grounding checks live in `agent.jsx`; `openrouter.js` supplies transport,
consent and model configuration. An integer sweep validates the tested arithmetic
contract. It is neither a proof of every source claim nor an accuracy improvement
to the numerical ephemeris. Houses do not create essential detriment; for example,
Sun in Aries is traditionally exalted regardless of its house.

## One evidence schema across surfaces

`src/present/behavioral-profile.js` now exposes `chartEvidenceForBody` and a
version-2 `behavioralProfile`. Each domain carries:

| Field | Computed or authored source | Visible/useful boundary |
| --- | --- | --- |
| Anchor | Actual tropical longitude, circular nearest-arcsecond display, selected actual house system | Display precision is not birth-time or ephemeris accuracy; unknown-time houses are withheld. |
| Conditions | Essential dignity, Egyptian bound and face, signed motion, solar separation and chart sect | Essential dignity remains separate from house interpretation. Unknown-time sect is withheld. |
| Aspects and tension | All supplied natal contacts, peer placement, observed orb and applying/separating/exact phase | Contact geometry is a fact; psychological tension is explicitly traditional interpretation. |
| Trajectory | Real ephemeris, one frozen instant, next bracketed conjunction/sextile/square/trine/opposition crossings over 60 days | Seven classical transiting planets, five behavioral targets, three earliest located contacts per target. Other targets and unavailable searches have no fabricated date. Unknown-time exact degree dates are withheld. |
| Falsifier / observation | A practical recording protocol with examples and counterexamples | Tests whether the interpretation fits the reader; does not falsify planetary positions or establish a scientific personality test. |
| Resonance / references | Actual linked natal placements and shorter circular distance between quantized longitudes | Peer-card navigation and exact integer remainders; residue lanes remain experimental correspondences, not evidence of fate. |

The same structured fields feed local behavioral sections, card readings,
local narration, AI prompts, saved calculation evidence and offline exports.
A card body can scroll and receive keyboard focus. AI-expanded cards retain an
inspectable computed basis. Generated behavioral text is bound to the exact
context fingerprint and provider used at generation.

## Defects independently reproduced and repaired

| Priority | Baseline failure | Corrective behavior and acceptance evidence |
| --- | --- | --- |
| P1 | Returning to the natal city erased that residence from the selection before return casting. | Preserve the complete timeline. A Germany-to-Bragg move selects Bragg for current context and Solar/Lunar returns. |
| P1 | Editing a chapter while changing birth details bypassed ownership and transferred the alpha journey. | Bind chapter collections to resolved birth epoch and coordinates while editing. Save and Cast consume that collection; name edits preserve it. |
| P1 | Polar fallback could select the western horizon and appear to be a real angle. | Select the eastern geometric horizon intersection; report per-chart source and limitations; derive automatic sect from physical Sun altitude. Undefined pole/tangent cases fail explicitly. |
| P2 | Invalid residence dates became birth dates, ongoing residences or rolled calendar days. | Reject nonempty invalid/impossible boundaries and show skipped-row feedback; retain approved approximate-date flags. |
| P2 | Grand Cross detection depended on body iteration order. | Evaluate all opposition pairings; regressions cover every permutation and small perturbations. |
| P2 | Mean Lilith could display retrograde despite positive speed. | Motion flag follows its signed numerical derivative. |
| P3 | A longitude rounding to a full circle produced the wrong Ascendant lane. | Normalize quantized arcseconds before residue operations. |
| P2 | Uniform KP/monomoiria arithmetic was labelled as a working traditional division. | Preserve API IDs but explicitly label proxy conventions; proportional KP widths are not the uniform-249 arithmetic experiment. |
| Product | Sign-only behavioral prose and truncated card backs hid actual evidence. | Version-2 evidence schema, inspectable facts, links, dated scope and scrollable reading. Same-sign/different-chart tests produce different profiles. |
| Product | Techniques were listed as implemented without measured navigation access. | Persistent technique directory and independently named browser matrix; setup prerequisites and unsupported traditions remain explicit. |

Historical lifecycle calculations now have an explicit save action that preserves
the selected target, collection time, actual scan window, settings and completed
results. Pending/stale scans are not labelled completed. The standalone HCRM
console hydrates the same saved birth profile and owner-bound journey instead of
reverting to the alpha record. AI/voice follow-through adds all-contact grounding checks, provider subscriptions,
private-feedback opt-in, per-avatar revision identities, context-scoped completed
mutual scans, account-scoped voice lookup and full-text/layout audio cache keys.
Active provider/permission changes cancel requests, and voice authentication,
quota and timeout failures do not trigger a duplicate paid request. Their native
regressions are recorded in the release gate. Remote authentication and quotas require a real user-supplied
key; mocked transport tests cannot establish provider availability for that key.

## Living avatar and gamification

The latest requirement is implemented as one integrated evolving avatar, not a
separate psychological score. It begins on the initial chart run, incorporates
user goals/cognitive preferences and dated check-ins/corrections, generates
chart-anchored reflection quests and awards participation XP equally for fitting
and non-fitting reports. Source and accuracy boundaries remain visible. Read
[LIVING_AVATAR.md](LIVING_AVATAR.md) for persistence, provenance, privacy,
retention, deletion and further research/product steps.

## Improvement steps and acceptance gates

1. Preserve the repaired evidence contract. Every new field must carry input,
   convention, source, availability and owner; never fill missing calculations
   with plausible prose. Independently check degree/orb/date claims and unknown
   birth-time suppression before displaying them.
2. Expand reference coverage at boundaries: geographic latitude, DST ambiguity,
   historical civil time, stations and sign ingresses. Maintain actual versus
   requested house-system/source metadata in saved runs and exports.
3. Keep narration accountable to computed evidence. Extend grounding regressions
   for new claim forms and require declared natal versus transiting context.
   Interpretive language remains qualified; free-text checking is not exhaustive.
4. Collect actual completed runs with target time, collection time, parameters,
   result and owner. Keep date-target calculations distinct from the frozen
   current reading; exports must preserve both instead of averaging them.
5. Maintain the measured technique-access map. Acceptance is a rendered,
   focused destination in two navigation actions across supported reading screens;
   required second-birth data is a prerequisite, not a completed synastry result.
6. Add omitted techniques only after selecting conventions and independent
   fixtures: true nodes/apogee and Chiron; complete time-lord subperiods;
   primary/solar-arc/composite methods; full horary/electional logic; sidereal
   and other tradition-specific pipelines. Registry constants do not satisfy this.
7. Build authenticated accounts/personal-site synchronization only if product
   scope requires it. Present history is browser-local, bounded and exportable;
   it is not a hosted personal-site service or an automatic backup.
8. Re-run the mandatory native assertions, full integer sweep, 21-module
   no-float audit, external accuracy fixtures, lint, ledger schema, both builds,
   browser workflows and claim-banner check before publishing.

Remaining limits include browser ICU historical time zones, geocentric numerical
planetary positions, mean nodes/apogee, a small fixed-star catalogue without
proper motion, level-1 releasing only, one VOC convention, numerical crossing
search coverage, local-only histories and the unvalidated predictive meaning of
integer resonance. See FULL_APP_AUDIT.md, FRAMEWORK_REVIEW.md,
CALCULATION_CONVENTIONS.md and TECHNIQUE_ACCESS_MAP.md for detailed boundaries.
