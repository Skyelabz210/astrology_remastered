// live.jsx — Cylindrical Time · the lifecycle panel.
//
// The chart, addressed at ANY instant of its lifecycle. Defaults to a
// ticking "now" (refreshes every 60s); a date control retargets the whole
// panel — the cylindrical coordinate, the winding lift (per-body circuit
// counts K + shadow-lane state against natal), tight transits to the
// natal chart at the target moment, and secondary progressions at the
// target age. Prior states are addressable the same way: the winding
// counts simply run negative before birth.

function useNow(intervalMs = 60000) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function LiveStatePanel({ chart }) {
  const now = useNow(60000);
  // Target instant: "now" keeps ticking; picking a date freezes the panel
  // on that day (noon UTC — the panel reads whole days of the lifecycle).
  // null = ticking now · "birth" = the exact birth instant · a date string
  // = noon UTC of that day (the panel reads whole days of the lifecycle).
  const [targetDate, setTargetDate] = React.useState(null);
  const birthISO = chart.birth && chart.birth.dateISO;
  const target = targetDate === "birth" && birthISO
    ? new Date(birthISO)
    : targetDate && targetDate !== "birth"
    ? new Date(`${targetDate}T12:00:00Z`)
    : now;
  const data = React.useMemo(() => {
    const jdT = dateToJD(target);
    return {
      jdT,
      ctm:      ctmState(jdT, chart.jd),
      transits: currentTransits(chart, jdT),
      lift:     windingLift(chart, jdT),
    };
  }, [target.getTime() - (target.getTime() % 60000), chart.jd]);

  // Perfections: a year-wide scan of the real ephemeris, so it runs OFF the
  // render path — one transiting body per tick, accumulated into state.
  // Keyed to a 30-day block of the target so scrubbing nearby dates reuses
  // the same window instead of rescanning; the day offsets shown are
  // re-derived from the live target at render time.
  const perfKey = `${chart.jd}:${Math.round(data.jdT / 30)}`;
  const [perf, setPerf] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    setPerf(null);
    const centre = data.jdT;
    const bodies = ["Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
    const acc = [];
    const runBody = (i) => {
      if (!alive) return;
      if (i >= bodies.length) {
        acc.sort((a, b) => a.jd - b.jd);
        setPerf({ hits: acc });
        return;
      }
      acc.push(...transitPerfections(chart, centre, 366, [bodies[i]]).hits);
      setTimeout(() => runBody(i + 1), 0);
    };
    const t = setTimeout(() => runBody(0), 0);
    return () => { alive = false; clearTimeout(t); };
  }, [perfKey]);

  // The sixteen perfections nearest the live target, in calendar order.
  const perfRows = React.useMemo(() => {
    if (!perf) return null;
    return perf.hits
      .map((h) => ({ ...h, dDays: h.jd - data.jdT }))
      .sort((a, b) => Math.abs(a.dDays) - Math.abs(b.dDays))
      .slice(0, 16)
      .sort((a, b) => a.jd - b.jd);
  }, [perf, data.jdT]);

  // Secondary progressions at current age
  const prog = React.useMemo(
    () => progressedAt(chart.jd, data.ctm.ageYears),
    [chart.jd, data.ctm.ageYears]
  );

  return (
    <section className="cl">
      <header className="cl-head">
        <div>
          <div className="cl-title">Cylindrical Time · any point of the lifecycle</div>
          <div className="cl-sub">
            ℝ × S¹ · the chart addressed at a chosen instant — earlier states recovered through the winding lift against the shadow prime
          </div>
        </div>
        <div className="cl-target">
          <button
            className={`cl-target-btn ${targetDate === null ? "is-on" : ""}`}
            onClick={() => setTargetDate(null)}
            type="button"
          >now</button>
          {birthISO && (
            <button
              className={`cl-target-btn ${targetDate === "birth" ? "is-on" : ""}`}
              onClick={() => setTargetDate("birth")}
              type="button"
            >birth</button>
          )}
          <input
            className="cl-target-date"
            type="date"
            aria-label="target date — address the chart at this moment of its lifecycle"
            value={targetDate && targetDate !== "birth" ? targetDate : ""}
            onChange={(e) => setTargetDate(e.target.value || null)}
          />
          <span className="cl-now">{targetDate
            ? target.toLocaleDateString(undefined, { dateStyle: "medium" })
            : now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      </header>

      <div className="cl-grid">
        <div className="cl-card">
          <h4>z · linear coordinate</h4>
          <div className="cl-big">{Math.floor(data.ctm.ageDays).toLocaleString()} d</div>
          <div className="cl-rows">
            <div className="cl-row"><span className="l">days from birth</span><span className="v">{Math.floor(data.ctm.ageDays).toLocaleString()}</span></div>
            <div className="cl-row"><span className="l">age at target</span><span className="v">{data.ctm.ageYears.toFixed(3)} yr</span></div>
            <div className="cl-row"><span className="l">days since the anchor epoch</span><span className="v">{data.ctm.longCount.kin.toLocaleString()}</span></div>
          </div>
        </div>

        <div className="cl-card">
          <h4>θ · cyclic coordinate</h4>
          <div className="cl-big">{data.ctm.tco.thetaDeg.toFixed(1)}°</div>
          <div className="cl-rows">
            <div className="cl-row"><span className="l">phase P on the {data.ctm.tco.M.toLocaleString()}-day round</span><span className="v">{data.ctm.tco.P.toLocaleString()}</span></div>
            <div className="cl-row"><span className="l">θ (deg)</span><span className="v">{data.ctm.tco.thetaDeg.toFixed(2)}°</span></div>
            <div className="cl-row"><span className="l">phase syndrome S vs birth</span><span className="v">{data.ctm.syndromeDeg.toFixed(2)}°</span></div>
          </div>
        </div>

        <div className="cl-card">
          <h4>Helix · z vs θ</h4>
          <HelixViz syndrome={data.ctm.syndromeDeg} />
        </div>
      </div>

      <div className="cl-card cl-card-wide">
        <h4>The winding lift · K against the shadow prime</h4>
        <p className="cl-note">
          Each body's state at the target is two numbers: K, the circuits it has closed since birth
          (negative before birth — earlier states are reached the same way), and its shadow-lane residue
          (arcsec mod 11) beside the natal one. Residue and winding together name the whole path — the
          register's K-elimination, run along the chart's own history. ↺ marks a shadow-lane return.
        </p>
        <table className="tp-table">
          <thead>
            <tr><th>body</th><th className="num">circuits K</th><th className="num">lane₁₁ at target</th><th className="num">natal lane₁₁</th><th>return</th></tr>
          </thead>
          <tbody>
            {data.lift.rows.map((r) => (
              <tr key={r.name}>
                <td><span className="pl-gl">{r.glyph}</span> {r.name}</td>
                <td className="num">{r.K.toLocaleString()}</td>
                <td className="num">{r.lane11}</td>
                <td className="num">{r.natalLane}</td>
                <td>{r.isReturn ? "↺ in its natal lane" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cl-card cl-card-wide">
        <h4>Perfections · the road behind and ahead</h4>
        <p className="cl-note">
          The exact instants the slow sky strikes this chart, inside the year around the target —
          each date is when the aspect actually perfects, found on the full ephemeris and refined to
          the second. A retrograde loop that crosses, backs over, and re-crosses a natal point
          reports all three passes. A body's conjunction to its own natal place is its return.
        </p>
        {!perfRows ? (
          <div className="cl-row"><span className="l">charting the year around the target…</span></div>
        ) : perfRows.length === 0 ? (
          <div className="cl-row"><span className="l">no perfections from the slow bodies in this window</span></div>
        ) : (
          <table className="tp-table">
            <thead>
              <tr><th>date</th><th>transit</th><th>aspect</th><th>natal</th><th className="num">from target</th></tr>
            </thead>
            <tbody>
              {perfRows.map((h, i) => (
                <tr key={i} className={Math.abs(h.dDays) < 7 ? "is-near" : ""}>
                  <td>{h.dateISO.slice(0, 10)}</td>
                  <td><span className="pl-gl">{h.transitGlyph}</span> {h.transit}{h.retrograde ? " ℞" : ""}</td>
                  <td>{h.aspect}</td>
                  <td><span className="pl-gl">{h.natalGlyph}</span> {h.natal}</td>
                  <td className="num">{h.dDays >= 0 ? "+" : ""}{Math.round(h.dDays)} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {perf && perf.hits.length > 16 && (
          <div className="cl-row"><span className="l">{perf.hits.length} perfections in the full year — the sixteen nearest the target are shown</span></div>
        )}
      </div>

      <div className="cl-card cl-card-wide">
        <h4>Transits at the target — tight aspects from that sky to natal</h4>
        {data.transits.hits.length === 0 ? (
          <div className="cl-row"><span className="l">no transits within 2° at the target moment</span></div>
        ) : (
          <table className="tp-table">
            <thead>
              <tr><th>transit</th><th>aspect</th><th>natal</th><th className="num">orb</th><th>phase</th></tr>
            </thead>
            <tbody>
              {data.transits.hits.slice(0, 12).map((h, i) => (
                <tr key={i}>
                  <td><span className="pl-gl">{h.Tglyph}</span> {h.T}{h.retrograde ? " ℞" : ""}</td>
                  <td>{h.aspect}</td>
                  <td><span className="pl-gl">{h.Nglyph}</span> {h.N}</td>
                  <td className="num">{h.orb.toFixed(2)}°</td>
                  <td>{h.phase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cl-card cl-card-wide">
        <h4>Secondary progressions at the target age (one day per year of life)</h4>
        <table className="tp-table">
          <thead><tr><th>body</th><th className="num">progressed λ</th><th>sign</th><th className="num">natal λ</th><th className="num">Δ</th></tr></thead>
          <tbody>
            {prog.bodies.map(b => {
              const natal = chart.planets.find(p => p.name === b.name);
              const delta = mod360(b.lon - natal.lon);
              return (
                <tr key={b.name}>
                  <td><span className="pl-gl">{b.glyph}</span> {b.name}</td>
                  <td className="num">{b.lon.toFixed(2)}°</td>
                  <td>{b.signName}</td>
                  <td className="num">{natal.lon.toFixed(2)}°</td>
                  <td className="num">{(delta > 180 ? delta - 360 : delta).toFixed(2)}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Small helix viz: orthographic side view of the cylinder, current point
// glowing. Static but feels alive because z accumulates each second.
function HelixViz({ syndrome }) {
  const W = 280, H = 160;
  const turns = 6;
  const points = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const theta = 2 * Math.PI * turns * t;
    const x = W * 0.5 + Math.cos(theta) * 50;
    const y = H * (1 - t) * 0.9 + H * 0.05;
    points.push([x, y, Math.sin(theta)]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cl-helix">
      <defs>
        <linearGradient id="helixg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.95 0.012 80)" stopOpacity="1"/>
          <stop offset="100%" stopColor="oklch(0.95 0.012 80)" stopOpacity="0.2"/>
        </linearGradient>
      </defs>
      <line x1={W/2-50} y1={H*0.05} x2={W/2-50} y2={H*0.95} stroke="oklch(0.95 0.012 80 / 0.18)" strokeWidth="0.5"/>
      <line x1={W/2+50} y1={H*0.05} x2={W/2+50} y2={H*0.95} stroke="oklch(0.95 0.012 80 / 0.18)" strokeWidth="0.5"/>
      <path
        d={"M " + points.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")}
        fill="none"
        stroke="url(#helixg)"
        strokeWidth="1.2"
        strokeOpacity="0.7"
      />
      {/* current point — the user's now */}
      {(() => {
        const phaseT = (syndrome / 360) % 1;
        const i = Math.floor(phaseT * 200);
        const [x, y] = points[i] || [W/2, H/2];
        return (
          <g>
            <circle cx={x} cy={y} r="6" fill="oklch(0.95 0.05 60)" opacity="0.25"/>
            <circle cx={x} cy={y} r="3" fill="oklch(0.98 0.06 60)"/>
          </g>
        );
      })()}
      <text x={W/2} y={H-4} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill="oklch(0.65 0.012 80)" letterSpacing="0.08em">
        z grows · θ wraps · S = {syndrome.toFixed(1)}°
      </text>
    </svg>
  );
}

Object.assign(window, { LiveStatePanel, useNow });
