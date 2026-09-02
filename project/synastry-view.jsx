// synastry-view.jsx — the relationship reading UI.
//
// Two charts side by side, the agent's relationship synthesis, the
// weighted cross-aspect grid, house overlays, and the CTM phase-syndrome
// compatibility dial.

const { useState: $synUseState, useMemo: $synUseMemo, useEffect: $synUseEffect } = React;

function SynastryView({ chartA, chartB, settings, setTweak, onBack }) {
  const syn = $synUseMemo(() => computeSynastry(chartA, chartB), [chartA, chartB]);
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
  const mutualNow = useNow(60000);
  const [mutualTargetDate, setMutualTargetDate] = $synUseState(null);
  const mutualTarget = mutualTargetDate ? new Date(`${mutualTargetDate}T12:00:00Z`) : mutualNow;
  const jdTarget = dateToJD(mutualTarget);
  const [mutualHits, setMutualHits] = $synUseState(null);
  // Bucketed to a 30-day window of the target, same as the solo panel's
  // perfections scan — so "now" ticking every minute doesn't retrigger
  // the twelve-step scan, only crossing into a new window does.
  const mutualScanKey = `${chartA.jd}:${chartB.jd}:${Math.round(jdTarget / 30)}`;
  $synUseEffect(() => {
    let alive = true;
    setMutualHits(null);
    const centre = jdTarget;
    const bodies = ["Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
    const steps = bodies.map((b) => ["A", b]).concat(bodies.map((b) => ["B", b]));
    const hitsA = [], hitsB = [];
    const runStep = (i) => {
      if (!alive) return;
      if (i >= steps.length) {
        setMutualHits(mergeNearPerfections(hitsA, hitsB, MUTUAL_SAME_DAY_WINDOW));
        return;
      }
      const [who, body] = steps[i];
      const hits = transitPerfections(who === "A" ? chartA : chartB, centre, 366, [body]).hits;
      (who === "A" ? hitsA : hitsB).push(...hits);
      setTimeout(() => runStep(i + 1), 0);
    };
    const timer = setTimeout(() => runStep(0), 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [mutualScanKey]);

  // The dozen nearest the target, restored to chronological order for
  // display — same two-step sort the solo lifecycle panel's perfections use.
  const mutualRows = $synUseMemo(() => {
    if (!mutualHits) return null;
    return mutualHits
      .map((m) => ({ ...m, dTarget: m.jd - jdTarget }))
      .sort((x, y) => Math.abs(x.dTarget) - Math.abs(y.dTarget))
      .slice(0, 12)
      .sort((x, y) => x.jd - y.jd);
  }, [mutualHits, jdTarget]);
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
              ? "Agent interpreter on — sends both charts' data to Claude for each reading. Click to turn off."
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
          <h3 className="syn-panel-h">Mutual activations · the sky within a day of both charts</h3>
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
          chart has on its own — compared for dates within a day of each other. This is common, not
          rare: two unrelated charts still land a mutual hit roughly a dozen times a year by pure
          chance, so treat closeness in time as suggestive at best, never as evidence the sky is
          doing something to the relationship.
        </p>
        {!mutualRows ? (
          <div className="cl-row"><span className="l">scanning the year around {mutualTargetLabel} for both charts…</span></div>
        ) : mutualRows.length === 0 ? (
          <div className="cl-row"><span className="l">no mutual activations within a day, across the year around {mutualTargetLabel}</span></div>
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
  const [state, setState] = $synUseState({ loading: agentOn, text: null });
  $synUseEffect(() => {
    if (!agentOn) { setState({ loading: false, text: null }); return; }
    let cancelled = false;
    setState({ loading: true, text: null });
    interpretSynastryAspect(hit, syn).then(
      (text) => { if (!cancelled) setState({ loading: false, text }); },
      () => { if (!cancelled) setState({ loading: false, text: null }); }
    );
    return () => { cancelled = true; };
  }, [agentOn, hit.a, hit.b, hit.aspect]);
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
        {state.loading ? <span className="syn-loading">reading this contact…</span> : (state.text || localText)}
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

Object.assign(window, { SynastryView });
