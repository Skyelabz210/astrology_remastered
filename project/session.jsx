// session.jsx — cinematic reading session.
//
// The card is gone; the reading IS the experience.
// Each draw fills the viewport: a massive zodiac glyph shimmers in the
// background while the agent's text materialises word by word in the
// foreground — the same feel as the Conan/Star-Wars stone-writing effect.
// The iridescence, glow intensity, and reveal cadence all scale with the
// card's resonance.

const { useState: $sUseState, useEffect: $sUseEffect, useRef: $sUseRef, useMemo: $sUseMemo } = React;

function dwellFor(card, textLength) {
  // Stay on a card at least until the text is fully revealed, then add a beat.
  const revealMs = textLength * 52; // ~52 ms per word
  const minDwell = 5000 + 6000 * card.resonance;
  return Math.max(revealMs + 1800, minDwell);
}

function ReadingSession({ chart, settings, setTweak, onOpenSpread, onOpenSynastry, onBack }) {
  const order = $sUseMemo(() => deckOrder(chart), [chart]);
  const cards  = $sUseMemo(() => order.map(i => chart.cards[i]), [chart, order]);

  const [pos,      setPos]      = $sUseState(0);
  const [playing,  setPlaying]  = $sUseState(true);
  const [shuffled, setShuffled] = $sUseState(false);

  // ── continuous narration ────────────────────────────────────────────
  // The chart plays as ONE narrative rather than twelve separately-
  // triggered readings: narrative.jsx composes an opening, the signs in
  // deck order, and a closing into a single piece; voice.jsx speaks it
  // end to end and reports which segment the voice has actually reached;
  // the deck follows THAT rather than a parallel dwell timer.
  const [narrating,    setNarrating]    = $sUseState(false);
  const [narrationSeg, setNarrationSeg] = $sUseState(0);
  const [narrationStatus, setNarrationStatus] = $sUseState({ state: "idle", message: "" });
  const narrationRef = $sUseRef(null);

  // Shuffle intro
  $sUseEffect(() => {
    const t = setTimeout(() => setShuffled(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const current = cards[pos];
  // `=== true`, not `!== false`: DEFAULT_SETTINGS.agentOn is opt-in now, so a
  // settings object that simply lacks the key must read as OFF.
  const agentOn = settings.agentOn === true;
  const agent   = useAgentReading(current, chart, agentOn && shuffled && !!current);
  // Local, non-AI fallback — used whenever the agent is off (or errors),
  // so turning the "Agent interpreter" off degrades to a real reading
  // instead of the bare element/modality/dignity placeholder. With the
  // opt-in default this is now the ORDINARY path, not the exception.
  const localReading = $sUseMemo(() => current && readingFor(current, chart), [current, chart]);

  // What the voice actually says, and what the deck's dwell timer measures.
  //
  // This used to be `agent.text` alone, which meant narration had nothing to
  // speak whenever the Agent interpreter was off — and it IS off by default
  // (DEFAULT_SETTINGS.agentOn is false, deliberately, so no birth data is
  // sent anywhere unless the reader opts in). The screen was showing the
  // local, non-AI reading in that case while the voice sat silent, and the
  // deck never advanced either, because the auto-advance effect below was
  // gated on the same missing `agent.text`.
  //
  // So: speak whatever is on screen. The local reading's `sourceTag`s are
  // provenance labels for the eye ("Ptolemaic dignity table"), not part of
  // the sentence, so only the `text` halves are joined.
  const spokenText = $sUseMemo(() => {
    if (agent.text) return agent.text;
    if (!localReading || !localReading.body) return "";
    return localReading.body.map(line => line.text).join(" ");
  }, [agent.text, localReading]);

  // The whole-chart narrative. Rebuilt only when the chart itself changes:
  // it is the same piece from the first play to the last, so a re-render
  // must not hand the player a different object mid-reading.
  //
  // `agentTexts` passes through whatever the Agent interpreter has ALREADY
  // produced (agent.jsx's own cache), keyed by card index — a card the
  // agent has interpreted narrates in its words, every other card in
  // narrative.jsx's locally-composed ones. Nothing new is fetched to build
  // this: composing the whole chart through the agent would mean twelve
  // sequential LLM round trips before the first word, and would send birth
  // data for cards the reader never asked about.
  const narrative = $sUseMemo(() => {
    if (typeof buildChartNarrative !== "function") return null;
    let agentTexts = null;
    if (agentOn && typeof __cache !== "undefined" && typeof cacheKey === "function") {
      agentTexts = {};
      order.forEach((idx) => {
        const card = chart.cards[idx];
        if (!card) return;
        try {
          const hit = __cache.get(cacheKey(card));
          if (hit) agentTexts[idx] = hit;
        } catch { /* cache shape changed — fall back to local text */ }
      });
    }
    return buildChartNarrative(chart, { agentTexts });
  }, [chart, order, agentOn, agent.text]);

  // Where each narrative segment puts the deck. Segments that are not a
  // card (the opening, the closing) leave the current card alone.
  const showSegment = React.useCallback((seg) => {
    if (!seg) return;
    setNarrationSeg(seg.index);
    if (seg.cardIdx == null) return;
    const at = order.indexOf(seg.cardIdx);
    if (at >= 0) setPos(at);
  }, [order]);

  const stopNarration = React.useCallback(() => {
    if (narrationRef.current) {
      try { narrationRef.current.stop(); } catch { /* already stopped */ }
      narrationRef.current = null;
    }
    setNarrating(false);
  }, []);

  // Voice. `provider`/`elevenVoiceId`/`elevenModel` select the ElevenLabs
  // reading voice (default "Nerissa"); voice.jsx falls back to the
  // browser's SpeechSynthesis whenever ElevenLabs cannot serve, so these
  // being unset or unusable degrades rather than silences the narration.
  const voice = useVoice({
    text:          spokenText,
    // While the whole chart is playing as one narrative, the per-card
    // auto-speak is disabled outright — two speakers on one audio element
    // is not a race worth having, and the narration already covers this
    // card. It resumes the moment narration stops.
    enabled:       !!settings.voiceOn && !narrating,
    style:         settings.voiceStyle || "jedi",
    voiceName:     settings.voiceName,
    provider:      settings.voiceProvider,
    elevenVoiceId: settings.elevenVoiceId,
    elevenModel:   settings.elevenModel,
    playing,
  });

  // Start the whole chart playing, from the top or from the card on screen.
  // MUST be called inside a click handler: voice.prime() unlocks both
  // engines in that gesture so the asynchronous ElevenLabs playback that
  // follows a second or two later is not refused as autoplay.
  const startNarration = React.useCallback((fromSegment = 0) => {
    if (!narrative || !narrative.segments.length) return;
    voice.prime && voice.prime();
    stopSpeech();
    const rest = fromSegment > 0
      ? { text: narrative.text, segments: narrative.segments.slice(fromSegment) }
      : narrative;
    setNarrating(true);
    setNarrationSeg(rest.segments[0] ? rest.segments[0].index : 0);
    setPlaying(true);
    narrationRef.current = speakNarrative(rest, {
      style:         settings.voiceStyle || "jedi",
      voiceName:     settings.voiceName,
      provider:      settings.voiceProvider,
      elevenVoiceId: settings.elevenVoiceId,
      elevenModel:   settings.elevenModel,
      onSegment:     showSegment,
      onStatus:      setNarrationStatus,
      onEnd:         () => { narrationRef.current = null; setNarrating(false); },
    });
  }, [narrative, voice.prime, settings.voiceStyle, settings.voiceName, settings.voiceProvider,
      settings.elevenVoiceId, settings.elevenModel, showSegment]);

  // Called inside the button onClick — satisfies gesture requirement.
  //
  // Turning the voice ON starts the whole chart playing, because that is
  // what the control now means: this reading is one continuous piece, not
  // twelve things to trigger one at a time.
  const handleVoiceToggle = React.useCallback(() => {
    voice.prime && voice.prime();
    const next = !settings.voiceOn;
    setTweak("voiceOn", next);
    if (!next) { stopNarration(); stopSpeech(); return; }
    if (narrative && narrative.segments.length) startNarration(narrationSeg);
    else if (spokenText) voice.retrigger && voice.retrigger(spokenText);
  }, [settings.voiceOn, spokenText, narrative, narrationSeg, startNarration, stopNarration,
      voice.retrigger, voice.prime, setTweak]);

  // Pre-warm next
  const nextCard = cards[pos + 1];
  $sUseEffect(() => {
    if (agentOn && nextCard) interpretCard(nextCard, chart).catch(() => {});
  }, [agentOn, nextCard && nextCard.idx]);

  // Auto-advance — the fallback pacing for when the chart is NOT being
  // narrated as one piece. While it is, the voice's own position drives the
  // deck (showSegment), and a second timer moving `pos` underneath it would
  // desynchronise the card from the words.
  $sUseEffect(() => {
    if (narrating) return;
    if (!playing || !shuffled || !current || !spokenText) return;
    const words = spokenText.split(/\s+/).length;
    const dwell = dwellFor(current, words);
    const t = setTimeout(() => setPos(p => Math.min(cards.length - 1, p + 1)), dwell);
    return () => clearTimeout(t);
  }, [pos, playing, shuffled, spokenText, current && current.idx, settings.voiceOn, narrating]);

  // Stepping by hand means the reader wants THIS card, not the running
  // reading — so the narration yields rather than dragging the deck back.
  const onPrev = () => { stopNarration(); setPos(p => Math.max(0, p - 1)); };
  const onNext = () => { stopNarration(); setPos(p => Math.min(cards.length - 1, p + 1)); };

  // Leaving the session must not leave a voice running behind it.
  $sUseEffect(() => () => { stopNarration(); stopSpeech(); }, [stopNarration]);

  if (!current) return null;

  return (
    <div className="rs">
      <SessionHeader
        chart={chart}
        onOpenSpread={onOpenSpread}
        onOpenSynastry={onOpenSynastry}
        onBack={onBack}
        voiceOn={settings.voiceOn}
        voiceSpeaking={voice.speaking}
        voiceBlocked={voice.blocked}
        onToggleVoice={handleVoiceToggle}
        onUnblockVoice={() => { voice.prime && voice.prime(); voice.unblock && voice.unblock(); }}
        agentOn={agentOn}
        onToggleAgent={() => setTweak('agentOn', !agentOn)}
      />

      {!shuffled
        ? <ShuffleAnimation />
        : <CinematicStage
            key={current.idx}
            card={current}
            timeUnknown={!!chart.timeUnknown}
            agent={agent}
            localReading={localReading}
            pos={pos}
            total={cards.length}
            voiceOn={settings.voiceOn}
            voiceSpeaking={voice.speaking}
            voiceStatus={narrating ? narrationStatus : voice.status}
            spokenText={spokenText}
            narrating={narrating}
            narrationSeg={narrationSeg}
            narrationTotal={narrative ? narrative.segments.length : 0}
            narrationSegment={narrating && narrative ? narrative.segments[narrationSeg] : null}
            onPlayWholeChart={() => startNarration(0)}
            onResumeWholeChart={() => startNarration(narrationSeg)}
            onStopNarration={stopNarration}
            onSpeakNow={() => {
              if (!settings.voiceOn) setTweak("voiceOn", true);
              voice.prime && voice.prime();
              if (spokenText) speakNow(spokenText, {
                style:         settings.voiceStyle || "jedi",
                voiceName:     settings.voiceName,
                provider:      settings.voiceProvider,
                elevenVoiceId: settings.elevenVoiceId,
                elevenModel:   settings.elevenModel,
              });
            }}
          />
      }

      {shuffled && (
        <SessionControls
          pos={pos} total={cards.length} cards={cards}
          playing={playing}
          narrating={narrating}
          onPlay={() => {
            // While the chart is being narrated, play/pause means the
            // READING pauses — the voice holds mid-sentence and the deck
            // holds with it — not "stop advancing the cards on a timer".
            const next = !playing;
            setPlaying(next);
            if (narrating && narrationRef.current) {
              if (next) narrationRef.current.resume();
              else narrationRef.current.pause();
            }
          }}
          onPrev={onPrev} onNext={onNext}
          onPick={i => { stopNarration(); setPos(i); setPlaying(false); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// CINEMATIC STAGE
// ──────────────────────────────────────────────────────────────────────
function CinematicStage({ card, timeUnknown, agent, localReading, spokenText, pos, total,
                         voiceOn, voiceSpeaking, voiceStatus, narrating, narrationSeg,
                         narrationTotal, narrationSegment, onPlayWholeChart, onResumeWholeChart,
                         onStopNarration, onSpeakNow }) {
  const p = card.principal;

  return (
    <div className="cs" style={{
      "--resonance":    card.resonance.toFixed(3),
      "--hue-shift":    card.hueShift + "deg",
      "--dignity-sign": card.dignity.kind === "domicile" || card.dignity.kind === "exaltation" ? "1" : "0",
    }}>
      {/* massive glyph watermark */}
      <div className="cs-glyph-wrap" aria-hidden="true">
        <div className="cs-glyph">{card.glyph}</div>
        <div className="cs-glyph-foil" />
      </div>

      {/* foreground reading */}
      <div className="cs-fg">
        <div className="cs-card-meta">
          <span className="cs-pos">{String(pos + 1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
          <span className="cs-planet-glyph">{p.glyph}</span>
          <span className="cs-title">
            {narrating && narrationSegment && narrationSegment.cardIdx == null
              ? narrationSegment.title
              : `${p.name} in ${card.name}`}
          </span>
          {p.retrograde && <span className="cs-retro">℞</span>}
          <span className="cs-house">{timeUnknown ? "House —" : `House ${roman(card.house)}`}</span>
          <span className="cs-dig cs-dig-{card.dignity.kind}">{card.dignity.kind}</span>
        </div>

        <div className="cs-body">
          {/* While the chart is being read as one narrative, the page shows
              the SENTENCE THE VOICE IS SPEAKING, revealed word by word,
              rather than the source-tagged per-card table underneath. The
              two say different things — the narrative is written for the
              ear, the table for the eye — and showing one while hearing the
              other makes the reading feel like two apps at once. The table
              comes back the moment narration stops. */}
          {narrating && narrationSegment ? (
            <WordReveal text={narrationSegment.text} resonance={card.resonance} />
          ) : (<>
          {agent.loading && (
            <div className="cs-loading">
              <span className="cs-loading-dot" />
              <span className="cs-loading-dot" style={{animationDelay:"0.3s"}} />
              <span className="cs-loading-dot" style={{animationDelay:"0.6s"}} />
            </div>
          )}
          {agent.error && <p className="cs-error">interpreter unavailable — reading from local fallback</p>}
          {agent.text && <WordReveal text={agent.text} resonance={card.resonance} />}
          {!agent.loading && !agent.text && localReading && (
            <div className="cs-local-reading">
              {localReading.body.map((line, i) => (
                <p key={i} className="cs-local-line">
                  {line.text}
                  <span className="cs-source-tag"> — {line.sourceTag}</span>
                </p>
              ))}
            </div>
          )}
          </>)}
        </div>

        {/* The whole chart, as one piece. This is the primary control now:
            the reading is a single continuous narrative, and these buttons
            start, hold and leave it. Every one of them is a real click
            handler, which is what lets voice.jsx unlock both audio engines
            in the same gesture — see its header on why that matters. */}
        {narrating ? (
          <div className="cs-narration">
            <button className="cs-unblock" onClick={onStopNarration}>
              ■ stop the reading
            </button>
            {narrationTotal > 0 && (
              <span className="cs-narration-pos">
                reading {Math.min(narrationSeg + 1, narrationTotal)} of {narrationTotal}
              </span>
            )}
          </div>
        ) : (
          <div className="cs-narration">
            <button className="cs-unblock" onClick={onPlayWholeChart}>
              ▶ play the whole chart
            </button>
            {narrationSeg > 0 && (
              <button className="cs-unblock cs-unblock-dim" onClick={onResumeWholeChart}>
                ⏵ resume from here
              </button>
            )}
            {spokenText && (
              <button className="cs-unblock cs-unblock-dim" onClick={onSpeakNow}>
                ♪ just this sign
              </button>
            )}
          </div>
        )}

        <div className="cs-resonance">
          <span className="cs-res-label">resonance</span>
          <span className="cs-res-bar">
            <span className="cs-res-fill" style={{ width: `${(card.resonance * 100).toFixed(1)}%` }} />
          </span>
          {voiceOn && (
            <span className={`cs-voice-state ${voiceSpeaking ? "is-on" : ""}`}>
              {voiceSpeaking ? "▶ speaking" : "♪"}
            </span>
          )}
          {/* Why the voice sounds different than expected — the only place
              a reader finds out mid-reading that the ElevenLabs request was
              refused and the browser engine took over. Silence with no
              explanation is the failure mode this avoids. */}
          {voiceOn && voiceStatus && (voiceStatus.state === "fallback" || voiceStatus.state === "error") && (
            <span className="cs-voice-note" role="status">{voiceStatus.message}</span>
          )}
          {voiceOn && voiceStatus && voiceStatus.state === "synthesizing" && (
            <span className="cs-voice-note">{voiceStatus.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Word-by-word reveal. Each word fades in; the "live" word glows briefly.
function WordReveal({ text, resonance }) {
  const words = text.split(/(\s+)/);
  const [shown, setShown] = $sUseState(0);
  const intervalRef = $sUseRef(null);

  // Speed scales with resonance — heavier cards reveal a touch slower.
  const ms = Math.round(55 + 40 * (1 - resonance));

  $sUseEffect(() => {
    setShown(0);
    intervalRef.current = setInterval(() => {
      setShown(n => {
        if (n >= words.length) { clearInterval(intervalRef.current); return n; }
        return n + 1;
      });
    }, ms);
    return () => clearInterval(intervalRef.current);
  }, [text]);

  return (
    <p className="cs-text">
      {words.map((w, i) => {
        if (i >= shown) return null;
        const isLive = i === shown - 1 && shown < words.length;
        return (
          <span key={i} className={`cs-word ${isLive ? "cs-word-live" : ""}`}>{w}</span>
        );
      })}
      {shown < words.length && <span className="cs-cursor" aria-hidden="true">▍</span>}
    </p>
  );
}

function ShuffleAnimation() {
  return (
    <div className="rs-shuffle">
      <div className="rs-shuf-card rs-shuf-1" />
      <div className="rs-shuf-card rs-shuf-2" />
      <div className="rs-shuf-card rs-shuf-3" />
      <div className="rs-shuf-card rs-shuf-4" />
      <div className="rs-shuf-label">reading the coordinates…</div>
    </div>
  );
}

function SessionHeader({ chart, onOpenSpread, onOpenSynastry, onBack,
                         voiceOn, voiceSpeaking, voiceBlocked, onToggleVoice,
                         agentOn, onToggleAgent }) {
  // Birth-place clock, not device clock — see AstroCore.birthClockParts.
  const { dateStr, timeStr } = AstroCore.birthClockParts(chart.birth.dateISO, chart.birth.tz);
  return (
    <header className="rs-hdr">
      <div className="rs-hdr-l">
        <button className="hdr-back" onClick={onBack} aria-label="Back to entry">←</button>
        <div className="rs-hdr-brand">
          <span className="rs-hdr-mark">✦</span>
          <span>Resonance</span>
        </div>
      </div>
      <div className="rs-hdr-meta">
        {dateStr} · {timeStr} · {chart.birth.placeLabel || `${chart.birth.lat.toFixed(2)}°`}
      </div>
      <div className="rs-hdr-r">
        <button
          className={`hdr-voice ${voiceOn ? "is-on" : ""} ${voiceSpeaking ? "is-speaking" : ""} ${voiceBlocked ? "is-blocked" : ""}`}
          onClick={onToggleVoice}
          title={voiceBlocked ? "Tap to enable voice" : voiceOn ? "Voice on" : "Voice off"}
        >
          <SpeakerIcon active={voiceSpeaking} />
          <span className="hdr-voice-label">
            {voiceBlocked ? "tap to enable" : voiceOn ? "voice on" : "voice off"}
          </span>
        </button>
        <button
          className={`hdr-pill ${agentOn ? "is-on" : ""}`}
          onClick={onToggleAgent}
          title={agentOn
            ? "Agent interpreter on — sends birth data to Claude for each reading. Click to turn off."
            : "Agent interpreter off — readings stay local. Click to turn on."}
          aria-pressed={agentOn}
        >
          agent
        </button>
        {onOpenSynastry && (
          <button className="hdr-pill hdr-pill-syn" onClick={onOpenSynastry}>synastry</button>
        )}
        <button className="hdr-pill" onClick={onOpenSpread}>full spread</button>
      </div>
    </header>
  );
}

function SpeakerIcon({ active }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 5h2l3-2.5v9L4 9H2z" fill="currentColor"/>
      <path d="M9 4.5c1 0.6 1.6 1.5 1.6 2.5S10 8.9 9 9.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>
      {active && <path d="M11 3c1.8 1 2.8 2.4 2.8 4s-1 3-2.8 4" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round"/>}
    </svg>
  );
}

function SessionControls({ pos, total, cards, playing, narrating, onPlay, onPrev, onNext, onPick }) {
  // The play control's LABEL changes with what it actually does: while the
  // chart is being read as one narrative it holds the voice mid-sentence,
  // and calling that "pause" without saying what pauses would be vague at
  // exactly the moment a screen-reader user needs it to be precise.
  const playLabel = narrating
    ? (playing ? "Pause the reading" : "Resume the reading")
    : (playing ? "Pause" : "Play");
  return (
    <footer className={`rs-controls ${narrating ? "is-narrating" : ""}`}>
      <button className="rs-ctrl" onClick={onPrev} disabled={pos === 0} aria-label="Previous card">‹</button>
      <button className="rs-ctrl rs-ctrl-play" onClick={onPlay} aria-label={playLabel} aria-pressed={playing}>{playing ? "▮▮" : "▶"}</button>
      <button className="rs-ctrl" onClick={onNext} disabled={pos >= total - 1} aria-label="Next card">›</button>
      <div className="rs-dots" role="group" aria-label="Jump to card">
        {cards.map((c, i) => (
          <button
            key={i}
            className={`rs-dot ${i === pos ? "is-active" : ""} ${i < pos ? "is-past" : ""}`}
            onClick={() => onPick(i)}
            title={`${c.principal.name} in ${c.name}`}
            aria-label={`${c.principal.name} in ${c.name}${i === pos ? " (current)" : ""}`}
            aria-current={i === pos ? "true" : undefined}
            style={{ "--resonance": c.resonance.toFixed(2) }}
          />
        ))}
      </div>
    </footer>
  );
}

Object.assign(window, { ReadingSession });
