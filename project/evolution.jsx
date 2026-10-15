function MistralSettings() {
  const [key,setKey] = React.useState(''), [model,setModel] = React.useState('mistral-large-latest');
  const [proxy,setProxy] = React.useState(''), [remember,setRemember] = React.useState(false), [message,setMessage] = React.useState('');
  const state = window.useInterpreterState();
  return <fieldset className="evolution-settings"><legend>Mistral · optional provider</legend>
    <p>Selected: {state.provider || 'OpenRouter'}. Direct Mistral models can incur charges. Your OpenRouter connection remains available.</p>
    <label>Mistral API key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} /></label>
    <label>Mistral model<select value={model} onChange={e=>setModel(e.target.value)}>{['mistral-large-latest','codestral-latest','pixtral-large-latest'].map(id=><option key={id}>{id}</option>)}</select></label>
    <label>Optional same-origin proxy path<input placeholder="/api/mistral" value={proxy} onChange={e=>setProxy(e.target.value)} /></label>
    <label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} /> Remember this Mistral key on this device</label>
    <p>Memory-only by default. A remembered key is stored in browser storage, which page scripts can read; shared settings and exports exclude it. A proxy uses its server-side key and receives no browser key.</p>
    <button type="button" onClick={()=>{try {if(!key.trim()&&!proxy&&window.Mistral.available())window.Mistral.chooseModel(model);else window.Mistral.configure(key,model,{proxy,remember});window.Interpreter.select('Mistral');setKey('');setMessage('Mistral configured. Enable the AI checkbox to send a request.');}catch(e){setMessage(e.message);}}}>Use Mistral</button>
    <button type="button" onClick={()=>{window.Interpreter.select('OpenRouter');setMessage('OpenRouter selected.');}}>Use OpenRouter</button>
    <button type="button" onClick={()=>{try{window.Mistral.disconnect();setMessage('Mistral key removed.');}catch(e){setMessage(e.message);}}}>Forget Mistral key</button>
    <p role="status">{message}</p>
  </fieldset>;
}
function EvolutionPanel({chart,context,settings}) {
  const interpreter = window.useInterpreterState();
  const [pack,setPack] = React.useState(null), [packError,setPackError] = React.useState(''), [frame,setFrame] = React.useState('lahiri');
  const [question,setQuestion] = React.useState(''), [busy,setBusy] = React.useState(false), [message,setMessage] = React.useState('');
  const [answer,setAnswer] = React.useState(null), [keepsake,setKeepsake] = React.useState(null);
  const scope = context.cacheFingerprint + ':' + interpreter.generation;
  const current = React.useRef(scope); current.current = scope;
  React.useEffect(()=>{
    let active=true; setPack(null);setPackError('');setAnswer(null);setKeepsake(null);setBusy(false);
    window.SourcePack.prepareSourcePack(chart,window.EPHEMERIS_MODE === 'SYNTHETIC' ? null : window.Astronomy,context).then(value=>{if(active)setPack(value);},error=>{if(active)setPackError(error.message);});
    return ()=>{active=false;};
  },[scope]);
  const traditions = React.useMemo(()=>{
    if (!pack) return null;
    try {
      const offset=window.Traditions.ayanamshaArcsec(chart.jd,frame), moon=pack.ledger.find(e=>e.body==='Moon');
      return { offset:String(offset), planets:pack.ledger.map(e=>({body:e.body,...window.Traditions.nakshatra(BigInt(e.longitude_arcsec),offset)})), dasha:window.Traditions.vimshottari(BigInt(moon.longitude_arcsec),offset,chart.birth.dateISO,context.at) };
    } catch(error) {return {error:error.message};}
  },[pack,frame,chart.jd,context.at]);
  const calendar=React.useMemo(()=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:chart.birth.tz || 'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(chart.birth.dateISO));
    const get=type=>parts.find(p=>p.type===type).value;
    return window.Traditions.mayanCalendar(`${get('year')}-${get('month')}-${get('day')}`);
  },[chart.birth.dateISO,chart.birth.tz]);
  const summary = window.LivingProfile.summarizeProfile(window.LivingProfile.loadProfile(chart.birth));
  const save = (name,value)=>{
    const id=JSON.stringify([context.at,context.input]);
    const ok=window.ReadingRuns.attachEvidence(null,id,name,value,context.profileKey);
    window.dispatchEvent(new CustomEvent('personal-reading-evidence'));
    return ok;
  };
  React.useEffect(()=>{
    if(!traditions || traditions.error)return;
    const evidence={frame,...traditions,mayan:calendar};save('traditions',evidence);
    const input={...context.input,calculation:{kind:'traditions',frame,ayanamshaArcsec:traditions.offset,targetAt:context.at}};
    const ok=window.ReadingRuns.saveRun(null,{version:1,id:JSON.stringify([context.at,input]),profileKey:context.profileKey,at:context.at,input,
      reading:`Natal Moon: ${traditions.dasha.moon.name}, pada ${traditions.dasha.moon.pada}, lord ${traditions.dasha.moon.lord}. ${traditions.dasha.convention}`,
      evidence:{traditions:evidence,limitations:context.limitations}});
    if(!ok)setMessage('This tradition run could not be saved. Download a keepsake to retain the current results.');
  },[traditions,calendar]);
  async function generate(kind) {
    if(!pack || !settings.agentOn || !window.agentAvailable())return;
    const requestedScope=scope;setBusy(true);setMessage('Checking source-linked interpretation…');
    try {
      const task=kind==='souvenir' ? 'Create a reflective commemorative dedication and natal essay, with an opening, chart exploration and convergent synthesis. Include no unsupported biographical milestones.' : `Answer this user question about the supplied chart: ${question.slice(0,600)}`;
      const reports=settings.shareBehavioralDataWithAI===true ? window.compactLivingSummary(summary,10) : null;
      const prompt=window.SourcePack.structuredPrompt(pack,task,reports);
      const text=await window.completeVerified(prompt,draft=>{
        try {const parsed=window.SourcePack.parseStructuredReading(draft,pack);const checks=parsed.sections.map(s=>window.validateNatalGrounding(s.text,chart,1));return {ok:checks.every(c=>c.ok),errors:checks.flatMap(c=>c.errors)};}
        catch(error){return {ok:false,errors:[error.message]};}
      },null,{schema:window.SourcePack.READING_SCHEMA});
      if(current.current!==requestedScope)return;
      const parsed=window.SourcePack.parseStructuredReading(text,pack);
      const existing=window.ReadingRuns.loadRuns(null,context.profileKey).find(r=>r.id===JSON.stringify([context.at,context.input]));
      let ok;
      if(kind==='souvenir'){
        setKeepsake(parsed);const value={...parsed,provider:interpreter.provider,model:interpreter.model,facts:pack.facts};
        ok=save('souvenir',value);ok=save('generatedSouvenirs',[...(existing?.evidence.generatedSouvenirs || []),value].slice(-10))&&ok;
      } else{
        setAnswer(parsed);const value={question,answer:parsed,provider:interpreter.provider,model:interpreter.model,facts:pack.facts};
        ok=save('consultant',value);ok=save('consultantTurns',[...(existing?.evidence.consultantTurns || []),value].slice(-20))&&ok;
      }
      setMessage(ok?'Saved to this reading with inspectable source IDs.':'The interpretation is visible, but browser storage could not save it. Export it before leaving.');
    } catch(error){if(current.current===requestedScope)setMessage(error.message);}
    finally{if(current.current===requestedScope)setBusy(false);}
  }
  function download(format) {
    const value=window.Souvenir.buildSouvenir(chart,context,summary,keepsake);
    const body=format==='html'?window.Souvenir.souvenirHtml(value):format==='md'?window.Souvenir.souvenirMarkdown(value):JSON.stringify(value,null,2);
    const url=URL.createObjectURL(new Blob([body],{type:format==='html'?'text/html':format==='md'?'text/markdown':'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=`celestial-souvenir.${format}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    save('souvenirSnapshot',value);setMessage('Your personal keepsake is downloaded. It includes the user reports shown in this avatar.');
  }
  const renderReading=value=>value&&<section className="evolution-generated"><h3>{value.title}</h3>{value.sections.map((section,index)=><section key={index}><h4>{section.title}</h4><p>{section.text}</p><details><summary>Source traces · {section.citations.length}</summary>{section.citations.map(id=><p key={id}><code>{id}</code> · {pack?.facts.find(f=>f.id===id)?.text}</p>)}</details></section>)}</section>;
  return <section className="evolution-panel">
    <h2>Traditions and your evolving avatar</h2>
    <p>These dated frameworks add reflection contexts to your avatar. Check-ins still describe your experience; no tradition assigns a psychological diagnosis.</p>
    <details><summary>Jyotisha · nakshatras and Vimshottari</summary>
      <label>Ayanamsha convention<select value={frame} onChange={e=>setFrame(e.target.value)}>{['lahiri','krishnamurti','raman','fagan_bradley'].map(id=><option key={id}>{id}</option>)}</select></label>
      <p>J2000 offsets from this repository, advanced by IAU 2006 general precession and rounded to arcseconds. This is an explicit approximation, not an official implementation of each school. Sidereal sectors do not change your tropical chart.</p>
      {traditions?.error && <p role="status">{traditions.error}</p>}
      {traditions?.dasha && <><p>Offset {traditions.offset}″ · Natal Moon: {traditions.dasha.moon.name}, pada {traditions.dasha.moon.pada}, lord {traditions.dasha.moon.lord}.</p><div className="evolution-table"><table><caption>Admitted planetary nakshatras</caption><thead><tr><th>Body</th><th>Mansion</th><th>Pada</th><th>Lord</th></tr></thead><tbody>{traditions.planets.map(p=><tr key={p.body}><td>{p.body}</td><td>{p.name}</td><td>{p.pada}</td><td>{p.lord}</td></tr>)}</tbody></table></div><p>{traditions.dasha.convention}</p><p>At the reading instant: {traditions.dasha.active?.lord || 'outside this timeline'}{traditions.dasha.active ? ' / '+traditions.dasha.active.subperiods.find(s=>s.active)?.lord : ''}.</p>{traditions.dasha.periods.slice(0,10).map((p,i)=><details key={i}><summary>{p.lord} · {p.from.slice(0,10)} → {p.until.slice(0,10)}</summary>{p.subperiods.map(s=><p key={s.lord}>{p.lord} / {s.lord} · {s.from} → {s.until}</p>)}</details>)}</>}
      {!pack && <p>{packError || 'Preparing admitted chart sources…'}</p>}
    </details>
    <details><summary>Mayan calendar · Tzolk’in and Haab’</summary><p>Birth civil date {calendar.civilDate} in {chart.birth.tz || 'UTC'}: {calendar.tzolkin.number} {calendar.tzolkin.name} · {calendar.haab.day} {calendar.haab.month}.</p><p>{calendar.correlation} These are calendar cycles, separate from zodiac signs.</p></details>
    <h2>Celestial souvenir</h2><p>A personal keepsake of this chart, residence chapters, goals and retained observations. Local exports work without an AI key. Downloads contain private user reports.</p>
    {window.EclipseCatalogue && <details><summary>Complete eclipse catalogue · 1970–2030</summary><p>{window.EclipseCatalogue.events.length} solar and lunar events. {window.EclipseCatalogue.source}. Geographical points describe greatest eclipse for total/annular solar events, the subsolar point for partial solar events, and the sublunar point for lunar events. Personal horizon visibility and distances are computed in Full spread → Eclipses.</p><div className="evolution-table"><table><caption>Eclipses from 1970 through 2030 inclusive</caption><thead><tr><th>Peak UTC</th><th>Type</th><th>Kind</th><th>Coordinate basis</th></tr></thead><tbody>{window.EclipseCatalogue.events.map(e=><tr key={e.peakISO}><td>{e.peakISO}</td><td>{e.type}</td><td>{e.kind}</td><td>{e.geoBasis}</td></tr>)}</tbody></table></div></details>}
    {['html','md','json'].map(format=><button type="button" key={format} onClick={()=>download(format)}>Download souvenir {format.toUpperCase()}</button>)}
    <button type="button" disabled={!pack||busy||!settings.agentOn||!interpreter.available} onClick={()=>generate('souvenir')}>Add AI keepsake interpretation</button>
    {renderReading(keepsake)}
    <window.VariantLab chart={chart} context={context} pack={pack} />
    <h2>Chart consultant</h2><form onSubmit={e=>{e.preventDefault();generate('consultant');}}><label>Ask your chart consultant<textarea maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="How might these aspects relate to the decision I am reflecting on?" /></label><button type="submit" disabled={!pack||busy||!settings.agentOn||!interpreter.available||!question.trim()}>Ask with source traces</button></form>
    <p>Uses the selected provider and AI permission below. Goals and journal notes are included only when you enable their separate sharing checkbox.</p>
    {!pack && <p>{packError || 'Preparing admitted chart sources…'}</p>}{renderReading(answer)}<p role="status">{message}</p>
  </section>;
}
function ExactTheatreGeometry({chart,body}) {
  const [pack,setPack]=React.useState(null),[error,setError]=React.useState('');
  React.useEffect(()=>{let active=true;setPack(null);setError('');window.SourcePack.prepareSourcePack(chart,window.EPHEMERIS_MODE==='SYNTHETIC'?null:window.Astronomy,chart.readingContext).then(p=>{if(active)setPack(p);},e=>{if(active)setError(e.message);});return()=>{active=false;};},[chart]);
  let geometry=null, geometryError=error;
  if(pack)try{geometry=window.TheatreGeometry.theatreGeometry(chart,body,pack.ledger);}catch(e){geometryError=e.message;}
  const point=arcsec=>{const a=(Number(arcsec)/3600-90)*Math.PI/180;return [120+92*Math.cos(a),120+92*Math.sin(a)];};
  const own=geometry?point(geometry.longitudeArcsec):[120,120];
  return <details className="theatre-geometry"><summary>Chart geometry and exact lanes · {body}</summary>{!geometry?<p>{geometryError || 'Preparing admitted geometry…'}</p>:<>
    <svg viewBox="0 0 240 240" width="240" role="img" aria-label={`${body} at ${geometry.longitudeArcsec} integer arcseconds, connected to ${geometry.contacts.length} admitted planetary contacts`}><circle cx="120" cy="120" r="92" fill="none" stroke="currentColor"/>{geometry.contacts.map((c,i)=>{const p=point(c.longitudeArcsec);return <g key={i}><line x1={own[0]} y1={own[1]} x2={p[0]} y2={p[1]} stroke="currentColor" opacity=".5"/><circle cx={p[0]} cy={p[1]} r="3" fill="currentColor"/></g>})}<circle cx={own[0]} cy={own[1]} r="6" fill="currentColor"/></svg>
    <p>{body}: {geometry.longitudeArcsec}″ · parked shell r={geometry.register.shell.r}, winding K={geometry.register.shell.K}. The drawing converts integers to screen coordinates; the residues retain their exact values.</p>
    <p>Residue lanes: {Object.entries(geometry.register.residues_B8).map(([p,v])=>`${p.replace('mod_','')}: ${v}`).join(' · ')}</p>
    {window.PrimeTheatreViews&&<window.PrimeTheatreViews geometry={geometry} chart={chart} />}
    {geometry.houseDepth?<><label>Position through house {geometry.houseDepth.house}<progress max="1000000" value={geometry.houseDepth.partsPerMillion} /></label><p>{geometry.houseDepth.withinArcsec}″ into a {geometry.houseDepth.spanArcsec}″ house arc. This is a geometric fraction, not a psychological depth score.</p></>:<p>House depth unavailable for this placement or birth time.</p>}
    <ul>{geometry.contacts.map((c,i)=><li key={i}>{body} {c.aspect} {c.body} · separation {c.separationArcsec}″ · {c.phase}</li>)}</ul>
  </>}</details>;
}
Object.assign(window,{MistralSettings,EvolutionPanel,ExactTheatreGeometry});
