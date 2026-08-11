// core-shim.js — browser bridge from the ESM core to the text/babel pages. (WP-14)
//
// The .jsx pages are loaded via Babel-standalone (`<script type="text/babel">`),
// which evaluates them as plain scripts — they cannot `import` the BigInt core
// directly. This module imports the core + ledger surface and publishes it as
// `window.HCRM_CORE` so the jsx layer converts at the boundary
// (e.g. `BigInt(arcsecString)`) and routes all exact arithmetic through the core.
//
// Serving requirement: pages must be served over HTTP, e.g.
//     npx serve project
// ES-module imports are blocked on file:// URLs, so opening the HTML files
// directly from disk leaves `window.HCRM_CORE` undefined.
//
// Load order is safe: module scripts execute before DOMContentLoaded, and
// Babel-standalone only transforms/runs the text/babel tags on DOMContentLoaded.
//
// Under Node (no `window`), importing this module is a harmless no-op.

import * as validators from "./src/core/validators.js";
import * as ring from "./src/core/ring.js";
import * as residues from "./src/core/residues.js";
import * as shellKelim from "./src/core/shell-kelim.js";
import * as ledger from "./src/ledger/import-ledger.js";

if (typeof window !== "undefined") {
  window.HCRM_CORE = {
    // src/core/validators.js
    ARCSEC_CIRCLE: validators.ARCSEC_CIRCLE,
    parseArcsecString: validators.parseArcsecString,
    assertIntegerString: validators.assertIntegerString,

    // src/core/ring.js
    RING: ring.RING,
    RING_PRIMES: ring.RING_PRIMES,
    RING_EXPONENTS: ring.RING_EXPONENTS,
    RING_RADICAL: ring.RING_RADICAL,
    OFF_RING_PRIMES: ring.OFF_RING_PRIMES,
    ipow: ring.ipow,
    ringFromFactors: ring.ringFromFactors,
    factorise: ring.factorise,
    isRingSmooth: ring.isRingSmooth,
    closes: ring.closes,
    stepArcsec: ring.stepArcsec,
    defect: ring.defect,
    offRingPrimes: ring.offRingPrimes,
    divisionReport: ring.divisionReport,
    laneDefects: ring.laneDefects,
    residueClassCount: ring.residueClassCount,

    // src/core/residues.js
    mod: residues.mod,
    residues: residues.residues,
    residueObject: residues.residueObject,

    // src/core/shell-kelim.js
    SHELL_ANCHOR: shellKelim.SHELL_ANCHOR,
    parkedShellResidue: shellKelim.parkedShellResidue,
    parkResidue: shellKelim.parkResidue,
    recoverShellWinding: shellKelim.recoverShellWinding,
    recoverShellWindingFrom: shellKelim.recoverShellWindingFrom,
    shellIdentity: shellKelim.shellIdentity,
    actualShellWinding: shellKelim.actualShellWinding,
    parkPower: shellKelim.parkPower,
    liftWinding: shellKelim.liftWinding,
    doubleLiftWinding: shellKelim.doubleLiftWinding,
    windingFromTray: shellKelim.windingFromTray,
    trayRegister: shellKelim.trayRegister,
    verifyShellWinding: shellKelim.verifyShellWinding,
    LEGACY_SHELL: shellKelim.LEGACY_SHELL,
    LEGACY_ANCHOR: shellKelim.LEGACY_ANCHOR,
    shellResidue: shellKelim.shellResidue,
    gearResidue: shellKelim.gearResidue,
    recoverShellWindingFromGear: shellKelim.recoverShellWindingFromGear,
    actualLegacyWinding: shellKelim.actualLegacyWinding,
    verifyLegacyShellWinding: shellKelim.verifyLegacyShellWinding,

    // src/ledger/import-ledger.js
    validateLedgerEntry: ledger.validateLedgerEntry,
    admitForCore: ledger.admitForCore,
    importLedger: ledger.importLedger,
  };
}
