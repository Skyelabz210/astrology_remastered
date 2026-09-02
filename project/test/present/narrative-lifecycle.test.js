// test/present/narrative-lifecycle.test.js — the spoken reading's "right
// now" epilogue.
//
// buildChartNarrative (narrative.jsx) is otherwise purely a function of
// the birth chart — the same piece from the first play to the last, no
// live-time dependency. This is the one opt-in exception: given a
// jdTarget, one more segment closes the piece with lifecycleDigest's
// (time.jsx) already-computed facts about that instant, in the same
// plain-sentence register the opening and closing use. It composes
// nothing new — the assertions here are mostly that the wiring reuses
// lifecycleDigest's own prose verbatim, that every existing caller
// (jdTarget omitted) is byte-for-byte unaffected, and that offsets and
// chunking still hold with the extra segment present.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

async function loadSandbox() {
  const sb = {};
  sb.window = sb;
  // agent.jsx touches React only inside hook bodies, never at load time —
  // same stub narrative.test.js uses.
  sb.React = { useState: () => [null, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f() };
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  // Real page order (Resonance Spread.html): astro.jsx, time.jsx, ...,
  // readings.jsx, agent.jsx, narrative.jsx. synastry.jsx is skipped —
  // nothing under test touches it, same as narrative.test.js's sandbox.
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "readings.jsx", "agent.jsx", "narrative.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }
  return sb;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sb = await loadSandbox();
  const { buildChartNarrative, narrativeLifecycle, lifecycleDigest, dateToJD, computeNatal, chunkNarrative } = sb;

  const chart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const jdNow = dateToJD(new Date("2026-09-02T10:00:00Z"));

  // ── backward compatibility: every existing caller is unaffected ──────
  const base = buildChartNarrative(chart);
  const baseCount = base.segments.length;
  t("without jdTarget, no lifecycle segment is added",
    !base.segments.some((s) => s.kind === "lifecycle"));
  const withOtherOpts = buildChartNarrative(chart, { agentTexts: null, joiner: "\n\n" });
  t("an options object that simply omits jdTarget behaves identically",
    withOtherOpts.text === base.text && withOtherOpts.segments.length === baseCount);

  // ── with jdTarget: exactly one lifecycle segment, appended last ──────
  const withLife = buildChartNarrative(chart, { jdTarget: jdNow });
  t("providing jdTarget adds exactly one lifecycle segment",
    withLife.segments.filter((s) => s.kind === "lifecycle").length === 1);
  t("every prior segment is unchanged",
    withLife.segments.length === baseCount + 1
    && withLife.segments.slice(0, baseCount).every((s, i) => s.text === base.segments[i].text));
  const seg = withLife.segments[withLife.segments.length - 1];
  t("the lifecycle segment is last", seg.kind === "lifecycle");
  t("it carries no card index (it does not move the deck)", seg.cardIdx === null);
  t("it is titled for the present moment", seg.title === "Right now");

  // ── single source of truth: exactly lifecycleDigest's own prose ──────
  const digest = lifecycleDigest(chart, jdNow);
  t("the segment's text is exactly lifecycleDigest's lines joined — no re-derivation",
    seg.text === digest.lines.join(" "), seg.text);

  // ── offsets and chunking still hold with the extra segment present ───
  t("the lifecycle segment's [start,end) indexes the joined text",
    withLife.text.slice(seg.start, seg.end) === seg.text);
  t("it ends exactly at the end of the full narrative text",
    seg.end === withLife.text.length);
  t("segments remain in ascending, non-overlapping order",
    withLife.segments.every((s, i) => i === 0 || s.start >= withLife.segments[i - 1].end));
  const chunks = chunkNarrative(withLife.segments, 1200);
  t("chunk boundaries still fall on segment boundaries with the new segment present",
    chunks.reduce((acc, c) => acc + c.segments.length, 0) === withLife.segments.length);
  t("chunk-local offsets still index that chunk's own text",
    chunks.every((c) => c.offsets.every((o, i) => c.text.slice(o.start, o.end) === c.segments[i].text)));

  // ── narrativeLifecycle directly: the opt-in guard ────────────────────
  t("no jdTarget (null, undefined, or NaN) yields an empty string",
    narrativeLifecycle(chart, null) === "" && narrativeLifecycle(chart, undefined) === "" && narrativeLifecycle(chart, NaN) === "");
  t("no chart yields an empty string", narrativeLifecycle(null, jdNow) === "");
  t("a real chart and target yields real prose", narrativeLifecycle(chart, jdNow).length > 20);

  // ── it is genuinely date-sensitive, not a fixed string ───────────────
  const atBirth = buildChartNarrative(chart, { jdTarget: chart.jd });
  const segBirth = atBirth.segments[atBirth.segments.length - 1];
  t("the birth instant produces different lifecycle prose than a 2026 target",
    segBirth.text !== seg.text);
  t("at the birth instant, the digest's own tautology guard still suppresses the shared-lane sentence",
    !/same shadow lane/i.test(segBirth.text), segBirth.text);
  t("away from birth, the 2026 target is free to carry the shared-lane sentence or not, honestly",
    typeof seg.text === "string");

  // ── an unknown birth time does not crash the lifecycle segment ───────
  // (windingLift/returnChart/ctmState read only .jd and planet longitudes
  // — none of the lifecycle facts depend on houses or the angles.)
  const unknownChart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole", timeUnknown: true });
  const withUnknownTime = buildChartNarrative(unknownChart, { jdTarget: jdNow });
  const segUnknown = withUnknownTime.segments[withUnknownTime.segments.length - 1];
  t("an unknown-birth-time chart still gets a well-formed lifecycle segment",
    !!segUnknown && segUnknown.kind === "lifecycle" && segUnknown.text.length > 20, segUnknown && segUnknown.text);

  // ── degenerate input still behaves as documented ─────────────────────
  // (A cardless chart is otherwise-unrealistic — computeNatal never
  // produces one — and narrative.test.js already pins that jdTarget-less
  // case; a null chart is the one degenerate shape worth pinning here,
  // since it must short-circuit before ever reaching lifecycleDigest.)
  t("a null chart with jdTarget does not throw and adds nothing",
    JSON.stringify(buildChartNarrative(null, { jdTarget: jdNow })) === JSON.stringify({ text: "", segments: [] }));

  return rows;
}
