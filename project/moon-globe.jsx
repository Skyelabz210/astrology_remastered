// moon-globe.jsx - Moon Phase Globe Component
//
// Enhanced globe that can display either Earth or Moon
// Moon mode shows the current lunar phase with proper shading
// Earth mode shows the standard city-picking globe
//
// This component extends the functionality of globe.jsx to support:
// - Moon/Earth toggle
// - Real-time Moon phase shading based on Sun-Moon elongation
// - Birthplace pin moved to small Earth readout beside Moon globe
// - Phase name and percent lit display

const { useState, useEffect, useRef, useMemo } = React;

// Import the moon phase calculation from our module
// In the browser, this will be available via window.MoonPhase
const MoonPhase = typeof window !== "undefined" ? window.MoonPhase : null;

// DotmatrixGlobe from globe.jsx (will be available globally)
const DotmatrixGlobe = window.DotmatrixGlobe;

// Moon Phase Globe Component
function MoonPhaseGlobe({
  size = 500,
  mode = "earth", // "earth" or "moon"
  selectedKey,
  onSelect,
  hoverKey,
  onHoverKey,
  birthPlace, // { lat, lng, name } for birthplace
  currentDate = new Date(), // Current date for Moon phase calculation
}) {
  const [moonPhaseData, setMoonPhaseData] = useState(null);
  const [globeMode, setGlobeMode] = useState(mode);
  
  // Calculate Moon phase data
  useEffect(() => {
    const calculateMoonPhase = () => {
      if (typeof window === "undefined" || !window.dateToJD || !window.planetLongitude) {
        // Fallback: use approximate values
        setMoonPhaseData({
          elongationDeg: 45,
          illumination: 0.5,
          phase: "First Quarter",
          waxing: true,
          lunarDay: 7.4,
        });
        return;
      }
      
      try {
        const jd = window.dateToJD(currentDate);
        const sunLon = window.planetLongitude("Sun", jd);
        const moonLon = window.planetLongitude("Moon", jd);
        
        // Calculate elongation in degrees
        let elongation = (moonLon - sunLon + 360) % 360;
        if (elongation > 180) elongation = 360 - elongation;
        
        // Calculate illumination (0-1)
        const illumination = (1 - Math.cos(elongation * Math.PI / 180)) / 2;
        
        // Determine phase
        let phase;
        if (elongation < 15) phase = "New";
        else if (elongation < 45) phase = "Waxing Crescent";
        else if (elongation < 90) phase = "First Quarter";
        else if (elongation < 135) phase = "Waxing Gibbous";
        else if (elongation < 165) phase = "Full";
        else if (elongation < 210) phase = "Waning Gibbous";
        else if (elongation < 255) phase = "Last Quarter";
        else phase = "Waning Crescent";
        
        // Lunar day (approximate)
        const lunarDay = (elongation / 360) * 29.53;
        
        setMoonPhaseData({
          elongationDeg: elongation,
          elongationRad: elongation * Math.PI / 180,
          illumination,
          phase,
          waxing: elongation < 180,
          lunarDay,
        });
      } catch (e) {
        console.error("Error calculating Moon phase:", e);
        // Fallback
        setMoonPhaseData({
          elongationDeg: 45,
          illumination: 0.5,
          phase: "First Quarter",
          waxing: true,
          lunarDay: 7.4,
        });
      }
    };
    
    calculateMoonPhase();
    
    // Update every minute
    const interval = setInterval(calculateMoonPhase, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);
  
  // Toggle mode
  const toggleMode = () => {
    setGlobeMode(prev => prev === "earth" ? "moon" : "earth");
  };
  
  // Moon shading function
  const createMoonShading = () => {
    if (!moonPhaseData) return null;
    
    // Sun direction vector (from Moon's perspective)
    // Elongation is the angle from Sun to Moon as seen from Earth
    // For the Moon's surface, the Sun is in the opposite direction
    const sunDirAngle = moonPhaseData.elongationRad + Math.PI;
    const sunDir = {
      x: Math.cos(sunDirAngle),
      y: Math.sin(sunDirAngle),
    };
    
    // For a sphere, we can use a simple dot product with smooth transition
    return (x, y, z) => {
      // Normalize the point
      const len = Math.sqrt(x * x + y * y + z * z);
      if (len === 0) return 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      
      // Dot product with Sun direction (ignoring z for orthographic projection)
      const dot = nx * sunDir.x + ny * sunDir.y;
      
      // Smooth transition near terminator
      const epsilon = 0.02;
      
      if (dot >= epsilon) {
        return 1; // Fully illuminated
      } else if (dot <= -epsilon) {
        return 0; // Fully dark
      } else {
        // Smooth transition
        return 0.5 + 0.5 * (dot / epsilon);
      }
    };
  };
  
  // Render Moon globe with shading
  const renderMoonGlobe = () => {
    if (!moonPhaseData) return null;
    
    const canvasRef = useRef(null);
    const sizeRef = useRef(size);
    const yawRef = useRef(0);
    const rafRef = useRef(0);
    
    // Animation
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      
      const cx = size / 2;
      const cy = size / 2;
      const R = size / 2 - 14;
      const TILT = -22 * Math.PI / 180;
      const cosT = Math.cos(TILT);
      const sinT = Math.sin(TILT);
      
      const shadingFn = createMoonShading();
      
      let mounted = true;
      let lastTime = 0;
      
      const project = (lat, lng) => {
        const rotL = ((lng + yawRef.current) * Math.PI / 180);
        const phi = lat * Math.PI / 180;
        const x = Math.cos(phi) * Math.sin(rotL);
        const y0 = Math.sin(phi);
        const z0 = Math.cos(phi) * Math.cos(rotL);
        const y = y0 * cosT - z0 * sinT;
        const z = y0 * sinT + z0 * cosT;
        return { x: cx + R * x, y: cy - R * y, z };
      };
      
      const draw = (time) => {
        if (!mounted) return;
        
        // Slow drift
        yawRef.current += 0.05;
        
        ctx.clearRect(0, 0, size, size);
        
        // Outer rim glow
        const rim = ctx.createRadialGradient(cx, cy, R - 8, cx, cy, R + 10);
        rim.addColorStop(0, "rgba(248,240,222,0)");
        rim.addColorStop(1, "rgba(248,240,222,0.10)");
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "rgba(248,240,222,0.18)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.stroke();
        
        // Graticule
        ctx.strokeStyle = "rgba(248,240,222,0.07)";
        ctx.lineWidth = 0.5;
        for (const lat of [-45, 0, 45]) {
          ctx.beginPath();
          let first = true;
          for (let lng = -180; lng <= 180; lng += 4) {
            const p = project(lat, lng);
            if (p.z < 0) { first = true; continue; }
            if (first) { ctx.moveTo(p.x, p.y); first = false; }
            else { ctx.lineTo(p.x, p.y); }
          }
          ctx.stroke();
        }
        
        // Dot matrix with Moon shading
        for (let lat = -84; lat <= 84; lat += 6) {
          for (let lng = -180; lng <= 180; lng += 6) {
            const p = project(lat, lng);
            if (p.z < -0.02) continue;
            
            // Calculate shading
            const shade = shadingFn(p.x - cx, p.y - cy, p.z);
            
            // Moon color (gray scale based on illumination)
            const moonGray = Math.round(180 + 75 * shade);
            
            // Draw dot
            ctx.fillStyle = `rgb(${moonGray}, ${moonGray}, ${moonGray})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Add lunar features (maria)
        // Simplified: darker areas for lunar seas
        ctx.fillStyle = "rgba(120, 120, 120, 0.3)";
        for (const mare of MOON_MARIA) {
          const p = project(mare.lat, mare.lng);
          if (p.z >= 0) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, mare.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        rafRef.current = requestAnimationFrame(draw);
      };
      
      rafRef.current = requestAnimationFrame(draw);
      draw();
      
      return () => {
        mounted = false;
        cancelAnimationFrame(rafRef.current);
      };
    }, [size, moonPhaseData]);
    
    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          aria-hidden="true"
          role="presentation"
        />
        
        {/* Moon phase info overlay */}
        <div style={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#fff",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          fontSize: "0.9rem",
        }}>
          <div>{moonPhaseData.phase}</div>
          <div>{Math.round(moonPhaseData.illumination * 100)}% illuminated</div>
        </div>
      </div>
    );
  };
  
  // Moon maria (seas) - approximate positions
  const MOON_MARIA = [
    { name: "Mare Imbrium", lat: 35, lng: -15, size: 40 },
    { name: "Mare Serenitatis", lat: 30, lng: 20, size: 35 },
    { name: "Mare Tranquillitatis", lat: 10, lng: 30, size: 30 },
    { name: "Mare Crisium", lat: 15, lng: 60, size: 25 },
    { name: "Mare Nubium", lat: -10, lng: -20, size: 25 },
    { name: "Mare Humorum", lat: -25, lng: -45, size: 20 },
    { name: "Oceanus Procellarum", lat: 10, lng: -60, size: 50 },
  ];
  
  // Render Earth globe (standard)
  const renderEarthGlobe = () => {
    return (
      <DotmatrixGlobe
        size={size}
        selectedKey={selectedKey}
        onSelect={onSelect}
        hoverKey={hoverKey}
        onHoverKey={onHoverKey}
      />
    );
  };
  
  // Render birthplace Earth readout (small)
  const renderBirthplaceReadout = () => {
    if (!birthPlace) return null;
    
    return (
      <div style={{
        width: 120,
        height: 120,
        marginLeft: 20,
      }}>
        <DotmatrixGlobe
          size={120}
          selectedKey={selectedKey}
          onSelect={onSelect}
          hoverKey={hoverKey}
          onHoverKey={onHoverKey}
        />
        <div style={{
          textAlign: "center",
          fontSize: "0.8rem",
          marginTop: 5,
          color: "var(--ink-2)",
        }}>
          {birthPlace.name}
        </div>
      </div>
    );
  };
  
  return (
    <div className="moon-globe-container">
      {/* Mode toggle */}
      <div className="moon-globe-controls">
        <button
          className={`mode-btn ${globeMode === "earth" ? "active" : ""}`}
          onClick={toggleMode}
          aria-label="Switch to Earth view"
        >
          Earth
        </button>
        <button
          className={`mode-btn ${globeMode === "moon" ? "active" : ""}`}
          onClick={toggleMode}
          aria-label="Switch to Moon view"
        >
          Moon
        </button>
      </div>
      
      {/* Main globe */}
      <div className="moon-globe-main">
        {globeMode === "moon" ? renderMoonGlobe() : renderEarthGlobe()}
      </div>
      
      {/* Birthplace readout (only in Moon mode) */}
      {globeMode === "moon" && birthPlace && renderBirthplaceReadout()}
      
      {/* Moon phase info (only in Moon mode) */}
      {globeMode === "moon" && moonPhaseData && (
        <div className="moon-globe-info">
          <div className="moon-phase-name">{moonPhaseData.phase}</div>
          <div className="moon-illumination">
            {Math.round(moonPhaseData.illumination * 100)}% illuminated
          </div>
          <div className="moon-lunar-day">
            Lunar Day: {moonPhaseData.lunarDay.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

// Add styles
function addMoonGlobeStyles() {
  if (typeof document === "undefined") return;
  
  const styleId = "moon-globe-styles";
  if (document.getElementById(styleId)) return;
  
  const styles = `
    .moon-globe-container {
      position: relative;
    }
    
    .moon-globe-controls {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      display: flex;
      gap: 5px;
    }
    
    .mode-btn {
      background: var(--bg-1);
      border: 1px solid var(--ink-1);
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      color: var(--ink);
    }
    
    .mode-btn:hover {
      background: var(--bg-2);
    }
    
    .mode-btn.active {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent);
    }
    
    .moon-globe-main {
      position: relative;
    }
    
    .moon-globe-info {
      margin-top: 10px;
      text-align: center;
      font-size: 0.9rem;
      color: var(--ink-2);
    }
    
    .moon-phase-name {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--ink);
    }
    
    .moon-illumination {
      color: var(--ink-2);
    }
    
    .moon-lunar-day {
      font-size: 0.85rem;
    }
  `;
  
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}

// Add styles when component is used
if (typeof window !== "undefined") {
  addMoonGlobeStyles();
}

// Export
if (typeof window !== "undefined") {
  window.MoonPhaseGlobe = MoonPhaseGlobe;
}

export { MoonPhaseGlobe };
