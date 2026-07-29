// src/core/residues.js — pure integer residue helpers. BigInt only. (P3)

export function mod(x, m) {
  const r = x % m;
  return r < 0n ? r + m : r;
}

export function residues(x, basis) {
  return basis.map((p) => mod(x, p));
}

export function residueObject(x, basis) {
  const out = {};
  for (const p of basis) {
    out[`mod_${p.toString()}`] = mod(x, p).toString();
  }
  return out;
}
