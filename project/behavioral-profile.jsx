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
  const local = React.useMemo(() => window.BehavioralProfile.behavioralProfile(chart), [chart]);
  const identityRef = React.useRef(context.cacheFingerprint); identityRef.current = context.cacheFingerprint;
  const consentRef = React.useRef(settings.agentOn); consentRef.current = settings.agentOn;
  const previousProfiles = React.useMemo(() => window.ReadingRuns.loadRuns(null, context.profileKey).filter(r => typeof r.evidence?.behavioralProfile?.aiText === 'string'), [context.profileKey]);
  const [expanded, setExpanded] = React.useState('');
  const [generationModel, setGenerationModel] = React.useState(null);
  React.useEffect(() => { setExpanded(''); setGenerationModel(null); }, [context.profileKey, chart.houseSystemActual, settings.orbScale, settings.sect]);
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const profile = React.useMemo(() => ({ ...local, aiText: expanded || null,
    model: expanded ? generationModel : null,
    readingAt: context.at }), [local, expanded, context, generationModel]);
  const narrative = React.useMemo(() => ({ text: local.text + (expanded ? '\n\n' + expanded : ''), segments: [] }), [local, expanded]);
  React.useEffect(() => {
    const id = JSON.stringify([context.at, context.input]);
    const previous = window.ReadingRuns.loadRuns(null, context.profileKey).find(r => r.id === id);
    const ok = window.ReadingRuns.saveRun(null, { version: 1, id, profileKey: context.profileKey,
      at: context.at, input: context.input, reading: narrative.text,
      evidence: { ...context.evidence, ...(previous && previous.evidence), behavioralProfile: profile, natal: context.natal, limitations: context.limitations } });
    if (!ok) setStatus('Browser storage is unavailable. Export your profile to keep it.');
  }, [context, profile, narrative]);
  async function generate() {
    const selectedModel = window.OpenRouter && window.OpenRouter.available() ? window.OpenRouter.model() : 'host interpreter';
    setBusy(true); setStatus('Writing your behavioral profile…');
    try {
      if (!window.agentAvailable()) throw new Error('Connect OpenRouter in interpreter settings first.');
      const prompt = window.buildChartPrompt(chart, context.jd) + '\nTASK: Write a behavioral profile, organized into motivation, emotional needs, communication, relationships, and response to conflict. Cite the supplied computed placements by planet and sign. Use possibilities and practical self-observation prompts, never diagnoses, measured personality claims, or certain predictions. Preserve unknown-time limitations. Do not invent placements or aspects.\nLocal starting profile:\n' + local.text;
      const text = await window.completeVerified(prompt, answer => window.validateNatalGrounding(answer, chart, 3), behavioralChartImage(chart));
      if (alive.current && identityRef.current === context.cacheFingerprint && consentRef.current === true) { setExpanded(text); setGenerationModel(selectedModel); setStatus('Profile checked against your computed chart.'); }
    } catch (e) { if (alive.current) setStatus(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <main className="persona-page behavioral-page">
    <header className="persona-header"><button type="button" className="hdr-pill" onClick={onBack}>← Back</button><h1>Behavioral profile</h1></header>
    <p>{chart.birth.subjectName || 'You'} · {chart.birth.placeLabel}</p><p>{local.limitation}</p>
    <div className="persona-grid">{local.sections.map(s => <section key={s.body}><h2>{s.title}</h2><p className="behavior-source">{s.source}</p><p>{s.text}</p>{s.uncertainty && <p>{s.uncertainty}</p>}</section>)}</div>
    <details><summary>Current reading context · {new Date(context.at).toLocaleString()}</summary><p>{context.personalText}</p><p>{context.progressionsText}</p></details>
    <window.InterpreterSettings onConnected={() => setStatus('Connected. Enable the checkbox below to generate your profile.')} />
    <label className="lf-check"><input type="checkbox" checked={settings.agentOn === true} onChange={e => setTweak("agentOn", e.target.checked)} /><span>Allow sending my birth record, chart image, and reading context to OpenRouter for AI interpretation.</span></label>
    <p>Generating sends your computed chart data, its chart image, and the current reading context to your selected provider.</p>
    <button type="button" className="hdr-pill" disabled={busy || settings.agentOn !== true} onClick={generate}>{busy ? 'Writing…' : 'Generate behavioral profile'}</button>
    <p role="status">{status}</p>{expanded && <section className="behavior-expanded"><h2>Your expanded profile</h2><p>{expanded}</p></section>}
    {previousProfiles.length > 0 && <details className="previous-behavior"><summary>Previously generated behavioral profiles ({previousProfiles.length})</summary>{previousProfiles.map(run => <section key={run.id}><h2>{new Date(run.at).toLocaleString()}</h2><p className="saved-reading">{run.evidence.behavioralProfile.aiText}</p></section>)}</details>}
    <window.PersonalReadingHistory chart={chart} context={context} narrative={narrative} />
    <details><summary>Glyph guide</summary><p>Zodiac glyphs identify the twelve signs; planetary glyphs identify bodies. Aspect symbols describe measured angular relationships. They are standard symbols, not random personality markers.</p><p>{ZODIAC.map(s => s.glyph + ' ' + s.name).join(' · ')}</p></details>
  </main>;
}
Object.assign(window, { BehavioralProfilePage });
