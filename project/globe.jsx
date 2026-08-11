// globe.jsx — orthographic dot-matrix globe.
//
// 1800 background dots drawn on <canvas> (fast); city dots are DOM buttons
// positioned each frame so we get free hit-testing + tooltips + focus rings.
// Globe drifts slowly. Selecting a city eases the yaw to centre it.

function DotmatrixGlobe({ size = 440, selectedKey, onSelect, hoverKey, onHoverKey }) {
  const canvasRef = React.useRef(null);
  const wrapRef   = React.useRef(null);
  const cityRefs  = React.useRef(new Map());
  const yawRef    = React.useRef(0);
  const targetRef = React.useRef(0);
  const rafRef    = React.useRef(0);

  // When the selection changes, snap the target yaw to that city's longitude
  // (and freeze drift briefly so the move reads cleanly).
  const driftPauseRef = React.useRef(0);
  React.useEffect(() => {
    const c = findCity(selectedKey);
    targetRef.current = -c.lng;
    driftPauseRef.current = 120;  // ~2s no drift
  }, [selectedKey]);

  React.useEffect(() => {
    const TILT = -22 * Math.PI / 180;
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    const cx = size / 2, cy = size / 2;
    const R  = size / 2 - 14;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    let mounted = true;

    const project = (lat, lng) => {
      const rotL = ((lng + yawRef.current) * Math.PI / 180);
      const phi  = lat * Math.PI / 180;
      const x  = Math.cos(phi) * Math.sin(rotL);
      const y0 = Math.sin(phi);
      const z0 = Math.cos(phi) * Math.cos(rotL);
      const y  = y0 * cosT - z0 * sinT;
      const z  = y0 * sinT + z0 * cosT;
      return { x: cx + R * x, y: cy - R * y, z };
    };

    const draw = () => {
      if (!mounted) return;

      // ─── drift + ease ───
      if (driftPauseRef.current > 0) driftPauseRef.current--;
      else                            targetRef.current += 0.05;
      // wrap target into yaw frame
      let dyaw = targetRef.current - yawRef.current;
      while (dyaw >  180) dyaw -= 360;
      while (dyaw < -180) dyaw += 360;
      yawRef.current += dyaw * 0.06;

      ctx.clearRect(0, 0, size, size);

      // outer rim glow
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

      // graticule — 3 latitude rings, projected
      ctx.strokeStyle = "rgba(248,240,222,0.07)";
      ctx.lineWidth = 0.5;
      for (const lat of [-45, 0, 45]) {
        ctx.beginPath();
        let first = true;
        for (let lng = -180; lng <= 180; lng += 4) {
          const p = project(lat, lng);
          if (p.z < 0) { first = true; continue; }
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else        { ctx.lineTo(p.x, p.y); }
        }
        ctx.stroke();
      }

      // dot matrix
      for (let lat = -84; lat <= 84; lat += 6) {
        for (let lng = -180; lng < 180; lng += 6) {
          const p = project(lat, lng);
          if (p.z < 0.02) continue;
          const a = 0.10 + 0.40 * Math.pow(p.z, 1.4);
          ctx.fillStyle = `rgba(248,240,222,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // place city DOM dots
      CITIES.forEach((c) => {
        const node = cityRefs.current.get(cityKey(c));
        if (!node) return;
        const p = project(c.lat, c.lng);
        const back = p.z < -0.02;
        if (back) {
          node.style.opacity = "0";
          node.style.pointerEvents = "none";
          return;
        }
        const op = 0.35 + 0.65 * Math.max(0, p.z);
        node.style.opacity = String(op);
        node.style.pointerEvents = p.z > 0.0 ? "auto" : "none";
        node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
      });

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    // Synchronously draw the first frame so the canvas is solid even if
    // rAF is throttled (background tabs, html-to-image capture, etc.).
    draw();
    return () => { mounted = false; cancelAnimationFrame(rafRef.current); };
  }, [size]);

  const labelCity = findCity(hoverKey || selectedKey);

  return (
    <div className="glb" ref={wrapRef} style={{ width: size, height: size }}>
      {/* WP-20: the canvas itself only paints decorative dots/graticule —
          every piece of information it conveys (which city is selected,
          its coordinates, UTC offset) is duplicated as real text in the
          readout below and as labelled <button>s per city, so the canvas
          is marked decorative rather than given a role="img" that would
          just repeat "a globe" with no way to describe a live animation. */}
      <canvas ref={canvasRef} className="glb-canvas" aria-hidden="true" role="presentation" />
      <div className="glb-cities">
        {CITIES.map((c) => {
          const k = cityKey(c);
          const sel = selectedKey === k;
          return (
            <button
              key={k}
              ref={(el) => { if (el) cityRefs.current.set(k, el); else cityRefs.current.delete(k); }}
              className={`glb-city ${sel ? "is-sel" : ""}`}
              onClick={() => onSelect(k)}
              onMouseEnter={() => onHoverKey && onHoverKey(k)}
              onMouseLeave={() => onHoverKey && onHoverKey(null)}
              aria-label={`${c.name}, ${c.region}`}
              type="button"
            >
              <span className="glb-pin" />
              {sel && <span className="glb-ring" />}
            </button>
          );
        })}
      </div>

      {/* readout */}
      <div className="glb-readout">
        <div className="glb-readout-name">{labelCity.name}</div>
        <div className="glb-readout-meta">
          {labelCity.region} · {labelCity.lat.toFixed(2)}°{labelCity.lat >= 0 ? "N" : "S"} ·
          {" "}{Math.abs(labelCity.lng).toFixed(2)}°{labelCity.lng >= 0 ? "E" : "W"} ·
          {" "}UTC{labelCity.off >= 0 ? "+" : ""}{labelCity.off}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DotmatrixGlobe });
