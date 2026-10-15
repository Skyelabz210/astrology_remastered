function variantLongitude(numerator,denominator='1') {
  const value=Number(numerator)/Number(denominator),sign=Math.floor(value/108000),within=value%108000;
  const names=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  return `${Math.floor(within/3600)}°${String(Math.floor(within%3600/60)).padStart(2,'0')}′${String(within%60).padStart(2,'0')}″ ${names[sign]}`;
}
function saveVariantCalculation(context,name,calculation,value) {
  try {
    const runs=window.ReadingRuns,owner=runs.profileKey(context.input.birth);
    if(context.profileKey!==owner||!['registerInspection','solarArc','stations'].includes(name)||!value||value.status==='unavailable')return false;
    if(name==='registerInspection'&&runs.profileKey(value.input.birth)!==owner)return false;
    if(name==='solarArc'&&(runs.profileKey(value.input.birth)!==owner||value.input.targetAt!==context.at))return false;
    if(name==='stations'&&(value.input.startAt!==context.at||value.events.some(e=>e.jd<value.input.startJd||e.jd>=value.input.endJd)))return false;
    const input={...context.input,calculation:{kind:name,...calculation}};
    const ok=runs.saveRun(null,{version:1,id:JSON.stringify([context.at,input]),profileKey:owner,at:context.at,input,
      evidence:{...context.evidence,[name]:{status:'ready',value},limitations:context.limitations},
      reading:name==='solarArc'?value.convention:name==='stations'?`${value.events.length} apparent planetary stations in the selected interval. ${value.convention}`:`${value.input.body}: admitted longitude ${value.register.longitude_arcsec} arcseconds; canonical parked-shell winding ${value.register.shell.K}.`});
    if(ok)window.dispatchEvent(new Event('personal-reading-evidence'));
    return ok;
  }catch{return false;}
}
function VariantLab({chart,context,pack}) {
  const [body,setBody]=React.useState('Sun'),[number,setNumber]=React.useState('35113'),[basis,setBasis]=React.useState('2,3,5,7,11,13,17,19');
  const [math,setMath]=React.useState(null),[mathError,setMathError]=React.useState(''),[message,setMessage]=React.useState('');
  const [method,setMethod]=React.useState('true'),[horizon,setHorizon]=React.useState(90),[events,setEvents]=React.useState(null),[busy,setBusy]=React.useState(false);
  const scope=JSON.stringify([context.cacheFingerprint,horizon]),current=React.useRef(scope);current.current=scope;
  React.useEffect(()=>()=>{current.current=null;},[]);
  React.useEffect(()=>{setEvents(null);setBusy(false);setMessage('');},[scope]);
  const inspector=React.useMemo(()=>{
    if(!pack)return null;
    try{return window.RegisterInspector.inspectChartRegister(chart,body,pack.ledger);}catch(error){return {error:error.message};}
  },[pack,chart,body]);
  const arc=React.useMemo(()=>{
    try{
      if(window.EPHEMERIS_MODE==='SYNTHETIC')throw new Error('Real ephemeris is required.');
      return window.VariantCalculations.solarArcDirections(chart,context.jd,window.Astronomy,{method});
    }catch(error){return {status:'unavailable',message:error.message};}
  },[chart,context.jd,method]);
  const saved=ok=>setMessage(ok?'Calculation saved to this profile’s reading history and ZIP archive.':'The calculation could not be saved in browser storage. Export the visible results before leaving.');
  async function searchStations() {
    const requested=scope;setBusy(true);setMessage('Searching apparent motion…');
    await new Promise(resolve=>setTimeout(resolve,20));
    if(current.current!==requested)return;
    try{
      if(window.EPHEMERIS_MODE==='SYNTHETIC')throw new Error('Real ephemeris is required.');
      const found=window.VariantCalculations.findStations(context.jd,context.jd+Number(horizon),window.Astronomy);
      const value={version:1,kind:'planetary-stations',input:{startAt:context.at,startJd:context.jd,endJd:context.jd+Number(horizon),horizonDays:Number(horizon)},events:found,
        convention:'Mercury–Pluto apparent geocentric ecliptic longitude speed; one-day sampling, central differences ±0.005 day and zero-crossing brackets refined to ≤1 second. Interval includes its start and excludes its end. Station dates are numerical ephemeris estimates, not personal event predictions.'};
      if(current.current!==requested)return;
      setEvents(value);saved(saveVariantCalculation(context,'stations',{horizonDays:Number(horizon),source:'Astronomy Engine 2.1.19'},value));
    }catch(error){if(current.current===requested)setMessage(error.message);}
    finally{if(current.current===requested)setBusy(false);}
  }
  return <div className="variant-lab">
    <details><summary>Celestial Registry · exact register inspector</summary><h2>Exact register inspector</h2>
      <p>Inspect the admitted birth coordinates behind your avatar. The mathematical sandbox below can explore other integers without changing your chart or profile.</p>
      <label>Register body<select aria-label="Register body" value={body} onChange={e=>setBody(e.target.value)}>{['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'].map(name=><option key={name}>{name}</option>)}</select></label>
      {!inspector||inspector.error?<p>{inspector?.error||'Admitted sources unavailable; exact birth registers require a known time and a real chart.'}</p>:<>
        <p>{body} · {variantLongitude(inspector.register.longitude_arcsec)} · {inspector.register.longitude_arcsec} integer arcseconds.</p>
        <div className="evolution-table"><table><caption>{body} independent prime residues</caption><thead><tr><th>Lane modulus</th><th>Residue</th></tr></thead><tbody>{Object.entries(inspector.register.residues_B8).map(([p,r])=><tr key={p}><th scope="row">{p.replace('mod_','')}</th><td>{r}</td></tr>)}</tbody></table></div>
        <p>Canonical parked split: shell {inspector.register.basis.M_shell}, residue {inspector.register.shell.r}, anchor {inspector.register.shell.anchor}, recovered winding {inspector.register.shell.K}. Double-lift digits: {inspector.register.shell.lift.digits.join(', ')}.</p>
        <p>Legacy gear split: shell {inspector.register.basis.M6}, residue {inspector.register.legacy_shell.r_M6}, winding {inspector.register.legacy_shell.K}. Both certificates pass; the splits use different quotients.</p>
        <button type="button" onClick={()=>saved(saveVariantCalculation(context,'registerInspection',{body},inspector))}>Save inspected register</button>
      </>}
      <h3>Integer decomposition sandbox</h3><form onSubmit={e=>{e.preventDefault();try{setMath(window.RegisterInspector.decomposeInteger(number,basis));setMathError('');}catch(error){setMath(null);setMathError(error.message);}}}>
        <label>Signed integer<input value={number} maxLength={121} onChange={e=>setNumber(e.target.value)} /></label>
        <label>Pairwise-coprime moduli<input value={basis} maxLength={95} onChange={e=>setBasis(e.target.value)} /></label>
        <button type="submit">Decompose integer</button></form><p role="status">{mathError}</p>
      {math&&<><p>Result for basis {'{'}{math.basis.join(', ')}{'}'}.</p><p className="register-equation">{math.integer} = {math.representative} + ({math.winding} × {math.modulus}). Reconstructed exactly: {math.exact?'yes':'no'}.</p>
        <p>Centered transport: r={math.centered.r}, K={math.centered.K}. {math.convention}</p>
        <details><summary>Independent shell/anchor checks · {math.rows.length} pairs</summary><div className="evolution-table"><table><caption>K-elimination per shell</caption><thead><tr><th>Shell</th><th>Anchor</th><th>Shell residue</th><th>Anchor residue</th><th>Recovered K mod anchor</th><th>Quotient mod anchor</th><th>Match</th></tr></thead><tbody>{math.rows.map((r,i)=><tr key={i}><td>{r.shell}</td><td>{r.anchor}</td><td>{r.r}</td><td>{r.s}</td><td>{r.recovered}</td><td>{r.actual}</td><td>{r.ok?'yes':'no'}</td></tr>)}</tbody></table></div></details></>}
    </details>
    <details><summary>Prime Resonance · solar-arc directions</summary><h2>Solar-arc directions</h2>
      <label>Solar-arc method<select aria-label="Solar-arc method" value={method} onChange={e=>setMethod(e.target.value)}><option value="true">True progressed-Sun arc</option><option value="naibod">Naibod · 59′08.33″ / year</option></select></label>
      {arc.status!=='ready'?<p>{arc.message}</p>:<><p>Age {arc.ageYears.toFixed(4)} years · forward arc {Number(arc.arcArcsec)/3600}° at {arc.input.targetAt}.</p><p>{arc.convention}</p>
        <div className="evolution-table"><table><caption>Constructed solar-arc positions</caption><thead><tr><th>Body</th><th>Natal</th><th>Directed</th></tr></thead><tbody>{arc.planets.map(p=><tr key={p.name}><th scope="row">{p.name}</th><td>{variantLongitude(p.natalArcsec)}</td><td>{variantLongitude(p.directedArcsec)}</td></tr>)}</tbody></table></div>
        <ul>{arc.contacts.map((c,i)=><li key={i}>Directed {c.directedBody} {c.aspect.toLowerCase()} natal {c.natalBody} · orb {c.orbArcsec}″.</li>)}</ul>{!arc.contacts.length&&<p>No directed-to-natal Ptolemaic contact within 1°.</p>}
        <button type="button" onClick={()=>saved(saveVariantCalculation(context,'solarArc',{method,targetAt:context.at},arc))}>Save solar-arc calculation</button></>}
    </details>
    <details><summary>Prime Resonance · planetary stations</summary><h2>Planetary stations</h2><p>Search the sky from the frozen reading instant {context.at}. A station is a reversal of apparent longitude motion, independent of the birth chart; the saved result remains attached to this profile’s reading.</p>
      <label>Station search days<input type="number" min="1" max="366" step="1" value={horizon} onChange={e=>setHorizon(e.target.value)} /></label>
      <button type="button" disabled={busy||!Number.isInteger(Number(horizon))||Number(horizon)<1||Number(horizon)>366} onClick={searchStations}>{busy?'Searching stations…':'Search and save stations'}</button>
      {events&&<><p>{events.convention}</p><div className="evolution-table"><table><caption>Located planetary stations</caption><thead><tr><th>UTC estimate</th><th>Body</th><th>New motion</th><th>Position</th></tr></thead><tbody>{events.events.map(e=><tr key={`${e.body}:${e.at}`}><td>{e.at}</td><td>{e.body}</td><td>{e.direction}</td><td>{variantLongitude(String(Math.round(e.longitudeArcsec)%1296000))}</td></tr>)}</tbody></table></div>{!events.events.length&&<p>No station was located in this interval.</p>}</>}
    </details><p role="status" className="variant-save-status">{message}</p>
  </div>;
}
function CompositePanel({value}) {
  return <section className="evolution-panel composite-panel"><h2>Composite relationship chart</h2>
    {value?.status!=='ready'?<p>{value?.message||'Composite calculation unavailable.'}</p>:<><p>{value.convention}</p>
      <div className="evolution-table"><table><caption>Short-arc relationship midpoints</caption><thead><tr><th>Body</th><th>Midpoint</th><th>Exact arcseconds</th></tr></thead><tbody>{value.planets.map(p=><tr key={p.name}><th scope="row">{p.name}</th><td>{p.status==='ready'?variantLongitude(p.numerator,p.denominator):p.reason}</td><td>{p.status==='ready'?`${p.numerator} / ${p.denominator}`:'two equally short choices'}</td></tr>)}</tbody></table></div>
      <h3>Composite contacts · 1° orb</h3>{value.contacts.length?<ul>{value.contacts.map((c,i)=><li key={i}>{c.a} {c.aspect.toLowerCase()} {c.b} · orb {Number(c.orbNumerator)/2}″.</li>)}</ul>:<p>No Ptolemaic contact within 1° among the unambiguous midpoints.</p>}
      <p>This symbolic relationship chart is retained with both birth records in the relationship reading history. It adds a reflection layer; it does not measure relationship quality.</p></>}
  </section>;
}
Object.assign(window,{VariantLab,CompositePanel,saveVariantCalculation});
