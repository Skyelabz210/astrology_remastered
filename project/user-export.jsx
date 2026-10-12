// ZIP collection is explicit and bound to the selected personal chart. Each
// provider either supplies its actual output or records why it was unavailable.
async function gatherPersonalArchive(chart, context, narrative, relationships = []) {
  const U = window.UserExport;
  if (!U || !chart) throw new Error('Personal export is unavailable');
  const c = context || (window.buildPersonalReadingContext
    ? window.buildPersonalReadingContext(chart, window.dateToJD(new Date()), [], {}) : null);
  const additional = {}, unavailable = [];
  const gather = async (name, fn) => {
    try { additional[name] = { status: 'ready', value: await fn() }; }
    catch (error) { additional[name] = { status: 'unavailable', message: String(error.message || error) }; unavailable.push(name); }
  };
  await gather('behavioralProfile', () => window.BehavioralProfile.behavioralProfile(chart));
  const jd = c ? c.jd : window.dateToJD(new Date());
  const chapters = c && c.input.chapters || [];
  await gather('returnCharts', () => ['Sun', 'Moon'].map(body => {
    const r = window.returnChart(chart, body, jd, chapters);
    if (!r || !r.chart) throw new Error(`${body} return chart could not be calculated`);
    return { ...r, chart: U.chartSnapshot(r.chart) };
  }));
  await gather('progressions', () => window.progressedAt(chart.jd, (jd - chart.jd) / 365.25));
  await gather('relocatedCharts', () => window.normalizeChapters(chapters, chart).chapters.map(ch => ({
    chapter: ch, chart: U.chartSnapshot(window.relocatedChart(chart, ch)),
  })));
  await gather('eclipseProfile', () => {
    if (!window.Astronomy || !window.Eclipses || !window.EnhancedReading) throw new Error('Real eclipse geometry unavailable');
    return window.Eclipses.eclipseProfile(window.Astronomy, { ...chart.birth,
      points: window.EnhancedReading.realEclipsePoints(window.Astronomy, chart),
      now: new Date(c ? c.at : Date.now()), orbDeg: c ? c.input.settings.eclipseOrb : 2.5 });
  });
  await gather('admittedLedgerAndHcrm', async () => {
    if (!window.EnhancedReading) throw new Error('Ledger diagnostics are unavailable on this page');
    const entries = await window.EnhancedReading.produceBrowserLedger(window.Astronomy, chart.birth);
    return { ...window.EnhancedReading.buildDiagnostics(entries, chart.birth.dateISO), ledger: entries };
  });
  const owner = window.ReadingRuns.profileKey(chart.birth);
  const availableRelationships = [...relationships, ...(c && c.evidence.synastry && c.evidence.synastry.value ? [c.evidence.synastry.value] : [])];
  const related = availableRelationships.filter(syn => [syn.chartA, syn.chartB].some(person =>
    person && window.ReadingRuns.profileKey(person.birth) === owner));
  additional.relationships = { status: 'ready', value: related.map(syn => ({ ...syn,
    chartA: U.chartSnapshot(syn.chartA), chartB: U.chartSnapshot(syn.chartB) })) };
  if (window.computeHCRM) await gather('consoleDemonstration', () => window.computeHCRM(chart));
  const readings = typeof window.readingTextFor === 'function'
    ? chart.cards.map(card => ({ cardIndex: card.idx, planet: card.principal.name, ...window.readingTextFor(card, chart) })) : [];
  const data = U.collectPersonalData({ chart, context: c, narrative,
    cardReadings: readings, runs: window.ReadingRuns.loadRuns(null, owner),
    profile: window.ProfileStore ? window.ProfileStore.load() : null,
    additional: { ...additional, unavailable } });
  return U.buildPersonalZip(data);
}

function PersonalArchiveButton({ chart, context = null, narrative = null, relationships = [] }) {
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const version = React.useRef(0);
  const owner = chart && window.ReadingRuns.profileKey(chart.birth);
  React.useEffect(() => {
    version.current++;
    setStatus(''); setBusy(false);
    return () => { version.current++; };
  }, [owner, context && context.cacheFingerprint]);
  const download = async () => {
    if (busy) return;
    const requestVersion = version.current;
    setBusy(true); setStatus('Preparing your chart, readings and saved calculation data…');
    try {
      // Give the browser a frame to display progress before eclipse calculation.
      await new Promise(resolve => setTimeout(resolve, 0));
      const archive = await gatherPersonalArchive(chart, context, narrative, relationships);
      if (requestVersion !== version.current) return;
      const url = URL.createObjectURL(new Blob([archive.bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = archive.filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`ZIP prepared for ${archive.manifest.subject}: chart, reading and ${archive.manifest.runCount} saved runs. Extract it and open report.html.`);
    } catch (error) {
      if (requestVersion === version.current) setStatus(`Export could not be completed: ${error.message || error}`);
    } finally {
      if (requestVersion === version.current) setBusy(false);
    }
  };
  return <div className="personal-archive">
    <button type="button" disabled={busy || !chart} onClick={download}>{busy ? 'Preparing ZIP…' : 'Export all my data as ZIP'}</button>
    <p>Includes this user’s chart, reading, saved runs and calculation evidence. Save the ZIP to keep an offline copy.</p>
    <p role="status" aria-live="polite">{status}</p>
  </div>;
}
Object.assign(window, { gatherPersonalArchive, PersonalArchiveButton });
