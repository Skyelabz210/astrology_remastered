// test/present/agent-lifecycle.test.js — the AI interpreter's "right now"
// grounding.
//
// buildChartPrompt/interpretChart (agent.jsx) power the "Synthesis"
// whole-chart AI summary (app.jsx's Spread screen). Like narrative.jsx's
// buildChartNarrative before it, this was otherwise purely a function of
// the birth chart. It gains the identical opt-in: given a jdTarget, the
// prompt is handed the SAME lifecycleDigest AND progressionsDigest
// (time.jsx) facts the spoken narrative closes with — reused verbatim,
// not reworded for the model, each in its own labeled block (RIGHT NOW /
// BY PROGRESSION) so the model can tell which technique a fact comes from.
//
// Unlike session.jsx's narrative memo, interpretChart is never called
// from anything agent.text-coupled — app.jsx's Spread screen gates it
// behind a plain useEffect keyed on the chart and a frozen jdSpreadNow —
// so no precomputed-string workaround is needed here; both digests are
// simply computed once per real invocation.
//
// The reading cache key's lifecycle+progression component is derived from
// BOTH digests' OWN content (a fingerprint of their computed lines), not
// from a day bucket. An earlier version of this file bucketed by
// Math.floor(jdTarget) on the theory that lifecycleDigest is "day-
// granularity" — a Codex review correctly caught that it is NOT: the
// shared-shadow-lane sentence depends on exact ecliptic longitude and can
// change within minutes for a fast body, a return can begin intraday, and
// the lived-day count changes at the birth time-of-day boundary, not at
// midnight. A day-bucketed key served a stale RIGHT NOW statement for
// however long was left in the bucket after the facts actually changed.
// Fingerprinting the actual content fixes that AND stays cache-friendly:
// repeat calls whose facts are unchanged still hit the same entry.
// progressionsDigest's facts are no more day-granular than lifecycle's,
// so its lines join the same fingerprint on the same reasoning.
//
// buildChartPrompt has no prior test coverage predating this file (nothing
// in this repo asserted its shape before jdTarget existed); this file only
// covers the behavior this PR actually adds or could break — the prompt's
// shape with and without jdTarget, interpretChart's content-derived cache
// key, and the ":latest" pointer buildReadingMarkdown's export depends on
// — not a full retroactive spec of every line agent.jsx already sends.

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
  const { buildChartPrompt, computeNatal, dateToJD, lifecycleDigest, progressionsDigest } = sb;

  const chart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const jdNow = dateToJD(new Date("2026-09-02T10:00:00Z"));

  // ── backward compatibility ────────────────────────────────────────────
  const base = buildChartPrompt(chart);
  t("without jdTarget, no RIGHT NOW section is added", !base.includes("RIGHT NOW"));
  t("without jdTarget, the rule caps at exactly 4 sentences",
    base.includes("4 sentences total") && !base.includes("4 to 5"));

  // ── with jdTarget: BOTH digests' prose, reused verbatim ───────────────
  // This chart+jdNow combination genuinely produces content for both
  // digests (verified directly below), so the budget expands by two.
  const withTarget = buildChartPrompt(chart, jdNow);
  t("with jdTarget, a RIGHT NOW section is added", withTarget.includes("RIGHT NOW"));
  t("with jdTarget, a BY PROGRESSION section is added", withTarget.includes("BY PROGRESSION"));
  t("the sentence budget expands by one per block actually offered (here, both)",
    withTarget.includes("4 to 6 sentences total"));
  const digest = lifecycleDigest(chart, jdNow);
  t("every lifecycle digest line appears in the prompt, verbatim — no re-derivation or rewording",
    digest.lines.length > 0 && digest.lines.every((l) => withTarget.includes(l)),
    digest.lines.join(" | "));
  const progressions = progressionsDigest(chart, jdNow);
  t("every progressions digest line appears in the prompt, verbatim — no re-derivation or rewording",
    progressions.lines.length > 0 && progressions.lines.every((l) => withTarget.includes(l)),
    progressions.lines.join(" | "));
  t("the model is told these are present-tense facts, not a prediction to make",
    /present tense/i.test(withTarget) && /not a prediction/i.test(withTarget));

  // ── each block's sentence-budget contribution, isolated ───────────────
  // precomputedDigest/precomputedProgressions: null forces ONE block off
  // while jdTarget still drives the other, isolating each budget step.
  const lifecycleOnly = buildChartPrompt(chart, jdNow, undefined, null);
  t("lifecycle alone (progressions suppressed) budgets 4 to 5",
    lifecycleOnly.includes("4 to 5 sentences total") && !lifecycleOnly.includes("BY PROGRESSION"));
  const progressionsOnly = buildChartPrompt(chart, jdNow, null, undefined);
  t("progressions alone (lifecycle suppressed) budgets 4 to 5",
    progressionsOnly.includes("4 to 5 sentences total") && !progressionsOnly.includes("RIGHT NOW"));

  // The sentence-budget rule line is the ONE line meant to differ (it
  // expands to make room); the SUBSTRATE section itself — birth line,
  // Ascendant, every body — must be untouched by adding a target.
  // (The RIGHT NOW *header* is found by its surrounding blank lines —
  // the rule line above also mentions "a RIGHT NOW fact" inline, with no
  // such gap around it, so a bare indexOf("RIGHT NOW") would find that
  // mention first instead of the section it names.)
  const substrateOf = (text) => {
    const rightNowEnd = text.indexOf("\n\nRIGHT NOW\n");
    const progEnd = text.indexOf("\n\nBY PROGRESSION\n");
    const candidates = [rightNowEnd, progEnd].filter((i) => i !== -1);
    const end = candidates.length ? Math.min(...candidates) : -1;
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

  // ── an unknown birth time: buildChartPrompt passes each digest's
  //    already-suppressed content through verbatim, deriving nothing of
  //    its own from jdTarget ──────────────────────────────────────────────
  // (Same Codex-driven fix as time.jsx's own digest functions — lifecycle
  // drops just its shadow-lane sentence, progressions collapses to its
  // one-line caveat. This pins that buildChartPrompt neither special-cases
  // timeUnknown itself nor leaks a fact either function has withheld.)
  t("sanity: the known-time chart's RIGHT NOW block at this target carries a real shadow-lane sentence to withhold",
    digest.lines.some((l) => l.includes("shadow lane")));
  t("sanity: the known-time chart's BY PROGRESSION block at this target carries a real Moon-sign fact to withhold",
    progressions.lines.some((l) => l.includes("the Moon has reached")));

  const unknownChart = { ...chart, timeUnknown: true };
  const withUnknownTime = buildChartPrompt(unknownChart, jdNow);
  const unknownDigest = lifecycleDigest(unknownChart, jdNow);
  const unknownProgressions = progressionsDigest(unknownChart, jdNow);
  t("timeUnknown: a RIGHT NOW section is still added (age/return facts remain reliable)",
    withUnknownTime.includes("RIGHT NOW"));
  t("timeUnknown: a BY PROGRESSION section is still added (the caveat itself is the content)",
    withUnknownTime.includes("BY PROGRESSION"));
  t("timeUnknown: no shadow-lane sentence appears, unlike the known-time chart at the same target",
    !withUnknownTime.includes("shadow lane"), withUnknownTime);
  t("timeUnknown: no Moon-sign fact appears, unlike the known-time chart at the same target",
    !withUnknownTime.includes("the Moon has reached"), withUnknownTime);
  t("timeUnknown: both digests' own (already-suppressed) lines still appear verbatim — no re-derivation",
    unknownDigest.lines.every((l) => withUnknownTime.includes(l))
    && unknownProgressions.lines.every((l) => withUnknownTime.includes(l)),
    withUnknownTime);
  t("timeUnknown: the sentence budget still expands by one per block actually offered (here, both)",
    withUnknownTime.includes("4 to 6 sentences total"));

  // ── interpretChart: the cache key reflects the digest's OWN content ───
  let calls = 0;
  sb.window.claude = { complete: async (prompt) => { calls += 1; return "READING #" + calls + ": " + prompt.length; } };
  const { interpretChart } = sb;

  const jdMorning = dateToJD(new Date("2026-09-02T14:00:00Z"));
  const jdEvening = dateToJD(new Date("2026-09-02T20:00:00Z"));
  t("sanity: the two instants floor to the SAME Julian day",
    Math.floor(jdMorning) === Math.floor(jdEvening));
  const digestMorning = lifecycleDigest(chart, jdMorning);
  const digestEvening = lifecycleDigest(chart, jdEvening);
  t("sanity: their digest content genuinely differs (the shared-shadow-lane sentence) despite the same day — the exact regression a day-bucketed key would have masked",
    digestMorning.lines.join("|") !== digestEvening.lines.join("|"),
    `morning: ${digestMorning.lines.join(" / ")}\nevening: ${digestEvening.lines.join(" / ")}`);

  const r1 = await interpretChart(chart, jdMorning);
  const r2 = await interpretChart(chart, jdMorning);
  t("repeating the IDENTICAL target reuses the cached reading — one API call",
    calls === 1 && r1 === r2, `calls=${calls}`);

  const r3 = await interpretChart(chart, jdEvening);
  t("a same-day target whose digest content genuinely differs triggers a fresh call, not a stale hit",
    calls === 2 && r3 !== r1, `calls=${calls}`);

  const r4 = await interpretChart(chart);
  t("omitting jdTarget entirely is its own cache entry, distinct from any dated one",
    calls === 3 && r4 !== r1 && r4 !== r3, `calls=${calls}`);

  const r5 = await interpretChart(chart);
  t("repeating the no-jdTarget call reuses its own cache entry rather than re-fetching",
    calls === 3 && r5 === r4, `calls=${calls}`);

  // ── the fingerprint incorporates progressionsDigest too, not just
  //    lifecycleDigest — the birth instant is a real, distinct target
  //    (its own tautological content for both digests: no shadow-lane
  //    return sentence, no progressed sign change) that must not collide
  //    with any of the entries above.
  const r6 = await interpretChart(chart, chart.jd);
  t("the birth instant is its own fresh cache entry too",
    calls === 4 && r6 !== r1 && r6 !== r3 && r6 !== r4, `calls=${calls}`);
  const r7 = await interpretChart(chart, chart.jd);
  t("repeating the birth-instant call reuses that same entry",
    calls === 4 && r7 === r6, `calls=${calls}`);

  // ── the export path's ":latest" pointer ────────────────────────────────
  // buildReadingMarkdown never has a jdTarget to reconstruct the exact
  // fingerprinted key interpretChart cached under — it looks up a plain
  // "whatever this chart most recently resolved to" pointer instead,
  // which interpretChart keeps current on every hit or fresh resolution.
  const { buildReadingMarkdown } = sb;
  const md = buildReadingMarkdown(chart, chart.cards);
  t("the export includes the whole-chart synthesis via the chart's :latest pointer",
    md.includes("The chart as one") && md.includes(r7), md.slice(0, 250));

  return rows;
}
