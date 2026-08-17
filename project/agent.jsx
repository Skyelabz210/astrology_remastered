// agent.jsx — the agentic interpreter.
//
// "A glorified autocomplete." The math runs first; the agent receives the
// computed substrate (CRT residues, dignities, lanes, aspects) and emits
// a declarative reading. No poetry, no metaphor — operational language
// grounded in the numbers we pass it.

const __cache = new Map();
const __pending = new Map();

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

function cacheKey(card) {
  // Card + chart signature: index, principal, house, dignity, aspect, resonance
  const p = card.principal;
  const a = card.aspect;
  return [
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
        `Long Count ${ctm.longCount.formatted} · Tzolk'in ${ctm.tzolkin.number} ${ctm.tzolkin.sign} · Haab ${ctm.haab.day} ${ctm.haab.month}. Age ${ctm.ageYears.toFixed(2)} yr. Phase syndrome S = ${ctm.syndromeDeg.toFixed(2)}°.`,
        principalTransits.length
          ? `Active transits to ${p.name}: ${principalTransits.map(h => `${h.T} ${h.aspect} ${h.orb.toFixed(2)}° ${h.phase}`).join("; ")}.`
          : `No active transit to ${p.name} within 2° right now.`,
      ];
    }
  } catch { /* live state optional */ }

  const lines = [
    `You are the reader of a chart. The mathematics has already run; the placements below are computed and fixed. Your task is to deliver the reading aloud — the way a fluent, experienced astrologer speaks when they sit across from someone and tell them what their chart shows. This is the STANDARD reading: spoken, synthesized, human.`,
    ``,
    `The classical apparatus is the reading. The Mayan CRT substrate (Safe Basis {2,3,5,7,11,13}) ADDS one extra disclosure at the end — mod 11, the shadow prime, surfaces a thread of correspondence classical astrology cannot see. It refines; it never overrides.`,
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
    `SUBSTRATE (Mayan CRT — additive, not replacement; for grounding only, do NOT read these figures aloud):`,
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

function buildChartPrompt(chart) {
  const planets = chart.planets.map(p =>
    `${p.name}${p.retrograde ? "℞" : ""} ${p.lon.toFixed(2)}° (sign ${p.sign}, H${p.house}, dign ${p.dignity.kind} ${p.dignity.score >= 0 ? "+" : ""}${p.dignity.score}, r₁₁=${p.residues.r11}, r₁₃=${p.residues.r13})`
  ).join("\n  ");
  return [
    `You are a literal interpreter for an astrology engine. The math has run; you translate the numbers into their astrological reading. Nothing more.`,
    ``,
    `Rules (strict):`,
    `- Do not narrate. Do not address the user. Do not editorialize, predict, or advise.`,
    `- No metaphor, no poetry, no adjectives for flavor. Plain astrological terminology only.`,
    `- One sentence per substrate fact. 4 sentences total. Cite numeric values inline.`,
    `- Surface at least one mod-11 (shadow-prime) contact as a fact. Do not dramatize it.`,
    `- Output prose only — no headers, no bullets, no asterisks, no quotation marks.`,
    ``,
    `SUBSTRATE`,
    `Birth: ${chart.birth.dateISO}, lat ${chart.birth.lat}°, lon ${chart.birth.lng}°. Sect: ${chart.isDayChart ? "Day" : "Night"}.`,
    `Ascendant: ${chart.asc.toFixed(3)}° (${ZODIAC[chart.ascSignIdx].name}).`,
    `Bodies:`,
    `  ${planets}`,
  ].join("\n");
}

async function interpretCard(card, chart) {
  const key = cacheKey(card);
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);

  const prompt = buildCardPrompt(card, chart);
  const promise = (async () => {
    try {
      const raw = await window.claude.complete(prompt);
      const clean = stripMd((raw || "").trim());
      __cache.set(key, clean);
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

async function interpretChart(chart) {
  const key = "chart:" + chart.jd.toFixed(3) + ":" + chart.birth.lat + ":" + chart.birth.lng;
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildChartPrompt(chart);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      __cache.set(key, clean);
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
    const key = cacheKey(card);
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
  }, [active, card && cacheKey(card)]);
  return state;
}

function useAgentChartReading(chart, active) {
  const [state, setState] = React.useState({ loading: false, text: null, error: null });
  React.useEffect(() => {
    if (!active || !chart) return;
    setState({ loading: true, text: null, error: null });
    let cancelled = false;
    interpretChart(chart).then(
      (text) => { if (!cancelled) setState({ loading: false, text, error: null }); },
      (err)  => { if (!cancelled) setState({ loading: false, text: null, error: String(err && err.message || err) }); }
    );
    return () => { cancelled = true; };
  }, [active, chart && chart.jd, chart && chart.asc, chart && chart.birth.dateISO]);
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
    syn.ctm.daySignMatch ? `Both were born under the same Tzolk'in day-sign — a rare calendrical echo.` : null,
    `Phase syndrome between their birth points on the time-cylinder: ${syn.ctm.syndromeDeg.toFixed(1)}° (0° = born in phase, 180° = counterphase).`,
  ].filter(Boolean).join("\n");
}

async function interpretSynastryOverview(syn) {
  const key = "syn:" + syn.chartA.jd.toFixed(2) + ":" + syn.chartB.jd.toFixed(2);
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildSynastryOverviewPrompt(syn);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      __cache.set(key, clean); __pending.delete(key); return clean;
    } catch (err) { __pending.delete(key); throw err; }
  })();
  __pending.set(key, promise);
  return promise;
}

async function interpretSynastryAspect(hit, syn) {
  const key = "synasp:" + syn.chartA.jd.toFixed(2) + ":" + syn.chartB.jd.toFixed(2) + ":" + hit.a + ":" + hit.b + ":" + hit.aspect;
  if (__cache.has(key)) return __cache.get(key);
  if (__pending.has(key)) return __pending.get(key);
  const prompt = buildSynastryAspectPrompt(hit, syn);
  const promise = (async () => {
    try {
      const text = await window.claude.complete(prompt);
      const clean = stripMd((text || "").trim());
      __cache.set(key, clean); __pending.delete(key); return clean;
    } catch (err) { __pending.delete(key); throw err; }
  })();
  __pending.set(key, promise);
  return promise;
}

function useSynastryReading(syn, active) {
  const [state, setState] = React.useState({ loading: false, text: null, error: null });
  React.useEffect(() => {
    if (!active || !syn) return;
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

Object.assign(window, {
  interpretCard, interpretChart, useAgentReading, useAgentChartReading,
  buildCardPrompt, buildChartPrompt,
  interpretSynastryOverview, interpretSynastryAspect, useSynastryReading,
  buildSynastryOverviewPrompt, buildSynastryAspectPrompt,
});
