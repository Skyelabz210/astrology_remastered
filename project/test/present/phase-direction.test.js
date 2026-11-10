// Independent, exact rational-time oracle for the shipped canonical/fallback phases.
// No ephemeris, floating-point stepping, or canonical-vs-canonical expectations.
import { readFileSync } from 'node:fs';
import { phaseExact, ASPECT_LATTICE } from '../../src/present/exact-ring.js';

const RING = 1296000n;
const abs = value => value < 0n ? -value : value;
const mod = (value, modulus) => ((value % modulus) + modulus) % modulus;
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing shipped function ${name}`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed shipped function ${name}`);
}
const source = readFileSync(new URL('../../astro.jsx', import.meta.url), 'utf8');
const fallback = new Function(`
  const RING_B = 1296000n;
  const EXACT_RING_AVAILABLE = () => false;
  ${functionSource(source, 'arcDistanceB')}
  ${functionSource(source, 'phaseFromRing')}
  return phaseFromRing;
`)();

// Advance by 1/D days, with relative movement strictly below one arcsecond.
// Integer positions/targets therefore cannot cross a nonzero error or arc cusp.
function oracle(a, b, va, vb, target) {
  const distance = (x, y, ring) => {
    const forward = mod(x - y, ring);
    return forward <= ring / 2n ? forward : ring - forward;
  };
  const now = abs(distance(a, b, RING) - target);
  if (now === 0n) return 'exact';
  if (va === vb) return 'static';
  const denominator = abs(va) + abs(vb) + 1n;
  const later = abs(distance(a * denominator + va, b * denominator + vb,
    RING * denominator) - target * denominator);
  return later < now * denominator ? 'applying' : 'separating';
}

export function run() {
  const rows = [];
  const check = (name, fn) => {
    try { rows.push({ name, ok: !!fn(), detail: '' }); }
    catch (error) { rows.push({ name, ok: false, detail: error.message }); }
  };
  for (const [mode, phase] of [['canonical', phaseExact], ['fallback', fallback]]) {
    check(`${mode}: reversed sextile regression is applying`, () =>
      phase(0n, 220000n, 5n, 0n, 216000n) === 'applying');
    check(`${mode}: reversed sextile negative motion is separating`, () =>
      phase(0n, 220000n, -5n, 0n, 216000n) === 'separating');
    check(`${mode}: wrap through zero preserves the approaching conjunction`, () =>
      phase(1295999n, 1n, 5n, 0n, 0n) === 'applying');
    check(`${mode}: stationary exact takes precedence over static`, () =>
      phase(0n, 648000n, 7n, 7n, 648000n) === 'exact');
    check(`${mode}: conjunction and opposition cusps have one-sided rates`, () =>
      [-5n, 5n].every(v => phase(0n, 0n, v, 0n, 216000n) === 'applying'
        && phase(0n, 648000n, v, 0n, 216000n) === 'applying'));
    check(`${mode}: independent rational-time oracle across targets/orientations`, () => {
      const shifts = [0n, 1295999n, 9007199254740993n * RING];
      const velocities = [[5n, 0n], [-5n, 0n], [3n, 7n], [-8n, -2n], [7n, 7n]];
      for (const { target } of ASPECT_LATTICE) {
        const points = new Set([0n, 1n, 648000n, 647999n,
          mod(target - 1n, RING), target, mod(target + 1n, RING), mod(-target - 1n, RING)]);
        for (const point of points) for (const shift of shifts) for (const [va, vb] of velocities) {
          const a = shift, b = shift + point;
          const expected = oracle(a, b, va, vb, target);
          if (phase(a, b, va, vb, target) !== expected
              || phase(b, a, vb, va, target) !== expected) return false;
        }
      }
      return true;
    });
  }
  return rows;
}
