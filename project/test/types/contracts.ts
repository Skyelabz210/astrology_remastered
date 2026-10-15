import { mod, residues } from '../../src/core/residues.js';
import { divisionIndex, toFrame } from '../../src/core/variants.js';
import { computeAdmittedRegister, type AdmissibleLedgerEntry } from '../../src/present/exact-api.js';
import { createMistral } from '../../src/ai/mistral.js';
const result: bigint = mod(1295999n,11n);
const tray: bigint[] = residues(result,[2n,3n,5n]);
const cut: bigint | null = divisionIndex(toFrame(result,85871n),27n);
// @ts-expect-error float degrees cannot enter the exact-core modulus.
mod(12.5,11n);
// @ts-expect-error frame rotations require integer arcseconds.
toFrame(123,85871n);
// @ts-expect-error astronomical records require the complete admission contract.
computeAdmittedRegister({longitude_arcsec:'123'});
const invalid: AdmissibleLedgerEntry = {
  ledger_version:'hcrm-ephemeris-ledger-v1',event_id:'2000-01-01T12:00:00.000Z#Sun',body:'Sun',longitude_arcsec:'100',
  source:{kind:'astronomy-engine',name:'2.1.19',checksum:'hash'},
  // @ts-expect-error synthetic records cannot enter the typed admission API.
  certificate:{status:'SYNTHETIC_DEMO'},
};
const client=createMistral();client.configure('key','pixtral-large-latest');
// @ts-expect-error unknown Mistral model IDs must be rejected.
client.configure('key','invented-model');
void [tray,cut,invalid];
