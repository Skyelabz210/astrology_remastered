// test/present/narrative-progressions.test.js — the spoken reading's
// "by progression" epilogue.
//
// The identical opt-in pattern narrative-lifecycle.test.js pins for
// lifecycleDigest, over progressionsDigest (time.jsx) instead: given a
// jdTarget, buildChartNarrative closes with a SEPARATE segment — the
// progressed Moon's current sign, any slower body's sign change since
// birth, and the progressed Sun-Moon phase — appended after the
// lifecycle segment when both are present. Two distinct techniques get
// two distinct codas rather than one overloaded paragraph.
//
// Also carries the same source-level regression check session.jsx's
// lifecycleText fix needed: progressionsText must be computed in its own
// memo keyed only on [chart, jdSessionNow], never inside the memo that
// also depends on agent.text — this file's whole reason to exist is a
// Codex review having already caught that exact bug once for the
// sibling digest, and the fix here follows the same shape on principle,
// not because progressionsDigest happens to be cheap enough to get away
// with it.

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
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "readings.jsx", "agent.jsx", "narrative.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }
  return sb;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sb = await loadSandbox();
  const { buildChartNarrative, narrativeProgressions, progressionsDigest, dateToJD, computeNatal, chunkNarrative } = sb;

  const chart = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const jdNow = dateToJD(new Date("2026-09-02T10:00:00Z"));

  // ── backward compatibility ────────────────────────────────────────────
  const base = buildChartNarrative(chart);
  t("without jdTarget, no progressions segment is added",
    !base.segments.some((s) => s.kind === "progressions"));

  // ── with jdTarget: exactly one progressions segment, appended last ────
  const withProg = buildChartNarrative(chart, { jdTarget: jdNow });
  t("providing jdTarget adds a progressions segment",
    withProg.segments.filter((s) => s.kind === "progressions").length === 1);
  const seg = withProg.segments[withProg.segments.length - 1];
  t("the progressions segment is last", seg.kind === "progressions");
  t("it carries no card index", seg.cardIdx === null);
  t("it is titled for the technique", seg.title === "By progression");

  const digest = progressionsDigest(chart, jdNow);
  t("the segment's text is exactly progressionsDigest's lines joined — no re-derivation",
    seg.text === digest.lines.join(" "), seg.text);

  // ── both digests present: lifecycle comes before progressions ─────────
  const withBoth = buildChartNarrative(chart, { jdTarget: jdNow });
  const lifeIdx = withBoth.segments.findIndex((s) => s.kind === "lifecycle");
  const progIdx = withBoth.segments.findIndex((s) => s.kind === "progressions");
  t("when both digests apply, lifecycle is ordered before progressions",
    lifeIdx >= 0 && progIdx >= 0 && lifeIdx < progIdx, `lifeIdx=${lifeIdx} progIdx=${progIdx}`);
  t("progressions is still the very last segment even with lifecycle present",
    progIdx === withBoth.segments.length - 1);

  // ── offsets and chunking still hold ────────────────────────────────────
  t("the progressions segment's [start,end) indexes the joined text",
    withProg.text.slice(seg.start, seg.end) === seg.text);
  t("it ends exactly at the end of the full narrative text",
    seg.end === withProg.text.length);
  t("segments remain in ascending, non-overlapping order",
    withProg.segments.every((s, i) => i === 0 || s.start >= withProg.segments[i - 1].end));
  const chunks = chunkNarrative(withProg.segments, 1200);
  t("chunk boundaries still fall on segment boundaries with the new segment present",
    chunks.reduce((acc, c) => acc + c.segments.length, 0) === withProg.segments.length);

  // ── narrativeProgressions directly: the opt-in guard ───────────────────
  t("no jdTarget (null, undefined, or NaN) yields an empty string",
    narrativeProgressions(chart, null) === "" && narrativeProgressions(chart, undefined) === "" && narrativeProgressions(chart, NaN) === "");
  t("no chart yields an empty string", narrativeProgressions(null, jdNow) === "");
  t("a real chart and target yields real prose", narrativeProgressions(chart, jdNow).length > 20);

  // ── progressionsText: a precomputed string, used verbatim ──────────────
  const precomputed = narrativeProgressions(chart, jdNow);
  const withText = buildChartNarrative(chart, { progressionsText: precomputed });
  const segText = withText.segments[withText.segments.length - 1];
  t("progressionsText alone (no jdTarget) still adds exactly one progressions segment",
    withText.segments.filter((s) => s.kind === "progressions").length === 1);
  t("its text is the precomputed string, verbatim", segText.text === precomputed);
  // jdTarget: chart.jd would (via lifecycleText's own default) ALSO add a
  // lifecycle segment derived from a different instant than precomputed's
  // — that's expected and unrelated to what's under test here, so the
  // check is scoped to the progressions segment specifically, not the
  // whole narrative's text.
  const precedenceResult = buildChartNarrative(chart, { jdTarget: chart.jd, progressionsText: precomputed });
  const precedenceSeg = precedenceResult.segments.find((s) => s.kind === "progressions");
  t("progressionsText takes precedence over jdTarget when both are given — no re-derivation",
    !!precedenceSeg && precedenceSeg.text === precomputed, precedenceSeg && precedenceSeg.text);
  t("progressionsText: '' (computed, nothing to say) adds no progressions segment, distinct from null",
    !buildChartNarrative(chart, { progressionsText: "", jdTarget: jdNow, lifecycleText: "" })
      .segments.some((s) => s.kind === "progressions"));
  t("progressionsText: null falls back to computing from jdTarget",
    buildChartNarrative(chart, { progressionsText: null, jdTarget: jdNow }).text === withProg.text);

  // ── regression: session.jsx must not compute progressionsText inside
  //    the agent.text-coupled memo — the exact bug already fixed once for
  //    lifecycleText, pinned here on principle for the sibling digest.
  const sessionSrc = readFileSync(join(ROOT, "session.jsx"), "utf8");
  const pStart = sessionSrc.indexOf("const progressionsText = $sUseMemo(");
  const nStart = sessionSrc.indexOf("const narrative = $sUseMemo(() => {");
  const progMemo = pStart >= 0 && nStart > pStart ? sessionSrc.slice(pStart, nStart) : "";
  t("session.jsx computes progressionsText in its own $sUseMemo", progMemo.length > 0);
  t("that memo's dependency array is exactly [chart, jdSessionNow]",
    /\$sUseMemo\(\s*\(\) => [^\n]*,\s*\[chart, jdSessionNow\]\s*\)/.test(progMemo), progMemo);
  t("that memo is the one place narrativeProgressions is actually called",
    /narrativeProgressions\(chart, jdSessionNow\)/.test(progMemo), progMemo);

  const nextMarker = sessionSrc.indexOf("// Where each narrative segment", nStart);
  const narrativeMemo = nStart >= 0 && nextMarker > nStart ? sessionSrc.slice(nStart, nextMarker) : "";
  t("the narrative memo never calls narrativeProgressions or progressionsDigest directly",
    !/narrativeProgressions\(|progressionsDigest\(/.test(narrativeMemo), narrativeMemo);
  t("...and passes the precomputed progressionsText through to buildChartNarrative",
    /buildChartNarrative\(chart, \{ agentTexts, lifecycleText, progressionsText \}\)/.test(narrativeMemo), narrativeMemo);
  t("...and its dependency array includes progressionsText",
    /\[chart, order, agentOn, agent\.text, lifecycleText, progressionsText\]/.test(narrativeMemo), narrativeMemo);

  return rows;
}
