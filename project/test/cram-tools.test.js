// test/cram-tools.test.js — WP-23: pins for the browser CRAM tool scripts.
//
// Targets are all plain browser-global classic scripts (no export syntax):
//   cram-int.js   IIFE over `window` → CramInt + cram* helpers
//   cram-calc.js  CRAM Calculator engine: top-level functions + DOM wiring
//   cram-api.js   IIFE over `window` → the CRAM namespace
//
// Loading mechanism (least invasive, per the WP-23 brief's vm option): the
// files are evaluated UNMODIFIED via node:vm against a minimal window/document
// stub, in the exact <script> order the pages use (CRAM Calculator.html loads
// cram-int.js then cram-calc.js; API Reference.html loads cram-int.js then
// cram-api.js). The browser files stay classic scripts — no export shims, no
// behavior change for any page.
//
// Header-advertised regressions pinned here (cram-calc.js lines 3-8):
//   • modInv returns STRICT null for non-invertible input — never 0 — so the
//     old Number(null) → 0 coercion bug cannot recur. Pinned at every layer
//     (calc modInv, int cramModInv, api crt.inv, api solo fallback _inv).
//   • star-number inversion uses an EXACT integer sqrt: k = 10⁹ makes the
//     discriminant 12+24N ≈ 1.44·10²⁰ > 2⁵³, where any float sqrt drifts; and
//     the Newton seed must sit at the radicand d, not at N (N < √d for the
//     small star numbers 1, 13, 37, 73 — the S3/S4 star primes themselves).
//
// Node-only scope: CRAM.hcrm / CRAM.astro require hcrm.jsx / astro.jsx browser
// globals, so only their unavailability contract is pinned here (available()
// false, entry points throw "not loaded", documented fallbacks). The DOM/render
// functions of cram-calc.js are exercised only as load-time wiring smoke tests
// plus the invalid-integer catch path; everything numeric is tested for real.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (f) => readFileSync(join(HERE, "..", f), "utf8");

// ── minimal browser stubs — just enough for load-time top-level statements ──
function stubElement() {
  const el = {
    value: "", innerHTML: "", className: "", style: {},
    children: [], firstChild: null, lastChild: null,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, focus() {},
    insertBefore() {}, removeChild() {}, appendChild() {},
  };
  el.closest = () => el;
  return el;
}
function stubDocument() {
  const els = new Map();
  return {
    getElementById(id) { if (!els.has(id)) els.set(id, stubElement()); return els.get(id); },
    querySelectorAll() { return []; },
    createElement() { return stubElement(); },
  };
}
function browserContext({ dom }) {
  const sandbox = {};
  sandbox.window = sandbox;             // the IIFEs attach globals to `window`
  sandbox.addEventListener = () => {};  // window.addEventListener("load", …)
  if (dom) sandbox.document = stubDocument();
  vm.createContext(sandbox);
  return sandbox;
}
const load = (ctx, file) => vm.runInContext(source(file), ctx, { filename: file });

// Page-faithful contexts (same script order as the HTML pages).
const calc = browserContext({ dom: true });   // CRAM Calculator.html
load(calc, "cram-int.js");
load(calc, "cram-calc.js");

const api = browserContext({ dom: false });   // API Reference.html
load(api, "cram-int.js");
load(api, "cram-api.js");

const solo = browserContext({ dom: false });  // documented fallback: api alone
load(solo, "cram-api.js");

const B8 = [2, 3, 5, 7, 11, 13, 17, 19];
const M8 = 9699690n;
const K9 = 10n ** 9n;
const NSTAR9 = 6n * K9 * (K9 - 1n) + 1n;      // f⋆(10⁹); disc ≈ 1.44e20 > 2⁵³

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const throws = (fn, re) => {
    try { fn(); return false; } catch (e) { return re ? re.test(String(e && e.message)) : true; }
  };

  // ════════════════════════════════════════════════════════════════
  //  cram-calc.js — pure engine functions
  // ════════════════════════════════════════════════════════════════
  t("calc: mod is canonical incl. negatives",
    calc.mod(7, 5) === 2n && calc.mod(-3, 5) === 2n && calc.mod(0, 7) === 0n,
    "mod(7,5)=2 · mod(−3,5)=2 · mod(0,7)=0");
  t("calc: modInv finds inverses",
    calc.modInv(3, 7) === 5n && calc.modInv(10, 7) === 5n && calc.modInv(1, 2) === 1n,
    "3⁻¹≡5 (mod 7), 10⁻¹≡5 (mod 7)");
  t("calc: modInv non-invertible → strict null, never 0 (Number(null)=0 bug pinned)",
    calc.modInv(2, 4) === null && calc.modInv(6, 9) === null && calc.modInv(0, 5) === null
      && calc.modInv(2, 4) !== 0n,
    "header-advertised regression: null is checked BEFORE any Number() coercion");
  t("calc: gcd",
    calc.gcd(0n, 5n) === 5n && calc.gcd(-4n, 6n) === 2n && calc.gcd(35n, 64n) === 1n,
    "gcd(0,5)=5 · gcd(−4,6)=2 · gcd(35,64)=1");
  t("calc: coprime is pairwise",
    calc.coprime([2, 3, 5, 7]) === true && calc.coprime([6, 35, 143]) === true
      && calc.coprime([4, 6]) === false,
    "6·35·143 pairwise coprime though each is composite; 4,6 share 2");

  {
    const b6 = [2, 3, 5, 7, 11, 13], M6 = 30030n;
    const res = (v) => b6.map((p) => calc.mod(v, p));
    t("calc: CRT round-trip", calc.crt(res(12345n), b6) === 12345n, "12345 → residues → 12345");
    t("calc: CRT of 0", calc.crt(res(0n), b6) === 0n, "all-zero tray → 0");
    t("calc: CRT ring−1", calc.crt(res(M6 - 1n), b6) === M6 - 1n, "M6−1 = 30029 survives");
    t("calc: CRT wrap-around is canonical",
      calc.crt(res(M6 + 41n), b6) === 41n && calc.crt(res(M6 + 41n), b6) === calc.mod(M6 + 41n, M6),
      "M6+41 folds to canonical 41 — winding lives outside the tray");
    t("calc: CRT skips non-invertible lanes instead of throwing",
      calc.crt([1, 1], [4, 6]) === 0n,
      "non-coprime moduli: null inverses skipped (the guarded null path)");
  }

  {
    const x = 10n ** 21n;
    t("calc: isqrt exact at perfect squares",
      calc.isqrt(0n) === 0n && calc.isqrt(1n) === 1n && calc.isqrt(4n) === 2n
        && calc.isqrt(x * x) === x,
      "including (10²¹)² — far beyond float precision");
    t("calc: isqrt floors between squares",
      calc.isqrt(2n) === 1n && calc.isqrt(3n) === 1n
        && calc.isqrt(x * x - 1n) === x - 1n && calc.isqrt(x * x + 1n) === x,
      "x²−1 → x−1 · x²+1 → x");
    t("calc: isqrt of negative → −1 sentinel", calc.isqrt(-9n) === -1n, "");
  }

  t("calc: starNum/starIndex round-trip, small k",
    [1, 2, 3, 4, 5, 100].every((k) => calc.starIndex(calc.starNum(k)) === k),
    "f⋆(k)=6k(k−1)+1 inverts for k=1,2,3,4,5,100 (incl. S3=37, S4=73)");
  t("calc: starIndex exact-integer sqrt pinned at k=10⁹",
    calc.starIndex(NSTAR9) === 1000000000,
    "disc = 12+24N ≈ 1.44e20 > 2⁵³ — float sqrt would drift, integer Newton must not");
  t("calc: starIndex rejects near-misses of the big star",
    calc.starIndex(NSTAR9 + 6n) === null && calc.starIndex(NSTAR9 - 6n) === null,
    "±6 keeps N ≡ 1 (mod 6) but the discriminant is no longer a perfect square");
  t("calc: starIndex invalid input → null",
    calc.starIndex(0) === null && calc.starIndex(-7) === null
      && calc.starIndex(2) === null && calc.starIndex(25) === null,
    "0, negatives, and non-star integers all refuse");

  t("calc: factorize",
    calc.factorize(360n).join(",") === "2,2,2,3,3,5" && calc.factorize(97n).join(",") === "97"
      && calc.factorize(1n).join(",") === "1" && calc.factorize(0n).join(",") === "0"
      && calc.factorize(-30n).join(",") === "2,3,5",
    "prime multiset; 0/1 degenerate; sign dropped on negatives");
  t("calc: propSig categories",
    calc.propSig(255) === "+byte(8b)" && calc.propSig(256) === "+word(9b)"
      && calc.propSig(0) === "0byte(0b)" && calc.propSig(-1) === "−byte(1b)",
    "sign+category(bits)");
  t("calc: shadowHash deterministic exact value",
    calc.shadowHash(123n, [36, 37]) === "0x000001DD"
      && calc.shadowHash(123n, [36, 37]) === calc.shadowHash(123n, [36, 37]),
    "h = fold(31·h + N mod m) & 0xFFFFFFFF over [36,37] → 0x000001DD");
  t("calc: gearClass table",
    calc.gearClass(0, 0) === "G-zero" && calc.gearClass(16, 18) === "G-pre"
      && calc.gearClass(1, 1) === "G-low" && calc.gearClass(1, 0) === "G-low"
      && calc.gearClass(5, 7) === null,
    "(0,0)→G-zero · (16,18)→G-pre · (≤1,≤1)→G-low · else null");

  t("calc: page wiring loaded under DOM stubs",
    typeof calc.fullDecompose === "function" && typeof calc.runEngine === "function"
      && typeof calc.loadPreset === "function" && typeof calc.CramInt === "function",
    "top-level setOp/setEOp/listeners executed without a real DOM; CramInt present as on the page");
  {
    calc.document.getElementById("inpN").value = "12x";
    let didNotThrow = true;
    try { calc.fullDecompose(); } catch { didNotThrow = false; }
    calc.document.getElementById("inpN").value = "";
    t("calc: invalid integer input is caught, not thrown", didNotThrow,
      "fullDecompose('12x') → BigInt SyntaxError swallowed into the ERR log path");
  }

  // ════════════════════════════════════════════════════════════════
  //  cram-int.js — CramInt + free helpers
  // ════════════════════════════════════════════════════════════════
  const CI = api.CramInt;

  {
    const v = 123456789n, x = CI.fromInt(v, B8);
    t("int: fromInt round-trip",
      x.reconstruct() === v && x.K === 12n && x.canonical() === v - 12n * M8
        && x.basis.every((p, i) => BigInt(x.res[i]) === v % BigInt(p))
        && x.describe().value === "123456789",
      "123456789 = γ̃ + K·M₈ with K=12, residues match v mod pᵢ");
  }
  {
    const z = CI.fromInt(0n, B8);
    t("int: zero", z.reconstruct() === 0n && z.K === 0n && z.canonical() === 0n
        && z.res.every((r) => r === 0), "all lanes 0, winding 0");
  }
  {
    const r1 = CI.fromInt(M8 - 1n, B8);
    t("int: ring−1", r1.reconstruct() === M8 - 1n && r1.K === 0n && r1.canonical() === M8 - 1n,
      "M₈−1 = 9699689 sits at the top of block 0");
  }
  {
    const w = CI.fromInt(M8 + 41n, B8);
    t("int: wrap-around lands in winding, not tray",
      w.canonical() === 41n && w.K === 1n && w.reconstruct() === M8 + 41n
        && CI.fromInt(M8, B8).K === 1n && CI.fromInt(M8, B8).canonical() === 0n,
      "M₈+41 → (γ̃=41, K=1); M₈ itself → (0, 1)");
  }
  {
    const n = CI.fromInt(-1n, B8);
    t("int: negatives via negative winding",
      n.canonical() === M8 - 1n && n.K === -1n && n.reconstruct() === -1n,
      "−1 = (M₈−1) − 1·M₈ — canonical stays in [0, M₈)");
  }
  {
    const s = CI.fromInt(M8 - 1n, B8).add(CI.fromInt(2n, B8));
    t("int: add across the block boundary",
      s.reconstruct() === M8 + 1n && s.K === 1n && s.canonical() === 1n && s.basis.length === 8,
      "(M₈−1)+2 carries δ=1 into K; no DynCRT at |K|=1");
  }
  {
    const d = CI.fromInt(5n, B8).sub(CI.fromInt(7n, B8));
    t("int: sub borrows into the winding",
      d.reconstruct() === -2n && d.K === -1n && d.canonical() === M8 - 2n,
      "5−7 = −2 via borrow");
  }
  {
    const p = CI.fromInt(12345n, B8).mul(CI.fromInt(67890n, B8));
    t("int: mul exact + DynCRT auto-extend",
      p.reconstruct() === 838102050n && p.basis.length > 8
        && p.dyncrtEvents.length >= 1 && p.dyncrtEvents[0].added === 23,
      "12345·67890 = 838102050; K=86 crosses the Winding-Vanish-Horizon → lane 23 spliced");
  }
  {
    const a = CI.fromInt(100n, [2, 3, 5, 7, 11, 13]).add(CI.fromInt(50n, B8));
    const u = CI.fromInt(1000n, [7, 11]).add(CI.fromInt(500n, [13, 19]));
    t("int: mixed-basis operands auto-align",
      a.reconstruct() === 150n && a.basis.length === 8
        && u.reconstruct() === 1500n && u.basis.join(",") === "7,11,13,19",
      "prefix basis lifts to the wider one; disjoint bases take the union");
  }
  t("int: cmp/equals are residue+winding native",
    CI.fromInt(5n, B8).cmp(CI.fromInt(7n, B8)) === -1
      && CI.fromInt(M8 + 1n, B8).cmp(CI.fromInt(1n, B8)) === 1
      && CI.fromInt(42n, B8).cmp(CI.fromInt(42n, B8)) === 0
      && CI.fromInt(42n, B8).equals(CI.fromInt(42n, B8)) === true,
    "winding compares first, then canonical");
  {
    const x = CI.fromInt(12345678n, B8);
    const cert = x.kElimCertificate(23);
    t("int: K-Elim certificate verifies with coprime anchor",
      cert !== null && cert.ok === true && cert.Khat === cert.Ktrue && cert.A === 23,
      "K recovered mod 23 matches true K=1");
    t("int: K-Elim certificate refuses anchor dividing M₈",
      x.kElimCertificate(7) === null && x.kElimCertificate(19) === null,
      "in-basis anchors are not admissible");
  }
  t("int: kElim free function recovers the winding",
    api.cramKElim(5, 4, 30, 7) === 3,
    "x=95, M=30: γ̃=5, K=3; from (γ̃ mod 7, x mod 7)=(5,4) → 3");
  t("int: kElim null when anchor shares a factor with M",
    api.cramKElim(1, 2, 30, 5) === null, "M⁻¹ mod 5 does not exist → strict null");
  t("int: cramModInv strict-null pin (Number-lane layer)",
    api.cramModInv(3, 7) === 5 && api.cramModInv(10, 7) === 5 && api.cramModInv(2, 4) === null,
    "same null-before-coercion contract as calc modInv");
  t("int: cramCoprime / cramNextPrime",
    api.cramCoprime(4, 9) === true && api.cramCoprime(6, 9) === false
      && api.cramNextPrime([2, 3, 5]) === 7 && api.cramNextPrime([36, 37]) === 41,
    "next prime coprime to [36,37] skips 38,39,40 → 41");
  t("int: cramStarIndex small star numbers (Newton seed regression)",
    api.cramStarIndex(1n) === 1 && api.cramStarIndex(13n) === 2
      && api.cramStarIndex(37n) === 3 && api.cramStarIndex(73n) === 4
      && api.cramStarIndex(121n) === 5,
    "1, 13, 37 (S3), 73 (S4) need the isqrt seeded at the discriminant, not at N");
  t("int: cramStarIndex exact at k=10⁹, null off-star",
    api.cramStarIndex(NSTAR9) === 1000000000 && api.cramStarIndex(NSTAR9 + 6n) === null
      && api.cramStarIndex(0) === null && api.cramStarIndex(2) === null,
    "same >2⁵³ discriminant pin as the calc layer");
  {
    const q = CI.fromInt(23000n, B8).divExactKElim(23n, 29);
    t("int: divExactKElim exact case", q !== null && q.reconstruct() === 1000n,
      "23000 / 23 = 1000 via lane inverses + anchored winding");
    t("int: divExactKElim inexact → null",
      CI.fromInt(1001n, B8).divExactKElim(23n, 29) === null, "1001 = 7·11·13 is not divisible by 23");
    t("int: divExactKElim in-basis divisor → null",
      CI.fromInt(23000n, B8).divExactKElim(7n, 29) === null, "7 shares a lane → needs the FPD route");
  }
  {
    const e = CI.fromInt(100n, [2, 3, 5]).extendBasis(7);
    t("int: extendBasis preserves value",
      e.reconstruct() === 100n && e.basis.join(",") === "2,3,5,7"
        && e.dyncrtEvents.some((ev) => ev.added === 7 && ev.manual === true),
      "manual DynCRT records the splice");
    t("int: extendBasis rejects non-coprime lane",
      throws(() => CI.fromInt(100n, [2, 3, 5]).extendBasis(6), /not coprime/), "6 shares 2 and 3");
  }
  t("int: fromInt rejects non-integer input",
    throws(() => CI.fromInt("not-an-int", B8)) && throws(() => CI.fromInt(5.5, B8)),
    "BigInt coercion throws on garbage strings and fractional numbers");

  // ════════════════════════════════════════════════════════════════
  //  cram-api.js — window.CRAM over cram-int.js (API Reference.html)
  // ════════════════════════════════════════════════════════════════
  const CRAM = api.CRAM;

  t("api: namespace + version", !!CRAM && CRAM.version === "1.0.0", "");
  {
    const cap = CRAM.capabilities();
    t("api: capabilities probe (number wired; hcrm/astro absent in Node)",
      cap.number === true && cap.crt === true && cap.basis === true
        && cap.hcrm === false && cap.astro === false,
      "hcrm.jsx / astro.jsx are browser-only — their absence is the pinned contract here");
  }
  t("api: number.of over the default SafeS8 basis",
    CRAM.number.of(42).describe().value === "42" && CRAM.number.of(42).basis.length === 8, "");
  t("api: number arithmetic coerces int|string|CramInt",
    CRAM.number.toString(CRAM.number.add("9699689", 2)) === "9699691"
      && CRAM.number.toString(CRAM.number.mul(12345, "67890")) === "838102050"
      && CRAM.number.toString(CRAM.number.sub(5, 7)) === "-2",
    "add crosses the block boundary; mul rides a DynCRT extend");
  t("api: number.cmp / eq",
    CRAM.number.cmp(5, 7) === -1 && CRAM.number.eq(7, "7") === true, "");
  t("api: number.divExact exact / inexact / null-guard",
    CRAM.number.toString(CRAM.number.divExact(23000, 23)) === "1000"
      && CRAM.number.divExact(1001, 23) === null
      && CRAM.number.toString(null) === "null",
    "null propagates printably instead of coercing");
  t("api: coercing null input throws a diagnostic",
    throws(() => CRAM.number.add(null, 1), /null value/),
    "the _coerce guard names the divExact-null hazard");
  t("api: number.extend widens, rejects non-coprime",
    CRAM.number.extend(42, 23).basis.length === 9
      && throws(() => CRAM.number.extend(42, 21), /not coprime/),
    "21 = 3·7 shares lanes with SafeS8");

  t("api: crt.inv strict-null pin", CRAM.crt.inv(3, 7) === 5 && CRAM.crt.inv(2, 4) === null, "");
  {
    const v = 12345n;
    t("api: crt residues→reconstruct round-trip",
      CRAM.crt.reconstruct(CRAM.crt.residues(v)) === "12345"
        && CRAM.crt.reconstruct([1, 2, 0], [2, 3, 5]) === "5",
      "default basis round-trip; known small case x≡1(2),2(3),0(5) → 5");
    t("api: crt round-trip 0 and ring−1",
      CRAM.crt.reconstruct(CRAM.crt.residues(0n)) === "0"
        && CRAM.crt.reconstruct(CRAM.crt.residues(M8 - 1n)) === "9699689"
        && CRAM.crt.winding(M8 - 1n) === "0",
      "");
    t("api: crt wrap-around: canonical + winding split",
      CRAM.crt.reconstruct(CRAM.crt.residues(M8 + 41n)) === "41"
        && CRAM.crt.winding(M8 + 41n) === "1",
      "the tray only ever sees the canonical; K carries the block index");
  }
  t("api: crt.kElim recovers K, nulls on bad anchor",
    CRAM.crt.kElim(5, 4, 30, 7) === 3 && CRAM.crt.kElim(1, 2, 30, 5) === null,
    "same x=95 fixture as the int layer");
  t("api: crt.star / starIndex round-trip incl. k=10⁹ and S3/S4",
    CRAM.crt.star(3) === "37" && CRAM.crt.starIndex(13) === 2
      && CRAM.crt.starIndex(37) === 3 && CRAM.crt.starIndex(73) === 4
      && CRAM.crt.starIndex(CRAM.crt.star("1000000000")) === 1000000000
      && CRAM.crt.starIndex(2) === null && CRAM.crt.starIndex(0) === null,
    "routes through cramStarIndex — the exact-isqrt pin at the API surface");

  t("api: basis presets return defensive copies",
    CRAM.basis.get("safe6").join(",") === "2,3,5,7,11,13"
      && CRAM.basis.get("no-such-preset").join(",") === "2,3,5,7,11,13,17,19"
      && (() => { const g = CRAM.basis.get("safe6"); g.push(99); return CRAM.basis.get("safe6").length === 6; })(),
    "unknown preset falls back to config.defaultBasis; mutation does not leak");
  t("api: basis.coprime / product / nextCoprime",
    CRAM.basis.coprime([4, 9, 25]) === true && CRAM.basis.coprime([6, 9]) === false
      && CRAM.basis.product([36, 37]) === "1332" && CRAM.basis.nextCoprime([2, 3, 5]) === 7,
    "");
  {
    const bits = CRAM.basis.capacityBits(B8);
    t("api: basis.capacityBits ≈ log₂ M₈", bits > 23 && bits < 24, "log₂(9699690) ≈ 23.21");
  }

  t("api: hcrm/astro unavailability contract (Node scope)",
    CRAM.hcrm.available() === false && CRAM.astro.available() === false
      && throws(() => CRAM.hcrm.fromChart({}), /hcrm\.jsx not loaded/)
      && throws(() => CRAM.astro.compute({}), /astro\.jsx not loaded/),
    "browser-only namespaces fail loudly, not silently");
  t("api: hcrm/astro graceful fallbacks without the jsx globals",
    CRAM.hcrm.gearClass(0, 0) === null && CRAM.astro.zodiac().length === 0
      && CRAM.hcrm.basis().join(",") === B8.join(","),
    "gearClass→null, zodiac→[], hcrm basis→config default");

  {
    const saved = CRAM.config.defaultBasis;
    try {
      CRAM.config.defaultBasis = [2, 3, 5, 7, 11, 13];
      t("api: config.defaultBasis is live for number.of",
        CRAM.number.of(100).basis.length === 6, "override to safe6 takes effect immediately");
    } finally {
      CRAM.config.defaultBasis = saved;
    }
    t("api: config restore", CRAM.number.of(100).basis.length === 8, "");
  }

  // ════════════════════════════════════════════════════════════════
  //  cram-api.js loaded ALONE — documented local-fallback path
  // ════════════════════════════════════════════════════════════════
  const S = solo.CRAM;
  t("solo: capabilities report the missing number core",
    S.capabilities().number === false && S.capabilities().crt === true
      && throws(() => S.number.of(1), /cram-int\.js not loaded/),
    "number.of fails loudly; crt/basis still serve via local fallbacks");
  t("solo: fallback _inv strict-null pin", S.crt.inv(3, 7) === 5 && S.crt.inv(2, 4) === null, "");
  t("solo: fallback _starIndex exact isqrt",
    S.crt.starIndex(1) === 1 && S.crt.starIndex(13) === 2 && S.crt.starIndex(73) === 4
      && S.crt.starIndex(NSTAR9.toString()) === 1000000000 && S.crt.starIndex(2) === null,
    "the fallback seeds Newton at the radicand — must agree with cramStarIndex");
  t("solo: fallback basis helpers",
    S.basis.nextCoprime([2, 3, 5]) === 7 && S.basis.coprime([6, 35, 143]) === true
      && S.basis.coprime([6, 9]) === false,
    "_nextCoprime / _coprimeAll cover for the absent cram-int globals");
  t("solo: crt round-trip without CramInt",
    S.crt.reconstruct(S.crt.residues(424242n)) === "424242" && S.crt.winding(M8 + 5n) === "1",
    "the reconstruct path is pure fallback arithmetic");

  return R;
}
