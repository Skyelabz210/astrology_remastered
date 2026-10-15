import * as Astronomy from 'astronomy-engine';
import { behavioralProfile, chartEvidenceForBody, behavioralTrajectories } from '../../src/present/behavioral-profile.js';
import { longitudeProvider } from '../../src/astro/transits.js';
import { aspectError } from '../../src/astro/traditional.js';
export function run() {
  const rows = [], t = (name,ok,detail='') => rows.push({name,ok:!!ok,detail});
  const birth = { dateISO:'1980-10-21T21:31:00Z',lat:35.1408,lng:-79.0058,subjectName:'Alpha',houseSystem:'whole' };
  const planets = [
    {name:'Sun',lon:15,sign:0,house:6,speed:1}, {name:'Moon',lon:105,sign:3,house:9,speed:13},
    {name:'Mercury',lon:28,sign:0,house:6,speed:-1}, {name:'Venus',lon:47,sign:1,house:7,speed:1.2},
    {name:'Mars',lon:311,sign:10,house:4,speed:.6}, {name:'Saturn',lon:194,sign:6,house:12,speed:.1},
  ];
  const chart = {birth,planets,isDayChart:true,houseSystemActual:'whole',
    cards:planets.map((principal,idx)=>({principal,idx})),
    aspectGrid:[{a:'Sun',b:'Moon',aspect:'Square',angle:90,orb:0,phase:'exact'},{a:'Sun',b:'Saturn',aspect:'Opposition',angle:180,orb:1,phase:'applying'}]};
  const profile = behavioralProfile(chart), sun = profile.sections.find(s=>s.body==='Sun');
  t('anchor names actual degree and selected house',sun.anchor.text.includes('15°00′00″ Aries') && sun.anchor.house===6 && sun.anchor.houseSystem==='whole');
  t('Sun in Aries remains exalted in sixth house',sun.conditions.dignity.kind==='exaltation' && sun.text.includes('house placement does not change essential dignity'));
  t('natal aspect links include exact orb and phase',sun.aspects.some(a=>a.other==='Saturn' && a.orbText==='1°00′00″' && a.phase==='applying'));
  t('linked placement retains its own natal source',sun.facts.some(f=>f.includes('Saturn at 14°00′00″ Libra')));
  t('resonance references actual peer card',sun.resonance.find(r=>r.body==='Saturn').cardIdx===5);
  t('integer separation uses shorter circular distance',sun.resonance.find(r=>r.body==='Saturn').separationArcsec===String(179*3600));
  t('integer lanes are exact remainders after quantization',sun.resonance.every(r=>r.lanes.every(l=>BigInt(r.separationArcsec)%BigInt(l.prime)===BigInt(l.residue))));
  t('observation includes disconfirming experience',sun.falsifier.counterexample.includes('set this interpretation aside'));
  t('unsearched timeline cannot invent a date',sun.trajectory.hits.length===0 && sun.trajectory.status==='unavailable');
  const other = behavioralProfile({...chart,planets:planets.map(p=>p.name==='Sun'?{...p,lon:24,house:10}:p)});
  t('same Sun sign does not produce identical personal cards',other.sections[0].source===sun.source && other.sections[0].text!==sun.text && other.sections[0].anchor.house===10);
  const unknown = behavioralProfile({...chart,timeUnknown:true});
  t('unknown-time profile withholds houses and sect',unknown.sections.every(s=>s.anchor.house===null && s.conditions.sect===null));
  t('unknown-time degree uncertainty reaches every domain',unknown.sections.every(s=>s.uncertainty.includes('assumed birth time')));
  t('profile preserves named owner',profile.ownerBirth.subjectName==='Alpha' && profile.ownerBirth!==birth);
  t('structured profile fields retained alongside text',profile.version===2 && profile.sections.every(s=>s.anchor && s.tension && s.trajectory && s.falsifier && Array.isArray(s.resonance)));
  const jd = 2461325;
  const timeline = behavioralTrajectories(chart,jd,Astronomy);
  const position = longitudeProvider(Astronomy);
  t('real ephemeris supplies bounded chronological contacts',timeline.status==='ready' && Object.values(timeline.byBody).every(hits=>hits.length<=3 && hits.every((h,i)=>h.exactHitJd>=jd && h.exactHitJd<=jd+60 && (!i || hits[i-1].exactHitJd<=h.exactHitJd))));
  t('every supplied exact date satisfies independently sampled aspect geometry',Object.values(timeline.byBody).flat().every(h=>Math.abs(aspectError(position(h.transitPlanet,h.exactHitJd),planets.find(p=>p.name===h.natalPlanet).lon*3600,h.angle*3600))<1));
  const dated = chartEvidenceForBody(chart,'Sun',{at:timeline.at,evidence:{behavioralTrajectories:{status:'ready',value:timeline}}});
  t('profile cites its computed dates with transit scope',dated.trajectory.hits.length>0 && dated.trajectory.text.includes(dated.trajectory.hits[0].exactHitDate) && dated.trajectory.text.includes('Transiting'));
  const withheld = behavioralTrajectories({...chart,timeUnknown:true},jd,Astronomy);
  t('unknown-time search supplies no exact date',withheld.status==='unavailable' && Object.keys(withheld.byBody).length===0);
  t('missing ephemeris supplies no made-up trajectory',behavioralTrajectories(chart,jd,null).status==='unavailable');
  t('longitude rounding wraps at full circle',chartEvidenceForBody({...chart,planets:[{name:'Sun',lon:359.999999,sign:11,house:1}]},'Sun').anchor.arcsec===0);
  t("rounding display never changes the astronomical sign",chartEvidenceForBody({...chart,planets:[{name:"Sun",lon:359.999999,sign:11,house:1}]},"Sun").anchor.sign==="Pisces");
  const reports = { ownerKey: JSON.stringify([new Date(birth.dateISO).toISOString(),birth.lat,birth.lng]), preferences:{goals:'Finish a difficult project'},domains:[{body:'Sun',count:1,agreement:{fits:0,mixed:0,'does-not-fit':1},history:[{note:'I planned carefully instead of rushing',source:'user'}]}] };
  const personal = behavioralProfile(chart,{evidence:{livingProfile:{status:'ready',value:reports}}});
  t('personal feedback changes prose without changing natal facts',personal.sections[0].anchor.lon===sun.anchor.lon && personal.sections[0].text.includes('I planned carefully instead of rushing'));
  t('counterexamples remain visible and personalize the quest',personal.sections[0].feedback.agreement['does-not-fit']===1 && personal.sections[0].falsifier.text.includes('Finish a difficult project'));
  const foreign = behavioralProfile(chart,{evidence:{livingProfile:{status:'ready',value:{...reports,ownerKey:'foreign'}}}});
  t('another owner cannot personalize this chart',foreign.sections.every(s=>s.feedback===null));
  return rows;
}
