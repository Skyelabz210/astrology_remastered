// test/present/reading-export.test.js — the reading leaves as a file. (P29)
//
// Export turns the chart a person generated into one Markdown document —
// every card's reading, agent-interpreted where the cache has it, locally
// composed where it does not, the chart-level synthesis when one exists —
// and hands it to the browser as a download. Two properties matter enough
// to pin:
//
//   · exporting NEVER generates: it reads the cache and the local composer,
//     zero interpreter calls;
//   · it never throws: a host with no document, no Blob, or no URL simply
//     returns false.
//
// Same rig as reading-cache.test.js: the real agent.jsx in a node:vm
// sandbox, with readingFor stubbed (readings.jsx owns local composition and
// has its own suite).

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const agentSrc = readFileSync(join(ROOT, "agent.jsx"), "utf8");
const sessionSrc = readFileSync(join(ROOT, "session.jsx"), "utf8");

function makeSandbox({ withDocument = true } = {}) {
  const calls = { complete: [], clicks: [], revoked: [], appended: [], removed: [] };
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.setTimeout = (fn) => { fn(); return 0; };
  sandbox.React = {
    useState: (init) => [init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: (fn) => fn(),
    useCallback: (fn) => fn,
  };
  sandbox.claude = { complete: async (p) => { calls.complete.push(p); return "generated"; } };
  sandbox.Blob = function (parts, opts) { this.parts = parts; this.type = opts && opts.type; };
  sandbox.URL = {
    createObjectURL: (blob) => ({ blobURL: true, blob }),
    revokeObjectURL: (u) => calls.revoked.push(u),
  };
  if (withDocument) {
    sandbox.document = {
      createElement: () => {
        const a = { href: null, download: null, click: () => calls.clicks.push({ href: a.href, download: a.download }) };
        return a;
      },
      body: {
        appendChild: (el) => calls.appended.push(el),
        removeChild: (el) => calls.removed.push(el),
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(agentSrc, sandbox, { filename: "agent.jsx" });
  sandbox.buildCardPrompt = (card) => `prompt for ${card.principal.name}`;
  // the local composer, stubbed — readings.jsx's own suite covers the real one
  sandbox.readingFor = (card) => ({
    body: [
      { text: `${card.principal.name} holds its ground here.`, sourceTag: "Ptolemaic dignity table" },
      { text: "The house gives it work to do.", sourceTag: "house topics" },
    ],
  });
  sandbox.roman = (n) => ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] || String(n);
  sandbox.ZODIAC = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"].map((name) => ({ name }));
  return { sandbox, calls };
}

function fixture() {
  // shaped like astro.jsx's real cards: `house` lives on the CARD (session
  // and the prompt builder both read card.house) as well as the principal.
  const mk = (idx, name, sign, house, dignity, resonance) => ({
    idx, house, resonance, laneR11: idx % 11, laneR13: idx % 13,
    name: sign, glyph: "♏",
    principal: { name, glyph: "♂", sign, house, retrograde: idx === 1, lon: 200 + idx },
    dignity: { kind: dignity },
    aspect: { name: "trine", sep: 2.31 },
  });
  const cards = [
    mk(0, "Mars", "Scorpio", 5, "domicile", 0.512),
    mk(1, "Venus", "Libra", 4, "domicile", 0.401),
  ];
  const chart = {
    jd: 2444534.397, timeUnknown: false, isDayChart: true,
    asc: 12.34, ascSignIdx: 0, mc: 281.02, mcSignIdx: 9,
    phase: { phase: "Waning gibbous", illumination: 0.82 },
    birth: { dateISO: "1980-10-21T17:31:00-04:00", lat: 35.1408, lng: -79.0058, placeLabel: "Fort Liberty (Bragg) · NC", tz: "America/New_York" },
    cards,
    planets: [],
  };
  return { cards, chart };
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── the document itself ───────────────────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox();
    const { cards, chart } = fixture();
    // one card agent-interpreted (cached), one local
    sandbox.remember(sandbox.cacheKey(cards[0], chart), "Mars burns in its own house.");
    const md = sandbox.buildReadingMarkdown(chart, cards);

    t("the document opens with the title and the birth line",
      md.startsWith("# Resonance — Natal Reading") && md.includes("Fort Liberty (Bragg) · NC"));
    t("chart facts are stated once — sect, angles, lunar phase",
      md.includes("**Sect** Day") && md.includes("**Ascendant** 12.34°") && md.includes("**Lunar phase** Waning gibbous"));
    t("every card gets its own section",
      md.includes("## 01 · Mars in Scorpio — House V · domicile")
      && md.includes("## 02 · Venus ℞ in Libra — House IV · domicile"),
      md.split("\n").filter((l) => l.startsWith("## ")).join(" | "));
    t("a cached reading exports the agent's text", md.includes("Mars burns in its own house."));
    t("an uncached card exports the LOCAL reading — exporting never generates",
      md.includes("Venus holds its ground here. The house gives it work to do.")
      && md.includes("*Composed locally from the classical tables.*")
      && calls.complete.length === 0,
      `${calls.complete.length} interpreter calls`);
    t("the provenance count is honest", md.includes("1 of 2 readings are agent-interpreted"));

    // chart-level synthesis rides along when it exists
    sandbox.remember("chart:2444534.397:35.1408:-79.0058", "One life, reading as one chart.");
    const md2 = sandbox.buildReadingMarkdown(chart, cards);
    t("the chart-level synthesis is included when cached",
      md2.includes("## The chart as one") && md2.includes("One life, reading as one chart."));
  }
  {
    // an unknown birth time must not export unreliable angles or houses
    const { sandbox } = makeSandbox();
    const { cards, chart } = fixture();
    chart.timeUnknown = true;
    const md = sandbox.buildReadingMarkdown(chart, cards);
    t("time-unknown charts say so and withhold Ascendant/MC and house numbers",
      md.includes("Birth time unknown") && !md.includes("**Ascendant**") && md.includes("House —"));
  }

  // ── filename ──────────────────────────────────────────────────────────
  {
    const { sandbox } = makeSandbox();
    const { chart } = fixture();
    t("the filename carries the birth date",
      sandbox.exportFilename(chart) === "resonance-reading-1980-10-21.md");
    t("a chart with no parsable date still gets a filename",
      sandbox.exportFilename({ birth: {} }) === "resonance-reading-chart.md");
  }

  // ── the download mechanics ────────────────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox();
    const { cards, chart } = fixture();
    const ok = sandbox.exportReading(chart, cards);
    t("exportReading hands the browser one download",
      ok === true && calls.clicks.length === 1
      && calls.clicks[0].download === "resonance-reading-1980-10-21.md");
    t("the anchor is cleaned up and the object URL revoked",
      calls.appended.length === 1 && calls.removed.length === 1 && calls.revoked.length === 1);
  }
  {
    const { sandbox, calls } = makeSandbox({ withDocument: false });
    const { cards, chart } = fixture();
    let threw = null, ok = null;
    try { ok = sandbox.exportReading(chart, cards); } catch (e) { threw = e; }
    t("a host with no document returns false instead of throwing",
      threw === null && ok === false && calls.clicks.length === 0);
  }

  // ── the button exists and is wired ────────────────────────────────────
  t("the session header has an export button",
    />export</.test(sessionSrc) && /onClick=\{onExport\}/.test(sessionSrc));
  t("…wired to exportReading with the chart and its cards",
    /onExport=\{\(\) => exportReading\(chart, cards\)\}/.test(sessionSrc));

  return rows;
}
