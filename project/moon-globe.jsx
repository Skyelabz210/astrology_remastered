// The +z hemisphere faces the viewer. Lighting stays in the observer frame;
// rotating surface dots must never rotate the terminator away from its phase.
function MoonPhaseGlobe({ size = 500, mode = 'moon', selectedKey, onSelect, hoverKey, onHoverKey, currentDate }) {
  const [globeMode, setGlobeMode] = React.useState(mode);
  const [phase, setPhase] = React.useState(null);
  const [error, setError] = React.useState('');
  const canvasRef = React.useRef(null);
  const fixedTime = currentDate ? currentDate.getTime() : null;
  React.useEffect(() => {
    function update() {
      try {
        setPhase(window.MoonPhase.moonPhaseAt(fixedTime === null ? new Date() : new Date(fixedTime)));
        setError('');
      } catch (e) { setPhase(null); setError(e.message); }
    }
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [fixedTime]);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !phase || globeMode !== 'moon') return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio; canvas.height = size * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio); ctx.clearRect(0, 0, size, size);
    const shade = window.MoonPhase.createMoonShadingFunction(phase.shadingElongationArcsec);
    const radius = size * 0.42, center = size / 2;
    // Equal-area surface samples; projected density increases at the limb.
    for (let i = 0; i < 2600; i++) {
      const z = (i + 0.5) / 2600, angle = i * Math.PI * (3 - Math.sqrt(5));
      const r = Math.sqrt(1 - z * z), x = r * Math.cos(angle), y = r * Math.sin(angle);
      const brightness = shade(x, y, z);
      ctx.fillStyle = `rgba(${Math.round(65 + 175 * brightness)}, ${Math.round(72 + 175 * brightness)}, ${Math.round(85 + 165 * brightness)}, ${0.3 + 0.6 * brightness})`;
      ctx.beginPath(); ctx.arc(center + x * radius, center - y * radius, Math.max(0.65, size / 320), 0, Math.PI * 2); ctx.fill();
    }
  }, [phase, size, globeMode]);
  return <div className="moon-phase-globe">
    <button type="button" className="hdr-pill" onClick={() => setGlobeMode(prev => prev === 'moon' ? 'earth' : 'moon')}>{globeMode === 'moon' ? 'Show Earth · choose birthplace' : 'Show Moon'}</button>
    {globeMode === 'earth' ? <DotmatrixGlobe size={size} selectedKey={selectedKey} onSelect={onSelect} hoverKey={hoverKey} onHoverKey={onHoverKey} />
      : <><canvas ref={canvasRef} style={{ width: '100%', maxWidth: size, aspectRatio: '1' }} role="img" aria-label={phase ? `${phase.phase} Moon, ${(phase.illuminationFloat * 100).toFixed(1)} percent illuminated` : 'Moon phase unavailable'} />
        {phase && <p>{phase.phase} Moon · {(phase.illuminationFloat * 100).toFixed(1)}% lit<br /><small>{phase.lunarDay.toFixed(2)} days since New Moon · geocentric view</small></p>}
        {error && <p role="status">Moon phase unavailable: {error}</p>}
        <p>Birthplace: {selectedKey || 'Choose a place'} · switch to Earth to choose a location.</p>
      </>}
  </div>;
}
Object.assign(window, { MoonPhaseGlobe });
