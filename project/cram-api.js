// cram-api.js — unified programmatic API over the entire CRAM/HCRM/astro stack.
//
// One namespace, window.CRAM, with stable typed entry points. Every
// computational variable is reachable and overridable. Load AFTER
// astro.jsx, hcrm.jsx, cram-int.js (it wires their globals together);
// in a plain-JS page load cram-int.js + this file alone for the number core.
//
//   CRAM.version                      → semver string
//   CRAM.number.*                     → residue-native integers (CramInt)
//   CRAM.crt.*                        → CRT / K-elimination primitives
//   CRAM.basis.*                      → basis presets, validation, DynCRT
//   CRAM.hcrm.*                       → register-map computation (needs hcrm.jsx)
//   CRAM.astro.*                      → natal chart computation (needs astro.jsx)
//   CRAM.config                       → global tunables (default basis, anchors)
//
// Everything returns plain JSON-able objects (BigInt rendered as string via
// .toJSON helpers) so results can cross postMessage / fetch / worker bounds.

(function (root) {
  "use strict";
  const has = (k) => typeof root[k] !== "undefined";

  // ---- global, user-overridable config ----
  const config = {
    defaultBasis: [2, 3, 5, 7, 11, 13, 17, 19],   // SafeS8
    shellBasis:   [2, 3, 5, 7, 11, 13],            // Safe-6 shell (M6 = 30030)
    gearAnchors:  [17, 19],                          // gear pair
    auxAnchor:    23,                                // default K-Elim aux prime
    autoDynCRT:   true,                              // basis auto-extends on overflow
    serpentRoute: ["36,37","11,13,17,19","2,3,5,7,11,13","37,73"], // transduction order
  };

  const B = (n) => BigInt(n);
  const bmod = (a, m) => ((B(a) % B(m)) + B(m)) % B(m);

  // ====================================================================
  //  number — residue-native integers
  // ====================================================================
  const number = {
    /** make a CramInt from any int/bigint/string. basis optional. */
    of(value, basis) {
      if (!has("CramInt")) throw new Error("cram-int.js not loaded");
      return root.CramInt.fromInt(value, basis || config.defaultBasis);
    },
    /** add/sub/mul accept CramInt | int | string; coerce as needed. */
    add(a, b) { return this._coerce(a).add(this._coerce(b, a)); },
    sub(a, b) { return this._coerce(a).sub(this._coerce(b, a)); },
    mul(a, b) { return this._coerce(a).mul(this._coerce(b, a)); },
    /** exact division by a lane-coprime divisor (null if not exact). */
    divExact(a, d, anchor) { return this._coerce(a).divExactKElim(B(d), anchor || config.auxAnchor); },
    /** -1 | 0 | 1 — residue+winding-native comparison, no reconstruct. */
    cmp(a, b) { return this._coerce(a).cmp(this._coerce(b, a)); },
    eq(a, b) { return this._coerce(a).equals(this._coerce(b, a)); },
    /** full inspector object (all fields JSON-able). */
    describe(a) { return this._coerce(a).describe(); },
    /** the boundary integer as a string. */
    toString(a) { if (a === null || a === undefined) return "null"; return this._coerce(a).reconstruct().toString(); },
    /** widen the basis to include p (DynCRT, manual). */
    extend(a, p) { return this._coerce(a).extendBasis(p); },
    _coerce(x, like) {
      if (x === null || x === undefined) throw new Error("null value (divExact returns null when the divisor is not basis-coprime or the division is inexact)");
      if (has("CramInt") && x instanceof root.CramInt) return x;
      const basis = like && like.basis ? like.basis : config.defaultBasis;
      return root.CramInt.fromInt(x, basis);
    },
  };

  // ====================================================================
  //  crt — CRT & K-elimination primitives (small-int + BigInt)
  // ====================================================================
  const crt = {
    /** modular inverse a⁻¹ mod m, or null. */
    inv(a, m) { return root.cramModInv ? root.cramModInv(Number(a), Number(m)) : _inv(Number(a), Number(m)); },
    /** canonical CRT reconstruction γ̃ from residues over basis. */
    reconstruct(residues, basis) {
      const b = basis || config.defaultBasis;
      const M = b.reduce((a, p) => a * B(p), 1n);
      let x = 0n;
      for (let i = 0; i < b.length; i++) {
        const Mi = M / B(b[i]); const yi = _inv(Number(Mi % B(b[i])), b[i]);
        if (yi === null) continue;
        x = bmod(x + B(residues[i]) * Mi * B(yi), M);
      }
      return x.toString();
    },
    /** residues of N over basis (array of small ints). */
    residues(N, basis) { const b = basis || config.defaultBasis; return b.map((p) => Number(bmod(N, p))); },
    /** winding K of N over basis. */
    winding(N, basis) {
      const b = basis || config.defaultBasis; const M = b.reduce((a, p) => a * B(p), 1n);
      const g = bmod(N, M); return ((B(N) - g) / M).toString();
    },
    /** K-elimination: recover K mod A from canonical + anchor. */
    kElim(canonicalModM, anchorResidue, M, A) {
      const Minv = _inv(Number(bmod(M, A)), Number(A));
      if (Minv === null) return null;
      return Number(bmod((B(anchorResidue) - B(canonicalModM)) * B(Minv), A));
    },
    /** star number f⋆(n) = 6n(n−1)+1, and its inverse index. */
    star(n) { return (6n * B(n) * (B(n) - 1n) + 1n).toString(); },
    starIndex(N) { return root.cramStarIndex ? root.cramStarIndex(N) : _starIndex(N); },
  };

  // ====================================================================
  //  basis — presets, validation, DynCRT helpers
  // ====================================================================
  const basis = {
    presets: {
      dresden: [36, 37], safe4: [11, 13, 17, 19], safe6: [2, 3, 5, 7, 11, 13],
      safe8: [2, 3, 5, 7, 11, 13, 17, 19], star73: [37, 73], full: [7, 11, 13, 37, 73],
    },
    get(name) { return (this.presets[name] || config.defaultBasis).slice(); },
    coprime(arr) { return root.cramCoprime ? arr.every((_, i) => arr.every((__, j) => i >= j || root.cramCoprime(arr[i], arr[j]))) : _coprimeAll(arr); },
    product(arr) { return arr.reduce((a, p) => a * B(p), 1n).toString(); },
    nextCoprime(arr) { return root.cramNextPrime ? root.cramNextPrime(arr) : _nextCoprime(arr); },
    /** capacity in bits = log2(∏ basis). */
    capacityBits(arr) { return arr.reduce((a, p) => a + Math.log2(p), 0); },
  };

  // ====================================================================
  //  hcrm — register-map computation (requires hcrm.jsx globals)
  // ====================================================================
  const hcrm = {
    available() { return has("computeHCRM"); },
    /** full register map from a chart object (see astro.compute). */
    fromChart(chart) { if (!has("computeHCRM")) throw new Error("hcrm.jsx not loaded"); return root.computeHCRM(chart); },
    /** register row for one body {name,glyph,lon,house,retrograde,dignity}. */
    registerRow(body) { return root.registerRow(body); },
    /** gear class of an (r17,r19) pair. */
    gearClass(r17, r19) { return root.gearClass ? root.gearClass({ r17, r19 }) : null; },
    /** K-elimination winding recovery for an arcsec address. */
    kElimWinding(arcsec) { return root.kElimWinding(arcsec); },
    basis() { return root.HCRM_BASIS ? root.HCRM_BASIS.slice() : config.defaultBasis; },
  };

  // ====================================================================
  //  astro — natal chart computation (requires astro.jsx globals)
  // ====================================================================
  const astro = {
    available() { return has("computeNatal"); },
    /** compute a full chart. birth = {dateISO,lat,lng,houseSystem,sect,placeLabel}. */
    compute(birth) { if (!has("computeNatal")) throw new Error("astro.jsx not loaded"); return root.computeNatal(birth); },
    /** ecliptic longitude of a body at a julian day. */
    longitude(planet, jd) { return root.planetLongitude(planet, jd); },
    /** ascendant degree for date/lat/lng. */
    ascendant(date, lat, lng) { return root.ascendantDeg(date, lat, lng); },
    /** nearest aspect for an angular separation. */
    aspect(deltaDeg) { return root.nearestAspect(deltaDeg); },
    zodiac() { return root.ZODIAC ? root.ZODIAC.slice() : []; },
  };

  // ---- local fallbacks (so the number core works without the .jsx files) ----
  function _egcd(a, b) { let [or, r] = [a, b], [os, s] = [1, 0], [ot, t] = [0, 1];
    while (r) { const q = Math.floor(or / r); [or, r] = [r, or - q * r]; [os, s] = [s, os - q * s]; [ot, t] = [t, ot - q * t]; } return { g: or, x: os, y: ot }; }
  function _inv(a, m) { a = ((a % m) + m) % m; const { g, x } = _egcd(a, m); return g === 1 ? ((x % m) + m) % m : null; }
  function _coprimeAll(a) { for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (_egcd(a[i], a[j]).g !== 1) return false; return true; }
  function _isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
  function _nextCoprime(b) { let p = Math.max(...b) + 1; while (!(_isPrime(p) && _coprimeAll(b.concat(p)))) p++; return p; }
  function _isqrt(n) { if (n < 0n) return -1n; if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }
  function _starIndex(N) { N = B(N); if (N < 1n) return null; const d = 12n + 24n * N; const s = _isqrt(d); if (s * s !== d) return null; if ((6n + s) % 12n !== 0n) return null; const k = (6n + s) / 12n; return (6n * k * (k - 1n) + 1n === N) ? Number(k) : null; }

  root.CRAM = {
    version: "1.0.0",
    config, number, crt, basis, hcrm, astro,
    /** capability probe — what's wired in this page. */
    capabilities() {
      return { number: has("CramInt"), hcrm: hcrm.available(), astro: astro.available(),
               crt: true, basis: true, version: "1.0.0" };
    },
  };
})(window);
