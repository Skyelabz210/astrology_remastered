// globe.jsx — orthographic dot-matrix globe.
//
// 1800 background dots drawn on <canvas> (fast); city dots are DOM buttons
// positioned each frame so we get free hit-testing + tooltips + focus rings.
// Globe drifts slowly. Selecting a city eases the yaw to centre it.
//
// A zodiac sign is stencilled into the sphere: a second, finer dot lattice
// is lit only where it falls inside the current glyph's alpha mask, so the
// sign is drawn out of the same dots the globe is made of rather than
// pasted over them. Every few seconds it dissolves out and a random
// different sign dissolves in. window.ZodiacGlobe (zodiac-globe.js) owns
// the glyph table, the pick-a-different-sign draw, the cycle clock, the
// fade weights, and the screen-space stencil mapping; this file owns the
// pixels.

// Rasterise each zodiac glyph into an n×n alpha mask (Uint8 per pixel).
//
// Two passes per sign, because the twelve glyphs do not share metrics in
// any font: the first draw is measured for the ink's real bounding box,
// then the glyph is redrawn scaled and translated so every sign fills the
// same fraction of the mask. Without that, ♑ (tall, descending) and ♎
// (short, wide) would read as two different type sizes as they cycle.
function buildSignMasks(glyphs, n) {
  const off = document.createElement("canvas");
  off.width = n;
  off.height = n;
  const g = off.getContext("2d", { willReadFrequently: true });
  if (!g) return null;

  // Symbol-bearing families first, then a generic fallback: these are the
  // same U+2648–2653 characters the deck and readings already print as
  // text, so any font that renders the app renders these.
  const FONT = '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
  const FILL = 0.80;  // fraction of the mask the ink spans on its long axis

  const alphaOf = () => {
    const px = g.getImageData(0, 0, n, n).data;
    const m = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) m[i] = px[i * 4 + 3];
    return m;
  };
  const inkBox = (m) => {
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (m[y * n + x] < 12) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return x1 < x0 ? null : { x0, y0, x1, y1 };
  };

  return glyphs.map(({ glyph }) => {
    const base = Math.round(n * 0.62);
    const paint = (size, tx, ty) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, n, n);
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `${size}px ${FONT}`;
      g.fillText(glyph, tx, ty);
    };

    paint(base, n / 2, n / 2);
    const box = inkBox(alphaOf());
    if (!box) return new Uint8Array(n * n);  // font has no glyph: draw nothing

    const w = box.x1 - box.x0 + 1;
    const h = box.y1 - box.y0 + 1;
    const scale = (FILL * n) / Math.max(w, h);
    // Re-draw at the corrected size, nudging the anchor by the offset the
    // first pass showed between the requested centre and the ink's centre.
    const dx = n / 2 - (box.x0 + box.x1 + 1) / 2;
    const dy = n / 2 - (box.y0 + box.y1 + 1) / 2;
    paint(Math.max(1, Math.round(base * scale)), n / 2 + dx * scale, n / 2 + dy * scale);
    return alphaOf();
  });
}

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

    // ─── zodiac stencil set-up ───
    //
    // zodiac-globe.js is a <script type="module">; if a page forgets to
    // load it the globe still draws, just without a sign in it.
    const ZG = typeof window !== "undefined" ? window.ZodiacGlobe : null;
    const masks = ZG ? buildSignMasks(ZG.SIGN_GLYPHS, ZG.MASK_SIZE) : null;
    // A reader who has asked for reduced motion gets one sign for the
    // visit instead of a fade every few seconds. The globe's own drift is
    // pre-existing and untouched; this is about not adding a new
    // repeating change on top of it.
    const holdSign = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
    let cycle = ZG ? ZG.startCycle(ZG.nextSignIndex(null, Math.random()), performance.now()) : null;

    // The stencil's own lattice: finer than the 6° terrain grid, because a
    // glyph sampled at 6° would be ~24 dots across the box and unreadable.
    // Its per-latitude sines/cosines never change, so they are hoisted out
    // of the frame loop; only the 180 longitudes rotate with the yaw, and
    // those are tabulated once per frame rather than per dot.
    const FINE_STEP = 2;
    const fineLat = [];
    const halfBox = ZG ? ZG.GLYPH_BOX_RATIO / 2 : 0;  // in radius units
    for (let lat = -86; lat <= 86; lat += FINE_STEP) {
      const phi = lat * Math.PI / 180;
      const s = Math.sin(phi), c = Math.cos(phi);
      // A whole latitude row can be dropped up front when no longitude on
      // it could ever project inside the glyph box: the row's screen-space
      // y = s·cosT − (c·cosL)·sinT sweeps the interval below as cosL runs
      // −1…1, and rows whose entire sweep misses the box (everything from
      // roughly ±40° out to the poles) are a third of the lattice that
      // would otherwise be projected every frame only to be discarded.
      const lo = s * cosT - c * Math.abs(sinT);
      const hi = s * cosT + c * Math.abs(sinT);
      if (lo > halfBox || hi < -halfBox) continue;
      fineLat.push({ s, c });
    }
    const fineLng = [];
    for (let lng = -180; lng < 180; lng += FINE_STEP) fineLng.push(lng);
    const lngSin = new Float64Array(fineLng.length);
    const lngCos = new Float64Array(fineLng.length);
    const GLYPH_BOX = ZG ? ZG.GLYPH_BOX_RATIO * R : 0;
    const MASK_N = ZG ? ZG.MASK_SIZE : 0;

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

      // ─── zodiac stencil ───
      //
      // Screen-space: the glyph box holds still at the centre of the disc
      // while the lattice turns through it, so the sign stays the same
      // size and orientation and the spin reads as dots scanning across
      // it. Only dots whose projection lands inside the box are ever
      // tested against the mask, so the per-frame drawing cost is roughly
      // the few hundred dots the glyph actually lights.
      if (masks && cycle) {
        const now = performance.now();
        cycle = ZG.advanceCycle(cycle, now, { hold: holdSign }, Math.random);
        const w = ZG.fadeWeights(cycle, now);
        const mFrom = masks[cycle.from];
        const mTo   = masks[cycle.to];

        for (let j = 0; j < fineLng.length; j++) {
          const rotL = (fineLng[j] + yawRef.current) * Math.PI / 180;
          lngSin[j] = Math.sin(rotL);
          lngCos[j] = Math.cos(rotL);
        }

        for (let i = 0; i < fineLat.length; i++) {
          const { s: sinPhi, c: cosPhi } = fineLat[i];
          for (let j = 0; j < fineLng.length; j++) {
            const z0 = cosPhi * lngCos[j];
            const z  = sinPhi * sinT + z0 * cosT;
            if (z < 0.05) continue;                     // far side / grazing the limb
            const y = sinPhi * cosT - z0 * sinT;
            const py = cy - R * y;
            const px = cx + R * (cosPhi * lngSin[j]);
            const uv = ZG.stencilUV(px, py, cx, cy, GLYPH_BOX);
            if (!uv) continue;
            const k = ZG.maskIndex(uv.u, uv.v, MASK_N);
            const ink = mFrom[k] * w.from + mTo[k] * w.to;
            if (ink < 10) continue;
            const a = (0.14 + 0.62 * z) * (ink / 255);
            ctx.fillStyle = `rgba(246,216,168,${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.15, 0, Math.PI * 2);
            ctx.fill();
          }
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
          just repeat "a globe" with no way to describe a live animation.
          The zodiac sign stencilled into the sphere is decorative on the
          same terms: it is ambience, not an input or a reading — it says
          nothing about the chart being cast — so it stays inside the
          aria-hidden canvas rather than being announced, which at a sign
          every few seconds would talk over the form. */}
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
