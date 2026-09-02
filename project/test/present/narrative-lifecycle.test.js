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
//
// It also accepts an already-computed `lifecycleText` instead of a
// jdTarget — added after a Codex review on the PR that introduced
// jdTarget caught that session.jsx's `narrative` memo also depends on
// `agent.text` (which changes on every narrated card transition), so
// passing jdTarget there re-ran lifecycleDigest's two ephemeris-backed
// return casts on every card change. session.jsx now computes the text
// once, in its own memo keyed only on [chart, jdSessionNow], and passes
// the STRING here; this file's own assertions below pin that path too,
// plus a source-level regression check that session.jsx's split actually
// holds (no React harness in this repo to catch it at the hook-timing
// level).

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
  // progressionsText: "" isolates the lifecycle segment under test here —
  // jdTarget alone would ALSO add a progressions segment (see
  // narrative-progressions.test.js), which is correct behavior but not
  // what this file is pinning.
  const withLife = buildChartNarrative(chart, { jdTarget: jdNow, progressionsText: "" });
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
  const atBirth = buildChartNarrative(chart, { jdTarget: chart.jd, progressionsText: "" });
  const segBirth = atBirth.segments[atBirth.segments.length - 1];
  t("the birth instant produces different lifecycle prose than a 2026 target",
    segBirth.text !== seg.text);
  t("at the birth instant, the digest's own tautology guard still suppresses the shared-lane sentence",
    !/same shadow lane/i.test(segBirth.text), segBirth.text);
  t("away from birth, the 2026 target is free to carry the shared-lane sentence or not, honestly",
    typeof seg.text === "string");

  // ── an unknown birth time does not crash the lifecycle segment, and
  //    withholds the shadow-lane sentence specifically ───────────────────
  // (windingLift/returnChart/ctmState read only .jd and planet longitudes
  // — none of the lifecycle facts depend on houses or the angles, so the
  // segment itself still forms. But lifecycleDigest's shadow-lane sentence
  // is an ARCSECOND-level residue that an assumed-noon birth time scrambles
  // rather than merely blurs — see time.jsx's lifecycleDigest — so it must
  // be absent here specifically, not just "some text or other.")
  // Positive control first: `seg` (this same chart+jdNow, declared above)
  // already carries a real shadow-lane sentence (Mars and Saturn, at this
  // target) — confirming the check below suppresses a real fact, not the
  // absence of one that was never going to appear anyway.
  t("sanity: the known-time chart's segment at this target carries a real shadow-lane sentence to suppress",
    /shadow lane/i.test(seg.text), seg.text);
  const unknownChart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole", timeUnknown: true });
  const withUnknownTime = buildChartNarrative(unknownChart, { jdTarget: jdNow, progressionsText: "" });
  const segUnknown = withUnknownTime.segments[withUnknownTime.segments.length - 1];
  t("an unknown-birth-time chart still gets a well-formed lifecycle segment",
    !!segUnknown && segUnknown.kind === "lifecycle" && segUnknown.text.length > 20, segUnknown && segUnknown.text);
  t("...but the shadow-lane sentence is withheld from it, unlike the known-time chart at the same target",
    !/shadow lane/i.test(segUnknown.text), segUnknown.text);
  t("the age line is still present in the unknown-time segment (only the arcsecond-sensitive sentence is withheld)",
    /years into the chart's history/.test(segUnknown.text), segUnknown.text);
  t("return-status lines are still present in the unknown-time segment",
    /return/i.test(segUnknown.text), segUnknown.text);

  // ── degenerate input still behaves as documented ─────────────────────
  // (A cardless chart is otherwise-unrealistic — computeNatal never
  // produces one — and narrative.test.js already pins that jdTarget-less
  // case; a null chart is the one degenerate shape worth pinning here,
  // since it must short-circuit before ever reaching lifecycleDigest.)
  t("a null chart with jdTarget does not throw and adds nothing",
    JSON.stringify(buildChartNarrative(null, { jdTarget: jdNow })) === JSON.stringify({ text: "", segments: [] }));

  // ── lifecycleText: a precomputed string, used verbatim ────────────────
  const precomputed = narrativeLifecycle(chart, jdNow);
  const withText = buildChartNarrative(chart, { lifecycleText: precomputed });
  const segText = withText.segments[withText.segments.length - 1];
  t("lifecycleText alone (no jdTarget) still adds exactly one lifecycle segment",
    withText.segments.filter((s) => s.kind === "lifecycle").length === 1);
  t("its text is the precomputed string, verbatim", segText.text === precomputed);
  t("a chart's-worth of other output built via lifecycleText matches the jdTarget path exactly",
    withText.text === withLife.text);
  t("lifecycleText takes precedence over jdTarget when both are given — no re-derivation",
    buildChartNarrative(chart, { jdTarget: chart.jd, lifecycleText: precomputed, progressionsText: "" }).text === withText.text);
  t("lifecycleText: '' (computed, nothing to say) adds no segment, and is NOT treated as absent",
    buildChartNarrative(chart, { lifecycleText: "", jdTarget: jdNow, progressionsText: "" }).segments.length === baseCount);
  t("lifecycleText: null falls back to computing from jdTarget, same as the default",
    buildChartNarrative(chart, { lifecycleText: null, jdTarget: jdNow, progressionsText: "" }).text === withLife.text);

  // ── regression: session.jsx must not recompute the digest on every
  //    agent-driven rerender (the bug the lifecycleText option exists to
  //    avoid). No React harness here to catch this at the hook-timing
  //    level, so this pins it at the source level instead: the memo that
  //    depends on agent.text must reference the precomputed lifecycleText,
  //    never call narrativeLifecycle/lifecycleDigest itself, and the memo
  //    that computes lifecycleText must not depend on agent.text.
  // Slices are bounded by adjacent, already-known markers rather than by
  // matching parens — this source has calls like `f(g(x));` whose FIRST
  // ");" lands well inside the memo body, long before its real close.
  const sessionSrc = readFileSync(join(ROOT, "session.jsx"), "utf8");

  const lcStart = sessionSrc.indexOf("const lifecycleText = $sUseMemo(");
  const nStart = sessionSrc.indexOf("const narrative = $sUseMemo(() => {");
  const lifecycleMemo = lcStart >= 0 && nStart > lcStart ? sessionSrc.slice(lcStart, nStart) : "";
  t("session.jsx computes lifecycleText in its own $sUseMemo", lifecycleMemo.length > 0);
  // An exact match on the array already proves it excludes agent.text —
  // a separate substring search for "agent.text" would also catch this
  // very comment block explaining why (it names agent.text in prose).
  t("that memo's dependency array is exactly [chart, jdSessionNow] — no agent.text",
    /\$sUseMemo\(\s*\(\) => [^\n]*,\s*\[chart, jdSessionNow\]\s*\)/.test(lifecycleMemo), lifecycleMemo);
  t("that memo is the one place narrativeLifecycle is actually called",
    /narrativeLifecycle\(chart, jdSessionNow\)/.test(lifecycleMemo), lifecycleMemo);

  const nextMarker = sessionSrc.indexOf("// Where each narrative segment", nStart);
  const narrativeMemo = nStart >= 0 && nextMarker > nStart ? sessionSrc.slice(nStart, nextMarker) : "";
  t("session.jsx's narrative memo exists", narrativeMemo.length > 0);
  // progressionsText rides along in the same memo and dependency array —
  // see narrative-progressions.test.js for its own dedicated regression
  // check; these patterns just need to tolerate its presence rather than
  // expect the pre-progressions exact shape.
  t("the narrative memo's dependency array includes agent.text (that part of the coupling is real and expected)",
    /\[chart, order, agentOn, agent\.text, lifecycleText, progressionsText\]/.test(narrativeMemo), narrativeMemo);
  t("...but the narrative memo itself never calls narrativeLifecycle or lifecycleDigest directly",
    !/narrativeLifecycle\(|lifecycleDigest\(/.test(narrativeMemo), narrativeMemo);
  t("...and passes the precomputed lifecycleText through to buildChartNarrative instead of a jdTarget",
    /buildChartNarrative\(chart, \{ agentTexts, lifecycleText, progressionsText \}\)/.test(narrativeMemo), narrativeMemo);

  return rows;
}
