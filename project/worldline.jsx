// worldline.jsx — natal worldline panel for the full-spread chart.
// The panel reads only the cast chart's birth instant and birthplace.
// It keeps the CRAM day register, existing cylindrical calendar model, and
// idealized relativistic proper-time estimate as distinct displays.

function WorldlinePanel({ chart }) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const state = React.useMemo(() => {
    if (!chart || !chart.birth || !window.WorldlineCore) {
      return { error: "Worldline inputs are not available on this chart." };
    }
    try {
      const worldline = window.WorldlineCore.buildNatalWorldline({
        birthISO: chart.birth.dateISO,
        targetISO: now.toISOString(),
        latitudeDeg: chart.birth.lat,
        longitudeDeg: chart.birth.lng,
        altitudeM: 0,
      });
      const jdNow = 2440587.5 + now.getTime() / 86400000;
      const ctm = typeof window.ctmState === "function"
        ? window.ctmState(jdNow, chart.jd)
        : null;
      return { worldline, ctm };
    } catch (error) {
      return { error: error && error.message ? error.message : "Worldline calculation failed." };
    }
  }, [chart, now]);

  if (state.error) {
    return (
      <section className="wl-panel" aria-labelledby="wl-title">
        <div className="wl-head">
          <div>
            <div className="wl-kicker">spacetime · cyclical time</div>
            <h2 id="wl-title">Natal worldline</h2>
          </div>
        </div>
        <p role="alert" className="wl-warning">{state.error}</p>
      </section>
    );
  }

  const data = state.worldline;
  const ctm = state.ctm;
  const birth = data.input.birthISO;
  const dateText = (() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium", timeStyle: "short",
        timeZone: chart.birth.tz || "UTC",
      }).format(new Date(birth));
    } catch {
      return birth;
    }
  })();
  const fmt = (value, digits = 3) => Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
  const fmtClock = (seconds) => {
    const abs = Math.abs(seconds);
    if (abs < 0.001) return "less than 1 ms";
    if (abs < 60) return fmt(abs, 6) + " s";
    if (abs < 3600) return fmt(abs / 60, 4) + " min";
    return fmt(abs / 3600, 4) + " h";
  };

  // A compact projection of the last ten CRAM shells. This is the
  // (r,K) cylinder coordinate, not a plotted GR geodesic.
  const totalDays = BigInt(data.cram.N);
  const startDay = totalDays > 360n ? totalDays - 360n : 0n;
  const span = totalDays - startDay;
  const samples = Math.max(2, Math.min(181, Number(span) + 1));
  const points = [];
  for (let i = 0; i < samples; i++) {
    const n = startDay + (span * BigInt(i)) / BigInt(samples - 1);
    const r = Number(((n % 36n) + 36n) % 36n);
    const x = 28 + 544 * i / (samples - 1);
    const y = 78 - 42 * Math.sin(2 * Math.PI * r / 36);
    points.push({ x, y });
  }
  const path = points.map((p, i) => (i ? "L" : "M") + p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" ");
  const current = points[points.length - 1];
  const phaseLabel = data.cram.phaseDegrees.toFixed(0) + "° / 360°";

  return (
    <section className="wl-panel" aria-labelledby="wl-title">
      <div className="wl-head">
        <div>
          <div className="wl-kicker">spacetime · cyclical time · exact carry</div>
          <h2 id="wl-title">Natal worldline</h2>
          <p className="wl-subtitle">
            A birth event anchors the timeline at {chart.birth.placeLabel || "the entered birthplace"} · {dateText}.
          </p>
        </div>
        <div className="wl-live"><span className="wl-live-dot" /> live reference</div>
      </div>

      {chart.timeUnknown && (
        <p className="wl-warning" role="note">
          Birth time is unknown or assumed. The epoch and every derived elapsed-time coordinate are provisional.
        </p>
      )}

      <div className="wl-grid">
        <article className="wl-metric">
          <span className="wl-label">Elapsed coordinate time</span>
          <strong>{fmt(data.interval.elapsedDays, 3)} days</strong>
          <small>{fmt(data.interval.elapsedJulianYears, 6)} Julian years since birth</small>
        </article>
        <article className="wl-metric">
          <span className="wl-label">CRAM shell · M = 36</span>
          <strong>N {data.cram.N} = 36 × {data.cram.K} + {data.cram.r}</strong>
          <small>phase {phaseLabel} · {data.cram.daysToNextBoundary} day(s) to next shell</small>
        </article>
        <article className="wl-metric wl-arrow">
          <span className="wl-label">Signed anchor · A = 37</span>
          <strong>v₃₇ = {data.cram.vA} <span aria-label="downward arrow">↓</span></strong>
          <small>vₐ = (r − K) mod 37 · your directional carry signature</small>
        </article>
        <article className="wl-metric">
          <span className="wl-label">Idealized GR proper time</span>
          <strong>{fmt(data.relativity.properSeconds / 86400, 3)} days</strong>
          <small>coordinate − proper = {fmtClock(data.relativity.clockOffsetSeconds)}</small>
        </article>
      </div>

      <div className="wl-visual">
        <div className="wl-visual-head">
          <div>
            <h3>CRAM cylindrical lift</h3>
            <p>Last 360 whole-day ticks · phase wraps; winding K retains direction</p>
          </div>
          <div className="wl-phase">current phase {phaseLabel}</div>
        </div>
        <svg viewBox="0 0 600 124" role="img" aria-label="CRAM phase projected as a winding curve across the last ten 36-day shells">
          <line x1="28" y1="78" x2="572" y2="78" className="wl-axis" />
          <line x1="28" y1="28" x2="28" y2="108" className="wl-axis" />
          <line x1="572" y1="28" x2="572" y2="108" className="wl-axis" />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={28 + 54.4 * i} y1="29" x2={28 + 54.4 * i} y2="108" className="wl-gridline" />
          ))}
          <path d={path} className="wl-curve" />
          <circle cx={current.x} cy={current.y} r="5" className="wl-point" />
          <text x="28" y="120" className="wl-svg-label">earlier</text>
          <text x="572" y="120" textAnchor="end" className="wl-svg-label">now</text>
        </svg>
        <div className="wl-visual-caption">
          <span>phase r ∈ [0, 35] · 10° per tick</span>
          <span>wind K = {data.cram.K}</span>
        </div>
      </div>

      {ctm && (
        <div className="wl-calendar">
          <div className="wl-section-title">
            <h3>Existing cylindrical calendar register</h3>
            <span>separate epoch · JD 584283</span>
          </div>
          <div className="wl-calendar-grid">
            <div><small>Maya Long Count</small><strong>{ctm.longCount.formatted}</strong></div>
            <div><small>Tzolk’in</small><strong>{ctm.tzolkin.number} {ctm.tzolkin.sign}</strong></div>
            <div><small>Haab’</small><strong>{ctm.haab.day} {ctm.haab.month}</strong></div>
            <div><small>Calendar Round</small><strong>{ctm.calendarRound.toLocaleString()}</strong></div>
            <div><small>TCO master phase</small><strong>{ctm.tco.P.toLocaleString()} / {ctm.tco.M.toLocaleString()}</strong></div>
          </div>
        </div>
      )}

      <div className="wl-relativity">
        <div className="wl-section-title">
          <h3>Relativistic clock model</h3>
          <span>Earth surface · idealized exterior metric</span>
        </div>
        <div className="wl-equation">
          dτ/dt = √(1 − 2GM/(rc²) − v²/c²)
        </div>
        <div className="wl-rel-grid">
          <div><small>proper-time rate</small><strong>{data.relativity.properTimeRate.toFixed(12)}</strong></div>
          <div><small>local rotational speed</small><strong>{fmt(data.relativity.localTangentialSpeedMS, 3)} m/s</strong></div>
          <div><small>gravitational term</small><strong>{data.relativity.gravitationalTerm.toExponential(6)}</strong></div>
          <div><small>rotation term</small><strong>{data.relativity.rotationalTerm.toExponential(6)}</strong></div>
        </div>
        <p>
          The proper-time result describes a hypothetical clock held at the natal coordinates from the birth
          instant to now. The birth chart does not reconstruct the subject’s actual path, relocations or elevation.
          Since the app has no birthplace altitude field, this run assumes sea level.
        </p>
      </div>

      <details className="wl-method">
        <summary>Method, assumptions and limits</summary>
        <ul>
          <li><strong>CRAM:</strong> N is the floor of elapsed POSIX days from the chart epoch. The exact identity is N = r + 36K; v₃₇ = (r − K) mod 37. The ↓ marker is the signed anchor’s specified orientation, not an independently measured thermodynamic arrow.</li>
          <li><strong>Calendar:</strong> the Maya/CTM register remains an independent calendar coordinate with its own epoch and 30,030-state TCO phase. It is not silently substituted for the 36/37 register.</li>
          <li><strong>GR:</strong> this uses the Schwarzschild exterior metric with a WGS84 geodetic radius and a constant Earth-rotation velocity term. It excludes Earth’s multipole gravity, frame dragging, tides, local geopotential, IERS Earth orientation and relativistic time-scale conversion.</li>
          <li><strong>Time scale:</strong> browser timestamps use POSIX milliseconds; leap seconds are not represented. This is not a precision clock-transfer calculation.</li>
          <li><strong>Interpretation:</strong> planetary placements do not source or modify the spacetime metric. The chart contributes only the birth event and its geographic reference point.</li>
        </ul>
      </details>
    </section>
  );
}

Object.assign(window, { WorldlinePanel });
