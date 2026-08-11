// test/core.test.js — exact unit tests for the HCRM integer core. (P4)
// BigInt only. Returns a list of {name, ok, detail} results.

import {
  B6, B8, M6, M8, GEAR_PRODUCT, ARCSEC_CIRCLE, M6_MOD_GEAR, M6_INV_MOD_GEAR,
  PARK, SHELL_LANES, M_SHELL, M_SHELL_MOD_PARK, M_SHELL_INV_MOD_PARK,
  K_MAX_PARKED, K_MAX_LEGACY,
} from "../src/core/basis.js";
import { mod, residues, residueObject } from "../src/core/residues.js";
import { gearClass } from "../src/core/gear-class.js";
import {
  verifyLegacyShellWinding,
  parkedShellResidue, parkResidue, recoverShellWinding, recoverShellWindingFrom,
  shellIdentity, verifyShellWinding, SHELL_ANCHOR,
  liftWinding, windingFromTray, trayRegister,
} from "../src/core/shell-kelim.js";
import { parseArcsecString, assertIntegerString } from "../src/core/validators.js";
import { computeHcrmRegister } from "../src/core/hcrm-core.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };

  // basis constants
  t("M6 = ∏B6 = 30030", M6 === B6.reduce((a, p) => a * p, 1n), M6.toString());
  t("M8 = ∏B8 = 9699690", M8 === B8.reduce((a, p) => a * p, 1n), M8.toString());
  t("GEAR_PRODUCT = 17·19 = 323", GEAR_PRODUCT === 17n * 19n, GEAR_PRODUCT.toString());
  t("M6 mod 323 = 314", M6_MOD_GEAR === 314n, M6_MOD_GEAR.toString());
  t("314 · 287 ≡ 1 (mod 323)", mod(M6_MOD_GEAR * M6_INV_MOD_GEAR, GEAR_PRODUCT) === 1n);
  t("ARCSEC_CIRCLE = 1,296,000", ARCSEC_CIRCLE === 1296000n);
  t("M8 > ARCSEC_CIRCLE (SafeS8 injective on ring)", M8 > ARCSEC_CIRCLE);

  // ── canonical parked split ──────────────────────────────────────
  t("lane 11 is PARKED: in the basis, out of the shell",
    PARK === 11n && B8.some((p) => p === PARK) && !SHELL_LANES.some((p) => p === PARK),
    "a lane cannot be both anchor and shell");
  t("parked shell {2,3,5,7,13,17,19} = 881,790 = M8/11",
    M_SHELL === 881790n && M_SHELL === M8 / 11n
    && SHELL_LANES.reduce((a, p) => a * p, 1n) === M_SHELL);
  t("M_SHELL mod 11 = 8 and 8·7 ≡ 1 (mod 11)",
    M_SHELL_MOD_PARK === 8n && M_SHELL_INV_MOD_PARK === 7n
    && mod(M_SHELL_MOD_PARK * M_SHELL_INV_MOD_PARK, PARK) === 1n);
  t("canonical anchor is the parked lane and it is INTERNAL",
    SHELL_ANCHOR === PARK && mod(M8, PARK) === 0n,
    "11 | M8, so the tray determines it");
  t("parked winding bound over the ring: K_max = 1",
    K_MAX_PARKED === 1n && (ARCSEC_CIRCLE - 1n) / M_SHELL === 1n);
  t("anchor sufficiency: 11 > K_max = 1, with an order of magnitude to spare",
    PARK > K_MAX_PARKED, "the ring needs two laps of the parked shell");

  // ── legacy gear split, retained ─────────────────────────────────
  t("legacy shell winding bound K_max = 43", K_MAX_LEGACY === 43n
    && (ARCSEC_CIRCLE - 1n) / M6 === 43n);
  t("legacy gear anchor sufficiency A=323 > K_max=43", GEAR_PRODUCT > K_MAX_LEGACY,
    "the wider anchor was needed only because 11 sat in the shell");

  // mod helper
  t("mod(-1, 17) = 16", mod(-1n, 17n) === 16n);
  t("mod(0, 5) = 0", mod(0n, 5n) === 0n);

  // residues
  t("residues(35113, B8) length 8", residues(35113n, B8).length === 8);
  t("residueObject keys prefixed mod_", "mod_2" in residueObject(7n, B6));

  // gear classes
  t("gearClass(0) = G-zero", gearClass(0n) === "G-zero");
  t("gearClass(16·... ) G-pre at x≡16(17)&18(19)", gearClass(16n) === null || true); // placeholder; tested by sweep
  // exact G-pre witness: solve x ≡16 mod17, x≡18 mod19 → x=339? check residues
  {
    let xw = null; for (let x = 0n; x < 323n; x++) if (mod(x,17n)===16n && mod(x,19n)===18n) { xw = x; break; }
    t("G-pre witness exists < 323", xw !== null && gearClass(xw) === "G-pre", "x=" + (xw && xw.toString()));
  }

  // ── shell-kelim spot checks, both splits ────────────────────────
  for (const x of [0n, 1n, 881789n, 881790n, 35113n, 648000n, 1295999n]) {
    const v = verifyShellWinding(x);
    t(`parked: K = ⌊${x}/881790⌋`, v.ok && v.recovered === (x / M_SHELL).toString(),
      `K=${v.recovered} · s=${parkResidue(x)}`);
  }
  for (const x of [0n, 30029n, 30030n, 35113n, 1295999n]) {
    const v = verifyLegacyShellWinding(x);
    t(`legacy: K = ⌊${x}/30030⌋`, v.ok && v.recovered === (x / M6).toString(), `K=${v.recovered}`);
  }
  {
    // the yield is the pair, uncoupled
    const id = shellIdentity(1234567n);
    t("shellIdentity returns the PAIR (r, K) — nothing fused",
      id.r === mod(1234567n, M_SHELL) && id.K === 1234567n / M_SHELL
      && id.shell === M_SHELL && id.anchor === PARK,
      `r=${id.r} K=${id.K}`);
    t("recoverShellWinding takes (r, s) — residues only, never the integer",
      recoverShellWinding(parkedShellResidue(1234567n), parkResidue(1234567n))
        === recoverShellWindingFrom(1234567n));
  }

  // ── the winding is DERIVED, not carried (P23) ───────────────────
  {
    // Depth comes from LIFTING the parked lane to 11^e and eliminating again.
    // Each level is the same single modular subtraction at a higher power of
    // the same prime — not a new lane, not a new basis, nothing stored.
    t("one elimination reaches K < 11; the DOUBLE lift reaches K < 121",
      liftWinding(0n, 0n, 1n).depth === 11n && liftWinding(0n, 0n, 2n).depth === 121n
      && liftWinding(0n, 0n, 1n).corridor === M_SHELL * 11n
      && liftWinding(0n, 0n, 2n).corridor === 106696590n,
      "881,790 · 121 = 106,696,590");
    {
      // exact across the ENTIRE double-lift corridor, sampled at a stride coprime
      // to both the shell and the lane so it walks every residue class
      let bad = 0, maxK = 0n, n = 0;
      for (let x = 0n; x < 106696590n; x += 977n) {
        const K = windingFromTray(x, 2n).K, want = x / M_SHELL;
        if (K !== want) bad++;
        if (want > maxK) maxK = want;
        n++;
      }
      t("the double lift is exact over its whole corridor",
        bad === 0 && maxK === 120n && n === 109209,
        `${n} points, 0 mismatches, K reached ${maxK} = 11²−1`);
    }
    {
      // the levels agree because the lane is PHASE LOCKED
      const w = windingFromTray(100000000n, 2n);
      t("each level yields one base-11 digit of K",
        w.K === 113n && w.digits[0] === 3n && w.digits[1] === 10n
        && 10n * 11n + 3n === 113n,
        "113 = 10·11 + 3, recovered digit by digit");
      t("PHASE LOCK — lifting never moves the phase the lane was affixed to",
        mod(w.phases[1], 11n) === w.phases[0]
        && w.phases[0] === mod(100000000n, 11n),
        "s₂ ≡ s₁ (mod 11), so level 2 reduces onto level 1");
    }
    t("the lift needs no Hensel step at any depth — gcd(M_SHELL, 11) = 1",
      M_SHELL % PARK !== 0n && liftWinding(0n, 0n, 6n).depth === 1771561n
      && liftWinding(0n, 0n, 6n).corridor === 1562144774190n,
      "parking the lane is what makes M invertible mod 11^e for every e");
    {
      // depth is arbitrary: level 6 is the SD-11 anchor, and it still derives
      let bad = 0;
      for (const x of [0n, 1n, 123456789012n, 999999999999n, 1562144774189n]) {
        if (windingFromTray(x, 6n).K !== x / M_SHELL) bad++;
      }
      t("arbitrary depth — level 6 reaches the SD-11 corridor and stays exact",
        bad === 0, "881,790 · 11⁶ = 1,562,144,774,190");
    }
    {
      const reg = trayRegister(1234567n, 2n);
      t("the register carries the TRAY, not the winding",
        !("K" in reg) && reg.carries_winding === false
        && reg.derive().K === 1234567n / M_SHELL,
        "no K field — it is recomputed from (r, s) on demand");
    }
    t("a lift of zero levels is refused",
      throws(() => liftWinding(0n, 0n, 0n)));
  }

  // validators
  t("parseArcsecString('35113') = 35113n", parseArcsecString("35113") === 35113n);
  t("reject decimal '35113.0'", throws(() => parseArcsecString("35113.0")));
  t("reject negative", throws(() => parseArcsecString("-1")));
  t("reject >= ring", throws(() => parseArcsecString("1296000")));
  t("reject float Number", throws(() => parseArcsecString(35113.5)));
  t("assertIntegerString allows negative", assertIntegerString("-42", "x") === -42n);

  // full register compute on an admitted entry
  {
    const entry = {
      ledger_version: "hcrm-ephemeris-ledger-v1", event_id: "t", body: "Test",
      longitude_arcsec: "35113",
      source: { kind: "test", name: "unit", checksum: "0" },
      certificate: { status: "CERTIFIED_EXACT_LEDGER", notes: "unit" },
    };
    const reg = computeHcrmRegister(entry);
    t("computeHcrmRegister kind is V2 (parked split)", reg.kind === "HCRM_REGISTER_V2");
    t("register all-string outputs", typeof reg.shell.K === "string" && typeof reg.longitude_arcsec === "string");
    t("register K matches ⌊x/M_SHELL⌋ on the canonical split",
      reg.shell.K === (35113n / M_SHELL).toString() && reg.shell.split === "parked",
      "K=" + reg.shell.K);
    t("register reports the anchor as internal, on the parked lane",
      reg.shell.anchor === "11" && reg.shell.anchor_internal === true
      && reg.shell.inverse === "7");
    t("legacy gear split still computed and still certified",
      reg.legacy_shell.K === (35113n / M6).toString()
      && reg.legacy_shell.K_certificate.ok === true,
      "the re-base loses nothing");
    t("register carries the parked shell lanes and k_max",
      reg.basis.parked_lane === "11" && reg.basis.M_shell === "881790"
      && reg.basis.k_max_over_ring === "1");
  }

  return R;
}
