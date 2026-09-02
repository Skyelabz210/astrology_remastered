// test/present/agent-lifecycle.test.js — the AI interpreter's "right now"
// grounding.
//
// buildChartPrompt/interpretChart (agent.jsx) power the "Synthesis"
// whole-chart AI summary (app.jsx's Spread screen). Like narrative.jsx's
// buildChartNarrative before it, this was otherwise purely a function of
// the birth chart. It gains the identical opt-in: given a jdTarget, the
// prompt is handed the SAME lifecycleDigest (time.jsx) facts the spoken
// narrative closes with — reused verbatim, not reworded for the model —
// and the reading cache is bucketed by day so "now" ticking every render
// does not mean a fresh API call every render either.
//
// buildChartPrompt has no prior test coverage at all (nothing in this
// repo asserted its shape before this change); this file only covers the
// behavior this PR actually adds or could break — the prompt's shape
// with and without jdTarget, and interpretChart's cache-key bucketing —
// not a full retroactive spec of every line agent.jsx already sends.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

async function loadSandbox() {
  const sb = {};
  sb.window = sb;
  sb.React = { useState: () => [null, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f() };
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  // Real page order (Resonance Spread.html): astro.jsx, time.jsx, ..., agent.jsx.
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "agent.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }
  return sb;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sb = await loadSandbox();
  const { buildChartPrompt, computeNatal, dateToJD, lifecycleDigest } = sb;

  const chart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const jdNow = dateToJD(new Date("2026-09-02T10:00:00Z"));

  // ── backward compatibility ────────────────────────────────────────────
  const base = buildChartPrompt(chart);
  t("without jdTarget, no RIGHT NOW section is added", !base.includes("RIGHT NOW"));
  t("without jdTarget, the rule caps at exactly 4 sentences",
    base.includes("4 sentences total") && !base.includes("4 to 5"));

  // ── with jdTarget: the same digest prose, reused verbatim ─────────────
  const withTarget = buildChartPrompt(chart, jdNow);
  t("with jdTarget, a RIGHT NOW section is added", withTarget.includes("RIGHT NOW"));
  t("the sentence budget expands to make room for it",
    withTarget.includes("4 to 5 sentences total"));
  const digest = lifecycleDigest(chart, jdNow);
  t("every digest line appears in the prompt, verbatim — no re-derivation or rewording",
    digest.lines.length > 0 && digest.lines.every((l) => withTarget.includes(l)),
    digest.lines.join(" | "));
  t("the model is told these are present-tense facts, not a prediction to make",
    /present tense/i.test(withTarget) && /not a prediction/i.test(withTarget));
  // The sentence-budget rule line is the ONE line meant to differ (it
  // expands to make room); the SUBSTRATE section itself — birth line,
  // Ascendant, every body — must be untouched by adding a target.
  // (The RIGHT NOW *header* is found by its surrounding blank lines —
  // the rule line above also mentions "a RIGHT NOW fact" inline, with no
  // such gap around it, so a bare indexOf("RIGHT NOW") would find that
  // mention first instead of the section it names.)
  const substrateOf = (text) => {
    const end = text.indexOf("\n\nRIGHT NOW\n");
    return text.slice(text.indexOf("SUBSTRATE"), end === -1 ? text.length : end);
  };
  t("the SUBSTRATE section itself is byte-for-byte unchanged by adding a target",
    substrateOf(withTarget).trimEnd() === substrateOf(base).trimEnd(),
    `base=${JSON.stringify(substrateOf(base).slice(0, 60))} with=${JSON.stringify(substrateOf(withTarget).slice(0, 60))}`);

  // ── the opt-in guard's degenerate inputs ───────────────────────────────
  t("a non-finite jdTarget (NaN) behaves exactly like omitting it",
    buildChartPrompt(chart, NaN) === base);
  t("an explicit undefined behaves exactly like the default",
    buildChartPrompt(chart, undefined) === base);

  // ── interpretChart: the cache is bucketed by day, not by raw jdTarget ──
  // Two hosts' clocks a few hours apart must not both re-fetch — but a
  // genuinely different day, where the digest's own facts can differ
  // (a return coming into or out of force), must.
  let calls = 0;
  sb.window.claude = { complete: async (prompt) => { calls += 1; return "READING:" + prompt.length; } };
  const { interpretChart } = sb;

  // Safely inside one noon-to-noon Julian Day window either way — not
  // hugging the UTC-noon boundary the JD convention itself uses.
  const jdMorning = dateToJD(new Date("2026-09-02T14:00:00Z"));
  const jdEvening = dateToJD(new Date("2026-09-02T20:00:00Z"));
  const jdNextNext = dateToJD(new Date("2026-09-04T14:00:00Z"));
  t("sanity: the two same-day instants really do floor to the same JD",
    Math.floor(jdMorning) === Math.floor(jdEvening));
  t("sanity: the later instant really does floor to a different JD",
    Math.floor(jdNextNext) !== Math.floor(jdMorning));

  const r1 = await interpretChart(chart, jdMorning);
  const r2 = await interpretChart(chart, jdEvening);
  t("two targets in the same day-bucket reuse the cached reading — one API call",
    calls === 1 && r1 === r2, `calls=${calls}`);

  const r3 = await interpretChart(chart, jdNextNext);
  t("a target in a genuinely different day-bucket triggers a fresh call",
    calls === 2 && r3 !== r1, `calls=${calls}`);

  const r4 = await interpretChart(chart);
  t("omitting jdTarget entirely is its own cache bucket, distinct from any dated one",
    calls === 3 && r4 !== r1 && r4 !== r3, `calls=${calls}`);

  const r5 = await interpretChart(chart);
  t("repeating the no-jdTarget call reuses its own cache entry rather than re-fetching",
    calls === 3 && r5 === r4, `calls=${calls}`);

  return rows;
}
