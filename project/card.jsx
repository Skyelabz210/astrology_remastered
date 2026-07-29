// card.jsx — the iridescent zodiac card, the centerpiece of the interface.
//
// Layers (back to front):
//   1. card shell + parchment grain  (base monochrome)
//   2. ornamental frame + glyph art   (always visible)
//   3. iridescent foil               (conic gradient masked by cursor)
//   4. specular highlight            (radial gradient at cursor)
//   5. noise texture                 (SVG turbulence)
//   6. inner border + corner marks   (sharp on top of everything)
//   7. back face                     (reading text + math)
//
// The wrapper handles perspective + tilt via CSS custom properties so the
// browser composites on the GPU. No re-renders per mousemove.

const { useRef: $cardUseRef, useState: $cardUseState, useCallback: $cardUseCallback, useEffect: $cardUseEffect } = React;

function ZodiacCard({ card, chart, settings, isFlipped, onFlip }) {
  const wrap = $cardUseRef(null);
  const inner = $cardUseRef(null);
  const [hover, setHover] = $cardUseState(false);

  const onMove = $cardUseCallback((e) => {
    const el = wrap.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    const tilt = settings.tilt;
    el.style.setProperty('--mx', x + '%');
    el.style.setProperty('--my', y + '%');
    el.style.setProperty('--rx', (-(y - 50) / 50 * tilt) + 'deg');
    el.style.setProperty('--ry', ( (x - 50) / 50 * tilt) + 'deg');
  }, [settings.tilt]);

  const onLeave = $cardUseCallback(() => {
    const el = wrap.current;
    if (!el) return;
    setHover(false);
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  // Visual variables driven by natal data
  const styleVars = {
    '--resonance': card.resonance.toFixed(3),
    '--iridescence': (settings.iridescence * card.resonance).toFixed(3),
    '--noise': settings.noise,
    '--glow': (card.resonance * settings.glow).toFixed(3),
    '--hue-shift': card.hueShift + 'deg',
    '--specular': settings.specular,
    '--card-r': (8 + card.laneR13 * 0.4) + 'px',  // boundary-13 → corner radius
  };

  const rigorous = settings.rigorous;
  const p = card.principal;

  return (
    <div
      ref={wrap}
      className={`zc ${hover ? 'is-hover' : ''} ${isFlipped ? 'is-flipped' : ''} ${rigorous ? 'is-rigorous' : ''}`}
      style={styleVars}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onClick={() => onFlip(card.idx)}
    >
      <div className="zc-tilt" ref={inner}>
        <div className="zc-face zc-front">
          {/* parchment + grain */}
          <div className="zc-paper"></div>
          <div className="zc-grain"></div>

          {/* iridescent foil — masked tighter when not hovered */}
          <div className="zc-foil"></div>

          {/* specular highlight at cursor */}
          <div className="zc-spec"></div>

          {/* ornamental frame */}
          <svg className="zc-frame" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
            <rect x="2.5" y="2.5" width="95" height="135" rx="2" ry="2"
                  fill="none" stroke="currentColor" strokeWidth="0.35" />
            <rect x="4" y="4" width="92" height="132" rx="1.2" ry="1.2"
                  fill="none" stroke="currentColor" strokeWidth="0.15" strokeOpacity="0.55" />
          </svg>

          {/* corner marks */}
          <div className="zc-corner zc-tl">
            <div className="zc-house">{roman(card.house)}</div>
            <div className="zc-glyph-mini">{card.glyph}</div>
          </div>
          <div className="zc-corner zc-br">
            <div className="zc-house">{roman(card.house)}</div>
            <div className="zc-glyph-mini">{card.glyph}</div>
          </div>

          {/* principal planet sigil — top right of inner field */}
          <div className="zc-planet">
            <div className="zc-planet-glyph">{p.glyph}</div>
            {p.retrograde && <div className="zc-retro">℞</div>}
          </div>

          {/* centerpiece glyph + name */}
          <div className="zc-center">
            <div className="zc-big-glyph">{card.glyph}</div>
            <div className="zc-name">{card.name}</div>
            <div className="zc-latin">{card.latin}</div>
            <div className="zc-meta">
              <span>{card.element}</span>
              <i className="zc-dot"></i>
              <span>{card.modality}</span>
            </div>
          </div>

          {/* dignity ribbon */}
          <div className={`zc-dignity zc-dignity-${card.dignity.kind}`}>
            <span className="zc-dignity-word">{card.dignity.kind}</span>
            <span className="zc-dignity-score">
              {card.dignity.score === 0 ? "·" : (card.dignity.score > 0 ? "+" : "") + card.dignity.score}
            </span>
          </div>

          {/* tenants strip */}
          {card.tenants.length > 1 && (
            <div className="zc-tenants">
              {card.tenants.map(t => (
                <span key={t.name} className="zc-tenant" title={t.name}>{t.glyph}</span>
              ))}
            </div>
          )}

          {/* rigorous overlay — residue chips along bottom */}
          {rigorous && (
            <div className="zc-residues">
              <span className="zc-res">r₇<b>{p.residues.r7}</b></span>
              <span className="zc-res">r₁₁<b>{p.residues.r11}</b></span>
              <span className="zc-res">r₁₃<b>{p.residues.r13}</b></span>
              <span className="zc-res">K<b>{p.residues.r11 * 13 + p.residues.r13}</b></span>
            </div>
          )}
        </div>

        <div className="zc-face zc-back">
          <CardBack card={card} chart={chart} settings={settings} active={isFlipped} />
        </div>
      </div>
    </div>
  );
}

function CardBack({ card, chart, settings, active }) {
  const reading  = readingFor(card);   // synchronous fallback / skeleton
  const math     = rigorousFor(card);
  const agent    = useAgentReading(card, chart, active);

  return (
    <div className="zc-back-inner">
      <div className="zc-paper"></div>
      <div className="zc-grain"></div>
      <svg className="zc-frame" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <rect x="2.5" y="2.5" width="95" height="135" rx="2" ry="2"
              fill="none" stroke="currentColor" strokeWidth="0.35" />
      </svg>

      <div className="zc-back-content">
        <div className="zc-back-head">
          <div className="zc-back-glyph">{card.glyph}</div>
          <div>
            <div className="zc-back-title">{reading.title}</div>
            <div className="zc-back-sub">{reading.subtitle}</div>
          </div>
        </div>

        <div className="zc-back-body">
          {agent.loading && (
            <div className="zc-agent-loading">
              <span className="zc-agent-pulse"></span>
              <span>interpreting substrate…</span>
            </div>
          )}
          {agent.error && (
            <p className="zc-agent-error">agent unavailable — reading from local fallback.</p>
          )}
          {agent.text && <p className="zc-agent-text">{agent.text}</p>}
          {!agent.loading && !agent.text && !agent.error && reading.body.map((line, i) => (
            <p key={i} className="zc-fallback-line">{line}</p>
          ))}
        </div>

        {/* Classical apparatus — always visible. The substrate adds; it does not replace. */}
        <div className="zc-back-classical">
          <div className="zc-back-classical-head">classical apparatus</div>
          <div className="zc-back-classical-grid">
            <div><span className="l">dispositor</span><span className="v">{card.ruler}</span></div>
            <div><span className="l">triplicity</span><span className="v">{card.tripLord}</span></div>
            <div><span className="l">term</span><span className="v">{card.term}{card.inOwnTerm ? " ✓" : ""}</span></div>
            <div><span className="l">face</span><span className="v">{card.face}{card.inOwnFace ? " ✓" : ""}</span></div>
            <div><span className="l">ptol. score</span><span className="v">{card.ptolemaicBonus >= 0 ? "+" : ""}{card.ptolemaicBonus}</span></div>
            <div><span className="l">aspect</span><span className="v">{card.aspect ? `${card.aspect.name.slice(0,4)} ${card.aspect.sep.toFixed(1)}°` : "—"}</span></div>
          </div>
        </div>

        {settings.rigorous && (
          <div className="zc-back-math">
            <div className="zc-back-math-head">
              <span>Substrate</span>
              <span className="zc-back-math-hint">integer arcsec · CRT residues</span>
            </div>
            <div className="zc-back-math-grid">
              {math.map(m => (
                <div key={m.label} className={`zc-math-row ${m.shadow ? 'is-shadow' : ''}`}>
                  <span className="zc-math-label">{m.label}</span>
                  <span className="zc-math-value">{m.value}</span>
                </div>
              ))}
            </div>
            <div className="zc-back-lane">
              shadow lane <b>{card.laneR11}</b> · <i>{SHADOW_LANE_NAMES[card.laneR11]}</i>
              <br/>
              boundary lane <b>{card.laneR13}</b> · <i>{BOUNDARY_LANE_NAMES[card.laneR13]}</i>
            </div>
          </div>
        )}

        <div className="zc-back-foot">
          <span>tap to close</span>
          <span className="zc-resonance-bar" title={`resonance ρ = ${card.resonance.toFixed(3)}`}>
            <span className="zc-resonance-fill" style={{ width: (card.resonance * 100) + '%' }}></span>
          </span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ZodiacCard, CardBack });
