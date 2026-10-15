// synastry-view.jsx — the relationship reading UI.
//
// Two charts side by side, the agent's relationship synthesis, the
// weighted cross-aspect grid, house overlays, and the CTM phase-syndrome
// compatibility dial.

const { useState: $synUseState, useMemo: $synUseMemo, useEffect: $synUseEffect, useRef: $synUseRef } = React;

// Append completed calculations to the exact relationship run, never a natal
// run or a different partner's run. Pending scans and stale completions do not
// enter history; repeated identical windows replace their own snapshot.
function saveMutualScan(context, chartA, chartB, scan, isCurrent = () => true) {
  const runs = window.ReadingRuns;
  if (!runs || !context || !isCurrent() || scan?.status !== "ready" || !scan.id ||
      !Array.isArray(scan.hitsA) || !Array.isArray(scan.hitsB) || !Array.isArray(scan.hits) ||
      !Number.isFinite(scan.parameters?.centerJd) || !Number.isFinite(scan.parameters?.spanDays) ||
      scan.parameters.spanDays <= 0 || !Number.isFinite(scan.parameters?.nearDays) || scan.parameters.nearDays < 0) return false;
  try {
    const owner = runs.profileKey(chartA.birth), partner = runs.profileKey(chartB.birth);
    if (context.profileKey !== owner || context.input.kind !== "synastry" ||
        runs.profileKey(context.input.birth) !== owner || runs.profileKey(context.input.partnerBirth) !== partner ||
        runs.profileKey(scan.input.birthA) !== owner || runs.profileKey(scan.input.birthB) !== partner) return false;
    const id = JSON.stringify([context.at, context.input]);
    const run = runs.loadRuns(null, owner).find(r => r.id === id);
    if (!run || run.input.kind !== "synastry" || runs.profileKey(run.input.partnerBirth) !== partner || !isCurrent()) return false;
    const previous = run.evidence.mutualPerfections?.value?.scans;
    const scans = [scan, ...(Array.isArray(previous) ? previous.filter(s => s.id !== scan.id) : [])];
    const ok = runs.attachEvidence(null, id, "mutualPerfections", { status: "ready", value: { version: 1, scans } }, owner);
    if (ok && window.dispatchEvent && typeof Event === "function") window.dispatchEvent(new Event("personal-reading-evidence"));
    return ok;
  } catch { return false; }
}

function SynastryView({ chartA, chartB, chapters = [], settings, setTweak, onBack }) {
  const mutualNow = useNow(60000);
  const [mutualTargetDate, setMutualTargetDate] = $synUseState(null);
  const mutualTarget = mutualTargetDate ? new Date(`${mutualTargetDate}T12:00:00Z`) : mutualNow;
  const jdTarget = dateToJD(mutualTarget);
  const rawSyn = $synUseMemo(() => computeSynastry(chartA, chartB), [chartA, chartB]);
  const personal = window.usePersonalReading(chartA, chapters, settings);
  const capturedContext = $synUseMemo(() => {
    const c = personal.context;
    const input = { ...c.input, kind: 'synastry', partnerBirth: { ...chartB.birth } };
    const evidence = { ...c.evidence, synastry: { status: 'ready', value: rawSyn } };
    return { ...c, input, evidence, cacheFingerprint: window.ReadingRuns.evidenceFingerprint([c.at, input, evidence]) };
  }, [personal.context, rawSyn, chartB]);
  // A selected date is exact input, even within the current 30-day bucket.
  // The context identifies both owners, selected calculation conventions and
  // the frozen reading instant; birth JD alone cannot distinguish profiles.
  const mutualScanKey = JSON.stringify([capturedContext.cacheFingerprint,
    chartA.birth, chartB.birth, mutualTargetDate || Math.round(jdTarget / 30)]);
  const [mutualScan, setMutualScan] = $synUseState(null);
  const [mutualFailure, setMutualFailure] = $synUseState(null);
  const [mutualSaveFailed, setMutualSaveFailed] = $synUseState(false);
  const mutualScope = $synUseRef(null);
  mutualScope.current = mutualScanKey;
  const completedScan = mutualScan?.key === mutualScanKey ? mutualScan : null;
  const context = $synUseMemo(() => {
    if (!completedScan) return capturedContext;
    const runId = JSON.stringify([capturedContext.at, capturedContext.input]);
    const run = window.ReadingRuns.loadRuns(null, capturedContext.profileKey).find(r => r.id === runId);
    const previous = run?.evidence.mutualPerfections?.value?.scans;
    // Preserve earlier completed windows when PersonalReadingHistory saves the
    // enriched context again (for example when an AI reading resolves).
    const scans = [completedScan, ...(Array.isArray(previous) ? previous.filter(s => s.id !== completedScan.id) : [])];
    const evidence = { ...capturedContext.evidence,
      mutualPerfections: { status: "ready", value: { version: 1, scans } } };
    return { ...capturedContext, evidence,
      cacheFingerprint: window.ReadingRuns.evidenceFingerprint([capturedContext.at, capturedContext.input, evidence]) };
  }, [capturedContext, completedScan]);
  const archiveChart = $synUseMemo(() => ({ ...chartA, readingContext: context }), [chartA, context]);
  const syn = $synUseMemo(() => ({ ...rawSyn, readingContext: context }), [rawSyn, context]);
  // `=== true`, not `!== false`: DEFAULT_SETTINGS.agentOn is opt-in now, so a
  // settings object that simply lacks the key must read as OFF.
  const agentOn = settings.agentOn === true;
  const reading = useSynastryReading(syn, agentOn);
  const [selectedHit, setSelectedHit] = $synUseState(null);

  const A = chartA.birth.subjectName || "You";
  const B = chartB.birth.subjectName || "Them";

  // Mutual activations: the SAME lifecycle perfection-scan each chart
  // already has on its own (transitPerfections, unmodified), run once per
  // chart and merged for dates that land within a day of each other.
  // Progressive, one body of one chart per tick — twelve steps total —
  // so the year-wide scan (about a second per chart) never blocks
  // render. Targetable the same way the solo lifecycle panel is: "now"
  // keeps ticking, or an arbitrary date re-centers both charts' scans
  // on that day (noon UTC).
  // Bucketed to a 30-day window of the target, same as the solo panel's
  // perfections scan — so "now" ticking every minute doesn't retrigger
  // the twelve-step scan, only crossing into a new window does.
  $synUseEffect(() => {
    let alive = true;
    const isCurrent = () => alive && mutualScope.current === mutualScanKey;
    setMutualScan(null);
    setMutualFailure(null);
    setMutualSaveFailed(false);
    const centre = jdTarget;
    if (!Number.isFinite(centre)) {
      setMutualFailure("Choose a valid target date.");
      return () => { alive = false; };
    }
    const bodies = ["Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
    const steps = bodies.map((b) => ["A", b]).concat(bodies.map((b) => ["B", b]));
    const hitsA = [], hitsB = [];
    const runStep = (i) => {
      if (!isCurrent()) return;
      if (i >= steps.length) {
        const hits = mergeNearPerfections(hitsA, hitsB, MUTUAL_SAME_DAY_WINDOW);
        const parameters = { method: "independent lifecycle perfection scans merged by time distance",
          centerJd: centre, centerAt: new Date((centre - 2440587.5) * 86400000).toISOString(),
          spanDays: 366, startJd: centre - 183, endJd: centre + 183,
          nearDays: MUTUAL_SAME_DAY_WINDOW, transitBodies: bodies,
          aspects: ["Conjunction", "Sextile", "Square", "Trine", "Opposition"],
          targetMode: mutualTargetDate ? "selected date at noon UTC" : "captured now in a 30-day refresh bucket" };
        const input = { birthA: { ...chartA.birth }, birthB: { ...chartB.birth } };
        const scan = { version: 1, status: "ready", key: mutualScanKey,
          id: window.ReadingRuns.evidenceFingerprint([input, parameters]),
          completedAt: new Date().toISOString(), input, parameters, hitsA, hitsB, hits,
          limitations: ["These are numerical contact searches, not predictions of relationship events.",
            ...(chartA.timeUnknown || chartB.timeUnknown ? ["At least one birth time is unknown: natal degrees use an assumed epoch, and its angles are excluded."] : [])] };
        if (!isCurrent()) return;
        setMutualScan(scan);
        setMutualSaveFailed(!saveMutualScan(capturedContext, chartA, chartB, scan, isCurrent));
        return;
      }
      const [who, body] = steps[i];
      try {
        const hits = transitPerfections(who === "A" ? chartA : chartB, centre, 366, [body]).hits;
        (who === "A" ? hitsA : hitsB).push(...hits);
      } catch (error) {
        if (isCurrent()) setMutualFailure(String(error.message || error));
        return;
      }
      setTimeout(() => runStep(i + 1), 0);
    };
    const timer = setTimeout(() => runStep(0), 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [mutualScanKey]);

  // The dozen nearest the target, restored to chronological order for
  // display — same two-step sort the solo lifecycle panel's perfections use.
  const mutualRows = $synUseMemo(() => {
    if (!completedScan) return null;
    return completedScan.hits
      .map((m) => ({ ...m, dTarget: m.jd - jdTarget }))
      .sort((x, y) => Math.abs(x.dTarget) - Math.abs(y.dTarget))
      .slice(0, 12)
      .sort((x, y) => x.jd - y.jd);
  }, [completedScan, jdTarget]);
  const mutualTargetLabel = mutualTargetDate
    ? mutualTarget.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "now";

  // Voice the overview
  const voice = useVoice({
    text: reading.text,
    enabled: !!settings.voiceOn,
    style: settings.voiceStyle || "jedi",
    voiceName: settings.voiceName,
    // Same ElevenLabs selection the reading session uses — the relationship
    // overview is narrated by the same configured voice, not a second one.
    provider: settings.voiceProvider,
    elevenVoiceId: settings.elevenVoiceId,
    elevenModel: settings.elevenModel,
    playing: true,
  });

  return (
    <div className="synastry">
      <header className="syn-hdr">
        <button className="hdr-back" onClick={onBack} aria-label="Back">←</button>
        <div className="syn-hdr-title">
          <span className="syn-hdr-mark">✦</span>
          <span>Synastry · {A} & {B}</span>
        </div>
        {setTweak ? (
          <button
            className={`hdr-pill ${agentOn ? "is-on" : ""}`}
            onClick={() => setTweak('agentOn', !agentOn)}
            title={agentOn
              ? "Agent interpreter on — sends both charts' data to the configured AI provider for each reading. Click to turn off."
              : "Agent interpreter off — readings stay local. Click to turn on."}
            aria-pressed={agentOn}
          >
            agent
          </button>
        ) : <div className="syn-hdr-spacer"></div>}
      </header>

      <div className="syn-top">
        {/* compatibility dial */}
        <div className="syn-dial-card">
          <CompatibilityDial score={syn.score} />
        </div>

        {/* the relationship synthesis */}
        <div className="syn-reading-card">
          <div className="syn-reading-label">
            <span className="syn-dot" />
            the relationship
            {settings.voiceOn && (
              <span className={`syn-voice ${voice.speaking ? "is-speaking" : ""}`}>{voice.speaking ? "♪ narrating" : "♪"}</span>
            )}
          </div>
          <div className="syn-reading-text">
            {reading.loading && <span className="syn-loading">reading the bond…</span>}
            {reading.unavailable && <span className="syn-note">the AI interpreter isn't available here</span>}
            {reading.error && <span className="syn-error">the interpreter couldn't be reached</span>}
            {reading.text && <span>{reading.text}</span>}
          </div>
        </div>
      </div>

      <window.PersonalReadingHistory chart={archiveChart} context={context} narrative={{ text: reading.text ||
        `${A} and ${B}: closest relationship contacts are ${syn.hits.slice(0, 5).map(h => `${A}'s ${h.a} ${h.aspect.toLowerCase()} ${B}'s ${h.b}, ${h.orb.toFixed(2)} degrees from exact`).join('; ')}.` }} />
      <FollowUpQuestions mode="synastry" syn={syn} agentOn={agentOn} />

      <div className="syn-grid">
        {/* cross-aspect grid */}
        <div className="syn-panel">
          <h3 className="syn-panel-h">Cross-aspects · weighted by relational force</h3>
          <div className="syn-aspects">
            {syn.hits.slice(0, 16).map((h, i) => (
              <button
                key={i}
                className={`syn-asp ${h.harmonious ? "is-harm" : h.hard ? "is-hard" : "is-conj"} ${selectedHit === i ? "is-sel" : ""}`}
                onClick={() => setSelectedHit(selectedHit === i ? null : i)}
                style={{ "--w": h.weight.toFixed(2) }}
              >
                <span className="syn-asp-bodies">
                  <span className="syn-asp-side a">{h.aGlyph} {h.a}</span>
                  <span className="syn-asp-rel">{ASPECT_SYMBOL[h.aspect] || h.aspect}</span>
                  <span className="syn-asp-side b">{h.bGlyph} {h.b}</span>
                </span>
                <span className="syn-asp-orb">{h.orb.toFixed(1)}°</span>
              </button>
            ))}
          </div>
          {selectedHit !== null && syn.hits[selectedHit] && (
            <SynAspectDetail hit={syn.hits[selectedHit]} syn={syn} A={A} B={B} agentOn={agentOn} />
          )}
        </div>

        {/* house overlays + receptions */}
        <div className="syn-panel">
          <h3 className="syn-panel-h">House overlays</h3>
          <div className="syn-overlay-group">
            <div className="syn-overlay-title">{B}'s planets in {A}'s houses</div>
            {chartA.timeUnknown ? (
              <div className="syn-overlay-unavailable" style={{ color: "var(--ink-dim)" }}>
                {possessive(A)} birth time is unknown — house overlays need a real Ascendant.
              </div>
            ) : (
              <table className="tp-table">
                <tbody>
                  {syn.overlaysBonA.slice(0, 7).map((o, i) => (
                    <tr key={i}>
                      <td><span className="pl-gl">{o.glyph}</span> {o.planet}</td>
                      <td style={{ color: "var(--ink-dim)" }}>{o.sign}</td>
                      <td className="num">H{o.house}</td>
                      <td style={{ color: "var(--ink-dim)" }}>{HOUSE_SHORT[o.house]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="syn-overlay-group">
            <div className="syn-overlay-title">{A}'s planets in {B}'s houses</div>
            {chartB.timeUnknown ? (
              <div className="syn-overlay-unavailable" style={{ color: "var(--ink-dim)" }}>
                {possessive(B)} birth time is unknown — house overlays need a real Ascendant.
              </div>
            ) : (
              <table className="tp-table">
                <tbody>
                  {syn.overlaysAonB.slice(0, 7).map((o, i) => (
                    <tr key={i}>
                      <td><span className="pl-gl">{o.glyph}</span> {o.planet}</td>
                      <td style={{ color: "var(--ink-dim)" }}>{o.sign}</td>
                      <td className="num">H{o.house}</td>
                      <td style={{ color: "var(--ink-dim)" }}>{HOUSE_SHORT[o.house]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {(syn.receptionsAB.length > 0 || syn.receptionsBA.length > 0) && (
            <div className="syn-reception">
              <div className="syn-overlay-title">Cross-reception</div>
              {[...syn.receptionsAB, ...syn.receptionsBA].slice(0, 4).map((r, i) => (
                <div key={i} className="syn-reception-row">
                  {r.guest} received in {r.host}'s domain ({r.sign})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTM relational layer */}
      <div className="syn-ctm">
        <h3 className="syn-panel-h">Cylindrical Time · the two birth points compared</h3>
        <div className="syn-ctm-grid">
          <div className="syn-ctm-cell">
            <div className="syn-ctm-label">phase offset S</div>
            <div className="syn-ctm-big">{syn.ctm.syndromeFoldDeg.toFixed(1)}°</div>
            <div className="syn-ctm-note">
              {syn.ctm.syndromeFoldDeg < 30 ? "born nearly in phase on the round"
                : syn.ctm.syndromeFoldDeg > 150 ? "near counterphase on the round"
                : "offset on the round — distinct positions in the cycle"}
            </div>
            <div className="syn-ctm-note">
              the gap between the two births on the 30,030-day round — a calendar rhythm, not a chart aspect
            </div>
          </div>
          <div className="syn-ctm-cell">
            <div className="syn-ctm-label">positions on the round</div>
            <div className="syn-ctm-rows">
              <div className="cl-row"><span className="l">{A}</span><span className="v">θ {syn.ctm.tcoA.thetaDeg.toFixed(1)}°</span></div>
              <div className="cl-row"><span className="l">{B}</span><span className="v">θ {syn.ctm.tcoB.thetaDeg.toFixed(1)}°</span></div>
              <div className="cl-row"><span className="l">gap</span><span className="v">{Math.abs(Math.round(syn.ctm.tcoA.P - syn.ctm.tcoB.P)).toLocaleString()} days on the round</span></div>
            </div>
          </div>
          <div className="syn-ctm-cell">
            <div className="syn-ctm-label">shared shadow lanes (mod 11)</div>
            {syn.ctm.lanesReliable ? (
              <>
                <div className="syn-ctm-lanes">
                  {syn.ctm.sharedLanes.length === 0 && <span className="syn-ctm-note">no coincident lanes</span>}
                  {dedupeLanes(syn.ctm.sharedLanes).slice(0, 6).map((s, i) => (
                    <span key={i} className="syn-lane-chip">{s.a} ↔ {s.b} · {s.laneName}</span>
                  ))}
                </div>
                {syn.ctm.sharedLanes.length > 0 && (
                  <div className="syn-ctm-note">
                    shared lanes are common between any two charts — what distinguishes a pair is which bodies share them
                  </div>
                )}
              </>
            ) : (
              <div className="syn-ctm-note">
                {chartA.timeUnknown && chartB.timeUnknown
                  ? `${possessive(A)} and ${possessive(B)} birth times are both unknown`
                  : chartA.timeUnknown ? `${possessive(A)} birth time is unknown` : `${possessive(B)} birth time is unknown`}
                {" "}— the natal lane is an arcsecond-level residue an assumed noon can't support, so shared lanes aren't shown here.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mutual activations: two independent lifecycle scans (the same
          transitPerfections each chart already runs alone), merged for
          dates within a day of each other. Neither scan knows about the
          other chart — this only asks whether two already-exact facts
          happen to land close in time. */}
      <div className="syn-ctm">
        <div className="cl-head">
          <h3 className="syn-panel-h">Mutual activations · paired contacts within {MUTUAL_SAME_DAY_WINDOW * 24} hours</h3>
          <div className="cl-target">
            <button
              className={`cl-target-btn ${mutualTargetDate === null ? "is-on" : ""}`}
              onClick={() => setMutualTargetDate(null)}
              type="button"
            >now</button>
            <input
              className="cl-target-date"
              type="date"
              aria-label="target date — scan both charts' skies around this day"
              value={mutualTargetDate || ""}
              onChange={(e) => setMutualTargetDate(e.target.value || null)}
            />
            <span className="cl-now">{mutualTargetDate
              ? mutualTargetLabel
              : mutualNow.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
        </div>
        <p className="syn-ctm-note syn-mutual-note">
          Two independent scans of the year around {mutualTargetLabel} — the same exact perfection timeline each
          chart has on its own — compared for dates within {MUTUAL_SAME_DAY_WINDOW * 24} hours of each other.
          These are numerical contact searches. Closeness in time does not establish that the sky causes
          a relationship event or measures compatibility.
        </p>
        {completedScan && <p className="syn-ctm-note" role="status">
          Completed window: {new Date((completedScan.parameters.startJd - 2440587.5) * 86400000).toISOString().slice(0, 10)}
          {" to "}{new Date((completedScan.parameters.endJd - 2440587.5) * 86400000).toISOString().slice(0, 10)}
          {". "}{completedScan.hitsA.length} contacts for {A}, {completedScan.hitsB.length} for {B}; {completedScan.hits.length} pairs.
          {!mutualSaveFailed && " Saved with this relationship reading."}
        </p>}
        {completedScan && (chartA.timeUnknown || chartB.timeUnknown) && <p className="syn-ctm-note">
          At least one birth time is unknown. Its natal degrees use an assumed time, its angles are excluded,
          and the displayed contact dates can change when the birth time is corrected.
        </p>}
        {mutualSaveFailed && <p className="syn-error" role="alert">
          This completed scan could not be saved in browser history. Its results remain available in this reading.
        </p>}
        {mutualFailure ? (
          <p className="syn-error" role="alert">The scan could not finish: {mutualFailure}. No partial results were saved.</p>
        ) : !mutualRows ? (
          <div className="cl-row"><span className="l">scanning the year around {mutualTargetLabel} for both charts…</span></div>
        ) : mutualRows.length === 0 ? (
          <div className="cl-row"><span className="l">no paired contacts within {MUTUAL_SAME_DAY_WINDOW * 24} hours in this completed window</span></div>
        ) : (
          <table className="tp-table">
            <thead>
              <tr><th>date</th><th>{A}'s sky</th><th>{B}'s sky</th><th className="num">gap</th></tr>
            </thead>
            <tbody>
              {mutualRows.map((m, i) => (
                <tr key={i}>
                  <td>{m.a.dateISO.slice(0, 10)}</td>
                  <td><span className="pl-gl">{m.a.transitGlyph}</span> {m.a.transit} {m.a.aspect} <span className="pl-gl">{m.a.natalGlyph}</span> {m.a.natal}</td>
                  <td><span className="pl-gl">{m.b.transitGlyph}</span> {m.b.transit} {m.b.aspect} <span className="pl-gl">{m.b.natalGlyph}</span> {m.b.natal}</td>
                  <td className="num">{Math.abs(m.gapDays * 24).toFixed(1)} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SynAspectDetail({ hit, syn, A, B, agentOn }) {
  const provider = typeof window.useInterpreterState === "function" ? window.useInterpreterState()
    : { available: typeof window.agentAvailable === "function" && window.agentAvailable() };
  const identity = chart => typeof window.chartIdentityKey === "function" ? window.chartIdentityKey(chart) : JSON.stringify(chart.birth);
  const stateKey = JSON.stringify([identity(syn.chartA), identity(syn.chartB),
    syn.readingContext?.cacheFingerprint, A, B, hit.a, hit.b, hit.aspect, hit.orb,
    provider.available, provider.model, provider.generation]);
  const canRequest = agentOn && provider.available;
  const [state, setState] = $synUseState({ stateKey, loading: canRequest, text: null });
  $synUseEffect(() => {
    if (!canRequest) { setState({ stateKey, loading: false, text: null }); return; }
    let cancelled = false;
    setState({ stateKey, loading: true, text: null });
    interpretSynastryAspect(hit, syn).then(
      (text) => { if (!cancelled) setState({ stateKey, loading: false, text }); },
      () => { if (!cancelled) setState({ stateKey, loading: false, text: null }); }
    );
    return () => { cancelled = true; };
  }, [agentOn, stateKey]);
  const current = canRequest && state.stateKey === stateKey ? state : { loading: canRequest, text: null };
  const localText = `${aspectMeaning(hit.aspect)} — ${A}'s ${hit.a} signifies ${planetSignifies(hit.a)}; ${B}'s ${hit.b} signifies ${planetSignifies(hit.b)}.`;
  return (
    <div className="syn-asp-detail">
      <div className="syn-asp-detail-head">
        {A}'s {hit.a} {hit.aspect.toLowerCase()} {B}'s {hit.b}
        <span className={`syn-asp-tag ${hit.harmonious ? "is-harm" : hit.hard ? "is-hard" : "is-conj"}`}>
          {hit.harmonious ? "harmonious" : hit.hard ? "hard" : "fusion"}
        </span>
      </div>
      <div className="syn-asp-detail-body">
        {current.loading ? <span className="syn-loading">reading this contact…</span> : (current.text || localText)}
      </div>
    </div>
  );
}

function CompatibilityDial({ score }) {
  const pct = Math.round(score.ratio * 100);
  const R = 56, C = 2 * Math.PI * R;
  const harmArc = C * score.ratio;
  return (
    <div className="syn-dial">
      <svg viewBox="0 0 140 140" className="syn-dial-svg"
           role="img"
           aria-label={`Compatibility dial: ${pct} percent harmony. Ease ${Math.round(score.harmony)}, friction ${Math.round(score.friction)}, intensity ${Math.round(score.intensity * 100)} percent.`}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="oklch(0.30 0.01 60)" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke="oklch(0.85 0.05 150)" strokeWidth="8"
          strokeDasharray={`${harmArc} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="64" textAnchor="middle" className="syn-dial-num">{pct}</text>
        <text x="70" y="84" textAnchor="middle" className="syn-dial-unit">harmony</text>
      </svg>
      <div className="syn-dial-legend">
        <div className="syn-dial-leg-row"><span className="dot harm" /> ease {Math.round(score.harmony)}</div>
        <div className="syn-dial-leg-row"><span className="dot hard" /> friction {Math.round(score.friction)}</div>
        <div className="syn-dial-leg-row"><span className="dot int" /> intensity {Math.round(score.intensity * 100)}%</div>
      </div>
    </div>
  );
}

const ASPECT_SYMBOL = {
  Conjunction: "☌", Opposition: "☍", Trine: "△", Square: "□", Sextile: "✶", Quincunx: "⚻",
};
const HOUSE_SHORT = [
  "", "self", "money", "mind", "home", "joy", "work", "partner", "depth", "belief", "career", "friends", "unseen",
];
// A/B default to the pronouns "You"/"Them" when no subject name is given
// (see SynastryView above) — `${name}'s` reads as "You's"/"Them's" for
// those two specifically, so the possessive needs its own small map
// rather than a bare apostrophe-s suffix.
function possessive(name) {
  if (name === "You") return "Your";
  if (name === "Them") return "Their";
  return `${name}'s`;
}
function dedupeLanes(lanes) {
  const seen = new Set();
  return lanes.filter(l => { if (seen.has(l.lane)) return false; seen.add(l.lane); return true; });
}

Object.assign(window, { SynastryView, saveMutualScan });
