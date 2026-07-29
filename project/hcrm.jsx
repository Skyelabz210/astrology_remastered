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

const HCRM_BASIS = [2, 3, 5, 7, 11, 13, 17, 19];
const ARCSEC_CIRCLE = 1296000;
const ARCSEC_SIGN   = 108000;

// SafeS8 basis product  M_B = ∏ p  = 9,699,690.
// Note M_B > 1,296,000 = the full ecliptic ring in arcseconds, so EVERY
// longitude has a unique residue signature with zero winding: the residue
// tray alone determines the integer. The arcsec line is a boundary
// projection of residue space, exactly as CRAM states.
const M_SAFE8 = HCRM_BASIS.reduce((a, p) => a * p, 1); // 9,699,690

// modular inverse of a mod p (extended Euclid; p prime, a not ≡ 0)
function modInverse(a, p) {
  a = ((a % p) + p) % p;
  let [old_r, r] = [a, p];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % p) + p) % p;
}

// CRT reconstruction γ̃_B(r): canonical representative in [0, M_B) from the
// residue tray. This is the Fixed-Basis Identity map Φ_B inverse, value side.
function crtReconstruct(res, basis = HCRM_BASIS, M = M_SAFE8) {
  let x = 0;
  for (const p of basis) {
    const Mi = M / p;                       // ∏ of the other primes
    const inv = modInverse(Mi % p, p);      // (Mi)^-1 mod p
    const idem = (Mi % M) * inv % M;        // CRT idempotent e_i
    x = (x + (res["r" + p] % p) * idem) % M;
  }
  return ((x % M) + M) % M;
}

// Full CRAM value projection Val_B(S) = γ̃_B(r) + K·M_B
function cramValue(res, K = 0, basis = HCRM_BASIS, M = M_SAFE8) {
  return crtReconstruct(res, basis, M) + K * M;
}

// ── CRAM odometer: residue-native counting with certified winding ──
// Counting by 1 advances every lane mod p; when the full tray returns to the
// zero tray, the winding K increments. For a step s, the certified carry is
//   δ = ⌊(γ̃ + s) / M_B⌋,   γ̃ ← (γ̃ + s) mod M_B,   K ← K + δ.
// The integer x = γ̃ + K·M_B is the boundary projection, not the workspace.
function cramStep(gamma, K, step, M = M_SAFE8) {
  const raw = gamma + step;
  const delta = Math.floor(raw / M);          // certified product-block carry
  const newGamma = ((raw % M) + M) % M;
  return { gamma: newGamma, K: K + delta, carried: delta };
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

function crtPair(r1, m1, r2, m2) {
  const M = m1 * m2;
  const inv = modInverse(m1 % m2, m2);
  const k = (((r2 - r1) % m2) + m2) % m2 * inv % m2;
  return ((r1 + m1 * k) % M + M) % M;
}

function kElimWinding(arcsec) {
  const a = arcsec;
  const rM = a % M_SHELL6;                 // canonical shell residue
  const Ktrue = Math.floor(a / M_SHELL6);  // ground-truth winding (for checking)
  const anchors = GEAR_ANCHORS.map(A => {
    const aA = a % A;
    const inv = modInverse(M_SHELL6 % A, A);
    const Khat = ((((aA - rM) % A) + A) % A) * inv % A;
    const KtrueModA = Ktrue % A;
    return { A, aA, rMmodA: rM % A, inv, Khat, KtrueModA, verified: Khat === KtrueModA };
  });
  const Krecovered = crtPair(anchors[0].Khat, GEAR_ANCHORS[0], anchors[1].Khat, GEAR_ANCHORS[1]);
  return { rM, Ktrue, anchors, Krecovered, recovered: Krecovered === Ktrue, M6: M_SHELL6 };
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

// integer arcsecond longitude from a degree float
function toArcsec(lonDeg) {
  return ((Math.round(lonDeg * 3600) % ARCSEC_CIRCLE) + ARCSEC_CIRCLE) % ARCSEC_CIRCLE;
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
  // boundary projection. Winding K = ⌊a / M_B⌋ = 0 here (a < M_B), so the
  // tray reconstructs the longitude exactly — drift-free identity.
  const gamma = crtReconstruct(res);          // γ̃_B(r)
  const K = Math.floor(a / M_SAFE8);          // winding (0 within one ring)
  const val = gamma + K * M_SAFE8;            // Val_B(S)
  const roundtrip = val === a;                // Fixed-Basis Identity check
  // shadow anchor family residues {11, 13, 17, 19}
  const shadowFamily = { r11: res.r11, r13: res.r13, r17: res.r17, r19: res.r19 };

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
  return {
    chart, rows, edges, clusters, signature, angles,
    basis: HCRM_BASIS,
    mSafe8: M_SAFE8,
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
  toArcsec, residues8, modInverse, crtReconstruct, cramValue, cramStep,
  SHELL6, M_SHELL6, GEAR_ANCHORS, crtPair, kElimWinding, starIndex, factorizeSmall, gearClass,
  operatorClass, registerRow, edgeResiduePreservation,
  buildEdges, shadowClusters, chartSignature, computeHCRM,
});
