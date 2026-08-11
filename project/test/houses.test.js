// test/houses.test.js — WP-11: validate project/tools/ephemeris/houses.js
// (ASC/MC + Placidus cusps). Not under src/core/: floats are fine.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).
//
// ─────────────────────────────────────────────────────────────────────────
// Honesty note on numerical validation (read before trusting the numbers
// below as "swetest-verified" — they are NOT):
//
// The WP-11 brief asks for validation "against 4 published Swiss Ephemeris
// `swetest -house` reference charts". This session has no network access to
// fetch or run swetest, and no genuinely memorized, trustworthy swetest
// output for a specific chart exists to cite honestly (fabricating a
// plausible-looking reference number would be worse than not having one —
// the brief explicitly says not to do this). So instead this suite:
//
//   1. Uses an EXACT, hand-derived analytic reference: at latDeg=0, both the
//      Ascendant/Midheaven formulas and the Placidus semi-arc trisection
//      collapse to a closed form (worked in the comments below and in
//      houses.js's module header), because the semi-diurnal arc is exactly
//      90° for every declination at the equator. This is real math, derived
//      independently of the implementation's atan2-branch choice (see
//      houses.js header for how that branch was itself pinned down from
//      this same equator case), not a fabricated "reference chart" — but it
//      is a degenerate case (latDeg=0), so it cannot catch a latitude-
//      dependent sign error in the semi-diurnal-arc term.
//   2. Uses looser structural/sanity assertions at non-zero latitude
//      (monotonicity around the circle, cusp1/4/7/10 agreement with
//      ascMc(), symmetry of opposite cusps) that do not depend on an
//      external reference value at all.
//   3. TODO(WP-12 or later): replace/extend with verified `swetest -house`
//      (or equivalent independently-published) output for at least one
//      non-zero, non-equatorial, non-polar chart, with in-file provenance
//      (exact swetest invocation + version), once that data is available in
//      an environment that can run/fetch it. Until then, confidence in the
//      non-equatorial Placidus iteration rests on (a) it being the same
//      well-documented semi-arc algorithm implemented the same way
//      regardless of latitude, and (b) the structural checks below, not on
//      an independent numeric match.
// ─────────────────────────────────────────────────────────────────────────

import { ascMc, placidusCusps, PolarLatitudeError } from "../tools/ephemeris/houses.js";
import { julianDayUTC, ttFromUtc, gastDeg, meanObliquityDeg } from "../tools/ephemeris/timescale.js";

function near(actual, expected, tol) {
  return Math.abs(actual - expected) <= tol;
}

function circDiffDeg(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const jdUt1 = julianDayUTC("2004-06-08T08:20:00Z"); // WP-09 fixture #13 epoch (polar-path stress instant, used here only as an arbitrary real epoch, not for its polar-fixture role)
  const jdTt = ttFromUtc(jdUt1);
  const eps = meanObliquityDeg(jdTt);
  const gast = gastDeg(jdUt1, jdTt);

  // Helper: pick a longitude that makes RAMC (GAST + lng, normalized) equal
  // to an exact target value, so the equator closed-form checks below can
  // be driven by a clean RAMC rather than whatever RAMC this jd happens to
  // produce at lng=0.
  function lngForRamc(targetRamcDeg) {
    return targetRamcDeg - gast;
  }

  // ── Structural checks ───────────────────────────────────────────
  {
    const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, 40.0, 15.0);
    t("ascMc: ascDeg in [0,360)", ascDeg >= 0 && ascDeg < 360, `got ${ascDeg}`);
    t("ascMc: mcDeg in [0,360)", mcDeg >= 0 && mcDeg < 360, `got ${mcDeg}`);

    const cusps = placidusCusps(jdUt1, jdTt, 40.0, 15.0);
    t("placidusCusps returns exactly 12 values", cusps.length === 12, `got ${cusps.length}`);
    t(
      "placidusCusps: every cusp in [0,360)",
      cusps.every((c) => c >= 0 && c < 360),
      `got ${JSON.stringify(cusps)}`
    );

    t(
      "placidusCusps[0] (house 1) === ascMc().ascDeg",
      circDiffDeg(cusps[0], ascDeg) < 1e-6,
      `cusp1=${cusps[0]} asc=${ascDeg}`
    );
    t(
      "placidusCusps[9] (house 10) === ascMc().mcDeg",
      circDiffDeg(cusps[9], mcDeg) < 1e-6,
      `cusp10=${cusps[9]} mc=${mcDeg}`
    );
    t(
      "placidusCusps[3] (house 4 / IC) === mcDeg + 180",
      circDiffDeg(cusps[3], (mcDeg + 180) % 360) < 1e-6,
      `cusp4=${cusps[3]} mc+180=${(mcDeg + 180) % 360}`
    );
    t(
      "placidusCusps[6] (house 7 / DSC) === ascDeg + 180",
      circDiffDeg(cusps[6], (ascDeg + 180) % 360) < 1e-6,
      `cusp7=${cusps[6]} asc+180=${(ascDeg + 180) % 360}`
    );

    // Opposite-cusp symmetry, houses 5/11, 6/12, 8/2, 9/3.
    t("cusp5 opposite cusp11", circDiffDeg(cusps[4], (cusps[10] + 180) % 360) < 1e-6);
    t("cusp6 opposite cusp12", circDiffDeg(cusps[5], (cusps[11] + 180) % 360) < 1e-6);
    t("cusp8 opposite cusp2", circDiffDeg(cusps[7], (cusps[1] + 180) % 360) < 1e-6);
    t("cusp9 opposite cusp3", circDiffDeg(cusps[8], (cusps[2] + 180) % 360) < 1e-6);

    // Monotonic (allowing exactly one wraparound) around the circle in
    // house order 1..12 — a basic sanity property of any valid quadrant
    // house system (cusps subdivide the ecliptic circle in house order).
    let wraps = 0;
    for (let i = 0; i < 12; i++) {
      const a = cusps[i];
      const b = cusps[(i + 1) % 12];
      if (b < a) wraps++;
    }
    t("placidusCusps are monotonically increasing around the circle (exactly one wrap)", wraps === 1, `wraps=${wraps} cusps=${JSON.stringify(cusps)}`);
  }

  // ── Exact hand-derived reference points (latDeg=0, see file header) ──
  // Derivation (rotation of the ecliptic-frame unit vector (cosλ,sinλ,0) by
  // obliquity ε into the equatorial frame, β=0):
  //   cosδ cosα = cosλ,  cosδ sinα = sinλ cosε,  sinδ = sinλ sinε
  // MC is defined as the ecliptic point on the meridian (α=RAMC=θ exactly);
  // dividing the first two equations gives tanα = cosε·tanλ, i.e.
  //   λ_MC = atan2(sinθ, cosθ·cosε).                                   (A)
  // At latDeg=0, tan(lat)=0, so the rise condition cosH=-tan(lat)tan(δ)
  // reduces to cosH=0 for EVERY declination δ — i.e. every point rises at
  // exactly H=-90° regardless of its declination. So the Ascendant's RA is
  // always α_ASC = θ+90 at the equator, and applying (A)'s same identity
  // with α=θ+90 gives λ_ASC = atan2(sin(θ+90), cos(θ+90)·cosε), independent
  // of ε's numeric value at the following clean inputs:
  //   θ=0°:   λ_MC=atan2(0,cosε)=0°,     λ_ASC=atan2(1,0)=90°
  //   θ=90°:  λ_MC=atan2(1,0)=90°,        λ_ASC=atan2(0,-cosε)=180°
  //   θ=180°: λ_MC=atan2(0,-cosε)=180°,   λ_ASC=atan2(-1,0)=270°
  //   θ=270°: λ_MC=atan2(-1,0)=270°,      λ_ASC=atan2(0,cosε)=0°
  // These four hold for ANY obliquity value, so they are a strong,
  // implementation-independent check on both the MC formula and — more
  // importantly — the Ascendant atan2 QUADRANT choice (the part that is
  // genuinely ambiguous from the ratio-only formula alone; see houses.js
  // header for the two candidate branches this rules between).
  {
    const cases = [
      [0, 0, 90],
      [90, 90, 180],
      [180, 180, 270],
      [270, 270, 0],
    ];
    for (const [ramc, expectMc, expectAsc] of cases) {
      const lng = lngForRamc(ramc);
      const { ascDeg, mcDeg } = ascMc(jdUt1, jdTt, 0, lng);
      t(
        `ascMc at latDeg=0, RAMC=${ramc}°: mcDeg = ${expectMc}° exactly (hand-derived, ε-independent)`,
        near(mcDeg, expectMc, 1e-6),
        `got ${mcDeg}`
      );
      t(
        `ascMc at latDeg=0, RAMC=${ramc}°: ascDeg = ${expectAsc}° exactly (hand-derived, ε-independent; pins the atan2 quadrant)`,
        near(ascDeg, expectAsc, 1e-6),
        `got ${ascDeg}`
      );
    }
  }

  // ── Placidus closed form at latDeg=0 ────────────────────────────
  // At the equator SDA=SNA=90° for every declination (shown above), so the
  // Placidus trisection is non-iterative and exact: every cusp is simply
  // the equator ASC/MC formula (A) evaluated at RAMC+Δ for
  // Δ = [90,120,150,180,210,240,270,300,330,0,30,60] (houses 1..12) — i.e.
  // Placidus degenerates to an even 30°-per-house division of RA at the
  // equator, a known structural fact about the semi-arc method (it is not
  // specific to this implementation).
  {
    const ramc = 37; // arbitrary
    const lng = lngForRamc(ramc);
    const cusps = placidusCusps(jdUt1, jdTt, 0, lng);
    const deltas = [90, 120, 150, 180, 210, 240, 270, 300, 330, 0, 30, 60];
    for (let i = 0; i < 12; i++) {
      const alpha = ramc + deltas[i];
      const aRad = (alpha * Math.PI) / 180;
      const eRad = (eps * Math.PI) / 180;
      let expected = (Math.atan2(Math.sin(aRad), Math.cos(aRad) * Math.cos(eRad)) * 180) / Math.PI;
      expected = ((expected % 360) + 360) % 360;
      t(
        `placidusCusps at latDeg=0: house ${i + 1} matches closed form (RAMC+${deltas[i]}°) within 1e-6°`,
        near(cusps[i], expected, 1e-6),
        `got ${cusps[i]}, expected ${expected}`
      );
    }
  }

  // ── Polar latitude error ────────────────────────────────────────
  {
    let threw = null;
    try {
      placidusCusps(jdUt1, jdTt, 75, 0);
    } catch (e) {
      threw = e;
    }
    t("placidusCusps(latDeg=75) throws", threw !== null, "no exception thrown");
    t(
      "placidusCusps(latDeg=75) throws PolarLatitudeError specifically",
      threw instanceof PolarLatitudeError,
      threw ? `threw ${threw.name}` : "n/a"
    );

    let threwNeg = null;
    try {
      placidusCusps(jdUt1, jdTt, -75, 0);
    } catch (e) {
      threwNeg = e;
    }
    t(
      "placidusCusps(latDeg=-75) also throws PolarLatitudeError (symmetric threshold)",
      threwNeg instanceof PolarLatitudeError,
      threwNeg ? `threw ${threwNeg.name}` : "no exception thrown"
    );

    let okAt66 = true;
    let errAt66 = null;
    try {
      placidusCusps(jdUt1, jdTt, 66.5, 0);
    } catch (e) {
      okAt66 = false;
      errAt66 = e;
    }
    t(
      "placidusCusps(latDeg=66.5) does NOT throw (below the 66.56° threshold)",
      okAt66,
      errAt66 ? `unexpectedly threw ${errAt66.name}` : ""
    );

    // ascMc is documented to remain valid at high latitude (only Placidus
    // truly breaks down) — confirm it does not throw at the same lat=75
    // input that makes placidusCusps throw.
    let ascMcThrew = false;
    try {
      ascMc(jdUt1, jdTt, 75, 0);
    } catch (e) {
      ascMcThrew = true;
    }
    t("ascMc(latDeg=75) does NOT throw (documented design: ASC/MC stay defined at high latitude)", !ascMcThrew);
  }

  // ── Determinism ──────────────────────────────────────────────────
  {
    const a1 = ascMc(jdUt1, jdTt, 51.48, -0.13);
    const a2 = ascMc(jdUt1, jdTt, 51.48, -0.13);
    t(
      "ascMc is deterministic (bit-identical) across repeated calls",
      a1.ascDeg === a2.ascDeg && a1.mcDeg === a2.mcDeg,
      `${JSON.stringify(a1)} vs ${JSON.stringify(a2)}`
    );

    const c1 = placidusCusps(jdUt1, jdTt, 51.48, -0.13);
    const c2 = placidusCusps(jdUt1, jdTt, 51.48, -0.13);
    t(
      "placidusCusps is deterministic (bit-identical) across repeated calls",
      c1.every((v, i) => v === c2[i]),
      `${JSON.stringify(c1)} vs ${JSON.stringify(c2)}`
    );
  }

  return R;
}
