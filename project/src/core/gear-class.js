// src/core/gear-class.js — gear-pair classification on (r17, r19). (P3)
// Integer residues only. Spec classes: G-zero, G-pre, G-low, else null.

import { mod } from "./residues.js";

export function gearClass(x) {
  const r17 = mod(x, 17n), r19 = mod(x, 19n);
  if (r17 === 0n && r19 === 0n) return "G-zero";
  if (r17 === 16n && r19 === 18n) return "G-pre";
  if (r17 <= 1n && r19 <= 1n) return "G-low";
  return null;
}
