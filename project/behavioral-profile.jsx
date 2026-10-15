function behavioralChartImage(chart) {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  ctx.fillStyle = '#151a20'; ctx.fillRect(0, 0, 640, 640);
  ctx.strokeStyle = '#a9f6d7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(320,320,235,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f1eadb'; ctx.font = '14px sans-serif'; ctx.fillText('Computed geocentric tropical natal chart',140,35);
  for (const planet of chart.planets.filter(p => ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'].includes(p.name))) {
    const angle = planet.lon * Math.PI / 180;
    const x = 320 + Math.cos(angle)*215, y = 320 - Math.sin(angle)*215;
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
  }
  ctx.font = '15px monospace'; chart.planets.filter(p => ['Sun','Moon','Mercury','Venus','Mars'].includes(p.name)).forEach((planet,index) => ctx.fillText(`${planet.name} in ${ZODIAC[planet.sign].name} ${planet.degInSign.toFixed(2)} degrees`,130,285+index*24));
  return canvas.toDataURL('image/png');
}

function BehavioralProfilePage({ settings, chapters = [], onBack, setTweak }) {
  const natal = React.useMemo(() => computeNatal({ ...settings }), [settings]);
  const { chart, context } = window.usePersonalReading(natal, chapters, settings);
  const local = React.useMemo(() => window.BehavioralProfile.behavioralProfile(chart, context), [chart, context]);
  const identityRef = React.useRef(context.cacheFingerprint); identityRef.current = context.cacheFingerprint;
  const consentRef = React.useRef(settings.agentOn); consentRef.current = settings.agentOn;
  const previousProfiles = React.useMemo(() => window.ReadingRuns.loadRuns(null, context.profileKey).filter(r => typeof r.evidence?.behavioralProfile?.aiText === 'string'), [context.profileKey]);
  const [expanded, setExpanded] = React.useState('');
  const [generationModel, setGenerationModel] = React.useState(null);
  const [generationIdentity, setGenerationIdentity] = React.useState(null);
  const activeExpanded = generationIdentity === context.cacheFingerprint ? expanded : '';
  React.useEffect(() => { setExpanded(''); setGenerationModel(null); }, [context.cacheFingerprint]);
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const profile = React.useMemo(() => ({ ...local, aiText: activeExpanded || null,
    model: activeExpanded ? generationModel : null,
    readingAt: context.at }), [local, activeExpanded, context, generationModel]);
  const narrative = React.useMemo(() => ({ text: local.text + (activeExpanded ? '\n\n' + activeExpanded : ''), segments: [] }), [local, activeExpanded]);
  React.useEffect(() => {
    const id = JSON.stringify([context.at, context.input]);
    const previous = window.ReadingRuns.loadRuns(null, context.profileKey).find(r => r.id === id);
    const ok = window.ReadingRuns.saveRun(null, { version: 1, id, profileKey: context.profileKey,
      at: context.at, input: context.input, reading: narrative.text,
      evidence: { ...context.evidence, ...(previous && previous.evidence), behavioralProfile: profile, natal: context.natal, limitations: context.limitations } });
    if (!ok) setStatus('Browser storage is unavailable. Export your profile to keep it.');
  }, [context, profile, narrative]);
  async function generate() {
    const selectedModel = (window.Interpreter || window.OpenRouter)?.available() ? (window.Interpreter || window.OpenRouter).model() : 'host interpreter';
    setBusy(true); setStatus('Writing your behavioral profile…');
    try {
      if (!window.agentAvailable()) throw new Error('Connect OpenRouter in interpreter settings first.');
      const aiContext = settings.shareBehavioralDataWithAI === true ? context : { ...context, evidence: Object.fromEntries(Object.entries(context.evidence).filter(([name]) => name !== 'livingProfile')) };
      const aiProfile = window.BehavioralProfile.behavioralProfile(chart, aiContext);
      const prompt = window.buildChartPrompt(chart, context.jd) + '\nTASK: Write a behavioral profile, organized into motivation, emotional needs, communication, relationships, and response to conflict. For each domain include its supplied anchor, interpretive tension, located transit trajectory or explicit unavailability, observation/counterexample, and linked placements. Cite natal degrees, houses when known, aspect orbs and phase exactly as supplied. Label natal and transiting contacts separately. Never turn a numerical or symbolic relation into a measured behavioral trait. Use possibilities and practical self-observation prompts, never diagnoses, measured personality claims, or certain predictions. Preserve unknown-time limitations. Do not invent placements or aspects.\nLocal starting profile:\n' + aiProfile.text + '\nStructured chart evidence:\n' + JSON.stringify(aiProfile.sections) + (settings.shareBehavioralDataWithAI === true && window.LivingProfile ? '\nUser-reported goals and observations (use as reports, never inferred diagnoses):\n' + JSON.stringify(window.compactLivingSummary(window.LivingProfile.summarizeProfile(window.LivingProfile.loadProfile(chart.birth)),10)) : '');
      const text = await window.completeVerified(prompt, answer => window.validateNatalGrounding(answer, chart, 3), behavioralChartImage(chart));
      if (alive.current && identityRef.current === context.cacheFingerprint && consentRef.current === true) { setGenerationIdentity(context.cacheFingerprint); setExpanded(text); setGenerationModel(selectedModel); setStatus('Profile checked against your computed chart.'); }
    } catch (e) { if (alive.current) setStatus(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <main className="persona-page behavioral-page">
    <header className="persona-header"><button type="button" className="hdr-pill" onClick={onBack}>← Back</button><h1>Behavioral profile</h1></header>
    <p>{chart.birth.subjectName || 'You'} · {chart.birth.placeLabel}</p><p>{local.limitation}</p>
    <window.LivingBehavioralAvatar chart={chart} context={context} local={local} />
    {window.EvolutionPanel && <window.EvolutionPanel chart={chart} context={context} settings={settings} />}
    <div className="persona-grid">{local.sections.map(s => <section key={s.body} id={`behavior-${s.body}`} className="behavior-card">
      <h2>{s.title}</h2><p className="behavior-source">{s.anchor.text}</p>
      {s.uncertainty && <p className="behavior-uncertainty">{s.uncertainty}</p>}
      <details><summary>Computed natal evidence · {s.aspects.length} contacts</summary><ul>{s.facts.slice(1).map((fact,i) => <li key={i}>{fact}</li>)}</ul></details>
      <h3>Interpretive tension</h3><p>{s.tension.text}</p>
      <h3>Transit trajectory</h3><p>{s.trajectory.text}</p><small>{s.trajectory.scope}</small>
      <h3>Check against experience</h3><p>{s.falsifier.hypothesis}</p><p>{s.falsifier.protocol}</p><p>{s.falsifier.counterexample}</p>
      {s.feedback && <div className="behavior-feedback"><h3>Your evolving experience</h3><p>{s.feedback.text}</p></div>}
      <h3>Connected placements</h3>{s.resonance.length ? <ul>{s.resonance.map(r => <li key={r.body}>{local.sections.some(section => section.body === r.body) ? <a href={`#behavior-${r.body}`}>{r.body}</a> : r.body} · {r.aspect}, orb {r.orbText}, {r.phase}</li>)}</ul> : <p>No natal aspect links were supplied.</p>}
      {s.resonance.some(r => r.separationArcsec !== null) && <details><summary>Integer relationship lanes · experimental</summary><p>Distances use rounded arcseconds. Divisibility is a mathematical relationship; it does not establish behavior or fate.</p>{s.resonance.map(r => <p key={r.body}>{r.body}: {r.separationArcsec}″ · {r.lanes.map(l => `${l.prime}: ${l.residue}`).join(' · ')}</p>)}</details>}
    </section>)}</div>
    <details><summary>Current reading context · {new Date(context.at).toLocaleString()}</summary><p>{context.personalText}</p><p>{context.progressionsText}</p></details>
    <window.InterpreterSettings onConnected={() => setStatus('Configured. Authentication is checked when you generate your profile.')} />
    <label className="lf-check"><input type="checkbox" checked={settings.agentOn === true} onChange={e => setTweak("agentOn", e.target.checked)} /><span>Allow sending my birth record, chart image, and reading context to the selected AI provider.</span></label>
    <label className="lf-check"><input type="checkbox" checked={settings.shareBehavioralDataWithAI === true} onChange={event => setTweak("shareBehavioralDataWithAI",event.target.checked)} /><span>Include my goals, check-ins and feedback when generating an AI profile.</span></label>
    <p>Generating sends your computed chart data, its chart image, and the current reading context to your selected provider.</p>
    <button type="button" className="hdr-pill" disabled={busy || settings.agentOn !== true} onClick={generate}>{busy ? 'Writing…' : 'Generate behavioral profile'}</button>
    <p role="status">{status}</p>{activeExpanded && <section className="behavior-expanded"><h2>Your expanded profile</h2><p>{activeExpanded}</p></section>}
    {previousProfiles.length > 0 && <details className="previous-behavior"><summary>Previously generated behavioral profiles ({previousProfiles.length})</summary>{previousProfiles.map(run => <section key={run.id}><h2>{new Date(run.at).toLocaleString()}</h2><p className="saved-reading">{run.evidence.behavioralProfile.aiText}</p></section>)}</details>}
    <window.PersonalReadingHistory chart={chart} context={context} narrative={narrative} />
    <details><summary>Glyph guide</summary><p>Zodiac glyphs identify the twelve signs; planetary glyphs identify bodies. Aspect symbols describe measured angular relationships. They are standard symbols, not random personality markers.</p><p>{ZODIAC.map(s => s.glyph + ' ' + s.name).join(' · ')}</p></details>
  </main>;
}
Object.assign(window, { BehavioralProfilePage });
