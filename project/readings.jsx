// readings.jsx — declarative readings + rigorous math for each card.
// No metaphor, no poetry. Each line states the structural fact and what
// the placement does, in operational language. The Mayan CRT substrate
// (Safe Basis primes, M_SAFE = 30030, mod-11 shadow, mod-13 boundary)
// is the source of every number cited here.

const DIGNITY_STATEMENT = {
  domicile:   "in domicile. Acts at full rulership; +5 dignity. Output unfiltered.",
  exaltation: "in exaltation. Amplified; +4 dignity. Effects exceed baseline.",
  detriment:  "in detriment. Opposed to its sign of rulership; −5 dignity. Effort runs against the grain.",
  fall:       "in fall. −4 dignity. Action returns muted; mastery requires compensation.",
  neutral:    "in neutral sign. 0 dignity. Standard operation, no modifier.",
};

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
  Fire:  "ignition: triggers initiative.",
  Earth: "structure: holds form, retains.",
  Air:   "transmission: links, sorts, signals.",
  Water: "absorption: receives, processes affect.",
};

const MODALITY_FN = {
  Cardinal: "initiator — generates new vectors.",
  Fixed:    "stabilizer — preserves existing state.",
  Mutable:  "transducer — converts between states.",
};

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
  Conjunction: "co-located. Functions merge into one operator.",
  Opposition:  "180° axis. Operators negotiate by tension; bipolar exchange.",
  Trine:       "120° concord. Channel open; output unimpeded.",
  Square:      "90° friction. Operators conflict; produces structural pressure.",
  Sextile:     "60° opportunity. Channel available on activation.",
  Quincunx:    "150° mismatch. Operators do not align; requires adjustment.",
  Semisquare:  "45° low-level friction. Persistent irritation.",
  Quintile:    "72° creative angle. Non-classical harmonic; specialized output.",
  BiQuintile:  "144°. Twin facet of the 5-fold harmonic.",
  Septile:     "≈51.43° (1/7). Non-rational; outside classical orbs.",
  Undecile:    "≈32.73° (1/11). SHADOW PRIME contact — invisible to classical reading.",
  Tredecile:   "≈27.69° (1/13). Boundary-prime contact — edge of integration.",
};

function readingFor(card) {
  const p = card.principal;
  const sign = card.name;
  const houseFn = HOUSE_FUNCTION[card.house];
  const dig     = DIGNITY_STATEMENT[card.dignity.kind];
  const planetFn  = PLANET_FN[p.name] || "agent.";
  const elemFn    = ELEMENT_FN[card.element];
  const modeFn    = MODALITY_FN[card.modality];

  const tenancy = card.tenants.length;
  const tenancyLine = tenancy === 0
    ? `Untenanted. Reading delegates to dispositor ${card.ruler}.`
    : tenancy === 1
    ? `Sole tenant: ${p.name}. Single-signature sector.`
    : `${tenancy} tenants: ${card.tenants.map(t => t.name).join(", ")}. Weighted sector.`;

  const aspectLine = card.aspect
    ? `Sun-${p.name} ${card.aspect.name} ${card.aspect.sep.toFixed(2)}° (orb ${card.aspect.orb}°, ${card.aspect.family}). ${ASPECT_FN[card.aspect.name] || ""}`
    : "No Sun-aspect within orb. Sector reads from intrinsic dignity only.";

  const retro = p.retrograde ? " Retrograde: effect inverted, internalized." : "";

  return {
    title: `${p.name} in ${sign}`,
    subtitle: `House ${roman(card.house)} · ${houseFn}`,
    body: [
      `${p.name} — ${planetFn} ${dig}`,
      `${sign}: ${card.element} (${elemFn}) · ${card.modality} (${modeFn})`,
      tenancyLine + retro,
      aspectLine,
    ],
  };
}

function roman(n) {
  return ["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n] || String(n);
}

// Rigorous mode: surface every CRT residue, lane, arcsec, dignity score.
function rigorousFor(card) {
  const p = card.principal;
  const r = p.residues;
  // Mayan-style gear coordinate: K = (r11 · 13 + r13)  mod 323
  const gearK = ((r.r11 * 13) + r.r13) % 323;
  return [
    { label: "λ arcsec",         value: Math.floor(p.arcsec).toLocaleString() },
    { label: "λ degrees",        value: p.lon.toFixed(4) + "°" },
    { label: "sign-index",       value: `${p.sign} (${card.name})` },
    { label: "house",            value: `H${card.house}` },
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
