// src/core/hcrm-core.js — exact HCRM register computation. (P3)
// Deterministic, BigInt-only, all outputs as strings. Imports no UI, no demo,
// no astrology prose. Input is a ledger entry with integer-string arcseconds.

import { B6, B8, GEAR, M6, M8, GEAR_PRODUCT, ARCSEC_CIRCLE } from "./basis.js";
import { residueObject } from "./residues.js";
import { parseArcsecString } from "./validators.js";
import {
  shellResidue, recoverShellWindingFromGear, verifyShellWinding,
} from "./shell-kelim.js";
import { gearClass } from "./gear-class.js";

export function computeHcrmRegister(entry) {
  const x = parseArcsecString(entry.longitude_arcsec);
  const shellCheck = verifyShellWinding(x);
  if (!shellCheck.ok) throw new Error("HCRM shell winding recovery failed");

  return {
    kind: "HCRM_REGISTER_V1",
    body: entry.body,
    longitude_arcsec: x.toString(),
    basis: {
      B6: B6.map(String), B8: B8.map(String), gear: GEAR.map(String),
      M6: M6.toString(), M8: M8.toString(),
      gear_product: GEAR_PRODUCT.toString(), arcsec_circle: ARCSEC_CIRCLE.toString(),
    },
    residues_B8: residueObject(x, B8),
    residues_B6: residueObject(x, B6),
    residues_gear: residueObject(x, GEAR),
    shell: {
      r_M6: shellResidue(x).toString(),
      K: recoverShellWindingFromGear(x).toString(),
      K_certificate: shellCheck,
    },
    gear_class: gearClass(x),
    source: entry.source,
    certificate: entry.certificate,
  };
}
