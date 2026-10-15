const LIVING_PREF_LABELS = [
  ['goals','What are you working toward?'], ['values','What matters most to you?'],
  ['learningStyle','How do you learn best?'], ['decisionStyle','How do you make difficult decisions?'],
  ['attention','What helps or interrupts your focus?'], ['routines','Which routines help you?'],
  ['socialContext','Which relationships or environments shape your days?'],
];
function useLivingAvatar(chart, context) {
  const store = window.LivingProfile;
  const owner = store.ownerKey(chart.birth);
  const baselineIdentity = window.ReadingRuns.evidenceFingerprint([owner, chart.timeUnknown, chart.houseSystemActual, chart.birth.sect, chart.birth.orbScale, chart.planets.map(p => [p.name,p.lon,p.house]), context.input.chapters]);
  const [profile,setProfile] = React.useState(() => store.loadProfile(chart.birth));
  const [error,setError] = React.useState('');
  React.useEffect(() => {
    const refresh = () => setProfile(store.loadProfile(chart.birth));
    const off = store.subscribe(refresh);
    const current = store.ensureProfile(chart,context);
    if (!current) setError('This browser could not save your avatar. Export your profile to keep a copy.');
    refresh();
    return off;
  }, [owner, baselineIdentity, store]);
  return { profile, error, setError };
}
function LivingAvatarSummary({chart,onOpen}) {
  const store = window.LivingProfile;
  const [profile,setProfile] = React.useState(() => store.loadProfile(chart.birth));
  React.useEffect(() => {
    setProfile(store.loadProfile(chart.birth));
    return store.subscribe(() => setProfile(store.loadProfile(chart.birth)));
  }, [store, store.ownerKey(chart.birth)]);
  if (!profile) return null;
  const progress = store.summarizeProfile(profile).engagement;
  return <div className="living-summary"><span>Your avatar · Level {progress.level} · {progress.xp} XP</span><button type="button" className="hdr-pill" onClick={onOpen}>Continue your avatar</button></div>;
}
function LivingBehavioralAvatar({chart,context,local}) {
  const store = window.LivingProfile;
  const {profile,error,setError} = useLivingAvatar(chart,context);
  const [editing,setEditing] = React.useState(false);
  const [preferences,setPreferences] = React.useState({});
  const [domain,setDomain] = React.useState('Sun');
  const [kind,setKind] = React.useState('check-in');
  const [rating,setRating] = React.useState('');
  const [agreement,setAgreement] = React.useState('mixed');
  const [note,setNote] = React.useState('');
  const [status,setStatus] = React.useState('');
  const [confirmClear,setConfirmClear] = React.useState(false);
  const owner = store.ownerKey(chart.birth);
  React.useEffect(() => { setNote('');setRating('');setStatus('');setEditing(false);setConfirmClear(false); },[owner]);
  if (!profile) return <section className="living-avatar"><h2>Your living avatar</h2><p role="status">{error || status || 'Building your first avatar from your chart…'}</p><button type="button" className="hdr-pill" onClick={()=>{if(store.ensureProfile(chart,context)){setStatus('Avatar created from your chart.');setError('');}else setError('This browser could not save your avatar.');}}>Create my avatar</button></section>;
  const summary = store.summarizeProfile(profile), engagement = summary.engagement;
  const observations = profile.observations || [];
  const prefs = profile.selfReported?.preferences || {};
  const selected = local.sections.find(s=>s.body===domain);
  const persistObservation = event => {
    event.preventDefault();
    const saved = store.addObservation(chart.birth,{domain,kind,rating:rating===''?null:Number(rating),agreement:kind==='reading-feedback'?agreement:null,note,contextAt:context.at,readingId:`reading:${window.ReadingRuns.evidenceFingerprint([context.at,context.input.birth,context.input.houseSystemActual,context.input.settings.orbScale,context.input.settings.sect,context.input.chapters])}`,source:'user'});
    if (!saved) { setError('Your check-in could not be saved. Your entry is still here.');return; }
    setNote('');setRating('');setStatus('Saved. Your avatar now includes this observation.');setError('');
  };
  return <section className="living-avatar" aria-labelledby="living-avatar-title">
    <div className="living-avatar-head"><div><p className="living-kicker">Your evolving astrological avatar</p><h2 id="living-avatar-title">{chart.birth.subjectName || 'You'} · Level {engagement.level}</h2></div><div className="living-xp"><strong>{engagement.xp} XP</strong><span>{engagement.participationDays} reflection days · {observations.length} observations</span></div></div>
    <p>Your chart starts the story. Your goals, experiences and corrections shape how this avatar grows. XP rewards participation, including disagreement with a reading.</p>
    <div className="avatar-orbit" role="img" aria-label="Five linked astrological domains: motivation, emotional needs, communication, connection and action">
      <svg viewBox="0 0 360 260" aria-hidden="true"><circle cx="180" cy="125" r="82" fill="none" stroke="currentColor" strokeOpacity=".3"/>{local.sections.map((s,i)=>{const angle=-Math.PI/2+i*2*Math.PI/5;const x=180+82*Math.cos(angle),y=125+82*Math.sin(angle);return <g key={s.body}><line x1="180" y1="125" x2={x} y2={y} stroke="currentColor" strokeOpacity=".4"/><circle cx={x} cy={y} r="20" fill="#24302a" stroke="currentColor"/><text x={x} y={y+5} textAnchor="middle" fontSize="13" fill="currentColor">{s.body}</text></g>})}<circle cx="180" cy="125" r="30" fill="#24302a" stroke="currentColor"/><text x="180" y="130" textAnchor="middle" fontSize="14" fill="currentColor">L{engagement.level}</text></svg>
    </div>
    {prefs.goals && <p><strong>Your current aim:</strong> {prefs.goals}</p>}
    <div className="avatar-quests">{local.sections.map(s=>{const entries=observations.filter(o=>o.domain===s.body);const last=entries.at(-1);return <article key={s.body}><h3>{s.title}</h3><p>{s.anchor.text}</p><p>{s.falsifier.hypothesis}</p>{last && <p><strong>Your latest observation:</strong> {last.note || (last.rating!==null?`Self-rating ${last.rating}/4`:last.agreement)}</p>}<a href={`#behavior-${s.body}`}>Explore the chart evidence</a><button type="button" className="hdr-pill" onClick={()=>{setDomain(s.body);document.getElementById('avatar-check-in')?.scrollIntoView({block:'center'});document.getElementById('avatar-note')?.focus();}}>Take this reflection quest</button></article>})}</div>
    <details><summary>Your goals, preferences and cognitive habits</summary><p>Describe these in your own words. They personalize your avatar; the app does not infer cognitive ability from your chart.</p>{LIVING_PREF_LABELS.map(([key,label])=>prefs[key] && <p key={key}><strong>{label}</strong><br/>{prefs[key]}</p>)}<button type="button" className="hdr-pill" onClick={()=>{setPreferences({...prefs});setEditing(!editing);}}>Personalize your avatar</button>
      {editing && <form className="avatar-preferences" onSubmit={event=>{event.preventDefault();const saved=store.updatePreferences(chart.birth,preferences);if(saved){setEditing(false);setStatus('Your goals and preferences are saved.');setError('');}else setError('Preferences could not be saved. Your entries are still here.');}}>{LIVING_PREF_LABELS.map(([key,label])=><label key={key}>{label}<textarea maxLength={1000} value={preferences[key]||''} onChange={event=>setPreferences({...preferences,[key]:event.target.value})}/></label>)}<button type="submit" className="hdr-pill">Save my goals and preferences</button></form>}
    </details>
    <form id="avatar-check-in" className="avatar-check-in" onSubmit={persistObservation}><h3>Check in and evolve your avatar</h3><div className="avatar-fields"><label>Domain<select value={domain} onChange={event=>setDomain(event.target.value)}>{local.sections.map(s=><option key={s.body} value={s.body}>{s.title}</option>)}<option value="cognitive">Focus, learning and decisions</option><option value="preferences">Goals and daily habits</option></select></label><label>Entry type<select value={kind} onChange={event=>setKind(event.target.value)}><option value="check-in">Experience check-in</option><option value="reading-feedback">Feedback on this reading</option></select></label>
      {kind==='reading-feedback' && <label>How did the reading fit?<select value={agreement} onChange={event=>setAgreement(event.target.value)}><option value="fits">Fits my experience</option><option value="mixed">Partly fits</option><option value="does-not-fit">Does not fit</option></select></label>}
      <label>How strongly did this pattern show up? (optional)<select value={rating} onChange={event=>setRating(event.target.value)}><option value="">No rating</option>{[0,1,2,3,4].map(n=><option key={n} value={n}>{n}{n===0?' · not observed':n===4?' · strongly observed':''}</option>)}</select></label></div>
      {selected && <p className="avatar-prompt">{selected.falsifier.hypothesis}</p>}<label htmlFor="avatar-note">What happened? Include an example or a counterexample.</label><textarea id="avatar-note" value={note} maxLength={2000} onChange={event=>setNote(event.target.value)} placeholder="An experience, a correction, or something to try next…"/><button type="submit" className="hdr-pill" disabled={!note.trim() && rating==='' && kind!=='reading-feedback'}>Save check-in</button>
      <p>Stored on this device. Repeating the same domain on one day does not farm XP. Your input is not sent to an AI provider unless you enable sharing below.</p>
    </form>
    <p role="status">{error || status}</p>
    <details><summary>Your observation journal ({observations.length})</summary>{observations.slice(-50).reverse().map(entry=><article key={entry.id}><h3>{entry.domain} · {new Date(entry.at).toLocaleDateString()}</h3><p>{entry.note}</p>{entry.rating!==null && <p>Self-rating {entry.rating}/4</p>}{entry.agreement && <p>Reading feedback: {entry.agreement}</p>}<button type="button" className="hdr-pill" onClick={()=>{if(!store.deleteObservation(chart.birth,entry.id))setError('This entry could not be removed.');else setStatus('Observation removed from the living avatar.');}}>Remove observation</button></article>)}</details>
    <details><summary>Avatar history and data controls</summary><p>Created {new Date(profile.createdAt).toLocaleString()} · revision {profile.revision}. Updated {new Date(profile.updatedAt).toLocaleString()}.</p><p>This avatar combines sourced chart evidence with your own reports. Mathematical lanes are exact after quantization; their psychological interpretation remains experimental. Saved readings may retain earlier snapshots. ZIP export includes your avatar and journal.</p><button type="button" className="hdr-pill" onClick={()=>{if(!confirmClear){setConfirmClear(true);return;}if(store.clearProfile(chart.birth)){setConfirmClear(false);setStatus('Living avatar removed. A new chart run can create a fresh baseline.');}else setError('Avatar could not be removed.');}} onBlur={()=>setConfirmClear(false)}>{confirmClear?'Confirm remove avatar and journal':'Remove avatar and journal'}</button></details>
  </section>;
}
Object.assign(window,{LivingBehavioralAvatar,LivingAvatarSummary});
