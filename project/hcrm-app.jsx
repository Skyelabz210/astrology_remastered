// hcrm-app.jsx — standalone shell for the HCRM Console.
// Reuses the landing entry (date/time/place pickers + globe) to produce a
// chart, then mounts the register console.

const { useState: $haState, useMemo: $haMemo, useEffect: $haEffect } = React;

const HCRM_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dateISO":     "1980-10-21T17:31:00-04:00",
  "lat":         35.1408,
  "lng":         -79.0058,
  "placeLabel":  "Fort Liberty (Bragg) · NC",
  "houseSystem": "whole",
  "sect":        "auto"
}/*EDITMODE-END*/;

class HBoundary extends React.Component {
  constructor(p){ super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e){ return { err: e }; }
  render(){
    if (this.state.err) return (
      <div className="boundary">
        <div className="boundary-title">register map unresolved</div>
        <div className="boundary-sub">{String(this.state.err && this.state.err.message || this.state.err)}</div>
        <button onClick={() => this.setState({ err: null })}>reset</button>
      </div>
    );
    return this.props.children;
  }
}

function HCRMApp() {
  const [screen, setScreen] = $haState("console");   // preloaded chart on open
  const [birth, setBirth] = $haState(HCRM_DEFAULTS);
  const [formState, setFormState] = $haState(null);

  const onCast = (payload) => {
    setBirth({
      dateISO: payload.dateISO, lat: payload.lat, lng: payload.lng,
      placeLabel: payload.placeLabel, houseSystem: birth.houseSystem, sect: birth.sect,
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
      });
    } catch (e) { console.error(e); return null; }
  }, [screen, birth]);

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
        <div className="boundary-title">chart unresolved</div>
        <button onClick={() => setScreen("landing")}>back</button>
      </div>
    );
  }
  const d = new Date(birth.dateISO);
  const label = `${isNaN(d) ? "—" : d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})} · ${birth.placeLabel}`;
  return (
    <HBoundary>
      <HCRMConsole chart={chart} birthLabel={label} onBack={() => setScreen("landing")} />
    </HBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<HCRMApp />);
