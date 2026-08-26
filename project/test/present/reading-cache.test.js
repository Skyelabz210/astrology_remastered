// test/present/reading-cache.test.js — the chart stays present. (P28)
//
// A chart is generated ONCE and then explored. Before this, agent.jsx's
// reading cache was a memory-only Map: a reload discarded every reading the
// agent had produced and the whole spread re-fetched — twelve requests to
// regenerate text the reader had just been shown. And the cache key was
// card-only, which was fine for a cache that died with the page but is
// unsafe for one that outlives it: a persisted reading must never follow a
// look-alike card into a different chart.
//
// The contract pinned here:
//   · finished readings write through to localStorage and hydrate at load —
//     a "reload" (fresh module, same store) serves the reading with ZERO
//     interpreter calls;
//   · keys are chart-scoped — same card values under a different chart is a
//     different key, so exploring a partner's chart neither reuses nor
//     evicts the first chart's readings;
//   · the store is capped FIFO and every failure mode (no localStorage, a
//     throwing getter, corrupt JSON, quota errors) degrades to the
//     in-session cache instead of throwing.
//
// agent.jsx is JSX-free, so the REAL module runs in a node:vm sandbox with
// stub React / localStorage / window.claude, same rig style as
// voice-prime.test.js.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const agentSrc = readFileSync(join(ROOT, "agent.jsx"), "utf8");
const sessionSrc = readFileSync(join(ROOT, "session.jsx"), "utf8");

/** A localStorage stand-in over a shared backing map, so two sandboxes can
 *  model "a reload": fresh module, same persisted store. */
function makeStorage(backing = new Map(), { throwOnAccess = false, throwOnSet = false } = {}) {
  if (throwOnAccess) return "THROW";
  return {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { if (throwOnSet) throw new Error("QuotaExceededError"); backing.set(k, String(v)); },
    removeItem: (k) => backing.delete(k),
    _backing: backing,
  };
}

function makeSandbox({ storage = makeStorage(), completions = [] } = {}) {
  const calls = { complete: [] };
  const sandbox = {};
  sandbox.window = sandbox;
  if (storage === "THROW") {
    Object.defineProperty(sandbox, "localStorage", { get() { throw new Error("SecurityError"); } });
  } else if (storage) {
    sandbox.localStorage = storage;
  }
  sandbox.React = {
    useState: (init) => [init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: (fn) => fn(),
    useCallback: (fn) => fn,
  };
  sandbox.claude = {
    complete: async (prompt) => {
      calls.complete.push(prompt);
      return completions.length ? completions.shift() : "an interpreted reading";
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(agentSrc, sandbox, { filename: "agent.jsx" });
  // The unit under test is the CACHING layer. buildCardPrompt needs the full
  // chart apparatus (residue tuples, dignity tables, ZODIAC from astro.jsx),
  // which is astro.jsx's job to produce and its own tests' job to check —
  // agent.jsx runs as a sloppy-mode script, so its top-level functions bind
  // to the sandbox global and the prompt builder can be stubbed after load.
  sandbox.buildCardPrompt = (card) => `prompt for ${card.principal.name}`;
  return { sandbox, calls, storage };
}

/** A minimal card + chart pair shaped like astro.jsx's output. */
function fixture(jd = 2444534.397, lat = 35.1408, lng = -79.0058) {
  const card = {
    idx: 3, resonance: 0.512, laneR11: 4, laneR13: 9,
    name: "Scorpio", glyph: "♏",
    principal: { name: "Mars", glyph: "♂", sign: "Scorpio", house: 5, retrograde: false, lon: 221.5 },
    dignity: { kind: "domicile" },
    aspect: { name: "trine", sep: 2.31 },
  };
  const chart = {
    jd, timeUnknown: false,
    birth: { dateISO: "1980-10-21T17:31:00-04:00", lat, lng, placeLabel: "Fort Liberty (Bragg) · NC" },
    asc: 12.3, ascSignIdx: 0,
    cards: [card],
    planets: [],
  };
  return { card, chart };
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── a reading, once generated, stays present across a "reload" ────────
  {
    const backing = new Map();
    const first = makeSandbox({ storage: makeStorage(backing), completions: ["Mars burns in its own house."] });
    const { card, chart } = fixture();
    const text = await first.sandbox.interpretCard(card, chart);
    t("a reading generates once", text === "Mars burns in its own house." && first.calls.complete.length === 1);
    t("…and is written through to the store",
      backing.has("resonance.readings.v1") && backing.get("resonance.readings.v1").includes("Mars burns"),
      [...backing.keys()].join(","));

    // the "reload": a brand-new module instance over the same store
    const second = makeSandbox({ storage: makeStorage(backing) });
    const again = await second.sandbox.interpretCard(card, chart);
    t("after a reload the same reading is served from the store",
      again === "Mars burns in its own house.");
    t("…with ZERO interpreter calls — nothing regenerates",
      second.calls.complete.length === 0, `${second.calls.complete.length} calls`);
  }

  // ── keys are chart-scoped ─────────────────────────────────────────────
  {
    const { sandbox } = makeSandbox();
    const a = fixture(2444534.397);
    const b = fixture(2451545.0, 29.4241, -98.4936);   // different person, same card values
    const keyA = sandbox.cacheKey(a.card, a.chart);
    const keyB = sandbox.cacheKey(b.card, b.chart);
    t("the same card under a different chart is a different key", keyA !== keyB);
    t("the same chart twice is the same key",
      keyA === sandbox.cacheKey(a.card, a.chart));
    t("the key carries the chart's identity",
      keyA.startsWith("2444534.3970,35.1408,-79.0058,0|"), keyA.slice(0, 40));
  }
  {
    // exploring a second chart must not evict or reuse the first
    const backing = new Map();
    const rig = makeSandbox({ storage: makeStorage(backing), completions: ["First chart.", "Second chart."] });
    const a = fixture(2444534.397);
    const b = fixture(2451545.0, 29.4241, -98.4936);
    const ta = await rig.sandbox.interpretCard(a.card, a.chart);
    const tb = await rig.sandbox.interpretCard(b.card, b.chart);
    t("two charts hold two distinct readings", ta === "First chart." && tb === "Second chart.");
    const ta2 = await rig.sandbox.interpretCard(a.card, a.chart);
    t("the first chart's reading is still there after the second generated",
      ta2 === "First chart." && rig.calls.complete.length === 2);
  }

  // ── the store is capped, oldest first ─────────────────────────────────
  {
    const backing = new Map();
    const rig = makeSandbox({ storage: makeStorage(backing) });
    const MAX = rig.sandbox.READINGS_STORE_MAX;
    for (let i = 0; i < MAX + 25; i++) rig.sandbox.remember(`k${i}`, `reading ${i}`);
    const stored = JSON.parse(backing.get("resonance.readings.v1"));
    t("the persisted store is capped", stored.length === MAX, `${stored.length} rows`);
    t("…dropping the OLDEST entries", stored[0][0] === "k25" && stored[stored.length - 1][0] === `k${MAX + 24}`);
  }

  // ── every failure mode degrades, none throws ──────────────────────────
  {
    const { sandbox, calls } = makeSandbox({ storage: null, completions: ["No store host."] });
    const { card, chart } = fixture();
    const text = await sandbox.interpretCard(card, chart);
    t("no localStorage at all: readings still generate in-session",
      text === "No store host." && calls.complete.length === 1);
  }
  {
    let threw = null;
    try { makeSandbox({ storage: "THROW" }); } catch (e) { threw = e; }
    t("a throwing localStorage getter (private-mode Safari) does not brick the module", threw === null,
      threw ? String(threw) : "");
  }
  {
    const backing = new Map([["resonance.readings.v1", "{not json"]]);
    let threw = null, rig = null;
    try { rig = makeSandbox({ storage: makeStorage(backing), completions: ["Regenerated."] }); } catch (e) { threw = e; }
    t("a corrupt store hydrates to nothing instead of throwing", threw === null, threw ? String(threw) : "");
    const { card, chart } = fixture();
    const text = await rig.sandbox.interpretCard(card, chart);
    t("…and the reading simply regenerates",
      text === "Regenerated." && rig.calls.complete.length === 1);
  }
  {
    const rig = makeSandbox({ storage: makeStorage(new Map(), { throwOnSet: true }), completions: ["Quota case."] });
    const { card, chart } = fixture();
    const text = await rig.sandbox.interpretCard(card, chart);
    const again = await rig.sandbox.interpretCard(card, chart);
    t("a full store (quota) keeps the session cache working",
      text === "Quota case." && again === "Quota case." && rig.calls.complete.length === 1,
      `${rig.calls.complete.length} interpreter calls`);
  }

  // ── the session reads through the same scoped key ─────────────────────
  t("session.jsx's narrative memo uses the chart-scoped key",
    /__cache\.get\(cacheKey\(card, chart\)\)/.test(sessionSrc));

  return rows;
}
