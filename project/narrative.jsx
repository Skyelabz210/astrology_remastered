// narrative.jsx — the whole chart as ONE spoken narrative.
//
// The reading session used to be twelve separate hits: each card fetched
// its own text, the voice spoke that text, the deck sat on a dwell timer,
// and nothing connected one card to the next. This file composes the chart
// as a single continuous piece — an opening that places the nativity, the
// twelve signs in reading order with connective tissue between them, and a
// closing that names what the whole shape came to — so it can be played
// start to finish like a recording rather than triggered twelve times.
//
// SEGMENTS AND OFFSETS. `buildChartNarrative()` returns both the joined
// text and the segments that compose it, each carrying its character range
// within that text. Those ranges are what let playback stay in sync: given
// ElevenLabs character-level timestamps (or, failing that, the audio's own
// duration), `segmentTimings*()` below converts a character range into a
// start time, and the deck advances to the card the voice has actually
// reached instead of guessing on a timer.
//
// WHAT IT SAYS, AND WHAT IT REFUSES TO. Every sentence is derived from
// values astro.jsx already computed — sign, house, dignity, aspect, sect,
// phase, shape, the shadow lane. Nothing is invented, and one rule is
// inherited deliberately from readings.jsx: on an unknown-birth-time chart
// NO house language and NO Ascendant language is spoken at all, because
// those numbers are only as good as an assumed noon. That was a real defect
// once (see readings.jsx's own gating and test/present/readings.test.js);
// composing a second narrative path is exactly how such a fix gets quietly
// undone, so the same gate is applied here and tested the same way.
//
// The plain-language tables come from agent.jsx (houseTopic,
// planetSignifies, dignityMeaning, aspectMeaning) and readings.jsx
// (SHADOW_LANE_NAMES) — both classic scripts whose top-level declarations
// are globals in a browser. Each is used through a guarded accessor so a
// page that loads this file without them degrades to plainer wording rather
// than throwing.

/** Longest text ElevenLabs will accept in one request, with headroom. */
const NARRATIVE_MAX_CHARS = 4500;

const ORDINAL_HOUSE = [
  null, "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
];

// ── guarded accessors for the tables other scripts publish ────────────

function nHouseTopic(h) {
  if (typeof houseTopic === "function") return houseTopic(h);
  return "an area of life";
}
function nPlanetSignifies(name) {
  if (typeof planetSignifies === "function") return planetSignifies(name);
  return "an active principle";
}
function nDignityMeaning(kind) {
  if (typeof dignityMeaning === "function") return dignityMeaning(kind);
  return "the planet operates plainly";
}
function nAspectMeaning(name) {
  if (typeof aspectMeaning === "function") return aspectMeaning(name);
  return "the two stand in relationship";
}
function nLaneName(i) {
  const table = (typeof SHADOW_LANE_NAMES !== "undefined") ? SHADOW_LANE_NAMES : null;
  return (table && table[i]) || `lane ${i}`;
}
function nSignName(idx) {
  const table = (typeof ZODIAC !== "undefined") ? ZODIAC : null;
  return (table && table[idx] && table[idx].name) || "an unknown sign";
}

/** "about one degree" / "just under three degrees" — orbs, spoken. */
function spokenOrb(deg) {
  if (!Number.isFinite(deg)) return "";
  if (deg < 0.25) return "all but exact";
  if (deg < 1) return "inside a degree";
  const whole = Math.round(deg);
  const word = ["zero","one","two","three","four","five","six","seven","eight","nine","ten"][whole];
  if (!word) return `about ${whole} degrees`;
  return deg < whole ? `just under ${word} degrees` : `about ${word} degree${whole === 1 ? "" : "s"}`;
}

/** A date a voice can read without stumbling over an ISO string. */
function spokenDate(dateISO) {
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return null;
  const months = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// ── the opening ───────────────────────────────────────────────────────

function narrativeOpening(chart) {
  const lines = [];
  const birth = chart.birth || {};
  const when = spokenDate(birth.dateISO);
  const where = birth.placeLabel ? birth.placeLabel.replace(/\s*·\s*/g, ", ") : null;

  if (when && where) lines.push(`This is the chart for ${when}, at ${where}.`);
  else if (when) lines.push(`This is the chart for ${when}.`);
  else lines.push("This is the chart.");

  const sun = (chart.planets || []).find(p => p.name === "Sun");
  const moon = (chart.planets || []).find(p => p.name === "Moon");
  const sect = chart.isDayChart ? "a day chart — the Sun above the horizon, the diurnal sect in charge"
    : "a night chart — the Sun below the horizon, the nocturnal sect in charge";

  if (!chart.timeUnknown && typeof chart.ascSignIdx === "number") {
    lines.push(`${nSignName(chart.ascSignIdx)} was rising, and everything here is measured from that horizon. It is ${sect}.`);
  } else {
    // No rising sign is spoken on an unknown-time chart — see this file's
    // header. Sect still holds: it depends on the Sun's position relative
    // to the horizon, which astro.jsx resolves without a house system.
    lines.push(`The birth time is unknown, so the rising sign, the houses and the angles are not spoken for on this chart. It is ${sect}.`);
  }

  if (sun && moon) {
    lines.push(`The Sun stands in ${nSignName(sun.sign)}, the Moon in ${nSignName(moon.sign)}${chart.phase ? `, ${String(chart.phase.phase).toLowerCase()}` : ""}.`);
  }

  if (chart.shape && chart.shape.shape) {
    lines.push(`The whole is a ${String(chart.shape.shape).toLowerCase()} figure, its bodies gathered across ${Math.round(chart.shape.occupiedArcDeg)} degrees of the wheel.`);
  }

  const dominant = dominantElement(chart);
  if (dominant) lines.push(`${dominant.name} carries the weight of it.`);

  // The birth's fixed coordinate on the long round — the cyclic clock every
  // later moment of this chart is measured against. A verifiable arithmetic
  // fact, not an interpretive claim.
  if (chart.jd && typeof tcoPhase === "function") {
    const t = tcoPhase(chart.jd);
    lines.push(`On the long round of ${t.M.toLocaleString()} days, this birth holds phase ${t.thetaDeg.toFixed(1)} degrees — the fixed coordinate every later moment of the chart is measured against.`);
  }

  lines.push("Here it is, sign by sign.");
  return lines.join(" ");
}

function dominantElement(chart) {
  const counts = chart.elementCount || null;
  if (!counts) return null;
  let best = null;
  for (const [name, n] of Object.entries(counts)) {
    if (!best || n > best.n) best = { name, n };
  }
  return best && best.n > 0 ? best : null;
}

// ── one card ──────────────────────────────────────────────────────────

/**
 * Two to four sentences for one card, written for the ear: the body in its
 * sign, what its condition does to it, the house topic it works through
 * (when the birth time allows), its tightest Sun-aspect, and the
 * shadow-lane thread underneath.
 */
function narrativeForCard(card, chart, { first = false } = {}) {
  const p = card.principal;
  const timeKnown = !chart.timeUnknown;
  const parts = [];

  const opener = first ? "" : "";
  const houseClause = timeKnown && card.house
    ? `, working through the ${ORDINAL_HOUSE[card.house] || card.house} house — ${nHouseTopic(card.house)}`
    : "";
  parts.push(`${opener}${p.name}${p.retrograde ? ", retrograde," : ""} in ${card.name}${houseClause}. ` +
    `${p.name} carries ${nPlanetSignifies(p.name)}.`);

  const dignity = card.dignity && card.dignity.kind ? card.dignity.kind : "neutral";
  if (dignity === "neutral") {
    parts.push(`In ${card.name} it holds no essential dignity either way: ${nDignityMeaning("neutral")}.`);
  } else {
    parts.push(`It sits in ${dignity} here, which is to say ${nDignityMeaning(dignity)}.`);
  }

  if (p.retrograde) {
    parts.push("Turning retrograde, that signification runs inward — reconsidered rather than asserted outward.");
  }

  if (card.aspect) {
    const orb = spokenOrb(card.aspect.sep);
    parts.push(`It takes ${aspectArticle(card.aspect.name)} ${String(card.aspect.name).toLowerCase()} from the Sun, ${orb}: ${nAspectMeaning(card.aspect.name)}.`);
  }

  if (timeKnown && typeof chart.ascSignIdx === "number" && card.idx === chart.ascSignIdx) {
    parts.push(`This is the rising sign itself — the lens the rest of the chart is read through.`);
  }

  // The eleventh lane spoken here is the PRINCIPAL BODY's own — arcsec mod
  // 11 of this chart's actual placement — not the sign midpoint's constant.
  // Before this, the sentence was identical for every person with the same
  // sign: decoration wearing the voice of content. card.laneR11 (the sign
  // midpoint's lane) remains what the resonance geometry uses.
  const laneOfPrincipal = card.principal && card.principal.residues
    ? card.principal.residues.r11
    : card.laneR11;
  const laneHolder = card.principal ? card.principal.name : null;
  parts.push(laneHolder
    ? `Beneath it, the eleventh lane of ${laneHolder} runs as ${nLaneName(laneOfPrincipal)}.`
    : `Beneath it, the eleventh lane runs as ${nLaneName(card.laneR11)}.`);
  return parts.join(" ");
}

function aspectArticle(name) {
  return /^[aeiou]/i.test(String(name)) ? "an" : "a";
}

// Pairs of visible bodies sharing an eleventh-lane residue in THIS chart —
// the same coincidences the Prime Resonance lattice draws, computed from
// the planets' real arcseconds (never the sign-midpoint constants). The
// nodes' two ends share a lane only by construction (they oppose), so the
// South Node is excluded.
const SHADOW_CONTACT_BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];
function shadowLaneContacts(chart) {
  const ps = (chart.planets || []).filter(p => SHADOW_CONTACT_BODIES.includes(p.name) && p.residues);
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      if (ps[i].residues.r11 === ps[j].residues.r11) {
        out.push({ a: ps[i].name, b: ps[j].name, lane: ps[i].residues.r11 });
      }
    }
  }
  return out;
}

// ── the closing ───────────────────────────────────────────────────────

function narrativeClosing(chart) {
  const lines = [];
  const dominant = dominantElement(chart);
  const stelliums = (chart.stelliums || []).length;

  lines.push("That is the whole wheel.");
  if (dominant) {
    lines.push(`It runs ${String(dominant.name).toLowerCase()}-heavy, and that is the grain to work with rather than against.`);
  }
  if (stelliums > 0) {
    lines.push(`${stelliums === 1 ? "One sign is" : `${stelliums} signs are`} loaded past the ordinary — that concentration is where the pressure of this chart actually sits.`);
  }
  if (chart.voidOfCourse && chart.voidOfCourse.isVoc) {
    lines.push("The Moon was void of course at the moment of birth: whatever it was carrying had already finished being decided.");
  }

  // The substrate's own two closing facts — both computed from this chart's
  // actual arcseconds, both stated as coincidences rather than aspects, per
  // CLAIM_BOUNDARY: no meaning is asserted that the arithmetic doesn't carry.
  const contacts = shadowLaneContacts(chart);
  if (contacts.length > 0) {
    const c = contacts[0];
    const others = contacts.length - 1;
    lines.push(`In the eleventh lane, ${c.a} and ${c.b} fall together — lane ${c.lane}, ${nLaneName(c.lane)}${others > 0 ? `, with ${others} more such ${others === 1 ? "pairing" : "pairings"} behind it` : ""}. That is a substrate coincidence, not a classical aspect — most charts carry several — but it is a correspondence the traditional reading has no name for.`);
  }
  const closures = (chart.planets || []).filter(p => SHADOW_CONTACT_BODIES.includes(p.name) && p.residues && p.residues.r11 === 0);
  if (closures.length > 0) {
    const names = closures.map(p => p.name).join(" and ");
    lines.push(`${names} ${closures.length === 1 ? "sits" : "sit"} at lane zero — the shadow lane's closure point, a property of the exact arcsecond, not of the sign.`);
  }

  lines.push("The classical reading is the reading. The eleventh lane only adds what it could never see.");
  return lines.join(" ");
}

// The chart is not fixed at birth — the same arithmetic reaches forward.
// This composes lifecycleDigest's (time.jsx) already-computed facts about
// ONE target instant (age, which return is in force, which bodies share
// their natal shadow lane) into the same plain-sentence register the
// opening and closing use. It computes nothing of its own — reusing the
// identical prose the Cylindrical Time panel shows in table form, so the
// spoken reading and the panel never say two different things about the
// same moment. Requires time.jsx's lifecycleDigest to be loaded; returns
// "" (and buildChartNarrative adds no segment) when it is not, or when no
// jdTarget is given — this stays fully opt-in.
function narrativeLifecycle(chart, jdTarget) {
  if (!chart || typeof lifecycleDigest !== "function" || !Number.isFinite(jdTarget)) return "";
  const digest = lifecycleDigest(chart, jdTarget);
  if (!digest || !Array.isArray(digest.lines) || digest.lines.length === 0) return "";
  return digest.lines.join(" ");
}

// ── assembly ──────────────────────────────────────────────────────────

/**
 * Compose the chart as one narrative.
 *
 * `agentTexts` optionally supplies the AI interpreter's text for a card by
 * card index; where present it replaces this file's locally-composed
 * sentences for that card, so turning the Agent interpreter on upgrades the
 * narration in place instead of switching to a different playback path.
 *
 * `jdTarget` optionally names the instant "right now" means. When given, one
 * extra segment closes the piece: the same lifecycleDigest facts the
 * Cylindrical Time panel shows in tables (age, return status, shared shadow
 * lanes), read as prose. Omitted (the default), the narrative is exactly
 * the birth chart with no live-time dependency, as it always was — every
 * existing caller that does not pass it sees byte-identical output.
 *
 * `lifecycleText`, when given (even ""), is used verbatim for that segment
 * INSTEAD of computing it from `jdTarget` — for a caller that recomposes the
 * narrative on every render for reasons unrelated to the target instant
 * (session.jsx rebuilds it whenever the Agent interpreter's text for the
 * on-screen card changes) and would otherwise re-run lifecycleDigest's
 * ephemeris-backed return casts on every one of those reruns. Compute it
 * once, in a memo keyed only on the chart and the target, and pass the
 * string here; `jdTarget` stays the direct, self-contained way to ask for
 * the same segment when recomputing it every call is cheap enough (as it is
 * for a one-off call, a test, or any caller whose own memo already keys on
 * exactly `[chart, jdTarget]`).
 *
 * Returns `{ text, segments }`. Every segment carries `{ index, kind,
 * cardIdx, title, text, start, end }` where `[start, end)` is its character
 * range inside `text` — the ranges playback syncs the deck against.
 */
function buildChartNarrative(chart, { agentTexts = null, joiner = "\n\n", jdTarget = null, lifecycleText = null } = {}) {
  if (!chart || !Array.isArray(chart.cards)) return { text: "", segments: [] };
  const order = (typeof deckOrder === "function") ? deckOrder(chart) : chart.cards.map((_, i) => i);

  const raw = [];
  raw.push({ kind: "opening", cardIdx: null, title: "The chart", text: narrativeOpening(chart) });

  order.forEach((idx, n) => {
    const card = chart.cards[idx];
    if (!card) return;
    const agentText = agentTexts && agentTexts[idx];
    raw.push({
      kind: "card",
      cardIdx: idx,
      title: `${card.principal.name} in ${card.name}`,
      text: agentText || narrativeForCard(card, chart, { first: n === 0 }),
    });
  });

  raw.push({ kind: "closing", cardIdx: null, title: "The whole", text: narrativeClosing(chart) });

  const resolvedLifecycleText = lifecycleText != null
    ? lifecycleText
    : (Number.isFinite(jdTarget) ? narrativeLifecycle(chart, jdTarget) : "");
  if (resolvedLifecycleText) raw.push({ kind: "lifecycle", cardIdx: null, title: "Right now", text: resolvedLifecycleText });

  // Character ranges are assigned against the SAME joiner the text is built
  // with, so an offset always indexes the string that is actually spoken.
  const segments = [];
  let text = "";
  raw.forEach((seg, i) => {
    if (i > 0) text += joiner;
    const start = text.length;
    text += seg.text;
    segments.push({ ...seg, index: i, start, end: text.length });
  });
  return { text, segments };
}

/**
 * Split a narrative into request-sized chunks at SEGMENT boundaries.
 *
 * Never mid-segment: a chunk edge is a hard cut in the audio, and putting
 * one inside a sentence is audible. A single segment longer than the limit
 * becomes its own oversized chunk rather than being sliced — the provider
 * will refuse it and the caller falls back, which is a better failure than
 * a reading chopped mid-clause.
 */
function chunkNarrative(segments, maxChars = NARRATIVE_MAX_CHARS, joiner = "\n\n") {
  const chunks = [];
  let current = null;
  for (const seg of segments) {
    const addition = current ? joiner.length + seg.text.length : seg.text.length;
    if (current && current.text.length + addition > maxChars) {
      chunks.push(current);
      current = null;
    }
    if (!current) {
      current = { segments: [], text: "", offsets: [] };
    }
    if (current.segments.length) current.text += joiner;
    const start = current.text.length;
    current.text += seg.text;
    current.segments.push(seg);
    current.offsets.push({ index: seg.index, cardIdx: seg.cardIdx, start, end: current.text.length });
  }
  if (current && current.segments.length) chunks.push(current);
  return chunks;
}

/**
 * Convert a chunk's character offsets into playback times using ElevenLabs
 * character-level alignment (`character_start_times_seconds`, one entry per
 * character of the text that was actually spoken).
 *
 * The alignment array and the request text can differ in length — the API
 * normalizes some characters — so an out-of-range index clamps to the last
 * known time rather than producing NaN and desynchronising the deck.
 */
function segmentTimingsFromAlignment(chunk, alignment) {
  const starts = alignment && (alignment.character_start_times_seconds || alignment.characterStartTimesSeconds);
  if (!Array.isArray(starts) || !starts.length) return null;
  const at = (i) => starts[Math.max(0, Math.min(starts.length - 1, i))];
  return chunk.offsets.map(o => ({
    index: o.index,
    cardIdx: o.cardIdx,
    startSec: at(o.start),
    endSec: at(Math.max(o.start, o.end - 1)),
  }));
}

/**
 * Fallback timing: distribute a chunk's duration across its text by
 * character count. Speech is not uniform per character, so this drifts —
 * but it drifts within one chunk of a few thousand characters, and it is
 * the difference between a deck that roughly follows the voice and one that
 * ignores it entirely.
 */
function segmentTimingsFromDuration(chunk, durationSec) {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !chunk.text.length) return null;
  const perChar = durationSec / chunk.text.length;
  return chunk.offsets.map(o => ({
    index: o.index,
    cardIdx: o.cardIdx,
    startSec: o.start * perChar,
    endSec: o.end * perChar,
  }));
}

Object.assign(window, {
  buildChartNarrative,
  narrativeForCard,
  narrativeOpening,
  narrativeClosing,
  narrativeLifecycle,
  chunkNarrative,
  segmentTimingsFromAlignment,
  segmentTimingsFromDuration,
  spokenOrb,
  spokenDate,
  NARRATIVE_MAX_CHARS,
});
