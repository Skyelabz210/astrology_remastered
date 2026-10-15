import { computeAdmittedRegister } from './exact-api.js';
const RING=1296000n, wrap=x=>((x%RING)+RING)%RING;
export function theatreGeometry(chart,body,ledger) {
  const entry=ledger.find(e=>e.body===body);
  if(!entry)throw new Error('No admitted record for this principal.');
  if(entry.event_id!==`${new Date(chart.birth.dateISO).toISOString()}#${body}`)throw new Error('Geometry ledger belongs to another instant.');
  const register=computeAdmittedRegister(entry),longitude=BigInt(entry.longitude_arcsec),planet=chart.planets.find(p=>p.name===body);
  if(!planet || String(Math.round(((planet.lon%360+360)%360)*3600)%1296000)!==entry.longitude_arcsec)throw new Error('Geometry ledger disagrees with this chart.');
  let houseDepth=null;
  if(!chart.timeUnknown && Number.isInteger(planet.house) && planet.house>=1 && planet.house<=12){
    const cusps=chart.houseCusps || Array.from({length:12},(_,i)=>chart.houseSystemActual==='whole'?((chart.ascSignIdx+i)%12)*30:(chart.asc+i*30)%360);
    if(cusps.length===12 && cusps.every(Number.isFinite)){
      const start=BigInt(Math.round(cusps[planet.house-1]*3600)),end=BigInt(Math.round(cusps[planet.house%12]*3600));
      const span=wrap(end-start),within=wrap(longitude-start);
      if(span>0n && within<=span)houseDepth={house:planet.house,startArcsec:String(wrap(start)),endArcsec:String(wrap(end)),withinArcsec:String(within),spanArcsec:String(span),partsPerMillion:String(within*1000000n/span)};
    }
  }
  const contacts=(chart.aspectGrid || []).filter(a=>a.a===body||a.b===body).flatMap(a=>{
    const other=a.a===body?a.b:a.a,peer=ledger.find(e=>e.body===other);
    if(!peer)return [];
    computeAdmittedRegister(peer);
    if(peer.event_id!==`${new Date(chart.birth.dateISO).toISOString()}#${other}`)throw new Error('Contact ledger belongs to another instant.');
    const delta=wrap(longitude-BigInt(peer.longitude_arcsec)),distance=delta<=648000n?delta:RING-delta;
    return [{body:other,aspect:a.aspect,longitudeArcsec:peer.longitude_arcsec,separationArcsec:String(distance),phase:a.phase || 'unavailable'}];
  });
  return {body,longitudeArcsec:String(longitude),register,houseDepth,contacts};
}
if(typeof window!=='undefined')window.TheatreGeometry={theatreGeometry};
