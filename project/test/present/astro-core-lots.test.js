// test/present/astro-core-lots.test.js — WP-22: Node port of tests.jsx's
// Hellenistic-lots, lunar-phase, and CRT-residues suites (7, 10, 17).
//
// Lots and lunar phase are pure astro-core.js (WP-21) logic, imported
// directly. The CRT-residues suite is split across two source modules in
// the real app, and this file follows tests.jsx exactly in doing the same:
//   - residues(arcsec) — pure integer-lane arithmetic — lives in
//     astro-core.js (imported directly, no vm needed).
//   - SHADOW_LANE_NAMES / BOUNDARY_LANE_NAMES — the lane-name tables tests.jsx
//     reads as bare globals — are NOT in astro-core.js at all; they are
//     defined in project/readings.jsx (grep confirms: `grep -n
//     SHADOW_LANE_NAMES project/*.jsx` finds only readings.jsx's
//     declaration + several `.jsx` call sites, never astro-core.js).
//     readings.jsx is a plain browser classic script (Object.assign(window,
//     {...}) at the bottom, no `export`), so it is loaded UNMODIFIED via
//     node:vm against a minimal `window` stub — the same "least invasive"
//     approach test/cram-tools.test.js (WP-23) and
//     test/astro-ephemeris.test.js (WP-17) use for browser-global scripts.
//     readings.jsx has no DOM calls at load time, so no document stub is
//     needed.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeAllLots, lunarPhase, residues } from "../../src/present/astro-core.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

function loadReadings() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(ROOT, "readings.jsx"), "utf8"), sandbox, { filename: "readings.jsx" });
  return sandbox;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── Suite 7: Hellenistic lots — day/night sect inversion ─────────────
  // Asc=0, Sun=10, Moon=100. Day: Fortune = Asc + Moon − Sun = 90.
  {
    const lots = computeAllLots(0, [
      { name: "Sun", lon: 10 }, { name: "Moon", lon: 100 },
      { name: "Venus", lon: 0 }, { name: "Mars", lon: 0 }, { name: "Jupiter", lon: 0 },
      { name: "Mercury", lon: 0 }, { name: "Saturn", lon: 0 },
    ], true);
    const fortune = lots.find((l) => l.name === "Fortune").lon;
    t("Fortune day formula", Math.abs(fortune - 90) < 1e-5, `got ${fortune}`);
  }
  {
    const lots = computeAllLots(0, [
      { name: "Sun", lon: 10 }, { name: "Moon", lon: 100 },
      { name: "Venus", lon: 0 }, { name: "Mars", lon: 0 }, { name: "Jupiter", lon: 0 },
      { name: "Mercury", lon: 0 }, { name: "Saturn", lon: 0 },
    ], true);
    const spirit = lots.find((l) => l.name === "Spirit").lon;
    t("Spirit day formula", Math.abs(spirit - 270) < 1e-5, `got ${spirit}`);
  }
  {
    const common = [
      { name: "Sun", lon: 10 }, { name: "Moon", lon: 100 },
      { name: "Venus", lon: 0 }, { name: "Mars", lon: 0 }, { name: "Jupiter", lon: 0 },
      { name: "Mercury", lon: 0 }, { name: "Saturn", lon: 0 },
    ];
    const a = computeAllLots(0, common, true);
    const b = computeAllLots(0, common, false);
    const fortuneDay = a.find((l) => l.name === "Fortune").lon;
    const spiritNight = b.find((l) => l.name === "Spirit").lon;
    t("Sect inverts Fortune ↔ Spirit at night", Math.abs(fortuneDay - spiritNight) < 0.001);
  }
  {
    const lots = computeAllLots(0, [
      { name: "Sun", lon: 10 }, { name: "Moon", lon: 100 },
      { name: "Venus", lon: 50 }, { name: "Mars", lon: 200 }, { name: "Jupiter", lon: 30 },
      { name: "Mercury", lon: 5 }, { name: "Saturn", lon: 250 },
    ], true);
    t("all 7 lots present",
      lots.map((l) => l.name).join(",") === "Fortune,Spirit,Eros,Necessity,Courage,Victory,Nemesis");
  }

  // ── Suite 10: Lunar phase — Moon−Sun elongation, illumination, names ──
  {
    const p = lunarPhase(0, 0);
    t("Δ=0 → New, 0% illumination", `${p.phase}/${(p.illumination * 100).toFixed(0)}%` === "New/0%");
  }
  {
    const p = lunarPhase(0, 180);
    t("Δ=180 → Full, 100% illumination", `${p.phase}/${(p.illumination * 100).toFixed(0)}%` === "Full/100%");
  }
  {
    const p = lunarPhase(0, 90);
    t("Δ=90 → First Quarter, 50%", `${p.phase}/${(p.illumination * 100).toFixed(0)}%` === "First Quarter/50%");
  }
  {
    const p = lunarPhase(0, 270);
    t("Δ=270 → Last Quarter, 50%", `${p.phase}/${(p.illumination * 100).toFixed(0)}%` === "Last Quarter/50%");
  }

  // ── Suite 17: CRT residues · Mayan substrate ──────────────────────────
  t("r₂(7) = 1",  residues(7).r2 === 1);
  t("r₃(9) = 0",  residues(9).r3 === 0);
  t("r₅(25) = 0", residues(25).r5 === 0);
  t("r₇(50) = 1", residues(50).r7 === 1);
  t("r₁₁(22) = 0 (shadow lane Origin)", residues(22).r11 === 0);
  t("r₁₃(26) = 0", residues(26).r13 === 0);
  {
    const r = residues(987654);
    t("all residues in [0, prime)",
      r.r2 < 2 && r.r3 < 3 && r.r5 < 5 && r.r7 < 7 && r.r11 < 11 && r.r13 < 13);
  }
  {
    const r = residues(12345);
    const K = ((r.r11 * 13) + r.r13) % 323;
    t("Gear K = (r₁₁·13 + r₁₃) mod 323, range [0, 323)", K >= 0 && K <= 322, `K=${K}`);
  }
  {
    const readings = loadReadings();
    t("Shadow lane name table has 11 entries", readings.SHADOW_LANE_NAMES.length === 11);
    t("Boundary lane name table has 13 entries", readings.BOUNDARY_LANE_NAMES.length === 13);
  }

  return R;
}
