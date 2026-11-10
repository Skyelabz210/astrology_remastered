// Exercise the shipped chart -> reading/prompt boundary with ExactRing both
// loaded and absent. Core ring values stay BigInt; JSX display lanes are small
// Numbers, including the extra mod-17 and mod-19 lanes in the canonical path.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as AstroCore from "../../src/present/astro-core.js";
import * as ExactRing from "../../src/present/exact-ring.js";
import * as Houses from "../../tools/ephemeris/houses.js";
import * as ReadingRuns from "../../src/astro/reading-runs.js";

function loadChart(canonical) {
  const sandbox = { AstroCore, Houses };
  if (canonical) sandbox.ExactRing = ExactRing;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "synastry.jsx", "readings.jsx", "agent.jsx"]) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }
  return sandbox;
}

export function run() {
  const rows = [];
  const check = (name, fn) => {
    try { rows.push({ name, ok: !!fn(), detail: "" }); }
    catch (error) { rows.push({ name, ok: false, detail: error.message }); }
  };
  for (const canonical of [true, false]) {
    const sandbox = loadChart(canonical);
    const mode = canonical ? "EXACT_RING" : "LEGACY_FLOAT";
    const birth = { dateISO: "1990-01-01T12:00:00Z", lat: 29.4, lng: -98.5 };
    const chart = sandbox.computeNatal(birth);
    const expectedLanes = canonical ? 8 : 6;
    check(`${mode}: chart uses requested engine`, () => chart.exactRingMode === mode);
    check(`${mode}: authoritative positions and speeds remain BigInt`, () =>
      typeof chart.ascArcsecBigInt === "bigint" && chart.planets.every(p =>
        typeof p.arcsecBigInt === "bigint" && typeof p.speedArcsecBigInt === "bigint"));
    check(`${mode}: every display lane is a Number`, () => chart.planets.every(p =>
      Object.values(p.residues).length === expectedLanes &&
      Object.values(p.residues).every(Number.isSafeInteger)));
    check(`${mode}: display conversion preserves every exact residue`, () => chart.planets.every(p =>
      Object.entries(p.residues).every(([lane, value]) =>
        BigInt(value) === ExactRing.laneResidues(p.arcsecBigInt)[lane])));
    check(`${mode}: card aspect display fields derive from exact arcseconds`, () =>
      chart.cards.some(card => card.aspect) && chart.cards.every(({ aspect }) => !aspect || (
        typeof aspect.sepArcsec === "bigint" && typeof aspect.orbArcsec === "bigint"
        && aspect.sep === Number(aspect.sepArcsec) / 3600
        && aspect.orb === Number(aspect.orbArcsec) / 3600)));
    check(`${mode}: all card rigorous readings render numeric lane pairs`, () => chart.cards.every(card => {
      const math = sandbox.rigorousFor(card, chart);
      const { r11, r13 } = card.principal.residues;
      return math.find(row => row.label === "K (lane pair)").value === r11 * 13 + r13
        && math.every(row => typeof row.value !== "bigint");
    }));
    check(`${mode}: all card agent prompts consume display residues`, () => chart.cards.every(card => {
      const prompt = sandbox.buildCardPrompt(card, chart);
      return prompt.includes(`r₁₁=${card.principal.residues.r11}`)
        && prompt.includes(`r₁₃=${card.principal.residues.r13}`);
    }));
    check(`${mode}: unknown-time cards retain the same safe presentation boundary`, () => {
      const unknown = sandbox.computeNatal({ ...birth, timeUnknown: true });
      return unknown.cards.every(card => sandbox.rigorousFor(card, unknown)
        .find(row => row.label === "house").value.includes("birth time unknown"));
    });
    const backing = new Map();
    const storage = { getItem: key => backing.get(key) || null, setItem: (key, value) => backing.set(key, value) };
    const run = { version: 1, id: "exact-chart", profileKey: ReadingRuns.profileKey(chart.birth),
      at: "2026-10-02T12:00:00.000Z", input: { birth: chart.birth },
      evidence: { natal: chart, exact: { large: 9007199254740993n, negative: -9007199254740993n } },
      reading: "Local chart reading" };
    check(`${mode}: full natal evidence persists with lossless integer strings`, () => {
      if (!ReadingRuns.saveRun(storage, run)) return false;
      const saved = ReadingRuns.loadRuns(storage)[0];
      return saved.evidence.exact.large === "9007199254740993"
        && saved.evidence.exact.negative === "-9007199254740993"
        && saved.evidence.natal.planets.every((p, i) =>
          p.arcsecBigInt === String(chart.planets[i].arcsecBigInt));
    });
    check(`${mode}: evidence hashing agrees before and after JSON persistence`, () =>
      ReadingRuns.evidenceFingerprint(run) === ReadingRuns.evidenceFingerprint(ReadingRuns.loadRuns(storage)[0]));
    check(`${mode}: attached exact evidence preserves its owner and integer precision`, () =>
      ReadingRuns.attachEvidence(storage, run.id, "exactUpdate", { position: 9007199254740993n }, run.profileKey)
      && ReadingRuns.loadRuns(storage, run.profileKey)[0].evidence.exactUpdate.position === "9007199254740993");
    check(`${mode}: persistence leaves the authoritative chart BigInts untouched`, () =>
      typeof chart.planets[0].arcsecBigInt === "bigint" && typeof run.evidence.exact.large === "bigint");
    check(`${mode}: synastry evidence containing both full charts can be hashed and saved`, () => {
      const partner = sandbox.computeNatal({ ...birth, dateISO: "1980-10-21T21:31:00Z", subjectName: "Partner" });
      const relationship = { ...run, id: "relationship", input: { birth: chart.birth, partnerBirth: partner.birth, kind: "synastry" },
        evidence: { synastry: sandbox.computeSynastry(chart, partner) } };
      return ReadingRuns.evidenceFingerprint(relationship).length === 32
        && ReadingRuns.saveRun(storage, relationship)
        && ReadingRuns.loadRuns(storage)[0].input.partnerBirth.subjectName === "Partner";
    });
    check(`${mode}: HCRM's legacy quantizer cannot overwrite the natal chart quantizer`, () => {
      vm.runInContext(readFileSync(new URL("../../hcrm.jsx", import.meta.url), "utf8"), sandbox);
      const recast = sandbox.computeNatal(birth);
      return typeof sandbox.toArcsec(1) === "number"
        && recast.ascArcsecBigInt === chart.ascArcsecBigInt
        && recast.planets.every((p, i) => p.arcsecBigInt === chart.planets[i].arcsecBigInt);
    });
    check(`${mode}: raw canonical lane API remains BigInt`, () =>
      Object.values(ExactRing.laneResidues(1234567n)).every(value => typeof value === "bigint"));
  }
  return rows;
}
