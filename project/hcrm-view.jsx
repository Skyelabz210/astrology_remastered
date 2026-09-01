// hcrm-view.jsx — Human-Celestial Register Console UI.
//
// Visual aids for divining the map:
//   1. Register ledger      — the exact integer-arcsec table per body
//   2. Residue heatmap       — body × prime matrix, shadow/boundary flagged
//   3. Shadow-lane wheel      — bodies placed on the 1,296,000″ ring, mod-11 ticks
//   4. Aspect-edge graph      — residue-preserving couplings, shadow edges bold
//   5. Chart operator signature — searchable residue distribution + gear track

const { useState: $hvState, useMemo: $hvMemo, useEffect: $hvEffect } = React;

function HCRMConsole({ chart, birthLabel, onBack }) {
  const hcrm = $hvMemo(() => computeHCRM(chart), [chart]);
  const [tab, setTab] = $hvState("ledger");
  const [selRow, setSelRow] = $hvState(null);

  return (
    <div className="hc">
      <header className="hc-hdr">
        <div className="hc-hdr-l">
          {onBack && <button className="hc-back" onClick={onBack} aria-label="Back">←</button>}
          <div>
            <div className="hc-title">HCRM · Human-Celestial Register Map</div>
            <div className="hc-sub">{birthLabel} · integer arcseconds · basis 2·3·5·7·11·13·17·19</div>
            <SyntheticBadge cert={hcrm.synthetic} />
          </div>
        </div>
        <div className="hc-hdr-r">
          <ToolsMenu />
          <div className="hc-stat-row">
            <Stat label="SH-body r11=0" value={hcrm.counts.shBody} accent="shadow" tip="bodies whose shadow lane closes (r11 = 0)" />
            <Stat label="SH-edge r11" value={hcrm.counts.shEdge} accent="shadow" tip="aspect edges that preserve the shadow lane (shared r11)" />
            <Stat label="B13-pre =12" value={hcrm.counts.b13pre} accent="boundary" tip="bodies at the pre / re-entry boundary edge (r13 = 12)" />
            <Stat label="B13-zero =0" value={hcrm.counts.b13zero} accent="boundary2" tip="bodies at boundary closure (r13 = 0)" />
            <Stat label="B13-edge" value={hcrm.counts.b13edge} accent="boundary" tip="aspect edges preserving r13" />
            <Stat label="G-zero" value={hcrm.counts.gZero} accent="gear" tip="exact gear closure (r17=0 ∧ r19=0)" />
            <Stat label="G-pre" value={hcrm.counts.gPre} accent="gear" tip="gear pre / re-entry (r17=16 ∧ r19=18)" />
            <Stat label="G-edge" value={hcrm.counts.gEdge} accent="gear" tip="aspect edges preserving both gear primes 17·19" />
            <Stat label="edges" value={hcrm.counts.edges} tip="total aspect edges in basis" />
          </div>
        </div>
      </header>

      <ClassLegend />

      <nav className="hc-tabs">
        {[
          ["ledger", "Register ledger"],
          ["heatmap", "Residue matrix"],
          ["wheel", "Shadow-lane ring"],
          ["edges", "Aspect-edge graph"],
          ["carry", "Carry propagation"],
          ["odometer", "Odometer"],
          ["kelim", "K-Elimination"],
          ["cram", "CRAM state"],
          ["signature", "Operator signature"],
        ].map(([k, label]) => (
          <button key={k} className={`hc-tab ${tab === k ? "is-on" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      <main className="hc-main">
        {tab === "ledger"   && <Ledger hcrm={hcrm} selRow={selRow} setSelRow={setSelRow} />}
        {tab === "heatmap"  && <Heatmap hcrm={hcrm} />}
        {tab === "wheel"    && <ShadowWheel hcrm={hcrm} />}
        {tab === "edges"    && <EdgeGraph hcrm={hcrm} />}
        {tab === "carry"    && <CarryPropagation hcrm={hcrm} />}
        {tab === "odometer" && <Odometer hcrm={hcrm} />}
        {tab === "kelim"    && <KElimination hcrm={hcrm} />}
        {tab === "cram"     && <CramState hcrm={hcrm} />}
        {tab === "signature"&& <Signature hcrm={hcrm} />}
      </main>
    </div>
  );
}

// Provenance badge (WP-15): every register value on this page is quantized
// from a floating-point synthetic-ephemeris degree (toArcsec, hcrm.jsx). That
// rounding is wrapped as a SYNTHETIC_DEMO ledger entry and run through
// window.HCRM_CORE.admitForCore — the core's sole admission gate — which
// refuses SYNTHETIC_DEMO unconditionally (src/ledger/import-ledger.js). This
// badge surfaces that refusal so the ledger below is never mistaken for
// exact, core-admissible register data.
function SyntheticBadge({ cert }) {
  if (!cert) return null;
  return (
    <div
      className={`hc-synthetic-badge ${cert.rejected ? "is-rejected" : "is-admitted"}`}
      title={cert.rejected
        ? "This console is drawn from demonstration positions; the exact core refuses to certify them."
        : cert.message}
    >
      {cert.rejected
        ? "⚠ demonstration positions — not certified by the exact core"
        : "⚠ demonstration positions were accepted — this should never happen"}
    </div>
  );
}

function Stat({ label, value, accent, tip }) {
  return (
    <div className={`hc-stat ${accent ? "hc-stat-" + accent : ""}`} title={tip || ""}>
      <div className="hc-stat-val">{value}</div>
      <div className="hc-stat-lbl">{label}</div>
    </div>
  );
}

// Tools dropdown — access to sibling instruments (calculator, reading app).
function ToolsMenu() {
  const [open, setOpen] = $hvState(false);
  $hvEffect(() => {
    const close = () => setOpen(false);
    if (open) { document.addEventListener("click", close); return () => document.removeEventListener("click", close); }
  }, [open]);
  const tools = [
    { href: "CRAM Calculator.html", label: "CRAM Depth Calculator", sub: "5-level raise / lower · K-Elimination" },
    { href: "API Reference.html", label: "API Reference", sub: "the live endpoints" },
    { href: "Core Test Harness.html", label: "Core Test Harness", sub: "the core's own gate · full ecliptic sweep" },
    { href: "Resonance Spread.html", label: "Resonance Spread", sub: "the reading deck · cards · voice" },
  ];
  return (
    <div className="hc-tools" onClick={e => e.stopPropagation()}>
      <button className="hc-tools-btn" onClick={() => setOpen(o => !o)}>
        ⚙ tools <span className={`hc-tools-chev ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="hc-tools-menu">
          {tools.map(t => (
            <a key={t.href} className="hc-tools-item" href={t.href}>
              <span className="hc-tools-item-label">{t.label}</span>
              <span className="hc-tools-item-sub">{t.sub}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// Difference legend — the visual class system, always visible so layers
// never collapse into "the same thing".
const VISUAL_CLASSES = [
  { cls: "R",        label: "ordinary residue",        sw: "r" },
  { cls: "SH-body",  label: "shadow body (r11=0)",     sw: "sh" },
  { cls: "SH-edge",  label: "shadow edge (shared r11)",sw: "sh-e" },
  { cls: "B13-pre",  label: "boundary pre / re-entry (r13=12)", sw: "b13p" },
  { cls: "B13-zero", label: "boundary closure (r13=0)",sw: "b13z" },
  { cls: "B13-edge", label: "boundary edge (shared r13)", sw: "b13e" },
  { cls: "G-body",   label: "gear-lock body (17·19)",  sw: "g" },
  { cls: "G-edge",   label: "gear edge (shared 17·19)",sw: "g-e" },
  { cls: "I",        label: "interpretation only",     sw: "i" },
];

function ClassLegend() {
  const [open, setOpen] = $hvState(false);
  return (
    <div className={`hc-legend ${open ? "is-open" : ""}`}>
      <button className="hc-legend-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "− " : "+ "}what the colours mean
      </button>
      {open && (
        <div className="hc-legend-grid">
          {VISUAL_CLASSES.map(c => (
            <div key={c.cls} className="hc-legend-item">
              <span className={`hc-cl-sw hc-cl-${c.sw}`} />
              <span className="hc-cl-code">{c.cls}</span>
              <span className="hc-cl-label">{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 1. Register ledger ──────────────────────────────────────────────
function Ledger({ hcrm, selRow, setSelRow }) {
  return (
    <div className="hc-ledger">
      <table className="hc-table">
        <thead>
          <tr>
            <th>body</th><th className="num">λ ″</th><th>sign</th>
            <th className="num">°in</th><th>H</th><th>motion</th><th>dignity</th>
            <th className="num">r2</th><th className="num">r3</th><th className="num">r5</th>
            <th className="num">r7</th><th className="num hc-sh">r11</th><th className="num hc-bd">r13</th>
            <th className="num">r17</th><th className="num">r19</th>
            <th>operator class</th>
          </tr>
        </thead>
        <tbody>
          {/*
            Row selection is announced with aria-current, NOT aria-expanded.
            aria-expanded is only valid on treegrid rows; on a plain table row
            axe-core flags it "serious" (aria-conditional-attr) — it did, on
            all 14 rows, in the browser pass recorded in docs/a11y-report.md.
            These rows disclose no nested content: clicking one selects it and
            drives the detail panel, which is exactly what aria-current means,
            and aria-current is permitted on any role.
          */}
          {hcrm.rows.map((r, i) => (
            <tr key={r.bodyId}
                className={`${selRow === i ? "is-sel" : ""} ${r.shadowHit ? "has-shadow" : ""}`}
                onClick={() => setSelRow(selRow === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                    e.preventDefault();
                    setSelRow(selRow === i ? null : i);
                  }
                }}
                tabIndex={0}
                aria-current={selRow === i ? "true" : undefined}>
              <td className="hc-body"><span className="hc-gl">{r.glyph}</span> {r.bodyId}</td>
              <td className="num">{r.arcsec.toLocaleString()}</td>
              <td>{r.signName}</td>
              <td className="num">{r.signDeg.toFixed(2)}</td>
              <td>{r.house}</td>
              <td className={r.retrograde ? "hc-retro" : ""}>{r.retrograde ? "℞" : "→"}</td>
              <td className={r.dignityScore > 0 ? "pos" : r.dignityScore < 0 ? "neg" : ""}>{r.dignity}</td>
              <td className="num">{r.res.r2}</td>
              <td className="num">{r.res.r3}</td>
              <td className="num">{r.res.r5}</td>
              <td className="num">{r.res.r7}</td>
              <td className={`num hc-sh ${r.shadowHit ? "is-hit" : ""}`} title={r.shadowHit ? "SH-body · r11 = 0" : ""}>{r.res.r11}</td>
              <td className={`num hc-bd ${r.b13State === "pre" ? "is-pre" : r.b13State === "zero" ? "is-zero" : ""}`}
                  title={r.b13State === "pre" ? "B13-pre · r13 = 12 · pre / re-entry" : r.b13State === "zero" ? "B13-zero · r13 = 0 · closure" : ""}>{r.res.r13}</td>
              <td className="num">{r.res.r17}</td>
              <td className="num">{r.res.r19}</td>
              <td className="hc-opclass">
                {r.bodyEvents.length === 0
                  ? <span className="hc-badge hc-badge-R" title="ordinary residue register · no closure events">R</span>
                  : r.bodyEvents.map((e, k) => (
                      <span key={k} className={`hc-badge hc-badge-${e.eventClass}`} title={`${e.eventClass} · ${e.trigger}`}>{e.eventClass}</span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selRow !== null && hcrm.rows[selRow] && <RowDetail row={hcrm.rows[selRow]} />}
    </div>
  );
}

function RowDetail({ row }) {
  return (
    <div className="hc-detail">
      <div className="hc-detail-head">
        <span className="hc-gl big">{row.glyph}</span>
        <div>
          <div className="hc-detail-title">{row.bodyId} · {row.signName} {row.signDeg.toFixed(2)}° · House {row.house}</div>
          <div className="hc-detail-addr">register address λ = {row.arcsec.toLocaleString()}″ &nbsp;|&nbsp; {row.operatorClass}</div>
        </div>
      </div>
      <div className="hc-domain-grid">
        <Domain label="bodily / organ" value={row.organ} />
        <Domain label="sign body-zone" value={row.signBody} />
        <Domain label="psychic" value={row.psychic} />
        <Domain label="social" value={row.social} />
        <Domain label="operator domain" value={row.operatorDomain} />
        <Domain label="motion" value={row.motion} />
      </div>
      <div className="hc-residue-strip">
        {HCRM_BASIS.map(p => (
          <div key={p} className={`hc-res-cell ${p===11&&row.res.r11===0?"sh-hit":""} ${p===13&&row.boundaryHit?"bd-hit":""}`}>
            <div className="hc-res-p">r{p}</div>
            <div className="hc-res-v">{row.res["r"+p]}</div>
            <div className="hc-res-role">{PRIME_ROLE[p]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Domain({ label, value }) {
  return (
    <div className="hc-domain">
      <div className="hc-domain-l">{label}</div>
      <div className="hc-domain-v">{value}</div>
    </div>
  );
}

// ── 2. Residue heatmap ──────────────────────────────────────────────
function Heatmap({ hcrm }) {
  return (
    <div className="hc-heatmap">
      <div className="hc-heat-legend">
        residue value shown as cell intensity; <span className="hc-sh-chip">r11 = 0</span> shadow closure ·
        <span className="hc-bd-chip">r13 boundary</span> highlighted
      </div>
      <table className="hc-heat-table">
        <thead>
          <tr>
            <th>body</th>
            {HCRM_BASIS.map(p => <th key={p} className="num">{`r${p}`}<div className="hc-heat-role">{PRIME_ROLE[p]}</div></th>)}
          </tr>
        </thead>
        <tbody>
          {hcrm.rows.map(r => (
            <tr key={r.bodyId}>
              <td className="hc-body"><span className="hc-gl">{r.glyph}</span> {r.bodyId}</td>
              {HCRM_BASIS.map(p => {
                const v = r.res["r" + p];
                const frac = v / (p - 1);
                const isShadow = p === 11 && v === 0;
                const isBound = p === 13 && (v === 0 || v === 12);
                return (
                  <td key={p} className={`hc-heat-cell ${isShadow ? "sh-hit" : ""} ${isBound ? "bd-hit" : ""}`}
                      style={{ "--frac": frac.toFixed(3) }}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 3. Shadow-lane ring ─────────────────────────────────────────────
function ShadowWheel({ hcrm }) {
  const SIZE = 560, C = SIZE / 2, R = 230;
  const xy = (deg, r) => {
    const a = ((90 - deg) * Math.PI) / 180;
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };
  return (
    <div className="hc-wheel-wrap">
      {/* WP-20: this is the register map's natal-chart wheel — bodies
          placed by zodiacal degree around the 1,296,000″ ring, with
          shadow-lane (mod 11) preserving edges bolded. The same rows are
          available as plain text in the "Register ledger" tab's table, but
          this view is data-carrying (not decorative), hence role="img" +
          a real label rather than aria-hidden. */}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="hc-wheel"
           role="img"
           aria-label={`Shadow-lane ring: natal chart wheel placing ${hcrm.rows.length} bodies by zodiacal degree, with ${hcrm.edges.filter(e => e.shadowPreserved).length} shadow-preserving aspect edges (shared mod-11 residue) shown bold. See the Register ledger tab for the same placements as a table.`}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="oklch(0.93 0.008 80 / 0.18)" />
        <circle cx={C} cy={C} r={R-40} fill="none" stroke="oklch(0.93 0.008 80 / 0.08)" />
        {/* 12 sign divisions */}
        {ZODIAC.map((s, i) => {
          const p1 = xy(i * 30, R);
          const mid = xy(i * 30 + 15, R + 16);
          return (
            <g key={s.name}>
              <line x1={C} y1={C} x2={p1.x} y2={p1.y} stroke="oklch(0.93 0.008 80 / 0.06)" />
              <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
                    fill="oklch(0.7 0.01 80)" fontSize="15" fontFamily="serif">{s.glyph}</text>
            </g>
          );
        })}
        {/* 11 shadow-lane tick marks (mod 11 over the full ring) */}
        {Array.from({ length: 11 }).map((_, i) => {
          const deg = (i / 11) * 360;
          const o = xy(deg, R + 2), inr = xy(deg, R + 12);
          return <line key={i} x1={o.x} y1={o.y} x2={inr.x} y2={inr.y} stroke="oklch(0.85 0.05 300 / 0.6)" strokeWidth="1.5" />;
        })}
        {/* edges (shadow-preserving bold) */}
        {hcrm.edges.map((e, i) => {
          const A = hcrm.rows.find(r => r.bodyId === e.a);
          const B = hcrm.rows.find(r => r.bodyId === e.b);
          if (!A || !B) return null;
          const pa = xy(A.deg, R - 40), pb = xy(B.deg, R - 40);
          return (
            <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke={e.shadowPreserved ? "oklch(0.85 0.08 300)" : "oklch(0.6 0.01 80 / 0.3)"}
                  strokeWidth={e.shadowPreserved ? 1.6 : 0.6}
                  strokeDasharray={e.shadowPreserved ? "none" : "2 3"} />
          );
        })}
        {/* bodies */}
        {hcrm.rows.map(r => {
          const p = xy(r.deg, R - 40);
          return (
            <g key={r.bodyId}>
              <circle cx={p.x} cy={p.y} r={r.shadowHit ? 11 : 8}
                      fill="oklch(0.10 0.006 60)"
                      stroke={r.shadowHit ? "oklch(0.85 0.08 300)" : "oklch(0.7 0.01 80)"}
                      strokeWidth={r.shadowHit ? 2 : 1} />
              <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fill="oklch(0.95 0.01 80)" fontSize="11" fontFamily="serif">{r.glyph}</text>
            </g>
          );
        })}
      </svg>
      <div className="hc-wheel-key">
        <div><span className="hc-key-line shadow" /> shadow-preserving edge (r11 shared)</div>
        <div><span className="hc-key-dot shadow" /> body at shadow closure (r11 = 0)</div>
        <div><span className="hc-key-line plain" /> ordinary aspect edge</div>
      </div>
    </div>
  );
}

// ── 4. Aspect-edge graph ────────────────────────────────────────────
function EdgeGraph({ hcrm }) {
  return (
    <div className="hc-edges">
      <div className="hc-edges-note">
        Each edge shows which prime lanes are <b>preserved</b> (the two registers share an address in that prime).
        Shadow-lane (11) preservation is the witness signal; full gear preservation (17·19) marks deep coupling.
      </div>
      <table className="hc-table">
        <thead>
          <tr>
            <th>edge</th><th>aspect</th><th className="num">orb</th>
            <th className="num">shared</th>
            {HCRM_BASIS.map(p => <th key={p} className="num">{p}</th>)}
            <th>witness</th>
          </tr>
        </thead>
        <tbody>
          {hcrm.edges.map((e, i) => (
            <tr key={i} className={e.shadowPreserved ? "has-shadow" : ""}>
              <td className="hc-body"><span className="hc-gl">{e.aGlyph}</span> {e.a} — <span className="hc-gl">{e.bGlyph}</span> {e.b}</td>
              <td>{e.aspect}</td>
              <td className="num">{e.orb.toFixed(1)}°</td>
              <td className="num hc-shared">{e.count}/8</td>
              {HCRM_BASIS.map(p => (
                <td key={p} className={`num hc-lane ${e.lanes[p] ? "on" : ""} ${p===11&&e.lanes[p]?"sh":""}`}>
                  {e.lanes[p] ? "●" : "·"}
                </td>
              ))}
              <td>
                {e.edgeEvents.length === 0
                  ? <span className="hc-badge hc-badge-R" title="no preserved witness lanes">—</span>
                  : e.edgeEvents.map((ev, k) => (
                      <span key={k} className={`hc-badge hc-badge-${ev.eventClass}`} title={`${ev.eventClass} · ${ev.trigger}`}>{ev.eventClass}</span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Carry propagation (heterogeneous, lane-wise, continuous) ─────────
function CarryPropagation({ hcrm }) {
  const moving = hcrm.rows.filter(r => Math.abs(r.speedArcsecDay) > 0.0001);
  return (
    <div className="hc-carry">
      <div className="hc-edges-note">
        Each lane wraps <b>mod p</b> every <b>p arcseconds</b> of motion, so the eight lanes
        carry at <b>independent rates</b> driven by the body's continuous speed — not a shared
        discrete tick. The phase ring shows each lane's position toward its next carry; the rate
        column is carries per day. Lane 2 spins fastest, lane 19 slowest; nothing is synchronised.
      </div>
      <div className="hc-carry-grid">
        {moving.map(r => (
          <div key={r.bodyId} className="hc-carry-body">
            <div className="hc-carry-head">
              <span className="hc-gl">{r.glyph}</span> {r.bodyId}
              <span className="hc-carry-speed">{(r.speedArcsecDay/3600).toFixed(3)}°/day{r.retrograde ? " ℞" : ""}</span>
            </div>
            <div className="hc-carry-lanes">
              {HCRM_BASIS.map(p => {
                const c = r.carry[p];
                const isShadow = p === 11, isBound = p === 13, isGear = p === 17 || p === 19;
                return (
                  <div key={p} className={`hc-carry-lane ${isShadow?"sh":""} ${isBound?"bd":""} ${isGear?"gr":""}`}>
                    <PhaseRing phase={c.phase} p={p} hit={isShadow && c.residue===0} />
                    <div className="hc-carry-p">r{p}</div>
                    <div className="hc-carry-rate">{c.carriesPerDay >= 1 ? c.carriesPerDay.toFixed(1) : c.carriesPerDay.toFixed(2)}<span>/d</span></div>
                    <div className="hc-carry-next" title="days to next lane carry">
                      {c.daysToCarry === Infinity ? "—" : c.daysToCarry < 1 ? `${(c.daysToCarry*24).toFixed(1)}h` : `${c.daysToCarry.toFixed(1)}d`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseRing({ phase, p, hit }) {
  const R = 16, C = 21, circ = 2 * Math.PI * R;
  const dash = circ * phase;
  return (
    <svg viewBox="0 0 42 42" className="hc-phase" role="img" aria-label={`mod ${p} carry phase: ${Math.round(phase * p)} of ${p}${hit ? ", at shadow closure" : ""}`}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="oklch(0.30 0.01 60)" strokeWidth="3" />
      <circle cx={C} cy={C} r={R} fill="none"
              stroke={hit ? "oklch(0.88 0.12 300)" : "oklch(0.82 0.03 80)"} strokeWidth="3"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              transform={`rotate(-90 ${C} ${C})`} />
      <text x={C} y={C+3} textAnchor="middle" fontSize="11" fontFamily="ui-monospace,monospace"
            fill={hit ? "oklch(0.92 0.10 300)" : "oklch(0.85 0.01 80)"}>{Math.round(phase*p)}</text>
    </svg>
  );
}

// ── CRAM odometer — residue-native counting with certified winding ──
function Odometer({ hcrm }) {
  const M = hcrm.mSafe8;
  // seed options: zero, or any body's exact arcsec
  const seeds = [
    { label: "zero tray", value: 0 },
    ...hcrm.rows.map(r => ({ label: `${r.bodyId} @ ${r.arcsec.toLocaleString()}″`, value: r.arcsec, glyph: r.glyph })),
  ];
  const [gamma, setGamma] = $hvState(0);
  const [K, setK] = $hvState(0);
  const [lastCarry, setLastCarry] = $hvState(null);
  const [seedIdx, setSeedIdx] = $hvState(0);

  const res = residues8(gamma);
  const value = gamma + K * M;

  const doStep = (step) => {
    const next = cramStep(gamma, K, step, M);
    // detect which lanes carried (wrapped) on a +1 step for the flash
    setLastCarry(step === 1 ? HCRM_BASIS.filter(p => (gamma % p) === p - 1) : null);
    setGamma(next.gamma);
    setK(next.K);
  };
  const seedTo = (i) => {
    const v = seeds[i].value;
    setSeedIdx(i);
    setGamma(((v % M) + M) % M);
    setK(Math.floor(v / M));
    setLastCarry(null);
  };

  return (
    <div className="hc-odo">
      <div className="hc-edges-note">
        Residue-native odometer arithmetic with certified winding. Each lane is a coprime dial;
        counting by one advances <b>every</b> dial mod p. The winding <b>K</b> ticks only when the
        full tray returns to the zero tray — after M<sub>B</sub> = {M.toLocaleString()} steps. The
        integer is the boundary projection <b>x = γ̃<sub>B</sub>(r) + K·M<sub>B</sub></b>, not the workspace.
      </div>

      <div className="hc-odo-dials">
        {HCRM_BASIS.map(p => {
          const v = res["r" + p];
          const carried = lastCarry && lastCarry.includes(p);
          const isShadow = p === 11;
          return (
            <div key={p} className={`hc-odo-dial ${carried ? "carried" : ""} ${isShadow ? "sh" : ""}`}>
              <DialRing value={v} p={p} />
              <div className="hc-odo-dial-p">mod {p}</div>
              <div className="hc-odo-dial-role">{PRIME_ROLE[p]}</div>
            </div>
          );
        })}
      </div>

      <div className="hc-odo-readout">
        <div className="hc-odo-tray">
          <span className="hc-odo-lbl">tray r</span>
          <span className="hc-odo-val">({HCRM_BASIS.map(p => res["r"+p]).join(", ")})</span>
        </div>
        <div className="hc-odo-winding">
          <span className="hc-odo-lbl">winding K</span>
          <span className="hc-odo-val">{K.toLocaleString()}</span>
        </div>
        <div className="hc-odo-boundary">
          <span className="hc-odo-lbl">boundary x = γ̃ + K·M</span>
          <span className="hc-odo-val big">{value.toLocaleString()}</span>
        </div>
        <div className="hc-odo-derived">
          = {(value / 3600).toFixed(4)}° · {ZODIAC[Math.floor((gamma % ARCSEC_CIRCLE) / ARCSEC_SIGN)].name} {(((gamma % ARCSEC_SIGN))/3600).toFixed(2)}°
        </div>
      </div>

      <div className="hc-odo-controls">
        <button onClick={() => doStep(1)}>+1″</button>
        <button onClick={() => doStep(60)}>+1′</button>
        <button onClick={() => doStep(3600)}>+1°</button>
        <button onClick={() => doStep(ARCSEC_SIGN)}>+1 sign</button>
        <button onClick={() => doStep(ARCSEC_CIRCLE)}>+1 ring (360°)</button>
        <button className="hc-odo-reset" onClick={() => { setGamma(0); setK(0); setLastCarry(null); setSeedIdx(0); }}>reset</button>
      </div>

      <div className="hc-odo-seed">
        <span className="hc-odo-lbl">seed to a body's exact register:</span>
        <select value={seedIdx} onChange={e => seedTo(Number(e.target.value))}>
          {seeds.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
        </select>
      </div>

      <div className="hc-odo-foot">
        Worked example — 17 vs 47: residues (1,2,2) on B={"{2,3,5}"} name both — winding K separates the blocks.
        Here on SafeS8 the same logic runs across eight dials; the tray + winding name the integer exactly.
      </div>
    </div>
  );
}

function DialRing({ value, p }) {
  const R = 26, C = 32, circ = 2 * Math.PI * R;
  const phase = value / p;
  const dash = circ * phase;
  // WP-20: decorative — the same dial value is already shown as plain
  // text in the "tray r" readout above (hc-odo-tray), so this is
  // aria-hidden rather than duplicating it as a second announcement.
  return (
    <svg viewBox="0 0 64 64" className="hc-odo-ring" aria-hidden="true">
      <circle cx={C} cy={C} r={R} fill="none" stroke="oklch(0.28 0.01 60)" strokeWidth="4" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="oklch(0.85 0.03 80)" strokeWidth="4"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              transform={`rotate(-90 ${C} ${C})`} />
      <text x={C} y={C+6} textAnchor="middle" fontSize="18" fontFamily="var(--serif)"
            fontStyle="italic" fill="oklch(0.95 0.01 80)">{value}</text>
    </svg>
  );
}

// ── K-Elimination — recover winding from anchors, integer never formed ──
function KElimination({ hcrm }) {
  return (
    <div className="hc-kelim">
      <div className="hc-edges-note">
        K-Elimination recovers each body's <b>winding K</b> from residue anchors alone — the integer
        is never reconstructed. Shell = Safe-6 product <b>M₆ = 30,030</b>; within one ring K runs 0–43.
        Each gear prime A ∈ {"{17, 19}"} yields a winding digit <b>K̂_A = (a_A − r_M)·M₆⁻¹ mod A</b>;
        the two anchors recover K mod 323 by CRT (exact, since K ≤ 43 &lt; 323).
        Certificate status: {hcrm.kElimVerified
          ? <span className="hc-verified">✓ all windings recovered from residues</span>
          : <span className="hc-failed">✕ mismatch</span>}.
      </div>
      <table className="hc-table">
        <thead>
          <tr>
            <th>body</th>
            <th className="num">r_M = a mod M₆</th>
            <th className="num">a₁₇</th>
            <th className="num">K̂₁₇</th>
            <th className="num">a₁₉</th>
            <th className="num">K̂₁₉</th>
            <th className="num">K recovered</th>
            <th className="num">K true</th>
            <th>certificate</th>
          </tr>
        </thead>
        <tbody>
          {hcrm.rows.map(r => {
            const ke = r.kElim;
            const a17 = ke.anchors[0], a19 = ke.anchors[1];
            return (
              <tr key={r.bodyId} className={ke.recovered ? "" : "has-shadow"}>
                <td className="hc-body"><span className="hc-gl">{r.glyph}</span> {r.bodyId}</td>
                <td className="num">{ke.rM.toLocaleString()}</td>
                <td className="num">{a17.aA}</td>
                <td className={`num ${a17.verified ? "" : "hc-failed"}`}>{a17.Khat}</td>
                <td className="num">{a19.aA}</td>
                <td className={`num ${a19.verified ? "" : "hc-failed"}`}>{a19.Khat}</td>
                <td className="num hc-shared">{ke.Krecovered}</td>
                <td className="num">{ke.Ktrue}</td>
                <td>{ke.recovered
                  ? <span className="hc-badge hc-badge-G-body" title="winding recovered from residues alone">✓ certified</span>
                  : <span className="hc-failed">✕</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="hc-kelim-detail">
        <div className="hc-sig-h">Worked certificate — first body</div>
        {(() => {
          const r = hcrm.rows[0], ke = r.kElim, A = ke.anchors[0];
          return (
            <div className="hc-kelim-steps">
              <div className="hc-kstep"><span className="hc-kn">1</span><span className="hc-kl">r_M = a mod M₆</span><span className="hc-kv">{r.arcsec.toLocaleString()} mod 30030 = {ke.rM.toLocaleString()}</span></div>
              <div className="hc-kstep"><span className="hc-kn">2</span><span className="hc-kl">a_A = a mod {A.A}</span><span className="hc-kv">{r.arcsec.toLocaleString()} mod {A.A} = {A.aA}</span></div>
              <div className="hc-kstep"><span className="hc-kn">3</span><span className="hc-kl">M₆⁻¹ mod {A.A}</span><span className="hc-kv">30030⁻¹ mod {A.A} = {A.inv}</span></div>
              <div className="hc-kstep"><span className="hc-kn">4</span><span className="hc-kl">K̂ = (a_A − r_M)·M₆⁻¹ mod {A.A}</span><span className="hc-kv">({A.aA} − {ke.rM % A.A}) × {A.inv} mod {A.A} = {A.Khat}</span></div>
              <div className="hc-kstep hc-kstep-final"><span className="hc-kn">✓</span><span className="hc-kl">K̂ vs K mod {A.A}</span><span className="hc-kv">{A.Khat} {A.verified ? "≡" : "≢"} {A.KtrueModA} {A.verified ? "verified" : "(mismatch)"}</span></div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── CRAM state — residue tray primary, integer is the boundary projection ──
function CramState({ hcrm }) {
  return (
    <div className="hc-cram">
      <div className="hc-edges-note">
        Each body is a CRAM state <b>S = (B, r, K, …)</b>. The residue tray <b>r</b> is primary;
        the integer longitude is the boundary projection <b>Val<sub>B</sub>(S) = γ̃<sub>B</sub>(r) + K·shell</b>,
        certified by the core’s shell-identity and winding checks
        (BigInt K-Elimination). γ̃ is the CRT reconstruction over the parked shell
        {" "}{hcrm.mShell ? hcrm.mShell.toLocaleString() : "—"} = 2·3·5·7·13·17·19, and K is
        recovered from the shadow lane {hcrm.parkAnchor || 11} alone — 0 or 1 within one ring
        (K &lt; 2, since shell·2 &gt; 1,296,000). Round-trip verified: {hcrm.cramVerified
          ? <span className="hc-verified">✓ all bodies exact</span>
          : <span className="hc-failed">✕ mismatch</span>}.
      </div>
      <table className="hc-table">
        <thead>
          <tr>
            <th>body</th>
            <th className="num">λ arcsec (boundary)</th>
            <th className="num">γ̃_B(r) reconstructed</th>
            <th className="num">K winding</th>
            <th className="num">Val_B(S)</th>
            <th>identity</th>
          </tr>
        </thead>
        <tbody>
          {hcrm.rows.map(r => (
            <tr key={r.bodyId}>
              <td className="hc-body"><span className="hc-gl">{r.glyph}</span> {r.bodyId}</td>
              <td className="num">{r.arcsec.toLocaleString()}</td>
              <td className="num">{r.gamma.toLocaleString()}</td>
              <td className="num">{r.winding}</td>
              <td className="num">{r.val.toLocaleString()}</td>
              <td>{r.roundtrip ? <span className="hc-verified">✓ exact</span> : <span className="hc-failed">✕</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hc-cram-foot">
        <div className="hc-cram-note">
          <b>Shadow anchor family</b> {"{11, 13, 17, 19}"} carries the disambiguation certificate.
          The shadow prime 11 is the witness lane; 17·19 form the gear pair (deep-coupling / nonlocal
          correction field). Transduction to another basis frame would preserve Val exactly.
        </div>
      </div>
    </div>
  );
}

// ── 5. Operator signature ───────────────────────────────────────────
function Signature({ hcrm }) {
  const { sig, gearPoints } = hcrm.signature;
  const SIZE = 360, C = SIZE / 2, R = 150;
  return (
    <div className="hc-sig">
      <div className="hc-sig-left">
        <h4 className="hc-sig-h">Residue distribution per lane</h4>
        {HCRM_BASIS.map(p => {
          const counts = sig[p];
          const max = Math.max(...Object.values(counts));
          return (
            <div key={p} className="hc-sig-lane">
              <div className="hc-sig-lane-label">r{p} <span>{PRIME_ROLE[p]}</span></div>
              <div className="hc-sig-bars">
                {Array.from({ length: p }).map((_, v) => {
                  const c = counts[v] || 0;
                  return (
                    <div key={v} className={`hc-sig-bar ${p===11&&v===0?"sh":""}`}
                         title={`residue ${v}: ${c} bodies`}>
                      <div className="hc-sig-bar-fill" style={{ height: `${(c / max) * 100}%` }} />
                      <div className="hc-sig-bar-v">{v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hc-sig-right">
        <h4 className="hc-sig-h">Gear-pair trajectory (r17, r19)</h4>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="hc-gear"
             role="img"
             aria-label="Scatter plot of each body's r17 and r19 residues; bodies near the origin sit in the gear-lock corner. The same r17/r19 values are listed per body in the Register ledger tab.">
          {/* grid */}
          <rect x={C-R} y={C-R} width={R*2} height={R*2} fill="none" stroke="oklch(0.93 0.008 80 / 0.12)" />
          {gearPoints.map((g, i) => {
            const x = C - R + (g.r17 / 16) * (R * 2);
            const y = C + R - (g.r19 / 18) * (R * 2);
            const lock = g.r17 <= 1 && g.r19 <= 1;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={lock ? 7 : 4}
                        fill={lock ? "oklch(0.85 0.10 80)" : "oklch(0.6 0.01 80)"}
                        opacity="0.85" />
                <text x={x + 8} y={y + 3} fontSize="9" fontFamily="ui-monospace, monospace"
                      fill="oklch(0.7 0.01 80)">{PLANET_GLYPH[g.body] || g.body.slice(0,2)}</text>
              </g>
            );
          })}
          <text x={C} y={SIZE - 6} textAnchor="middle" fontSize="9" fontFamily="ui-monospace,monospace" fill="oklch(0.6 0.01 80)">r17 →</text>
          <text x={10} y={C} fontSize="9" fontFamily="ui-monospace,monospace" fill="oklch(0.6 0.01 80)">↑ r19</text>
        </svg>
        <div className="hc-sig-caption">
          Bodies clustering toward the origin (low r17, low r19) sit in the gear-lock corner — the
          deep-coupling / nonlocal-correction zone searched against codex operator gears.
        </div>
        {hcrm.clusters.length > 0 && (
          <div className="hc-clusters">
            <h4 className="hc-sig-h">Shadow clusters by house-domain</h4>
            {hcrm.clusters.map((c, i) => (
              <div key={i} className="hc-cluster-row">
                <span className="hc-cluster-h">House {c.house}</span>
                <span className="hc-cluster-bodies">{c.bodies.join(", ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { HCRMConsole });
