import * as Astronomy from 'astronomy-engine';
import { midpointArcsec, compositeChart, solarArcDirections, findStations } from '../../src/astro/variant-calculations.js';
import { decomposeInteger, inspectChartRegister } from '../../src/present/register-inspector.js';
import { prepareSourcePack } from '../../src/ai/source-pack.js';
import { chartEvidenceForBody } from '../../src/present/behavioral-profile.js';

export async function run() {
  const rows=[], t=(name,ok,detail='')=>rows.push({name,ok:!!ok,detail});
  const rejects=fn=>{try{fn();return false;}catch{return true;}};
  const deg=n=>BigInt(n)*3600n;
  const wrap=midpointArcsec(deg(350),deg(10));
  t('composite midpoint follows short arc across Aries',wrap.numerator==='0');
  t('midpoint is independent of partner order',JSON.stringify(wrap)===JSON.stringify(midpointArcsec(deg(10),deg(350))));
  t('odd arcsecond sums preserve a half arcsecond',midpointArcsec(0n,1n).numerator==='1'&&midpointArcsec(0n,1n).denominator==='2');
  t('antipodal pairs are explicitly ambiguous',midpointArcsec(0n,648000n).status==='ambiguous');
  t('midpoint rejects floating and out-of-ring coordinates',rejects(()=>midpointArcsec(1.5,0n))&&rejects(()=>midpointArcsec(1296000n,0n)));
  for(let a=0n;a<1296000n;a+=7391n){
    const b=(a*19n+731n)%1296000n,m=midpointArcsec(a,b),n=midpointArcsec(b,a);
    t(`symmetric rational midpoint ${a}`,JSON.stringify(m)===JSON.stringify(n));
  }
  const birth={dateISO:'2000-01-01T12:00:00Z',lat:29.4,lng:-98.5,houseSystem:'whole'};
  const names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  const jd=2451545, position=(body,time)=>Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[body],new Date((time-2440587.5)*86400000),true)).elon;
  const chart={birth,jd,planets:names.map(name=>({name,lon:position(name,jd),sign:Math.floor(position(name,jd)/30)})),aspectGrid:[]};
  const partner={...chart,birth:{...birth,dateISO:'2001-06-01T12:00:00Z'},planets:chart.planets.map(p=>({...p,lon:(p.lon+20)%360}))};
  const composite=compositeChart(chart,partner);
  t('composite has ten derived points and both owners',composite.planets.length===10&&composite.input.birthA.dateISO!==composite.input.birthB.dateISO);
  t('composite never presents constructed positions as ephemeris records',composite.kind==='midpoint-composite'&&composite.planets.every(p=>p.house===null&&p.speed===null)&&!('ledger' in composite));
  t('unknown-time composite withholds precise output',compositeChart({...chart,timeUnknown:true},partner).status==='unavailable');
  const arc=solarArcDirections(chart,jd+40*365.25,Astronomy);
  const expected=((position('Sun',jd+40)-position('Sun',jd)+360)%360)*3600;
  t('true solar arc uses real progressed Sun at one day per year',arc.progressedJd===jd+40&&Math.abs(Number(arc.arcArcsec)-expected)<=.5);
  t('same solar arc is applied to every natal body',arc.planets.every(p=>(BigInt(p.directedArcsec)-BigInt(p.natalArcsec)+1296000n)%1296000n===BigInt(arc.arcArcsec)));
  const reflection=chartEvidenceForBody(chart,'Sun',{evidence:{solarArc:{status:'ready',value:arc}}});
  t('owned directions reach the behavioral reflection',reflection.directions?.arcArcsec===arc.arcArcsec&&reflection.text.includes('solar-arc construction'));
  const foreignArc={...arc,input:{...arc.input,birth:partner.birth}};
  t('another birth record cannot supply behavioral directions',chartEvidenceForBody(chart,'Sun',{evidence:{solarArc:{status:'ready',value:foreignArc}}}).directions===null);
  const naibod=solarArcDirections(chart,jd+100*365.25,Astronomy,{method:'naibod'});
  t('Naibod uses the disclosed 59m08.33s constant',naibod.arcArcsec==='354833'&&naibod.arcsecondsPerYear==='3548.33');
  t('birth instant has zero true solar arc',solarArcDirections(chart,jd,Astronomy).arcArcsec==='0');
  const fractionalJd=jd+12345.3456789;
  t('live fractional JD retains the exact frozen context timestamp',solarArcDirections(chart,fractionalJd,Astronomy).input.targetAt===new Date((fractionalJd-2440587.5)*86400000).toISOString());
  t('unknown time directions withheld',solarArcDirections({...chart,timeUnknown:true},jd+365.25,Astronomy).status==='unavailable');
  t('directions reject pre-birth, excessive age and unsupported method',rejects(()=>solarArcDirections(chart,jd-1,Astronomy))&&rejects(()=>solarArcDirections(chart,jd+201*365.25,Astronomy))&&rejects(()=>solarArcDirections(chart,jd,Astronomy,{method:'invented'})));
  const root=2460000.345678;
  const synthetic=(body,time)=>1295990+(time-root)**2*200;
  const stations=findStations(root-1,root+1,null,{bodies:['Mercury'],position:synthetic});
  t('station is refined rather than returned at sample date',stations.length===1&&Math.abs(stations[0].jd-root)*86400<=1);
  t('retrograde-to-direct station has correct direction',stations[0]?.direction==='direct');
  t('station bracket is at most a second wide',stations[0]?.bracketSeconds<=1);
  t('station intervals exclude a root exactly at their end',findStations(root-1,root,null,{bodies:['Mercury'],position:synthetic}).length===0);
  t('station intervals include a reversal at their start',findStations(root,root+1,null,{bodies:['Mercury'],position:synthetic}).length===1);
  t('station search rejects zero step, reversed window and unsupported body',rejects(()=>findStations(root,root+1,null,{stepDays:0,position:synthetic}))&&rejects(()=>findStations(root+1,root,null,{position:synthetic}))&&rejects(()=>findStations(root,root+1,null,{bodies:['Sun'],position:synthetic})));
  const real=findStations(2460680.5,2460800.5,Astronomy,{bodies:['Mercury']});
  t('real ephemeris locates both March–April 2025 Mercury stations',real.some(s=>s.at.startsWith('2025-03-15')&&s.direction==='retrograde')&&real.some(s=>s.at.startsWith('2025-04-07')&&s.direction==='direct'),JSON.stringify(real));
  for(const s of real)t(`station independently changes speed sign ${s.at}`,Math.sign(position('Mercury',s.jd-.02)-position('Mercury',s.jd-.03))!==Math.sign(position('Mercury',s.jd+.03)-position('Mercury',s.jd+.02)));
  for(const x of ['0','-1','35113','-35113','123456789012345678901234567890']){
    const d=decomposeInteger(x,'2,3,5,7,11,13,17,19');
    t(`CRAM decomposition round trips signed integer ${x}`,d.reconstructed===x&&d.exact&&d.rows.every(r=>r.ok));
    t(`centered transport retains winding ${x}`,BigInt(d.centered.r)+BigInt(d.centered.K)*BigInt(d.modulus)===BigInt(x));
  }
  t('composite coprime moduli are supported',decomposeInteger('35113','36,37').exact);
  t('unsafe bases and malformed integers fail before computation',rejects(()=>decomposeInteger('3','6,8'))&&rejects(()=>decomposeInteger('3',''))&&rejects(()=>decomposeInteger('3','1,7'))&&rejects(()=>decomposeInteger('3.5','3,7'))&&rejects(()=>decomposeInteger('3','7,7')));
  const pack=await prepareSourcePack(chart,Astronomy),register=inspectChartRegister(chart,'Sun',pack.ledger);
  t('chart inspector uses admitted source and canonical parked split',register.register.kind==='HCRM_REGISTER_V2'&&register.register.shell.split==='parked'&&register.decomposition.exact);
  t('inspector refuses another chart instant',rejects(()=>inspectChartRegister({...chart,birth:partner.birth},'Sun',pack.ledger)));
  t('inspector refuses changed displayed longitude',rejects(()=>inspectChartRegister({...chart,planets:chart.planets.map(p=>p.name==='Sun'?{...p,lon:0}:p)},'Sun',pack.ledger)));
  t('inspector withholds unknown-time exact chart lanes',rejects(()=>inspectChartRegister({...chart,timeUnknown:true},'Sun',pack.ledger)));
  return rows;
}
