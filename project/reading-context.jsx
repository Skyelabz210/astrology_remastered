// One frozen instant and one personal input snapshot shared by the reader,
// agent prompts, narration, export and saved calculation history.
function compactLivingSummary(summary, maxNotes = 20) {
  if (!summary || typeof summary !== 'object') return null;
  const limit = Math.min(20, Math.max(0, Math.trunc(Number(maxNotes) || 0)));
  const originalHistory = Array.isArray(summary.history) ? summary.history : [];
  const history = (limit ? originalHistory.slice(-limit) : []).map(row => ({
      id: row.id, at: row.at, domain: row.domain, kind: row.kind,
      rating: row.rating ?? null, agreement: row.agreement ?? null,
      note: String(row.note || '').slice(0, 300), contextAt: row.contextAt || null,
      readingId: typeof row.readingId === 'string' ? row.readingId.slice(0, 120) : null,
    }));
  const aggregate = (value = {}, domain = null) => ({ count: value.count || 0,
    checkIns: value.checkIns || 0, readingFeedback: value.readingFeedback || 0,
    ratings: value.ratings ? { ...value.ratings } : null,
    agreement: value.agreement ? { ...value.agreement } : null,
    recentObservationIds: history.filter(row => domain === null || row.domain === domain).slice(-3).map(row => row.id) });
  return { version: summary.version, ownerKey: summary.ownerKey, revision: summary.revision,
    createdAt: summary.createdAt, updatedAt: summary.updatedAt, source: summary.source,
    baselineBasisKey: summary.baselineBasisKey, preferences: { ...(summary.preferences || {}) },
    observationCount: summary.observationCount || 0,
    domains: (Array.isArray(summary.domains) ? summary.domains : []).slice(0, 5).map(domain => ({
      id: domain.id, body: domain.body, title: domain.title, ...aggregate(domain, domain.body) })),
    cognitive: { title: summary.cognitive?.title, source: summary.cognitive?.source,
      preferences: { ...(summary.cognitive?.preferences || {}) }, ...aggregate(summary.cognitive, 'cognitive') },
    preferenceObservations: aggregate(summary.preferenceObservations, 'preferences'),
    engagement: summary.engagement ? { ...summary.engagement } : null, history,
    revisionHistory: (Array.isArray(summary.revisionHistory) ? summary.revisionHistory : []).slice(-10).map(row => ({ ...row })),
    limitation: summary.limitation,
    summaryScope: `Counts describe the retained journal; this snapshot includes at most ${limit} recent observations with notes limited to 300 characters. Domain references point to those retained snapshot notes. The complete retained journal stays in Living Profile storage and the private ZIP export.` };
}

function buildPersonalReadingContext(chart, jd, chapters = [], settings = {}) {
  if (!chart || !Number.isFinite(jd)) return null;
  const at = new Date((jd - 2440587.5) * 86400000).toISOString();
  const evidence = {};
  const evaluate = (name, fn) => {
    try {
      const value = fn();
      evidence[name] = value && value.status === 'unavailable'
        ? { status: 'unavailable', message: value.message || 'Calculation unavailable', value }
        : { status: 'ready', value };
    }
    catch (error) { evidence[name] = { status: 'unavailable', message: String(error.message || error) }; }
    return evidence[name].value || null;
  };
  const lifecycle = evaluate('lifecycle', () => window.lifecycleDigest(chart, jd, chapters));
  const progressions = evaluate('progressions', () => window.progressionsDigest(chart, jd));
  const transits = evaluate('transits', () => window.currentTransits(chart, jd));
  const persona = evaluate('traditional', () => window.PersonaModel.personaForChart(chart, new Date(at), window.Astronomy));
  const residence = evaluate('residence', () => window.chapterAware(chart, chapters, jd));
  evaluate('solarArc', () => {
    if (!window.VariantCalculations || window.EPHEMERIS_MODE === 'SYNTHETIC') throw new Error('Real solar-arc ephemeris unavailable');
    return window.VariantCalculations.solarArcDirections(chart, jd, window.Astronomy);
  });
  evaluate('behavioralTrajectories', () => {
    if (!window.BehavioralProfile || typeof window.BehavioralProfile.behavioralTrajectories !== 'function') throw new Error('Behavioral trajectory calculation unavailable');
    return window.BehavioralProfile.behavioralTrajectories(chart, jd,
      window.EPHEMERIS_MODE === 'SYNTHETIC' ? null : window.Astronomy);
  });
  if (window.LivingProfile && typeof window.LivingProfile.loadProfile === 'function'
      && typeof window.LivingProfile.summarizeProfile === 'function') {
    const living = window.LivingProfile.loadProfile(chart.birth);
    if (living) evaluate('livingProfile', () => compactLivingSummary(window.LivingProfile.summarizeProfile(living)));
  }
  // Only the relevant computed residence is retained, not duplicate charts.
  if (residence) evidence.residence.value = { active: residence.active, dropped: residence.dropped,
    lines: typeof window.chapterDigest === 'function' ? window.chapterDigest(chart, residence.chapters || []) : [] };
  const eclipseOrb = Number(settings.eclipseOrb) > 0 ? Number(settings.eclipseOrb) : 2.5;
  const eclipseText = evaluate('eclipses', () => {
    if (!window.Astronomy || !window.EnhancedReading || window.EPHEMERIS_MODE === 'SYNTHETIC') throw new Error('Real eclipse geometry unavailable');
    return window.EnhancedReading.natalEclipseText(window.Astronomy, chart, eclipseOrb);
  });
  const personalLines = [];
  if (evidence.solarArc?.status === 'ready') personalLines.push(`The true solar-arc direction advances the natal longitudes by ${Number(evidence.solarArc.value.arcArcsec) / 3600} degrees at this reading's instant. This symbolic direction is separate from today's transits; the behavioral page exposes its directed-to-natal contacts.`);
  if (residence && residence.active) personalLines.push(`Your residence at this reading's instant is ${residence.active.place.label}. Return charts use the residence on each return date.`);
  if (residence && residence.dropped) personalLines.push(`${residence.dropped} residence ${residence.dropped === 1 ? 'entry was' : 'entries were'} excluded because the location or date interval was invalid. Correct those entries to include them in location-based calculations.`);
  if (persona) {
    personalLines.push(`${persona.dominantElement} is the leading element among the seven classical planets; the leading modality is ${persona.dominantModality}.`);
    if (persona.profection) personalLines.push(`The annual profection lord is ${persona.profection.lord}.`);
    if (persona.firdaria) personalLines.push(`The Firdaria major-period lord is ${persona.firdaria.majorLord || persona.firdaria.planet || persona.firdaria.lord}.`);
    if (persona.receptions.length) personalLines.push(`Mutual receptions: ${persona.receptions.map(r => `${r.planetA} and ${r.planetB} (${r.type})`).join('; ')}.`);
  }
  if (transits) personalLines.push(transits.hits.length
    ? `Closest current transits at ${at}: ${transits.hits.slice(0, 5).map(h => `${h.T} ${h.aspect.toLowerCase()} natal ${h.N}, ${h.orb.toFixed(2)} degrees from exact, ${h.phase}`).join('; ')}.`
    : `No current transit falls within two degrees at ${at}.`);
  const limitations = [...(chart.positionWarnings || []),
    'Positions are numerical ephemeris outputs; integer residue lanes round positions to the nearest arcsecond and are experimental correspondences.',
    'Lifecycle circuit counts use mean orbital periods, not integrated geocentric winding.',
    'Firdaria uses 365.2425-day years; zodiacal releasing is level 1 with 360-day Egyptian years.',
    'Fixed-star positions omit proper motion; lunar mansions use equal tropical sectors.'];
  if ((chapters || []).some(ch => ch.approximate)) limitations.push("Residence dates marked approximate are editable estimates; location-based readings near a move date may change when dates are corrected. Date-only chapter boundaries use UTC midnight, not a known flight or arrival time.");
  if (residence && residence.dropped) limitations.push(`${residence.dropped} invalid residence entries were excluded; return charts use only valid dated locations or the natal birthplace fallback.`);
  if (chart.timeUnknown) limitations.push('Unknown birth time: the assumed epoch affects lunar degrees, transits and return dates; houses, sect-dependent time lords and exact natal lanes are withheld from interpretation.');
  for (const [name, item] of Object.entries(evidence)) if (item.status !== 'ready') limitations.push(`${name}: ${item.message}`);
  const input = { birth: { ...chart.birth }, chapters: JSON.parse(JSON.stringify(chapters || [])),
    ...(evidence.livingProfile?.status === 'ready' && evidence.livingProfile.value ? {
      livingAvatar: { ownerKey: evidence.livingProfile.value.ownerKey,
        revision: evidence.livingProfile.value.revision, baselineBasisKey: evidence.livingProfile.value.baselineBasisKey },
    } : {}),
    houseSystemActual: chart.houseSystemActual, settings: { orbScale: settings.orbScale ?? 1, eclipseOrb,
      sect: settings.sect || 'auto', shareBehavioralDataWithAI: settings.shareBehavioralDataWithAI === true }, ephemeris: window.Astronomy && window.EPHEMERIS_MODE !== 'SYNTHETIC' ? 'Astronomy Engine 2.1.19' : 'synthetic demo',
    interpreter: settings.agentOn === true && (window.Interpreter || window.OpenRouter)?.available() ? { provider: window.Interpreter?.provider() || 'OpenRouter', model: (window.Interpreter || window.OpenRouter).model() } : null,
    modelRevision: 'personal-reading-v3', release: window.APP_RELEASE || null };
  const owner = window.ReadingRuns ? window.ReadingRuns.profileKey(chart.birth) : JSON.stringify(chart.birth);
  const cacheFingerprint = window.ReadingRuns ? window.ReadingRuns.evidenceFingerprint([at, input, evidence]) : JSON.stringify([at, input, evidence]);
  return { jd, at, profileKey: owner, input, evidence, limitations, cacheFingerprint,
    lifecycleText: lifecycle ? lifecycle.lines.join(' ') : '',
    progressionsText: progressions ? progressions.lines.join(' ') : '',
    eclipseText: eclipseText || '', personalText: personalLines.join(' '),
    natal: { planets: chart.planets, lots: chart.timeUnknown ? [] : chart.lots,
      aspectGrid: chart.aspectGrid, phase: chart.phase, antisciaContacts: chart.antisciaContacts,
      receptions: chart.receptions, patterns: chart.patterns, shape: chart.shape,
      outOfBounds: chart.outOfBounds, voidOfCourse: chart.voidOfCourse,
      joys: chart.timeUnknown ? [] : chart.joys, elementCount: chart.elementCount, modalityCount: chart.modalityCount,
      asc: chart.timeUnknown ? null : chart.asc, mc: chart.timeUnknown ? null : chart.mc,
      anglesMode: chart.anglesMode, angleSource: chart.angleSource, angleConvention: chart.angleConvention,
      solarAltitude: chart.timeUnknown ? null : chart.solarAltitude, sectSource: chart.sectSource,
      isDayChart: chart.timeUnknown ? null : chart.isDayChart } };
}

function useInterpreterState() {
  const provider = window.Interpreter || window.OpenRouter;
  const read = () => provider && typeof provider.getState === 'function'
    ? provider.getState()
    : { available: Boolean(provider && provider.available()), model: provider ? provider.model() : '', generation: 0 };
  const [state, setState] = React.useState(read);
  React.useEffect(() => {
    const refresh = () => setState(read());
    refresh();
    return provider && typeof provider.subscribe === 'function' ? provider.subscribe(refresh) : undefined;
  }, [provider]);
  return state || read();
}

function usePersonalReading(natal, chapters, settings) {
  const interpreter = useInterpreterState();
  const living = window.LivingProfile;
  const readRevision = () => living && typeof living.getRevision === 'function' && natal
    ? living.getRevision(natal.birth) : 0;
  const [livingRevision, setLivingRevision] = React.useState(readRevision);
  React.useEffect(() => {
    const refresh = () => setLivingRevision(readRevision());
    refresh();
    return living && typeof living.subscribe === 'function' ? living.subscribe(refresh) : undefined;
  }, [living, natal]);
  const jd = React.useMemo(() => window.dateToJD(new Date()), []);
  const context = React.useMemo(() => buildPersonalReadingContext(natal, jd, chapters, settings),
    [natal, jd, chapters, settings.orbScale, settings.eclipseOrb, settings.sect, settings.agentOn,
      settings.shareBehavioralDataWithAI, interpreter.available, interpreter.model, interpreter.generation, livingRevision]);
  const chart = React.useMemo(() => natal && ({ ...natal, readingContext: context }), [natal, context]);
  return { chart, context };
}

function PersonalReadingHistory({ chart, context, narrative }) {
  const [runs, setRuns] = React.useState([]);
  const [failed, setFailed] = React.useState(false);
  const reading = narrative && narrative.text || '';
  React.useEffect(() => {
    if (!context || !window.ReadingRuns) return;
    const id = JSON.stringify([context.at, context.input]);
    const previous = window.ReadingRuns.loadRuns(null, context.profileKey).find(r => r.id === id);
    const run = { version: 1, id, profileKey: context.profileKey,
      at: context.at, input: context.input,
      evidence: { ...(previous && previous.evidence), ...context.evidence, natal: context.natal, limitations: context.limitations,
        narrativeSegments: narrative && narrative.segments || [], readingSource: narrative && narrative.segments ? "annotated segments" : "local" }, reading };
    setFailed(!window.ReadingRuns.saveRun(null, run));
    setRuns(window.ReadingRuns.loadRuns(null, context.profileKey));
  }, [context, reading]);
  React.useEffect(() => {
    if (!context) return;
    const refresh = () => setRuns(window.ReadingRuns.loadRuns(null, context.profileKey));
    window.addEventListener('personal-reading-evidence', refresh);
    return () => window.removeEventListener('personal-reading-evidence', refresh);
  }, [context]);
  if (!context) return null;
  return <section className="personal-history" aria-label="Personal reading history">
    <window.PersonalArchiveButton chart={chart} context={context} narrative={narrative} />
    <details>
      <summary>Personal reading · {new Date(context.at).toLocaleString()} · saved runs ({runs.length})</summary>
      <p>{context.personalText}</p>
      <p>{context.lifecycleText}</p>
      <p>{context.progressionsText}</p>
      <p>{context.eclipseText}</p>
      <p>Stored in this browser; up to 50 runs across profiles. Each run retains its own birth details, residence history, settings, computed facts and reading.</p>
      {failed && <p role="status">This browser could not save the run. Export it to keep a copy.</p>}
      <button onClick={() => window.exportReading(chart, chart.cards, narrative)}>Export this reading</button>
      <details><summary>Calculation assumptions</summary><ul>{context.limitations.map((line, i) => <li key={i}>{line}</li>)}</ul></details>
      {runs.map(run => <details key={run.id}>
        <summary>{new Date(run.at).toLocaleString()} · {run.input.birth.subjectName || 'Your chart'}</summary>
        <p className="saved-reading">{run.reading || 'Calculation snapshot; no narrative was composed.'}</p>
        <button onClick={() => window.downloadTextFile(`reading-run-${run.at.slice(0, 10)}.json`, JSON.stringify(run, null, 2), 'application/json')}>Export saved calculations</button>
      </details>)}
      <button onClick={() => {
        const ok = window.ReadingRuns.clearRuns(null, context.profileKey);
        setFailed(!ok); if (ok) setRuns([]);
      }}>Clear this profile’s saved runs</button>
    </details>
  </section>;
}
Object.assign(window, { compactLivingSummary, buildPersonalReadingContext, useInterpreterState, usePersonalReading, PersonalReadingHistory });
