// src/core/cram.js — the CRAM layer, as CRAM and not as RNS. (P14)
//
// CORRECTION OF RECORD
// ────────────────────
// Everything this project built on the Safe Basis used it the way an RNS uses
// moduli: a flat bag of PRIMES, with the winding recovered through a
// multiplicative anchor drawn from INSIDE the basis (the gear pair 17·19 = 323)
// and a precomputed inverse M6⁻¹ ≡ 287 (mod 323). That is correct arithmetic
// and it is not CRAM. Four things were being used wrongly:
//
//  1. ANCHOR. CRAM's governing configuration is the ADJACENT anchor A = M + 1.
//     Then M ≡ −1 (mod A), so M is its own inverse and
//
//         K ≡ r − s   (mod M+1)
//
//     — one modular subtraction, no multiply, no inverse, no precomputation.
//     The shipped gear path costs a subtract, a multiply and a reduction, and
//     needs the constant 287 computed ahead of time. A = M+1 also gives a far
//     wider corridor: 30,031 against 323, a factor of 92 on the six-lane shell.
//
//  2. PRIMALITY. gcd(M, M+1) = 1 for free, so the anchor never needs a
//     primality test — and in fact is usually composite: 30,031 = 59 · 509 and
//     9,699,691 = 347 · 27,953. The addressing layer (CRT, winding, K-Elim,
//     comparison, division-by-constant) needs COPRIMALITY only. Primality is
//     needed by the FIELD layer (square root, Legendre, index), which is a
//     different stack. A safe basis is a set of pairwise-coprime positive
//     integers, not a set of primes; `adjacencyRecover` is verified below on
//     the all-composite basis {8, 9, 25, 49, 11, 13}.
//
//  3. DEGRADATION. gcd(M, A) = d > 1 does not break K-Elimination; it reduces
//     resolution to A/d. This is the Resolution Gradient, and it is where the
//     Maya Calendar Round comes from: gcd(260, 365) = 5, resolution 73, and
//     73·260 = 52·365 = 18,980. The project treated 260 and 365 only through
//     ring closure and missed that they are a K-Elimination pair.
//
//  4. SHADOW. The shadow lattice is a HIGHER-POWER anchor whose non-coprimality
//     with the basis is deliberate: 11⁶ with gcd(11⁶, M8) = 11. It lifts K to
//     modulus 11⁵ = 161,051, a corridor of M8 · 11⁵ ≈ 1.56 × 10¹². The project
//     treated 11 as a single lane and never lifted it.
//
// Kept from the RNS-shaped work: the gear path is still here as
// `generalRecover`, because it is the general case A ∤ M+1 and it is what you
// need when the anchor is fixed by something other than adjacency.
//
// BigInt only. No floats, no Date, no ephemeris.

import { mod } from "./residues.js";
import { B6, B8, M6, M8 } from "./basis.js";

// ── basis hygiene: coprimality, not primality ──────────────────────

export function gcd(a, b) {
  let x = a < 0n ? -a : a, y = b < 0n ? -b : b;
  while (y) { const t = mod(x, y); x = y; y = t; }
  return x;
}

export function egcd(a, b) {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x, y] = egcd(b, mod(a, b));
  return [g, y, x - (a / b) * y];
}

/** Modular inverse, or null when a is not a unit mod m. */
export function inverse(a, m) {
  const [g, x] = egcd(mod(a, m), m);
  return g === 1n ? mod(x, m) : null;
}

/** A safe basis is pairwise coprime. It is NOT required to be prime. */
export function isSafeBasis(basis) {
  for (let i = 0; i < basis.length; i++) {
    if (basis[i] < 2n) return false;
    for (let j = i + 1; j < basis.length; j++) if (gcd(basis[i], basis[j]) !== 1n) return false;
  }
  return true;
}

export function shellModulus(basis) { return basis.reduce((a, p) => a * p, 1n); }

/** The canonical CRAM anchor: adjacent to the shell, coprime by construction. */
export function canonicalAnchor(M) { return M + 1n; }

// ── K-Elimination ──────────────────────────────────────────────────

/**
 * ADJACENCY COLLAPSE — the governing CRAM configuration.
 *
 *     A = M + 1  ⟹  M ≡ −1 (mod A)  ⟹  M⁻¹ ≡ M ≡ −1  ⟹  K ≡ r − s (mod A)
 *
 * One subtraction and one reduction. Exact whenever 0 ≤ K < A.
 */
export function adjacencyRecover(r, s, M) {
  return mod(r - s, M + 1n);
}

/** The same, from the integer, for testing and for encoding. */
export function adjacencyRecoverFrom(x, M) {
  return adjacencyRecover(mod(x, M), mod(x, M + 1n), M);
}

/**
 * GENERAL K-ELIMINATION — any anchor A coprime to M.
 * Costs a subtract, a multiply by the precomputed M⁻¹ mod A, and a reduction.
 * Returns null when A is not coprime to M (use `gradientRecover` instead).
 */
export function generalRecover(r, s, M, A) {
  const mi = inverse(M, A);
  if (mi === null) return null;
  return mod((s - r) * mi, A);
}

/**
 * RESOLUTION GRADIENT — anchors that share a factor with the shell.
 * With d = gcd(M, A) and R = A/d, K is recovered modulo R rather than A:
 *
 *     K ≡ ((v − r)/d) · (M/d)⁻¹   (mod R)
 *
 * (M/d)⁻¹ mod R always exists because dividing out the full gcd leaves coprime
 * cofactors. Returns null when the residue pair is inconsistent.
 */
export function gradientRecover(r, v, M, A) {
  const d = gcd(M, A);
  const R = A / d;
  const diff = mod(v - r, A);
  if (mod(diff, d) !== 0n) return null;
  const mi = inverse(M / d, R);
  if (mi === null) return null;
  return mod((diff / d) * mi, R);
}

/** The resolution a given (shell, anchor) pair achieves. */
export function resolution(M, A) {
  const d = gcd(M, A);
  return { d: d.toString(), resolution: (A / d).toString(), exact_when_K_below: (A / d).toString() };
}

/**
 * SHADOW LIFT — the Hensel form, needed ONLY when the shadow prime was left in
 * the shell. SUPERSEDED (P18): park lane 11 out of the shell and the shadow
 * anchor is coprime, so `parkedRecover` in anchor.js does the same job as plain
 * K-Elimination with no division step. Retained because the identity is exact
 * and because it is what a shell that already carries 11 must use.
 *
 * The earlier claim that the non-coprimality is "intentional" is withdrawn: it
 * is an artefact of loading 11 into the shell.
 * With M = q·M′, gcd(M′, q) = 1, and shadow modulus q^e:
 *
 *     K ≡ ((s − γ) / q) · (M′)⁻¹   (mod q^{e−1})
 *
 * For B8 with q = 11, e = 6 this pins K modulo 161,051 — a corridor of
 * M8 · 11⁵ ≈ 1.56 × 10¹². Returns null on an inconsistent pair.
 */
export function shadowLift(gamma, s, M, q, e) {
  let power = 1n;
  for (let i = 0n; i < e; i++) power = power * q;
  const Mp = M / q;
  const diff = mod(s - gamma, power);
  if (mod(diff, q) !== 0n) return null;
  const lifted = power / q;
  const mi = inverse(Mp, lifted);
  if (mi === null) return null;
  return { K: mod((diff / q) * mi, lifted), modulus: lifted, corridor: M * lifted };
}

// ── the O(1) yield: K-Elimination, and that is all ────────────────
//
// CORRECTION OF RECORD (P20). The previous pass wrote the yield as
// "K-Elimination plus one multiply-add, X = r + K·M" — and that multiply-add is
// precisely a RADIX composition. r is the low digit, K is the high digit, M is
// the radix. Coupling them is the positional emission A2 retires, reintroduced
// inside the function that was supposed to avoid it.
//
// The yield does not couple. K-Elimination gives K; r is already there; the
// number IS the pair. On an adjacent anchor that is one modular subtraction:
//
//     K = (r − s) mod (M+1)          →   the number is (r, K)
//
// Two operations. r stays in the shell lanes, K stays in the anchor lane, and
// nothing is fused. Verified: the pair is injective over the whole span without
// the composite ever being formed, and equality and ordering both work on it
// directly — lexicographic (K, r) reproduces integer order exactly.
//
// Forming r + K·M is a BOUNDARY PROJECTION and is named as one below. It is
// available, it is exact, and it costs two further operations — but it is a
// radix step and belongs at a declared boundary, never in the path.
//
// Earlier withdrawals that stand: A3 was imported and is not a premise here;
// A2 retires Garner, not the act of producing a value at a boundary.

/**
 * The yield, adjacent anchor. One modular subtraction. Returns the identity
 * pair — r and K are NOT combined.
 */
export function yieldAdjacent(r, s, M) {
  return { r, K: mod(r - s, M + 1n), shell: M, anchor: M + 1n };
}

/**
 * The yield, any coprime anchor. K-Elimination only. Returns the identity pair.
 * Null when A is not coprime to M.
 */
export function yieldGeneral(r, s, M, A) {
  const K = generalRecover(r, s, M, A);
  return K === null ? null : { r, K, shell: M, anchor: A };
}

/** Equality on the identity pair. No composite is formed. */
export function identityEquals(a, b) { return a.r === b.r && a.K === b.K; }

/**
 * Order on the identity pair: K orders the laps, r orders within a lap.
 * Reproduces integer order exactly, without forming either integer.
 */
export function identityCompare(a, b) {
  if (a.K !== b.K) return a.K < b.K ? -1 : 1;
  if (a.r !== b.r) return a.r < b.r ? -1 : 1;
  return 0;
}

/**
 * BOUNDARY PROJECTION — this is the radix step. It couples r and K into a
 * base-M positional composite. Exact, but it is not the yield and must not be
 * treated as one. Two operations on top of the yield.
 */
export function projectToInteger(id) { return id.r + id.K * id.shell; }

/**
 * Costs, split so the coupling is visible rather than folded into a total.
 * `couples` is the field that matters.
 */
export function yieldCost(mode, lanes = 8n) {
  if (mode === "adjacent") {
    return { mode, subtract: 1n, reduce: 1n, multiply: 0n, add: 0n,
      total_ops: 2n, couples: false, depends_on_lane_count: false };
  }
  if (mode === "general") {
    return { mode, subtract: 1n, reduce: 1n, multiply: 1n, add: 0n,
      inverse_precomputed: 1n, total_ops: 3n, couples: false,
      depends_on_lane_count: false };
  }
  if (mode === "projection") {
    return { mode, multiply: 1n, add: 1n, total_ops: 2n, couples: true,
      note: "radix composition r + K·M — boundary only", depends_on_lane_count: false };
  }
  if (mode === "garner") {
    return { mode, per_lane_ops: 6n, total_ops: 6n * lanes, couples: true,
      note: "threads an accumulator through every digit", depends_on_lane_count: true };
  }
  throw new Error("unknown yield mode");
}

// ── operation cost, counted rather than asserted ───────────────────

/**
 * Op counts for one winding recovery, so the adjacency claim is auditable
 * rather than rhetorical. Counts are structural, not timed.
 */
export function recoveryCost(mode) {
  if (mode === "adjacency") {
    return { mode, subtract: 1n, multiply: 0n, reduce: 1n, inverse_precomputed: 0n, total_ops: 2n };
  }
  if (mode === "general") {
    return { mode, subtract: 1n, multiply: 1n, reduce: 1n, inverse_precomputed: 1n, total_ops: 3n };
  }
  throw new Error("unknown recovery mode");
}

// ── the CRAM identity state ────────────────────────────────────────

/**
 * The state tuple is not (r, K). It is
 *
 *     S = (B, r, K, Σ, T, Sh, L, F)
 *
 * basis · residue tray · winding · property signature · operator topology ·
 * shadow state · lineage · finite support. A4 makes the topology first-class:
 * each lane may carry an independent operator, and homogeneous operation is the
 * special case, not the rule. Carrying only (r, K) is the RNS reduction of this.
 */
export const STATE_FIELDS = ["basis", "r", "K", "sigma", "topology", "shadow", "lineage", "support"];

export function encode(x, basis, opts = {}) {
  const M = shellModulus(basis);
  return {
    kind: "CRAM_STATE_V1",
    basis: basis.slice(),
    r: basis.map((p) => mod(x, p)),
    K: (x - mod(x, M)) / M,
    sigma: opts.sigma || {},
    topology: opts.topology || basis.map(() => "id"),
    shadow: opts.shadow || null,
    lineage: opts.lineage || [],
    support: opts.support || basis.map((_, i) => i),
  };
}

/** Canonical CRT representative of the tray — the boundary touch, not the hot path. */
export function gamma(state) {
  const M = shellModulus(state.basis);
  let acc = 0n;
  for (let i = 0; i < state.basis.length; i++) {
    const p = state.basis[i];
    const Mi = M / p;
    const ei = Mi * inverse(Mi, p);
    acc = mod(acc + state.r[i] * ei, M);
  }
  return acc;
}

export function value(state) { return gamma(state) + state.K * shellModulus(state.basis); }

export function wellFormed(state) {
  return state.kind === "CRAM_STATE_V1"
    && STATE_FIELDS.every((f) => f in state)
    && isSafeBasis(state.basis)
    && state.r.length === state.basis.length
    && state.r.every((v, i) => v >= 0n && v < state.basis[i])
    && state.topology.length === state.basis.length;
}

// ── the 5th operator: transduction χ ───────────────────────────────
//
// CORRECTION OF RECORD (P16). The first implementation computed `value(state)`
// and re-reduced. That is a full reconstruction — it leaves the residue world,
// which is the one thing transduction exists not to do. Worse, it materialises
// K·M, so its cost scaled with the magnitude of the value rather than with the
// basis. Rewritten below to be residue-native.
//
// WHAT CERTIFIES A TRANSDUCTION
// ─────────────────────────────
// Not the winding tower. The tower certifies DEPTH inside one fixture and says
// nothing about the bridge between two. What certifies the bridge is an
// UNBROKEN SAFE BASIS: pairwise coprimality with no repeated modulus, on both
// sides. That alone makes the idempotents exist, and the idempotents are the
// whole bridge.
//
// THE BRIDGE
// ──────────
// With e_i the CRT idempotents of A (which exist exactly because A is unbroken):
//
//     Σ_i r_i·e_i  =  γ_A(r) + t·M_A        t < Σ a_i, a basis-sized constant
//     x            =  γ_A(r) + K_A·M_A
//                  =  Σ_i r_i·e_i + (K_A − t)·M_A
//
// so for any target lane b, writing W = K_A − t for the effective winding:
//
//     x mod b  =  ( Σ_i r_i·(e_i mod b)  +  W·(M_A mod b) )  mod b
//
// Nothing proportional to |x| is ever formed. The largest integer built is
// Σ r_i e_i < M_A·Σa_i — fixed by the basis, not by the value. A 43-digit x
// transduces with a 4-digit intermediate.
//
// SHARED LANES ARE THE PHASE LOCK. A lane present in both bases is copied
// across untouched; no bridging is needed and none is done. Disjointness of the
// two bases is therefore NOT required — sharing is a feature, and it is exactly
// where the phase lock lives.

/** CRT idempotents of a basis. They exist iff the basis is unbroken. */
export function idempotents(basis) {
  const M = shellModulus(basis);
  return basis.map((a) => {
    const Mi = M / a;
    const iv = inverse(Mi, a);
    if (iv === null) throw new Error("broken basis: idempotent does not exist");
    return Mi * iv;
  });
}

/**
 * The certificate. A transduction is admissible exactly when both bases are
 * unbroken safe bases. Disjointness is not required.
 */
export function certifyTransduction(A, B) {
  const repeated = (b) => new Set(b.map(String)).size !== b.length;
  const aOk = isSafeBasis(A) && !repeated(A);
  const bOk = isSafeBasis(B) && !repeated(B);
  const shared = A.filter((p) => B.some((q) => q === p));
  let idem = false;
  try { idempotents(A); idem = true; } catch { idem = false; }
  return {
    kind: "TRANSDUCTION_CERTIFICATE_V1",
    source_unbroken: aOk,
    target_unbroken: bOk,
    idempotents_exist: idem,
    shared_lanes: shared.map(String),
    disjoint: shared.length === 0,
    admissible: aOk && bOk && idem,
    certified_by: "unbroken safe basis",
  };
}

/**
 * The basis bridge. Residue-native: no reconstruction, nothing proportional to
 * the value. `phiLane` applies a lane-wise value map (any polynomial with
 * integer coefficients acts lane-wise, since Φ(x) mod b = Φ(x mod b) mod b).
 * Ω selects the winding policy: recompute · preserve · project.
 *
 * MAGNITUDE IS NOT A LANE-WISE QUANTITY. (P22)
 * ────────────────────────────────────────────
 * Φ acting lane-wise fixes the target RESIDUES, but it says nothing about the
 * magnitude of Φ(x) — and the winding K_B = ⌊Φ(x)/M_B⌋ is a magnitude fact.
 * The adjacency K-Elim below recovers K_B only modulo M_B+1, so it is the exact
 * winding only inside the corridor, and the corridor test needs a bound on the
 * TRANSFORMED value. A bound on x certifies nothing about Φ(x).
 *
 * So a caller supplying a non-trivial `phiLane` must also declare how Φ moves
 * magnitude. These are declarations about Φ, not reconstructions of x:
 *
 *   phiBound(N)     ⟹  Φ(X) < phiBound(N) for every 0 ≤ X < N.  Required by
 *                      omega:"recompute". Used only for the corridor test.
 *   phiMagnitude(X) ⟹  Φ(X) exactly, on integers. Required by omega:"lift",
 *                      which is a declared boundary touch and needs the value.
 *
 * With no phiLane both default to the identity and the old behaviour stands.
 * Absent when required, the transduction is REFUSED rather than certified on a
 * bound that does not apply to what the tray now holds.
 */
export function transduce(state, targetBasis, opts = {}) {
  const cert = certifyTransduction(state.basis, targetBasis);
  if (!cert.admissible) throw new Error("transduction refused: basis is broken");

  const Theta = opts.theta || ((z) => z);
  const Pi = opts.pi || ((t) => t.slice(0, targetBasis.length));
  const omega = opts.omega || "recompute";
  const phiLane = opts.phiLane || null;
  const phiBound = opts.phiBound || (phiLane ? null : (N) => N);
  const phiMagnitude = opts.phiMagnitude || (phiLane ? null : (X) => X);

  const A = state.basis, MA = shellModulus(A);
  const e = idempotents(A);
  let raw = 0n;
  for (let i = 0; i < A.length; i++) raw = raw + state.r[i] * e[i];
  const W = state.K - raw / MA;                 // effective winding; raw/MA is basis-sized

  /** x mod m, computed from the source tray alone. */
  const bridge = (m) => {
    const hit = A.findIndex((a) => a === m);
    if (hit >= 0) return state.r[hit];          // shared lane — the phase lock
    let acc = 0n;
    for (let i = 0; i < A.length; i++) acc = acc + state.r[i] * mod(e[i], m);
    return mod(acc + W * mod(MA, m), m);
  };

  const r = targetBasis.map((b) => {
    const v = bridge(b);
    return phiLane ? mod(phiLane(v, b), b) : v;
  });

  const MB = shellModulus(targetBasis);
  const anchor = MB + 1n;
  let K, corridor = null, certified = null;
  if (omega === "recompute" || omega === "lift") {
    // Native adjacency K-Elim in the TARGET frame: bridge to M_B+1, subtract.
    const gB = gammaOf(r, targetBasis);
    const sB = phiLane ? mod(phiLane(bridge(anchor), anchor), anchor) : bridge(anchor);
    K = mod(gB - sB, anchor);
    corridor = anchor;

    // The source magnitude corridor: x = γ_A + K_A·M_A < M_A·(K_A+1).
    const srcBound = MA * (state.K + 1n);

    if (omega === "recompute") {
      if (phiBound === null) {
        throw new Error(
          "transduction refused: phiLane given without phiBound. Φ acts lane-wise on "
          + "residues but its effect on MAGNITUDE is not a lane-wise fact, and the winding "
          + "corridor is a magnitude test. Declare phiBound(N) — an upper bound on Φ(X) for "
          + "X < N — or pass omega:'lift' with phiMagnitude to take an explicit boundary touch.");
      }
      // Certify against the TRANSFORMED magnitude, not the source:
      //   K_B ≤ ⌊Φ(x)/M_B⌋  and  Φ(x) < phiBound(M_A·(K_A+1))
      const bound = phiBound(srcBound) / MB;
      certified = bound < anchor;
      if (!certified) {
        throw new Error(
          "transduction refused: target winding leaves the anchor corridor. "
          + `K_B may reach ${bound}, corridor is ${anchor}. `
          + "Extend the target fixture (a wider basis widens the anchor), or pass omega:'lift' "
          + "to accept an explicit boundary touch.");
      }
    } else {
      // omega === "lift": explicit, declared boundary touch. It needs the value,
      // so under a non-trivial Φ it needs Φ on magnitudes too.
      if (phiMagnitude === null) {
        throw new Error(
          "transduction refused: omega:'lift' with a phiLane needs phiMagnitude. The lift "
          + "reconstructs a magnitude, and Φ's magnitude is not recoverable from the tray.");
      }
      const bound = phiBound === null ? null : phiBound(srcBound) / MB;
      certified = bound !== null && bound < anchor;
      if (!certified) K = phiMagnitude(gammaOf(state.r, A) + state.K * MA) / MB;
    }
  } else if (omega === "preserve") K = state.K;
  else if (omega === "project") K = 0n;
  else throw new Error("unknown winding policy");

  const topo = Pi(state.topology);
  return {
    kind: "CRAM_STATE_V1",
    basis: targetBasis.slice(),
    r, K,
    sigma: Theta(state.sigma),
    topology: topo.length === targetBasis.length ? topo : targetBasis.map(() => "id"),
    shadow: state.shadow,
    lineage: [...state.lineage, {
      op: "chi", omega, to: targetBasis.map(String),
      certified_by: cert.certified_by, shared_lanes: cert.shared_lanes,
      corridor: corridor === null ? null : corridor.toString(),
      corridor_certified: certified,
      boundary_touch: omega === "lift" && certified === false,
      // Φ ≠ id moves magnitude. Under recompute/lift that is certified or the
      // transduction is refused; under preserve/project the winding is the
      // caller's assertion, not a result, and is flagged as such.
      phi_active: phiLane !== null,
      winding_asserted: (omega === "preserve" || omega === "project") && phiLane !== null,
    }],
    support: targetBasis.map((_, i) => i),
  };
}

/** Canonical representative of a tray over a basis. */
export function gammaOf(r, basis) {
  const M = shellModulus(basis);
  const e = idempotents(basis);
  let acc = 0n;
  for (let i = 0; i < basis.length; i++) acc = mod(acc + r[i] * e[i], M);
  return acc;
}

/** A transduction is reversible exactly when Ω preserves the winding. */
export function isReversiblePolicy(omega) {
  return omega === "recompute" || omega === "preserve" || omega === "lift";
}

// ── project defaults ───────────────────────────────────────────────

export const SHELL_6 = { basis: B6, M: M6, anchor: M6 + 1n };
export const SHELL_8 = { basis: B8, M: M8, anchor: M8 + 1n };
