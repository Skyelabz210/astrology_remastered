// hcrm-app.jsx — standalone shell for the HCRM Console.
// Reuses the landing entry (date/time/place pickers + globe) to produce a
// chart, then mounts the register console.

const { useState: $haState, useMemo: $haMemo } = React;

const HCRM_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dateISO":     "1980-10-21T17:31:00-04:00",
  "lat":         35.1408,
  "lng":         -79.0058,
  "placeLabel":  "Fort Liberty (Bragg) · NC",
  "timeUnknown": false,
  "houseSystem": "whole",
  "sect":        "auto"
}/*EDITMODE-END*/;

// WP-19: render-time error boundary — thin wrapper over errors.jsx's
// ErrorBoundary (same component app.jsx uses), replacing the ad-hoc local
// class this file used to define. Preserves this console's own title
// wording; ErrorBoundary already surfaces the caught error's message.
function HBoundary({ children }) {
  return (
    <ErrorBoundary title="register map unresolved" resetLabel="reset">
      {children}
    </ErrorBoundary>
  );
}

// WP-19: status banners (SYNTHETIC ephemeris badge, polar-latitude
// house-system fallback, DST ambiguous/nonexistent note, unknown-time
// reminder, plus any pushed chart-build error) — same logic app.jsx's
// ChartStatusBanners applies, duplicated here rather than shared since
// this console does not load app.jsx (see hcrm-app.jsx's own <script>
// tags in HCRM Console.html / HCRM Console-print.html).
function HcrmStatusBanners({ chart, birth, banners, onDismiss }) {
  const notes = [];

  if (typeof window !== "undefined" && window.EPHEMERIS_MODE === "SYNTHETIC") {
    notes.push({
      id: "synthetic-mode",
      kind: "info",
      text: "Offline / synthetic ephemeris — planetary positions come from the built-in mean-motion model, not the verified astronomy-engine vendor data. Expect lower precision (typically a few arcminutes to roughly a degree).",
    });
  }

  if (chart && birth && typeof window !== "undefined" && window.Validate && window.HousesPolicy) {
    const warning = window.Validate.polarHouseWarning(
      birth.lat, birth.houseSystem, window.HousesPolicy.POLAR_FALLBACK_POLICY
    );
    if (warning) notes.push({ id: "polar-house", kind: "warn", text: warning.message });
  }

  if (birth && birth.dstNote) {
    notes.push({ id: "dst-note", kind: "warn", text: birth.dstNote });
  }

  if (chart && chart.timeUnknown) {
    notes.push({
      id: "time-unknown",
      kind: "info",
      text: "Birth time unknown — positions computed for 12:00 local. Ascendant, Midheaven, houses, and the Moon's exact degree are not reliable on this register map.",
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
      {typeof ErrorBanner !== "undefined" && <ErrorBanner banners={banners} onDismiss={onDismiss} />}
    </>
  );
}

function HCRMApp() {
  const [screen, setScreen] = $haState("console");   // preloaded chart on open
  const [birth, setBirth] = $haState(HCRM_DEFAULTS);
  const [formState, setFormState] = $haState(null);
  const { banners, pushError, dismiss } = useErrorBanner();

  const onCast = (payload) => {
    setBirth({
      dateISO: payload.dateISO, lat: payload.lat, lng: payload.lng,
      placeLabel: payload.placeLabel, houseSystem: birth.houseSystem, sect: birth.sect,
      timeUnknown: !!payload.timeUnknown,
      dstNote: payload.dstNote || null,
    });
    setFormState(payload.formState);
    setScreen("console");
  };

  const chart = $haMemo(() => {
    if (screen !== "console") return null;
    try {
      return computeNatal({
        dateISO: birth.dateISO, lat: birth.lat, lng: birth.lng,
        houseSystem: birth.houseSystem, sect: birth.sect, placeLabel: birth.placeLabel,
        timeUnknown: !!birth.timeUnknown,
      });
    } catch (e) { pushError(e, "register map"); return null; }
  }, [screen, birth, pushError]);

  if (screen === "landing") {
    return (
      <HBoundary>
        <Landing initial={formState} onCast={onCast} mode="hcrm" />
      </HBoundary>
    );
  }
  if (!chart) {
    return (
      <div className="boundary">
        <HcrmStatusBanners chart={null} birth={birth} banners={banners} onDismiss={dismiss} />
        <div className="boundary-title">chart unresolved</div>
        <div className="boundary-sub">the natal inputs did not produce a valid chart — see the error above for why.</div>
        <button onClick={() => setScreen("landing")}>back</button>
      </div>
    );
  }
  const d = new Date(birth.dateISO);
  const label = `${isNaN(d) ? "—" : d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})} · ${birth.placeLabel}`;
  return (
    <HBoundary>
      <HcrmStatusBanners chart={chart} birth={birth} banners={banners} onDismiss={dismiss} />
      <HCRMConsole chart={chart} birthLabel={label} onBack={() => setScreen("landing")} />
    </HBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<HCRMApp />);
