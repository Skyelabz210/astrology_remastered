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

  // Voice
  const voice = useVoice({
    text:      agent.text,
    enabled:   !!settings.voiceOn,
    style:     settings.voiceStyle || "jedi",
    voiceName: settings.voiceName,
    playing,
  });

  // Called inside the button onClick — satisfies gesture requirement.
  const handleVoiceToggle = React.useCallback(() => {
    primeSpeech();
    const next = !settings.voiceOn;
    setTweak("voiceOn", next);
    if (next && agent.text) {
      // speak immediately in this gesture
      voice.retrigger && voice.retrigger(agent.text);
    } else {
      stopSpeech();
    }
  }, [settings.voiceOn, agent.text, voice.retrigger, setTweak]);

  // Pre-warm next
  const nextCard = cards[pos + 1];
  $sUseEffect(() => {
    if (agentOn && nextCard) interpretCard(nextCard, chart).catch(() => {});
  }, [agentOn, nextCard && nextCard.idx]);

  // Auto-advance
  $sUseEffect(() => {
    if (!playing || !shuffled || !current || !agent.text) return;
    const words = agent.text.split(/\s+/).length;
    const dwell = dwellFor(current, words);
    const t = setTimeout(() => setPos(p => Math.min(cards.length - 1, p + 1)), dwell);
    return () => clearTimeout(t);
  }, [pos, playing, shuffled, agent.text, current && current.idx, settings.voiceOn]);

  const onPrev = () => { setPos(p => Math.max(0, p - 1)); };
  const onNext = () => { setPos(p => Math.min(cards.length - 1, p + 1)); };

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
        onUnblockVoice={() => { primeSpeech(); voice.unblock && voice.unblock(); }}
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
            onSpeakNow={() => {
              if (!settings.voiceOn) setTweak("voiceOn", true);
              primeSpeech();
              if (agent.text) speakNow(agent.text, {
                style: settings.voiceStyle || "jedi",
                voiceName: settings.voiceName,
              });
            }}
          />
      }

      {shuffled && (
        <SessionControls
          pos={pos} total={cards.length} cards={cards}
          playing={playing}
          onPlay={() => setPlaying(p => !p)}
          onPrev={onPrev} onNext={onNext}
          onPick={i => { setPos(i); setPlaying(false); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// CINEMATIC STAGE
// ──────────────────────────────────────────────────────────────────────
function CinematicStage({ card, timeUnknown, agent, localReading, pos, total, voiceOn, voiceSpeaking, onSpeakNow }) {
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
          <span className="cs-title">{p.name} in {card.name}</span>
          {p.retrograde && <span className="cs-retro">℞</span>}
          <span className="cs-house">{timeUnknown ? "House —" : `House ${roman(card.house)}`}</span>
          <span className="cs-dig cs-dig-{card.dignity.kind}">{card.dignity.kind}</span>
        </div>

        <div className="cs-body">
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
        </div>

        {voiceOn && !voiceSpeaking && agent && agent.text && (
          <button className="cs-unblock" onClick={onSpeakNow}>
            ♪ speak this reading
          </button>
        )}
        {!voiceOn && (
          <button className="cs-unblock cs-unblock-dim" onClick={onSpeakNow}>
            ♪ tap to hear this reading
          </button>
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
  const d = new Date(chart.birth.dateISO);
  const dateStr = isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
  const timeStr = isNaN(d) ? "—" : d.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
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

function SessionControls({ pos, total, cards, playing, onPlay, onPrev, onNext, onPick }) {
  return (
    <footer className="rs-controls">
      <button className="rs-ctrl" onClick={onPrev} disabled={pos === 0} aria-label="Previous card">‹</button>
      <button className="rs-ctrl rs-ctrl-play" onClick={onPlay} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing}>{playing ? "▮▮" : "▶"}</button>
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
