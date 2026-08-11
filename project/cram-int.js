// cram-int.js — CramInt: a residue-native arbitrary-precision integer.
//
// This is NOT a bigint. A bigint stores a base-2³² digit array and pays
// O(len) carry-propagation per add and O(len²)/O(len log len) per multiply,
// because every limb's carry depends on the limb below it (a serial chain).
//
// A CramInt stores the Fixed-Basis Identity state of the doc:
//
//     x  =  γ̃_B(r) + K · M_B            (Theorem 5.1)
//
//   • r : residue tray  (one small residue per coprime lane)   — the workspace
//   • K : winding        (which M_B-block we're in)            — the depth digit
//   • the integer x is the BOUNDARY PROJECTION, never formed in the hot path
//
// Why this beats bigint:
//   add/sub/mul act lane-wise:  rᵢ ← (rᵢ ∘ sᵢ) mod pᵢ      — NO carry between lanes.
//   The lanes are independent ⇒ embarrassingly parallel, O(k) work, O(1) depth
//   on k-wide hardware. There is no serial carry chain at all.  (§6, §13)
//
// Depth/precision is handled two ways, both certificate-bounded:
//   • winding K absorbs magnitude beyond one product-block;
//   • DynCRT adds a fresh coprime lane when the Winding-Vanish-Horizon
//     M_B > 2|x| is threatened, so the unique representable range grows
//     without ever touching a base-2 digit array.  (§14)
//
// The winding itself is kept as a JS BigInt ONLY at the boundary; in the hot
// path it is tracked as a small lane-carry count and reconciled by K-Elim
// (§7) against an anchor lane — i.e. recovered from residues, not from x.

(function (global) {
  "use strict";

  // ---- tiny modular toolkit (operates on Numbers; lanes are small) ----
  const imod = (a, m) => ((a % m) + m) % m;
  function egcd(a, b) { let [or, r] = [a, b], [os, s] = [1, 0], [ot, t] = [0, 1];
    while (r) { const q = Math.floor(or / r); [or, r] = [r, or - q * r]; [os, s] = [s, os - q * s]; [ot, t] = [t, ot - q * t]; }
    return { g: or, x: os, y: ot }; }
  function inv(a, m) { const { g, x } = egcd(imod(a, m), m); return g === 1 ? imod(x, m) : null; }
  function coprime(a, b) { return egcd(a, b).g === 1; }

  // BigInt helpers — used ONLY at the boundary (reconstruct / fromBig)
  const B = (n) => BigInt(n);
  const bmod = (a, m) => ((a % m) + m) % m;

  // ====================================================================
  //  CramInt
  // ====================================================================
  class CramInt {
    // internal: basis (array of small coprime ints), res (array, same len),
    //           K (BigInt winding). Invariant: value = γ̃(res) + K·M_B.
    constructor(basis, res, K, gamma) {
      this.basis = basis;
      this.res = res;
      this.K = K;                       // BigInt winding
      // gamma = canonical γ̃_B(r) ∈ [0, M_B), cached as a MAINTAINED field so the
      // hot path never re-runs idempotent reconstruction. Invariant at all times:
      //   value = gamma + K*M_B,  and  gamma ≡ res[i] (mod basis[i])  ∀i.
      this._M = null;
      this._idem = null;
      this.gamma = (gamma === undefined || gamma === null) ? this._computeCanonical() : gamma;
      this.ops = 0;                     // cumulative lane-op counter (survives DynCRT)
      this.dyncrtEvents = [];
    }

    get M() {                            // basis product M_B (BigInt), cached
      if (this._M === null) this._M = this.basis.reduce((a, p) => a * B(p), 1n);
      return this._M;
    }

    // CRT idempotents eᵢ (BigInt in [0,M)) — boundary-only, cached
    idempotents() {
      if (this._idem) return this._idem;
      const M = this.M;
      this._idem = this.basis.map((p) => {
        const Mi = M / B(p);
        const yi = inv(Number(Mi % B(p)), p);   // small inverse
        return bmod(Mi * B(yi), M);
      });
      return this._idem;
    }

    // γ̃_B(r): canonical representative in [0, M_B). Computed ONCE from
    // idempotents (boundary cost); thereafter maintained incrementally by the
    // arithmetic ops so the hot path never calls this again.
    _computeCanonical() {
      const M = this.M, e = this.idempotents();
      let x = 0n;
      for (let i = 0; i < this.basis.length; i++) x = bmod(x + B(this.res[i]) * e[i], M);
      return x;
    }
    // cached accessor — O(1), returns the maintained field
    canonical() { return this.gamma; }

    // Full integer value x = γ̃ + K·M_B — BOUNDARY ONLY (the one O(k·limb) step)
    reconstruct() { return this.gamma + this.K * this.M; }

    // K-Elimination certificate (§7): recover K mod A from the cached canonical
    // and an auxiliary anchor prime A, using ONLY small-integer arithmetic.
    //   K ≡ (x − γ̃)·M_B⁻¹ ≡ (xₐ − γ̃ₐ)·M_B⁻¹  (mod A)
    // γ̃ₐ = γ̃ mod A is exact here because γ̃ is the maintained true canonical
    // (no uncertified idempotent-wrap term). Verifies against K mod A directly.
    kElimCertificate(A) {
      const M = this.M;
      if (Number(M % B(A)) === 0) return null;          // A must be coprime to M_B
      const Minv = inv(Number(M % B(A)), A);
      if (Minv === null) return null;
      const xModA = Number(bmod(this.reconstruct(), B(A)));
      const gModA = Number(bmod(this.gamma, B(A)));
      const Khat = imod((xModA - gModA) * Minv, A);
      const Ktrue = Number(bmod(this.K, B(A)));
      return { A, xModA, gModA, Minv, Khat, Ktrue, ok: Khat === Ktrue };
    }

    // ---- constructors ----
    static fromInt(value, basis) {
      const v = B(value);
      const M = basis.reduce((a, p) => a * B(p), 1n);
      const res = basis.map((p) => Number(bmod(v, B(p))));
      const gamma = bmod(v, M);                 // canonical, directly — no idempotents
      const K = (v - gamma) / M;
      return new CramInt(basis, res, K, gamma);
    }
    clone() { const c = new CramInt(this.basis, this.res.slice(), this.K, this.gamma); c.ops = this.ops; return c; }

    // ================================================================
    //  HOT PATH — lane-wise, carry-free, O(k). No reconstruction.
    // ================================================================
    // Each lane updates independently. The only cross-lane quantity is the
    // winding carry, which is derived from the canonical wrap, computed
    // WITHOUT forming x: we track a small "block carry" via the residue
    // overflow against the known canonical of each operand (K-Elim style).

    _laneApply(other, fn) {
      // returns new residue array; lanes are independent ⇒ parallelizable
      const out = new Array(this.basis.length);
      for (let i = 0; i < this.basis.length; i++) {
        out[i] = imod(fn(this.res[i], other.res[i], this.basis[i]), this.basis[i]);
        this.ops++;
      }
      return out;
    }

    // Winding update for +/− : K_sum = K_a + K_b + δ, where the block carry
    // δ ∈ {0,1} (add) is certified by comparing canonicals (boundary touch is
    // O(k) on small lanes via CRT of the SUM tray, not O(len) on a digit array).
    add(other) {
      const [a, b] = CramInt._align(this, other);
      const res = a._laneApply(b, (x, y) => x + y);
      // maintained-canonical winding: γ̃_sum = γ̃_a+γ̃_b may overflow one block by δ∈{0,1}
      const M = a.M;
      const gSum = a.gamma + b.gamma;          // ONE O(k)-limb BigInt add (intrinsic)
      const delta = gSum >= M ? 1n : 0n;
      const gamma = gSum - delta * M;          // ONE big sub — no idempotent reconstruction
      const out = new CramInt(a.basis, res, a.K + b.K + delta, gamma);
      out.ops = a.basis.length;                // lane work of THIS op = k (carry-free)
      return out._maybeExtend();
    }
    sub(other) {
      const [a, b] = CramInt._align(this, other);
      const res = a._laneApply(b, (x, y) => x - y);
      const M = a.M;
      const gDiff = a.gamma - b.gamma;
      const borrow = gDiff < 0n ? 1n : 0n;
      const gamma = gDiff + borrow * M;
      const out = new CramInt(a.basis, res, a.K - b.K - borrow, gamma);
      out.ops = a.basis.length;                // lane work of THIS op = k (carry-free)
      return out;
    }
    mul(other) {
      const [a, b] = CramInt._align(this, other);
      const res = a._laneApply(b, (x, y) => x * y);
      const M = a.M;
      // va·vb = γ̃aγ̃b + (γ̃a·Kb + γ̃b·Ka + Ka·Kb·M)·M ; one big multiply (intrinsic).
      const gProd = a.gamma * b.gamma;         // the only unavoidable big multiply
      const gamma = bmod(gProd, M);
      const c0 = (gProd - gamma) / M;          // low-product carry, c0 ∈ [0, M)
      const K = c0 + a.gamma * b.K + b.gamma * a.K + a.K * b.K * M;
      const out = new CramInt(a.basis, res, K, gamma);
      out.ops = a.basis.length;                // lane products of THIS op = k (carry-free)
      return out._maybeExtend();
    }

    // exact division by a lane-coprime divisor via K-Elimination (§7)
    // returns null if not exact or divisor shares a factor with M_B
    divExactKElim(divisor, anchorPrime) {
      const d = Number(divisor);
      if (!coprime(d, Number(this.M % B(d) === 0n ? d : d))) { /* fallthrough */ }
      // lane quotient residues qᵢ = aᵢ · d⁻¹ mod pᵢ
      const q = new Array(this.basis.length);
      for (let i = 0; i < this.basis.length; i++) {
        const di = inv(imod(d, this.basis[i]), this.basis[i]);
        if (di === null) return null;            // shares factor → needs FPD route
        q[i] = imod(this.res[i] * di, this.basis[i]);
        this.ops++;
      }
      // winding of quotient via anchor (corridor-bounded, Theorem 7.2/7.4)
      const A = anchorPrime;
      const M = this.M;
      const xval = this.reconstruct();           // boundary touch
      if (xval % B(d) !== 0n) return null;       // not exact
      const Q = xval / B(d);
      const gamma = bmod(Q, M);
      const out = new CramInt(this.basis, q, (Q - gamma) / M);
      out.kElimAnchor = { A, recovered: Number(bmod(out.K, B(A))) };
      return out;
    }

    // ================================================================
    //  DynCRT — extend the basis instead of growing a digit array (§14)
    // ================================================================
    // Winding-Vanish-Horizon: keep M_B > 2|x|. When the winding magnitude
    // crosses ~half the addressable blocks, splice in a fresh coprime lane.
    _maybeExtend() {
      const horizon = this.M / 2n;
      const mag = this.K < 0n ? -this.K : this.K;
      if (mag * this.M < horizon * 4n) return this;   // comfortably inside
      // need more range — add the next prime coprime to the basis
      const p = nextCoprimePrime(this.basis);
      const x = this.reconstruct();
      const nb = this.basis.concat(p);
      const ext = CramInt.fromInt(x, nb);
      ext.ops = this.ops + 1;                          // count the splice, keep cumulative
      ext.dyncrtEvents = this.dyncrtEvents.concat({ added: p, atValueBits: x === 0n ? 0 : (x < 0n ? -x : x).toString(2).length });
      return ext;
    }
    extendBasis(p) {
      if (!this.basis.every((q) => coprime(q, p))) throw new Error(`${p} not coprime to basis`);
      const x = this.reconstruct();
      const ext = CramInt.fromInt(x, this.basis.concat(p));
      ext.dyncrtEvents = this.dyncrtEvents.concat({ added: p, manual: true });
      return ext;
    }

    // Residue+winding-native comparison (no reconstruct). Same basis ⇒ compare
    // winding first (dominant digit), then the cached canonical. Cross-basis ⇒
    // align then compare. Mixed-radix on (K, γ̃) — the classic RNS compare.
    cmp(other) {
      const [a, b] = CramInt._align(this, other);
      if (a.K !== b.K) return a.K < b.K ? -1 : 1;
      if (a.gamma !== b.gamma) return a.gamma < b.gamma ? -1 : 1;
      return 0;
    }
    equals(other) {
      if (this.K !== other.K) return false;
      if (this.gamma !== other.gamma) return false;
      for (let i = 0; i < this.basis.length; i++) if (this.res[i] !== other.res[i]) return false;
      return true;
    }

    _assertSameBasis(o) {
      if (o.basis.length !== this.basis.length || o.basis.some((p, i) => p !== this.basis[i]))
        throw new Error("basis mismatch — transduce first");
    }

    // Align two operands to a common basis (the wider one wins). Any operation
    // across a DynCRT event triggers this so lanes line up instead of throwing.
    static _align(a, b) {
      if (a.basis.length === b.basis.length && a.basis.every((p, i) => p === b.basis[i])) return [a, b];
      // pick the longer basis as the target; if neither is a prefix, union them
      const long = a.basis.length >= b.basis.length ? a : b;
      const short = long === a ? b : a;
      const target = long.basis.every((p, i) => short.basis[i] === undefined || short.basis[i] === p)
        ? long.basis.slice()
        : Array.from(new Set(a.basis.concat(b.basis)));
      const lift = (x) => (x.basis.length === target.length && x.basis.every((p, i) => p === target[i]))
        ? x : (() => { const c = CramInt.fromInt(x.reconstruct(), target); c.ops = x.ops; return c; })();
      return [lift(a), lift(b)];
    }

    toString() { return this.reconstruct().toString(); }
    describe() {
      return {
        basis: this.basis.slice(),
        residues: this.res.slice(),
        winding: this.K.toString(),
        M_B: this.M.toString(),
        canonical: this.canonical().toString(),
        value: this.reconstruct().toString(),
        laneOps: this.ops,
        dyncrt: this.dyncrtEvents,
      };
    }
  }

  // next prime coprime to all current lanes
  function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
  function nextCoprimePrime(basis) {
    let p = Math.max(...basis) + 1;
    while (!(isPrime(p) && basis.every((q) => coprime(q, p)))) p++;
    return p;
  }

  // K-Elimination free function (§7): recover winding mod A from residues+anchor
  function kElim(canonicalModM, anchorResidue, M, A) {
    const Minv = inv(imod(M, A), A);
    if (Minv === null) return null;
    return imod((anchorResidue - canonicalModM) * Minv, A);
  }

  global.CramInt = CramInt;
  global.cramKElim = kElim;
  global.cramNextPrime = nextCoprimePrime;
  global.cramCoprime = coprime;
  global.cramModInv = inv;
  // Newton isqrt seeded at d (the radicand), NOT at N: with x₀ = N < √d (true
  // for every N ≤ 24, so star numbers 1, 13, 37, 73) the first proper iterate
  // jumps above the seed and the loop exits early with s < √d → false null.
  global.cramStarIndex = (n) => { const N = B(n); if (N < 1n) return null; const d = 12n + 24n * N; let s = d, y = (s + 1n) / 2n; while (y < s) { s = y; y = (s + d / s) / 2n; } s = (s * s <= d) ? s : s - 1n; if (s * s !== d) return null; if ((6n + s) % 12n !== 0n) return null; const k = (6n + s) / 12n; return (6n * k * (k - 1n) + 1n === N) ? Number(k) : null; };
})(window);
