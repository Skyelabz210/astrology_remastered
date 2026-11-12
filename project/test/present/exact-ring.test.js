// P31 canonical exact-ring integration regression gate.
//
// Audits every HTML entrypoint that loads astro.jsx, validates the BigInt
// arithmetic and boundary rounding, and compares the canonical implementation
// against the fallback function bodies extracted from the shipped astro.jsx.
// Browser smoke tests separately verify that modules actually initialize.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  RING_ARCSEC, SIGN_ARC, wrapDegToArcsec, signedArc, arcDistance, decompose,
  speedArcsecPerDay, lotAdd, ASPECT_LATTICE, nearestAspectRing, phaseExact,
  houseWholeSign, houseEqual, houseForCuspsExact, laneResidues, closureProfile,
  formatDms,
} from "../../src/present/exact-ring.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

// ── astro.jsx inline fallback, re-implemented here from ITS source ────
// Parse the actual function bodies out of astro.jsx so parity is tested
// against what ships, not against a copy of the convention in this file.
const ASTRO_SRC = read("astro.jsx");
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`astro.jsx: function ${name}() not found`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const roundHalfAwayFromZero = new Function("return " + extractFn(ASTRO_SRC, "roundHalfAwayFromZero"))();
const degToRingArcsec = new Function(
  "BigInt", "roundHalfAwayFromZero", "ARCSEC_PER_DEG",
  extractFn(ASTRO_SRC, "degToRingArcsec") + "; return degToRingArcsec;"
)(BigInt, roundHalfAwayFromZero, 3600);

// Extract the shipped fallback lattice and arithmetic, not a test-only copy.
const latticeStart = ASTRO_SRC.indexOf("const RING_LATTICE = [");
const latticeEnd = ASTRO_SRC.indexOf("\n];", latticeStart);
if (latticeStart < 0 || latticeEnd < 0) {
  throw new Error("astro.jsx: RING_LATTICE not found");
}
const fallback = new Function("roundHalfAwayFromZero", `
  const RING_B = 1296000n;
  const EXACT_RING_AVAILABLE = () => false;
  ${ASTRO_SRC.slice(latticeStart, latticeEnd + 3)}
  ${extractFn(ASTRO_SRC, "arcDistanceB")}
  ${extractFn(ASTRO_SRC, "aspectFromRing")}
  ${extractFn(ASTRO_SRC, "phaseFromRing")}
  return { aspectFromRing, phaseFromRing };
`)(roundHalfAwayFromZero);

export async function run() {
  const rows = [];
  const check = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  // ── 1. Wiring: the canonical module must precede every chart core ──
  const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  let audited = 0;
  for (const f of htmlFiles) {
    const src = read(f);
    const tags = [...src.matchAll(/<script\b[^>]*>/gi)];
    const astro = tags.find((m) => /\bsrc=["']astro\.jsx["']/i.test(m[0]));
    if (!astro) continue;
    audited++;
    const ring = tags.filter((m) => /\bsrc=["']src\/present\/exact-ring\.js["']/i.test(m[0]));
    const valid = ring.length === 1
      && /\btype=["']module["']/i.test(ring[0][0])
      && ring[0].index < astro.index;
    check(`${f}: canonical ES module precedes astro.jsx`, valid,
      valid ? "" : "missing, duplicated, wrong type, or after astro.jsx");
  }
  check("at least one astro.jsx page found to audit", audited > 0);

  // ── 2. Boundary math: round first, then reduce modulo 1,296,000 ───
  check("every harmonic target is the nearest arcsecond to its advertised angle",
        ASPECT_LATTICE.every(a => a.target === BigInt(Math.round(a.angle * 3600))));
  check("undecile target rounds one eleventh of the integer ring", ASPECT_LATTICE.find(a => a.name === "Undecile").target === (1296000n + 5n) / 11n);
  check("tredecile target rounds one thirteenth of the integer ring", ASPECT_LATTICE.find(a => a.name === "Tredecile").target === (1296000n + 6n) / 13n);
  check("ring constants have the correct values/types",
        RING_ARCSEC === 1296000 && SIGN_ARC === 108000n);
  check("wrapDegToArcsec(0) = 0n", wrapDegToArcsec(0) === 0n);
  check("wrapDegToArcsec(360) wraps to 0n", wrapDegToArcsec(360) === 0n);
  check("wrapDegToArcsec(-0.0001) rounds to zero", wrapDegToArcsec(-0.0001) === 0n);
  check("wrapDegToArcsec(-0.0002) rounds to last arcsecond", wrapDegToArcsec(-0.0002) === 1295999n);
  check("wrapDegToArcsec(10.0000042) = 36000n",
        wrapDegToArcsec(10.0000042) === 36000n);
  check("wrapDegToArcsec(359.9999997) wraps to zero",
        wrapDegToArcsec(359.9999997) === 0n);
  check("wrapDegToArcsec(359.9998) is last arcsecond",
        wrapDegToArcsec(359.9998) === 1295999n);
  check("wrapDegToArcsec rejects NaN", (() => { try { wrapDegToArcsec(NaN); return false; } catch { return true; } })());
  check("wrapDegToArcsec output ∈ [0, RING) over 4000 sampled degrees", (() => {
    for (let k = -2000; k < 2000; k++) {
      const s = wrapDegToArcsec(k * 0.173);
      if (s < 0n || s >= 1296000n) return false;
    }
    return true;
  })());

  // Parity with the shipped astro.jsx inline fallback (same convention or the
  // header comment's "never diverge" claim is void).
  check("astro.jsx degToRingArcsec fallback agrees with wrapDegToArcsec (7000 samples)", (() => {
    for (let k = -3500; k < 3500; k++) {
      const deg = k * 0.101;
      if (wrapDegToArcsec(deg) !== degToRingArcsec(deg)) return false;
    }
    return true;
  })());

  // Compare the canonical implementation to the actual legacy fallback
  // implementation, including aspect metadata and relative-motion phases.
  check("astro.jsx aspectFromRing parity (deterministic ring samples)", (() => {
    const fields = ["name", "angle", "family", "target", "orbArcsec", "sepArcsec", "exact"];
    for (let a = 0n; a < 1296000n; a += 1811n) {
      const b = (a * 37n + 913n) % 1296000n;
      for (const scale of [0.5, 1, 1.5, 10]) {
        const canonical = nearestAspectRing(a, b, scale);
        const legacy = fallback.aspectFromRing(a, b, scale);
        if (canonical === null || legacy === null) {
          if (canonical !== legacy) return false;
        } else if (!fields.every((field) => canonical[field] === legacy[field])) {
          return false;
        }
      }
    }
    return true;
  })());
  check("astro.jsx phaseFromRing parity (all aspect targets)", (() => {
    for (const { target } of ASPECT_LATTICE) {
      for (let a = 0n; a < 1296000n; a += 51731n) {
        const b = (a * 17n + 373n) % 1296000n;
        for (const velocity of [-5n, 0n, 5n]) {
          if (phaseExact(a, b, velocity, 0n, target)
              !== fallback.phaseFromRing(a, b, velocity, 0n, target)) return false;
        }
      }
    }
    return true;
  })());

  // ── 3. Ring arithmetic ────────────────────────────────────────────
  check("signedArc(100n, 90n) = 10n", signedArc(100n, 90n) === 10n);
  check("signedArc near the wrap: (5n, 1295995n) = 10n", signedArc(5n, 1295995n) === 10n);
  check("signedArc tie at ±180° resolves positive", signedArc(0n, 648000n) === 648000n);
  check("arcDistance symmetric", arcDistance(1000n, 400n) === arcDistance(400n, 1000n) && arcDistance(1000n, 400n) === 600n);
  check("arcDistance across 0°: (100n, 1295900n) = 200n", arcDistance(100n, 1295900n) === 200n);

  // Proven by direct computation: 1234567 = 11×108000 + 46567;
  // 46567 = 12×3600 + 56×60 + 7  →  Sagittarius 12°56′07″.
  const d = decompose(1234567n);
  check("decompose(1234567n) hierarchical radix exact",
        d.sign === 11 && d.degree === 12 && d.arcminute === 56 && d.arcsecond === 7 && d.arcsecInSign === 46567,
        JSON.stringify(d));
  check("formatDms(1234567n) = '12°56′07″'", formatDms(1234567n) === "12°56′07″");
  check("decompose→format roundtrip at sign boundary 107999n", formatDms(107999n) === "29°59′59″");

  check("speedArcsecPerDay: +6h sample ahead ⟺ direct (positive)",
        speedArcsecPerDay(1000n, 900n) === 200n);
  check("speedArcsecPerDay: retrograde ⟺ negative",
        speedArcsecPerDay(900n, 1000n) === -200n);
  check("speedArcsecPerDay wrap-safe (Moon crossing 0°)",
        speedArcsecPerDay(50n, 1295800n) === 500n);

  check("lotAdd exact modular (asc + x − y) mod R",
        lotAdd(100n, 50n, 200n) === ((100n + 50n - 200n + 1296000n) % 1296000n));
  check("lotAdd wraps negatives into [0,R)", (() => {
    const s = lotAdd(0n, 0n, 1n);
    return s === 1295999n;
  })());

  // Aspects: integer targets, integer orbs.
  check("ASPECT_LATTICE all targets BigInt in [0, RING]",
        ASPECT_LATTICE.every((a) => typeof a.target === "bigint" && a.target >= 0n && a.target <= 648000n));
  const conj = nearestAspectRing(500n, 400n, 1);
  check("nearestAspectRing finds Conjunction at 100″ separation",
        conj && conj.name === "Conjunction" && conj.sepArcsec === 100n && !conj.exact);
  check("nearestAspectRing marks exact aspect sep=0n",
        (() => { const a = nearestAspectRing(648000n, 0n, 1); return a && a.name === "Opposition" && a.exact === true; })());
  // 300000″ ≈ 83.33° — inside the square's 25200″ orb (sep 24000″).
  const sq = nearestAspectRing(300000n, 0n, 1);
  check("nearestAspectRing: 83.33° reads Square at 24000″ sep",
        sq && sq.name === "Square" && sq.sepArcsec === 24000n);
  // Deterministic off-lattice point: 291600″ = 81° — 9° from both the quintile
  // (72°, orb 7200″) and the square (90°, orb 25200″): outside every orb.
  check("nearestAspectRing at 81° (32400″ from nearest targets) returns null",
        nearestAspectRing(291600n, 0n, 1) === null);
  check("orbScale scales the disclosure radius only",
        (() => { const a = nearestAspectRing(291600n, 0n, 10); return a !== null; })());

  check("phaseExact: exact at target", phaseExact(648000n, 0n, 100n, 0n, 648000n) === "exact");
  // Below-target pair opening ⟺ rel < 0 (the arc shrinks toward 0 by itself);
  // above-target pair opening ⟺ rel > 0. Verified against the shipped code:
  check("phaseExact: separating below target with negative relative velocity",
        phaseExact(100n, 0n, -5n, 0n, 648000n) === "separating");
  check("phaseExact: applying below target with positive relative velocity",
        phaseExact(100n, 0n, 5n, 0n, 648000n) === "applying");
  // A sextile is reachable above target: 220000″ > 216000″ (60°).
  check("phaseExact: separating above sextile target",
        phaseExact(220000n, 0n, 5n, 0n, 216000n) === "separating");
  check("phaseExact: applying above sextile target",
        phaseExact(220000n, 0n, -5n, 0n, 216000n) === "applying");
  check("phaseExact: static on zero relative velocity", phaseExact(100n, 0n, 7n, 7n, 648000n) === "static");

  // Houses.
  check("houseWholeSign: same sign as ASC ⟹ house 1", houseWholeSign(5000n, 1000n) === 1);
  // 108000n+5 is in sign index 1; ASC at 108000×11+5 is sign index 11 →
  // ((1 − 11 + 12) mod 12) + 1 = 3. Proven expectation, matched to the code.
  check("houseWholeSign: wraps by sign index", houseWholeSign(108000n * 1n + 5n, 108000n * 11n + 5n) === 3);
  check("houseEqual: 0..12", houseEqual(0n, 0n) === 1 && houseEqual(108000n, 0n) === 2 && houseEqual(1295999n, 0n) === 12);
  const cusps = Array.from({ length: 12 }, (_, i) => wrapDegToArcsec(i * 30 + 0.5));
  check("houseForCuspsExact: 1° inside cusp-1 arc ⟹ house 1", houseForCuspsExact(wrapDegToArcsec(1), cusps) === 1);
  check("houseForCuspsExact: 31° ⟹ house 2", houseForCuspsExact(wrapDegToArcsec(31), cusps) === 2);
  check("houseForCuspsExact: just before cusp 1 (≈0°) ⟹ house 12", houseForCuspsExact(wrapDegToArcsec(359.9), cusps) === 12);

  // Safe-Basis projection: 8 lanes, pure BigInt residues.
  const lanes = laneResidues(1234567n);
  check("laneResidues returns all 8 centred basis lanes",
        ["r2","r3","r5","r7","r11","r13","r17","r19"].every((k) => typeof lanes[k] === "bigint"));
  check("laneResidues matches direct s mod p", lanes.r7 === 1234567n % 7n && lanes.r19 === 1234567n % 19n);

  const prof = closureProfile([2n, 3n, 7n]);
  check("closureProfile: 2 and 3 close, 7 reports its defect",
        prof[0].closes && prof[1].closes && !prof[2].closes && prof[2].defect === 1296000n % 7n);

  // ── 4. Disclosed naming drift (documented, not silently wrong) ─────
  // astro.jsx tags the no-module fallback "LEGACY_FLOAT", but that path is
  // integer-arcsec too (see its own comment). The label understates it; kept
  // for badge compatibility. Assert both sites still say the same thing so a
  // rename stays coupled.
  const modeLine = ASTRO_SRC.includes('"EXACT_RING" : "LEGACY_FLOAT"');
  check("astro.jsx EXACT_RING_MODE badge strings intact", modeLine);

  return rows;
}
