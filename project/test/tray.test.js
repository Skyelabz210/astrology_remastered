// test/tray.test.js — the two-tray architecture. (P28)

import { mod } from "../src/core/residues.js";
import { certifyTransduction, isSafeBasis, shellModulus } from "../src/core/cram.js";
import { UNIT_LANE } from "../src/core/fixture.js";
import { B6, M6 } from "../src/core/basis.js";
import {
  PHASE_LANE, ORIGIN_LANE, saturationOf, firstTray, phaseLockBetween,
  preservesLock, inheritance, deriveTray, lanesConsistent, arrowOfTime,
} from "../src/core/tray.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── 1. the first tray is 100% saturated at 30,030 ────────────────
  {
    const s = saturationOf(B6);
    t("the Safe Basis product space is 100% SATURATED at 30,030",
      s.saturated && s.states === 30030n && s.span === M6 && s.slack === 0n,
      "∏ lane sizes = span exactly — no slack, no redundancy, no dead codepoints");
    t("saturation is a bijection claim, and it is checked not assumed",
      s.bijective && 2n * 3n * 5n * 7n * 11n * 13n === 30030n);
    t("a non-coprime bag is NOT saturated — the map is not a bijection",
      !saturationOf([4n, 6n, 10n]).saturated && saturationOf([4n, 6n, 10n]).slack !== 0n,
      "4·6·10 = 240 states over a span of 60: 180 slack");
  }
  {
    const f = firstTray(B6);
    t("the FIRST tray is the one that must be unbroken — and it is",
      f.admissible && f.unbroken && f.saturated && f.M === M6 && f.carries_phase,
      "and it carries the phase lane 11");
  }

  // ── 2. saturation + the 36/37 star lift = the arrow ──────────────
  {
    const a = arrowOfTime(B6);
    t("saturated first tray + the 36/37 star lift instantiate the ARROW OF TIME",
      a.instantiated && a.adjacent && a.star_number && a.saturated,
      "S₃ = 37 with shell 36 = S₄ − S₃, adjacent hence coprime, depth unbounded");
    t("the arrow needs BOTH — a broken tray does not instantiate it",
      !arrowOfTime([4n, 6n, 10n]).instantiated,
      "saturation is load-bearing, not decoration");
  }

  // ── 4. the phase lock: lane 11 and lane 1 ────────────────────────
  {
    const lock = phaseLockBetween(B6, [UNIT_LANE, 11n, 4n, 6n, 10n]);
    t("the lock rides on prime 11 for phase and the unit lane for origin",
      lock.locked && lock.phase_shared && lock.origin_shared
      && lock.strength === 11n && lock.origin_bits === 0n
      && PHASE_LANE === 11n && ORIGIN_LANE === 1n,
      "11 states of phase; the origin carries zero bits and fixes only the zero");
    t("without lane 11 there is an origin but no phase — not locked",
      !phaseLockBetween(B6, [UNIT_LANE, 4n, 6n]).locked
      && phaseLockBetween(B6, [UNIT_LANE, 4n, 6n]).origin_shared,
      "a common zero is not a lock");
    t("Φ holds the lock exactly when it fixes lane 11",
      preservesLock((x) => x + 11n * 3n, [1n, 47n, 2026n])
      && !preservesLock((x) => 2n * x + 1n, [1n, 47n, 2026n]));
  }

  // ── 5 & 6. inheritance unlocks arbitrary composites ──────────────
  {
    const second = [UNIT_LANE, 11n, 4n, 6n, 10n];    // deliberately NOT coprime
    const inh = inheritance(B6, second);
    t("the second tray is ADMISSIBLE while being neither prime nor coprime",
      inh.admissible && !inh.target_pairwise_coprime && !inh.target_all_prime,
      "4, 6, 10 share factors freely — and it does not matter");
    t("what it inherits is named: primality, coprimality, identity of a number",
      inh.inherits.join() === "primality,coprimality,identity of a number"
      && inh.certified_by.includes("phase lock"),
      "held by the first tray, reaching the second through lane 11");
    t("inheritance requires the LOCK — drop lane 11 and it is refused",
      !inheritance(B6, [UNIT_LANE, 4n, 6n, 10n]).admissible,
      "arbitrary composites are unlocked BY the lock, not instead of it");
    t("a broken FIRST tray cannot pass anything down",
      !inheritance([4n, 6n, 10n], [UNIT_LANE, 11n, 3n]).admissible,
      "the source is the only thing that has to be unbroken");
  }
  {
    // every lane of the derived tray is exact, coprime or not
    const second = [UNIT_LANE, 11n, 4n, 6n, 10n];
    let bad = 0;
    for (let x = 0n; x < 3000n; x++) {
      const d = deriveTray(x, second, B6);
      if (d === null) { bad++; continue; }
      if (!second.every((q, i) => d.residues[i] === mod(x, q))) bad++;
      if (d.inherited_identity.r !== mod(x, M6)) bad++;
      if (!lanesConsistent(x, second)) bad++;
    }
    t("EVERY lane of the composite tray reads exactly — x mod q for any q",
      bad === 0, "3,000 values × 5 lanes, zero mismatches");
    t("redundant lanes agree, because they read one value rather than estimate it",
      lanesConsistent(2026n, [4n, 6n, 10n]) && lanesConsistent(35113n, [4n, 6n, 10n]),
      "gcd(4,6) = 2 and both lanes agree mod 2 — inconsistency is impossible");
    const d = deriveTray(1234n, second, B6);
    t("the composite tray is NOT self-standing — it carries the inherited identity",
      d.self_standing === false && d.inherited_identity.w === 1234n / M6,
      "reconstruction lives in the first tray; the second is a view");
  }

  // ── the certificate, corrected ───────────────────────────────────
  {
    const c = certifyTransduction(B6, [4n, 6n, 10n]);
    t("CORRECTED — only the SOURCE must be unbroken; the target inherits",
      c.admissible && c.source_unbroken && !c.target_unbroken && c.target_inherits
      && c.kind === "TRANSDUCTION_CERTIFICATE_V2",
      "requiring both refused valid configurations");
    t("a broken SOURCE is still refused — that requirement is real",
      !certifyTransduction([4n, 6n, 10n], B6).admissible
      && !isSafeBasis([4n, 6n, 10n]),
      "the asymmetry is the whole architecture");
    t("coprimality buys reconstruction-from-the-tray-alone, nothing more",
      shellModulus([4n, 6n, 10n]) === 240n && !isSafeBasis([4n, 6n, 10n]),
      "the target never needs it, so it never has to have it");
  }

  return R;
}
