// test/present/synastry.test.js — synastry.jsx's cross-chart shadow lanes.
//
// synastry.jsx (crossAspects, houseOverlays, crossReceptions,
// compatibilityScore, synastryCTM, computeSynastry) has had no dedicated
// unit test file before this one. This file does NOT attempt a full
// retroactive spec of that surface — it covers only synastryCTM's
// sharedLanes/lanesReliable, the piece this fix touches, on the same
// narrow-scope principle test/present/agent-lifecycle.test.js documents
// for itself.
//
// sharedLanes compares BOTH charts' NATAL arcsecond residues (mod 11).
// Found via a fresh-look audit after the sibling fixes in time.jsx and
// narrative.jsx shipped: this comparison was unconditional on either
// chart's timeUnknown, the exact class of bug those fixes addressed —
// checked directly against the real ephemeris (not assumed), every body's
// own natal lane cycles through all eleven residues inside a single day
// of birth-time uncertainty, so a "coincidence" against an effectively
// random residue on either side isn't one. lanesReliable now says so
// explicitly, following the same all-or-nothing shape as lifecycleDigest's
// and narrativeClosing's own shared-lane facts.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

async function loadSandbox() {
  const sb = {};
  sb.window = sb;
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  // Real page order (Resonance Spread.html): astro.jsx, time.jsx,
  // synastry.jsx, readings.jsx — synastry.jsx runs before readings.jsx
  // defines SHADOW_LANE_NAMES, but that's fine: it's only referenced
  // inside synastryCTM's body, never at load time, and by the time
  // anything actually CALLS synastryCTM, all four have already loaded.
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "synastry.jsx", "readings.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }
  return sb;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const sb = await loadSandbox();
  const { synastryCTM, computeNatal } = sb;

  const chartA = computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const chartB = computeNatal({ dateISO: "1985-03-14T08:12:00Z", lat: 40.7128, lng: -74.0060, houseSystem: "whole" });

  // ── positive control: two known-time charts genuinely share lanes ─────
  const known = synastryCTM(chartA, chartB);
  t("sanity: this chart pair has real shared lanes to withhold below",
    known.lanesReliable === true && known.sharedLanes.length > 0,
    JSON.stringify(known.sharedLanes));
  t("every shared-lane entry actually matches both charts' own residues",
    known.sharedLanes.every((s) => {
      const a = chartA.planets.find((p) => p.name === s.a);
      const b = chartB.planets.find((p) => p.name === s.b);
      return a && b && a.residues.r11 === s.lane && b.residues.r11 === s.lane;
    }),
    JSON.stringify(known.sharedLanes));

  // ── either chart's unknown birth time withholds the comparison entirely,
  //    not just for that chart's own bodies — the WHOLE list is withheld,
  //    since every remaining pairing still names one body from the
  //    unreliable side ──────────────────────────────────────────────────
  const chartAUnknown = { ...chartA, timeUnknown: true };
  const chartBUnknown = { ...chartB, timeUnknown: true };

  const aUnknown = synastryCTM(chartAUnknown, chartB);
  t("A's birth time unknown: lanesReliable is false", aUnknown.lanesReliable === false);
  t("A's birth time unknown: sharedLanes is empty, not partially filtered",
    aUnknown.sharedLanes.length === 0, JSON.stringify(aUnknown.sharedLanes));

  const bUnknown = synastryCTM(chartA, chartBUnknown);
  t("B's birth time unknown: lanesReliable is false", bUnknown.lanesReliable === false);
  t("B's birth time unknown: sharedLanes is empty", bUnknown.sharedLanes.length === 0);

  const bothUnknown = synastryCTM(chartAUnknown, chartBUnknown);
  t("both birth times unknown: lanesReliable is false", bothUnknown.lanesReliable === false);
  t("both birth times unknown: sharedLanes is empty", bothUnknown.sharedLanes.length === 0);

  // ── everything else synastryCTM computes is untouched by this fix —
  //    the phase-syndrome layer reads only .jd, never .planets residues ──
  t("the phase-syndrome fields are identical whether or not birth time is known",
    known.syndromeDeg === aUnknown.syndromeDeg
    && known.syndromeFoldDeg === aUnknown.syndromeFoldDeg
    && known.midThetaDeg === aUnknown.midThetaDeg);

  return rows;
}
