// Optional advanced panels. Async ledger results are bound to the chart object.
function EnhancedReadingPanel({chart}) {
  const [open,setOpen] = React.useState(false);
  const [result,setResult] = React.useState(null);
  const E = window.EnhancedReading;
  React.useEffect(()=>{
    if (!open || !E) return undefined;
    let cancelled = false;
    setResult(null);
    E.produceBrowserLedger(window.EPHEMERIS_MODE === "SYNTHETIC" ? null : window.Astronomy,chart.birth)
      .then(entries=>E.buildDiagnostics(entries,chart.birth.dateISO))
      .then(data=>{if(!cancelled) setResult({chart,data});})
      .catch(error=>{if(!cancelled) setResult({chart,error:error.message});});
    return ()=>{cancelled=true;};
  },[chart,open,E]);
  if (!E) return null;
  let time;
  try { time=E.buildTimeBasis(chart); } catch { time=null; }
  const active = result && result.chart===chart ? result : null;
  const data = active && active.data;
  return <section className="tp">
    <header className="tp-head"><div className="tp-title">Remastered layers</div>
      <div className="tp-sub">Classical placements above · exact structure below</div></header>
    <details className="tp-card">
      <summary>Advanced → Time Basis</summary>
      <p>Your birth time sets the orientation of the sky, including the Ascendant and houses.</p>
      {time ? <>
        {time.assumedTime && <p>Birth time is unknown. Values below describe the assumed calculation time; house and local orientation readings are withheld.</p>}
        <dl>
          <dt>ΔT</dt><dd>{time.deltaTSeconds.toFixed(3)} seconds</dd>
          <dt>GMST</dt><dd>{time.gmstDeg.toFixed(6)}°</dd>
          <dt>GAST</dt><dd>{time.gastDeg.toFixed(6)}°</dd>
          <dt>Mean obliquity</dt><dd>{time.obliquityDeg.toFixed(6)}°</dd>
          {time.localSiderealDeg!==null && <><dt>Local apparent sidereal time</dt><dd>{time.localSiderealDeg.toFixed(6)}°</dd></>}
          {time.houseSystem && <><dt>House system</dt><dd>{time.houseSystem} (requested: {time.requestedHouseSystem})</dd></>}
        </dl>
        <p>{time.basis}. These are the house-solver reference values; planetary positions use Astronomy Engine's own time basis. Existing chart fallback notices remain applicable.</p>
      </> : <p>Time metadata is unavailable for this chart.</p>}
    </details>
    <details className="tp-card" onToggle={e=>setOpen(e.currentTarget.open)}>
      <summary>Advanced → Shadow, Harmonic Closure and HCRM</summary>
      <p>Explore the residue structure beneath these placements. Shadow identifies inert-prime structure; harmonic closure tells you whether a division tiles the zodiac ring exactly.</p>
      <div aria-live="polite">
        {open && !active && <p>Preparing real ephemeris ledger and checking admission…</p>}
        {active && active.error && <p>Diagnostics unavailable: {active.error}</p>}
      </div>
      {data && <>
        <h4>Shadow and Harmonic Closure</h4>
        <p>ρ is the selected division's arithmetic band. The two axes remain separate: a trine carries shadow prime 3 and closes exactly; 13 is off-ring with no shadow factor.</p>
        <div style={{overflowX:"auto"}}><table>
          <caption>Divisions of the 1,296,000 arcsecond ring</caption>
          <thead><tr><th>Division</th><th>Closure</th><th>Shadow factor</th><th>ρ band</th></tr></thead>
          <tbody>{data.divisions.map(d=><tr key={d.divisor}>
            <td>{{3:"Trine",12:"Signs",36:"Decans",108:"Navāṁśa",7:"Septile",13:"Thirteen-fold"}[d.divisor]} ({d.divisor})</td>
            <td>{d.closure.closes?"Exact":"Off-ring"}</td><td>{d.shadow.q}</td><td>{d.shadow.rho} · {d.shadow.band_label}</td>
          </tr>)}</tbody>
        </table></div>
        <h4>HCRM placement diagnostics</h4>
        <p>Real geocentric planetary positions, rounded to integer arcseconds by the producer and admitted through the ledger gate. Exact register arithmetic starts at that boundary. {chart.timeUnknown ? "Positions use the assumed birth time." : ""}</p>
        {data.registers.map(({register:r,events,carry})=><details key={r.body}>
          <summary>{r.body} · parked winding K = {r.shell.K} · {events.map(e=>e.eventClass).join(", ")}</summary>
          <p>Shadow and boundary events: {events.map(e=>`${e.eventClass} (${e.axis})`).join("; ")}</p>
          <p>Legacy shell K: {r.legacy_shell.K}. Source: {r.source.kind} {r.source.name}. Status: {r.certificate.status}.</p>
          <div style={{overflowX:"auto"}}><table><caption>{r.body} residue lanes and centred carry</caption>
            <thead><tr><th>Prime</th><th>Centred residue</th><th>Signed winding</th></tr></thead>
            <tbody>{carry.map(c=><tr key={c.p}><td>{c.p}</td><td>{c.r}</td><td>{c.w}</td></tr>)}</tbody>
          </table></div>
        </details>)}
      </>}
    </details>
  </section>;
}
Object.assign(window,{EnhancedReadingPanel});
