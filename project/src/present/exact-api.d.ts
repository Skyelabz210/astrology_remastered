export interface AdmissibleLedgerEntry {
  ledger_version: 'hcrm-ephemeris-ledger-v1'; event_id: string; body: string;
  longitude_arcsec: string;
  source: { kind: string; name: string; checksum: string };
  certificate: { status: 'IMPORTED_INTEGER_LEDGER'|'CERTIFIED_EXACT_LEDGER'; notes: string };
}
export interface ExactRegister {
  kind: 'HCRM_REGISTER_V2'; body: string; longitude_arcsec: string;
  residues_B8: Record<string,string>; residues_shell: Record<string,string>;
  residues_B6: Record<string,string>; residues_gear: Record<string,string>;
  shell: { split: 'parked'; r: string; K: string; anchor: string; winding_derived: true; winding_carried: false };
}
export function computeAdmittedRegister(entry: AdmissibleLedgerEntry): ExactRegister;
