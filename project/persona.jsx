// Classic browser JSX script, like the other application screens.
function PersonaPage({ onBack, settings, chapters = [] }) {
  const [savedCharts, setSavedCharts] = React.useState(() => window.PersonaModel.loadPersonaCharts());
  const [selected, setSelected] = React.useState(-1);
  const [adding, setAdding] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [error, setError] = React.useState('');
  const [sky, setSky] = React.useState(null);
  const [reading, setReading] = React.useState('');
  const [runContext, setRunContext] = React.useState(null);
  const [orbMode, setOrbMode] = React.useState('aspect');
  const active = selected >= 0 ? savedCharts[selected] : settings;
  const chart = React.useMemo(() => {
    try { return computeNatal({ ...active, houseSystem: settings.houseSystem, sect: settings.sect || 'auto' }); }
    catch { return null; }
  }, [active, settings.houseSystem, settings.sect]);
  const persona = React.useMemo(() => chart ? window.PersonaModel.personaForChart(chart, now) : null, [chart, now]);
  React.useEffect(() => {
    setReading(''); setRunContext(null); setSky(null); setError('');
    if (!chart) return;
    const natal = chart.planets.filter(p => window.Transits && ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(p.name))
      .map(p => ({ name: p.name, lonArcsec: p.lon * 3600 }));
    if (!chart.timeUnknown) natal.push({ name: 'Ascendant', lonArcsec: chart.asc * 3600 }, { name: 'Midheaven', lonArcsec: chart.mc * 3600 });
    const watcher = window.Transits.createLiveSkyWatcher(natal, 60000, {
      orbMode,
      onUpdate(data) { setSky(data); setNow(data.timestamp); },
      onError(e) { setError(e.message); setSky(null); },
    });
    watcher.start();
    return () => { watcher.stop(); if (window.stopSpeech) window.stopSpeech(); };
  }, [chart, orbMode]);
  function save(charts) {
    setSavedCharts(charts);
    const ok = window.PersonaModel.savePersonaCharts(undefined, charts);
    setError(ok ? '' : 'This browser blocked storage. These changes will last only until reload.');
  }
  if (adding) return <Landing mode="partner" onBack={() => setAdding(false)} onCast={payload => {
    const validated = window.PersonaModel.validatePersonaChart(payload);
    if (!validated) { setError('Invalid birth record'); return; }
    save([...savedCharts, validated]); setSelected(savedCharts.length); setAdding(false);
  }} />;
  const aspects = sky ? sky.aspectsToNatal : [];
  return <main className="persona-page">
    <header className="persona-header">
      <button className="hdr-pill" onClick={onBack}>← Back</button>
      <h1>Natal Persona Inspector</h1>
      <button className="hdr-pill" onClick={() => setAdding(true)}>Add birth chart</button>
    </header>
    {error && <p role="alert" className="chart-note chart-note-warn">{error}</p>}
    {!chart && <p role="alert">The birth chart could not be calculated. Check the birth date and location.</p>}
    <div className="persona-layout">
      <aside className="persona-sidebar">
        <h2>Charts on this device</h2>
        <button className="hdr-pill" aria-pressed={selected === -1} onClick={() => setSelected(-1)}>Current chart · {settings.subjectName || 'You'}</button>
        {savedCharts.map((saved, index) => <div className="persona-saved" key={index}>
          <button className="hdr-pill" aria-pressed={selected === index} onClick={() => setSelected(index)}>{saved.subjectName} · {saved.placeLabel}</button>
          <label>Name<input value={saved.subjectName} maxLength={80} onChange={e => save(savedCharts.map((c, i) => i === index ? { ...c, subjectName: e.target.value } : c))} /></label>
          <button className="hdr-pill" onClick={() => { save(savedCharts.filter((c, i) => i !== index)); setSelected(-1); }}>Remove {saved.subjectName || 'chart'}</button>
        </div>)}
        <p>Saved locally in this browser.</p>
      </aside>
      {chart && persona && <div className="persona-main">
        <h2>{active.subjectName || 'You'} · {active.placeLabel}</h2>
        <p>{new Date(active.dateISO).toISOString()} · {active.lat}°, {active.lng}°</p>
        {chart.timeUnknown && <p className="chart-note">Birth time unknown. Angles and sect-dependent time lords are omitted; Moon degree is uncertain.</p>}
        <div className="persona-grid">
          <section><h3>Element / modality</h3><p>{persona.dominantElement} / {persona.dominantModality}</p><small>Equal counts of the seven classical planets; ties retained.</small></section>
          {!chart.timeUnknown && <section><h3>Sect</h3><p>{persona.sect}</p></section>}
          <section><h3>Almuten of {persona.almutenPoints}</h3><p>{persona.almuten ? `${persona.almuten.tied.join(' / ')} · ${persona.almuten.score} points` : 'Withheld: birth time is unknown and triplicity scoring depends on sect.'}</p><small>Essential dignity scoring of these points, rather than a full almuten figuris.</small></section>
          <section><h3>Annual profection</h3><p>{persona.profection ? persona.profection.lord : 'Unavailable'}</p></section>
          <section><h3>Firdaria · major period</h3><p>{persona.firdaria ? `${persona.firdaria.lord} · age ${persona.firdaria.years}–${persona.firdaria.endAge}` : 'Unavailable'}</p><small>Bonatti order, 75-year cycle.</small></section>
          <section><h3>Lunar mansion</h3><p>{persona.mansion.index + 1} · {persona.mansion.name}</p><small>28 equal tropical mansions; stellar conventions differ.</small></section>
        </div>
        <h2>Live transits to natal</h2>
        <label>Aspect orbs <select value={orbMode} onChange={e => setOrbMode(e.target.value)}>
          <option value="aspect">All configured aspects · aspect orbs</option>
          <option value="lilly">Lilly moieties · classical planets and major aspects</option>
        </select></label>
        <p>Updated {sky ? sky.timestamp.toISOString() : '…'} · every minute · Astronomy Engine geocentric tropical positions.</p>
        <p>Exact dates are numerical crossings within the next 60 days, shown for the 12 tightest aspects. A dash means no crossing found or not searched.</p>
        <div className="transit-table-container"><table className="transit-table">
          <caption>Current aspects sorted by actual orb</caption>
          <thead><tr><th scope="col">Transit</th><th scope="col">Natal</th><th scope="col">Aspect</th><th scope="col">Orb</th><th scope="col">Phase</th><th scope="col">Next exact (UTC)</th></tr></thead>
          <tbody>{aspects.map((a, i) => <tr key={i}><td>{a.transitPlanet}</td><td>{a.natalPlanet}</td><td>{a.aspect}</td><td>{(a.orbArcsec / 3600).toFixed(3)}°</td><td>{a.exact ? 'Exact' : a.applying ? 'Applying' : a.separating ? 'Separating' : 'Stationary'}</td><td>{a.exactHitDate ? a.exactHitDate.toISOString().slice(0, 19).replace('T', ' ') : '—'}</td></tr>)}</tbody>
        </table></div>
        {sky && !aspects.length && <p>No current aspects within orb.</p>}
        <h2>Current CRAM lane events</h2>
        <p>Integer arcsecond residues for aspects within 1° of exact. These are mathematical register matches.</p>
        <div className="persona-lanes">{[2, 3, 5, 7, 11, 13, 17, 19].map(prime => <section key={prime}><h3>Lane {prime}</h3>{sky && sky.cramEvents.filter(e => e.lane === prime).map((e, i) => <p key={i}>{e.transitPlanet} {e.aspect} {e.natalPlanet} · residue {e.residue} · winding {e.windingIndex}</p>)}</section>)}</div>
        <h2>Traditional details</h2>
        {chart.positionWarnings && chart.positionWarnings.map((text, i) => <p key={i} className="chart-note">{text}</p>)}
        <p>Mutual receptions: {persona.receptions.length ? persona.receptions.map(r => `${r.planetA} / ${r.planetB} (${r.type})`).join(' · ') : 'None by domicile or exaltation.'}</p>
        {persona.syzygy && <p>Prenatal {persona.syzygy.type === 'fullMoon' ? 'Full' : 'New'} Moon: {new Date((persona.syzygy.jd - 2440587.5) * 86400000).toISOString()} · {persona.syzygy.daysBeforeBirth.toFixed(2)} days before birth.</p>}
        <p>Fixed-star longitude conjunctions within 1°: {persona.fixedStars.length ? persona.fixedStars.map(s => `${s.planet} / ${s.star}`).join(' · ') : 'None.'} Catalogue positions are precessed to birth date; proper motion is omitted.</p>
        {persona.releasing.length > 0 && <p>Zodiacal releasing · level 1: {persona.releasing.map(r => `${r.lot}: ${r.lord}, age ${r.years.toFixed(2)}–${r.endAge.toFixed(2)}`).join(' · ')}. Uses 360-day Egyptian years; subperiods are not included.</p>}
        <p>Void-of-course Moon: {chart.voidOfCourse.isVoc ? 'Yes' : 'No'} · {chart.voidOfCourse.approximate ? 'snapshot estimate' : 'classical aspects before the next sign ingress'}</p>
        <h2>Solar conditions</h2>
        <p>{Object.entries(persona.solarConditions).map(([name, condition]) => `${name}: ${condition.condition} (${(condition.separationArcsec / 3600).toFixed(2)}°)`).join(' · ')}</p>
        <button className="hdr-pill" disabled={!sky} onClick={() => {
          const c = window.buildPersonalReadingContext(chart, window.dateToJD(now), selected < 0 ? chapters : [], settings);
          c.input.settings.personaOrbMode = orbMode;
          c.evidence.personaTransits = { status: 'ready', value: sky };
          c.cacheFingerprint = window.ReadingRuns.evidenceFingerprint([c.at, c.input, c.evidence]);
          const text = [window.PersonaModel.dailyPersonaNarration(chart, persona, aspects), c.lifecycleText, c.progressionsText, c.eclipseText].filter(Boolean).join(' ');
          setRunContext(c);
          setReading(text);
          if (settings.voiceOn && window.speakNow) window.speakNow(text, { provider: settings.voiceProvider, voiceName: settings.voiceName, style: settings.voiceStyle });
        }}>Narrate today</button>
        {runContext && <window.PersonalReadingHistory chart={{ ...chart, readingContext: runContext }} context={runContext} narrative={{ text: reading }} />}
        {reading && <p className="persona-reading" aria-live="polite">{reading}</p>}
      </div>}
    </div>
  </main>;
}
Object.assign(window, { PersonaPage });
