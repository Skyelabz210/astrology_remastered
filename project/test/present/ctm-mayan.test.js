// test/present/ctm-mayan.test.js — WP-22: Node port of tests.jsx's Maya
// calendar and CTM (Cylindrical Time Model) cycle suites (15, 16).
//
// mayaLongCount / tzolkin / haab / calendarRound / tcoPhase / tcoPeriod /
// phaseSyndrome are NOT in project/src/present/astro-core.js at all — they
// live in project/time.jsx (`grep -n "^function mayaLongCount\|^function
// tzolkin\|^function tcoPeriod" project/*.jsx` finds them only there).
// time.jsx is a plain browser classic script (Object.assign(window, {...})
// at the bottom), loaded via node:vm exactly like astro-chart.test.js loads
// astro.jsx. It has one load-time wrinkle: its very last statements before
// the Object.assign are `isRetrograde; // silence linter: relies on
// astro.jsx globals` — a bare top-level reference that throws a
// ReferenceError unless `isRetrograde` (and by extension the rest of
// astro.jsx's globals time.jsx's other functions close over —
// planetLongitude, PLANET_GLYPH, ZODIAC, mod360, nearestAspect,
// applyingPhase) already exist in scope. "Test Harness.html" (tests.jsx's
// real host page) loads astro.jsx before time.jsx for exactly this reason;
// this port reproduces that exact script order (astro-core.js → vendored
// astronomy-engine → astro.jsx → time.jsx), the same load-order discipline
// test/astro-ephemeris.test.js and test/present/astro-chart.test.js already
// follow.
//
// None of the suites actually ported here (Maya/TCO) touch
// isRetrograde/planetLongitude/etc. at all — only the load-time reference
// needs them defined, not called.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
// Every HTML page that loads astro.jsx also loads tools/ephemeris/houses.js as
// a module tag BEFORE it, so window.Houses is populated by the time
// computeNatal() runs and the REAL ascMc() solver is the live ASC/MC path.
// The sandbox mirrors that load order; without it these suites would silently
// exercise the ~109deg-wrong fallback the browser never uses.
const housesModule = await import("../../tools/ephemeris/houses.js");
const timeSrc = readFileSync(join(ROOT, "time.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const astroCoreModule = await import("../../src/present/astro-core.js");

function makeSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.Houses = housesModule;
  sandbox.AstroCore = astroCoreModule;
  vm.createContext(sandbox);
  vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  vm.runInContext(astroSrc, sandbox, { filename: "astro.jsx" });
  vm.runInContext(timeSrc, sandbox, { filename: "time.jsx" });
  return sandbox;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const ctm = makeSandbox();
  const { mayaLongCount, tzolkin, haab, calendarRound, tcoPeriod, tcoPhase, phaseSyndrome } = ctm;

  // ── Suite 15: CTM · Maya calendar ─────────────────────────────────────
  t("Maya epoch JD = 584,283 → kin 0", mayaLongCount(584283).kin === 0);
  {
    const tz = tzolkin(584283);
    t("Maya epoch → 4 Ahau (Tzolk'in)", `${tz.number} ${tz.sign}` === "4 Ahau");
  }
  {
    const h = haab(584283);
    t("Maya epoch → 8 Kumku (Haab)", `${h.day} ${h.month}` === "8 Kumku");
  }
  {
    const tz = tzolkin(584284);
    t("kin 1 day after epoch = 5 Imix", `${tz.number} ${tz.sign}` === "5 Imix");
  }
  {
    const set = new Set();
    for (let i = 0; i < 13; i++) set.add(tzolkin(584283 + i).number);
    t("Tzolk'in number cycles 1..13", set.size === 13);
  }
  {
    const set = new Set();
    for (let i = 0; i < 20; i++) set.add(tzolkin(584283 + i).sign);
    t("Tzolk'in day-sign cycles 0..19 (20 signs)", set.size === 20);
  }
  {
    const a = tzolkin(584283);
    const b = tzolkin(584283 + 260);
    t("Tzolk'in repeats after 260 days", `${a.number}-${a.sign}` === `${b.number}-${b.sign}`);
  }
  {
    const a = haab(584283);
    const b = haab(584283 + 365);
    t("Haab repeats after 365 days", `${a.day}-${a.month}` === `${b.day}-${b.month}`);
  }
  {
    const a = calendarRound(584283);
    const b = calendarRound(584283 + 18980);
    t("Calendar Round period = 18,980", a === b);
  }
  {
    // 13 baktuns × 144,000 days = 1,872,000 days
    const lc = mayaLongCount(584283 + 1872000);
    t("13.0.0.0.0 (end of 13th baktun) → Dec 21, 2012 ± small",
      `${lc.baktun}.${lc.katun}.${lc.tun}.${lc.winal}.${lc.kinDay}` === "13.0.0.0.0",
      lc.formatted);
  }

  // ── Suite 16: CTM · cycles & TCO ───────────────────────────────────────
  t("TCO orbit period = M / gcd(M, Δ)", tcoPeriod(30030, 1) === 30030);
  t("TCO with Δ=2 in M=30030 → period 15015", tcoPeriod(30030, 2) === 15015);
  t("TCO with Δ=7 in M=30030 → period 4290", tcoPeriod(30030, 7) === 4290);
  {
    const T = tcoPhase(584283 + 12345);
    t("TCO phase θ in [0, 2π)", T.theta >= 0 && T.theta <= 2 * Math.PI, `got ${T.theta}`);
  }
  {
    const a = tcoPhase(584283).theta;
    const b = tcoPhase(584283 + 30030).theta;
    t("TCO phase wraps cleanly", Math.abs(a - b) < 1e-9);
  }
  t("Phase syndrome S = θᵢ − θⱼ in [0, 2π)",
    (() => { const s = phaseSyndrome(1.2, 0.4); return s >= 0 && s <= 2 * Math.PI; })());
  {
    const a = phaseSyndrome(1.2, 0.4);
    const b = phaseSyndrome(1.2 + 0.7, 0.4 + 0.7);
    t("Phase syndrome is gauge-invariant", Math.abs(a - b) < 1e-9);
  }

  return R;
}
