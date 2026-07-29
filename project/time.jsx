// time.jsx — Cylindrical Time Model substrate.
//
// The natal chart is a single point (z₀, θ₀) on the cylinder ℝ × S¹.
// This module promotes the engine from snapshot to running environment:
//
//   z  ←  linear coordinate (Maya Long Count, days since JD 584283)
//   θ  ←  cyclic coordinate (Tzolk'in × Haab, TCO master phase)
//
// We compute, for the user's NOW:
//   - Maya Long Count (baktun.katun.tun.winal.kin)
//   - Tzolk'in day-sign + number  (260-day sacred)
//   - Haab day + month            (365-day vague solar year)
//   - Calendar Round position     (Tzolk'in × Haab = 18,980 days ≈ 52y)
//   - TCO master phase P_n        (P_{n+1} = (P_n + Δ) mod M)
//   - Current transiting planets and their tight aspects to the natal
//     bodies (the "live" reading layer)
//   - Secondary progressions      (1 day after birth = 1 year of life)
//   - Phase syndrome S_ij         (the gauge-invariant time relation)

const MAYA_EPOCH_JD = 584283;   // GMT correlation. Kin 0 = 4 Ahau 8 Kumk'u.

const TZOLKIN_SIGNS = [
  "Imix","Ik","Akbal","Kan","Chicchan","Cimi","Manik","Lamat","Muluc","Oc",
  "Chuen","Eb","Ben","Ix","Men","Cib","Caban","Etznab","Cauac","Ahau",
];

const HAAB_MONTHS = [
  "Pop","Wo","Sip","Sotz","Sek","Xul","Yaxkin","Mol","Chen","Yax",
  "Sak","Keh","Mak","Kankin","Muwan","Pax","Kayab","Kumku","Wayeb",
];

const __mod = (n, d) => ((n % d) + d) % d;

// ─────────────────── Maya Long Count ───────────────────
function mayaLongCount(jd) {
  const kin = Math.floor(jd - MAYA_EPOCH_JD);
  const baktun = Math.floor(kin / 144000);
  const r1     = __mod(kin, 144000);
  const katun  = Math.floor(r1 / 7200);
  const r2     = r1 % 7200;
  const tun    = Math.floor(r2 / 360);
  const r3     = r2 % 360;
  const winal  = Math.floor(r3 / 20);
  const kinDay = r3 % 20;
  return {
    kin,
    baktun, katun, tun, winal, kinDay,
    formatted: `${baktun}.${katun}.${tun}.${winal}.${kinDay}`,
  };
}

// ─────────────────── Tzolk'in (260-day) ───────────────────
// Kin 0 (Maya epoch) = 4 Ahau. Ahau is sign index 19, number 4.
function tzolkin(jd) {
  const kin = Math.floor(jd - MAYA_EPOCH_JD);
  const signIdx = __mod(kin + 19, 20);
  const number  = __mod(kin + 3, 13) + 1;
  return {
    sign: TZOLKIN_SIGNS[signIdx],
    signIdx,
    number,
    position: __mod(kin, 260),       // 0..259, full sacred-round position
  };
}

// ─────────────────── Haab (365-day) ───────────────────
// Kin 0 = 8 Kumk'u. Kumk'u is month index 17, day 8 → offset 17*20+8 = 348.
function haab(jd) {
  const kin = Math.floor(jd - MAYA_EPOCH_JD);
  const haabDay = __mod(kin + 348, 365);  // 0..364
  let monthIdx, day;
  if (haabDay >= 360) { monthIdx = 18; day = haabDay - 360; }  // Wayeb (5 days)
  else                { monthIdx = Math.floor(haabDay / 20); day = haabDay % 20; }
  return {
    month: HAAB_MONTHS[monthIdx],
    monthIdx,
    day,
    position: haabDay,
  };
}

// Calendar Round position — 0..18979 (lcm 260, 365)
function calendarRound(jd) {
  const kin = Math.floor(jd - MAYA_EPOCH_JD);
  return __mod(kin, 18980);
}

// ─────────────────── TCO master phase ───────────────────
// P_{n+1} = (P_n + Δ) mod M. Returns the current phase at time jd.
// Default: M = 30030 (Mayan Safe Basis product), Δ = 1, n = kin.
function tcoPhase(jd, M = 30030, delta = 1) {
  const kin = Math.floor(jd - MAYA_EPOCH_JD);
  const P = __mod(kin * delta, M);
  return {
    P,
    M,
    delta,
    theta: 2 * Math.PI * (P / M),      // radians on S¹
    thetaDeg: 360 * (P / M),           // degrees
  };
}

// Period of the TCO orbit: M / gcd(M, Δ)
function tcoPeriod(M = 30030, delta = 1) {
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  return M / gcd(M, delta);
}

// ─────────────────── Phase syndrome ───────────────────
// S_ij = θ_i − θ_j (mod 2π). Gauge-invariant relational simultaneity.
function phaseSyndrome(theta_i, theta_j) {
  const d = (theta_i - theta_j) % (2 * Math.PI);
  return d < 0 ? d + 2 * Math.PI : d;
}

// ─────────────────── Live state from the cylinder ───────────────────
//
// At a given "now" instant, returns the user's running cylindrical position:
//   - linear z: Maya Long Count (kin since the epoch)
//   - cyclic θ: TCO master phase
//   - calendar interpretation: Tzolk'in × Haab × Calendar Round
//   - elapsed time since birth (age in years, kin)
//   - phase syndrome S between birth phase and current phase
function ctmState(jd, natalJd) {
  const lc       = mayaLongCount(jd);
  const tz       = tzolkin(jd);
  const ha       = haab(jd);
  const cr       = calendarRound(jd);
  const tco      = tcoPhase(jd);
  const tcoNatal = tcoPhase(natalJd);
  const syn      = phaseSyndrome(tco.theta, tcoNatal.theta);
  const ageDays  = jd - natalJd;
  const ageYears = ageDays / 365.25;
  return {
    jd, natalJd,
    longCount: lc,
    tzolkin:   tz,
    haab:      ha,
    calendarRound: cr,
    tco,
    tcoNatal,
    syndrome:  syn,
    syndromeDeg: syn * 180 / Math.PI,
    ageDays,
    ageYears,
  };
}

// ─────────────────── Current transits ───────────────────
//
// For each natal body, locate the current transiting body's longitude and
// any tight (≤ 2°) aspect. This is the "live" overlay on the natal chart.
function currentTransits(natal, jdNow) {
  const transBodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];
  const trans = transBodies.map(name => {
    const lon = planetLongitude(name, jdNow);
    return {
      name,
      glyph: PLANET_GLYPH[name],
      lon,
      sign: Math.floor(lon / 30),
      retrograde: isRetrograde(name, jdNow),
      speed: planetSpeed(name),
    };
  });

  const hits = [];
  const natalBodies = natal.planets.filter(p => transBodies.includes(p.name));
  for (const T of trans) {
    for (const N of natalBodies) {
      const delta = mod360(T.lon - N.lon);
      const asp = nearestAspect(delta);
      if (!asp || asp.sep > 2.0) continue;
      // Treat natal as stationary; transit body is the faster element
      const phase = applyingPhase(T.lon, N.lon, T.speed, 0, asp.angle);
      hits.push({
        T: T.name, N: N.name,
        Tglyph: T.glyph, Nglyph: N.glyph,
        aspect: asp.name,
        orb: asp.sep,
        family: asp.family,
        phase,
        retrograde: T.retrograde,
      });
    }
  }
  hits.sort((a, b) => a.orb - b.orb);
  return { trans, hits };
}

// ─────────────────── Secondary progressions ───────────────────
//
// "A day for a year." The progressed chart at age N years is the natal
// chart cast N days after birth. Useful for inner-planet movement.
function progressedAt(natalJd, ageYears) {
  const progressedJd = natalJd + ageYears;
  const bodies = ["Sun","Moon","Mercury","Venus","Mars"].map(name => {
    const lon = planetLongitude(name, progressedJd);
    return {
      name,
      glyph: PLANET_GLYPH[name],
      lon,
      sign: Math.floor(lon / 30),
      signName: ZODIAC[Math.floor(lon / 30)].name,
    };
  });
  return { progressedJd, bodies };
}

// Expose
isRetrograde; // silence linter: relies on astro.jsx globals
Object.assign(window, {
  MAYA_EPOCH_JD,
  TZOLKIN_SIGNS, HAAB_MONTHS,
  mayaLongCount, tzolkin, haab, calendarRound,
  tcoPhase, tcoPeriod, phaseSyndrome,
  ctmState, currentTransits, progressedAt,
});
