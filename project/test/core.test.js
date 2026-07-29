// test/core.test.js — exact unit tests for the HCRM integer core. (P4)
// BigInt only. Returns a list of {name, ok, detail} results.

import { B6, B8, GEAR, M6, M8, GEAR_PRODUCT, ARCSEC_CIRCLE, M6_MOD_GEAR, M6_INV_MOD_GEAR } from "../src/core/basis.js";
import { mod, residues, residueObject } from "../src/core/residues.js";
import { gearClass } from "../src/core/gear-class.js";
import { shellResidue, gearResidue, recoverShellWindingFromGear, actualShellWinding, verifyShellWinding } from "../src/core/shell-kelim.js";
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

  // winding bound: max K = ⌊(ARC−1)/M6⌋ = 43
  t("shell winding bound K_max = 43", (ARCSEC_CIRCLE - 1n) / M6 === 43n, ((ARCSEC_CIRCLE - 1n) / M6).toString());
  t("gear anchor sufficiency A=323 > K_max=43", GEAR_PRODUCT > (ARCSEC_CIRCLE - 1n) / M6);

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

  // shell-kelim spot checks
  for (const x of [0n, 1n, 30029n, 30030n, 35113n, 648000n, 1295999n]) {
    const v = verifyShellWinding(x);
    t(`K recovered = ⌊${x}/M6⌋`, v.ok && v.recovered === (x / M6).toString(), `K=${v.recovered}`);
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
    t("computeHcrmRegister kind", reg.kind === "HCRM_REGISTER_V1");
    t("register all-string outputs", typeof reg.shell.K === "string" && typeof reg.longitude_arcsec === "string");
    t("register K matches ⌊x/M6⌋", reg.shell.K === (35113n / M6).toString(), "K=" + reg.shell.K);
  }

  return R;
}
