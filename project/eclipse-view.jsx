// eclipse-view.jsx — the eclipse panel: prenatal pair, lifetime series,
// what each eclipse touched in the chart, and where on Earth it happened.
//
// All arithmetic lives in eclipses.js (a plain, Node-testable module driven
// by the vendored astronomy engine); this file only renders it. The panel
// is deliberately honest about three things the numbers cannot carry on
// their own:
//
//   · WHERE. A total/annular solar eclipse has a real shadow axis, so its
//     coordinate is the point of greatest eclipse. A purely partial one has
//     no axis touching Earth and a lunar eclipse has no track at all, so
//     those show the subsolar/sublunar point — the place the eclipsed body
//     stood at zenith. The basis is printed next to every coordinate.
//
//   · SEEN. "Above horizon" means the body was up at the birthplace at
//     peak — necessary for visibility, nowhere near sufficient (cloud, and
//     for a solar eclipse the observer's distance from the track). The
//     column says "above horizon", never "you saw it".
//
//   · REAL EPHEMERIS ONLY. Eclipse geometry needs the vendored
//     astronomy-engine; the SYNTHETIC mean-motion fallback behind
//     window.EPHEMERIS_MODE cannot resolve a shadow axis. With no engine
//     the panel says so instead of printing invented coordinates.

const { useState: $ecState, useEffect: $ecEffect, useMemo: $ecMemo } = React;

/**
 * The natal points an eclipse can land on: the bodies, the two angles, and
 * nothing else.
 *
 * ASC/MC only — not DSC/IC: contactsFor() already tests BOTH conjunction
 * and opposition, so adding the opposite angles would report every hit
 * twice ("conjunct IC" and "opposite MC" are one event). The South Node is
 * dropped for the same reason: it is the North Node's opposite point.
 * The angles drop out entirely on an unknown-birth-time chart, where they
 * are not real to begin with.
 *
 * The Hellenistic lots are deliberately NOT included. They are derived
 * points rather than significators an eclipse is classically read against,
 * and there are seven of them — including them raised the "lands on this
 * chart" list from roughly half the series to nearly all of it, which is
 * arithmetic, not meaning: with N points and a ±orb window the expected hit
 * rate per eclipse is N·2·orb/360, so padding the point list makes the
 * filter stop filtering. A reader who wants a shorter list tightens the
 * eclipse orb; one who wants a longer list widens it.
 */
function eclipsePointsFor(chart) {
  const pts = chart.planets
    .filter(p => p.name !== "SouthNode")
    .map(p => ({ name: p.name, lon: p.lon }));
  if (!chart.timeUnknown) {
    pts.push({ name: "ASC", lon: chart.asc });
    pts.push({ name: "MC",  lon: chart.mc  });
  }
  return pts;
}

function signOf(lon) {
  const idx = Math.floor(((lon % 360) + 360) % 360 / 30);
  return { idx, name: ZODIAC[idx].name, glyph: ZODIAC[idx].glyph, deg: (((lon % 360) + 360) % 360) - idx * 30 };
}

function fmtDegree(lon) {
  const s = signOf(lon);
  return `${s.deg.toFixed(2)}° ${s.name}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

const KIND_LABEL = {
  total: "total", annular: "annular", partial: "partial", penumbral: "penumbral",
};

const GEO_BASIS_NOTE = {
  greatest: "point of greatest eclipse (shadow axis on Earth)",
  subsolar: "subsolar point at peak — a partial eclipse has no shadow axis on Earth",
  sublunar: "sublunar point at peak — a lunar eclipse has no ground track",
};

function EclipseGeo({ rec }) {
  if (!rec) return null;
  const fp = rec.fromPlace;
  return (
    <>
      <div className="tp-row">
        <span className="l">where on Earth</span>
        <span className="v" title={GEO_BASIS_NOTE[rec.geoBasis] || ""}>{rec.geoLabel}</span>
      </div>
      <div className="tp-row">
        <span className="l">coordinate basis</span>
        <span className="v">{rec.geoBasis === "greatest" ? "greatest eclipse" : rec.geoBasis === "sublunar" ? "sublunar point" : "subsolar point"}</span>
      </div>
      {fp && (
        <>
          <div className="tp-row">
            <span className="l">from birthplace</span>
            <span className="v">{Math.round(fp.distanceKm).toLocaleString()} km {fp.compass} ({fp.bearingDeg.toFixed(0)}°)</span>
          </div>
          <div className="tp-row">
            <span className="l">at your birthplace</span>
            <span className="v">
              {fp.aboveHorizon
                ? `above horizon, altitude ${fp.altitudeDeg.toFixed(1)}°`
                : `below horizon (${fp.altitudeDeg.toFixed(1)}°) — not visible from there`}
            </span>
          </div>
        </>
      )}
    </>
  );
}

function PrenatalCard({ title, rec, note }) {
  if (!rec) {
    return (
      <div className="tp-card">
        <h4>{title}</h4>
        <div className="tp-row"><span className="l">unavailable</span><span className="v">no eclipse of this kind found in the year before birth</span></div>
      </div>
    );
  }
  return (
    <div className="tp-card">
      <h4>{title}</h4>
      <div className="tp-row"><span className="l">date</span><span className="v">{fmtDateTime(rec.peakISO)}</span></div>
      <div className="tp-row"><span className="l">kind</span><span className="v">{KIND_LABEL[rec.kind] || rec.kind}</span></div>
      <div className="tp-row"><span className="l">eclipse degree</span><span className="v">{fmtDegree(rec.lon)}</span></div>
      {rec.obscuration != null && rec.kind !== "penumbral" && (
        <div className="tp-row"><span className="l">obscuration</span><span className="v">{(rec.obscuration * 100).toFixed(1)}%</span></div>
      )}
      <EclipseGeo rec={rec} />
      <div className="tp-row">
        <span className="l">natal contacts</span>
        <span className="v">
          {rec.contacts && rec.contacts.length
            ? rec.contacts.map(c => `${c.aspect === "conjunction" ? "☌" : "☍"} ${c.name} ${c.orb.toFixed(2)}°`).join(" · ")
            : "none within orb"}
        </span>
      </div>
      {note && <div className="tp-row"><span className="l">reading</span><span className="v" style={{ color: "var(--ink-dim)" }}>{note}</span></div>}
    </div>
  );
}

function EclipseRows({ rows, emptyText }) {
  if (!rows.length) {
    return <div className="tp-row"><span className="l">none</span><span className="v">{emptyText}</span></div>;
  }
  return (
    <table className="tp-table ec-table">
      <thead>
        <tr>
          <th>date</th>
          <th>eclipse</th>
          <th>degree</th>
          <th>where on Earth</th>
          <th className="num">km from birthplace</th>
          <th>natal contact</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(e => (
          <tr key={`${e.type}-${e.peakMs}`}>
            <td>{fmtDate(e.peakISO)}</td>
            <td>{e.type === "solar" ? "☉ solar" : "☽ lunar"} · {KIND_LABEL[e.kind] || e.kind}</td>
            <td>{fmtDegree(e.lon)}</td>
            <td title={GEO_BASIS_NOTE[e.geoBasis] || ""}>
              {e.geoLabel}
              <span className="ec-basis">{e.geoBasis === "greatest" ? "greatest" : e.geoBasis === "sublunar" ? "sublunar" : "subsolar"}</span>
            </td>
            <td className="num">
              {e.fromPlace ? Math.round(e.fromPlace.distanceKm).toLocaleString() : "—"}
              {e.fromPlace && !e.fromPlace.aboveHorizon && <span className="ec-basis">below horizon</span>}
            </td>
            <td>
              {e.contacts && e.contacts.length
                ? e.contacts.map(c => `${c.aspect === "conjunction" ? "☌" : "☍"} ${c.name} ${c.orb.toFixed(1)}°`).join(", ")
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Where the luminaries stood on the ground at the birth instant: the points
 * on Earth with the Sun and the Moon at zenith. Same geophysical projection
 * the eclipse coordinates use, applied to the nativity itself.
 */
function BirthGeophysics({ chart }) {
  const geo = $ecMemo(() => {
    if (typeof window === "undefined" || !window.Eclipses || !window.Astronomy) return null;
    try {
      const time = window.Astronomy.MakeTime(new Date(chart.birth.dateISO));
      return {
        sun: window.Eclipses.subsolarPoint(window.Astronomy, time),
        moon: window.Eclipses.sublunarPoint(window.Astronomy, time),
      };
    } catch { return null; }
  }, [chart.birth.dateISO]);

  const lat = chart.birth.lat, lng = chart.birth.lng;
  return (
    <div className="tp-card">
      <h4>Geophysical position</h4>
      <div className="tp-row"><span className="l">birthplace</span><span className="v">{chart.birth.placeLabel || "—"}</span></div>
      <div className="tp-row">
        <span className="l">coordinates</span>
        <span className="v">{window.Eclipses ? window.Eclipses.formatLatLon(lat, lng) : `${lat}, ${lng}`}</span>
      </div>
      {geo && (
        <>
          <div className="tp-row">
            <span className="l">Sun at zenith over</span>
            <span className="v">{window.Eclipses.formatLatLon(geo.sun.lat, geo.sun.lon)}</span>
          </div>
          <div className="tp-row">
            <span className="l">Moon at zenith over</span>
            <span className="v">{window.Eclipses.formatLatLon(geo.moon.lat, geo.moon.lon)}</span>
          </div>
          <div className="tp-row">
            <span className="l">Sun ground distance</span>
            <span className="v">
              {Math.round(window.Eclipses.greatCircleDistanceKm({ lat, lon: lng }, { lat: geo.sun.lat, lon: geo.sun.lon })).toLocaleString()} km
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The panel. Computation is deferred one tick past mount: a full-life
 * series is ~200 real ephemeris searches (both series, ~50 years), which is
 * fast but not free, and running it inside the first render would stall the
 * paint of the whole spread behind it.
 */
function EclipsePanel({ chart, settings }) {
  const [profile, setProfile] = $ecState(null);
  const [error, setError] = $ecState(null);
  const [showAll, setShowAll] = $ecState(false);

  const orbDeg = Number(settings && settings.eclipseOrb) > 0 ? Number(settings.eclipseOrb) : 2.5;
  const futureYears = Number(settings && settings.eclipseWindow) > 0 ? Number(settings.eclipseWindow) : 2;
  const engineReady = typeof window !== "undefined" && !!window.Eclipses && !!window.Astronomy;

  $ecEffect(() => {
    if (!engineReady) return undefined;
    let cancelled = false;
    setProfile(null);
    setError(null);
    const id = setTimeout(() => {
      try {
        const p = window.Eclipses.profileFor({
          dateISO: chart.birth.dateISO,
          lat: chart.birth.lat,
          lng: chart.birth.lng,
          points: eclipsePointsFor(chart),
          now: new Date(),
          futureYears,
          orbDeg,
        });
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) setError(e && e.message ? e.message : String(e));
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(id); };
  }, [chart.birth.dateISO, chart.birth.lat, chart.birth.lng, chart.timeUnknown, orbDeg, futureYears, engineReady]);

  if (!engineReady) {
    return (
      <section className="tp ec">
        <header className="tp-head">
          <div className="tp-title">Eclipses · geophysical</div>
          <div className="tp-sub">needs the full ephemeris</div>
        </header>
        <div className="tp-card">
          <div className="tp-row">
            <span className="l">engine</span>
            <span className="v">
              Eclipse geometry needs the full ephemeris. The offline model cannot
              place a shadow axis, so nothing is shown rather than something invented.
            </span>
          </div>
        </div>
      </section>
    );
  }

  const contacted = profile ? profile.contacted : [];
  const shown = showAll ? (profile ? profile.eclipses : []) : contacted;

  return (
    <section className="tp ec">
      <header className="tp-head">
        <div className="tp-title">Eclipses · geophysical</div>
        <div className="tp-sub">
          prenatal pair · every eclipse from birth to {futureYears} year{futureYears === 1 ? "" : "s"} ahead ·
          {" "}greatest-eclipse and sub-body coordinates · contacts within {orbDeg}°
        </div>
      </header>

      {error && (
        <div className="tp-card">
          <div className="tp-row"><span className="l">unavailable</span><span className="v">{error}</span></div>
        </div>
      )}

      {!profile && !error && (
        <div className="tp-card">
          <div className="tp-row"><span className="l">computing</span><span className="v">walking both eclipse series across the lifetime…</span></div>
        </div>
      )}

      {profile && (
        <>
          <div className="tp-grid">
            <PrenatalCard
              title="Prenatal solar eclipse"
              rec={profile.prenatal.solar}
              note="The last solar eclipse before birth — classically the seed degree the nativity grows out of."
            />
            <PrenatalCard
              title="Prenatal lunar eclipse"
              rec={profile.prenatal.lunar}
              note="Its counterweight: the last lunar eclipse before birth."
            />
            <BirthGeophysics chart={chart} />
          </div>

          <div className="tp-card" style={{ marginTop: 16 }}>
            <h4>
              {showAll ? "Every eclipse, birth to date" : "Eclipses that land on this chart"}
              <button
                type="button"
                className="ec-toggle"
                onClick={() => setShowAll(v => !v)}
                aria-pressed={showAll}
              >
                {showAll ? `show only the ${contacted.length} contacting` : `show all ${profile.eclipses.length}`}
              </button>
            </h4>
            <EclipseRows
              rows={shown}
              emptyText={showAll
                ? "no eclipses in the computed window"
                : `no eclipse in this window falls within ${orbDeg}° of a natal point`}
            />
            {profile.truncated && (
              <div className="tp-row">
                <span className="l">note</span>
                <span className="v">the series hit its walk limit and was cut short — some later eclipses are not listed</span>
              </div>
            )}
          </div>

          <div className="tp-card" style={{ marginTop: 16 }}>
            <h4>Still ahead</h4>
            <EclipseRows rows={profile.upcoming} emptyText="none within the configured window" />
          </div>
        </>
      )}
    </section>
  );
}

Object.assign(window, { EclipsePanel, eclipsePointsFor });
