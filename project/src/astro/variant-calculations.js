// Compatible Prime Resonance techniques, computed with this app's ephemeris.
// Constructed composite/directed points are never admitted as observed skies.
import { EPHEMERIS_PLANETS, longitudeProvider } from './transits.js';
import { signedArcsec, jdToDate } from './angles.js';
const RING=1296000n, HALF=648000n, DAY=86400000, YEAR_DAYS=365.25;
const mod=(x,m=RING)=>((x%m)+m)%m;
const MAJOR=[['Conjunction',0n],['Sextile',216000n],['Square',324000n],['Trine',432000n],['Opposition',648000n]];
function coordinate(x) {
  if(typeof x!=='bigint'||x<0n||x>=RING)throw new Error('Expected an integer arcsecond in the ecliptic ring.');
  return x;
}
function chartPositions(chart) {
  if(!chart?.birth || !Number.isFinite(Date.parse(chart.birth.dateISO)))throw new Error('A dated natal chart is required.');
  return EPHEMERIS_PLANETS.map(name=>{
    const p=chart.planets?.find(p=>p.name===name);
    if(!Number.isFinite(p?.lon))throw new Error(`Real natal longitude unavailable: ${name}`);
    return {name,arcsec:mod(BigInt(Math.round(((p.lon%360+360)%360)*3600)))};
  });
}
export function midpointArcsec(a,b) {
  coordinate(a);coordinate(b);
  let difference=mod(b-a);
  if(difference===HALF)return {status:'ambiguous',reason:'Antipodal points have two equally short midpoints.',alternatives:[String(mod(2n*a+HALF,2n*RING)),String(mod(2n*a-HALF,2n*RING))].sort((x,y)=>BigInt(x)<BigInt(y)?-1:1),denominator:'2'};
  if(difference>HALF)difference-=RING;
  return {status:'ready',numerator:String(mod(2n*a+difference,2n*RING)),denominator:'2'};
}
export function compositeChart(chartA,chartB) {
  if(chartA?.timeUnknown||chartB?.timeUnknown)return {status:'unavailable',message:'A precise composite requires both birth times. No midpoint degree is inferred.'};
  const a=chartPositions(chartA),b=chartPositions(chartB);
  const planets=a.map((p,i)=>({name:p.name,aArcsec:String(p.arcsec),bArcsec:String(b[i].arcsec),...midpointArcsec(p.arcsec,b[i].arcsec),house:null,speed:null}));
  const contacts=[];
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){
    const p=planets[i],q=planets[j];if(p.status!=='ready'||q.status!=='ready')continue;
    const delta=mod(BigInt(p.numerator)-BigInt(q.numerator),2n*RING),distance=delta<=RING?delta:2n*RING-delta;
    for(const [aspect,angle] of MAJOR){const error=distance-2n*angle,orb=error<0n?-error:error;if(orb<=7200n)contacts.push({a:p.name,b:q.name,aspect,orbNumerator:String(orb),denominator:'2',phase:'not defined for constructed midpoints'});}
  }
  return {version:1,status:'ready',kind:'midpoint-composite',input:{birthA:{...chartA.birth},birthB:{...chartB.birth}},planets,contacts,
    convention:'Short-arc midpoints of natal longitudes rounded to whole arcseconds; midpoint results retain half-arcsecond precision. Antipodal pairs are withheld. Ptolemaic contacts use a 1° orb. No houses, epoch, retrograde motion or physical ephemeris certificate is assigned to this constructed chart.'};
}
export function solarArcDirections(chart,targetJd,astronomy,{method='true'}={}) {
  if(chart?.timeUnknown)return {status:'unavailable',message:'Solar-arc natal degrees are withheld because birth time is unknown.'};
  if(!['true','naibod'].includes(method))throw new Error('Unsupported solar-arc method.');
  const natal=chartPositions(chart),birthMs=Date.parse(chart.birth.dateISO),targetMs=jdToDate(targetJd).getTime();
  const ageYears=(targetMs-birthMs)/(YEAR_DAYS*DAY),birthJd=birthMs/DAY+2440587.5;
  if(!Number.isFinite(targetJd)||ageYears<0||ageYears>200)throw new Error('Solar-arc target must be within 200 years after birth.');
  let arc,progressedJd=null;
  if(method==='true'){
    const position=longitudeProvider(astronomy);progressedJd=birthJd+ageYears;
    // At age <=200 the progressed Sun advances <360°, so the forward arc is unique.
    const advance=((position('Sun',progressedJd)-position('Sun',birthJd))%1296000+1296000)%1296000;
    arc=mod(BigInt(Math.round(advance)));
  }else{
    // Defined Naibod key: 3548.33 arcseconds / 365.25-day year. Rational until rounding.
    const numerator=BigInt(targetMs-birthMs)*354833n,denominator=31557600000n*100n;
    arc=mod((numerator+denominator/2n)/denominator);
  }
  const planets=natal.map(p=>({name:p.name,natalArcsec:String(p.arcsec),directedArcsec:String(mod(p.arcsec+arc))}));
  const contacts=[];
  for(const p of planets)for(const n of natal){
    const delta=mod(BigInt(p.directedArcsec)-n.arcsec),distance=delta<=HALF?delta:RING-delta;
    for(const [aspect,angle] of MAJOR){const e=distance-angle,orb=e<0n?-e:e;if(orb<=3600n)contacts.push({directedBody:p.name,natalBody:n.name,aspect,orbArcsec:String(orb),directedArcsec:p.directedArcsec,natalArcsec:String(n.arcsec)});}
  }
  contacts.sort((a,b)=>Number(a.orbArcsec)-Number(b.orbArcsec));
  return {version:1,status:'ready',kind:'solar-arc-directions',method,input:{birth:{...chart.birth},targetAt:new Date(targetMs).toISOString()},ageYears,progressedJd,arcArcsec:String(arc),arcsecondsPerYear:method==='naibod'?'3548.33':null,planets,contacts,
    convention:`${method==='true'?'True solar arc: apparent geocentric progressed Sun minus natal Sun, one ephemeris day per 365.25-day year of life.':'Naibod direction: defined constant 59′08.33″ per 365.25-day year.'} The same rounded arc shifts ten natal longitudes. Ptolemaic directed-to-natal contacts use a 1° orb; no exact future contact dates, physical motion, directed houses or psychological score is inferred.`};
}
export function findStations(startJd,endJd,astronomy,{bodies=EPHEMERIS_PLANETS.slice(2),stepDays=1,position=null}={}) {
  if(!Number.isFinite(startJd)||!Number.isFinite(endJd)||endJd-startJd<1||endJd-startJd>366||!Number.isFinite(stepDays)||stepDays<.05||stepDays>1||!Array.isArray(bodies)||!bodies.length||new Set(bodies).size!==bodies.length||bodies.some(b=>!EPHEMERIS_PLANETS.slice(2).includes(b)))throw new Error('Station search requires 1–366 days, a 0.05–1 day step, and distinct Mercury–Pluto bodies.');
  const lon=position||longitudeProvider(astronomy);
  const speed=(body,jd)=>{
    const value=signedArcsec(lon(body,jd+.005)-lon(body,jd-.005))/.01;
    if(!Number.isFinite(value))throw new Error('Invalid ephemeris speed in station search.');
    return value;
  };
  const events=[];
  for(const body of bodies){
    let left=startJd,vl=speed(body,left);
    // Include a zero at the left boundary only if motion changes sign across it.
    if(vl===0)vl=speed(body,left-.001);
    while(left<endJd){
      const right=Math.min(endJd,left+stepDays),vr=speed(body,right);
      if(vr===0||vl*vr<0){
        let lo=vr===0?right:left,hi=right,vlo=vl;
        for(let i=0;i<50&&(hi-lo)*86400>1;i++){
          const mid=(lo+hi)/2,vm=speed(body,mid);
          if(vm===0){lo=hi=mid;break;}
          if(vlo*vm<=0)hi=mid;else{lo=mid;vlo=vm;}
        }
        const jd=(lo+hi)/2,before=speed(body,jd-.02),after=speed(body,jd+.02);
        if(jd>=startJd&&jd<endJd&&before*after<0&&!events.some(e=>e.body===body&&Math.abs(e.jd-jd)<.01))events.push({body,jd,at:jdToDate(jd).toISOString(),direction:after<0?'retrograde':'direct',longitudeArcsec:((lon(body,jd)%1296000)+1296000)%1296000,bracketSeconds:(hi-lo)*86400,speedArcsecPerDay:speed(body,jd),convention:'Zero of central-difference apparent longitude speed (±0.005 day); bracket refined to ≤1 second, not a claim of physical one-second accuracy.'});
      }
      left=right;vl=vr;
    }
  }
  return events.sort((a,b)=>a.jd-b.jd);
}
if(typeof window!=='undefined')window.VariantCalculations={midpointArcsec,compositeChart,solarArcDirections,findStations};
