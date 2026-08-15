// app.jsx — root component: landing → spread.

const { useMemo: $useMemo, useState: $useState, useEffect: $useEffect } = React;

const DEFAULT_SETTINGS = /*EDITMODE-BEGIN*/{
  "dateISO":     "1990-03-21T12:30:00-06:00",
  "lat":         29.4241,
  "lng":         -98.4936,
  "placeLabel":  "San Antonio · TX",
  "timeUnknown": false,
  "houseSystem": "whole",
  "sect":        "auto",
  "tilt":        14,
  "iridescence": 0.85,
  "noise":       0.42,
  "glow":        0.85,
  "specular":    0.8,
  "rigorous":    false,
  "agentOn":     false,
  "spread":      "grid",
  "primeLayer":  false,
  "orbScale":    1.0,
  "harmonic":    7,
  "showAspects": true,
  "voiceOn":     false,
  "voiceStyle":  "jedi",
  "voiceName":   ""
}/*EDITMODE-END*/;

// Render-time error boundary — errors.jsx's ErrorBoundary (WP-19), wrapped
// here with this app's own wording so a single bad parse doesn't black out
// the whole app. This catches exceptions thrown WHILE RENDERING (a bug in a
// downstream component); it is a distinct failure mode from the
// useMemo-level chart-build failures below, which throw inside a try/catch
// and never reach a render-time boundary at all — those use
// useErrorBanner()/<ErrorBanner> instead (also from errors.jsx).
function Boundary({ children }) {
  return (
    <ErrorBoundary
      title="recomputing…"
      resetLabel="reset"
    >
      {children}
    </ErrorBoundary>
  );
}

function App() {
  const [settings, setTweak] = useTweaks(DEFAULT_SETTINGS);
  const t = { tweaks: settings, setTweak };
  const [screen, setScreen] = $useState("landing");
  const [landingState, setLandingState] = $useState(null);
  const [partner, setPartner] = $useState(null);       // partner birth payload
  const [partnerState, setPartnerState] = $useState(null);
  // WP-19: the DST ambiguous/nonexistent note landing.jsx computes at
  // submit time (tzresolve.js's resolveUtcInstant kind !== "ok"). Kept as
  // plain component state rather than a tweak — it's a one-shot notice
  // about how *this* birth instant was resolved, not a persisted setting
  // useTweaks would try to write back into DEFAULT_SETTINGS's EDITMODE
  // block on every change.
  const [dstNote, setDstNote] = $useState(null);

  // expose rigorous + prime layer flags as document classes
  $useEffect(() => {
    document.documentElement.classList.toggle('rigorous', settings.rigorous);
    document.documentElement.classList.toggle('prime-layer', settings.primeLayer);
  }, [settings.rigorous, settings.primeLayer]);

  const onCast = (payload) => {
    setTweak({
      dateISO:     payload.dateISO,
      lat:         payload.lat,
      lng:         payload.lng,
      placeLabel:  payload.placeLabel,
      timeUnknown: !!payload.timeUnknown,
    });
    setLandingState(payload.formState);
    setDstNote(payload.dstNote || null);
    setScreen("session");
  };

  const onCastPartner = (payload) => {
    setPartner(payload);
    setPartnerState(payload.formState);
    setScreen("synastry");
  };

  if (screen === "landing") {
    return (
      <Boundary>
        <Landing initial={landingState} onCast={onCast} />
      </Boundary>
    );
  }
  if (screen === "session") {
    return (
      <Boundary>
        <SessionScreen
          settings={settings}
          setTweak={setTweak}
          dstNote={dstNote}
          onBack={() => setScreen("landing")}
          onOpenSpread={() => setScreen("spread")}
          onOpenSynastry={() => setScreen("partner")}
        />
      </Boundary>
    );
  }
  if (screen === "partner") {
    return (
      <Boundary>
        <Landing
          initial={partnerState}
          onCast={onCastPartner}
          mode="partner"
          onBack={() => setScreen("session")}
        />
      </Boundary>
    );
  }
  if (screen === "synastry") {
    return (
      <Boundary>
        <SynastryScreen
          settings={settings}
          partner={partner}
          dstNote={dstNote}
          onBack={() => setScreen("session")}
        />
      </Boundary>
    );
  }
  return (
    <Boundary>
      <Spread settings={settings} setTweak={setTweak} t={t} dstNote={dstNote}
              onBack={() => setScreen("session")}
              onOpenSynastry={() => setScreen("partner")} />
    </Boundary>
  );
}

// WP-19: status banners shown near the top of every chart screen —
// SYNTHETIC-ephemeris badge, polar-latitude house-system fallback warning,
// the DST ambiguous/nonexistent note landing.jsx computed at submit time,
// an unknown-birth-time reminder, and (via <ErrorBanner>) any chart-build
// failures pushed by useErrorBanner(). All are read fresh on every render
// rather than cached, per the brief: window.EPHEMERIS_MODE is set
// synchronously by astro.jsx's own script execution, so it must be
// re-checked at chart-render time, not just once at module load.
function ChartStatusBanners({ chart, settings, dstNote, banners, onDismiss }) {
  const notes = [];

  if (typeof window !== "undefined" && window.EPHEMERIS_MODE === "SYNTHETIC") {
    notes.push({
      id: "synthetic-mode",
      kind: "info",
      text: "Offline / synthetic ephemeris — planetary positions come from the built-in mean-motion model, not the verified astronomy-engine vendor data. Expect lower precision (typically a few arcminutes to roughly a degree).",
    });
  }

  if (chart && settings && typeof window !== "undefined" && window.Validate && window.HousesPolicy) {
    const warning = window.Validate.polarHouseWarning(
      settings.lat, settings.houseSystem, window.HousesPolicy.POLAR_FALLBACK_POLICY
    );
    if (warning) notes.push({ id: "polar-house", kind: "warn", text: warning.message });
  }

  if (dstNote) {
    notes.push({ id: "dst-note", kind: "warn", text: dstNote });
  }

  if (chart && chart.timeUnknown) {
    notes.push({
      id: "time-unknown",
      kind: "info",
      text: "Birth time unknown — positions computed for 12:00 local. Ascendant, Midheaven, houses, and the Moon's exact degree are not reliable on this chart.",
    });
  }

  return (
    <>
      {notes.length > 0 && (
        <div className="chart-notes">
          {notes.map((n) => (
            <div key={n.id} className={`chart-note ${n.kind === "warn" ? "chart-note-warn" : ""}`}>
              <span className="chart-note-icon" aria-hidden="true">{n.kind === "warn" ? "⚠" : "ⓘ"}</span>
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}
      <ErrorBanner banners={banners} onDismiss={onDismiss} />
    </>
  );
}

function SynastryScreen({ settings, partner, dstNote, onBack }) {
  const { banners, pushError, dismiss } = useErrorBanner();

  const chartA = $useMemo(() => {
    try {
      return computeNatal({
        dateISO: settings.dateISO, lat: settings.lat, lng: settings.lng,
        houseSystem: settings.houseSystem, sect: settings.sect,
        placeLabel: settings.placeLabel, subjectName: "You",
        timeUnknown: !!settings.timeUnknown,
      });
    } catch (e) { pushError(e, "your chart"); return null; }
  }, [settings.dateISO, settings.lat, settings.lng, settings.houseSystem, settings.sect, settings.placeLabel, settings.timeUnknown, pushError]);

  const chartB = $useMemo(() => {
    if (!partner) return null;
    try {
      return computeNatal({
        dateISO: partner.dateISO, lat: partner.lat, lng: partner.lng,
        houseSystem: settings.houseSystem, sect: settings.sect,
        placeLabel: partner.placeLabel, subjectName: partner.subjectName || "Them",
        timeUnknown: !!partner.timeUnknown,
      });
    } catch (e) { pushError(e, "their chart"); return null; }
  }, [partner, settings.houseSystem, settings.sect, pushError]);

  if (!chartA || !chartB) {
    return (
      <div className="boundary">
        <ChartStatusBanners chart={null} settings={settings} dstNote={dstNote} banners={banners} onDismiss={dismiss} />
        <div className="boundary-title">synastry needs two charts</div>
        <div className="boundary-sub">
          {chartA && !chartB && !partner
            ? "the second birth input hasn't been entered yet."
            : "one of the two birth inputs did not resolve into a valid chart — see the error above."}
        </div>
        <button onClick={onBack}>back</button>
      </div>
    );
  }
  return (
    <>
      <ChartStatusBanners chart={chartA} settings={settings} dstNote={dstNote || (partner && partner.dstNote)} banners={banners} onDismiss={dismiss} />
      <SynastryView chartA={chartA} chartB={chartB} settings={settings} onBack={onBack} />
    </>
  );
}

function SessionScreen({ settings, setTweak, dstNote, onBack, onOpenSpread, onOpenSynastry }) {
  const { banners, pushError, dismiss } = useErrorBanner();

  const chart = $useMemo(() => {
    try {
      return computeNatal({
        dateISO: settings.dateISO,
        lat: settings.lat,
        lng: settings.lng,
        houseSystem: settings.houseSystem,
        sect: settings.sect,
        placeLabel: settings.placeLabel,
        timeUnknown: !!settings.timeUnknown,
      });
    } catch (e) { pushError(e, "natal chart"); return null; }
  }, [settings.dateISO, settings.lat, settings.lng, settings.houseSystem, settings.sect, settings.placeLabel, settings.timeUnknown, pushError]);

  if (!chart) {
    return (
      <div className="boundary">
        <ChartStatusBanners chart={null} settings={settings} dstNote={dstNote} banners={banners} onDismiss={dismiss} />
        <div className="boundary-title">substrate failed to resolve</div>
        <div className="boundary-sub">the natal inputs did not produce a valid chart — see the error above for why.</div>
        <button onClick={onBack}>return to entry</button>
      </div>
    );
  }
  return (
    <>
      <ChartStatusBanners chart={chart} settings={settings} dstNote={dstNote} banners={banners} onDismiss={dismiss} />
      <ReadingSession chart={chart} settings={settings} setTweak={setTweak} onBack={onBack} onOpenSpread={onOpenSpread} onOpenSynastry={onOpenSynastry} />
    </>
  );
}

function Spread({ settings, setTweak, t, dstNote, onBack }) {
  const { banners, pushError, dismiss } = useErrorBanner();

  // Natal computation — runs through Mayan CRT substrate every time.
  const chart = $useMemo(() => {
    try {
      return computeNatal({
        dateISO: settings.dateISO,
        lat: settings.lat,
        lng: settings.lng,
        houseSystem: settings.houseSystem,
        sect: settings.sect,
        placeLabel: settings.placeLabel,
        timeUnknown: !!settings.timeUnknown,
      });
    } catch (e) {
      pushError(e, "natal chart");
      return null;
    }
  }, [settings.dateISO, settings.lat, settings.lng, settings.houseSystem, settings.sect, settings.placeLabel, settings.timeUnknown, pushError]);

  const cards = $useMemo(() => {
    if (!chart) return [];
    return chart.cards.map(c => {
      if (!c.aspect) return c;
      const scaledOrb = c.aspect.orb * settings.orbScale;
      if (c.aspect.sep > scaledOrb) return { ...c, aspect: null };
      return c;
    });
  }, [chart, settings.orbScale]);

  const [flipped, setFlipped] = $useState(null);
  const onFlip = (idx) => setFlipped(f => (f === idx ? null : idx));

  const chartReading = useAgentChartReading(chart, settings.agentOn && !!chart);

  if (!chart) {
    return (
      <div className="boundary">
        <ChartStatusBanners chart={null} settings={settings} dstNote={dstNote} banners={banners} onDismiss={dismiss} />
        <div className="boundary-title">substrate failed to resolve</div>
        <div className="boundary-sub">the natal inputs did not produce a valid chart — see the error above for why.</div>
        <button onClick={onBack}>return to entry</button>
      </div>
    );
  }

  return (
    <div className="app">
      <ChartStatusBanners chart={chart} settings={settings} dstNote={dstNote} banners={banners} onDismiss={dismiss} />
      <Header chart={chart} settings={settings} setTweak={setTweak} onBack={onBack} />

      <Synthesis chart={chart} reading={chartReading} settings={settings} />

      <main className={`spread spread-${settings.spread}`}>
        {cards.map((card, i) => (
          <ZodiacCard
            key={card.name}
            card={card}
            chart={chart}
            settings={settings}
            isFlipped={flipped === i}
            onFlip={onFlip}
          />
        ))}
      </main>

      {/* WP-20: textual alternative to the card spread above — see
          a11y-table.jsx's own header for the "always in the a11y tree,
          also toggleable for sighted users" design rationale. */}
      {typeof window !== "undefined" && window.A11yChartTable && <A11yChartTable chart={chart} title="Natal chart placements" />}

      <TraditionalPanel chart={chart} />

      <LiveStatePanel chart={chart} />

      {settings.primeLayer && <PrimeLayer chart={chart} />}

      <TweaksPanel title="Tweaks">
        <NatalTweaks t={t} />
        <VisualTweaks t={t} />
        <SubstrateTweaks t={t} />
      </TweaksPanel>
    </div>
  );
}

function Header({ chart, settings, setTweak, onBack }) {
  const d = new Date(chart.birth.dateISO);
  const dateStr = isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  const timeStr = isNaN(d) ? "—" : d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
  const ascSign = ZODIAC[chart.ascSignIdx].name;
  return (
    <header className="hdr">
      <div className="hdr-brand">
        <button className="hdr-back" onClick={onBack} aria-label="Back to entry">←</button>
        <div className="hdr-mark">✦</div>
        <div>
          <div className="hdr-title">Resonance · Natal Spread</div>
          <div className="hdr-subtitle">
            {dateStr} · {timeStr} · {settings.placeLabel}
            <span className="hdr-dot">·</span>
            ASC {chart.asc.toFixed(2)}° {ascSign}
            <span className="hdr-dot">·</span>
            {chart.isDayChart ? "Day" : "Night"} chart
          </div>
        </div>
      </div>
      <div className="hdr-toggles">
        <button
          className={`hdr-pill ${settings.rigorous ? 'is-on' : ''}`}
          onClick={() => setTweak('rigorous', !settings.rigorous)}
          title="Reveal the integer-arcsec / CRT residues on each card"
          aria-pressed={settings.rigorous}
        >
          rigorous
        </button>
        <button
          className={`hdr-pill ${settings.primeLayer ? 'is-on' : ''}`}
          onClick={() => setTweak('primeLayer', !settings.primeLayer)}
          title="Reveal the underlying Prime Resonance lattice (mod 11 · mod 13)"
          aria-pressed={settings.primeLayer}
        >
          prime layer
        </button>
      </div>
    </header>
  );
}

function Synthesis({ chart, reading, settings }) {
  if (!settings.agentOn) return null;
  return (
    <section className="syn">
      <div className="syn-label">
        <span className="syn-dot"></span>
        agent synthesis
      </div>
      <div className="syn-text">
        {reading.loading && <span className="syn-loading">interpreting natal substrate…</span>}
        {reading.error   && <span className="syn-error">agent offline</span>}
        {reading.text    && <span>{reading.text}</span>}
      </div>
    </section>
  );
}

// ─────────────────────── tweaks groups ────────────────────────

// WP-19: free-entry latitude/longitude field, paired with a slider spanning
// the TRUE polar range (-90..90 lat, -180..180 lng — the previous ±66°
// slider clamp silently made polar latitudes impossible to enter at all).
// Typing a non-numeric or out-of-range value shows an inline error and
// does NOT call onValid — the underlying setting only changes once the
// typed value validates, so a mid-edit "-1" or "9" never corrupts the
// chart's actual latitude/longitude.
function LatLngTweak({ label, kind, value, onValid }) {
  const [text, setText] = React.useState(String(value));
  const [error, setError] = React.useState(null);
  const min = kind === "lat" ? -90 : -180;
  const max = kind === "lat" ?  90 :  180;

  // Stay in sync when the value changes from elsewhere (the paired slider,
  // or a fresh chart cast from the landing screen's city picker).
  React.useEffect(() => {
    setText(String(value));
    setError(null);
  }, [value]);

  const commitText = (raw) => {
    setText(raw);
    const validator = (typeof window !== "undefined" && window.Validate)
      ? (kind === "lat" ? window.Validate.validateLatitude : window.Validate.validateLongitude)
      : null;
    if (!validator) return; // validate.js not loaded — leave uncommitted rather than guess
    const r = validator(raw);
    if (r.ok) { setError(null); onValid(r.value); }
    else { setError(r.error); }
  };

  return (
    <div className="tw-latlng">
      <TweakSlider label={label} value={value} min={min} max={max} step={0.1} unit="°"
        onChange={(v) => onValid(Number(v))} />
      <div className="tw-row">
        <label className="tw-lbl">{label.toLowerCase()} (type a value)</label>
        <input
          className={`tw-inp ${error ? "tw-inp-invalid" : ""}`}
          type="text"
          inputMode="decimal"
          value={text}
          aria-invalid={!!error}
          onChange={(e) => commitText(e.target.value)}
        />
      </div>
      {error && <div className="tw-err" role="alert">{error}</div>}
    </div>
  );
}

function NatalTweaks({ t }) {
  const date = new Date(t.tweaks.dateISO);
  const dateStr = isNaN(date) ? "" : t.tweaks.dateISO.slice(0,10);
  const timeStr = isNaN(date) ? "" : t.tweaks.dateISO.slice(11,16);
  const [dateError, setDateError] = React.useState(null);
  const setDate = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) { setDateError(null); return; }
    const [y, m, d] = s.split("-").map(Number);
    // WP-19: real-calendar validation (leap years etc.) — the native
    // <input type="date"> UI blocks most of this already, but a
    // programmatically-set or non-conforming value shouldn't be trusted
    // silently, and this is the one free-entry date field in the app
    // (landing.jsx's own date pickers are constrained to real days by
    // construction — see project/docs/ux-validation-checklist.md #1).
    if (typeof window !== "undefined" && window.Validate && !window.Validate.isValidCalendarDate({ year: y, month: m, day: d })) {
      setDateError(`${s} is not a real calendar date.`);
      return;
    }
    setDateError(null);
    const t2 = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "12:00";
    t.setTweak('dateISO', `${s}T${t2}:00`);
  };
  const setTime = (s) => {
    if (!s || !/^\d{2}:\d{2}$/.test(s)) return;
    const d2 = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : "1990-03-21";
    t.setTweak('dateISO', `${d2}T${s}:00`);
  };
  return (
    <TweakSection label="Natal coordinates">
      <div className="tw-row">
        <label className="tw-lbl">date</label>
        <input className="tw-inp" type="date" value={dateStr} onChange={e => setDate(e.target.value)} />
      </div>
      {dateError && <div className="tw-err" role="alert">{dateError}</div>}
      <div className="tw-row">
        <label className="tw-lbl">time</label>
        <input className="tw-inp" type="time" value={timeStr} onChange={e => setTime(e.target.value)} />
      </div>
      <LatLngTweak label="Latitude"  kind="lat" value={t.tweaks.lat} onValid={v => t.setTweak('lat', v)} />
      <LatLngTweak label="Longitude" kind="lng" value={t.tweaks.lng} onValid={v => t.setTweak('lng', v)} />
      <TweakText label="Place" value={t.tweaks.placeLabel}
        onChange={v => t.setTweak('placeLabel', v)} />
      <TweakRadio label="House system" value={t.tweaks.houseSystem} options={[
        { value: 'whole', label: 'Whole' },
        { value: 'equal', label: 'Equal' },
      ]} onChange={v => t.setTweak('houseSystem', v)} />
      <TweakRadio label="Sect" value={t.tweaks.sect} options={[
        { value: 'auto',  label: 'Auto'  },
        { value: 'day',   label: 'Day'   },
        { value: 'night', label: 'Night' },
      ]} onChange={v => t.setTweak('sect', v)} />
    </TweakSection>
  );
}

function VisualTweaks({ t }) {
  return (
    <TweakSection label="Visual layer">
      <TweakSlider label="Tilt"        value={t.tweaks.tilt}        min={0}   max={28}  step={1}    unit="°"  onChange={v => t.setTweak('tilt', Number(v))} />
      <TweakSlider label="Iridescence" value={t.tweaks.iridescence} min={0}   max={1.2} step={0.01}           onChange={v => t.setTweak('iridescence', Number(v))} />
      <TweakSlider label="Specular"    value={t.tweaks.specular}    min={0}   max={1.4} step={0.01}           onChange={v => t.setTweak('specular', Number(v))} />
      <TweakSlider label="Glow"        value={t.tweaks.glow}        min={0}   max={1.5} step={0.01}           onChange={v => t.setTweak('glow', Number(v))} />
      <TweakSlider label="Grain"       value={t.tweaks.noise}       min={0}   max={1}   step={0.01}           onChange={v => t.setTweak('noise', Number(v))} />
    </TweakSection>
  );
}

function SubstrateTweaks({ t }) {
  const voices = (typeof window !== "undefined" && window.listVoices) ? window.listVoices() : [];
  return (
    <TweakSection label="Substrate · reading">
      <TweakToggle label="Agent interpreter"             value={t.tweaks.agentOn}    onChange={v => t.setTweak('agentOn', v)} />
      <TweakToggle label="Voice narration"               value={t.tweaks.voiceOn}    onChange={v => t.setTweak('voiceOn', v)} />
      {t.tweaks.voiceOn && (
        <TweakSelect label="Style" value={t.tweaks.voiceStyle || "jedi"}
          options={[
            { value: "measured", label: "measured · neutral" },
            { value: "jedi",     label: "jedi · silver-tongued" },
            { value: "sith",     label: "sith · deep menace" },
            { value: "ultimate", label: "ultimate power · drag the s's" },
          ]}
          onChange={v => t.setTweak('voiceStyle', v)} />
      )}
      {t.tweaks.voiceOn && voices.length > 0 && (
        <TweakSelect label="Voice" value={t.tweaks.voiceName || voices[0].name}
          options={voices.slice(0, 16).map(v => ({ value: v.name, label: `${v.name} · ${v.lang}` }))}
          onChange={v => t.setTweak('voiceName', v)} />
      )}
      <TweakToggle label="Show residues on cards"        value={t.tweaks.rigorous}   onChange={v => t.setTweak('rigorous', v)} />
      <TweakToggle label="Reveal Prime Resonance layer"  value={t.tweaks.primeLayer} onChange={v => t.setTweak('primeLayer', v)} />
      <TweakSlider label="Orb scale" value={t.tweaks.orbScale} min={0.3} max={2.0} step={0.05}
        onChange={v => t.setTweak('orbScale', Number(v))} />
      <TweakSelect label="Harmonic" value={t.tweaks.harmonic} options={[
        { value: 7,  label: '7 — septile'   },
        { value: 11, label: '11 — shadow'   },
        { value: 13, label: '13 — boundary' },
      ]} onChange={v => t.setTweak('harmonic', Number(v))} />
    </TweakSection>
  );
}

// ─────────────────────── classical apparatus (always shown) ───────────────────────

function TraditionalPanel({ chart }) {
  const dignities = chart.planets
    .map(p => ({ planet: p.name, glyph: p.glyph, sign: ZODIAC[p.sign].name, kind: p.dignity.kind, score: p.dignity.score, house: p.house, lon: p.lon, retro: p.retrograde, crit: p.criticalDegree, decl: p.declination }))
    .filter(d => ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","NorthNode","SouthNode","Lilith"].includes(d.planet));

  return (
    <section className="tp">
      <header className="tp-head">
        <div className="tp-title">Classical apparatus</div>
        <div className="tp-sub">angles · dignities · sect · phase · lots · aspects · patterns</div>
      </header>

      <div className="tp-grid">
        <div className="tp-card">
          <h4>Four angles</h4>
          <div className="tp-row"><span className="l">ASC ascendant</span><span className="v">{chart.asc.toFixed(2)}° {ZODIAC[chart.ascSignIdx].name}</span></div>
          <div className="tp-row"><span className="l">MC midheaven</span><span className="v">{chart.mc.toFixed(2)}° {ZODIAC[chart.mcSignIdx].name}</span></div>
          <div className="tp-row"><span className="l">DSC descendant</span><span className="v">{chart.desc.toFixed(2)}°</span></div>
          <div className="tp-row"><span className="l">IC imum coeli</span><span className="v">{chart.ic.toFixed(2)}°</span></div>
        </div>

        <div className="tp-card">
          <h4>Sect · phase · void</h4>
          <div className="tp-row"><span className="l">sect</span><span className="v">{chart.isDayChart ? "Day" : "Night"} chart</span></div>
          <div className="tp-row"><span className="l">lunar phase</span><span className="v">{chart.phase.phase}</span></div>
          <div className="tp-row"><span className="l">illumination</span><span className="v">{(chart.phase.illumination * 100).toFixed(0)}%</span></div>
          <div className="tp-row"><span className="l">Moon − Sun</span><span className="v">{chart.phase.elongDeg.toFixed(2)}°</span></div>
          <div className="tp-row"><span className="l">Moon void of course</span><span className="v">{chart.voidOfCourse.isVoc ? "yes" : "no"}</span></div>
          <div className="tp-row"><span className="l">next sign change</span><span className="v">{chart.voidOfCourse.daysToNextSignChange.toFixed(2)} d</span></div>
        </div>

        <div className="tp-card">
          <h4>Chart shape</h4>
          <div className="tp-row"><span className="l">shape</span><span className="v">{chart.shape.shape}</span></div>
          <div className="tp-row"><span className="l">largest gap</span><span className="v">{chart.shape.largestGapDeg.toFixed(1)}°</span></div>
          <div className="tp-row"><span className="l">occupied arc</span><span className="v">{chart.shape.occupiedArcDeg.toFixed(1)}°</span></div>
          <div className="tp-row"><span className="l">house system</span><span className="v">{chart.birth.houseSystem}</span></div>
        </div>

        <div className="tp-card">
          <h4>Element balance</h4>
          {Object.entries(chart.elementCount).map(([k, v]) => (
            <div className="tp-row" key={k}>
              <span className="l">{k.toLowerCase()}</span>
              <span className="v">{v} <BalanceBar n={v} max={10} /></span>
            </div>
          ))}
        </div>

        <div className="tp-card">
          <h4>Modality balance</h4>
          {Object.entries(chart.modalityCount).map(([k, v]) => (
            <div className="tp-row" key={k}>
              <span className="l">{k.toLowerCase()}</span>
              <span className="v">{v} <BalanceBar n={v} max={10} /></span>
            </div>
          ))}
        </div>

        <div className="tp-card">
          <h4>Hemisphere · quadrant</h4>
          <div className="tp-row"><span className="l">upper / lower</span><span className="v">{chart.hemisphereCount.upper} / {chart.hemisphereCount.lower}</span></div>
          <div className="tp-row"><span className="l">east / west</span><span className="v">{chart.hemisphereCount.east} / {chart.hemisphereCount.west}</span></div>
          <div className="tp-row"><span className="l">angular</span><span className="v">{chart.quadrantCount.angular}</span></div>
          <div className="tp-row"><span className="l">succedent</span><span className="v">{chart.quadrantCount.succedent}</span></div>
          <div className="tp-row"><span className="l">cadent</span><span className="v">{chart.quadrantCount.cadent}</span></div>
        </div>
      </div>

      <div className="tp-card" style={{ marginTop: 16 }}>
        <h4>Hellenistic lots</h4>
        <table className="tp-table">
          <thead>
            <tr><th>lot</th><th className="num">λ</th><th>sign</th><th>formula</th></tr>
          </thead>
          <tbody>
            {chart.lots.map(l => (
              <tr key={l.name}>
                <td>{l.name}</td>
                <td className="num">{l.lon.toFixed(2)}°</td>
                <td>{l.signName}</td>
                <td style={{ color: "var(--ink-dim)" }}>{l.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tp-card" style={{ marginTop: 16 }}>
        <h4>Essential dignities</h4>
        <table className="tp-table">
          <thead>
            <tr>
              <th>body</th>
              <th>sign</th>
              <th className="num">λ</th>
              <th>house</th>
              <th>dignity</th>
              <th className="num">score</th>
              <th>note</th>
            </tr>
          </thead>
          <tbody>
            {dignities.map(d => (
              <tr key={d.planet}>
                <td><span className="pl-gl">{d.glyph}</span> {d.planet}{d.retro ? " ℞" : ""}</td>
                <td>{d.sign}</td>
                <td className="num">{d.lon.toFixed(2)}°</td>
                <td>H{d.house}</td>
                <td className={d.score > 0 ? "pos" : d.score < 0 ? "neg" : ""}>{d.kind}</td>
                <td className={`num ${d.score > 0 ? "pos" : d.score < 0 ? "neg" : ""}`}>
                  {d.score > 0 ? "+" : ""}{d.score}
                </td>
                <td style={{ color: "var(--ink-dim)" }}>
                  {d.crit === "anaretic" && "29° anaretic "}
                  {d.crit === "critical" && "critical deg "}
                  {Math.abs(d.decl) > 23.45 && "out-of-bounds"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tp-grid" style={{ marginTop: 16 }}>
        <div className="tp-card" style={{ gridColumn: "span 2" }}>
          <h4>Aspect grid (tightest first)</h4>
          {chart.aspectGrid.length === 0 ? (
            <div className="tp-row"><span className="l">no aspects within orb</span></div>
          ) : (
            <table className="tp-table">
              <thead><tr><th>pair</th><th>aspect</th><th className="num">orb</th><th>phase</th><th>family</th></tr></thead>
              <tbody>
                {chart.aspectGrid.slice(0, 12).map((a, i) => (
                  <tr key={i}>
                    <td><span className="pl-gl">{a.aGlyph}</span> {a.a} – <span className="pl-gl">{a.bGlyph}</span> {a.b}</td>
                    <td>{a.aspect}</td>
                    <td className="num">{a.orb.toFixed(2)}°</td>
                    <td>{a.phase}</td>
                    <td style={{ color: "var(--ink-dim)" }}>{a.family}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="tp-card">
          <h4>Patterns · stelliums · joys</h4>
          {chart.patterns.length === 0 && chart.stelliums.length === 0 && chart.joys.length === 0 && chart.receptions.length === 0 && (
            <div className="tp-row"><span className="l">none in this chart</span></div>
          )}
          {chart.patterns.map((p, i) => (
            <div className="tp-row" key={"pat" + i}>
              <span className="l">{p.kind}</span><span className="v">{p.bodies.join(", ")}</span>
            </div>
          ))}
          {chart.stelliums.map((s, i) => (
            <div className="tp-row" key={"st" + i}>
              <span className="l">stellium in {s.sign}</span><span className="v">{s.bodies.join(", ")}</span>
            </div>
          ))}
          {chart.joys.map((j, i) => (
            <div className="tp-row" key={"j" + i}>
              <span className="l">joy</span><span className="v">{j.planet} · H{j.house}</span>
            </div>
          ))}
          {chart.receptions.map((r, i) => (
            <div className="tp-row" key={"r" + i}>
              <span className="l">mutual reception ({r.kind})</span><span className="v">{r.a} ↔ {r.b}</span>
            </div>
          ))}
        </div>
      </div>

      {chart.antisciaContacts.length > 0 && (
        <div className="tp-card" style={{ marginTop: 16 }}>
          <h4>Antiscia (solstice-axis mirrors, 1° orb)</h4>
          <table className="tp-table">
            <thead><tr><th>pair</th><th>kind</th><th className="num">orb</th></tr></thead>
            <tbody>
              {chart.antisciaContacts.map((c, i) => (
                <tr key={i}>
                  <td>{c.a} — {c.b}</td>
                  <td>{c.kind}</td>
                  <td className="num">{c.orb.toFixed(3)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BalanceBar({ n, max }) {
  const w = Math.max(0, Math.min(1, n / max));
  return (
    <span className="bal-bar" aria-hidden="true">
      <span className="bal-bar-fill" style={{ width: `${w * 60}px` }}></span>
    </span>
  );
}



function PrimeLayer({ chart }) {
  // ─────────────────────── Prime resonance lattice overlay ───────────────────────
  // The hidden lattice the user reverse-engineered. Renders the planets'
  // mod-11 (shadow) and mod-13 (boundary) lanes as a connectivity graph
  // overlaid below the spread. Pairs sharing r₁₁ are bonded.
  const planets = chart.planets;
  const shadowBonds = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      if (planets[i].residues.r11 === planets[j].residues.r11) {
        shadowBonds.push([planets[i], planets[j]]);
      }
    }
  }

  // Place planets on a circle for the lattice diagram
  const cx = 280, cy = 220, r = 170;
  const pos = (idx) => {
    const a = (idx / planets.length) * Math.PI * 2 - Math.PI/2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  return (
    <section className="pl">
      <header className="pl-head">
        <div className="pl-title">Prime Resonance · Mayan CRT substrate</div>
        <div className="pl-sub">
          Safe Basis {'{'} 2, 3, 5, 7, 11, 13 {'}'} · M = 30,030 · Gear 17·19 = 323
          · Maya epoch JD 584,283
        </div>
      </header>

      <div className="pl-grid">
        <div className="pl-lattice">
          <svg viewBox="0 0 560 440" width="100%" height="100%"
               role="img"
               aria-label={`Prime resonance lattice: ${planets.length} bodies arranged on a circle, with dashed lines connecting bodies that share a mod-11 shadow lane. The CRT signatures table to the right lists the same data as text.`}>
            <defs>
              <radialGradient id="pl-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor="#1a1614" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r+20} fill="url(#pl-bg)" />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,240,220,0.12)" />
            {/* 11 shadow-lane tick marks */}
            {Array.from({length:11}).map((_,i) => {
              const a = (i / 11) * Math.PI * 2 - Math.PI/2;
              const x1 = cx + (r-6)  * Math.cos(a);
              const y1 = cy + (r-6)  * Math.sin(a);
              const x2 = cx + (r+10) * Math.cos(a);
              const y2 = cy + (r+10) * Math.sin(a);
              return <line key={'s'+i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,240,220,0.45)" strokeWidth="0.8" />;
            })}
            {/* 13 boundary-lane tick marks (inside) */}
            {Array.from({length:13}).map((_,i) => {
              const a = (i / 13) * Math.PI * 2 - Math.PI/2;
              const x1 = cx + (r-22) * Math.cos(a);
              const y1 = cy + (r-22) * Math.sin(a);
              const x2 = cx + (r-6)  * Math.cos(a);
              const y2 = cy + (r-6)  * Math.sin(a);
              return <line key={'b'+i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,240,220,0.20)" strokeWidth="0.5" />;
            })}
            {/* shadow bonds */}
            {shadowBonds.map(([a, b], k) => {
              const ia = planets.indexOf(a), ib = planets.indexOf(b);
              const pa = pos(ia), pb = pos(ib);
              return <line key={'sb'+k} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="rgba(255,240,220,0.55)" strokeWidth="0.7" strokeDasharray="3 3" />;
            })}
            {/* planet nodes */}
            {planets.map((p, i) => {
              const { x, y } = pos(i);
              return (
                <g key={p.name}>
                  <circle cx={x} cy={y} r="14" fill="#0a0807" stroke="rgba(255,240,220,0.6)" />
                  <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(248,240,222,0.95)" fontSize="14" fontFamily="serif">{p.glyph}</text>
                  <text x={x} y={y+24} textAnchor="middle"
                        fill="rgba(255,240,220,0.45)" fontSize="8" fontFamily="ui-monospace,monospace">
                    r₁₁={p.residues.r11}·r₁₃={p.residues.r13}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="pl-table">
          <div className="pl-table-head">CRT signatures</div>
          <table>
            <thead>
              <tr><th>body</th><th>λ°</th><th>r₇</th><th className="is-shadow">r₁₁</th><th>r₁₃</th><th>K</th></tr>
            </thead>
            <tbody>
              {planets.map(p => {
                const K = ((p.residues.r11 * 13) + p.residues.r13) % 323;
                return (
                  <tr key={p.name}>
                    <td><span className="pl-gl">{p.glyph}</span> {p.name}</td>
                    <td>{p.lon.toFixed(2)}°</td>
                    <td>{p.residues.r7}</td>
                    <td className="is-shadow">{p.residues.r11}</td>
                    <td>{p.residues.r13}</td>
                    <td>{K}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="pl-note">
            Classical astrology surfaces residues mod 2, 3, 5, 7, 12.
            It is blind to mod 11. The shadow column above lists the eleven
            lanes the substrate exposes — bonds in the lattice link bodies
            sharing a lane.
          </div>
          {shadowBonds.length > 0 && (
            <div className="pl-bonds">
              <div className="pl-bonds-head">Shadow contacts (mod 11)</div>
              <ul>
                {shadowBonds.map(([a, b], i) => (
                  <li key={i}>
                    <span className="pl-gl">{a.glyph}</span> {a.name} ↔ <span className="pl-gl">{b.glyph}</span> {b.name}
                    · lane <b>{a.residues.r11}</b> · <i>{SHADOW_LANE_NAMES[a.residues.r11]}</i>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
