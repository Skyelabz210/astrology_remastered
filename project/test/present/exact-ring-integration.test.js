// Exercise the shipped chart -> reading/prompt boundary with ExactRing both
// loaded and absent. Core ring values stay BigInt; JSX display lanes are small
// Numbers, including the extra mod-17 and mod-19 lanes in the canonical path.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as AstroCore from "../../src/present/astro-core.js";
import * as ExactRing from "../../src/present/exact-ring.js";
import * as Houses from "../../tools/ephemeris/houses.js";

function loadChart(canonical) {
  const sandbox = { AstroCore, Houses };
  if (canonical) sandbox.ExactRing = ExactRing;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["vendor/astronomy.browser.min.js", "astro.jsx", "readings.jsx", "agent.jsx"]) {
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
    check(`${mode}: raw canonical lane API remains BigInt`, () =>
      Object.values(ExactRing.laneResidues(1234567n)).every(value => typeof value === "bigint"));
  }
  return rows;
}
