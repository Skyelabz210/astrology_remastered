# Living behavioral avatar

Release 1.1.0 creates a versioned avatar during the first successful chart run.
The resolved birth form and residence history are also saved locally so reopening
the app restores that user. Feedback-sharing permission resets when changing
the birth record. The initial chart supplies five linked domains: motivation/identity, emotional
needs, thinking/communication, connection/values and action/conflict. Each has
its actual placement, conditions, natal contacts, observation quest and available
transit trajectory. Opening the avatar can also initialize an existing user's
record, so earlier saved profiles are supported.

The experience combines astrology with the user's own goals, values, learning
preferences, decision style, attention, routines and social context. Check-ins
and reading feedback record dates, domain, optional 0–4 self-rating, agreement
or disagreement, examples/counterexamples and the source reading reference.
These reports personalize subsequent local readings and reflection quests.
They do not change astronomical placements or establish a clinical assessment.

Participation XP includes five onboarding points, ten for a unique domain/day
check-in and five for a unique reading/day feedback entry. Repeated entries
remain in the journal but do not farm credit. Agreement, mixed feedback and
rejection earn the same points. Levels measure participation in the retained
journal, not astrological truth, psychological ability or predictive accuracy.

Records are bound to a normalized birth instant and coordinates. Name and
civil-zone label changes do not create another avatar; changing the birth record
starts another record. The baseline's static configuration fingerprint excludes
current time, AI provider and user observations. This prevents a feedback update
from recursively creating another baseline/revision. Model source and user
report source remain inspectable within the one integrated experience.

Already-produced admitted ledger evidence can enrich the avatar with its actual
input certificate categories and body coverage. No synthetic or unowned ledger
is promoted to admitted evidence. Exact-integer remainders are exact after
quantization; their behavioral meaning remains an experimental interpretation.

The store retains at most 25 profiles, 200 observations per profile and 30
revision summaries per profile. Browser quotas can be smaller: failed writes
report failure, preserve the entry form and do not broadcast success. Retention
bounds mean this browser is not an unlimited archive. Regular ZIP exports keep
portable snapshots, including `profile/living-avatar.json`, avatar summary,
reading contexts and an offline human-readable report.

Current reading contexts use a bounded summary so the whole journal is not
copied into every saved run. Full retained journal data remains in the dedicated
profile store and ZIP. The active narrated reading keeps its frozen astronomical
instant while newly authored observations update the avatar and personal context.
The journal is entered by the user; there is no undisclosed passive monitoring.

Goals and notes are local by default. Sending them to an AI provider requires a
separate opt-in in addition to the AI interpretation switch. Without that opt-in,
prompts use computed chart evidence while local views/export can still show the
integrated avatar. Removing an observation removes it from the living record;
previously saved readings and exported snapshots can retain their earlier data.
The UI explains this distinction.

Future extensions need additional design and evidence: durable authenticated
accounts and synchronization, optional validated/licensed questionnaires with
proper scoring and explicit source labels, longer observation windows, and
prospectively defined experiments comparing astrological hypotheses with actual
reports. Player levels or repeated agreement are not substitutes for validation.
