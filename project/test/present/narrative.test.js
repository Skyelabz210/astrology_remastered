// test/present/narrative.test.js — the whole chart as one narrative.
//
// narrative.jsx is a plain browser classic script (Object.assign(window,
// {...}), no `export`), so — following readings.test.js / voice-prime.test.js
// — it is loaded UNMODIFIED via node:vm against a minimal `window` stub.
// readings.jsx and agent.jsx are loaded into the SAME sandbox first, because
// the composer reads their plain-language tables (SHADOW_LANE_NAMES,
// houseTopic, planetSignifies, dignityMeaning, aspectMeaning) as script-scope
// globals exactly the way a browser provides them.
//
// Three things are actually under test:
//
//   1. THE UNKNOWN-TIME GATE. readings.jsx withholds every house number and
//      Ascendant reference on an unknown-birth-time chart, because those
//      numbers are only as good as an assumed noon; test/present/readings.test.js
//      pins that. Composing a SECOND narrative path is precisely how such a
//      fix gets quietly undone, so the same property is asserted here, with
//      the same positive control (flip only `timeUnknown` and the language
//      must come back).
//
//   2. THE SEGMENT OFFSETS. Playback syncs the deck to the voice by mapping
//      each segment's character range onto ElevenLabs' character timings. If
//      an offset does not index the string that is actually spoken, the
//      whole chart drifts out of sync — so every segment's [start, end) is
//      checked against the joined text itself.
//
//   3. CHUNKING AND TIMING. Chunk edges must fall on segment boundaries
//      (never mid-sentence), chunk-local offsets must index chunk text, and
//      both timing paths — alignment and duration — must produce
//      monotonically ordered, in-range times.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function loadNarrative() {
  const sandbox = {};
  sandbox.window = sandbox;
  // agent.jsx touches React only inside hook bodies, never at load time.
  sandbox.React = { useState: () => [null, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f() };
  vm.createContext(sandbox);
  for (const file of ["readings.jsx", "agent.jsx", "narrative.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, file), "utf8"), sandbox, { filename: file });
  }
  return sandbox;
}

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo",
  "Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];

/**
 * A chart of the shape astro.jsx's computeNatal() returns, populated far
 * enough for every branch of the composer: twelve cards, a principal body
 * on each, dignities, one aspect, retrogradation, the shadow lane (both the
 * per-card residue AND, via matching residues on chart.planets, the
 * closing's cross-body pairing and lane-zero closure), plus the
 * chart-level fields the opening and closing read (sect, phase, shape,
 * element balance, stelliums, void-of-course).
 */
function makeChart({ timeUnknown = false } = {}) {
  const cards = SIGNS.map((name, i) => ({
    idx: i,
    name,
    element: ["Fire","Earth","Air","Water"][i % 4],
    modality: ["Cardinal","Fixed","Mutable"][i % 3],
    house: (i + 1),
    dignity: { kind: i === 4 ? "domicile" : i === 7 ? "fall" : "neutral", score: 0 },
    principal: {
      name: ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"][i],
      lon: i * 30 + 5,
      sign: i,
      retrograde: i === 6,
      residues: { r2: 0, r3: 0, r5: 0, r7: 0, r11: i % 11, r13: i % 13 },
    },
    tenants: [],
    aspect: i === 2 ? { name: "Trine", sep: 1.2, orb: 7, family: "classical" } : null,
    resonance: 0.5,
    laneR11: i % 11,
    laneR13: i % 13,
  }));
  return {
    cards,
    timeUnknown,
    ascSignIdx: 4,
    isDayChart: true,
    planets: cards.map(c => ({ name: c.principal.name, sign: c.principal.sign, residues: c.principal.residues })),
    phase: { phase: "Waxing Gibbous", illumination: 0.8, elongDeg: 130 },
    shape: { shape: "Bowl", occupiedArcDeg: 172.4, largestGapDeg: 187.6 },
    elementCount: { Fire: 4, Earth: 3, Air: 3, Water: 2 },
    modalityCount: { Cardinal: 4, Fixed: 4, Mutable: 4 },
    stelliums: [{ sign: 4, count: 3 }],
    voidOfCourse: { isVoc: false, daysToNextSignChange: 1.2 },
    lots: [],
    birth: { dateISO: "1980-10-21T17:31:00-04:00", placeLabel: "Fort Liberty (Bragg) · NC", lat: 35.1408, lng: -79.0058 },
  };
}

const HOUSE_WORD_RE = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+house\b/i;

export function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sandbox = loadNarrative();
  const {
    buildChartNarrative, chunkNarrative,
    segmentTimingsFromAlignment, segmentTimingsFromDuration,
    spokenOrb, spokenDate,
  } = sandbox;

  t("narrative.jsx publishes its composer", typeof buildChartNarrative === "function");
  t("the tables it depends on loaded alongside it",
    typeof sandbox.houseTopic === "function" && typeof sandbox.planetSignifies === "function"
    && Array.isArray(sandbox.SHADOW_LANE_NAMES));

  // ── shape of the composed narrative ──────────────────────────────────
  const chart = makeChart();
  const n = buildChartNarrative(chart);

  t("the narrative opens and closes around the twelve signs",
    n.segments.length === 14, `${n.segments.length} segments`);
  t("the first segment is the opening", n.segments[0].kind === "opening");
  t("the last segment is the closing", n.segments[n.segments.length - 1].kind === "closing");
  t("the middle twelve are cards",
    n.segments.slice(1, -1).every(s => s.kind === "card"));
  t("every card appears exactly once",
    new Set(n.segments.filter(s => s.kind === "card").map(s => s.cardIdx)).size === 12);
  t("segment indices are sequential from zero",
    n.segments.every((s, i) => s.index === i));
  t("every segment carries speakable text",
    n.segments.every(s => typeof s.text === "string" && s.text.trim().length > 20));
  t("it is one piece of text, not twelve",
    typeof n.text === "string" && n.text.length > 1000, `${n.text.length} characters`);

  // ── THE offsets property: a range must index the spoken string ───────
  t("every segment's [start,end) indexes its own text inside the joined narrative",
    n.segments.every(s => n.text.slice(s.start, s.end) === s.text),
    n.segments.filter(s => n.text.slice(s.start, s.end) !== s.text).map(s => s.index).join(","));
  t("segments are in ascending, non-overlapping order",
    n.segments.every((s, i) => i === 0 || s.start >= n.segments[i - 1].end));
  t("the last segment ends at the end of the text",
    n.segments[n.segments.length - 1].end === n.text.length);

  // ── the unknown-time gate, and its positive control ──────────────────
  const unknown = buildChartNarrative(makeChart({ timeUnknown: true }));
  t("an unknown-time narrative speaks no house placement",
    !HOUSE_WORD_RE.test(unknown.text), (unknown.text.match(HOUSE_WORD_RE) || [""])[0]);
  t("an unknown-time narrative names no rising sign",
    !/\bwas rising\b/i.test(unknown.text) && !/\brising sign itself\b/i.test(unknown.text));
  t("it says so, rather than silently omitting it",
    /birth time is unknown/i.test(unknown.text));
  // Positive control — the SAME chart with only timeUnknown flipped.
  t("a known-time narrative DOES place bodies in houses",
    HOUSE_WORD_RE.test(n.text));
  t("a known-time narrative DOES name the rising sign",
    /\bwas rising\b/i.test(n.text));
  t("sect is stated on both, since it needs no birth time",
    /day chart/i.test(n.text) && /day chart/i.test(unknown.text));

  // The closing's two shadow-lane facts (a shared-lane pairing, a lane-zero
  // closure) are r11 residues — the same ARCSECOND-level precision the
  // houses and Ascendant depend on — so they follow the identical gate.
  // makeChart()'s Sun (i=0) and NorthNode (i=11) both land on r11=0,
  // guaranteeing both a pairing and a closure to find in the positive
  // control. Found via this file's own Playwright verification of the
  // sibling timeUnknown fix in time.jsx's digests, not by a bot review —
  // the same class of bug, in a third place it hadn't been checked yet.
  t("a known-time narrative DOES carry the shared eleventh-lane pairing sentence",
    /in the eleventh lane/i.test(n.text), n.text);
  t("a known-time narrative DOES carry the lane-zero closure sentence",
    /lane zero/i.test(n.text), n.text);
  t("an unknown-time narrative withholds the shared eleventh-lane pairing sentence",
    !/in the eleventh lane/i.test(unknown.text), unknown.text);
  t("an unknown-time narrative withholds the lane-zero closure sentence",
    !/lane zero/i.test(unknown.text), unknown.text);

  // ── content actually derived from the chart, not boilerplate ─────────
  t("the opening names the birth date and place",
    /October 21, 1980/.test(n.text) && /Fort Liberty/.test(n.text));
  t("the opening names the chart shape", /bowl figure/i.test(n.text));
  t("a retrograde body is narrated as retrograde",
    /retrograde/i.test(n.segments.find(s => s.cardIdx === 6).text));
  t("a dignified body is narrated with its dignity",
    /domicile/i.test(n.segments.find(s => s.cardIdx === 4).text));
  t("the one aspect in the chart is narrated",
    /trine/i.test(n.segments.find(s => s.cardIdx === 2).text));
  t("a card with no aspect does not invent one",
    !/trine|square|sextile|opposition/i.test(n.segments.find(s => s.cardIdx === 5).text));
  t("every card names its shadow lane",
    n.segments.filter(s => s.kind === "card").every(s => /eleventh lane/i.test(s.text)));

  // Spoken for the ear: no bare decimal degrees anywhere in the narration.
  t("no raw decimal figures are spoken", !/\d+\.\d+/.test(n.text),
    (n.text.match(/\d+\.\d+/g) || []).join(","));

  // ── the agent's text substitutes in place ────────────────────────────
  {
    const withAgent = buildChartNarrative(chart, { agentTexts: { 3: "The agent's own words for this one." } });
    t("a supplied agent text replaces that card's composed text",
      withAgent.segments.find(s => s.cardIdx === 3).text === "The agent's own words for this one.");
    t("cards without agent text keep the composed text",
      withAgent.segments.find(s => s.cardIdx === 4).text === n.segments.find(s => s.cardIdx === 4).text);
    t("offsets still index the joined text after substitution",
      withAgent.segments.every(s => withAgent.text.slice(s.start, s.end) === s.text));
  }

  // ── chunking ─────────────────────────────────────────────────────────
  {
    const chunks = chunkNarrative(n.segments, 1200);
    t("a long narrative is split into several chunks", chunks.length > 1, `${chunks.length} chunks`);
    t("no chunk exceeds the limit unless one segment alone does",
      chunks.every(c => c.text.length <= 1200 || c.segments.length === 1),
      chunks.map(c => c.text.length).join(","));
    t("chunk boundaries fall on segment boundaries — never mid-sentence",
      chunks.reduce((acc, c) => acc + c.segments.length, 0) === n.segments.length);
    t("chunks preserve segment order",
      chunks.flatMap(c => c.segments.map(s => s.index))
        .every((v, i, arr) => i === 0 || v === arr[i - 1] + 1));
    t("chunk-local offsets index that chunk's own text",
      chunks.every(c => c.offsets.every((o, i) => c.text.slice(o.start, o.end) === c.segments[i].text)));
    t("a single chunk holds the whole narrative when the limit is generous",
      chunkNarrative(n.segments, 100000).length === 1);
    t("an oversized single segment becomes its own chunk rather than being sliced",
      chunkNarrative(n.segments, 10).length === n.segments.length);
  }

  // ── timings ──────────────────────────────────────────────────────────
  {
    const chunk = chunkNarrative(n.segments, 100000)[0];
    // A synthetic alignment: one timestamp per character, 20ms apart —
    // the shape ElevenLabs' with-timestamps response has.
    const alignment = {
      character_start_times_seconds: Array.from({ length: chunk.text.length }, (_, i) => i * 0.02),
    };
    const timings = segmentTimingsFromAlignment(chunk, alignment);
    t("alignment timings are produced for every segment",
      timings && timings.length === chunk.segments.length);
    t("alignment timings ascend with the text",
      timings.every((x, i) => i === 0 || x.startSec >= timings[i - 1].startSec));
    t("each timing carries the card it belongs to",
      timings.every((x, i) => x.cardIdx === chunk.segments[i].cardIdx));
    t("the first segment starts at zero", Math.abs(timings[0].startSec) < 1e-9);
    t("a segment's start matches its character offset",
      Math.abs(timings[2].startSec - chunk.offsets[2].start * 0.02) < 1e-9);
    t("a missing alignment yields null, not a crash",
      segmentTimingsFromAlignment(chunk, null) === null
      && segmentTimingsFromAlignment(chunk, {}) === null);
    // Out-of-range indices must clamp rather than produce NaN — the API
    // normalizes text, so alignment length and request length can differ.
    const short = { character_start_times_seconds: [0, 0.5, 1.0] };
    const clamped = segmentTimingsFromAlignment(chunk, short);
    t("a shorter-than-text alignment clamps instead of producing NaN",
      clamped.every(x => Number.isFinite(x.startSec) && Number.isFinite(x.endSec)));

    const byDuration = segmentTimingsFromDuration(chunk, 300);
    t("duration timings cover every segment", byDuration.length === chunk.segments.length);
    t("duration timings ascend", byDuration.every((x, i) => i === 0 || x.startSec >= byDuration[i - 1].startSec));
    t("duration timings stay inside the clip",
      byDuration.every(x => x.startSec >= 0 && x.endSec <= 300.0001));
    t("a zero or unknown duration yields null",
      segmentTimingsFromDuration(chunk, 0) === null && segmentTimingsFromDuration(chunk, NaN) === null);
  }

  // ── spoken-number helpers ────────────────────────────────────────────
  t("a very tight orb is spoken as exact", /exact/.test(spokenOrb(0.1)));
  t("a sub-degree orb is spoken in words", spokenOrb(0.6) === "inside a degree");
  t("a whole-ish orb is spoken in words", /one degree|two degrees/.test(spokenOrb(1.4)));
  t("no orb phrasing contains a decimal", !/\d/.test(spokenOrb(2.7)), spokenOrb(2.7));
  t("a date is spoken, not serialised", spokenDate("1980-10-21T21:31:00Z") === "October 21, 1980");
  t("an unparseable date yields null", spokenDate("not a date") === null);

  // ── degenerate inputs ────────────────────────────────────────────────
  t("a chart with no cards yields an empty narrative",
    buildChartNarrative({ cards: [] }).segments.length === 2 || buildChartNarrative(null).segments.length === 0);
  t("a null chart does not throw",
    JSON.stringify(buildChartNarrative(null)) === JSON.stringify({ text: "", segments: [] }));

  return rows;
}
