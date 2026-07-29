// live.jsx — Cylindrical Time live state panel.
//
// Mounts a "now" tick (refreshes every 60s) and renders the user's running
// cylindrical coordinate: Maya Long Count, Tzolk'in × Haab, TCO phase,
// current tight transits to the natal chart, and a phase-syndrome readout.

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
  const data = React.useMemo(() => {
    const jdNow = dateToJD(now);
    return {
      jdNow,
      ctm:      ctmState(jdNow, chart.jd),
      transits: currentTransits(chart, jdNow),
      prog:     null, // computed below from age
    };
  }, [now.getTime() - (now.getTime() % 60000), chart.jd]);

  // Secondary progressions at current age
  const prog = React.useMemo(
    () => progressedAt(chart.jd, data.ctm.ageYears),
    [chart.jd, data.ctm.ageYears]
  );

  const lc = data.ctm.longCount;
  const tz = data.ctm.tzolkin;
  const ha = data.ctm.haab;
  return (
    <section className="cl">
      <header className="cl-head">
        <div>
          <div className="cl-title">Cylindrical Time · live state</div>
          <div className="cl-sub">
            ℝ × S¹ · the natal point now indexed against today's running coordinate
          </div>
        </div>
        <div className="cl-now">{now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
      </header>

      <div className="cl-grid">
        <div className="cl-card">
          <h4>z · linear coordinate</h4>
          <div className="cl-big">{lc.formatted}</div>
          <div className="cl-rows">
            <div className="cl-row"><span className="l">Long Count</span><span className="v">{lc.baktun}.{lc.katun}.{lc.tun}.{lc.winal}.{lc.kinDay}</span></div>
            <div className="cl-row"><span className="l">kin (days since epoch)</span><span className="v">{lc.kin.toLocaleString()}</span></div>
            <div className="cl-row"><span className="l">age</span><span className="v">{data.ctm.ageYears.toFixed(3)} yr</span></div>
            <div className="cl-row"><span className="l">days lived</span><span className="v">{Math.floor(data.ctm.ageDays).toLocaleString()}</span></div>
          </div>
        </div>

        <div className="cl-card">
          <h4>θ · cyclic coordinate</h4>
          <div className="cl-big">{tz.number} {tz.sign}</div>
          <div className="cl-rows">
            <div className="cl-row"><span className="l">Tzolk'in (260)</span><span className="v">{tz.number} {tz.sign}</span></div>
            <div className="cl-row"><span className="l">Haab (365)</span><span className="v">{ha.day} {ha.month}</span></div>
            <div className="cl-row"><span className="l">Calendar Round</span><span className="v">{data.ctm.calendarRound} / 18,980</span></div>
            <div className="cl-row"><span className="l">TCO phase P (mod {data.ctm.tco.M})</span><span className="v">{data.ctm.tco.P}</span></div>
            <div className="cl-row"><span className="l">θ (deg)</span><span className="v">{data.ctm.tco.thetaDeg.toFixed(2)}°</span></div>
            <div className="cl-row"><span className="l">phase syndrome S</span><span className="v">{data.ctm.syndromeDeg.toFixed(2)}°</span></div>
          </div>
        </div>

        <div className="cl-card">
          <h4>Helix · z vs θ</h4>
          <HelixViz syndrome={data.ctm.syndromeDeg} ageYears={data.ctm.ageYears} />
        </div>
      </div>

      <div className="cl-card cl-card-wide">
        <h4>Active transits — tight aspects from current sky to natal</h4>
        {data.transits.hits.length === 0 ? (
          <div className="cl-row"><span className="l">no transits within 2° right now</span></div>
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
        <h4>Secondary progressions (one day per year of life)</h4>
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
function HelixViz({ syndrome, ageYears }) {
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
