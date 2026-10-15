// Public computation boundary: pure mathematical helpers remain reusable, but
// astronomical records enter this application API only after ledger admission.
import { admitForCore } from '../ledger/import-ledger.js';
import { computeHcrmRegister } from '../core/hcrm-core.js';
export function computeAdmittedRegister(entry) {
  return computeHcrmRegister(admitForCore(entry));
}
