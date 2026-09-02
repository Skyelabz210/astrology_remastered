// synastry.jsx — relationship engine: two natal charts compared.
//
// Classical synastry:
//   - cross-aspects: every body of A against every body of B
//   - house overlays: where B's planets fall in A's houses, and vice versa
//   - dignity reception between the two charts (A's planet in B's domicile)
//   - luminary + Venus/Mars contacts weighted (the relationship signifiers)
//
// CTM extension (unique to this engine):
//   - phase syndrome S = θ_A − θ_B between the two birth points on ℝ × S¹
//   - shared shadow lanes (mod 11 residues that coincide)
//   - a composite midpoint phase

// Synastry aspect orbs — slightly tighter than natal, luminaries get more.
const SYN_ASPECTS = [
  { name: "Conjunction", angle:   0, orb: 8, family: "cardinal"  },
  { name: "Opposition",  angle: 180, orb: 7, family: "cardinal"  },
  { name: "Trine",       angle: 120, orb: 6, family: "classical" },
  { name: "Square",      angle:  90, orb: 6, family: "classical" },
  { name: "Sextile",     angle:  60, orb: 4, family: "classical" },
  { name: "Quincunx",    angle: 150, orb: 2.5, family: "minor"   },
];

const SYN_BODIES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode"];

function synAspect(deltaDeg) {
  const d = Math.abs(((deltaDeg + 180) % 360) - 180);
  let best = null;
  for (const a of SYN_ASPECTS) {
    const sep = Math.abs(d - a.angle);
    if (sep <= a.orb && (!best || sep < best.sep)) best = { ...a, sep };
  }
  return best;
}

// Weight a cross-aspect by relational significance.
function aspectWeight(aName, bName, aspectName, orb, maxOrb) {
  const lum = (n) => n === "Sun" || n === "Moon";
  const venusMars = (n) => n === "Venus" || n === "Mars";
  let w = 1 - (orb / maxOrb);              // tightness 0..1
  if (lum(aName) && lum(bName)) w *= 2.2;  // luminary-to-luminary
  else if (lum(aName) || lum(bName)) w *= 1.6;
  if (venusMars(aName) && venusMars(bName)) w *= 2.0;  // the romance signature
  else if (venusMars(aName) || venusMars(bName)) w *= 1.3;
  if (aName === "Saturn" || bName === "Saturn") w *= 1.2; // bonds & commitment (or weight)
  // Harmonious vs hard
  const harmonious = ["Trine","Sextile"].includes(aspectName);
  const hard = ["Square","Opposition"].includes(aspectName);
  const conj = aspectName === "Conjunction";
  return { weight: w, harmonious, hard, conj };
}

// Cross-aspect grid between charts A and B.
function crossAspects(chartA, chartB) {
  const hits = [];
  const aBodies = chartA.planets.filter(p => SYN_BODIES.includes(p.name));
  const bBodies = chartB.planets.filter(p => SYN_BODIES.includes(p.name));
  for (const A of aBodies) {
    for (const B of bBodies) {
      const delta = mod360(A.lon - B.lon);
      const asp = synAspect(delta);
      if (!asp) continue;
      const w = aspectWeight(A.name, B.name, asp.name, asp.sep, asp.orb);
      hits.push({
        a: A.name, b: B.name,
        aGlyph: A.glyph, bGlyph: B.glyph,
        aspect: asp.name, angle: asp.angle, family: asp.family,
        orb: asp.sep,
        weight: w.weight,
        harmonious: w.harmonious, hard: w.hard, conj: w.conj,
      });
    }
  }
  hits.sort((x, y) => y.weight - x.weight);
  return hits;
}

// House overlays — where each of B's planets falls in A's houses.
function houseOverlays(hostChart, guestChart) {
  const ascSignIdx = hostChart.ascSignIdx;
  const asc = hostChart.asc;
  return guestChart.planets
    .filter(p => SYN_BODIES.includes(p.name))
    .map(p => {
      const house = hostChart.birth.houseSystem === "whole"
        ? ((p.sign - ascSignIdx + 12) % 12) + 1
        : Math.floor(mod360(p.lon - asc) / 30) + 1;
      return { planet: p.name, glyph: p.glyph, sign: ZODIAC[p.sign].name, house };
    });
}

// Cross-reception: A's planet sitting in the sign B's planet rules, etc.
function crossReceptions(chartA, chartB) {
  const DOM = {
    Sun:[4], Moon:[3], Mercury:[2,5], Venus:[1,6], Mars:[0,7],
    Jupiter:[8,11], Saturn:[9,10], Uranus:[10], Neptune:[11], Pluto:[7],
  };
  const out = [];
  for (const A of chartA.planets) {
    if (!DOM[A.name]) continue;
    for (const B of chartB.planets) {
      if (!DOM[B.name]) continue;
      // A's planet in the sign B's planet rules
      if (DOM[B.name].includes(A.sign)) {
        out.push({ guest: A.name, guestChart: "A", host: B.name, hostChart: "B", sign: ZODIAC[A.sign].name });
      }
    }
  }
  return out;
}

// Overall compatibility scoring from the weighted cross-aspects.
function compatibilityScore(hits) {
  let harmony = 0, friction = 0, total = 0;
  for (const h of hits) {
    total += h.weight;
    if (h.harmonious) harmony += h.weight;
    else if (h.hard) friction += h.weight;
    else if (h.conj) { harmony += h.weight * 0.6; friction += h.weight * 0.4; }
  }
  const ratio = total > 0 ? harmony / (harmony + friction) : 0.5;
  return {
    harmony, friction, total,
    ratio,                            // 0..1 — share of harmonious weight
    intensity: Math.min(1, total / 18),  // how aspected the pair is overall
  };
}

// CTM relational layer — phase syndrome between two birth points.
function synastryCTM(chartA, chartB) {
  const tcoA = tcoPhase(chartA.jd);
  const tcoB = tcoPhase(chartB.jd);
  const syndrome = phaseSyndrome(tcoA.theta, tcoB.theta);
  // shared shadow lanes — planets whose mod-11 residues coincide across
  // charts. Both sides are NATAL arcsecond residues, so if either birth
  // time is unknown (computed at an assumed noon — see astro.jsx), the
  // comparison carries no signal: checked directly against the real
  // ephemeris (not assumed from mean orbital periods), every body's own
  // natal lane cycles through all eleven residues inside a single day of
  // birth-time uncertainty, all the way out to Pluto. A "coincidence"
  // against an effectively random residue on either side isn't one, so
  // this is withheld entirely rather than computed-and-caveated — the
  // same all-or-nothing shape the solo chart's own shared-lane sentence
  // uses (time.jsx's lifecycleDigest, narrative.jsx's closing).
  // lanesReliable lets the view say why, rather than silently showing an
  // empty list indistinguishable from "checked, found none."
  const lanesReliable = !chartA.timeUnknown && !chartB.timeUnknown;
  const sharedLanes = [];
  if (lanesReliable) {
    for (const A of chartA.planets) {
      if (!SYN_BODIES.includes(A.name)) continue;
      for (const B of chartB.planets) {
        if (!SYN_BODIES.includes(B.name)) continue;
        if (A.residues.r11 === B.residues.r11) {
          sharedLanes.push({ a: A.name, b: B.name, lane: A.residues.r11, laneName: SHADOW_LANE_NAMES[A.residues.r11] });
        }
      }
    }
  }
  // composite midpoint phase
  const midTheta = phaseSyndrome((tcoA.theta + tcoB.theta) / 2, 0);
  // The directional syndrome S = θA − θB is antisymmetric: swapping who is
  // entered first maps S to 360° − S, which used to flip the spoken verdict
  // from "aligned rhythm" to "counterphase" for the SAME two people. The
  // folded offset min(S, 360 − S) is order-independent — that is what the
  // view judges and displays; S itself stays for anything that needs the
  // signed phase.
  const syndromeDeg = syndrome * 180 / Math.PI;
  const syndromeFoldDeg = Math.min(syndromeDeg, 360 - syndromeDeg);
  return {
    tcoA, tcoB,
    syndrome, syndromeDeg, syndromeFoldDeg,
    sharedLanes, lanesReliable,
    midTheta, midThetaDeg: midTheta * 180 / Math.PI,
  };
}

// Top-level: compute the full synastry bundle for charts A and B.
function computeSynastry(chartA, chartB) {
  const hits = crossAspects(chartA, chartB);
  return {
    chartA, chartB,
    hits,
    overlaysAonB: houseOverlays(chartB, chartA), // A's planets in B's houses
    overlaysBonA: houseOverlays(chartA, chartB), // B's planets in A's houses
    receptionsAB: crossReceptions(chartA, chartB),
    receptionsBA: crossReceptions(chartB, chartA),
    score: compatibilityScore(hits),
    ctm: synastryCTM(chartA, chartB),
  };
}

Object.assign(window, {
  computeSynastry, crossAspects, houseOverlays, crossReceptions,
  compatibilityScore, synastryCTM, SYN_BODIES,
});
