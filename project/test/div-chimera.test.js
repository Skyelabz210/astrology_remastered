// test/div-chimera.test.js — exhaustive checks for src/core/div-chimera.js,
// the Division Chimera (V1-V5, router, DIV³, Φ³).
//
// Mirrors the external CRAM reference implementation's own proof certificate
// (cram_review_20260616/PROOF_CERTIFICATE.md, Part VI "Division Chimera")
// theorem by theorem — T-DIV-V1..V5, T-ROUTER, T-DISTINCT, T-DIV3-CONSTRUCTION,
// T-DIV3-CORRECT, T-PHI3 — over this port's own domain (BigInt, this core's
// Safe Basis B8) rather than re-running the Python original.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { B8, M8 } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import { gcd, inverse } from "../src/core/cram.js";
import {
  ROOT_OPS, CHIMERA_ROLES, DEFAULT_ANCHORS, DEFAULT_ALT_BASIS,
  NonExactDivisionError, DivisorNotCoprimeError,
  laneOp, v1KElim, v2FpdFused, v3FpdAnchors,
  v4LanewiseDivHomogeneous, v4LanewiseDivHeterogeneous,
  transduceLane, v5Transduced, route,
  div3Mul, div3Schema, phi3Certify,
} from "../src/core/div-chimera.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// Divisors coprime to M8 = 2*3*5*7*11*13*17*19: primes past B8, plus one
// composite of two of them (667 = 23*29) to confirm coprimality is what
// matters, not primality of the divisor itself.
const COPRIME_DIVISORS = [23n, 29n, 31n, 37n, 41n, 43n, 47n, 667n];
// Divisors sharing a factor with M8 — V1 must refuse these; V5 must not.
const SHARED_DIVISORS = [2n, 3n, 6n, 11n, 22n, 26n, 34n, 38n];
const K_RANGE = 40n;

function trap(fn) {
  try { return { threw: false, value: fn(), err: null }; }
  catch (err) { return { threw: true, value: null, err }; }
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── T-DIV-V1: K-Elimination division ──────────────────────────────
  for (const d of COPRIME_DIVISORS) {
    let bad = null, n = 0n;
    for (let k = 0n; k < K_RANGE; k++) {
      const aVal = d * k;
      const { q, alpha } = v1KElim(aVal, d, B8);
      const expectAlpha = B8.map((p) => mod(k, p));
      if (q !== k || !arraysEqual(alpha, expectAlpha)) { bad = { k, q, alpha }; break; }
      n++;
    }
    t(`V1: q=a/d and lanewise alpha exact for d=${d} over ${K_RANGE} multiples`,
      bad === null && n === K_RANGE, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("V1 throws NonExactDivisionError when d does not divide a",
    trap(() => v1KElim(7n, 23n, B8)).err instanceof NonExactDivisionError);
  t("V1 throws DivisorNotCoprimeError when gcd(d, M) != 1",
    trap(() => v1KElim(4n, 2n, B8)).err instanceof DivisorNotCoprimeError);
  t("V1 at d=1 is the identity (q=a, alpha=decompose(a))",
    (() => {
      const { q, alpha } = v1KElim(123456n, 1n, B8);
      return q === 123456n && arraysEqual(alpha, B8.map((p) => mod(123456n, p)));
    })());

  // ── T-DIV-V2: FPD, fused form ──────────────────────────────────────
  for (const d of COPRIME_DIVISORS) {
    let bad = null, n = 0n;
    for (let a = 1n; a <= 10n; a++) {
      for (let b = 1n; b <= 10n; b++) {
        const bScaled = b * d; // guarantees d | (a * bScaled)
        const trueQ = (a * bScaled) / d;
        const { q, alpha } = v2FpdFused(a, bScaled, d, B8);
        const expectAlpha = B8.map((p) => mod(trueQ, p));
        if (q !== trueQ || !arraysEqual(alpha, expectAlpha)) { bad = { a, b, q, trueQ }; break; }
        n++;
      }
      if (bad) break;
    }
    t(`V2: fused (a*b)/d exact for d=${d} over ${n} (a,b) pairs`,
      bad === null && n === 100n, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("V2 throws NonExactDivisionError when d does not divide a*b",
    trap(() => v2FpdFused(3n, 5n, 23n, B8)).err instanceof NonExactDivisionError);

  // ── T-DIV-V3: FPD, anchor form ──────────────────────────────────────
  {
    // A divisor coprime to every default anchor (23,29,31,37,41): any value
    // not itself one of those primes works, since they're all prime.
    const d = 30n; // = 2*3*5, coprime to 23..41
    let bad = null, n = 0n;
    for (let k = 0n; k < K_RANGE; k++) {
      const aVal = d * k;
      const { q, reads } = v3FpdAnchors(aVal, d);
      if (q !== k) { bad = { k, q }; break; }
      for (const A of DEFAULT_ANCHORS) {
        if (reads.get(A) !== mod(k, A)) { bad = { k, A, read: reads.get(A) }; break; }
      }
      if (bad) break;
      n++;
    }
    t(`V3: anchor reads exact for d=${d} over ${K_RANGE} multiples across all ${DEFAULT_ANCHORS.length} default anchors`,
      bad === null && n === K_RANGE, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("V3 throws DivisorNotCoprimeError when no candidate anchor is coprime to d",
    trap(() => v3FpdAnchors(23n * 5n, 23n, [23n])).err instanceof DivisorNotCoprimeError);
  t("V3 throws NonExactDivisionError when d does not divide a",
    trap(() => v3FpdAnchors(7n, 30n)).err instanceof NonExactDivisionError);

  // ── T-DISTINCT: V1 and V3 reach the same quotient by distinct mechanisms ──
  {
    let bad = null, n = 0n;
    const d = 43n; // coprime to both M8 (V1's requirement) and the default anchors (V3's)
    for (let k = 0n; k < K_RANGE; k++) {
      const aVal = d * k;
      const v1 = v1KElim(aVal, d, B8).q;
      const v3 = v3FpdAnchors(aVal, d).q;
      if (v1 !== v3 || v1 !== k) { bad = { k, v1, v3 }; break; }
      n++;
    }
    t(`V1 and V3 agree on q=a/d for d=${d} over ${K_RANGE} multiples (distinct mechanisms, one outcome)`,
      bad === null && n === K_RANGE, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }

  // ── T-DIV-V4-HOM: lanewise DIV, homogeneous ────────────────────────
  for (const d of COPRIME_DIVISORS) {
    let bad = null, n = 0n;
    for (let a = 0n; a < K_RANGE; a++) {
      const { tray, expect } = v4LanewiseDivHomogeneous(a, d, B8);
      const expectTray = B8.map((p) => mod(expect, p));
      if (!arraysEqual(tray, expectTray)) { bad = { a, tray, expectTray }; break; }
      // Where d genuinely divides a, the ring-lift value's residues must
      // also equal the true integer quotient's residues (V1 cross-check).
      if (mod(a, d) === 0n) {
        const trueQ = a / d;
        if (!arraysEqual(tray, B8.map((p) => mod(trueQ, p)))) { bad = { a, tray, trueQ }; break; }
      }
      n++;
    }
    t(`V4 homogeneous: lanewise tray = ring-lift for d=${d} over ${K_RANGE} values of a`,
      bad === null && n === K_RANGE, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("V4 homogeneous throws DivisorNotCoprimeError for a non-unit divisor",
    trap(() => v4LanewiseDivHomogeneous(4n, 2n, B8)).err instanceof DivisorNotCoprimeError);

  // ── T-DIV-V4-HET: lanewise DIV, heterogeneous ──────────────────────
  {
    // One operator per lane, at user discretion; div where the divisor is a
    // unit in that specific lane, something else elsewhere.
    const ops = ["add", "mul", "div", "sub", "sqr", "id", "neg", "inv"];
    const aVal = 17n, bVal = 5n;
    const { tray, mask } = v4LanewiseDivHeterogeneous(aVal, bVal, ops, B8);
    let bad = null;
    B8.forEach((p, i) => {
      const expect = laneOp(ops[i], aVal, bVal, p);
      if (tray[i] !== expect || mask[i] !== (expect !== null)) bad = { i, p, got: tray[i], expect };
    });
    t("V4 heterogeneous: per-lane result matches direct laneOp evaluation, mask reflects definedness",
      bad === null, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : "8 lanes checked");
  }
  t("V4 heterogeneous masks a lane false when div's divisor is non-invertible there (lane 2, even divisor)",
    (() => {
      const { tray, mask } = v4LanewiseDivHeterogeneous(3n, 4n, ["div"], [2n]);
      return tray[0] === null && mask[0] === false;
    })());

  // ── transduceLane: the raw formula ─────────────────────────────────
  t("transduceLane(gamma,K,M,b) = (gamma + K*M) mod b for arbitrary b, coprime to M or not",
    (() => {
      const gammaV = 12345n, K = 7n, M = M8, b = 91n; // gcd(M8, 91) = 91: no inverse of M8 mod 91
      const x = gammaV + K * M;
      return gcd(M, b) !== 1n && transduceLane(gammaV, K, M, b) === mod(x, b);
    })());

  // ── T-DIV-V5: transduction-enriched division ───────────────────────
  for (const d of SHARED_DIVISORS) {
    let bad = null, n = 0n;
    for (let k = 0n; k < K_RANGE; k++) {
      const aVal = d * k;
      const { q, resHome } = v5Transduced(aVal, d, B8);
      const expectHome = B8.map((p) => mod(k, p));
      if (q !== k || !arraysEqual(resHome, expectHome)) { bad = { k, q, resHome }; break; }
      n++;
    }
    t(`V5: transduction-enriched q=a/d and homeward residues exact for d=${d} over ${K_RANGE} multiples`,
      bad === null && n === K_RANGE, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("V5 throws NonExactDivisionError when d does not divide a",
    trap(() => v5Transduced(7n, 2n, B8)).err instanceof NonExactDivisionError);
  t("V5 throws DivisorNotCoprimeError when the alternate basis is not coprime to d",
    trap(() => v5Transduced(46n, 2n, B8, [2n, 23n])).err instanceof DivisorNotCoprimeError);

  // ── T-ROUTER: dispatch selects the natural variety, in both branches ──
  {
    let bad = null, n = 0n;
    for (const d of COPRIME_DIVISORS) {
      for (let k = 0n; k < 10n; k++) {
        const aVal = d * k;
        const { variety, q } = route(aVal, d, B8);
        if (variety !== "V1_k_elim" || q !== k) { bad = { d, k, variety, q }; break; }
        n++;
      }
      if (bad) break;
    }
    t(`router selects V1 for every coprime divisor tested (${n} cases)`,
      bad === null, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  {
    let bad = null, n = 0n;
    for (const d of SHARED_DIVISORS) {
      for (let k = 0n; k < 10n; k++) {
        const aVal = d * k;
        const { variety, q } = route(aVal, d, B8);
        if (variety !== "V5_transduced" || q !== k) { bad = { d, k, variety, q }; break; }
        n++;
      }
      if (bad) break;
    }
    t(`router selects V5 for every shared-factor divisor tested (${n} cases)`,
      bad === null, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }
  t("router handles a negative dividend correctly (sign reapplied after absolute-value routing)",
    route(-46n, 23n, B8).q === -2n);
  t("router handles a negative divisor correctly",
    route(46n, -23n, B8).q === -2n);
  t("router handles both operands negative correctly (negative/negative = positive)",
    route(-46n, -23n, B8).q === 2n);
  t("router throws on division by zero",
    trap(() => route(1n, 0n, B8)).err.message.includes("division by zero"));
  t("router throws NonExactDivisionError on a non-exact division",
    trap(() => route(7n, 23n, B8)).err instanceof NonExactDivisionError);

  // ── T-DIV3-CONSTRUCTION: div3Mul's own source uses "div" three times, ──
  // "mul" (as a laneOp call, not merely as a word) zero times.
  {
    const src = readFileSync(join(HERE, "..", "src", "core", "div-chimera.js"), "utf8");
    const start = src.indexOf("export function div3Mul(");
    const bodyEnd = src.indexOf("\n}\n", start);
    const body = src.slice(start, bodyEnd);
    const divCalls = (body.match(/laneOp\("div"/g) || []).length;
    const mulCalls = (body.match(/laneOp\("mul"/g) || []).length;
    t("DIV³ construction: div3Mul's own body calls laneOp(\"div\", ...) exactly three times",
      divCalls === 3, `found ${divCalls}`);
    t("DIV³ construction: div3Mul's own body never calls laneOp(\"mul\", ...)",
      mulCalls === 0, `found ${mulCalls}`);
  }

  // ── T-DIV3-CORRECT: exhaustive over every unit pair in every B8 lane ──
  // Every B8 lane is prime, so every nonzero residue is a unit — this is
  // sum((p-1)^2) over B8 = 1+4+16+36+100+144+256+324 = 881 pairs, matching
  // the external reference's own 881/881 count exactly.
  {
    let bad = null, n = 0n;
    for (const p of B8) {
      for (let a = 1n; a < p; a++) {
        for (let b = 1n; b < p; b++) {
          const got = div3Mul(a, b, p);
          const want = mod(a * b, p);
          if (got !== want) { bad = { p, a, b, got, want }; break; }
          n++;
        }
        if (bad) break;
      }
      if (bad) break;
    }
    t("DIV³ correctness: mul(a,b) = DIV(1,DIV(DIV(1,a),b)) for every unit pair in every B8 lane",
      bad === null && n === 881n, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n}/881 checked`);
  }
  t("div3Mul returns null when the first operand is not a unit (a ≡ 0 mod p)",
    div3Mul(0n, 3n, 7n) === null);
  t("div3Mul returns null when the second operand is not a unit (b ≡ 0 mod p)",
    div3Mul(3n, 0n, 7n) === null);
  t("div3Schema applies div3Mul lanewise, matching plain multiplication where both operands are units in every B8 lane",
    (() => {
      const a = 101n, b = 103n; // coprime to every B8 lane
      const schema = div3Schema(a, b, B8);
      return B8.every((p, i) => schema[i] === mod(a * b, p));
    })());

  // ── T-PHI3: zero-noise triple certification, full-lane ─────────────
  {
    let bad = null, n = 0n;
    for (const d of COPRIME_DIVISORS) {
      for (let a = 0n; a < 15n; a++) {
        for (let b = 1n; b < 8n; b++) {
          const { q, discrepancies } = phi3Certify(a, b, d, B8);
          if (q !== a || discrepancies !== 0n) { bad = { d, a, b, q, discrepancies }; break; }
          n++;
        }
        if (bad) break;
      }
      if (bad) break;
    }
    t(`Φ³: discrepancy identically zero across every lane, ${n} (d,a,b) triples`,
      bad === null, bad ? JSON.stringify(bad, (_, v) => typeof v === "bigint" ? v.toString() : v) : `${n} checked`);
  }

  // ── laneOp: the 8 root operators, direct spot checks ────────────────
  t("laneOp: all 8 ROOT_OPS are recognized (no throw) on a representative lane",
    ROOT_OPS.every((op) => { try { laneOp(op, 3n, 5n, 7n); return true; } catch { return false; } }));
  t("laneOp('add')/('sub')/('mul')/('sqr') match plain modular arithmetic",
    laneOp("add", 5n, 4n, 7n) === mod(5n + 4n, 7n)
    && laneOp("sub", 5n, 4n, 7n) === mod(5n - 4n, 7n)
    && laneOp("mul", 5n, 4n, 7n) === mod(5n * 4n, 7n)
    && laneOp("sqr", 5n, 0n, 7n) === mod(25n, 7n));
  t("laneOp('id') returns a mod p; laneOp('neg') returns -a mod p",
    laneOp("id", 12n, 0n, 7n) === mod(12n, 7n) && laneOp("neg", 12n, 0n, 7n) === mod(-12n, 7n));
  t("laneOp('inv') matches cram.js's inverse() and returns null at a=0",
    laneOp("inv", 5n, 0n, 7n) === inverse(5n, 7n) && laneOp("inv", 0n, 0n, 7n) === null);
  t("laneOp throws on an unrecognized operator name",
    trap(() => laneOp("xor", 1n, 1n, 7n)).threw);

  // ── CHIMERA_ROLES: the Four-Division Chimera lane-role table ───────
  t("CHIMERA_ROLES has exactly the 8 B8 lanes as keys, each with a distinct label",
    B8.every((p) => CHIMERA_ROLES.has(p)) && CHIMERA_ROLES.size === 8
    && new Set(CHIMERA_ROLES.values()).size === 8);

  // ── default constants are genuinely coprime to M8, as their use requires ──
  t("DEFAULT_ANCHORS are all coprime to M8", DEFAULT_ANCHORS.every((A) => gcd(A, M8) === 1n));
  t("DEFAULT_ALT_BASIS's shell modulus is coprime to every SHARED_DIVISORS entry",
    (() => {
      const MAlt = DEFAULT_ALT_BASIS.reduce((a, p) => a * p, 1n);
      return SHARED_DIVISORS.every((d) => gcd(d, MAlt) === 1n);
    })());

  return R;
}
