// agent.jsx — the agentic interpreter.
//
// "A glorified autocomplete." The math runs first; the agent receives the
// computed substrate (CRT residues, dignities, lanes, aspects) and emits
// a declarative reading. No poetry, no metaphor — operational language
// grounded in the numbers we pass it.

const __cache = new Map();
const __pending = new Map();

// ── the readings survive the page ─────────────────────────────────────
//
// A chart is generated ONCE and then explored. The cache above used to be
// memory-only, so a reload discarded every reading the agent had already
// produced and the whole spread re-fetched — twelve requests to regenerate
// text the reader had literally just been shown. The cache is now written
// through to localStorage and hydrated at load: reopening the app puts the
// finished chart back on screen with no regeneration. Only genuinely new
// work (a different birth entry, a partner chart, a synastry pair) fetches,
// and none of it evicts the first chart — entries are capped FIFO at
// STORE_MAX, chart-scoped by key, and a full or unavailable store (quota,
// private mode) degrades to the in-memory session cache, never to a crash.
const READINGS_STORE_KEY = "resonance.readings.v1";
const READINGS_STORE_MAX = 400;

function readingsStore() {
  // Private-mode Safari can throw on the localStorage GETTER itself.
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* no store on this host */ }
  return null;
}

function hydrateReadings() {
  const store = readingsStore();
  if (!store) return;
  try {
    const raw = store.getItem(READINGS_STORE_KEY);
    if (!raw) return;
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string") {
        __cache.set(row[0], row[1]);
      }
    }
  } catch { /* a corrupt store regenerates; it must never brick the app */ }
}

function persistReadings() {
  const store = readingsStore();
  if (!store) return;
  try {
    const rows = [...__cache.entries()].slice(-READINGS_STORE_MAX);
    store.setItem(READINGS_STORE_KEY, JSON.stringify(rows));
  } catch { /* quota or private mode: the session cache still works */ }
}

/** The single write path: every finished reading lands here. */
function remember(key, text) {
  __cache.set(key, text);
  persistReadings();
  return text;
}

hydrateReadings();

// Strip any markdown the model returns despite instructions.
function stripMd(text) {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic *
    .replace(/__(.+?)__/g, "$1")        // bold __
    .replace(/_(.+?)_/g, "$1")          // italic _
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // code
    .replace(/^\s*[-*+]\s+/gm, "")     // bullets
    .replace(/^\s*\d+\.\s+/gm, "")     // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/\n{3,}/g, "\n\n")         // excess newlines
    .replace(/\n/g, " ")                // collapse remaining newlines to spaces
    .trim();
}

function cacheKey(card, chart) {
  // Card + chart signature: index, principal, house, dignity, aspect,
  // resonance — PLUS the chart's own identity. The card fields alone were
  // enough while the cache lived and died with the page; a persisted cache
  // outlives the chart that filled it, and a reading must never follow a
  // look-alike card into someone else's chart.
  const p = card.principal;
  const a = card.aspect;
  const sig = chart
    ? [chart.jd.toFixed(4), chart.birth.lat, chart.birth.lng, chart.timeUnknown ? 1 : 0].join(",")
    : "nochart";
  return [
    sig,
    card.idx, p.name, p.sign, p.house, p.retrograde ? 1 : 0,
    card.dignity.kind,
    a ? `${a.name}:${a.sep.toFixed(2)}` : "noasp",
    card.resonance.toFixed(3),
    card.laneR11, card.laneR13,
  ].join("|");
}

function buildCardPrompt(card, chart) {
  const p = card.principal;
  const r = p.residues;
  const gearK = ((r.r11 * 13) + r.r13) % 323;
  // CTM live state — if available, include today's running coordinate.
  let liveLines = [];
  try {
    if (typeof window !== "undefined" && window.ctmState && window.currentTransits) {
      const jdNow = window.dateToJD(new Date());
      const ctm   = window.ctmState(jdNow, chart.jd);
      const tx    = window.currentTransits(chart, jdNow);
      const principalTransits = tx.hits.filter(h => h.N === p.name).slice(0, 2);
      liveLines = [
        ``,
        `LIVE CTM STATE (today, running coordinate on ℝ × S¹):`,
        `Age ${ctm.ageYears.toFixed(2)} yr · ${Math.floor(ctm.ageDays).toLocaleString()} days lived · phase θ = ${ctm.tco.thetaDeg.toFixed(2)}° on the ${ctm.tco.M.toLocaleString()}-day round · syndrome S = ${ctm.syndromeDeg.toFixed(2)}°.`,
        principalTransits.length
          ? `Active transits to ${p.name}: ${principalTransits.map(h => `${h.T} ${h.aspect} ${h.orb.toFixed(2)}° ${h.phase}`).join("; ")}.`
          : `No active transit to ${p.name} within 2° right now.`,
      ];
    }
  } catch { /* live state optional */ }

  const lines = [
    `You are the reader of a chart. The mathematics has already run; the placements below are computed and fixed. Your task is to deliver the reading aloud — the way a fluent, experienced astrologer speaks when they sit across from someone and tell them what their chart shows. This is the STANDARD reading: spoken, synthesized, human.`,
    ``,
    `The classical apparatus is the reading. The exact residue substrate (Safe Basis {2,3,5,7,11,13}) ADDS one extra disclosure at the end — mod 11, the Shadow Prime, surfaces a thread of correspondence classical astrology cannot see. It refines; it never overrides.`,
    ``,
    `HOW TO NARRATE (this is the part that matters):`,
    `- SYNTHESIZE, do not enumerate. A placement is not a list of attributes — it is one coherent behavior. Fuse dignity + house + aspect + sect into a single, connected statement of how this part of the person operates. Each sentence should follow from the last like spoken thought, not like rows in a table.`,
    `- Speak it. This text is read ALOUD by a voice, so write for the ear: flowing clauses, natural rhythm, the cadence of someone who knows the craft. Numbers spoken aloud are friction — name a degree or sign in words only when it genuinely carries the point ("Saturn in the sign of its rulership," "the Moon just past full"), never as parenthetical data. NO bare figures like "λ=283°", "+5", "orb 1.2°", "r11=4". Those live in the rigorous panel, not the spoken reading.`,
    `- Use the real, grounded vocabulary of the tradition — dignity, rulership, sect, aspect, house topics, the dispositor's hand. This is craft language, not flowery mysticism. Stay precise and concrete about what the placement DOES.`,
    `- Be specific to THIS chart. Mention the actual sign, house topic, and the tightest real aspect. A reading that could apply to anyone has failed.`,
    `- No invented prediction, no life-coaching, no "you should." Describe the configuration and its working meaning. You may address the listener as "you" — that is how a reading is given — but do not flatter or console.`,
    ``,
    `SHAPE:`,
    `- 4 to 5 sentences. Open by placing the body in its sign and house and stating its condition (dignified, debilitated, neutral) as lived behavior. Develop it through the tightest aspect and the house topic. Then close with ONE final sentence beginning naturally (e.g. "Beneath that," "Underneath, the eleventh lane shows…") that names what the shadow-prime thread adds.`,
    `- If a LIVE CTM STATE block gives an active transit to this body, add one closing line naming that transit and whether it is building or separating — in plain speech, no figures.`,
    `- Prose only. No headers, no bullets, no asterisks, no quotation marks, no stage directions.`,
    ``,
    `SUBSTRATE`,
    `Card: ${card.name} (${card.element}, ${card.modality}). House: ${card.house} (whole-sign).`,
    `Principal body: ${p.name}${p.retrograde ? " ℞" : ""} at λ=${p.lon.toFixed(3)}° (${Math.floor(p.arcsec).toLocaleString()}″).`,
    `Dignity (Ptolemaic full table): ${card.dignity.kind} (essential ${card.dignity.score >= 0 ? "+" : ""}${card.dignity.score}). Triplicity lord: ${card.tripLord}. Term ruler: ${card.term}${card.inOwnTerm ? " (in own term)" : ""}. Face ruler: ${card.face}${card.inOwnFace ? " (in own face)" : ""}. Total Ptolemaic bonus: ${card.ptolemaicBonus >= 0 ? "+" : ""}${card.ptolemaicBonus}.`,
    `Dispositor: ${card.ruler}.`,
    p.criticalDegree ? `Critical degree: ${p.criticalDegree}.` : null,
    `Tenancy: ${card.tenants.length} bodies — ${card.tenants.map(t => t.name + (t.retrograde ? "℞" : "")).join(", ") || "none"}.`,
    `Sun aspect: ${card.aspect ? `${card.aspect.name} ${card.aspect.sep.toFixed(2)}° (orb ${card.aspect.orb}°, family ${card.aspect.family})` : "none in orb"}.`,
    // Additional aspect context: top three tightest aspects involving the principal
    `Tight aspects to principal: ${tightAspectsFor(chart, p.name) || "none in tight orb"}.`,
    // Joy / reception
    isJoyHit(chart, p) ? `In joy: H${card.house}.` : null,
    receptionFor(chart, p.name) || null,
    `Sect: ${chart.isDayChart ? "Day" : "Night"}. Ascendant: ${chart.asc.toFixed(2)}° ${ZODIAC[chart.ascSignIdx].name}. MC: ${chart.mc.toFixed(2)}° ${ZODIAC[chart.mcSignIdx].name}. Lunar phase: ${chart.phase.phase} (${(chart.phase.illumination * 100).toFixed(0)}%).`,
    ``,
    `MEANING REFERENCE (use this so the narration is accurate; do NOT quote these labels verbatim — speak them naturally):`,
    `House ${card.house} topic: ${houseTopic(card.house)}.`,
    `${p.name} signifies: ${planetSignifies(p.name)}.`,
    `Dignity "${card.dignity.kind}" means in practice: ${dignityMeaning(card.dignity.kind)}.`,
    card.aspect ? `The Sun aspect (${card.aspect.name}) works as: ${aspectMeaning(card.aspect.name)}, and it is ${card.aspect.phase || "set"}.` : null,
    p.retrograde ? `Retrograde: the signification turns inward, reconsidered rather than outwardly asserted.` : null,
    `Shadow lane "${SHADOW_LANE_NAMES[card.laneR11]}" (mod 11) is the hidden thread to fold into the final sentence — treat it as a quiet undercurrent beneath the classical reading, not a headline.`,
    ``,
    `SUBSTRATE (exact residues — additive, not replacement; for grounding only, do NOT read these figures aloud):`,
    `CRT residues: r₂=${r.r2}, r₃=${r.r3}, r₅=${r.r5}, r₇=${r.r7}, r₁₁=${r.r11} (SHADOW), r₁₃=${r.r13} (BOUNDARY).`,
    `Gear K = ${gearK} (mod 323).`,
    `Card shadow-lane: ${card.laneR11} (${SHADOW_LANE_NAMES[card.laneR11]}).`,
    `Card boundary-lane: ${card.laneR13} (${BOUNDARY_LANE_NAMES[card.laneR13]}).`,
    `Resonance ρ = ${card.resonance.toFixed(4)}.`,
    ...liveLines,
  ].filter(Boolean);
  return lines.join("\n");
}

// Plain-language reference tables so the agent narrates accurately.
const HOUSE_TOPIC = [
  null,
  "the self, the body, vitality and how one meets the world",
  "money, resources, possessions and what one values",
  "the mind, siblings, communication, short journeys and daily learning",
  "home, roots, family of origin, the foundation and one's later years",
  "creativity, children, romance, pleasure and what one risks for joy",
  "work, service, health, routine, skill and the daily grind",
  "partnership, marriage, the open other and committed relationship",
  "shared resources, intimacy, death, debt, transformation and the hidden",
  "belief, higher learning, travel, philosophy and meaning",
  "career, public standing, reputation and the life's visible work",
  "friends, community, hopes, alliances and the wider network",
  "solitude, the unconscious, retreat, loss, the unseen and undoing",
];
function houseTopic(h) { return HOUSE_TOPIC[h] || "an area of life"; }

const PLANET_SIGNIFIES = {
  Sun: "the core self, vitality, purpose and the will to shine",
  Moon: "the emotional body, instinct, needs, comfort and the inner tides",
  Mercury: "thought, speech, learning, exchange and how the mind moves",
  Venus: "love, attraction, value, beauty, harmony and what one is drawn to",
  Mars: "drive, desire, anger, courage, action and the cutting edge",
  Jupiter: "growth, faith, generosity, opportunity and reach",
  Saturn: "structure, limit, discipline, time, duty and what must be earned",
  Uranus: "disruption, freedom, sudden change and the urge to break form",
  Neptune: "dreams, dissolution, longing, spirituality and the porous edge",
  Pluto: "power, depth, compulsion, destruction and remaking",
  NorthNode: "the direction of growth, the unfamiliar one is meant to move toward",
  SouthNode: "the familiar past, ingrained habit, what one releases",
  Chiron: "the wound that teaches, where hurt becomes skill",
  Lilith: "the untamed, the refused, the part that will not be domesticated",
};
function planetSignifies(n) { return PLANET_SIGNIFIES[n] || "an active principle"; }

function dignityMeaning(kind) {
  switch (kind) {
    case "domicile":   return "the planet is at home and acts freely, in full command of its own nature";
    case "exaltation": return "the planet is honored and amplified, expressing at its best, perhaps grandly";
    case "detriment":  return "the planet works against the grain, out of its element, effort costs more";
    case "fall":       return "the planet is weakened and must compensate, its expression muted or hard-won";
    default:           return "the planet operates plainly, neither strengthened nor undermined by the sign";
  }
}
function aspectMeaning(name) {
  switch (name) {
    case "Conjunction": return "the two fuse and act as a single force";
    case "Opposition":  return "the two pull against each other across an axis, asking for balance";
    case "Trine":       return "the two flow together easily, a gift that comes without friction";
    case "Square":      return "the two grind against each other, generating tension that demands action";
    case "Sextile":     return "the two cooperate when invited, an opportunity that must be taken up";
    case "Quincunx":    return "the two never quite align, a persistent adjustment";
    default:            return "the two are in a subtle, less common relationship";
  }
}

function tightAspectsFor(chart, name) {
  const hits = (chart.aspectGrid || [])
    .filter(a => (a.a === name || a.b === name) && a.orb < 3)
    .slice(0, 3)
    .map(a => `${a.a}-${a.b} ${a.aspect} ${a.orb.toFixed(2)}° ${a.phase}`);
  return hits.join("; ");
}
function isJoyHit(chart, p) {
  return (chart.joys || []).some(j => j.planet === p.name && j.house === p.house);
}
function receptionFor(chart, name) {
  const r = (chart.receptions || []).find(x => x.a === name || x.b === name);
  if (!r) return null;
  return `Mutual reception (${r.kind}): ${r.a} ↔ ${r.b}.`;
}

// `jdTarget` optionally grounds the reading in "right now": the SAME
// lifecycleDigest (time.jsx) facts narrative.jsx's spoken closing reuses
// — age, which return is in force, which bodies share their natal shadow
// lane — given to the model as additional substrate, not asked for as a
// prediction. Omitted (the default), the prompt is exactly the birth
// chart with no live-time dependency, as it always was.
//
// `precomputedDigest`/`precomputedProgressions`, when given (even `null`,
// meaning "computed, and there is nothing to say"), are used instead of
// calling lifecycleDigest/progressionsDigest here — interpretChart already
// has to compute both to derive its cache key, so this avoids computing
// either a second time for the same call.
function buildChartPrompt(chart, jdTarget = null, precomputedDigest = undefined, precomputedProgressions = undefined) {
  const planets = chart.planets.map(p =>
    `${p.name}${p.retrograde ? "℞" : ""} ${p.lon.toFixed(2)}° (sign ${p.sign}, H${p.house}, dign ${p.dignity.kind} ${p.dignity.score >= 0 ? "+" : ""}${p.dignity.score}, r₁₁=${p.residues.r11}, r₁₃=${p.residues.r13})`
  ).join("\n  ");
  const digest = precomputedDigest !== undefined
    ? precomputedDigest
    : (Number.isFinite(jdTarget) && typeof lifecycleDigest === "function" ? lifecycleDigest(chart, jdTarget) : null);
  const lifecycleLines = digest ? digest.lines : null;
  const progressions = precomputedProgressions !== undefined
    ? precomputedProgressions
    : (Number.isFinite(jdTarget) && typeof progressionsDigest === "function" ? progressionsDigest(chart, jdTarget) : null);
  const progressionLines = progressions ? progressions.lines : null;
  // The sentence budget makes room for one MORE sentence per extra block
  // actually offered — 4 by default, up to 6 when both apply — rather
  // than a fixed "4 to 5" that would under-budget when both fire or
  // over-promise when only one does.
  const extraBlocks = (lifecycleLines ? 1 : 0) + (progressionLines ? 1 : 0);
  const sentenceBudget = extraBlocks === 0 ? "4 sentences" : `4 to ${4 + extraBlocks} sentences`;
  return [
    `You are a literal interpreter for an astrology engine. The math has run; you translate the numbers into their astrological reading. Nothing more.`,
    ``,
    `Rules (strict):`,
    `- Do not narrate. Do not address the user. Do not editorialize, predict, or advise.`,
    `- No metaphor, no poetry, no adjectives for flavor. Plain astrological terminology only.`,
    `- One sentence per substrate fact. ${sentenceBudget} total. Cite numeric values inline.`,
    `- Surface at least one mod-11 (shadow-prime) contact as a fact. Do not dramatize it.`,
    ...(lifecycleLines ? [`- You may spend one sentence on a RIGHT NOW fact below, stated in the present tense — it is a current fact, not a prediction.`] : []),
    ...(progressionLines ? [`- You may spend one sentence on a BY PROGRESSION fact below, stated in the present tense — it is a current fact, not a prediction.`] : []),
    `- Output prose only — no headers, no bullets, no asterisks, no quotation marks.`,
    ``,
    `SUBSTRATE`,
    `Birth: ${chart.birth.dateISO}, lat ${chart.birth.lat}°, lon ${chart.birth.lng}°. Sect: ${chart.isDayChart ? "Day" : "Night"}.`,
    `Ascendant: ${chart.asc.toFixed(3)}° (${ZODIAC[chart.ascSignIdx].name}).`,
    `Bodies:`,
    `  ${planets}`,
    ...(lifecycleLines ? ["", `RIGHT NOW`, `  ${lifecycleLines.join("\n  ")}`] : []),
    ...(progressionLines ? ["", `BY PROGRESSION`, `  ${progressionLines.join("\n  ")}`] : []),
  ].join("\n");
}

// ─────────────────────── host capability ───────────────────────
//
// `window.claude.complete` is the interpreter INTERFACE, not a single host's
// API. The Claude artifact host injects it directly. Other hosts may provide it
// themselves: the Lovable deploy installs a shim over that same name which
// routes to a server function on its AI gateway, so the legacy call sites below
// need no per-host branching — they call the interface and the host decides
// what backs it.
//
// What no host guarantees is that it is there at all. Opened from disk, in a
// plain browser tab, or under SSR before any shim has run, it is absent, and
// calling it blind threw `Cannot read properties of undefined (reading
// 'complete')` deep inside a promise. That surfaced as "interpreter
// unavailable" with no hint the feature was simply not offered there.
//
// So probe first, and probe the INTERFACE rather than any particular provider.
// A host that does not offer it is the ORDINARY case, reported as
// `unavailable` — distinct from `error`, a real failure of a call that could
// have worked, which is what a host-backed interpreter returns when its own
// backend refuses (rate limit, exhausted credits, a bad key). The local reading
// is a genuine reading, not a degraded one, and the UI says so.

/**
 * Does this host provide the agent interpreter?
 * @returns {boolean} true only when window.claude.complete is callable.
 */
function agentAvailable() {
  return typeof window !== "undefined"
    && !!window.claude
    && typeof window.claude.complete === "function";
}

/** The state the hooks report on a host with no interpreter. */
const AGENT_UNAVAILABLE = Object.freeze({
  loading: false, text: null, error: null, unavailable: true,
});

/** @throws {Error} when the host provides no interpreter. */
function requireAgent() {
  if (!agentAvailable()) {
    throw new Error("the AI interpreter is not available in this session");
  }
}

async function interpretCard(card, chart) {
  requireAgent();
  const key = cacheKey(card, chart);
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);

  const prompt = buildCardPrompt(card, chart);
  const promise = (async () => {
    try {
      const raw = await window.claude.complete(prompt);
      const clean = stripMd((raw || "").trim());
      remember(key, clean);
      __pending.delete(key);
      return clean;
    } catch (err) {
      __pending.delete(key);
      throw err;
    }
  })();
  __pending.set(key, promise);
  return promise;
}

async function interpretChart(chart, jdTarget = null) {
  requireAgent();
  // The key's lifecycle component is derived from the DIGEST'S OWN
  // content, not from a day bucket: lifecycleDigest is not day-granular
  // — a shared shadow lane can flip within hours, a return can begin
  // intraday, and the lived-day count itself changes at the birth
  // time-of-day boundary, not at midnight. A day-bucketed key served a
  // stale RIGHT NOW statement for however many hours were left in that
  // bucket after the facts actually changed (caught by a Codex review on
  // the PR that introduced the day-bucket). Deriving the key from the
  // computed lines instead means it changes exactly when what the prompt
  // would say changes, and — usefully — stays stable across calls whose
  // facts happen to be identical even at different exact instants, which
  // is MORE cache-friendly than day-bucketing, not less.
  const digest = Number.isFinite(jdTarget) && typeof lifecycleDigest === "function"
    ? lifecycleDigest(chart, jdTarget)
    : null;
  // Same content-derived-key reasoning as the lifecycle digest, extended
  // to progressionsDigest — its own facts (a slower body's sign change,
  // the progressed lunar phase) are no more day-granular than lifecycle's
  // are, so the fingerprint covers both rather than trusting a time
  // bucket for either.
  const progressions = Number.isFinite(jdTarget) && typeof progressionsDigest === "function"
    ? progressionsDigest(chart, jdTarget)
    : null;
  const fingerprint = (digest ? digest.lines.join("|") : "none")
    + "::" + (progressions ? progressions.lines.join("|") : "none");
  // The chart alone, without the fingerprint — a stable pointer to
  // "whatever synthesis this chart most recently had," kept alongside
  // the fingerprinted entry so buildReadingMarkdown's export can find it
  // without needing to know which exact jdTarget produced it.
  const chartIdentity = "chart:" + chart.jd.toFixed(3) + ":" + chart.birth.lat + ":" + chart.birth.lng;
  const key = chartIdentity + ":" + fingerprint;
  if (__cache.has(key)) {
    const cached = __cache.get(key);
    remember(chartIdentity + ":latest", cached);
    return cached;
  }
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildChartPrompt(chart, jdTarget, digest, progressions);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      remember(key, clean);
      remember(chartIdentity + ":latest", clean);
      __pending.delete(key);
      return clean;
    } catch (err) {
      __pending.delete(key);
      throw err;
    }
  })();
  __pending.set(key, promise);
  return promise;
}

function useAgentReading(card, chart, active) {
  const [state, setState] = React.useState({ loading: false, text: null, error: null });
  React.useEffect(() => {
    if (!active || !card || !chart) return;
    if (!agentAvailable()) { setState(AGENT_UNAVAILABLE); return; }
    const key = cacheKey(card, chart);
    if (__cache.has(key)) {
      setState({ loading: false, text: __cache.get(key), error: null });
      return;
    }
    setState({ loading: true, text: null, error: null });
    let cancelled = false;
    interpretCard(card, chart).then(
      (text) => { if (!cancelled) setState({ loading: false, text, error: null }); },
      (err)  => { if (!cancelled) setState({ loading: false, text: null, error: String(err && err.message || err) }); }
    );
    return () => { cancelled = true; };
  }, [active, card && chart && cacheKey(card, chart)]);
  return state;
}

function useAgentChartReading(chart, active, jdTarget = null) {
  const [state, setState] = React.useState({ loading: false, text: null, error: null });
  const jdBucket = Number.isFinite(jdTarget) ? Math.floor(jdTarget) : null;
  React.useEffect(() => {
    if (!active || !chart) return;
    if (!agentAvailable()) { setState(AGENT_UNAVAILABLE); return; }
    setState({ loading: true, text: null, error: null });
    let cancelled = false;
    interpretChart(chart, jdTarget).then(
      (text) => { if (!cancelled) setState({ loading: false, text, error: null }); },
      (err)  => { if (!cancelled) setState({ loading: false, text: null, error: String(err && err.message || err) }); }
    );
    return () => { cancelled = true; };
  }, [active, chart && chart.jd, chart && chart.asc, chart && chart.birth.dateISO, jdBucket]);
  return state;
}

// ─────────────────────── synastry interpreter ───────────────────────

function buildSynastryAspectPrompt(hit, syn) {
  const A = syn.chartA.birth.subjectName || "Person A";
  const B = syn.chartB.birth.subjectName || "Person B";
  const quality = hit.harmonious ? "harmonious (flows easily)"
    : hit.hard ? "hard (friction, tension that demands work)"
    : "a conjunction (fusion — the two principles merge)";
  return [
    `You are the reader of a relationship chart (synastry). The math has run. Read this single cross-aspect aloud, the way a fluent astrologer speaks when describing how two people meet.`,
    ``,
    `HOW TO NARRATE:`,
    `- Synthesize into spoken prose, written for the ear. No figures, no degrees, no orb numbers read aloud.`,
    `- 2 to 3 sentences. Say what ${A}'s ${hit.a} contacting ${B}'s ${hit.b} by ${hit.aspect} actually DOES between them — the felt dynamic, grounded in what each planet signifies.`,
    `- Real craft vocabulary, concrete about the dynamic. No flattery, no fortune-telling, no "you should".`,
    `- Prose only. No headers, bullets, asterisks, or quotation marks.`,
    ``,
    `SUBSTRATE`,
    `${A}'s ${hit.a} ${hit.aspect} ${B}'s ${hit.b}. Quality: ${quality}.`,
    `${hit.a} signifies: ${planetSignifies(hit.a)}.`,
    `${hit.b} signifies: ${planetSignifies(hit.b)}.`,
    `The ${hit.aspect} works as: ${aspectMeaning(hit.aspect)}.`,
    `This is among the strongest contacts between the two charts (relational weight ${hit.weight.toFixed(2)}).`,
  ].join("\n");
}

function buildSynastryOverviewPrompt(syn) {
  const A = syn.chartA.birth.subjectName || "Person A";
  const B = syn.chartB.birth.subjectName || "Person B";
  const top = syn.hits.slice(0, 6).map(h =>
    `${A}'s ${h.a} ${h.aspect} ${B}'s ${h.b} (${h.harmonious ? "harmonious" : h.hard ? "hard" : "conjunction"})`
  ).join("; ");
  const sc = syn.score;
  const balance = sc.ratio > 0.62 ? "predominantly easy" : sc.ratio < 0.42 ? "predominantly challenging" : "mixed, easy and hard in balance";
  const overlayHi = syn.overlaysBonA.slice(0, 4).map(o => `${B}'s ${o.planet} falls in ${A}'s house ${o.house}`).join("; ");
  return [
    `You are the reader of a relationship chart (synastry). The math has run. Deliver the overall reading of how these two people meet, aloud, the way a skilled astrologer synthesizes a synastry.`,
    ``,
    `HOW TO NARRATE:`,
    `- Spoken prose for the ear. No figures, degrees, orbs, residues, or scores read aloud.`,
    `- 4 to 6 sentences. Open with the overall texture of the bond (the balance of ease and friction), then name the two or three defining contacts and what they create between the pair, then one sentence on where one person's planets land in the other's life (house overlay) and what arena that lights up.`,
    `- End with ONE sentence on the deeper layer: the shadow-prime threads the two charts share (shared lanes) — a quiet undercurrent of resonance beneath the classical synastry.`,
    `- Real craft vocabulary, specific to THESE two charts. No flattery, no prediction, no advice.`,
    `- Prose only. No headers, bullets, asterisks, or quotation marks.`,
    ``,
    `SUBSTRATE`,
    `Overall balance: ${balance}. Intensity of contact: ${sc.intensity > 0.6 ? "highly aspected, a charged connection" : sc.intensity > 0.3 ? "moderately aspected" : "lightly aspected, more space than pull"}.`,
    `Defining cross-aspects (strongest first): ${top}.`,
    overlayHi ? `House overlays: ${overlayHi}.` : null,
    syn.receptionsAB.length || syn.receptionsBA.length ? `Cross-reception present — each receives the other into a sign they rule, a sign of mutual accommodation.` : null,
    `Shared shadow lanes (mod 11 resonances both charts hold): ${syn.ctm.sharedLanes.slice(0,4).map(s => `${s.a}/${s.b} in lane ${s.laneName}`).join("; ") || "none significant"}.`,
    `Phase offset between their birth points on the time-cylinder: ${syn.ctm.syndromeFoldDeg.toFixed(1)}° (0° = born in phase, 180° = counterphase). This is the gap between the births on the 30,030-day round — a calendar rhythm, not a chart aspect.`,
  ].filter(Boolean).join("\n");
}

async function interpretSynastryOverview(syn) {
  requireAgent();
  const key = "syn:" + syn.chartA.jd.toFixed(2) + ":" + syn.chartB.jd.toFixed(2);
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildSynastryOverviewPrompt(syn);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      remember(key, clean); __pending.delete(key); return clean;
    } catch (err) { __pending.delete(key); throw err; }
  })();
  __pending.set(key, promise);
  return promise;
}

async function interpretSynastryAspect(hit, syn) {
  requireAgent();
  const key = "synasp:" + syn.chartA.jd.toFixed(2) + ":" + syn.chartB.jd.toFixed(2) + ":" + hit.a + ":" + hit.b + ":" + hit.aspect;
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildSynastryAspectPrompt(hit, syn);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      remember(key, clean); __pending.delete(key); return clean;
    } catch (err) { __pending.delete(key); throw err; }
  })();
  __pending.set(key, promise);
  return promise;
}

function useSynastryReading(syn, active) {
  const [state, setState] = React.useState({ loading: false, text: null, error: null });
  React.useEffect(() => {
    if (!active || !syn) return;
    if (!agentAvailable()) { setState(AGENT_UNAVAILABLE); return; }
    setState({ loading: true, text: null, error: null });
    let cancelled = false;
    interpretSynastryOverview(syn).then(
      (text) => { if (!cancelled) setState({ loading: false, text, error: null }); },
      (err)  => { if (!cancelled) setState({ loading: false, text: null, error: String(err && err.message || err) }); }
    );
    return () => { cancelled = true; };
  }, [active, syn && syn.chartA.jd, syn && syn.chartB.jd]);
  return state;
}

// ── export: the reading as a file ─────────────────────────────────────
//
// The chart a person generated is theirs to keep. This turns the whole
// spread — every card's reading, agent-interpreted where the cache has it
// and locally composed where it does not, plus the chart-level synthesis
// when one exists — into ONE Markdown document and hands it to the browser
// as a download. Markdown deliberately: it opens as plain text absolutely
// anywhere, and renders as a document in most places that matter.
//
// Everything reads from what is ALREADY on screen: the persisted cache and
// readings.jsx's local composer. Exporting never triggers generation.

/** The text a card shows right now, with its provenance. */
function readingTextFor(card, chart) {
  const hit = __cache.get(cacheKey(card, chart));
  if (hit) return { text: hit, source: "agent" };
  if (typeof readingFor === "function") {
    try {
      const local = readingFor(card, chart);
      if (local && local.body && local.body.length) {
        return { text: local.body.map((l) => l.text).join(" "), source: "local" };
      }
    } catch { /* a card the composer cannot read exports as absent */ }
  }
  return { text: "", source: "none" };
}

/** The whole reading, as one Markdown document. */
function buildReadingMarkdown(chart, cards) {
  const b = chart.birth || {};
  let born = b.dateISO || "";
  try {
    if (typeof AstroCore !== "undefined" && AstroCore.birthClockParts) {
      const { dateStr, timeStr } = AstroCore.birthClockParts(b.dateISO, b.tz);
      born = chart.timeUnknown ? dateStr : `${dateStr} · ${timeStr}`;
    }
  } catch { /* raw ISO is a fine fallback */ }
  const hnum = (h) => (typeof roman === "function" ? roman(h) : String(h));

  const lines = [
    "# Resonance — Natal Reading",
    "",
    `**Born** ${born}${b.placeLabel ? ` · ${b.placeLabel}` : ""}`,
  ];
  const facts = [];
  if (typeof chart.isDayChart === "boolean") facts.push(`**Sect** ${chart.isDayChart ? "Day" : "Night"}`);
  if (!chart.timeUnknown && typeof chart.asc === "number" && typeof ZODIAC !== "undefined" && ZODIAC[chart.ascSignIdx]) {
    facts.push(`**Ascendant** ${chart.asc.toFixed(2)}° ${ZODIAC[chart.ascSignIdx].name}`);
  }
  if (!chart.timeUnknown && typeof chart.mc === "number" && typeof ZODIAC !== "undefined" && ZODIAC[chart.mcSignIdx]) {
    facts.push(`**MC** ${chart.mc.toFixed(2)}° ${ZODIAC[chart.mcSignIdx].name}`);
  }
  if (chart.phase && chart.phase.phase) {
    facts.push(`**Lunar phase** ${chart.phase.phase}`);
  }
  if (facts.length) lines.push(facts.join(" · "));
  if (chart.timeUnknown) {
    lines.push("", "*Birth time unknown — houses, Ascendant and Midheaven are not reliable on this chart.*");
  }
  lines.push("", "---");

  let agentCount = 0;
  cards.forEach((card, i) => {
    const p = card.principal;
    const { text, source } = readingTextFor(card, chart);
    if (source === "agent") agentCount += 1;
    lines.push(
      "",
      `## ${String(i + 1).padStart(2, "0")} · ${p.name}${p.retrograde ? " ℞" : ""} in ${card.name} — ${chart.timeUnknown ? "House —" : `House ${hnum(card.house)}`} · ${card.dignity.kind}`,
      "",
      text || "*No reading composed for this card.*",
    );
    if (source === "local") {
      lines.push("", "*Composed locally from the classical tables.*");
    }
  });

  // ":latest" — not the fingerprinted key interpretChart actually caches
  // under (that depends on a jdTarget this function is never given) —
  // interpretChart keeps this pointer updated to whatever it most
  // recently resolved for this exact chart, fingerprint aside.
  const chartKey = "chart:" + chart.jd.toFixed(3) + ":" + b.lat + ":" + b.lng + ":latest";
  const synthesis = __cache.get(chartKey);
  if (synthesis) {
    lines.push("", "## The chart as one", "", synthesis);
  }

  lines.push(
    "", "---", "",
    `*Exported from Resonance. ${agentCount} of ${cards.length} readings are agent-interpreted; the rest are composed locally from the classical tables.*`,
    "",
  );
  return lines.join("\n");
}

/** resonance-reading-1980-10-21.md */
function exportFilename(chart) {
  const iso = (chart && chart.birth && chart.birth.dateISO) || "";
  const day = /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "chart";
  return `resonance-reading-${day}.md`;
}

/**
 * Hand `text` to the browser as a downloaded file. Pure client mechanics —
 * a Blob, an object URL, a synthetic anchor click — nothing leaves the
 * page. Returns false (never throws) on a host with no document.
 */
function downloadTextFile(filename, text, mime = "text/markdown") {
  if (typeof window === "undefined" || !window.document || !window.URL || !window.Blob) return false;
  try {
    const blob = new window.Blob([text], { type: `${mime};charset=utf-8` });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    setTimeout(() => { try { window.URL.revokeObjectURL(url); } catch { /* revoked */ } }, 1000);
    return true;
  } catch { return false; }
}

/** The button's one call: the reading on screen becomes a file. */
function exportReading(chart, cards) {
  return downloadTextFile(exportFilename(chart), buildReadingMarkdown(chart, cards));
}

Object.assign(window, {
  agentAvailable, remember, hydrateReadings, persistReadings,
  readingTextFor, buildReadingMarkdown, exportFilename, downloadTextFile, exportReading,
  READINGS_STORE_KEY, READINGS_STORE_MAX,
  interpretCard, interpretChart, useAgentReading, useAgentChartReading,
  buildCardPrompt, buildChartPrompt,
  interpretSynastryOverview, interpretSynastryAspect, useSynastryReading,
  buildSynastryOverviewPrompt, buildSynastryAspectPrompt,
});
