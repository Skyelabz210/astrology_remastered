// hcrm.jsx — Human-Celestial Register Map engine.
//
// Treats the natal chart as a distributed register system, not a reading.
// Every body longitude is taken to EXACT INTEGER ARCSECONDS and reduced
// through the chart basis:
//
//   B_chart = { 2, 3, 5, 7, 11, 13, 17, 19 }
//
//   2  polarity / opposition / binary split
//   3  triadic lane / synthesis / trine-class relation
//   5  body-life composite / pentadic organismal register
//   7  visible planetary operator set / classical wandering-body frame
//   11 shadow-prime witness lane
//   13 boundary / re-entry / tone-lift register
//   17,19 gear pair / deep coupling / nonlocal correction field
//
// 1° = 3600″,  30° = 108000″,  360° = 1,296,000″
//
// Each body becomes a register address; the shadow-prime overlay turns the
// whole chart into a residue map of the human. The payload is the TABLE,
// not the prose.
//
// WP-15: the CRT / K-Elimination arithmetic below is no longer a local
// Number-based reimplementation. It is routed through `window.HCRM_CORE`
// (core-shim.js, BigInt only — see project/src/core/shell-kelim.js), with
// conversion at the boundary: `BigInt(arcsecString)` in, `Number(...)` back
// out only for cosmetic display (this file is presentation layer, not
// `project/src/core/` — Mandate A1 does not reach here, but the certified
// core is the single source of truth for the winding arithmetic regardless).
// Pages must load `<script type="module" src="core-shim.js"></script>`
// BEFORE this file (module scripts run before DOMContentLoaded; Babel-
// standalone only transforms/runs text/babel tags on DOMContentLoaded, so
// window.HCRM_CORE is guaranteed present by the time any function below is
// actually invoked).

const HCRM_BASIS = [2, 3, 5, 7, 11, 13, 17, 19];
const ARCSEC_CIRCLE = 1296000;
const ARCSEC_SIGN   = 108000;

// SafeS8 basis product  M_B = ∏ p  = 9,699,690.
// Note M_B > 1,296,000 = the full ecliptic ring in arcseconds, so EVERY
// longitude has a unique residue signature with zero winding: the residue
// tray alone determines the integer. The arcsec line is a boundary
// projection of residue space, exactly as CRAM states.
const M_SAFE8 = HCRM_BASIS.reduce((a, p) => a * p, 1); // 9,699,690

// window.HCRM_CORE accessor. Throws loudly (rather than silently falling
// back to Number arithmetic) when core-shim.js has not run yet — that is a
// page wiring bug, not a state this module should paper over.
function requireCore() {
  if (typeof window === "undefined" || !window.HCRM_CORE) {
    throw new Error(
      "hcrm.jsx requires window.HCRM_CORE — load core-shim.js as a "
      + "type=module script before hcrm.jsx, and serve the page over HTTP "
      + "(ES module imports are blocked on file://).");
  }
  return window.HCRM_CORE;
}

// ── CRAM odometer: residue-native counting with certified winding ──
// Counting by 1 advances every lane mod p; when the full tray returns to the
// zero tray, the winding K increments. For a step s, the certified carry is
//   δ = ⌊(γ̃ + s) / M_B⌋,   γ̃ ← (γ̃ + s) mod M_B,   K ← K + δ.
// The integer x = γ̃ + K·M_B is the boundary projection, not the workspace.
// The reduction itself is window.HCRM_CORE.mod (BigInt); Number in/out only.
function cramStep(gamma, K, step, M = M_SAFE8) {
  const HC = requireCore();
  const g = BigInt(gamma), s = BigInt(step), m = BigInt(M);
  const raw = g + s;
  const newGamma = HC.mod(raw, m);
  const delta = (raw - newGamma) / m;          // exact BigInt division — no Math.floor
  return { gamma: Number(newGamma), K: K + Number(delta), carried: Number(delta) };
}

// ── K-Elimination: recover the winding from residue anchors alone ──
// The shell is the Safe-6 product M6 = 2·3·5·7·11·13 = 30,030. Within one
// ecliptic ring (1,296,000″) the winding K = ⌊a / M6⌋ runs 0..43. The
// problem: recover K from residues WITHOUT reconstructing the integer.
// K-Elim does it per anchor prime A (the gear primes 17, 19):
//   r_M  = a mod M6                       (= CRT of the six shell residues)
//   a_A  = a mod A                        (the anchor residue)
//   K̂_A = (a_A − r_M)·M6⁻¹  (mod A)       (winding digit mod A)
// Two coprime anchors recover K mod 17·19 = 323 by CRT; since K ≤ 43 < 323,
// the recovery is exact. This is the certified-carry certificate: the integer
// line is never formed, yet the winding is proven from the tray.
const SHELL6      = [2, 3, 5, 7, 11, 13];
const M_SHELL6    = 30030;
const GEAR_ANCHORS = [17, 19];

// Quoted from src/core/basis.js: M6_INV_MOD_GEAR = 287 (≡ 30030⁻¹ mod 323).
// 323 = 17·19 and 287·M6 ≡ 1 (mod 323), so by CRT 287 mod 17 ≡ M6⁻¹ mod 17
// and 287 mod 19 ≡ M6⁻¹ mod 19 directly — this REDUCES the core's published
// constant for the worked-certificate display, it does not re-derive it.
const LEGACY_GEAR_INV_MOD = { 17: 287 % 17, 19: 287 % 19 }; // { 17: 15, 19: 2 }

// K-Elimination on the legacy gear split (src/core/shell-kelim.js: shell
// M6 = 30,030 over {2,3,5,7,11,13}, anchor 17·19 = 323). The certified
// recovery — one BigInt subtract + a precomputed-inverse multiply, no
// per-lane inverse search — is window.HCRM_CORE.recoverShellWindingFromGear.
// The per-anchor {17, 19} breakdown below is the worked-certificate DISPLAY:
// it reduces that one certified BigInt result (Khat = Krecovered mod A), it
// never recomputes or verifies K itself by another route.
function kElimWinding(arcsec) {
  const HC = requireCore();
  const a = BigInt(arcsec);
  const rMBig = HC.shellResidue(a);                       // a mod M6, certified
  const KtrueBig = HC.actualLegacyWinding(a);              // a / M6, exact BigInt division
  const KrecoveredBig = HC.recoverShellWindingFromGear(a); // certified K, single anchor 323

  const anchors = GEAR_ANCHORS.map(A => {
    const Abig = BigInt(A);
    const aA = HC.mod(a, Abig);
    const rMmodA = HC.mod(rMBig, Abig);
    const Khat = HC.mod(KrecoveredBig, Abig);
    const KtrueModA = HC.mod(KtrueBig, Abig);
    return {
      A, aA: Number(aA), rMmodA: Number(rMmodA), inv: LEGACY_GEAR_INV_MOD[A],
      Khat: Number(Khat), KtrueModA: Number(KtrueModA), verified: Khat === KtrueModA,
    };
  });

  return {
    rM: Number(rMBig), Ktrue: Number(KtrueBig), anchors,
    Krecovered: Number(KrecoveredBig), recovered: KrecoveredBig === KtrueBig,
    M6: Number(HC.LEGACY_SHELL),
  };
}

// Star-number test (L₋₁ sub-residue structure): f⋆(n) = 6n(n−1)+1.
function isqrtN(n) { if (n < 0) return -1; let x = Math.floor(Math.sqrt(n)); while (x*x > n) x--; while ((x+1)*(x+1) <= n) x++; return x; }
function starIndex(n) {
  if (n < 1) return null;
  const disc = 12 + 24 * n;
  const s = isqrtN(disc);
  if (s * s !== disc) return null;
  if ((6 + s) % 12 !== 0) return null;
  const k = (6 + s) / 12;
  return (6 * k * (k - 1) + 1 === n) ? k : null;
}
function factorizeSmall(n) {
  n = Math.abs(n); if (n <= 1) return [n];
  const f = []; let d = 2;
  while (d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d++; }
  if (n > 1) f.push(n);
  return f;
}

// ── SYNTHETIC quantization step, explicitly labeled ──────────────────
// toArcsec rounds a floating-point synthetic-ephemeris degree (astro.jsx —
// synthetic orbital periods + Date arithmetic, see src/demo/SYNTHETIC_DEMO.js)
// to an integer arcsecond. That rounding makes the result presentation-only:
// it is NOT an exact integer ephemeris fact and must never be shown as one.
// Every call site below wraps its output in a SYNTHETIC_DEMO ledger entry
// (syntheticCertificate) and runs it through window.HCRM_CORE.admitForCore,
// whose sole admission gate refuses SYNTHETIC_DEMO unconditionally
// (src/ledger/import-ledger.js) — the rejection is what the console badges.
function toArcsec(lonDeg) {
  return ((Math.round(lonDeg * 3600) % ARCSEC_CIRCLE) + ARCSEC_CIRCLE) % ARCSEC_CIRCLE;
}

// Wrap a toArcsec() output as a schema-conformant ledger entry
// (src/ledger/ephemeris-ledger-schema.json) certified SYNTHETIC_DEMO, and
// attempt admission through the core's real gate. The core is expected to
// refuse it — that refusal, captured here rather than swallowed, is what the
// console renders as the provenance badge instead of presenting the rounded
// float as exact register data.
function syntheticCertificate(arcsec, bodyName) {
  const HC = requireCore();
  const entry = {
    ledger_version: "hcrm-ephemeris-ledger-v1",
    event_id: `hcrm-synthetic-${bodyName || "chart"}`,
    body: bodyName || "chart",
    longitude_arcsec: String(arcsec),
    source: {
      kind: "synthetic-demo",
      name: "hcrm.jsx toArcsec() — Math.round(lonDeg*3600) quantization of an astro.jsx synthetic longitude",
      checksum: "",
    },
    certificate: {
      status: "SYNTHETIC_DEMO",
      notes: "Rounded from a floating-point synthetic-ephemeris degree; not an exact integer arcsecond ledger fact.",
    },
  };
  try {
    HC.admitForCore(entry);
    // Should be unreachable — SYNTHETIC_DEMO is refused unconditionally by
    // the core's admission gate. Surface it loudly if that ever changes.
    return { entry, admitted: true, rejected: false, message: "demonstration data was accepted by the core's gate — it should always be refused" };
  } catch (e) {
    return { entry, admitted: false, rejected: true, message: e && e.message || String(e) };
  }
}

// reduce an integer through the full 8-prime basis
function residues8(a) {
  return {
    r2:  a % 2,  r3:  a % 3,  r5:  a % 5,  r7:  a % 7,
    r11: a % 11, r13: a % 13, r17: a % 17, r19: a % 19,
  };
}

// ── Operator-class roles per prime (first-ledger; not final) ──
const PRIME_ROLE = {
  2:  "polarity",
  3:  "triadic",
  5:  "organismal",
  7:  "wandering-body",
  11: "shadow witness",
  13: "boundary / re-entry",
  17: "gear-α",
  19: "gear-β",
};

// ── Body-domain ledger ──
// Traditional medical / psychological / social rulerships, treated as
// register-domain assignments rather than meaning labels.
const BODY_LEDGER = {
  Sun:       { organ: "heart, spine, vital fire",        psychic: "will, identity core",        social: "sovereignty, the father", operator: "central register / clock" },
  Moon:      { organ: "stomach, breasts, fluids",        psychic: "instinct, memory buffer",    social: "nurture, the mother",     operator: "state buffer / cache" },
  Mercury:   { organ: "nervous system, lungs, hands",    psychic: "cognition, signal routing",  social: "exchange, messengers",    operator: "router / bus" },
  Venus:     { organ: "kidneys, throat, venous blood",   psychic: "valuation, attraction",      social: "bonds, contracts",        operator: "comparator / weighting" },
  Mars:      { organ: "muscles, blood, adrenals",        psychic: "drive, aggression",          social: "conflict, severance",     operator: "actuator / write-head" },
  Jupiter:   { organ: "liver, arterial blood, growth",   psychic: "expansion, judgement",       social: "law, patronage",          operator: "amplifier / gain" },
  Saturn:    { organ: "bones, skin, teeth, joints",      psychic: "constraint, structure",      social: "authority, time, debt",   operator: "limiter / latch" },
  Uranus:    { organ: "nervous discharge, ankles",       psychic: "discontinuity, insight",     social: "revolt, the collective",  operator: "interrupt / phase-break" },
  Neptune:   { organ: "pineal, lymph, feet",             psychic: "dissolution, longing",       social: "myth, the crowd",         operator: "low-pass filter / blur" },
  Pluto:     { organ: "reproductive, elimination",       psychic: "compulsion, depth",          social: "power, the underworld",   operator: "rewrite / GC" },
  NorthNode: { organ: "—",                               psychic: "growth vector",              social: "route entry",             operator: "route-in marker" },
  SouthNode: { organ: "—",                               psychic: "habitual release",           social: "route exit",              operator: "route-out marker" },
  Chiron:    { organ: "wounds, chronic sites",           psychic: "wound→skill transform",      social: "the healer, the maverick",operator: "error-correction node" },
  Lilith:    { organ: "—",                               psychic: "the refused, the untamed",   social: "exile, taboo",            operator: "masked register" },
};

const SIGN_BODY = [
  "head, face, brain",            // Aries
  "neck, throat, thyroid",        // Taurus
  "arms, lungs, nervous system",  // Gemini
  "chest, breasts, stomach",      // Cancer
  "heart, upper back, spine",     // Leo
  "abdomen, intestines, gut",     // Virgo
  "kidneys, lower back, skin",    // Libra
  "reproductive, pelvis, colon",  // Scorpio
  "hips, thighs, liver",          // Sagittarius
  "knees, bones, joints",         // Capricorn
  "ankles, circulation, calves",  // Aquarius
  "feet, lymph, pineal",          // Pisces
];

// Gear class per HCRM spec:
//   G-zero: r17=0 and r19=0       (exact gear closure)
//   G-pre:  r17=16 and r19=18     (pre / re-entry edge of both gear primes)
//   G-low:  exploratory only — both residues ≤ 1 but not exact (null-rate flagged)
function gearClass(res) {
  if (res.r17 === 0 && res.r19 === 0) return "G-zero";
  if (res.r17 === 16 && res.r19 === 18) return "G-pre";
  if (res.r17 <= 1 && res.r19 <= 1) return "G-low";
  return null;
}

// Operator class for a body from its register signature.
// shadow-closure (r11==0) => witness/active-lane operator
// boundary (r13 small or large) => re-entry operator
// gear coherence (r17,r19 both low) => deep-coupling operator
function operatorClass(res) {
  const tags = [];
  if (res.r11 === 0) tags.push("Σ-witness");        // shadow closure
  if (res.r13 === 0 || res.r13 === 12) tags.push("∂-boundary"); // boundary / re-entry
  if (res.r2 === 0) tags.push("even/pole");
  if (res.r3 === 0) tags.push("triad-node");
  if (res.r5 === 0) tags.push("organism-node");
  if (res.r7 === 0) tags.push("week-node");
  if (res.r17 <= 1 && res.r19 <= 1) tags.push("gear-lock");
  return tags.length ? tags.join(" · ") : "free register";
}
// Build a register row for one body.
function registerRow(body) {
  const a = toArcsec(body.lon);
  const res = residues8(a);
  const signIdx = Math.floor(a / ARCSEC_SIGN);
  const signDegArcsec = a % ARCSEC_SIGN;
  const led = BODY_LEDGER[body.name] || {};
  // CRAM state: the residue tray is primary; the arcsec value is its
  // boundary projection. γ̃ is the CRT reconstruction over the parked shell
  // {2,3,5,7,13,17,19} = 881,790, and K is recovered from the shadow lane 11
  // alone by genuine K-Elimination — window.HCRM_CORE.shellIdentity /
  // verifyShellWinding (src/core/shell-kelim.js), BigInt, certified. The
  // boundary projection val = γ̃ + K·shell is formed here only for cosmetic
  // display (hcrm.jsx is not under src/core); roundtrip compares BigInt.
  const HC = requireCore();
  const aBig = BigInt(a);
  const identity = HC.shellIdentity(aBig);            // { r, K, shell, anchor }
  const verify = HC.verifyShellWinding(aBig);          // { recovered, actual, ok, ... }
  const valBig = identity.r + identity.K * identity.shell;
  const gamma = Number(identity.r);           // γ̃_B(r)
  const K = Number(identity.K);               // winding (0 or 1 within one ring)
  const val = Number(valBig);                 // Val_B(S)
  const roundtrip = verify.ok && valBig === aBig; // Fixed-Basis Identity check
  // shadow anchor family residues {11, 13, 17, 19}
  const shadowFamily = { r11: res.r11, r13: res.r13, r17: res.r17, r19: res.r19 };
  // Provenance certificate for the synthetic quantization above (toArcsec):
  // wrapped as a SYNTHETIC_DEMO ledger entry and refused by admitForCore —
  // the console badges this instead of presenting `a` as exact register data.
  const synthetic = syntheticCertificate(a, body.name);

  // ── Heterogeneous lane-wise carry propagation (not bound to the discrete) ──
  // The body moves continuously at `speed` (deg/day → arcsec/day). Each lane p
  // wraps mod p every p arcseconds of motion, so each lane carries at its OWN
  // rate, unsynchronised, driven by real (continuous) motion rather than a
  // discrete tick. We record, per lane: phase r_p/p, carries-per-day, and the
  // time (days) to the next carry event in the direction of motion.
  const speedArcsecDay = (body.speed || 0) * 3600;     // signed
  const dir = speedArcsecDay >= 0 ? 1 : -1;
  const absV = Math.abs(speedArcsecDay);
  const carry = {};
  for (const p of HCRM_BASIS) {
    const rp = res["r" + p];
    const carriesPerDay = absV / p;                    // heterogeneous per lane
    // distance (arcsec) to next wrap in motion direction
    const distToWrap = dir >= 0 ? (p - rp) : (rp === 0 ? p : rp);
    const daysToCarry = absV > 0 ? distToWrap / absV : Infinity;
    carry[p] = {
      residue: rp,
      phase: rp / p,
      carriesPerDay,
      carriesPerYear: carriesPerDay * 365.25,
      daysToCarry,
      dir,
    };
  }
  return {
    bodyId: body.name,
    glyph: body.glyph,
    arcsec: a,
    deg: a / 3600,
    signIdx,
    signName: ZODIAC[signIdx] ? ZODIAC[signIdx].name : "—",
    signDegArcsec,
    signDeg: signDegArcsec / 3600,
    house: body.house,
    motion: body.retrograde ? "retrograde (return/inversion)" : "direct",
    retrograde: !!body.retrograde,
    dignity: body.dignity ? body.dignity.kind : "—",
    dignityScore: body.dignity ? body.dignity.score : 0,
    res,
    gamma, winding: K, val, roundtrip, shadowFamily, carry,
    shell: Number(identity.shell), anchor: Number(identity.anchor),
    synthetic,
    speedArcsecDay,
    kElim: kElimWinding(a),
    starIdx: starIndex(a % M_SHELL6),
    laneFactors: SHELL6.map(p => ({ p, r: a % p, factors: factorizeSmall(a % p), star: starIndex(a % p) })),
    organ: led.organ || (SIGN_BODY[signIdx] || "—"),
    signBody: SIGN_BODY[signIdx] || "—",
    psychic: led.psychic || "—",
    social: led.social || "—",
    operatorDomain: led.operator || "—",
    operatorClass: operatorClass(res),
    shadowHit: res.r11 === 0,
    gearClass: gearClass(res),
    validEcliptic: a < ARCSEC_CIRCLE,
    // boundary states are distinct: r13=0 is closure, r13=12 is pre/re-entry edge
    b13State: res.r13 === 0 ? "zero" : (res.r13 === 12 ? "pre" : null),
    boundaryHit: res.r13 === 0 || res.r13 === 12,
    gearLock: gearClass(res) !== null,
    gearExact: res.r17 === 0 && res.r19 === 0,
    // class-tagged body events with proof
    bodyEvents: bodyEvents(body.name, res),
  };
}

// Build the typed, proof-carrying visual events for a body register.
function bodyEvents(name, res) {
  const ev = [];
  if (res.r11 === 0)
    ev.push({ eventClass: "SH-body", trigger: "r11 = 0", body: name, prime: 11, value: 0, scope: "body", proofStatus: "computed" });
  if (res.r13 === 0)
    ev.push({ eventClass: "B13-zero", trigger: "r13 = 0 (closure)", body: name, prime: 13, value: 0, scope: "body", proofStatus: "computed" });
  if (res.r13 === 12)
    ev.push({ eventClass: "B13-pre", trigger: "r13 = 12 (pre / re-entry)", body: name, prime: 13, value: 12, scope: "body", proofStatus: "computed" });
  if (res.r17 <= 1 && res.r19 <= 1)
    ev.push({ eventClass: "G-body", trigger: `r17=${res.r17}, r19=${res.r19} gear-lock`, body: name, prime: "17·19", value: `${res.r17},${res.r19}`, scope: "body", proofStatus: "computed" });
  return ev;
}

// Aspect-edge residue preservation:
// an edge "preserves" a lane p when (r_p(A) == r_p(B)) — the two registers
// share an address in that prime. We flag which lanes are preserved across
// each classical aspect edge, with special attention to the shadow lane 11.
const HCRM_ASPECTS = [
  { name: "Conjunction", angle: 0,   orb: 8 },
  { name: "Opposition",  angle: 180, orb: 8 },
  { name: "Trine",       angle: 120, orb: 7 },
  { name: "Square",      angle: 90,  orb: 7 },
  { name: "Sextile",     angle: 60,  orb: 5 },
];

function hcrmAngle(deltaDeg) {
  const d = Math.abs(((deltaDeg + 180) % 360) - 180);
  for (const a of HCRM_ASPECTS) {
    if (Math.abs(d - a.angle) <= a.orb) return { ...a, sep: Math.abs(d - a.angle) };
  }
  return null;
}

function edgeResiduePreservation(rA, rB) {
  const lanes = {};
  let count = 0;
  for (const p of HCRM_BASIS) {
    const key = "r" + p;
    const same = rA[key] === rB[key];
    lanes[p] = same;
    if (same) count++;
  }
  return { lanes, count, shadowPreserved: lanes[11], boundaryPreserved: lanes[13], gearPreserved: lanes[17] && lanes[19] };
}

function buildEdges(rows) {
  const edges = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i], B = rows[j];
      const delta = ((A.deg - B.deg) % 360 + 360) % 360;
      const asp = hcrmAngle(delta);
      if (!asp) continue;
      const pres = edgeResiduePreservation(A.res, B.res);
      edges.push({
        a: A.bodyId, b: B.bodyId, aGlyph: A.glyph, bGlyph: B.glyph,
        aspect: asp.name, angle: asp.angle, orb: asp.sep,
        ...pres,
        edgeEvents: edgeEvents(A.bodyId, B.bodyId, pres),
      });
    }
  }
  // tightest / most-preserving first
  edges.sort((x, y) => (y.count - x.count) || (x.orb - y.orb));
  return edges;
}

// Typed, proof-carrying events for an aspect edge.
function edgeEvents(a, b, pres) {
  const ev = [];
  const edge = `${a}-${b}`;
  if (pres.shadowPreserved)
    ev.push({ eventClass: "SH-edge", trigger: "shared r11 residue", edge, prime: 11, scope: "aspect-edge", proofStatus: "computed" });
  if (pres.boundaryPreserved)
    ev.push({ eventClass: "B13-edge", trigger: "shared r13 residue", edge, prime: 13, scope: "aspect-edge", proofStatus: "computed" });
  if (pres.gearPreserved)
    ev.push({ eventClass: "G-edge", trigger: "shared r17 and r19", edge, prime: "17·19", scope: "aspect-edge", proofStatus: "computed" });
  return ev;
}

// House clustering of shadow hits — which domain lanes hold the strongest
// shadow concentration.
function shadowClusters(rows) {
  const byHouse = {};
  for (const r of rows) {
    if (!r.shadowHit) continue;
    byHouse[r.house] = byHouse[r.house] || [];
    byHouse[r.house].push(r.bodyId);
  }
  return Object.entries(byHouse)
    .map(([h, bodies]) => ({ house: Number(h), bodies }))
    .sort((a, b) => b.bodies.length - a.bodies.length);
}

// Whole-chart operator signature — the multiset of residues, summarised so
// it can be searched against codex operator zones.
function chartSignature(rows) {
  const sig = {};
  for (const p of HCRM_BASIS) {
    const key = "r" + p;
    const counts = {};
    for (const r of rows) counts[r.res[key]] = (counts[r.res[key]] || 0) + 1;
    sig[p] = counts;
  }
  // gear-pair trajectory: the (r17, r19) points across bodies
  const gearPoints = rows.map(r => ({ body: r.bodyId, r17: r.res.r17, r19: r.res.r19 }));
  return { sig, gearPoints };
}

function computeHCRM(chart) {
  const rows = chart.planets.map(registerRow);
  const edges = buildEdges(rows);
  const clusters = shadowClusters(rows);
  const signature = chartSignature(rows);
  // angle registers — Asc & MC as addresses too
  const angles = [
    { bodyId: "ASC", glyph: "Asc", lon: chart.asc },
    { bodyId: "MC",  glyph: "MC",  lon: chart.mc  },
  ].map(x => {
    const a = toArcsec(x.lon);
    return {
      bodyId: x.bodyId, glyph: x.glyph, arcsec: a, deg: a / 3600,
      signIdx: Math.floor(a / ARCSEC_SIGN),
      signName: ZODIAC[Math.floor(a / ARCSEC_SIGN)].name,
      res: residues8(a),
      operatorClass: operatorClass(residues8(a)),
      shadowHit: residues8(a).r11 === 0,
    };
  });
  // Chart-level provenance badge: every row carries an identical certificate
  // shape (SYNTHETIC_DEMO is refused unconditionally, regardless of body),
  // so the first row's is representative; fall back to a fresh certificate
  // when the chart has no bodies at all.
  const synthetic = rows.length ? rows[0].synthetic : syntheticCertificate(0, "chart");
  return {
    chart, rows, edges, clusters, signature, angles,
    basis: HCRM_BASIS,
    mSafe8: M_SAFE8,
    // parked-shell CRT split actually used for per-row gamma/K/val (see
    // registerRow) — distinct from mSafe8, which is the odometer's own
    // full-basis modulus and is unrelated to this per-row identity check.
    mShell: rows.length ? rows[0].shell : null,
    parkAnchor: rows.length ? rows[0].anchor : null,
    synthetic,
    cramVerified: rows.every(r => r.roundtrip),
    kElimVerified: rows.every(r => r.kElim.recovered),
    // distinct body-level and edge-level counters — never collapse them
    counts: {
      shBody:   rows.filter(r => r.shadowHit).length,
      shEdge:   edges.filter(e => e.shadowPreserved).length,
      b13pre:   rows.filter(r => r.b13State === "pre").length,
      b13zero:  rows.filter(r => r.b13State === "zero").length,
      b13edge:  edges.filter(e => e.boundaryPreserved).length,
      gBody:    rows.filter(r => r.gearLock).length,
      gZero:    rows.filter(r => r.gearClass === "G-zero").length,
      gPre:     rows.filter(r => r.gearClass === "G-pre").length,
      gLow:     rows.filter(r => r.gearClass === "G-low").length,
      gEdge:    edges.filter(e => e.gearPreserved).length,
      edges:    edges.length,
    },
    shadowCount: rows.filter(r => r.shadowHit).length,
    boundaryCount: rows.filter(r => r.boundaryHit).length,
    gearLockCount: rows.filter(r => r.gearLock).length,
  };
}

Object.assign(window, {
  HCRM_BASIS, ARCSEC_CIRCLE, ARCSEC_SIGN, M_SAFE8, PRIME_ROLE, BODY_LEDGER, SIGN_BODY,
  toArcsec, syntheticCertificate, residues8, cramStep,
  SHELL6, M_SHELL6, GEAR_ANCHORS, kElimWinding, starIndex, factorizeSmall, gearClass,
  operatorClass, registerRow, edgeResiduePreservation,
  buildEdges, shadowClusters, chartSignature, computeHCRM,
});
