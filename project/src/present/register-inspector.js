// Celestial Registry's interactive decomposition adapted to the canonical
// core. Mathematical inputs remain separate from admitted personal skies.
import { mod } from '../core/residues.js';
import { encode, gamma, value, isSafeBasis, shellModulus, generalRecover } from '../core/cram.js';
import { theatreGeometry } from './theatre-geometry.js';
export function decomposeInteger(input,basisText='2,3,5,7,11,13,17,19') {
  if(typeof input!=='string'||! /^-?\d{1,120}$/.test(input.trim()))throw new Error('Enter a signed decimal integer of at most 120 digits.');
  if(typeof basisText!=='string'||! /^\s*\d{1,6}(?:\s*,\s*\d{1,6}){1,11}\s*$/.test(basisText))throw new Error('Enter 2–12 comma-separated moduli, each at most six digits.');
  const basis=basisText.split(',').map(s=>BigInt(s.trim()));
  if(!isSafeBasis(basis))throw new Error('Moduli must be at least 2 and pairwise coprime.');
  const x=BigInt(input.trim()),state=encode(x,basis),representative=gamma(state),M=shellModulus(basis),reconstructed=value(state);
  const centered=representative>M/2n?representative-M:representative;
  const rows=[];
  for(const shell of basis)for(const anchor of basis){if(shell===anchor)continue;
    const r=mod(x,shell),s=mod(x,anchor),recovered=generalRecover(r,s,shell,anchor),actual=mod((x-r)/shell,anchor);
    rows.push({shell:String(shell),anchor:String(anchor),r:String(r),s:String(s),recovered:String(recovered),actual:String(actual),ok:recovered===actual});
  }
  return {version:1,kind:'mathematical-decomposition',integer:String(x),basis:basis.map(String),modulus:String(M),residues:state.r.map(String),representative:String(representative),winding:String(state.K),reconstructed:String(reconstructed),exact:reconstructed===x,
    centered:{r:String(centered),K:String((x-centered)/M)},rows,
    convention:'Direct CRT representative plus signed winding reconstructs the input. Each K-elimination row recovers the individual shell quotient modulo its anchor; it is not the product-basis winding. Centered representatives use (−M/2, M/2]. These runtime checks are arithmetic evidence, not machine-checked Lean proofs or behavioral measurements.'};
}
export function inspectChartRegister(chart,body,ledger) {
  if(chart?.timeUnknown)throw new Error('Exact chart registers require a known birth time.');
  const geometry=theatreGeometry(chart,body,ledger);
  return {version:1,kind:'admitted-personal-register',input:{birth:{...chart.birth},body},register:geometry.register,
    decomposition:decomposeInteger(geometry.longitudeArcsec),houseDepth:geometry.houseDepth,contacts:geometry.contacts};
}
if(typeof window!=='undefined')window.RegisterInspector={decomposeInteger,inspectChartRegister};
