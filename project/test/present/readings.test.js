// test/present/readings.test.js — WP-29: readings.jsx generates its
// narrative reading (readingFor) and rigorous data table (rigorousFor)
// from a `card` (computed by astro.jsx's computeNatal, see that file's
// header) and a `chart` (the object computeNatal returns, carrying
// chart.timeUnknown — set by WP-18 — and chart.ascSignIdx/isDayChart).
//
// readings.jsx is a plain browser classic script (Object.assign(window,
// {...}), no `export`), so — following test/present/astro-core-lots.test.js
// (WP-22)'s precedent exactly — it is loaded UNMODIFIED via node:vm against
// a minimal `window` stub rather than imported.
//
// This suite checks the three WP-29 acceptance properties against a single
// fixed, synthetic card/chart pair (a Sun-in-Leo, domicile, day-chart,
// Sun-Leo-is-the-Ascendant placement with a Sun-Venus trine — every field
// consumed by readingFor/rigorousFor is populated so no branch is
// skipped), varying only `chart.timeUnknown`:
//   1. timeUnknown: true  → no house-number language, no Ascendant-sign
//      reference anywhere in the generated text.
//   2. timeUnknown: false → the SAME card/chart (via the SAME code path)
//      DOES produce house-number and Ascendant-sign language — the
//      positive control that proves (1) isn't just "this feature never
//      fires".
//   3. Every statement in reading.body carries a non-empty sourceTag that
//      names a real astro-core.js/astro.jsx computation (dignity, sect,
//      triplicity, term/face, aspect, tenancy, Ascendant) — never a blank
//      or placeholder tag.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function loadReadings() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, "readings.jsx"), "utf8"), sandbox, { filename: "readings.jsx" });
  return sandbox;
}

// A minimal but fully-populated card, matching the shape astro.jsx's
// computeNatal() actually builds (see astro.jsx ~line 410-489: idx, name,
// element, modality, ruler, house, tripLord, tripPart, term, face,
// inOwnTerm, inOwnFace, dignity, principal, tenants, aspect, resonance,
// laneR11, laneR13). Sun in Leo (idx 4), domicile, day chart, Leo also
// happens to be the Ascendant sign, tenanted solely by the Sun, in trine
// to Venus — every conditional branch in readingFor gets exercised.
function makeCard() {
  return {
    idx: 4,
    name: "Leo",
    element: "Fire",
    modality: "Fixed",
    ruler: "Sun",
    house: 5,
    tripLord: "Sun",
    tripPart: "Jupiter",
    term: "Jupiter",
    inOwnTerm: false,
    face: "Sun",
    inOwnFace: true,
    dignity: { kind: "domicile", score: 5 },
    principal: {
      name: "Sun",
      lon: 135.5,
      arcsec: 135.5 * 3600,
      sign: 4,
      retrograde: false,
      residues: { r2: 1, r3: 0, r5: 0, r7: 2, r11: 3, r13: 5 },
    },
    tenants: [{ name: "Sun", glyph: "☉" }],
    aspect: { name: "Trine", sep: 1.23, orb: 7, family: "classical", angle: 120 },
    resonance: 0.7,
    laneR11: 3,
    laneR13: 5,
  };
}

// Flatten a reading object (title/subtitle/body[{text,sourceTag}]) into one
// searchable string.
function flatten(reading) {
  return [reading.title, reading.subtitle, ...reading.body.map((b) => b.text)].join("\n");
}

// "house" immediately followed by a roman numeral or a digit — the shape
// readingFor actually emits ("House V", "House 5"), not just any sentence
// that happens to contain the word "house" (e.g. the withheld-placement
// disclosure text itself says "house placement withheld", which must NOT
// trip this).
const HOUSE_NUMBER_RE = /house\s+[ivxlcdm\d]/i;
const H_ROW_RE = /^H\d+$/; // rigorousFor's "house" row value when known

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const readings = loadReadings();
  const card = makeCard();

  const chartKnown = { timeUnknown: false, isDayChart: true, ascSignIdx: 4 };
  const chartUnknown = { timeUnknown: true, isDayChart: true, ascSignIdx: 4 };

  const known = readings.readingFor(card, chartKnown);
  const unknown = readings.readingFor(card, chartUnknown);
  const knownText = flatten(known);
  const unknownText = flatten(unknown);

  // ── 1. timeUnknown: true → no house-number / Ascendant-sign language ──
  t("unknown-time reading has no house-number language",
    !HOUSE_NUMBER_RE.test(unknownText), unknownText);
  t("unknown-time reading has no Ascendant reference",
    !/ascendant/i.test(unknownText), unknownText);
  t("unknown-time subtitle discloses the omission instead of a house number",
    unknown.subtitle.toLowerCase().includes("unknown") && !HOUSE_NUMBER_RE.test(unknown.subtitle),
    unknown.subtitle);

  // ── 2. Positive control: SAME card/chart, only timeUnknown flipped ────
  t("known-time reading DOES contain house-number language",
    HOUSE_NUMBER_RE.test(knownText), knownText);
  t("known-time reading DOES reference the Ascendant (this card is the ASC sign)",
    /ascendant/i.test(knownText), knownText);
  t("known-time subtitle states the house in roman numerals",
    known.subtitle === "House V", known.subtitle);

  // ── 3. Every statement carries a non-empty, accurate source tag ───────
  const allStatements = [...known.body, ...unknown.body];
  t("every statement is a {text, sourceTag} pair with non-empty text",
    allStatements.every((s) => typeof s.text === "string" && s.text.trim().length > 0));
  t("every statement carries a non-empty, non-placeholder sourceTag",
    allStatements.every((s) =>
      typeof s.sourceTag === "string" &&
      s.sourceTag.trim().length > 0 &&
      !/^(tbd|todo|n\/a|unknown|placeholder)$/i.test(s.sourceTag.trim())
    ),
    JSON.stringify(allStatements.map((s) => s.sourceTag)));

  const knownTags = known.body.map((s) => s.sourceTag);
  t("dignity statement tagged \"Ptolemaic dignity\"",
    knownTags.includes("Ptolemaic dignity"), knownTags.join(" | "));
  t("sect statement tagged \"Hellenistic sect\" and names the day chart",
    known.body.some((s) => s.sourceTag === "Hellenistic sect" && /day chart/i.test(s.text)),
    knownTags.join(" | "));
  t("triplicity statement tagged \"Dorothean triplicity\" and names the actual tripLord",
    known.body.some((s) => s.sourceTag === "Dorothean triplicity" && s.text.includes(card.tripLord)),
    knownTags.join(" | "));
  t("term/face statement tagged with Ptolemy/Chaldean attribution",
    known.body.some((s) => /Ptolemy/.test(s.sourceTag) && s.text.includes(card.term)),
    knownTags.join(" | "));
  t("trine (classical family) aspect tagged \"Ptolemaic aspect\", not invented",
    known.body.some((s) => s.sourceTag === "Ptolemaic aspect" && s.text.includes("Trine")),
    knownTags.join(" | "));
  t("Ascendant callout (known-time only) tagged \"Ascendant (chart angle)\"",
    known.body.some((s) => s.sourceTag === "Ascendant (chart angle)"),
    knownTags.join(" | "));
  t("Ascendant callout is absent from the unknown-time body entirely",
    !unknown.body.some((s) => s.sourceTag === "Ascendant (chart angle)"),
    unknown.body.map((s) => s.sourceTag).join(" | "));

  // ── Phrasing is hedged, not flatly deterministic (soften per audit) ───
  t("dignity gloss uses hedged framing (\"often\"/\"tends to\"), not a flat assertion",
    /\b(often|tends to|typically|can favor)\b/i.test(
      known.body.find((s) => s.sourceTag === "Ptolemaic dignity").text
    ));

  // ── Aspect family → source tag: undecile/tredecile (this app's own
  // mod-11/13 substrate) must NOT be mislabeled as a classical tradition ──
  {
    const undecileCard = { ...card, aspect: { name: "Undecile", sep: 0.4, orb: 1.2, family: "undecile", angle: 360 / 11 } };
    const r = readings.readingFor(undecileCard, chartKnown);
    const tag = r.body.find((s) => s.text.startsWith("Sun-")).sourceTag;
    t("undecile aspect tagged as non-classical substrate harmonic, not a real tradition",
      /non-classical/i.test(tag) && !/ptolemaic/i.test(tag), tag);
  }

  // ── rigorousFor mirrors the same gating on its "house" row ────────────
  const mathKnown = readings.rigorousFor(card, chartKnown);
  const mathUnknown = readings.rigorousFor(card, chartUnknown);
  const houseRowKnown = mathKnown.find((row) => row.label === "house");
  const houseRowUnknown = mathUnknown.find((row) => row.label === "house");
  t("rigorousFor house row IS an H-number when time is known",
    H_ROW_RE.test(houseRowKnown.value), houseRowKnown.value);
  t("rigorousFor house row withholds the number when time is unknown",
    !H_ROW_RE.test(houseRowUnknown.value) && /unknown/i.test(houseRowUnknown.value),
    houseRowUnknown.value);

  return R;
}
