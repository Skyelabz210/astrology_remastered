// One discoverable route to actual user-facing calculations. Availability
// descriptions distinguish a rendered technique from an arithmetic helper.
const TECHNIQUE_DESTINATIONS = Object.freeze([
  { id: 'natal-placements', label: 'Natal placements and houses', screen: 'spread', target: 'Essential dignities', note: 'Planets, angles and the chosen house system; houses need a known birth time.' },
  { id: 'natal-aspects', label: 'Natal aspects', screen: 'spread', target: 'Aspect grid (tightest first)', note: 'Configured aspects, actual orbs and applying / separating phase.' },
  { id: 'essential-dignities', label: 'Essential dignities', screen: 'spread', target: 'Essential dignities', note: 'Domicile, exaltation, detriment and fall; card readings also expose term, face and triplicity.' },
  { id: 'four-angles', label: 'Four angles', screen: 'spread', target: 'Four angles', note: 'Ascendant, Midheaven, Descendant and IC; withheld for unknown time.' },
  { id: 'sect', label: 'Sect', screen: 'spread', target: 'Sect · phase · void', note: 'Day or night calculation, subject to the selected sect convention.' },
  { id: 'natal-moon-phase', label: 'Natal Moon phase', screen: 'spread', target: 'Sect · phase · void', note: 'Birth Moon phase, illumination and Moon–Sun elongation.' },
  { id: 'void-of-course', label: 'Void-of-course Moon', screen: 'persona', target: 'Traditional details', note: 'Classical aspects before the next sign ingress; see source notices and time uncertainty.' },
  { id: 'chart-shape', label: 'Chart shape', screen: 'spread', target: 'Chart shape', note: 'Occupied arc and largest gap, using the app’s configured planet set.' },
  { id: 'element-balance', label: 'Element balance', screen: 'spread', target: 'Element balance', note: 'Counts are descriptive astrological classifications, not measured personality traits.' },
  { id: 'modality-balance', label: 'Modality balance', screen: 'spread', target: 'Modality balance', note: 'Cardinal, fixed and mutable counts.' },
  { id: 'hellenistic-lots', label: 'Hellenistic Lots', screen: 'spread', target: 'Hellenistic lots', note: 'Seven Hermetic Lots and their formulas; sect and Ascendant require a known time.' },
  { id: 'patterns', label: 'Patterns, stelliums and planetary joys', screen: 'spread', target: 'Patterns · stelliums · joys', note: 'Configured pattern rules; an empty result is meaningful.' },
  { id: 'antiscia', label: 'Antiscia and contra-antiscia', screen: 'spread', target: 'Antiscia (solstice-axis mirrors, 1° orb)', note: 'Solstice-axis mirror contacts within the specified orb.' },
  { id: 'annual-profection', label: 'Annual profections', screen: 'persona', target: 'Annual profection', note: 'Annual house and lord; withheld when birth time is unknown.' },
  { id: 'firdaria', label: 'Firdaria', screen: 'persona', target: 'Firdaria · major period', note: 'Bonatti major-period order and a 75-year cycle; no subperiod UI.' },
  { id: 'lunar-mansions', label: 'Lunar mansions', screen: 'persona', target: 'Lunar mansion', note: '28 equal tropical mansions; stellar traditions differ.' },
  { id: 'mutual-receptions', label: 'Mutual receptions', screen: 'persona', target: 'Traditional details', note: 'Domicile or exaltation receptions, displayed together with traditional details.' },
  { id: 'prenatal-syzygy', label: 'Prenatal New or Full Moon', screen: 'persona', target: 'Traditional details', note: 'The lunar conjunction or opposition before birth, refined using the available ephemeris.' },
  { id: 'fixed-stars', label: 'Fixed-star conjunctions', screen: 'persona', target: 'Traditional details', note: 'Selected catalogue, precessed to birth date; longitude-only conjunctions, no proper motion.' },
  { id: 'zodiacal-releasing', label: 'Zodiacal releasing · level 1', screen: 'persona', target: 'Traditional details', note: 'Fortune and Spirit; 360-day Egyptian years. Levels 2–4 and loosing of the bond are absent.' },
  { id: 'solar-conditions', label: 'Solar conditions', screen: 'persona', target: 'Solar conditions', note: 'Cazimi, combustion and under-the-beams separation criteria.' },
  { id: 'live-transits', label: 'Live transits to natal', screen: 'persona', target: 'Live transits to natal', note: 'Updated each minute. Only 12 tightest current aspects are searched for exact dates within 60 days.' },
  { id: 'solar-return', label: 'Solar return', screen: 'spread', target: 'Return charts · the subject, sampled once a cycle', note: 'Exact Sun return, cast for the residence on that return date; paired with the lunar return.' },
  { id: 'lunar-return', label: 'Lunar return', screen: 'spread', target: 'Return charts · the subject, sampled once a cycle', note: 'Exact Moon return; unknown birth time makes return timing approximate.' },
  { id: 'secondary-progressions', label: 'Secondary progressions', screen: 'spread', target: 'Secondary progressions at the target age (one day per year of life)', note: 'Configured progressed planets; this is not a full progressed-angle method.' },
  { id: 'eclipses', label: 'Eclipses and natal contacts', screen: 'spread', target: 'Eclipses · geophysical', note: 'Prenatal pair, lifetime contacts and future window; requires the full astronomical ephemeris.' },
  { id: 'transit-perfections', label: 'Transit perfections', screen: 'spread', target: 'Perfections · the road behind and ahead', note: 'Six slow planets, a year around the target, and the 16 nearest crossings.' },
  { id: 'behavioral-profile', label: 'Behavioral profile', screen: 'behavior', target: 'Behavioral profile', note: 'Chart-based reflection with explicit evidence and uncertainty; not a clinical personality assessment.' },
  { id: 'jyotisha', label: 'Jyotisha · nakshatras and Vimshottari', screen: 'behavior', target: 'Traditions and your evolving avatar', note: 'Integer lunar mansions, padas, major and subperiods; date-dependent approximate ayanamsha conventions are disclosed.' },
  { id: 'mayan-calendar', label: 'Mayan calendar · Tzolk’in and Haab’', screen: 'behavior', target: 'Traditions and your evolving avatar', note: 'Birth civil date in the recorded timezone; GMT 584283 correlation.' },
  { id: 'souvenir', label: 'Celestial souvenir', screen: 'behavior', target: 'Celestial souvenir', note: 'Personal HTML, Markdown and JSON keepsake; optional source-linked AI expansion.' },
  { id: 'consultant', label: 'Chart consultant', screen: 'behavior', target: 'Chart consultant', note: 'Opt-in selected AI provider; schema-checked answers cite admitted source facts.' },
  { id: 'synastry', label: 'Synastry · two birth records', screen: 'synastry', target: null, note: 'Opens the relationship result when a partner is entered; otherwise opens the second-birth form. Data entry is required.' },
  { id: 'composite', label: 'Composite relationship chart', screen: 'synastry', target: 'Composite relationship chart', note: 'Short-arc midpoints of both birth charts; enter a second birth record first. Antipodal points and unknown-time precision are withheld.' },
  { id: 'register-inspector', label: 'Exact register inspector · Celestial Registry', screen: 'behavior', target: 'Exact register inspector', note: 'Admitted natal residue trays, parked and legacy windings, plus a separate signed-integer decomposition sandbox.' },
  { id: 'solar-arc', label: 'Solar-arc directions · Prime Resonance', screen: 'behavior', target: 'Solar-arc directions', note: 'True progressed-Sun or explicitly defined Naibod key; constructed directed-to-natal contacts within 1°.' },
  { id: 'stations', label: 'Planetary stations · Prime Resonance', screen: 'behavior', target: 'Planetary stations', note: 'Search and retain apparent motion reversals from Mercury through Pluto for up to 366 days.' },
]);

const TECHNIQUE_UTILITIES = Object.freeze([
  { id: 'reading-session', label: 'Current reading', screen: 'session', target: null },
  { id: 'birth-entry', label: 'Your birth details', screen: 'landing', target: null },
  { id: 'partner-birth', label: 'Second birth details', screen: 'partner', target: null },
]);

// Root App calls this hook once. Validating the ID against this catalogue
// keeps navigation events from injecting arbitrary selectors or routes.
function useTechniqueNavigation(onRoute) {
  const destination = React.useRef(null);
  const routeRef = React.useRef(onRoute);
  routeRef.current = onRoute;
  React.useEffect(() => {
    let observer = null, timeout = null, scheduled = null;
    const clear = () => { if (observer) observer.disconnect(); if (timeout) clearTimeout(timeout); if (scheduled) cancelAnimationFrame(scheduled); observer = timeout = scheduled = null; };
    const focusTarget = () => {
      const item = destination.current;
      if (!item || !item.target) { clear(); return; }
      const root = document.getElementById('root');
      const nodes = root ? root.querySelectorAll('h1,h2,h3,h4,.tp-title,.cl-title,.syn-hdr-title') : [];
      const target = Array.from(nodes).find(node => node.textContent.trim() === item.target);
      if (!target) return;
      // Do not mistake a screen that is about to unmount for the destination.
      const expected = item.screen === 'spread' ? root.querySelector('.spread') : item.screen === 'persona' ? root.querySelector('.persona-page:not(.behavioral-page)') : item.screen === 'behavior' ? root.querySelector('.behavioral-page') : root;
      if (!expected) return;
      for (let node = target.parentElement; node && node !== root; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
      target.setAttribute('tabindex', '-1');
      target.setAttribute('data-technique-target', item.id);
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      target.focus({ preventScroll: true });
      destination.current = null;
      clear();
    };
    const navigate = event => {
      const item = [...TECHNIQUE_DESTINATIONS, ...TECHNIQUE_UTILITIES].find(row => row.id === (event.detail && event.detail.id));
      if (!item) return;
      clear(); destination.current = item;
      // All navigation stays in the current profile. No birth coordinates,
      // dates, names or residence chapters are replaced by a destination.
      routeRef.current(item.screen, item.id);
      observer = new MutationObserver(focusTarget);
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
      scheduled = requestAnimationFrame(focusTarget);
      timeout = setTimeout(clear, 12000);
    };
    window.addEventListener('astrology-technique-navigate', navigate);
    return () => { clear(); window.removeEventListener('astrology-technique-navigate', navigate); };
  }, []);
}

function TechniqueDirectory() {
  const dialog = React.useRef(null);
  const trigger = React.useRef(null);
  const [query, setQuery] = React.useState('');
  const filtered = TECHNIQUE_DESTINATIONS.filter(item => `${item.label} ${item.note}`.toLowerCase().includes(query.toLowerCase()));
  const close = () => { dialog.current.close(); trigger.current.focus(); };
  const choose = item => {
    close();
    window.dispatchEvent(new CustomEvent('astrology-technique-navigate', { detail: { id: item.id } }));
  };
  return <>
    <button className="technique-trigger" ref={trigger} type="button" onClick={() => { setQuery(''); dialog.current.showModal(); }} aria-haspopup="dialog">Explore techniques</button>
    <dialog className="technique-dialog" ref={dialog} aria-labelledby="technique-directory-title" onCancel={() => trigger.current.focus()} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
      <div className="technique-heading"><h2 id="technique-directory-title">Explore techniques</h2><button type="button" onClick={close} aria-label="Close technique directory">×</button></div>
      <p>Uses your current chart. On birth entry, cast changed details first. Calculation limits and missing birth-time data still apply.</p>
      <label className="technique-search">Find a technique<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <nav className="technique-list" aria-label="Astrology techniques">
        {filtered.map(item => <button key={item.id} type="button" data-technique-id={item.id} onClick={() => choose(item)}><strong>{item.label}</strong><span>{item.note}</span></button>)}
      </nav>
      {!filtered.length && <p role="status">No implemented destination matches this search.</p>}
      <nav className="technique-utilities" aria-label="Chart navigation">{TECHNIQUE_UTILITIES.map(item => <button type="button" key={item.id} onClick={() => choose(item)}>{item.label}</button>)}</nav>
      <p className="technique-limit">Not available: horary judgement, electional search, primary directions, solar arcs, full Zodiacal-releasing subperiods, translation or collection of light, and complete sidereal / Jyotish or other non-Western systems.</p>
    </dialog>
  </>;
}
Object.assign(window, { TECHNIQUE_DESTINATIONS, useTechniqueNavigation, TechniqueDirectory });
// A separate React root keeps the same launcher on every screen, including
// nested Persona birth entry and render-time error fallbacks.
const techniqueHost = document.createElement('div');
techniqueHost.id = 'technique-directory-host';
document.body.appendChild(techniqueHost);
ReactDOM.createRoot(techniqueHost).render(<TechniqueDirectory />);
