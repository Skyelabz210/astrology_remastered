// readings.jsx — declarative readings + rigorous math for each card.
// No metaphor, no poetry. Each line states the structural fact and what
// the placement does, in operational language. The Mayan CRT substrate
// (Safe Basis primes, M_SAFE = 30030, mod-11 shadow, mod-13 boundary)
// is the source of every number cited here.
//
// WP-29: every statement in the generated reading is grounded in an
// actually-computed value (dignity, sect, triplicity, term/face, aspect —
// all produced by src/present/astro-core.js / astro.jsx, never boilerplate
// keyed only on the zodiac sign) and carries a `sourceTag` naming the
// tradition or method that produced it, so the UI can show provenance
// per line instead of one undifferentiated block of prose. Phrasing is
// hedged ("often", "tends to") rather than flatly deterministic, per the
// audit's UX guidance — the numbers (dignity score, orb, degree) are
// stated as fact because they ARE computed facts; the interpretive gloss
// that follows them is stated as a tendency, because that's what a
// symbolic reading actually is.
//
// House- and Ascendant-dependent language (house number, house topic,
// Ascendant sign) is only meaningful when the birth time is real — an
// unknown time still lets astro.jsx compute planetary sign positions (WP-18
// assumes local noon for those), but the Ascendant/MC/houses drift up to
// ~1° per 4 minutes of clock error, so presenting a specific house number
// or Ascendant sign as fact would be misleading. Every such statement below
// is gated behind `!chart.timeUnknown` (chart.timeUnknown is set by
// astro.jsx's computeNatal, WP-18).

const DIGNITY_STATEMENT = {
  domicile:   "in domicile (+5 dignity). This placement often operates near full rulership — expression tends to run unfiltered.",
  exaltation: "in exaltation (+4 dignity). Effects here often amplify beyond baseline.",
  detriment:  "in detriment (−5 dignity), opposed to its sign of rulership — effort in this sector often runs against the grain.",
  fall:       "in fall (−4 dignity). Output here often reads as muted; mastery tends to require compensation.",
  neutral:    "in a neutral sign (0 dignity) — no strong dignity modifier either way.",
};

// Source tag for the essential-dignity statement above: domicile,
// exaltation, detriment, fall are the four classical Ptolemaic dignities
// (see astro-core.js DOMICILE/EXALT tables + dignityFor, WP-21).
const DIGNITY_SOURCE_TAG = "Ptolemaic dignity";

const HOUSE_FUNCTION = [
  null,
  "Self, body, identity vector.",
  "Resources, owned substance, retained value.",
  "Communication, siblings, short-range cognition.",
  "Home, lineage, foundation, terminus.",
  "Creation, offspring, risk, projected force.",
  "Labor, regimen, health, daily method.",
  "Partnership, mirrored other, open contracts.",
  "Shared resource, transformation, death.",
  "Doctrine, long-range travel, higher law.",
  "Career, public function, structural position.",
  "Networks, alliances, projected outcomes.",
  "Unseen, dissolution, internal process.",
];

const ELEMENT_FN = {
  Fire:  "ignition: tends to trigger initiative.",
  Earth: "structure: tends to hold form, retain.",
  Air:   "transmission: tends to link, sort, signal.",
  Water: "absorption: tends to receive, process affect.",
};

const MODALITY_FN = {
  Cardinal: "initiator — tends to generate new vectors.",
  Fixed:    "stabilizer — tends to preserve existing state.",
  Mutable:  "transducer — tends to convert between states.",
};

// Source tag for the element/modality line: the fourfold elements and
// three modalities (quadruplicities) are the classical Hellenistic
// qualification of each sign, independent of any planet in it.
const QUALITY_SOURCE_TAG = "Classical sign qualities (element & modality)";

const PLANET_FN = {
  Sun:      "identity vector; primary signature.",
  Moon:     "state buffer; affective memory.",
  Mercury:  "signal router; cognition.",
  Venus:    "valuation function; attraction operator.",
  Mars:     "force application; directed effort.",
  Jupiter:  "expansion coefficient; gain.",
  Saturn:   "constraint operator; tested boundary.",
  Uranus:   "discontinuity; phase break.",
  Neptune:  "filter dissolve; field permeability.",
  Pluto:    "compulsion engine; structural rewrite.",
  NorthNode:"directional axis; karmic vector.",
  Chiron:   "wound coordinate; integration site.",
};

const ASPECT_FN = {
  Conjunction: "co-located — functions tend to merge into one operator.",
  Opposition:  "180° axis — operators tend to negotiate by tension, a bipolar exchange.",
  Trine:       "120° concord — the channel is often open, output largely unimpeded.",
  Square:      "90° friction — operators are often in structural tension.",
  Sextile:     "60° opportunity — a channel is available here on activation.",
  Quincunx:    "150° mismatch — the operators don't natively align; some adjustment is usually required.",
  Semisquare:  "45° low-level friction — often a persistent, minor irritation rather than a crisis.",
  Quintile:    "72° creative angle — a non-classical harmonic, often reads as a specialized, idiosyncratic output.",
  BiQuintile:  "144° — the twin facet of the 5-fold harmonic, similarly specialized.",
  Septile:     "≈51.43° (1/7) — non-rational, outside the classical orbs; effects here are speculative.",
  Undecile:    "≈32.73° (1/11) — a SHADOW PRIME contact, invisible to classical reading; substrate-only correspondence.",
  Tredecile:   "≈27.69° (1/13) — a boundary-prime contact; substrate-only correspondence at the edge of integration.",
};

// Per-aspect-family source tag: which tradition (if any) actually
// recognizes this angle. cardinal/classical are the five Ptolemaic
// aspects; "minor" are the standard medieval additions; quintile/septile
// are recognized modern harmonic aspects but not part of the Ptolemaic
// set; undecile/tredecile exist only because this app's own CRT substrate
// (mod 11 / mod 13 lanes, astro-core.js ASPECTS table) defines them — they
// have no basis in any historical tradition, and the tag says so plainly
// rather than borrowing a classical name they don't earn.
const ASPECT_FAMILY_SOURCE_TAG = {
  cardinal:   "Ptolemaic aspect",
  classical:  "Ptolemaic aspect",
  minor:      "Medieval minor aspect",
  quintile:   "Quintile harmonic (non-Ptolemaic)",
  septile:    "Septile harmonic (non-Ptolemaic)",
  undecile:   "Substrate harmonic (mod-11, non-classical)",
  tredecile:  "Substrate harmonic (mod-13, non-classical)",
};

function readingFor(card, chart) {
  chart = chart || {};
  const p = card.principal;
  const sign = card.name;
  const houseFn = HOUSE_FUNCTION[card.house];
  const dig     = DIGNITY_STATEMENT[card.dignity.kind];
  const planetFn  = PLANET_FN[p.name] || "agent.";
  const elemFn    = ELEMENT_FN[card.element];
  const modeFn    = MODALITY_FN[card.modality];
  const timeKnown = !chart.timeUnknown;

  const body = [];

  // ── Dignity (Ptolemaic) — always available; grounded in card.dignity,
  // which astro.jsx computed via AstroCore.dignityFor against this card's
  // actual principal body and sign. ──────────────────────────────────────
  body.push({
    text: `${p.name} — ${planetFn} ${dig}`,
    sourceTag: DIGNITY_SOURCE_TAG,
  });

  body.push({
    text: `${sign}: ${card.element} (${elemFn}) · ${card.modality} (${modeFn})`,
    sourceTag: QUALITY_SOURCE_TAG,
  });

  // ── Sect + triplicity — previously computed by astro.jsx (isDayChart,
  // tripLord) but never surfaced in the narrative reading; only shown in
  // card.jsx's separate "classical apparatus" grid. Grounding the prose in
  // it closes that gap. Sect membership doesn't need a real clock time to
  // be well-defined when birth.sect is set explicitly ("day"/"night"); it
  // only depends on the Ascendant (and so on an accurate birth time) when
  // sect is "auto" — astro-core.js's sectIsDay compares the Sun to the
  // Ascendant in that case. We don't have a direct isDayChart-was-derived-
  // from-Asc flag here, so when the time is unknown we soften the sect
  // line to flag that uncertainty rather than asserting it outright. ─────
  if (typeof chart.isDayChart === "boolean") {
    const sectWord = chart.isDayChart ? "day" : "night";
    const uncertainty = timeKnown ? "" : " (birth time unknown — this determination may be unreliable)";
    body.push({
      text: `Sect: this reads as a ${sectWord} chart${uncertainty}. Sect membership can favor how a planet's signification tends to express.`,
      sourceTag: "Hellenistic sect",
    });

    if (card.tripLord) {
      body.push({
        text: `Triplicity: for a ${card.element}-triplicity sign in a ${sectWord} chart, the ruler is ${card.tripLord}${card.tripPart ? ` (participating: ${card.tripPart})` : ""} — this often colors the placement's underlying temperament.`,
        sourceTag: "Dorothean triplicity",
      });
    }
  }

  // ── Term / face — computed (astro-core.js termRuler/faceRuler) but,
  // like triplicity, previously absent from the narrative body. ─────────
  if (card.term || card.face) {
    const termClause = card.term
      ? `bound (term) ruler ${card.term}${card.inOwnTerm ? " — the principal sits in its own bound, a minor reinforcing dignity" : ""}`
      : null;
    const faceClause = card.face
      ? `face (decan) ruler ${card.face}${card.inOwnFace ? " — also its own face" : ""}`
      : null;
    const clauses = [termClause, faceClause].filter(Boolean).join("; ");
    if (clauses) {
      body.push({
        text: `${clauses}.`,
        sourceTag: "Egyptian terms & Chaldean faces (Ptolemy)",
      });
    }
  }

  // ── Tenancy — which bodies actually occupy this sign. Sign-based, not
  // house-based, so this is safe to show regardless of chart.timeUnknown. ─
  const tenancy = card.tenants.length;
  const tenancyText = tenancy === 0
    ? `Untenanted. Reading delegates to dispositor ${card.ruler}.`
    : tenancy === 1
    ? `Sole tenant: ${p.name}. Single-signature sector.`
    : `${tenancy} tenants: ${card.tenants.map(t => t.name).join(", ")}. Weighted sector.`;
  body.push({ text: tenancyText, sourceTag: "Sign tenancy (occupancy census)" });

  if (p.retrograde) {
    body.push({
      text: "Retrograde: this often reads as an internalized or reconsidered expression of the function above, rather than a literal reversal.",
      sourceTag: "Ephemeris (retrograde motion)",
    });
  }

  // ── Aspect to the Sun — grounded in card.aspect, which astro.jsx
  // computed via AstroCore.nearestAspect against the real Sun-principal
  // separation for this chart. ───────────────────────────────────────────
  if (card.aspect) {
    const fn = ASPECT_FN[card.aspect.name] || "";
    body.push({
      text: `Sun-${p.name} ${card.aspect.name} ${card.aspect.sep.toFixed(2)}° (orb ${card.aspect.orb}°, ${card.aspect.family}). ${fn}`,
      sourceTag: ASPECT_FAMILY_SOURCE_TAG[card.aspect.family] || "Aspect (astro-core.js orb table)",
    });
  } else {
    body.push({
      text: "No Sun-aspect within orb. This sector reads from intrinsic dignity alone.",
      sourceTag: "Aspect scan (Sun-relative, astro-core.js orb table)",
    });
  }

  // ── House placement — gated. astro.jsx still assigns every card a
  // `house` number even when the birth time is unknown (WP-18 assumes
  // local noon), but that number is only as good as the assumed clock
  // time, so it is withheld from the reading text rather than presented
  // as fact. ──────────────────────────────────────────────────────────────
  const subtitle = timeKnown
    ? `House ${roman(card.house)}`
    : `Birth time unknown · house placement withheld`;

  if (timeKnown) {
    body.push({
      text: `House ${roman(card.house)}: ${houseFn}`,
      sourceTag: "Whole-sign / equal house placement",
    });
  }

  // ── Ascendant callout — gated the same way, and only relevant for the
  // one card whose sign IS the rising sign (chart.ascSignIdx, from
  // astro.jsx's ascendantDeg). Like the house number, the Ascendant's
  // sign is only as accurate as the assumed birth time. ──────────────────
  if (timeKnown && typeof chart.ascSignIdx === "number" && card.idx === chart.ascSignIdx) {
    body.push({
      text: `${sign} is the Ascendant — the rising sign this whole chart is measured from, and its own house/identity lens.`,
      sourceTag: "Ascendant (chart angle)",
    });
  }

  return {
    title: `${p.name} in ${sign}`,
    subtitle,
    body,
  };
}

function roman(n) {
  return ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n] || String(n);
}

// Rigorous mode: surface every CRT residue, lane, arcsec, dignity score.
// `chart` is optional (defaults to {}) so existing callers that only ever
// used this in a "time known" context keep working; when
// chart.timeUnknown is true the house row is withheld the same way the
// narrative reading withholds it above.
function rigorousFor(card, chart) {
  chart = chart || {};
  const p = card.principal;
  const r = p.residues;
  // Mayan-style gear coordinate: K = (r11 · 13 + r13)  mod 323
  const gearK = ((r.r11 * 13) + r.r13) % 323;
  return [
    { label: "λ arcsec",         value: Math.floor(p.arcsec).toLocaleString() },
    { label: "λ degrees",        value: p.lon.toFixed(4) + "°" },
    { label: "sign-index",       value: `${p.sign} (${card.name})` },
    { label: "house",            value: chart.timeUnknown ? "— (birth time unknown)" : `H${card.house}` },
    { label: "dignity",          value: `${card.dignity.kind} (${card.dignity.score >= 0 ? "+" : ""}${card.dignity.score})` },
    { label: "retrograde",       value: p.retrograde ? "℞ yes" : "no" },
    { label: "r₂",               value: r.r2,  note: "parity" },
    { label: "r₃",               value: r.r3,  note: "modality lane" },
    { label: "r₅",               value: r.r5,  note: "element lane" },
    { label: "r₇",               value: r.r7,  note: "classical week" },
    { label: "r₁₁ shadow",       value: r.r11, note: "INVISIBLE LANE", shadow: true },
    { label: "r₁₃ boundary",     value: r.r13, note: "edge lane" },
    { label: "K (gear)",         value: gearK, note: "mod 17·19 = 323" },
    { label: "card lane-11",     value: card.laneR11, note: SHADOW_LANE_NAMES[card.laneR11], shadow: true },
    { label: "card lane-13",     value: card.laneR13, note: BOUNDARY_LANE_NAMES[card.laneR13] },
    { label: "resonance ρ",      value: card.resonance.toFixed(4) },
    { label: "Δ to Sun",         value: card.aspect
      ? `${card.aspect.angle}° ± ${card.aspect.sep.toFixed(3)}° (${card.aspect.family})`
      : "—" },
  ];
}

const SHADOW_LANE_NAMES = [
  "Origin","Initiation","Mirror","Triad","Foundation","Bridge",
  "Threshold","Vortex","Crown","Reversal","Return",
];
const BOUNDARY_LANE_NAMES = [
  "Seed","Spark","Wave","Branch","Root","Stone","Ember","Smoke",
  "Mirror","Bone","Thread","Door","Veil",
];

// Statement issued to the user when rigorous mode opens — declares what
// the substrate is actually doing.
const SUBSTRATE_NOTE = [
  "Every longitude is stored as an integer arcsecond on the 1,296,000″ ring.",
  "The Safe Basis {2, 3, 5, 7, 11, 13} factors M_SAFE = 30,030.",
  "Classical astrology surfaces residues mod 2 (sect), 3 (modality), 5 (?), 7 (planetary week), 12 (signs).",
  "It is *blind* to mod 11. The Shadow Prime opens eleven lanes of correspondence the old reading could not see.",
  "Mod 13 names the Boundary lanes. The pair (r₁₁, r₁₃) gives a unique gear coordinate K ∈ [0, 323).",
  "Resonance ρ blends dignity, tenancy, aspect tightness, and proximity in the shadow lane to the Ascendant.",
];

Object.assign(window, {
  readingFor, rigorousFor, roman,
  SHADOW_LANE_NAMES, BOUNDARY_LANE_NAMES,
  DIGNITY_STATEMENT, ASPECT_FN, PLANET_FN,
  SUBSTRATE_NOTE,
});
