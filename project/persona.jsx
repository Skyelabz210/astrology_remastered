// persona.jsx - Natal Persona Inspector
//
// New page for in-depth natal chart analysis with:
// - Saved birth charts (defaults to Fort Liberty chart)
// - Live sky watcher (recomputes every minute)
// - Transit-to-natal table
// - CRAM resonance events timeline
// - Persona panel (dominant element/modality, sect, almuten, time-lords)
// - "Narrate today" button using existing narrator
//
// This component is designed to be integrated into app.jsx

const { useState, useEffect, useMemo, useCallback } = React;

// Import from astro.jsx (will be available in browser)
// These are defined in astro.jsx and will be available globally
const PLANET_GLYPH = window.PLANET_GLYPH || {
  Sun: "\u2609", Moon: "\u263d", Mercury: "\u263f", Venus: "\u2640", Mars: "\u2642",
  Jupiter: "\u2643", Saturn: "\u2644", Uranus: "\u2645", Neptune: "\u2646", Pluto: "\u2647",
  NorthNode: "\u260a", SouthNode: "\u260b", Chiron: "\u26b7", Lilith: "\u26b8",
};

const ZODIAC = window.ZODIAC || [
  { name: "Aries", glyph: "\u2648" },
  { name: "Taurus", glyph: "\u2649" },
  { name: "Gemini", glyph: "\u264a" },
  { name: "Cancer", glyph: "\u264b" },
  { name: "Leo", glyph: "\u264c" },
  { name: "Virgo", glyph: "\u264d" },
  { name: "Libra", glyph: "\u264e" },
  { name: "Scorpio", glyph: "\u264f" },
  { name: "Sagittarius", glyph: "\u2650" },
  { name: "Capricorn", glyph: "\u2651" },
  { name: "Aquarius", glyph: "\u2652" },
  { name: "Pisces", glyph: "\u2653" },
];

// Default Fort Liberty chart (21 Oct 1980, 21:31 UTC)
const DEFAULT_CHART = {
  dateISO: "1980-10-21T21:31:00Z",
  lat: 35.1408,
  lng: -79.0058,
  tz: "America/New_York",
  placeLabel: "Fort Liberty (Bragg) \u00b7 NC",
  subjectName: "Default",
};

// ============================================================================
// PROFILE STORE FOR PERSONA CHARTS
// ============================================================================

const PersonaProfileStore = {
  STORAGE_KEY: "personaCharts",
  
  load: function() {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  
  save: function(charts) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(charts));
    } catch {
      // Ignore errors
    }
  },
  
  addChart: function(chart) {
    const charts = this.load();
    charts.push(chart);
    this.save(charts);
    return charts;
  },
  
  removeChart: function(index) {
    const charts = this.load();
    charts.splice(index, 1);
    this.save(charts);
    return charts;
  },
  
  updateChart: function(index, chart) {
    const charts = this.load();
    charts[index] = chart;
    this.save(charts);
    return charts;
  },
};

// ============================================================================
// PERSONA PAGE COMPONENT
// ============================================================================

function PersonaPage({ onBack, settings }) {
  const [savedCharts, setSavedCharts] = useState(() => PersonaProfileStore.load());
  const [selectedChartIndex, setSelectedChartIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [transitData, setTransitData] = useState(null);
  const [cramEvents, setCramEvents] = useState([]);
  const [personaData, setPersonaData] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [narrationText, setNarrationText] = useState("");
  
  // Selected chart (defaults to Fort Liberty if none saved)
  const selectedChart = useMemo(() => {
    if (savedCharts.length === 0) {
      return DEFAULT_CHART;
    }
    return savedCharts[selectedChartIndex] || DEFAULT_CHART;
  }, [savedCharts, selectedChartIndex]);
  
  // Load chart data
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Calculate natal chart
  useEffect(() => {
    const computeChart = async () => {
      setLoading(true);
      try {
        // Use window.computeNatal if available
        if (typeof window !== "undefined" && window.computeNatal) {
          const chartData = window.computeNatal({
            date: new Date(selectedChart.dateISO),
            lat: selectedChart.lat,
            lng: selectedChart.lng,
            tz: selectedChart.tz,
          });
          setChart(chartData);
        }
      } catch (e) {
        console.error("Error computing chart:", e);
      } finally {
        setLoading(false);
      }
    };
    
    computeChart();
  }, [selectedChart]);
  
  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Calculate transits and CRAM events when chart and time change
  useEffect(() => {
    if (!chart) return;
    
    const calculateTransits = () => {
      try {
        // This would use the transit calculations from transits.ts
        // For now, we'll create dummy data
        const now = currentTime;
        const jdNow = typeof dateToJD === "function" ? dateToJD(now) : 0;
        
        // In practice, this would call calculateTransitToNatal
        // with current planet positions and natal chart
        
        // For now, create dummy transit data
        const dummyTransits = [
          {
            transitPlanet: 'Moon',
            natalPlanet: 'Sun',
            aspect: 'Trine',
            orbArcsec: 120 * 3600,
            exact: false,
            applying: true,
            separating: false,
            stationery: false,
            separationArcsec: 115 * 3600,
            exactHitDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            exactHitJd: jdNow + 2,
          },
          {
            transitPlanet: 'Mars',
            natalPlanet: 'Ascendant',
            aspect: 'Square',
            orbArcsec: 90 * 3600,
            exact: false,
            applying: false,
            separating: true,
            stationery: false,
            separationArcsec: 95 * 3600,
            exactHitDate: null,
            exactHitJd: null,
          },
        ];
        
        setTransitData(dummyTransits);
        
        // Calculate CRAM events
        const dummyCramEvents = [
          {
            timestamp: now,
            jd: jdNow,
            transitPlanet: 'Moon',
            natalPlanet: 'Sun',
            lane: 3,
            residue: 0,
            windingIndex: 5,
            separationArcsec: 115 * 3600,
            aspect: 'Trine',
          },
        ];
        setCramEvents(dummyCramEvents);
        
        // Calculate persona data
        const dummyPersonaData = {
          dominantElement: 'Fire',
          dominantModality: 'Cardinal',
          sect: 'day',
          almuten: 'Mars',
          almutenScore: 15,
          profectionLord: 'Jupiter',
          timeLord: 'Saturn',
          timeLordType: 'firdaria',
          timeLordYears: 30,
        };
        setPersonaData(dummyPersonaData);
        
      } catch (e) {
        console.error("Error calculating transits:", e);
      }
    };
    
    calculateTransits();
  }, [chart, currentTime]);
  
  // Save charts when they change
  useEffect(() => {
    PersonaProfileStore.save(savedCharts);
  }, [savedCharts]);
  
  // Narrate today
  const handleNarrateToday = useCallback(() => {
    if (!chart) return;
    
    setNarrating(true);
    setNarrationText("Generating your daily persona reading...");
    
    // In practice, this would use the existing narrator
    // For now, create a dummy narration
    setTimeout(() => {
      const narration = generateDailyNarration(chart, personaData, transitData);
      setNarrationText(narration);
      setNarrating(false);
    }, 1000);
  }, [chart, personaData, transitData]);
  
  // Generate daily narration
  const generateDailyNarration = (chart, personaData, transitData) => {
    if (!chart || !personaData) {
      return "Unable to generate narration without chart data.";
    }
    
    return `Today, your ${personaData.dominantElement} nature is highlighted, with ${personaData.almuten} as the almuten of your chart. 
    The ${personaData.profectionLord} profection lord is active, and you're under the influence of ${personaData.timeLord} in your ${personaData.timeLordType}. 
    
    Current transits show the Moon forming a trine to your natal Sun, bringing emotional harmony and creative expression. 
    Mars is separating from a square to your Ascendant, easing recent tensions. 
    
    Your persona today is one of confident action and emotional balance.`;
  };
  
  // Add new chart
  const handleAddChart = () => {
    const newChart = { ...DEFAULT_CHART, subjectName: `Chart ${savedCharts.length + 1}` };
    const updatedCharts = PersonaProfileStore.addChart(newChart);
    setSavedCharts(updatedCharts);
    setSelectedChartIndex(updatedCharts.length - 1);
  };
  
  // Remove chart
  const handleRemoveChart = (index) => {
    if (savedCharts.length <= 1) return;
    if (index === selectedChartIndex) {
      setSelectedChartIndex(0);
    }
    const updatedCharts = PersonaProfileStore.removeChart(index);
    setSavedCharts(updatedCharts);
  };
  
  // Select chart
  const handleSelectChart = (index) => {
    setSelectedChartIndex(index);
  };
  
  // Update chart name
  const handleUpdateChartName = (index, name) => {
    const updatedCharts = [...savedCharts];
    updatedCharts[index] = { ...updatedCharts[index], subjectName: name };
    setSavedCharts(updatedCharts);
    PersonaProfileStore.save(updatedCharts);
  };
  
  if (loading) {
    return (
      <div className="persona-page">
        <div className="persona-header">
          <button onClick={onBack} className="btn-back">\u25c0 Back</button>
          <h1>Persona Inspector</h1>
        </div>
        <div className="persona-loading">
          <p>Loading chart data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="persona-page">
      {/* Header */}
      <div className="persona-header">
        <button onClick={onBack} className="btn-back">\u25c0 Back</button>
        <h1>Persona Inspector</h1>
        <div className="persona-actions">
          <button onClick={handleAddChart} className="btn-small">+ Add Chart</button>
          <button onClick={handleNarrateToday} className="btn-small" disabled={narrating}>
            {narrating ? "Narrating..." : "Narrate Today"}
          </button>
        </div>
      </div>
      
      {/* Saved Charts Sidebar */}
      <div className="persona-layout">
        <div className="persona-sidebar">
          <h2>Saved Charts</h2>
          <ul className="chart-list">
            {savedCharts.length === 0 ? (
              <li className="chart-item">
                <span>No saved charts</span>
              </li>
            ) : (
              savedCharts.map((c, index) => (
                <li
                  key={index}
                  className={`chart-item ${index === selectedChartIndex ? 'selected' : ''}`}
                  onClick={() => handleSelectChart(index)}
                >
                  <span className="chart-name">{c.subjectName}</span>
                  <span className="chart-date">{new Date(c.dateISO).toLocaleDateString()}</span>
                  {savedCharts.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveChart(index);
                      }}
                    >
                      \u2715
                    </button>
                  )}
                </li>
              ))
            )}
            <li className="chart-item default-chart" onClick={() => setSelectedChartIndex(-1)}>
              <span className="chart-name">Fort Liberty (Default)</span>
              <span className="chart-date">21 Oct 1980</span>
            </li>
          </ul>
        </div>
        
        {/* Main Content */}
        <div className="persona-main">
          {/* Chart Info */}
          <div className="persona-section">
            <h2>Chart: {selectedChart.subjectName}</h2>
            <p className="chart-date">
              {new Date(selectedChart.dateISO).toLocaleString()} - {selectedChart.placeLabel}
            </p>
          </div>
          
          {/* Persona Panel */}
          <div className="persona-section">
            <h2>\u263e Persona Panel</h2>
            {personaData && (
              <div className="persona-grid">
                <div className="persona-card">
                  <h3>Dominant Element</h3>
                  <p className="persona-value">{personaData.dominantElement}</p>
                </div>
                <div className="persona-card">
                  <h3>Dominant Modality</h3>
                  <p className="persona-value">{personaData.dominantModality}</p>
                </div>
                <div className="persona-card">
                  <h3>Sect</h3>
                  <p className="persona-value">{personaData.sect === 'day' ? 'Diurnal' : 'Nocturnal'}</p>
                </div>
                <div className="persona-card">
                  <h3>Almuten</h3>
                  <p className="persona-value">
                    {PLANET_GLYPH[personaData.almuten]} {personaData.almuten}
                    <br />
                    <small>Score: {personaData.almutenScore}</small>
                  </p>
                </div>
                <div className="persona-card">
                  <h3>Profection Lord</h3>
                  <p className="persona-value">
                    {PLANET_GLYPH[personaData.profectionLord]} {personaData.profectionLord}
                  </p>
                </div>
                <div className="persona-card">
                  <h3>Time Lord</h3>
                  <p className="persona-value">
                    {PLANET_GLYPH[personaData.timeLord]} {personaData.timeLord}
                    <br />
                    <small>{personaData.timeLordType} ({personaData.timeLordYears}y)</small>
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Live Sky Watcher */}
          <div className="persona-section">
            <h2>\u263d Live Sky Watcher</h2>
            <p className="live-time">
              Current Time: {currentTime.toLocaleString()}
              <br />
              <small>Updates every minute</small>
            </p>
            {transitData && transitData.length > 0 && (
              <div className="transit-summary">
                <h3>Current Transits</h3>
                <ul>
                  {transitData.slice(0, 5).map((t, i) => (
                    <li key={i}>
                      {PLANET_GLYPH[t.transitPlanet]} {t.transitPlanet} {t.aspect} 
                      {PLANET_GLYPH[t.natalPlanet]} {t.natalPlanet}
                      {t.applying && " (Applying)"}
                      {t.separating && " (Separating)"}
                      {t.exactHitDate && (
                        <span className="exact-date">
                          - Exact: {t.exactHitDate.toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Transit-to-Natal Table */}
          <div className="persona-section">
            <h2>\u264f Transit-to-Natal Table</h2>
            <div className="transit-table-container">
              {transitData && transitData.length > 0 ? (
                <table className="transit-table">
                  <thead>
                    <tr>
                      <th>Transit</th>
                      <th>Natal</th>
                      <th>Aspect</th>
                      <th>Orb</th>
                      <th>Phase</th>
                      <th>Exact Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitData.map((t, i) => {
                      const orbDeg = (t.orbArcsec / 3600).toFixed(2);
                      const sepDeg = (t.separationArcsec / 3600).toFixed(2);
                      return (
                        <tr key={i}>
                          <td>{PLANET_GLYPH[t.transitPlanet]} {t.transitPlanet}</td>
                          <td>{PLANET_GLYPH[t.natalPlanet]} {t.natalPlanet}</td>
                          <td>{t.aspect}</td>
                          <td>{sepDeg}\u00b0 / {orbDeg}\u00b0</td>
                          <td>
                            {t.applying && <span className="applying">Applying</span>}
                            {t.separating && <span className="separating">Separating</span>}
                            {t.stationery && <span>Stationary</span>}
                          </td>
                          <td>
                            {t.exactHitDate ? t.exactHitDate.toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p>No current transits within orb.</p>
              )}
            </div>
          </div>
          
          {/* CRAM Resonance Timeline */}
          <div className="persona-section">
            <h2>\u2603 CRAM Resonance Timeline</h2>
            {cramEvents && cramEvents.length > 0 ? (
              <div className="cram-timeline">
                {cramEvents.map((event, i) => (
                  <div key={i} className="cram-event">
                    <div className="cram-time">
                      {event.timestamp.toLocaleTimeString()}
                    </div>
                    <div className="cram-details">
                      <span className="cram-planets">
                        {PLANET_GLYPH[event.transitPlanet]} {event.transitPlanet} 
                        {event.aspect} 
                        {PLANET_GLYPH[event.natalPlanet]} {event.natalPlanet}
                      </span>
                      <span className="cram-resonance">
                        Lane: {event.lane} | Residue: {event.residue} | 
                        Winding: {event.windingIndex}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No CRAM resonance events detected.</p>
            )}
          </div>
          
          {/* Narration Output */}
          {narrationText && (
            <div className="persona-section narration-section">
              <h2>\u1f5e0 Today's Narration</h2>
              <div className="narration-text">{narrationText}</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="persona-footer">
        <p>Persona Inspector - Natal Chart Analysis</p>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES (would normally be in styles.css)
// ============================================================================

// Add styles to the page
function addPersonaStyles() {
  if (typeof document === "undefined") return;
  
  const styleId = "persona-styles";
  if (document.getElementById(styleId)) return;
  
  const styles = `
    .persona-page {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      font-family: var(--sans);
    }
    
    .persona-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--ink-2);
    }
    
    .persona-header h1 {
      margin: 0;
      font-size: 1.8rem;
    }
    
    .persona-actions {
      margin-left: auto;
      display: flex;
      gap: 10px;
    }
    
    .persona-layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 20px;
    }
    
    .persona-sidebar {
      background: var(--bg-1);
      padding: 15px;
      border-radius: 8px;
      height: fit-content;
    }
    
    .persona-sidebar h2 {
      margin-top: 0;
      font-size: 1.1rem;
      color: var(--ink-2);
    }
    
    .chart-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .chart-item {
      padding: 10px;
      cursor: pointer;
      border-radius: 4px;
      margin-bottom: 5px;
      transition: background 0.2s;
    }
    
    .chart-item:hover {
      background: var(--bg-2);
    }
    
    .chart-item.selected {
      background: var(--accent-bg);
      color: var(--accent);
    }
    
    .chart-item.default-chart {
      font-style: italic;
      color: var(--ink-2);
    }
    
    .chart-name {
      font-weight: 600;
      display: block;
    }
    
    .chart-date {
      font-size: 0.85rem;
      color: var(--ink-2);
    }
    
    .btn-remove {
      margin-left: auto;
      background: none;
      border: none;
      color: var(--ink-2);
      cursor: pointer;
      padding: 2px 5px;
    }
    
    .btn-remove:hover {
      color: var(--danger);
    }
    
    .persona-main {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .persona-section {
      background: var(--bg-1);
      padding: 20px;
      border-radius: 8px;
    }
    
    .persona-section h2 {
      margin-top: 0;
      font-size: 1.3rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .persona-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    
    .persona-card {
      background: var(--bg-2);
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    
    .persona-card h3 {
      font-size: 0.9rem;
      color: var(--ink-2);
      margin-top: 0;
    }
    
    .persona-value {
      font-size: 1.3rem;
      font-weight: 600;
      margin: 5px 0 0;
    }
    
    .live-time {
      color: var(--ink-2);
      font-size: 0.95rem;
    }
    
    .transit-summary {
      margin-top: 10px;
    }
    
    .transit-summary h3 {
      margin-top: 0;
      font-size: 1rem;
    }
    
    .transit-summary ul {
      list-style: none;
      padding: 0;
      margin: 5px 0 0;
    }
    
    .transit-summary li {
      padding: 5px 0;
      border-bottom: 1px solid var(--ink-1);
    }
    
    .exact-date {
      font-size: 0.85rem;
      color: var(--ink-2);
      margin-left: 10px;
    }
    
    .transit-table-container {
      overflow-x: auto;
    }
    
    .transit-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .transit-table th,
    .transit-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid var(--ink-1);
    }
    
    .transit-table th {
      background: var(--bg-2);
      font-weight: 600;
      color: var(--ink-2);
      font-size: 0.9rem;
    }
    
    .applying {
      color: var(--success);
      font-weight: 600;
    }
    
    .separating {
      color: var(--danger);
      font-weight: 600;
    }
    
    .cram-timeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .cram-event {
      background: var(--bg-2);
      padding: 10px;
      border-radius: 6px;
      border-left: 3px solid var(--accent);
    }
    
    .cram-time {
      font-size: 0.85rem;
      color: var(--ink-2);
      margin-bottom: 5px;
    }
    
    .cram-details {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .cram-planets {
      font-weight: 600;
    }
    
    .cram-resonance {
      font-size: 0.85rem;
      color: var(--ink-2);
    }
    
    .narration-section {
      background: var(--bg-2);
    }
    
    .narration-text {
      white-space: pre-wrap;
      line-height: 1.6;
      padding: 10px;
      border-left: 3px solid var(--accent);
    }
    
    .persona-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid var(--ink-2);
      text-align: center;
      color: var(--ink-2);
      font-size: 0.85rem;
    }
    
    .btn-back {
      background: var(--bg-2);
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .btn-small {
      background: var(--bg-2);
      border: 1px solid var(--ink-1);
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
  `;
  
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

// Add styles when component mounts
if (typeof window !== "undefined") {
  // Only add once
  addPersonaStyles();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { PersonaPage, PersonaProfileStore, DEFAULT_CHART };
