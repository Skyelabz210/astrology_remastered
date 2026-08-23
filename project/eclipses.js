// eclipses.js — solar and lunar eclipse series, with the geophysical
// coordinates of each eclipse and its contacts to a natal chart.
//
// Dual-environment module, same pattern as validate.js / tzresolve.js:
// `export`ed for Node (test/present/eclipses.test.js imports it directly)
// and published as `window.Eclipses` for the Babel-standalone `.jsx` pages,
// which are plain classic scripts and cannot `import`. Load it as
// `<script type="module" src="eclipses.js"></script>`.
//
// DEPENDENCY INJECTION, not import: every entry point takes the astronomy
// engine as its first argument. In the browser that is the vendored UMD
// bundle's `window.Astronomy` (a classic script — an ES module cannot
// import it); under Node it is `await import("astronomy-engine")`, the same
// package.json dependency tools/ephemeris/* already uses. Passing it in is
// what lets the test suite exercise THIS code against the REAL ephemeris
// rather than a hand-copied stub, and mirrors how validate.js takes the
// polar-fallback policy table as a parameter instead of importing it.
//
// Two distinct "where on Earth" answers are computed here, and they are not
// interchangeable:
//
//   · Solar — astronomy-engine's GlobalSolarEclipseInfo carries the
//     latitude/longitude of GREATEST ECLIPSE: the point where the Moon's
//     shadow axis touches Earth closest to its centre. The library defines
//     those two fields ONLY for total and annular eclipses (the axis misses
//     Earth entirely on a purely partial one), so a partial eclipse falls
//     back to the SUBSOLAR point at peak and is labelled as such — an
//     honest, differently-derived coordinate rather than a silent blank.
//
//   · Lunar — a lunar eclipse has no shadow track on the ground; it is
//     visible from the whole night hemisphere at once. The meaningful
//     single coordinate is the SUBLUNAR point at peak (the Moon at zenith),
//     computed here from the Moon's equator-of-date right ascension against
//     Greenwich apparent sidereal time.
//
// Angles are degrees, distances kilometres, times ISO-8601 UTC strings.

/** Mean Earth radius (IUGG), km — used for the great-circle distances below. */
export const EARTH_RADIUS_KM = 6371.0088;

/**
 * Default conjunction orb, in degrees, for calling an eclipse a "hit" on a
 * natal point. 2.5° is the working figure in the eclipse literature for
 * treating an eclipse as activating a natal placement — wide enough that a
 * real contact is not missed, tight enough that a 30°-wide sign does not
 * light up wholesale. Every entry point takes it as an option.
 */
export const DEFAULT_ECLIPSE_ORB_DEG = 2.5;

const DEG = Math.PI / 180;

function mod360(x) { return ((x % 360) + 360) % 360; }

/** Wrap a longitude into (−180, +180], the convention both fields below use. */
export function normalizeLon180(deg) {
  const m = mod360(deg);
  return m > 180 ? m - 360 : m;
}

/** Signed-degree formatter for a geographic coordinate pair. */
export function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

/**
 * Great-circle distance between two {lat, lon} points, km (haversine on a
 * sphere of radius EARTH_RADIUS_KM). Good to ~0.5% against the ellipsoid,
 * which is far finer than the question being asked here ("how far from my
 * birthplace did the shadow fall").
 */
export function greatCircleDistanceKm(a, b) {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial great-circle bearing from `a` to `b`, degrees clockwise from north. */
export function initialBearingDeg(a, b) {
  const φ1 = a.lat * DEG, φ2 = b.lat * DEG, Δλ = (b.lon - a.lon) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return mod360(Math.atan2(y, x) / DEG);
}

const COMPASS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

/** 16-point compass label for a bearing in degrees. */
export function compassPoint(bearingDeg) {
  return COMPASS[Math.round(mod360(bearingDeg) / 22.5) % 16];
}

// ──────────────────────────────────────────────────────────────────────
// engine-backed primitives
// ──────────────────────────────────────────────────────────────────────

/** Geocentric apparent ecliptic longitude of a body at `time`, degrees. */
export function eclipticLongitudeOf(Astronomy, bodyName, time) {
  const vec = Astronomy.GeoVector(Astronomy.Body[bodyName], time, true);
  return mod360(Astronomy.Ecliptic(vec).elon);
}

/**
 * Sub-body point: the {lat, lon} on Earth where `bodyName` stands at zenith
 * at `time`. Equator-of-date right ascension against Greenwich apparent
 * sidereal time — λ_east = 15·(RA_hours − GAST_hours), φ = declination.
 */
export function subBodyPoint(Astronomy, bodyName, time) {
  const eqj = Astronomy.GeoVector(Astronomy.Body[bodyName], time, true);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), eqj);
  const eq = Astronomy.EquatorFromVector(eqd);
  return {
    lat: eq.dec,
    lon: normalizeLon180(15 * (eq.ra - Astronomy.SiderealTime(time))),
  };
}

/** The point on Earth where the Moon is overhead at `time`. */
export function sublunarPoint(Astronomy, time) { return subBodyPoint(Astronomy, "Moon", time); }

/** The point on Earth where the Sun is overhead at `time`. */
export function subsolarPoint(Astronomy, time) { return subBodyPoint(Astronomy, "Sun", time); }

/**
 * Apparent altitude of a body above the horizon at a given place and time,
 * degrees (refraction-corrected). Positive means the body was up — the
 * necessary condition for an eclipse to have been visible from there at
 * all. It is NOT sufficient: cloud, and for solar eclipses the observer's
 * position relative to the shadow track, decide the rest. The record below
 * reports it as `aboveHorizon`, never as "you saw it".
 */
export function altitudeDegAt(Astronomy, bodyName, time, lat, lng) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const eq = Astronomy.Equator(Astronomy.Body[bodyName], time, observer, true, true);
  return Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal").altitude;
}

function toTime(Astronomy, dateLike) {
  return Astronomy.MakeTime(dateLike instanceof Date ? dateLike : new Date(dateLike));
}

// ──────────────────────────────────────────────────────────────────────
// eclipse records
// ──────────────────────────────────────────────────────────────────────

/**
 * Build the common record for one eclipse. `place` (optional {lat, lng}) adds
 * the birthplace-relative geophysics: how far the eclipse point was from
 * there, in which direction, and whether the eclipsed body was above that
 * horizon at peak.
 */
function makeRecord(Astronomy, { type, kind, peak, obscuration, geo, geoBasis }, place) {
  const lonBody = type === "solar" ? "Sun" : "Moon";
  const lon = eclipticLongitudeOf(Astronomy, lonBody, peak);
  // The luminaries are opposed at a lunar eclipse and conjunct at a solar
  // one; carrying both longitudes lets a caller aspect either end of the
  // axis without recomputing anything.
  const oppositeLon = mod360(lon + 180);
  const signIdx = Math.floor(mod360(lon) / 30);
  const rec = {
    type,
    kind,
    peakISO: peak.date.toISOString(),
    peakMs: peak.date.getTime(),
    obscuration: typeof obscuration === "number" ? obscuration : null,
    lon,
    oppositeLon,
    signIdx,
    degInSign: mod360(lon) - signIdx * 30,
    geo,
    // "greatest" — shadow-axis point from the engine; "subsolar"/"sublunar"
    // — the zenith point, used where no shadow axis exists. Rendered to the
    // reader so the two are never conflated.
    geoBasis,
    geoLabel: formatLatLon(geo.lat, geo.lon),
  };
  if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    const home = { lat: place.lat, lon: place.lng };
    const bearing = initialBearingDeg(home, geo);
    const altitude = altitudeDegAt(Astronomy, lonBody, peak, place.lat, place.lng);
    rec.fromPlace = {
      distanceKm: greatCircleDistanceKm(home, geo),
      bearingDeg: bearing,
      compass: compassPoint(bearing),
      altitudeDeg: altitude,
      aboveHorizon: altitude > 0,
    };
  }
  return rec;
}

/**
 * Every solar eclipse with peak in [from, to). `cap` bounds the walk so a
 * mistaken range can never spin forever (each step is a real ephemeris
 * search); reaching it sets `truncated` on the series result rather than
 * silently returning a short list.
 *
 * The leading `< start` skip is load-bearing, not defensive noise: the
 * engine's Search*Eclipse() locates the eclipse at the syzygy nearest the
 * start of its scan and can therefore return one whose peak lies slightly
 * BEFORE the requested start — which is exactly why the engine's own
 * Next*Eclipse() helpers advance ten days before searching. Without the
 * skip, `eclipsesBetween(birth, …)` would open the lifetime series with an
 * eclipse that happened before the birth.
 */
export function solarEclipsesBetween(Astronomy, from, to, { place, cap = 400 } = {}) {
  const start = (from instanceof Date ? from : new Date(from)).getTime();
  const end = (to instanceof Date ? to : new Date(to)).getTime();
  const out = [];
  let e = Astronomy.SearchGlobalSolarEclipse(toTime(Astronomy, from));
  let truncated = false;
  while (e.peak.date.getTime() < end) {
    if (e.peak.date.getTime() < start) { e = Astronomy.NextGlobalSolarEclipse(e.peak); continue; }
    if (out.length >= cap) { truncated = true; break; }
    // latitude/longitude are defined by the library only where the shadow
    // axis actually meets Earth (total/annular) — see this file's header.
    const hasAxis = Number.isFinite(e.latitude) && Number.isFinite(e.longitude);
    out.push(makeRecord(Astronomy, {
      type: "solar",
      kind: e.kind,
      peak: e.peak,
      obscuration: e.obscuration,
      geo: hasAxis
        ? { lat: e.latitude, lon: normalizeLon180(e.longitude) }
        : subsolarPoint(Astronomy, e.peak),
      geoBasis: hasAxis ? "greatest" : "subsolar",
    }, place));
    e = Astronomy.NextGlobalSolarEclipse(e.peak);
  }
  return { eclipses: out, truncated };
}

/**
 * Every lunar eclipse (penumbral included) with peak in [from, to). The
 * `< start` skip is there for the same reason as in the solar walk above.
 */
export function lunarEclipsesBetween(Astronomy, from, to, { place, cap = 400 } = {}) {
  const start = (from instanceof Date ? from : new Date(from)).getTime();
  const end = (to instanceof Date ? to : new Date(to)).getTime();
  const out = [];
  let e = Astronomy.SearchLunarEclipse(toTime(Astronomy, from));
  let truncated = false;
  while (e.peak.date.getTime() < end) {
    if (e.peak.date.getTime() < start) { e = Astronomy.NextLunarEclipse(e.peak); continue; }
    if (out.length >= cap) { truncated = true; break; }
    out.push(makeRecord(Astronomy, {
      type: "lunar",
      kind: e.kind,
      peak: e.peak,
      obscuration: e.obscuration,
      geo: sublunarPoint(Astronomy, e.peak),
      geoBasis: "sublunar",
    }, place));
    e = Astronomy.NextLunarEclipse(e.peak);
  }
  return { eclipses: out, truncated };
}

/** Both series over [from, to), merged into one chronological list. */
export function eclipsesBetween(Astronomy, from, to, opts = {}) {
  const s = solarEclipsesBetween(Astronomy, from, to, opts);
  const l = lunarEclipsesBetween(Astronomy, from, to, opts);
  return {
    eclipses: [...s.eclipses, ...l.eclipses].sort((a, b) => a.peakMs - b.peakMs),
    truncated: s.truncated || l.truncated,
  };
}

/**
 * The prenatal eclipses: the last solar and the last lunar eclipse to occur
 * BEFORE the birth instant. Classical practice reads the prenatal solar
 * eclipse (the "prenatal syzygy" in its eclipse form) as the seed degree a
 * nativity grows out of; the prenatal lunar is its counterweight.
 *
 * Both are found by walking forward from `searchBackDays` before birth and
 * keeping the last event that still precedes it — a backward search is not
 * exposed by the engine. 400 days is deliberately more than the ~354-day
 * worst case between two eclipses of the same kind, so neither can come
 * back null for an ordinary date.
 */
export function prenatalEclipses(Astronomy, birthDate, { place, searchBackDays = 400 } = {}) {
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  const from = new Date(birth.getTime() - searchBackDays * 86400000);
  const solar = solarEclipsesBetween(Astronomy, from, birth, { place });
  const lunar = lunarEclipsesBetween(Astronomy, from, birth, { place });
  return {
    solar: solar.eclipses.length ? solar.eclipses[solar.eclipses.length - 1] : null,
    lunar: lunar.eclipses.length ? lunar.eclipses[lunar.eclipses.length - 1] : null,
  };
}

// ──────────────────────────────────────────────────────────────────────
// contact with the natal chart
// ──────────────────────────────────────────────────────────────────────

/** Shortest separation between two ecliptic longitudes, 0…180°. */
export function angularSeparation(a, b) {
  const d = Math.abs(mod360(a) - mod360(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Which natal points this eclipse touches, by conjunction or opposition to
 * the eclipse degree, within `orbDeg`.
 *
 * `points` is [{name, lon}] — the caller decides what counts as a point
 * (planets, angles, lots), so this module never has to know the chart's
 * shape. Returned tightest-first.
 */
export function contactsFor(eclipseLon, points, orbDeg = DEFAULT_ECLIPSE_ORB_DEG) {
  const hits = [];
  for (const p of points || []) {
    if (!p || !Number.isFinite(p.lon)) continue;
    const sepConj = angularSeparation(eclipseLon, p.lon);
    const sepOpp = Math.abs(180 - sepConj);
    if (sepConj <= orbDeg) hits.push({ name: p.name, aspect: "conjunction", orb: sepConj, lon: p.lon });
    else if (sepOpp <= orbDeg) hits.push({ name: p.name, aspect: "opposition", orb: sepOpp, lon: p.lon });
  }
  return hits.sort((a, b) => a.orb - b.orb);
}

/**
 * Full profile for one birth: the prenatal pair, the whole lifetime series
 * with natal contacts attached, and the eclipses still ahead.
 *
 * `now` is injected rather than read from the clock so the result is a pure
 * function of its inputs — the test suite pins it, and the browser passes
 * the real Date. `futureYears` extends the walk past `now`; `historyYears`,
 * when set, shortens the backward reach for a cheaper first paint (the
 * default walks the whole life from birth).
 */
export function eclipseProfile(Astronomy, {
  dateISO,
  lat,
  lng,
  points = [],
  now = new Date(),
  futureYears = 2,
  historyYears = null,
  orbDeg = DEFAULT_ECLIPSE_ORB_DEG,
} = {}) {
  const birth = new Date(dateISO);
  if (isNaN(birth.getTime())) throw new Error(`eclipseProfile: unparseable dateISO ${dateISO}`);
  const place = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const nowDate = now instanceof Date ? now : new Date(now);

  const YEAR_MS = 365.2425 * 86400000;
  const seriesFrom = historyYears == null
    ? birth
    : new Date(Math.max(birth.getTime(), nowDate.getTime() - historyYears * YEAR_MS));
  const seriesTo = new Date(nowDate.getTime() + futureYears * YEAR_MS);

  const prenatal = prenatalEclipses(Astronomy, birth, { place });
  const series = eclipsesBetween(Astronomy, seriesFrom, seriesTo, { place });

  const withContacts = series.eclipses.map((e) => ({
    ...e,
    contacts: contactsFor(e.lon, points, orbDeg),
    past: e.peakMs <= nowDate.getTime(),
  }));
  for (const e of [prenatal.solar, prenatal.lunar]) {
    if (e) { e.contacts = contactsFor(e.lon, points, orbDeg); e.past = true; }
  }

  return {
    birthISO: birth.toISOString(),
    place,
    orbDeg,
    prenatal,
    eclipses: withContacts,
    // The subset that actually lands on this chart — the reason to look at
    // a 200-entry series at all.
    contacted: withContacts.filter((e) => e.contacts.length > 0),
    upcoming: withContacts.filter((e) => !e.past),
    truncated: series.truncated,
    computedAtISO: nowDate.toISOString(),
  };
}

// Browser publication — see this file's header for the load-order contract.
if (typeof window !== "undefined") {
  window.Eclipses = {
    EARTH_RADIUS_KM,
    DEFAULT_ECLIPSE_ORB_DEG,
    normalizeLon180,
    formatLatLon,
    greatCircleDistanceKm,
    initialBearingDeg,
    compassPoint,
    eclipticLongitudeOf,
    subBodyPoint,
    sublunarPoint,
    subsolarPoint,
    altitudeDegAt,
    solarEclipsesBetween,
    lunarEclipsesBetween,
    eclipsesBetween,
    prenatalEclipses,
    angularSeparation,
    contactsFor,
    eclipseProfile,
    /**
     * Convenience wrapper for the .jsx layer: pulls the vendored engine off
     * `window.Astronomy` itself and returns null (rather than throwing) if
     * that script failed to load — the same "an offline page renders an
     * approximate chart, not a blank one" posture astro.jsx takes for its
     * own ASC/MC fallback. Eclipse geometry has no synthetic fallback: the
     * mean-motion model behind EPHEMERIS_MODE === "SYNTHETIC" cannot
     * resolve a shadow axis, so the panel says so instead of inventing one.
     */
    profileFor(options) {
      if (typeof window.Astronomy === "undefined" || !window.Astronomy) return null;
      return eclipseProfile(window.Astronomy, options);
    },
  };
}
