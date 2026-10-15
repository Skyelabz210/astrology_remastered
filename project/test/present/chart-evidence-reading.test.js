// Exercise the shared evidence through the actual card, voice and export
// composers. The controlled geometry makes a non-Sun relationship and a
// sub-degree orb observable without relying on prose snapshots.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as BehavioralProfile from '../../src/present/behavioral-profile.js';
import * as AstroCore from '../../src/present/astro-core.js';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

function sandbox() {
  const sb = { BehavioralProfile, React: { useState: () => [null, () => {}], useEffect() {}, useCallback: fn => fn, useMemo: fn => fn() } };
  sb.window = sb;
  sb.ZODIAC = SIGNS.map((name,i) => ({ name, element: ['Fire','Earth','Air','Water'][i % 4], modality: ['Cardinal','Fixed','Mutable'][i % 3] }));
  vm.createContext(sb);
  for (const name of ['readings.jsx','agent.jsx','narrative.jsx']) {
    vm.runInContext(readFileSync(new URL(`../../${name}`,import.meta.url),'utf8'),sb,{ filename: name });
  }
  return sb;
}

function fixture() {
  const planets = [['Sun',14 + 23/60 + 7/3600],['Moon',134 + 51/60 + 7/3600],['Mercury',65],['Mars',245],['Saturn',104 + 24/60 + 19/3600]].map(([name,lon],i) => {
    const arcsec = Math.round(lon * 3600), sign = Math.floor(lon / 30);
    return { name, lon, arcsec, sign, degInSign: lon % 30, house: i + 1, speed: i === 4 ? -0.05 : 1 + i,
      retrograde: i === 4, residues: { r2:arcsec%2,r3:arcsec%3,r5:arcsec%5,r7:arcsec%7,r11:arcsec%11,r13:arcsec%13 } };
  });
  const cards = planets.map(p => ({ idx:p.sign,name:SIGNS[p.sign],house:p.house,
    element:['Fire','Earth','Air','Water'][p.sign%4],modality:['Cardinal','Fixed','Mutable'][p.sign%3],
    principal:p,tenants:[p],ruler:'Mars',dignity:AstroCore.dignityFor(p.name,p.sign),
    term:AstroCore.termRuler(p.sign,p.degInSign),face:AstroCore.faceRuler(p.sign,p.degInSign),
    aspect:p.name==='Sun' ? null : AstroCore.nearestAspect(p.lon-planets[0].lon),
    resonance:0.5,laneR11:0,laneR13:0 }));
  return { planets,cards,timeUnknown:false,isDayChart:true,ascSignIdx:0,houseSystemActual:'whole',
    birth:{dateISO:'2020-04-03T12:00:00Z',lat:35,lng:-79,tz:'UTC',sect:'auto'},
    aspectGrid:[
      {a:'Sun',b:'Moon',aspect:'Trine',angle:120,orb:28/60,maxOrb:7,phase:'applying',family:'classical'},
      {a:'Sun',b:'Saturn',aspect:'Square',angle:90,orb:72/3600,maxOrb:7,phase:'separating',family:'classical'},
      {a:'Mercury',b:'Mars',aspect:'Opposition',angle:180,orb:0,maxOrb:8,phase:'exact',family:'cardinal'},
    ] };
}

export function run() {
  const rows = [], t = (name,ok,detail='') => rows.push({name,ok:!!ok,detail});
  const sb = sandbox(), chart = fixture(), sun = chart.cards[0], mercury = chart.cards[2];
  const reading = sb.readingFor(sun,chart), text = reading.body.map(line => line.text).join(' ');
  t('local card carries the five shared evidence fields', ['anchor','tension','trajectory','falsifier','resonance'].every(field => reading.evidence[field]));
  t('anchor includes this chart degree to the displayed arcsecond', text.includes('14°23′07″ Aries'));
  t('observed orb differs from the allowed orb', text.includes('0°28′00″') && !/Sun-Moon[^.]*orb 7°/.test(text));
  t('every admitted natal connection appears once in aspect rows', reading.body.filter(line => line.field === 'aspect').length === 2
    && reading.body.filter(line => line.field === 'aspect' && /Sun-Moon/.test(line.text)).length === 1);
  t('a planet does not acquire a self-aspect', !reading.evidence.aspects.some(a => a.other === 'Sun'));
  const rulerReading = sb.readingFor({...sun,name:'Leo',idx:4,tenants:[],ruler:'Sun'},chart);
  t('empty sign sectors explicitly explain ruler delegation', rulerReading.body.some(line => /Leo is an untenanted sign sector.*sign ruler Sun/.test(line.text))
    && rulerReading.evidence.anchor.sign === 'Aries');
  const mercuryReading = sb.readingFor(mercury,chart);
  t('non-Sun natal relationships reach the ordinary reading', mercuryReading.body.some(line => line.field === 'aspect' && /Mercury-Mars Opposition.*0°00′00″.*exact/.test(line.text)));
  t('linked placements retain the target reading index', mercuryReading.evidence.resonance.some(r => r.body === 'Mars' && r.cardIdx === chart.cards[3].idx));
  t('no supplied search produces an explicit unavailable trajectory', reading.evidence.trajectory.status === 'unavailable'
    && /unavailable|not searched/i.test(reading.evidence.trajectory.text) && !/\d{4}-\d{2}-\d{2}T/.test(reading.evidence.trajectory.text));
  t('the observation protocol includes counterexamples and rejection', reading.body.some(line => line.field === 'falsifier' && /counterexample/.test(line.text) && /set this interpretation aside/.test(line.text)));
  t('symbolic interpretation is labeled separately from placement facts', reading.body.some(line => line.field === 'tension' && line.text.startsWith('Symbolic interpretation:')));
  t('computed solar distance and signed velocity reach the ordinary card', mercuryReading.body.some(line => line.field === 'condition' && line.text.startsWith('Solar condition:'))
    && mercuryReading.body.some(line => line.field === 'condition' && line.text.startsWith('Direct motion,')));
  t('local spoken card uses exactly the displayed local reading', sb.narrativeForCard(sun,chart) === text);
  const md = sb.buildReadingMarkdown(chart,chart.cards);
  t('card export preserves the same factual and observation prose', md.includes(text));
  let generationCalls = 0;
  sb.claude = { complete: async () => { generationCalls += 1; return ''; } };
  sb.remember(sb.cacheKey(sun,chart),'Cached symbolic interpretation of this Sun.');
  const cachedMarkdown = sb.buildReadingMarkdown(chart,chart.cards);
  t('cached AI prose retains its computed basis and falsifier in the exported reading',
    cachedMarkdown.includes('Cached symbolic interpretation of this Sun.')
      && cachedMarkdown.includes('Computed basis and observation checks')
      && cachedMarkdown.includes('14°23′07″ Aries')
      && cachedMarkdown.includes(reading.evidence.falsifier.protocol));
  t('adding computed evidence to cached AI exports does not make an interpreter call',generationCalls === 0);

  const second = structuredClone(chart);
  second.planets[0].lon += 0.01;
  const secondText = sb.readingFor(second.cards[0],second).body.map(line => line.text).join(' ');
  t('same-sign charts with different degrees produce different cards', secondText !== text && secondText.includes('14°23′43″ Aries'));

  const unknown = { ...chart,timeUnknown:true };
  const unknownReading = sb.readingFor(sun,unknown), unknownText = unknownReading.body.map(line => line.text).join(' ');
  t('unknown birth time withholds house numbers and sect from rich cards', unknownReading.evidence.anchor.house === null && !/house\s+(?:\d|[ivx]+\b)/i.test(unknownText) && !/day chart|night chart/.test(unknownText));
  t('unknown birth time preserves the same withholding in local speech', sb.narrativeForCard(sun,unknown) === unknownText);
  t('unknown-time card describes the uncertainty of displayed degrees', unknownText.includes('assumed birth time') && unknownText.includes('do not establish birth-time or astronomical accuracy'));

  const searched = { ...chart,readingContext:{at:'2026-10-12T12:00:00.000Z',evidence:{behavioralTrajectories:{status:'ready',value:{status:'ready',at:'2026-10-12T12:00:00.000Z',horizonDays:60,scope:'Controlled test crossing',byBody:{Sun:[{
    transitPlanet:'Mars',natalPlanet:'Sun',aspect:'Conjunction',exactHitJd:2461327.020833333,exactHitDate:'2026-10-13T12:30:00.000Z',orbArcsec:120,
  }]}}}}}};
  const searchedReading = sb.readingFor(sun,searched);
  t('located transit date reaches the local card', searchedReading.body.some(line => line.field === 'trajectory' && line.text.includes('2026-10-13T12:30:00.000Z')));
  t('search dates disappear when the natal time becomes unknown', !sb.readingFor(sun,{...searched,timeUnknown:true}).body.some(line => /2026-10-13/.test(line.text)));

  const fallback = sb.readingFor({ ...mercury,aspect:{name:'Trine',sep:0.2,orb:7,family:'classical',angle:120} },{timeUnknown:false});
  t('legacy Sun-relative reading labels observed and maximum orb correctly', fallback.body.some(line => /orb 0°12′00″ \(allowed orb 7°00′00″/.test(line.text)));
  t('override narration does not misstate the Sun horizon', /selected day chart convention/.test(sb.narrativeOpening({...chart,sectSource:'explicit override'})));
  t('void-of-course narration does not claim a settled life event', !/finished being decided/.test(sb.narrativeClosing({...chart,voidOfCourse:{isVoc:true}})));
  return rows;
}
