// test/present/eclipses.test.js — eclipses.js against the real ephemeris.
//
// eclipses.js takes the astronomy engine as a parameter rather than
// importing it (see its header), so this suite drives the SHIPPED code path
// with the SAME package the browser bundle is built from — no stub, no
// hand-copied expected table that could drift from the engine.
//
// The assertions are of three kinds:
//
//   1. GEOMETRIC INVARIANTS the numbers must satisfy no matter which
//      eclipse is picked. These are what actually catch a wrong coordinate
//      convention: an east/west sign flip on the greatest-eclipse longitude
//      still produces plausible-looking coordinates, but it puts the Sun
//      below the horizon at a point where an eclipse is by definition being
//      observed. Checked across every eclipse from 1970 to 2030.
//   2. CLOSED-FORM checks on the pure helpers (distance, bearing, orb
//      arithmetic) where an exact answer is known independently.
//   3. REGRESSION PINS on the app's default nativity, so a change to the
//      prenatal search silently returning a different eclipse fails here.

import * as Astronomy from "astronomy-engine";
import {
  EARTH_RADIUS_KM,
  normalizeLon180,
  formatLatLon,
  greatCircleDistanceKm,
  initialBearingDeg,
  compassPoint,
  eclipticLongitudeOf,
  subsolarPoint,
  altitudeDegAt,
  solarEclipsesBetween,
  lunarEclipsesBetween,
  eclipsesBetween,
  prenatalEclipses,
  angularSeparation,
  contactsFor,
  eclipseProfile,
} from "../../eclipses.js";

// The app's default nativity — app.jsx DEFAULT_SETTINGS / hcrm-app.jsx
// HCRM_DEFAULTS. test/present/defaults.test.js is what asserts those files
// still carry it; this suite only needs a real birth to compute against.
const BIRTH_ISO = "1980-10-21T17:31:00-04:00";
const BIRTH_LAT = 35.1408;
const BIRTH_LNG = -79.0058;

const SWEEP_FROM = new Date("1970-01-01T00:00:00Z");
const SWEEP_TO = new Date("2030-01-01T00:00:00Z");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });
  const near = (a, b, tol) => Math.abs(a - b) <= tol;

  // ── pure helpers, closed form ────────────────────────────────────────
  t("EARTH_RADIUS_KM is the IUGG mean radius", near(EARTH_RADIUS_KM, 6371.0088, 1e-9));

  // A quarter of a great circle: πR/2.
  const quarter = greatCircleDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 });
  t("quarter great circle = πR/2", near(quarter, Math.PI * EARTH_RADIUS_KM / 2, 1e-6),
    `${quarter.toFixed(4)} vs ${(Math.PI * EARTH_RADIUS_KM / 2).toFixed(4)}`);

  // Pole to pole is half a great circle.
  const poleToPole = greatCircleDistanceKm({ lat: 90, lon: 0 }, { lat: -90, lon: 0 });
  t("pole to pole = πR", near(poleToPole, Math.PI * EARTH_RADIUS_KM, 1e-6));

  t("identical points are 0 km apart",
    greatCircleDistanceKm({ lat: 35.1408, lon: -79.0058 }, { lat: 35.1408, lon: -79.0058 }) === 0);

  // One degree of latitude ≈ 111.19 km on the mean sphere.
  const oneDeg = greatCircleDistanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  t("1° of latitude ≈ 111.19 km", near(oneDeg, 111.195, 0.01), `${oneDeg.toFixed(3)} km`);

  t("bearing due north is 0°", near(initialBearingDeg({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }), 0, 1e-9));
  t("bearing due east is 90°", near(initialBearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }), 90, 1e-9));
  t("bearing due south is 180°", near(initialBearingDeg({ lat: 0, lon: 0 }, { lat: -10, lon: 0 }), 180, 1e-9));
  t("bearing due west is 270°", near(initialBearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: -10 }), 270, 1e-9));

  t("compass N at 0° and at 359°", compassPoint(0) === "N" && compassPoint(359) === "N");
  t("compass wraps the full 16 points",
    compassPoint(90) === "E" && compassPoint(180) === "S" && compassPoint(270) === "W"
    && compassPoint(45) === "NE" && compassPoint(225) === "SW");

  t("normalizeLon180 wraps 190 to -170", normalizeLon180(190) === -170);
  t("normalizeLon180 keeps 180 as 180", normalizeLon180(180) === 180);
  t("normalizeLon180 wraps -190 to 170", normalizeLon180(-190) === 170);
  t("normalizeLon180 wraps 540 to 180", normalizeLon180(540) === 180);

  t("formatLatLon signs the hemispheres", formatLatLon(-9.3, -63.08) === "9.30°S 63.08°W");
  t("formatLatLon signs N/E", formatLatLon(35.14, 7.6) === "35.14°N 7.60°E");

  // ── separation / contact arithmetic ──────────────────────────────────
  t("separation is symmetric", angularSeparation(10, 350) === angularSeparation(350, 10));
  t("separation wraps across 0°", near(angularSeparation(1, 359), 2, 1e-12));
  t("separation caps at 180°", near(angularSeparation(0, 180), 180, 1e-12));
  t("separation of 190° reads as 170°", near(angularSeparation(0, 190), 170, 1e-12));

  {
    const points = [
      { name: "Sun", lon: 208.6 },
      { name: "Moon", lon: 28.0 },
      { name: "Mars", lon: 100.0 },
    ];
    // 207° is 1.6° from the Sun and — via the opposition arm — 1° from the
    // Moon at 28°, so BOTH are real contacts. Tightest first, so the Moon
    // leads: the ordering is part of the contract, not incidental.
    const hits = contactsFor(207.0, points, 2.5);
    t("conjunction inside orb is a hit",
      hits.some(h => h.name === "Sun" && h.aspect === "conjunction" && near(h.orb, 1.6, 1e-6)),
      JSON.stringify(hits));
    t("both arms of the axis are reported, tightest first",
      hits.length === 2 && hits[0].name === "Moon" && hits[1].name === "Sun",
      JSON.stringify(hits));
    const opp = contactsFor(208.0, points, 2.5);
    t("opposition inside orb is a hit too",
      opp.some(h => h.name === "Moon" && h.aspect === "opposition"), JSON.stringify(opp));
    t("nothing outside orb is reported", contactsFor(0, points, 2.5).length === 0);
    // A point 1° from the eclipse across the 0°/360° seam must still hit.
    const seam = contactsFor(359.5, [{ name: "Wrap", lon: 0.5 }], 2.5);
    t("contacts wrap the 0°/360° seam", seam.length === 1 && near(seam[0].orb, 1, 1e-9));
    // Tightest first.
    const ordered = contactsFor(100, [{ name: "far", lon: 102 }, { name: "near", lon: 100.5 }], 3);
    t("contacts come back tightest-first", ordered[0].name === "near");
    t("a point conjunct AND opposite cannot double-count",
      contactsFor(0, [{ name: "X", lon: 0 }], 181).length === 1);
    t("contactsFor tolerates junk points",
      contactsFor(0, [null, { name: "no lon" }, { name: "NaN", lon: NaN }], 5).length === 0);
  }

  // ── the sub-body projection, checked against the horizon ─────────────
  // The defining property of the sublunar point: the Moon is at the zenith
  // there. Altitude must be 90°, to the arcsecond. This is the single
  // strongest check on the RA/GAST longitude derivation — any sign error or
  // hours/degrees confusion collapses it immediately.
  {
    const lunar = lunarEclipsesBetween(Astronomy, SWEEP_FROM, SWEEP_TO, {});
    let worst = 90;
    for (const e of lunar.eclipses) {
      const time = Astronomy.MakeTime(new Date(e.peakISO));
      worst = Math.min(worst, altitudeDegAt(Astronomy, "Moon", time, e.geo.lat, e.geo.lon));
    }
    t(`Moon is at zenith over every sublunar point (${lunar.eclipses.length} lunar eclipses 1970–2030)`,
      near(worst, 90, 0.02), `worst altitude ${worst.toFixed(4)}°`);
    t("the 1970–2030 lunar series is the expected size", lunar.eclipses.length === 137,
      `${lunar.eclipses.length} eclipses`);
    t("lunar series is chronological",
      lunar.eclipses.every((e, i) => i === 0 || e.peakMs > lunar.eclipses[i - 1].peakMs));
    t("every lunar record carries a sublunar basis",
      lunar.eclipses.every(e => e.geoBasis === "sublunar"));
    t("lunar eclipse kinds are drawn from the engine's enumeration",
      lunar.eclipses.every(e => ["penumbral", "partial", "total"].includes(e.kind)));

    // A lunar eclipse is an opposition: the Moon's longitude must be 180°
    // from the Sun's at peak, to well within half a degree.
    let worstSep = 0;
    for (const e of lunar.eclipses) {
      const time = Astronomy.MakeTime(new Date(e.peakISO));
      const sun = eclipticLongitudeOf(Astronomy, "Sun", time);
      worstSep = Math.max(worstSep, Math.abs(180 - angularSeparation(e.lon, sun)));
    }
    t("every lunar eclipse is a Sun–Moon opposition", worstSep < 0.5,
      `worst departure from 180° was ${worstSep.toFixed(3)}°`);
  }

  {
    const solar = solarEclipsesBetween(Astronomy, SWEEP_FROM, SWEEP_TO, {});
    t("the 1970–2030 solar series is the expected size", solar.eclipses.length === 133,
      `${solar.eclipses.length} eclipses`);
    t("solar series is chronological",
      solar.eclipses.every((e, i) => i === 0 || e.peakMs > solar.eclipses[i - 1].peakMs));
    t("solar eclipse kinds are drawn from the engine's enumeration",
      solar.eclipses.every(e => ["partial", "annular", "total"].includes(e.kind)));

    // A solar eclipse is a conjunction.
    let worstSep = 0;
    for (const e of solar.eclipses) {
      const time = Astronomy.MakeTime(new Date(e.peakISO));
      const moon = eclipticLongitudeOf(Astronomy, "Moon", time);
      worstSep = Math.max(worstSep, angularSeparation(e.lon, moon));
    }
    t("every solar eclipse is a Sun–Moon conjunction", worstSep < 0.5,
      `worst separation ${worstSep.toFixed(3)}°`);

    // THE convention check. At the point of greatest eclipse the Sun is by
    // definition being eclipsed, so it must be above that horizon. A flipped
    // longitude sign (west-positive instead of east-positive) drives this
    // negative for most of the series.
    const axis = solar.eclipses.filter(e => e.geoBasis === "greatest");
    let minSunAlt = 90, minMoonAlt = 90;
    for (const e of axis) {
      const time = Astronomy.MakeTime(new Date(e.peakISO));
      minSunAlt = Math.min(minSunAlt, altitudeDegAt(Astronomy, "Sun", time, e.geo.lat, e.geo.lon));
      minMoonAlt = Math.min(minMoonAlt, altitudeDegAt(Astronomy, "Moon", time, e.geo.lat, e.geo.lon));
    }
    t(`the Sun is above the horizon at every greatest-eclipse point (${axis.length} central eclipses)`,
      minSunAlt > 0, `lowest solar altitude ${minSunAlt.toFixed(3)}°`);
    t("so is the Moon, at the same altitude — they are conjunct there",
      minMoonAlt > 0 && near(minSunAlt, minMoonAlt, 0.2),
      `sun ${minSunAlt.toFixed(3)}° moon ${minMoonAlt.toFixed(3)}°`);

    // Only total/annular eclipses have a shadow axis on Earth; every
    // partial must therefore fall back to the subsolar point, and the
    // fallback must actually BE the subsolar point.
    t("only total/annular eclipses use the greatest-eclipse basis",
      axis.every(e => e.kind === "total" || e.kind === "annular"));
    const partials = solar.eclipses.filter(e => e.kind === "partial");
    t("every partial eclipse falls back to the subsolar basis",
      partials.length > 0 && partials.every(e => e.geoBasis === "subsolar"),
      `${partials.length} partial eclipses`);
    let worstSubsolar = 0;
    for (const e of partials) {
      const time = Astronomy.MakeTime(new Date(e.peakISO));
      const sub = subsolarPoint(Astronomy, time);
      worstSubsolar = Math.max(worstSubsolar, greatCircleDistanceKm(sub, e.geo));
    }
    // Not bit-identical: the record's coordinate comes from the engine's own
    // AstroTime at peak, while this recomputation goes through the record's
    // millisecond-truncated ISO string. Sub-metre agreement is the real
    // assertion — the fallback is the subsolar point, not something else.
    t("the partial-eclipse fallback coordinate IS the subsolar point",
      worstSubsolar < 0.001, `worst offset ${(worstSubsolar * 1000).toFixed(3)} m`);

    // Obscuration is defined for total/annular only; a total is by
    // definition fully obscuring.
    t("total eclipses report full obscuration",
      solar.eclipses.filter(e => e.kind === "total").every(e => near(e.obscuration, 1, 1e-9)));
    t("annular eclipses report partial obscuration",
      solar.eclipses.filter(e => e.kind === "annular")
        .every(e => e.obscuration > 0.7 && e.obscuration < 1));
  }

  // ── the merged series ────────────────────────────────────────────────
  {
    const both = eclipsesBetween(Astronomy, new Date("2024-01-01"), new Date("2025-01-01"), {});
    t("2024 held 4 eclipses", both.eclipses.length === 4, `${both.eclipses.length}`);
    t("the merged series is chronological",
      both.eclipses.every((e, i) => i === 0 || e.peakMs >= both.eclipses[i - 1].peakMs));
    // 2024's total solar eclipse over North America, 8 April.
    const apr8 = both.eclipses.find(e => e.peakISO.startsWith("2024-04-08"));
    t("2024-04-08 is present and total", !!apr8 && apr8.type === "solar" && apr8.kind === "total",
      apr8 ? `${apr8.type} ${apr8.kind}` : "not found");
    t("its greatest-eclipse point is in Mexico, on land near Nazas",
      !!apr8 && near(apr8.geo.lat, 25.3, 1.0) && near(apr8.geo.lon, -104.1, 1.5),
      apr8 ? apr8.geoLabel : "");
    t("a walk cap truncates rather than silently short-listing",
      solarEclipsesBetween(Astronomy, new Date("2000-01-01"), new Date("2030-01-01"), { cap: 3 })
        .truncated === true);
  }

  // ── prenatal pair, pinned to the app's default nativity ──────────────
  {
    const birth = new Date(BIRTH_ISO);
    const pre = prenatalEclipses(Astronomy, birth, { place: { lat: BIRTH_LAT, lng: BIRTH_LNG } });
    t("prenatal solar eclipse is the 1980-08-10 annular",
      !!pre.solar && pre.solar.peakISO.startsWith("1980-08-10") && pre.solar.kind === "annular",
      pre.solar ? `${pre.solar.peakISO} ${pre.solar.kind}` : "none");
    t("prenatal lunar eclipse is the 1980-08-26 penumbral",
      !!pre.lunar && pre.lunar.peakISO.startsWith("1980-08-26") && pre.lunar.kind === "penumbral",
      pre.lunar ? `${pre.lunar.peakISO} ${pre.lunar.kind}` : "none");
    t("both prenatal eclipses precede the birth instant",
      pre.solar.peakMs < birth.getTime() && pre.lunar.peakMs < birth.getTime());
    t("the prenatal solar eclipse degree is in Leo",
      pre.solar.signIdx === 4, `sign index ${pre.solar.signIdx}, λ ${pre.solar.lon.toFixed(3)}`);
    t("the prenatal solar eclipse carries birthplace geophysics",
      !!pre.solar.fromPlace && pre.solar.fromPlace.distanceKm > 0
      && typeof pre.solar.fromPlace.aboveHorizon === "boolean");

    // Nothing between the returned eclipse and the birth: it really is the
    // LAST one. This also pins the walks' `< start` skip — the engine's
    // Search*Eclipse() re-finds an eclipse whose peak precedes the scan
    // start, so without that skip both of these come back holding the
    // prenatal eclipse itself.
    const gapSolar = solarEclipsesBetween(Astronomy, new Date(pre.solar.peakMs + 1000), birth, {});
    t("no solar eclipse falls between the prenatal one and the birth",
      gapSolar.eclipses.length === 0, gapSolar.eclipses.map(e => e.peakISO).join(", "));
    const gapLunar = lunarEclipsesBetween(Astronomy, new Date(pre.lunar.peakMs + 1000), birth, {});
    t("no lunar eclipse falls between the prenatal one and the birth",
      gapLunar.eclipses.length === 0, gapLunar.eclipses.map(e => e.peakISO).join(", "));
    t("a window opening exactly on an eclipse peak still includes it",
      lunarEclipsesBetween(Astronomy, new Date(pre.lunar.peakMs), birth, {}).eclipses.length === 1);

    // The search window has to be wide enough for any date, not just this one.
    const tightWindow = prenatalEclipses(Astronomy, new Date("2001-06-15T00:00:00Z"), { searchBackDays: 400 });
    t("a 400-day search window finds both prenatal eclipses for an arbitrary date",
      !!tightWindow.solar && !!tightWindow.lunar);
  }

  // ── the full profile ─────────────────────────────────────────────────
  {
    const NOW = new Date("2026-08-23T00:00:00Z");
    const points = [
      { name: "Sun", lon: 208.42 },
      { name: "Moon", lon: 12.0 },
      { name: "ASC", lon: 55.2 },
    ];
    const p = eclipseProfile(Astronomy, {
      dateISO: BIRTH_ISO, lat: BIRTH_LAT, lng: BIRTH_LNG,
      points, now: NOW, futureYears: 2, orbDeg: 2.5,
    });
    t("the profile covers birth to the look-ahead horizon", p.eclipses.length > 200,
      `${p.eclipses.length} eclipses`);
    t("no eclipse in the series predates the birth",
      p.eclipses.every(e => e.peakMs >= new Date(BIRTH_ISO).getTime()));
    t("no eclipse in the series is beyond the look-ahead horizon",
      p.eclipses.every(e => e.peakMs <= NOW.getTime() + 2.05 * 365.2425 * 86400000));
    t("contacted is a subset of the series",
      p.contacted.every(e => p.eclipses.includes(e)));
    t("every contacted eclipse really has a contact",
      p.contacted.length > 0 && p.contacted.every(e => e.contacts.length > 0));
    t("no contact exceeds the requested orb",
      p.contacted.every(e => e.contacts.every(c => c.orb <= 2.5)));
    t("upcoming holds exactly the not-yet-past eclipses",
      p.upcoming.every(e => e.peakMs > NOW.getTime())
      && p.upcoming.length === p.eclipses.filter(e => e.peakMs > NOW.getTime()).length);
    t("past/upcoming partition the series",
      p.eclipses.filter(e => e.past).length + p.upcoming.length === p.eclipses.length);
    t("the profile is deterministic for a pinned `now`",
      JSON.stringify(eclipseProfile(Astronomy, {
        dateISO: BIRTH_ISO, lat: BIRTH_LAT, lng: BIRTH_LNG,
        points, now: NOW, futureYears: 2, orbDeg: 2.5,
      })) === JSON.stringify(p));

    // A tighter orb can only ever contact fewer eclipses.
    const tight = eclipseProfile(Astronomy, {
      dateISO: BIRTH_ISO, lat: BIRTH_LAT, lng: BIRTH_LNG,
      points, now: NOW, futureYears: 2, orbDeg: 0.5,
    });
    t("a tighter orb contacts no more eclipses than a wider one",
      tight.contacted.length <= p.contacted.length,
      `${tight.contacted.length} at 0.5° vs ${p.contacted.length} at 2.5°`);

    // historyYears shortens the backward reach without touching the future.
    const recent = eclipseProfile(Astronomy, {
      dateISO: BIRTH_ISO, lat: BIRTH_LAT, lng: BIRTH_LNG,
      points, now: NOW, futureYears: 2, historyYears: 5,
    });
    t("historyYears shortens the series", recent.eclipses.length < p.eclipses.length);
    t("historyYears leaves the upcoming set alone", recent.upcoming.length === p.upcoming.length);
    t("the prenatal pair is unaffected by historyYears",
      recent.prenatal.solar.peakISO === p.prenatal.solar.peakISO);

    t("an unparseable birth date throws rather than returning nonsense", (() => {
      try { eclipseProfile(Astronomy, { dateISO: "not a date" }); return false; } catch { return true; }
    })());

    // A profile with no place still computes — it just carries no geophysics.
    const placeless = eclipseProfile(Astronomy, {
      dateISO: BIRTH_ISO, points, now: NOW, futureYears: 1,
    });
    t("a placeless profile still resolves the eclipses", placeless.eclipses.length > 0);
    t("a placeless profile carries no birthplace geophysics",
      placeless.eclipses.every(e => e.fromPlace === undefined));
  }

  return rows;
}
