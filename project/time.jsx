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

// A digest over progressedAt, matching lifecycleDigest's register: the
// same facts the progressions table already shows, read as prose. Two
// things a raw longitude table doesn't say plainly — which body (if any)
// has actually changed sign since birth, and what phase relationship the
// progressed Sun and Moon now stand in (the same lunarPhase arithmetic
// the birth chart itself carries, run forward at the progressed rate,
// classically read as a life-phase marker over roughly a 29.5-YEAR
// cycle, since the Moon's ~29.5-day synodic period is what "one day per
// year" stretches into years). No frequency or rarity is asserted for
// either fact — unlike the shadow-lane sentence's measured "about half
// of all moments," this file has not measured how often a given body's
// progressed sign changes across a lifetime, so it states what happened,
// not how often it happens.
function progressionsDigest(natal, jdTarget) {
  const ageYears = (jdTarget - natal.jd) / 365.25;
  const prog = progressedAt(natal.jd, ageYears);
  const lines = [];

  const progMoon = prog.bodies.find((b) => b.name === "Moon");
  if (progMoon) {
    lines.push(
      `By secondary progression — one day of ephemeris motion standing for each year lived — the Moon has reached ${progMoon.signName}.`
    );
  }

  const changed = prog.bodies.filter((b) => {
    if (b.name === "Moon") return false;
    const natalP = natal.planets.find((p) => p.name === b.name);
    return natalP && b.sign !== natalP.sign;
  });
  for (const b of changed) {
    const natalP = natal.planets.find((p) => p.name === b.name);
    lines.push(`Since birth, the progressed ${b.name} has moved from ${ZODIAC[natalP.sign].name} into ${b.signName}.`);
  }

  const progSun = prog.bodies.find((b) => b.name === "Sun");
  if (progSun && progMoon && typeof lunarPhase === "function") {
    const phase = lunarPhase(progSun.lon, progMoon.lon);
    lines.push(
      `The progressed Sun and Moon stand in a ${phase.phase.toLowerCase()} relationship — the same lunar-phase arithmetic the birth chart itself carries, run forward at the progressed rate.`
    );
  }

  return { ageYears, progressedJd: prog.progressedJd, lines };
}

// ─────────────────── The winding lift ───────────────────
//
// Address any point in the chart's lifecycle. For each body, two numbers
// name its state at the target instant relative to birth:
//
//   K       — the winding count: completed circuits of the zodiac since
//             birth, by the body's own period. Negative before birth —
//             earlier states stay addressable the same way.
//   lane 11 — the shadow-lane residue (arcsec mod 11) of the body's
//             position at the target, beside its natal lane.
//
// Residue and winding together name the full path: the residue recovers
// the state inside one circuit, K counts the circuits — the same shape as
// the register's K-Elimination, applied to the chart's own history. When
// a body's target lane equals its natal lane, that is a shadow-lane
// return: a recurrence classical transit reading has no name for.
function windingLift(natal, jdTarget) {
  const bodies = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
  const ageDays = jdTarget - natal.jd;
  const rows = bodies.map(name => {
    const natalP = natal.planets.find(p => p.name === name);
    const lon = planetLongitude(name, jdTarget);
    const lane11 = Math.floor(lon * 3600) % 11;
    const natalLane = natalP && natalP.residues
      ? natalP.residues.r11
      : Math.floor((natalP ? natalP.lon : 0) * 3600) % 11;
    const periodDays = PLANET_PERIODS[name] * 365.25;
    // `|| 0` folds Math.trunc's negative zero (a target minutes before
    // birth) into plain zero, so no row ever prints "-0 circuits".
    const K = Math.trunc(ageDays / periodDays) || 0;
    return {
      name,
      glyph: PLANET_GLYPH[name],
      lon,
      sign: Math.floor(lon / 30),
      K,
      lane11,
      natalLane,
      isReturn: lane11 === natalLane,
    };
  });
  return {
    jdTarget,
    ageDays,
    ageYears: ageDays / 365.25,
    rows,
    returns: rows.filter(r => r.isReturn).map(r => r.name),
  };
}

// ─────────────────── Perfections ───────────────────
//
// The exact instants — not the days, the instants — when the slow sky
// strikes the natal chart, inside a window around a target moment of the
// lifecycle. This is the classical transit report made precise: each hit
// is found by scanning the real ephemeris on a coarse grid and then
// bisecting the crossing down to sub-second resolution, so the date the
// reader sees is when the aspect actually perfects, not "sometime that
// week". Retrograde loops fall out for free: a body that crosses, backs
// over, and re-crosses a natal point reports all three perfections.
//
// Transiting bodies are the slow movers (Mars outward) — the fast bodies
// perfect aspects several times a day and belong to a clock, not a
// lifecycle. Natal points are the ten classical bodies plus the angles
// when the birth time is known.
const PERFECTION_TRANSITERS = ["Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
const PERFECTION_ASPECTS = [
  { name: "Conjunction", angle: 0,   targets: [0] },
  { name: "Sextile",     angle: 60,  targets: [60, -60] },
  { name: "Square",      angle: 90,  targets: [90, -90] },
  { name: "Trine",       angle: 120, targets: [120, -120] },
  { name: "Opposition",  angle: 180, targets: [180] },
];

function __wrap180(x) {
  const m = ((x % 360) + 360) % 360;
  return m > 180 ? m - 360 : m;
}

function transitPerfections(natal, jdCenter, spanDays = 366, bodies = PERFECTION_TRANSITERS) {
  const half = spanDays / 2;
  const jd0 = jdCenter - half, jd1 = jdCenter + half;
  const STEP = 2; // days — Mars at ~0.8°/day moves ≤1.6°/step, no crossing can hide

  const natalPoints = natal.planets
    .filter((p) => PERFECTION_TRANSITERS.includes(p.name) ||
                   ["Sun","Moon","Mercury","Venus"].includes(p.name))
    .map((p) => ({ name: p.name, glyph: p.glyph, lon: p.lon }));
  if (!natal.timeUnknown && Number.isFinite(natal.asc)) {
    natalPoints.push({ name: "Ascendant", glyph: "Asc", lon: natal.asc });
    natalPoints.push({ name: "Midheaven", glyph: "MC", lon: natal.mc });
  }

  const hits = [];
  for (const T of bodies) {
    // one longitude grid per transiting body, shared by every natal point
    const grid = [];
    for (let jd = jd0; jd <= jd1 + 1e-9; jd += STEP) grid.push({ jd, lon: planetLongitude(T, jd) });

    for (const N of natalPoints) {
      // A body aspecting its OWN natal place stays in: the conjunction to
      // it is exactly the return chart (Saturn return, Jupiter return).
      for (const asp of PERFECTION_ASPECTS) {
        for (const v of asp.targets) {
          const h = (lon) => __wrap180(lon - N.lon - v);
          for (let i = 1; i < grid.length; i++) {
            const h0 = h(grid[i - 1].lon), h1 = h(grid[i].lon);
            // a genuine crossing changes sign WITHOUT wrapping the ±180 cut
            if (h0 === 0 || h0 * h1 >= 0 || Math.abs(h1 - h0) > 180) continue;
            let lo = grid[i - 1].jd, hi = grid[i].jd;
            let hLo = h0;
            for (let k = 0; k < 40; k++) {
              const mid = (lo + hi) / 2;
              const hm = h(planetLongitude(T, mid));
              if ((hLo < 0) === (hm < 0)) { lo = mid; hLo = hm; } else { hi = mid; }
            }
            const jdHit = (lo + hi) / 2;
            hits.push({
              jd: jdHit,
              dateISO: new Date((jdHit - 2440587.5) * 86400000).toISOString(),
              transit: T,
              transitGlyph: PLANET_GLYPH[T],
              natal: N.name,
              natalGlyph: N.glyph,
              aspect: asp.name,
              angle: asp.angle,
              retrograde: isRetrograde(T, jdHit),
              daysFromCenter: jdHit - jdCenter,
            });
          }
        }
      }
    }
  }
  hits.sort((a, b) => a.jd - b.jd);
  return { jdCenter, spanDays, hits };
}

// ─────────────────── Return charts ───────────────────
//
// The classical technique this app's whole lifecycle apparatus has been
// building toward: a body returns to its exact natal degree, and the sky
// at that instant is cast as a FULL chart in its own right — not a
// comparison table, an image. Solar returns (~once a year) and lunar
// returns (~once a month) are the two bodies this is classically done
// for, because neither is ever retrograde: the longitude climbs
// monotonically through the natal degree exactly once per period, so
// there is never more than one return to find per cycle.
//
// Every return chart carries a K — which numbered return this is, e.g.
// "Solar Return #45" — the same idea windingLift already counts (circuits
// since birth by the body's own period), but rounded to the nearest whole
// return rather than truncated to whole periods elapsed by an arbitrary
// moment: the two agree almost everywhere and can differ by exactly 1 in
// the day or two around a return, because trunc(x) and round(x) of the
// same real number never differ by more than that. Successive return
// charts, strung together over a lifetime, are the "evolving image" this
// apparatus was built to produce: the natal chart is one instant; the
// returns are the same subject, sampled once a cycle, forever.
const RETURN_BODIES = ["Sun", "Moon"];

/** Every crossing of `body`'s natal longitude inside [jd0, jd1]. Assumes
 *  `body` is never retrograde (true for Sun and Moon) — the crossing is
 *  then guaranteed unique per period, so a coarse grid + bisection is
 *  exact and cannot double-count a retrograde loop the way a planet scan
 *  would have to guard against. */
function __bodyReturnsInWindow(natal, body, jd0, jd1) {
  const natalLon = natal.planets.find((p) => p.name === body).lon;
  const periodDays = PLANET_PERIODS[body] * 365.25;
  const STEP = periodDays / 30; // ~12° of travel per step for both Sun and Moon
  const h = (jd) => __wrap180(planetLongitude(body, jd) - natalLon);

  const hits = [];
  let prevJd = jd0, prevH = h(prevJd);
  for (let jd = jd0 + STEP; jd <= jd1 + 1e-9; jd += STEP) {
    const curH = h(jd);
    if (prevH !== 0 && (prevH < 0) !== (curH < 0) && Math.abs(curH - prevH) < 180) {
      let lo = prevJd, hi = jd, hLo = prevH;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const hm = h(mid);
        if ((hLo < 0) === (hm < 0)) { lo = mid; hLo = hm; } else { hi = mid; }
      }
      hits.push((lo + hi) / 2);
    }
    prevJd = jd; prevH = curH;
  }
  return hits;
}

/** The return immediately before `targetJd` and the one immediately after,
 *  for `body`. Either can be missing: `prev` is absent when the target
 *  falls before the body's first post-natal return (there is no return
 *  before birth — the scan window is clamped to start half a day after
 *  natal.jd so the birth instant itself, where h is exactly 0, is never
 *  mistaken for one). */
function nearestBodyReturns(natal, body, targetJd) {
  const periodDays = PLANET_PERIODS[body] * 365.25;
  const jd0 = Math.max(natal.jd + 0.5, targetJd - periodDays * 1.05);
  const jd1 = targetJd + periodDays * 1.05;
  const hits = __bodyReturnsInWindow(natal, body, jd0, jd1);
  const prev = hits.filter((jd) => jd <= targetJd).pop();
  const next = hits.find((jd) => jd > targetJd);
  return { prev, next };
}

/** The full chart cast at `body`'s return nearest `targetJd` — the return
 *  in force at the target if one has happened, else the upcoming one.
 *  Cast at the natal place; sect is always re-derived for the return
 *  instant itself (`sect: "auto"`), never inherited from the natal
 *  chart's own setting. Returns null only if `body` has never returned
 *  and none is found ahead either, which does not happen in practice
 *  (nearestBodyReturns' window always contains at least one crossing). */
function returnChart(natal, body, targetJd) {
  const { prev, next } = nearestBodyReturns(natal, body, targetJd);
  const jd = prev !== undefined ? prev : next;
  if (jd === undefined) return null;
  const dateISO = new Date((jd - 2440587.5) * 86400000).toISOString();
  const birth = natal.birth || {};
  const chart = computeNatal({
    dateISO, lat: birth.lat, lng: birth.lng,
    houseSystem: birth.houseSystem, sect: "auto",
  });
  const periodDays = PLANET_PERIODS[body] * 365.25;
  const K = Math.round((jd - natal.jd) / periodDays);
  return {
    body, jd, dateISO, K,
    isCurrent: jd === prev,
    chart,
    nextJd: next,
    nextDateISO: next !== undefined ? new Date((next - 2440587.5) * 86400000).toISOString() : null,
  };
}

// ─────────────────── The lifecycle digest ───────────────────
//
// Everything above this point answers "what is true at this instant" in
// tables — a reader has to assemble that into a picture themselves. This
// composes the SAME already-computed facts (age, which return is in
// force, which bodies share their natal shadow lane right now) into a
// handful of plain sentences, the same register narrative.jsx's opening
// and closing already write for the natal chart itself. It changes
// nothing about what is computed, only what is said about it — read
// before the tables, not instead of them.
//
// Roughly half of all moments have at least one body sharing its natal
// shadow lane purely by chance (10 bodies, 11 lanes, so P(at least one
// match) = 1 − (10/11)^10 ≈ 0.58) — the sentence says so, the same
// honesty the narrative's own shadow-contact line already practices.
function lifecycleDigest(natal, jdTarget) {
  const fmtDate = (iso) => iso.slice(0, 10);
  const ctm = ctmState(jdTarget, natal.jd);
  const lift = windingLift(natal, jdTarget);
  const lines = [];

  lines.push(
    `This moment is ${ctm.ageYears.toFixed(1)} years into the chart's history` +
    ` — ${Math.floor(ctm.ageDays).toLocaleString()} days from birth.`
  );

  for (const body of RETURN_BODIES) {
    const r = returnChart(natal, body, jdTarget);
    if (!r) continue;
    const label = body === "Sun" ? "Solar" : "Lunar";
    lines.push(r.isCurrent
      ? `${label} Return #${r.K} has been in force since ${fmtDate(r.dateISO)}, governing until the next on ${fmtDate(r.nextDateISO)}.`
      : `No ${label.toLowerCase()} return has happened yet — the first, #${r.K}, falls on ${fmtDate(r.dateISO)}.`);
  }

  // At the birth instant itself every body trivially shares its own
  // natal lane (K=0 for all) — that is a tautology, not a coincidence,
  // so the sentence is suppressed there and only fires at any OTHER
  // target, where a shared lane is a genuine (if common) recurrence.
  if (lift.returns.length > 0 && jdTarget !== natal.jd) {
    const who = lift.returns.length === 1 ? lift.returns[0] : `${lift.returns.slice(0, -1).join(", ")} and ${lift.returns[lift.returns.length - 1]}`;
    lines.push(
      `${who} ${lift.returns.length === 1 ? "sits" : "sit"}, right now, in the same shadow lane ` +
      `${lift.returns.length === 1 ? "it" : "they"} held at birth — common to about half of all moments, ` +
      `not a classical aspect, but a correspondence the traditional reading has no name for.`
    );
  }

  return { ageYears: ctm.ageYears, ageDays: ctm.ageDays, lines };
}

// ─────────────────── Mutual perfections ───────────────────
//
// Everything above addresses one subject's own lifecycle. This is the
// same "evolving image" idea extended to two: two INDEPENDENT exact
// scans (transitPerfections, run once per natal chart, unmodified) are
// merged for the moments where the sky strikes both charts within days
// of each other. Neither scan is told about the other chart — this
// function only asks whether two already-exact, already-verified facts
// happen to land close in time. That coincidence is real and rare (see
// the test suite for the base rate), but it is a calendar fact about two
// independent timelines, not a claim that the sky "does" anything to a
// relationship.
// "Within a day" — the threshold two independent perfection instants must
// fall inside to count as a mutual activation. Chosen, not derived: it is
// the plain reading of "the same day," and it is NOT rare — at this
// threshold two unrelated charts still land a mutual hit roughly a dozen
// times a year by pure chance (measured empirically across sample chart
// pairs), which the UI states rather than hides.
const MUTUAL_SAME_DAY_WINDOW = 0.5;

function mergeNearPerfections(hitsA, hitsB, nearDays = MUTUAL_SAME_DAY_WINDOW) {
  const mutual = [];
  for (const ha of hitsA) {
    for (const hb of hitsB) {
      const gapDays = hb.jd - ha.jd;
      if (Math.abs(gapDays) <= nearDays) {
        mutual.push({ a: ha, b: hb, gapDays, jd: (ha.jd + hb.jd) / 2 });
      }
    }
  }
  mutual.sort((x, y) => x.jd - y.jd);
  return mutual;
}

/** Convenience wrapper: scans both charts and merges in one call. Mostly
 *  for tests and any caller that does not need the two scans separately;
 *  the UI runs the two transitPerfections scans progressively (the same
 *  per-body chunking the solo lifecycle panel already uses) and calls
 *  mergeNearPerfections once both are done, rather than paying for two
 *  full year-wide scans inside one synchronous call. */
function mutualPerfections(natalA, natalB, jdCenter, spanDays = 366, nearDays = MUTUAL_SAME_DAY_WINDOW) {
  const hitsA = transitPerfections(natalA, jdCenter, spanDays).hits;
  const hitsB = transitPerfections(natalB, jdCenter, spanDays).hits;
  return mergeNearPerfections(hitsA, hitsB, nearDays);
}

// Expose
isRetrograde; // silence linter: relies on astro.jsx globals
Object.assign(window, {
  MAYA_EPOCH_JD,
  TZOLKIN_SIGNS, HAAB_MONTHS,
  mayaLongCount, tzolkin, haab, calendarRound,
  tcoPhase, tcoPeriod, phaseSyndrome,
  ctmState, currentTransits, progressedAt, progressionsDigest, windingLift, transitPerfections,
  RETURN_BODIES, nearestBodyReturns, returnChart, lifecycleDigest,
  mergeNearPerfections, mutualPerfections, MUTUAL_SAME_DAY_WINDOW,
});
