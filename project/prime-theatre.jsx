// View adapters from Skyelabz210/prime-resonance, commit
// 8e544954b41321277bd9b12b882ddc00adf446e1, resonance-reading-theatre/components.
// The current admitted ledger supplies all values; no external ranking,
// confidence estimates, simulated audio clock or astrology engine is imported.
function AspectGeometryView({body,contact,target}) {
  const radius=100,cx=140,cy=140,angle=Number(contact.separationArcsec)/3600;
  const a=-Math.PI/2,b=(angle-90)*Math.PI/180;
  const ax=cx+radius*Math.cos(a),ay=cy+radius*Math.sin(a),bx=cx+radius*Math.cos(b),by=cy+radius*Math.sin(b);
  const delta=BigInt(contact.separationArcsec)-BigInt(Math.round(target*3600));
  const orb=delta<0n?-delta:delta;
  return <svg viewBox="0 0 280 280" role="img" aria-label={`${body} ${contact.aspect} ${contact.body}; exact separation ${contact.separationArcsec} arcseconds, orb ${orb} arcseconds`}>
    <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" opacity=".25" />
    <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#a9f6d7" strokeWidth="2" strokeDasharray={contact.phase==='applying'?undefined:'4 4'} />
    <circle cx={ax} cy={ay} r="6" fill="currentColor" /><circle cx={bx} cy={by} r="6" fill="currentColor" />
    <text x={ax} y={ay-14} textAnchor="middle" fill="currentColor" fontSize="11">{body}</text><text x={bx} y={by+22} textAnchor="middle" fill="currentColor" fontSize="11">{contact.body}</text>
    <text x={cx} y={cy-4} textAnchor="middle" fill="currentColor" fontSize="16">{angle.toFixed(4)}°</text><text x={cx} y={cy+16} textAnchor="middle" fill="currentColor" fontSize="10">target {target}° · orb {String(orb)}″</text>
  </svg>;
}
function HouseDepthArc({house}) {
  const fraction=Number(house.partsPerMillion)/1000000,start=-3*Math.PI/4,span=3*Math.PI/2,radius=100;
  const path=end=>{const x=140+radius*Math.cos(end),y=140+radius*Math.sin(end);return `M ${140+radius*Math.cos(start)} ${140+radius*Math.sin(start)} A ${radius} ${radius} 0 ${end-start>Math.PI?1:0} 1 ${x} ${y}`;};
  return <svg viewBox="0 0 280 280" role="img" aria-label={`House ${house.house}; ${house.withinArcsec} arcseconds into its ${house.spanArcsec} arcsecond span`}>
    <path d={path(start+span)} fill="none" stroke="currentColor" opacity=".2" strokeWidth="12" />
    {fraction>0&&<path d={path(start+span*fraction)} fill="none" stroke="#a9f6d7" strokeWidth="12" strokeLinecap="round" />}
    <text x="140" y="132" textAnchor="middle" fill="currentColor" fontSize="22">House {house.house}</text><text x="140" y="158" textAnchor="middle" fill="currentColor" fontSize="14">{(fraction*100).toFixed(1)}%</text>
    <text x="140" y="180" textAnchor="middle" fill="currentColor" fontSize="10">270° gauge · not the actual house arc</text>
  </svg>;
}
function DepthPhaseIndicator({house}) {
  return <label className="prime-depth">House traversal · {house.partsPerMillion}/1,000,000<progress max="1000000" value={house.partsPerMillion} /><span>Geometric position within this house; psychological intensity is not inferred.</span></label>;
}
function PrimeTheatreViews({geometry,chart}) {
  const [selected,setSelected]=React.useState(null);
  const contact=geometry.contacts.find(c=>c.body===selected)||geometry.contacts[0];
  const aspect=contact&&(chart.aspectGrid || []).find(a=>(a.a===geometry.body&&a.b===contact.body)||(a.b===geometry.body&&a.a===contact.body));
  return <section className="prime-theatre-views" aria-label="Prime Resonance theatre views">
    <h3>Resonance theatre · source-linked geometry</h3>
    {geometry.contacts.length>0&&<label>Inspect a planetary contact<select value={contact.body} onChange={e=>setSelected(e.target.value)}>{geometry.contacts.map(c=><option value={c.body} key={c.body}>{geometry.body} {c.aspect} {c.body}</option>)}</select></label>}
    <div className="prime-geometry-pair">{contact&&Number.isFinite(aspect?.angle)&&<AspectGeometryView body={geometry.body} contact={contact} target={aspect.angle} />}{geometry.houseDepth&&<HouseDepthArc house={geometry.houseDepth} />}</div>
    {geometry.houseDepth&&<DepthPhaseIndicator house={geometry.houseDepth} />}
    <small>Adapted from your Prime Resonance theatre. This app supplies the actual admitted positions, exact integer distances and selected house model.</small>
  </section>;
}
Object.assign(window,{PrimeTheatreViews});
