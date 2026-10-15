import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as ReadingRuns from '../../src/astro/reading-runs.js';

const source = transformSync(readFileSync(new URL('../../synastry-view.jsx', import.meta.url), 'utf8'), { loader: 'jsx' }).code;
const birthA = { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058, tz: 'America/New_York', subjectName: 'Owner' };
const birthB = { dateISO: '1990-03-15T12:30:00Z', lat: 29.4241, lng: -98.4936, tz: 'America/Chicago', subjectName: 'Partner' };
const jd = date => new Date(date).getTime() / 86400000 + 2440587.5;

function rig() {
  const data = new Map(), events = [], tasks = [], slots = [], effects = [], personalContexts = new Map(), requests = [];
  const provider = { available:true, model:'qwen/one:free', generation:1 };
  let cursor = 0, dirty = false, tree, props, aspectMode = false, now = new Date('2026-10-14T12:00:00Z'), failStorage = false, failBody = null;
  const storage = { getItem: key => data.get(key) || null, setItem(key,value) { if (failStorage) throw new Error('Full storage'); data.set(key,value); } };
  const runs = { ...ReadingRuns, loadRuns: (_,owner=null) => ReadingRuns.loadRuns(storage,owner),
    saveRun: (_,run) => ReadingRuns.saveRun(storage,run),
    attachEvidence: (_,id,section,value,owner) => ReadingRuns.attachEvidence(storage,id,section,value,owner) };
  const same = (a,b) => a && b && a.length === b.length && a.every((v,i) => v === b[i]);
  const React = {
    Fragment: Symbol('fragment'), createElement: (type,p,...children) => ({ type, props: p || {}, children }),
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i],value => { const next = typeof value === 'function' ? value(slots[i]) : value;
        if (next !== slots[i]) { slots[i] = next; dirty = true; } }]; },
    useRef(init) { const i = cursor++; if (!(i in slots)) slots[i] = { current:init }; return slots[i]; },
    useMemo(fn,deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps,deps)) slots[i] = { deps,value:fn() }; return slots[i].value; },
    useEffect(fn,deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps,deps)) {
      const cleanup = slots[i]?.cleanup; slots[i] = { deps }; effects.push(() => { cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const baseFor = chart => {
    const key = runs.profileKey(chart.birth);
    if (!personalContexts.has(key)) personalContexts.set(key,{ at:'2026-10-14T12:00:00.000Z',profileKey:key,
      input:{birth:{...chart.birth},settings:{orbScale:1}},evidence:{},natal:{planets:[]},limitations:[] });
    return personalContexts.get(key);
  };
  const sb = { React, Date, Event, ReadingRuns:runs, dateToJD:jd, useNow:() => now,
    usePersonalReading:chart => ({context:baseFor(chart)}),
    computeSynastry:(a,b) => ({ chartA:a,chartB:b,hits:[],receptionsAB:[],receptionsBA:[],overlaysAonB:[],overlaysBonA:[],score:{},
      ctm:{syndromeFoldDeg:0,tcoA:{thetaDeg:0,P:0},tcoB:{thetaDeg:0,P:0},lanesReliable:true,sharedLanes:[]} }),
    useSynastryReading:() => ({loading:false,text:null}), useVoice:() => ({}),
    useInterpreterState:() => provider, chartIdentityKey:chart => runs.profileKey(chart.birth),
    interpretSynastryAspect:(hit,syn) => new Promise(resolve => requests.push({hit,syn,resolve})),
    aspectMeaning:() => 'A symbolic possibility', planetSignifies:body => body,
    PersonalReadingHistory:() => {}, FollowUpQuestions:() => {},
    MUTUAL_SAME_DAY_WINDOW:0.5, mergeNearPerfections:(a,b,w) => a.flatMap(x => b.filter(y => Math.abs(y.jd-x.jd)<=w).map(y => ({a:x,b:y,jd:(x.jd+y.jd)/2,gapDays:y.jd-x.jd}))),
    transitPerfections:(chart,center,span,bodies) => {
      if (bodies[0] === failBody) throw new Error('Ephemeris unavailable');
      return { hits:[{jd:center,dateISO:new Date((center-2440587.5)*86400000).toISOString(),transit:bodies[0],natal:'Sun',aspect:'Conjunction',owner:chart.birth.subjectName,span}] };
    },
    setTimeout(fn) { const task = {fn,cancelled:false}; tasks.push(task); return task; }, clearTimeout:task => { task.cancelled = true; },
    dispatchEvent:event => events.push(event.type),
  };
  sb.window = sb; vm.createContext(sb); vm.runInContext(source,sb);
  const walk = (node,fn) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walk(n,fn)); return; }
    fn(node); node.children?.forEach(n => walk(n,fn));
  };
  const persist = () => walk(tree,node => {
    if (node.type !== sb.PersonalReadingHistory) return;
    const c = node.props.context, id = JSON.stringify([c.at,c.input]);
    const old = runs.loadRuns(null,c.profileKey).find(r => r.id === id);
    runs.saveRun(null,{version:1,id,profileKey:c.profileKey,at:c.at,input:c.input,
      evidence:{...old?.evidence,...c.evidence},reading:node.props.narrative.text});
  });
  const render = (next=props) => { props = next; cursor = 0; dirty = false; tree = aspectMode ? sb.SynAspectDetail(props) : sb.SynastryView(props); persist();
    while (effects.length) effects.shift()(); return tree; };
  const flush = (limit=100) => { let n=0; while (tasks.length && n++ < limit) {
    const task = tasks.shift(); if (!task.cancelled) task.fn(); if (dirty) render();
  } };
  const chooseDate = value => { let input; walk(tree,node => { if (node.type==='input' && node.props.type==='date') input=node; });
    input.props.onChange({target:{value}}); render(); };
  const text = node => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return (Array.isArray(node) ? node : node.children || []).map(text).join(' ');
  };
  const history = () => runs.loadRuns(null,runs.profileKey(props.chartA.birth)).find(r => r.input.kind==='synastry');
  return { sb,runs,events,tasks,requests,provider,render,renderAspect:next => { aspectMode=true; return render(next); },flush,chooseDate,text:() => text(tree).replace(/\s+/g,' ').trim(),history,
    initial:{chartA:{birth:{...birthA},jd:jd(birthA.dateISO),timeUnknown:false},chartB:{birth:{...birthB},jd:jd(birthB.dateISO),timeUnknown:false},settings:{agentOn:false,voiceOn:false}},
    setNow:date => { now = new Date(date); },failStorage:() => { failStorage=true; },failBody:body => { failBody=body; } };
}

export async function run() {
  const rows=[], t=(name,ok,detail='') => rows.push({name,ok:!!ok,detail});
  {
    const r=rig(); r.render(r.initial);
    t('pending relationship scans do not enter stored evidence', !r.history().evidence.mutualPerfections);
    r.flush(5);
    t('partial body scans do not enter stored evidence', !r.history().evidence.mutualPerfections);
    r.flush(); const run=r.history(), scans=run.evidence.mutualPerfections.value.scans, scan=scans[0];
    t('completed scans retain both chart births', scans.length===1 && scan.input.birthA.subjectName==='Owner' && scan.input.birthB.subjectName==='Partner');
    t('all independent and merged results are retained beyond the displayed twelve', scan.hitsA.length===6 && scan.hitsB.length===6 && scan.hits.length===36);
    t('completed scan records the actual window and pairing threshold', scan.parameters.centerAt==='2026-10-14T12:00:00.000Z' && scan.parameters.spanDays===366 && scan.parameters.nearDays===0.5);
    t('completed scan preserves the captured relationship reading instant', run.at==='2026-10-14T12:00:00.000Z' && scan.completedAt && run.input.kind==='synastry');
    t('successful collection refreshes reading-history subscribers', r.events.includes('personal-reading-evidence'));
    t('completion is visibly reported with actual result counts', /Completed window:/.test(r.text()) && /36 pairs/.test(r.text()) && /Saved with this relationship reading/.test(r.text()));
    const firstId=scan.id;
    r.chooseDate('2026-10-15'); r.flush();
    const updated=r.history().evidence.mutualPerfections.value.scans;
    t('an exact selected date inside the same bucket triggers a new completed scan', updated.length===2 && updated[0].parameters.centerAt==='2026-10-15T12:00:00.000Z');
    t('current context enrichment preserves earlier completed windows', updated.some(s=>s.id===firstId));
    const c={at:run.at,input:run.input,profileKey:run.profileKey};
    t('repeated identical windows replace their own record', r.sb.saveMutualScan(c,r.initial.chartA,r.initial.chartB,scan) && r.history().evidence.mutualPerfections.value.scans.length===2);
    t('pending snapshots cannot be attached', !r.sb.saveMutualScan(c,r.initial.chartA,r.initial.chartB,{...scan,status:'pending'}));
    t('a stale completion cannot be attached', !r.sb.saveMutualScan(c,r.initial.chartA,r.initial.chartB,scan,()=>false));
    t('another partner cannot receive the scan', !r.sb.saveMutualScan(c,r.initial.chartA,{birth:{...birthB,subjectName:'Other partner'}},scan));
    t('another owner cannot receive the scan', !r.sb.saveMutualScan(c,{birth:{...birthA,subjectName:'Other owner'}},r.initial.chartB,scan));
    t('a malformed scan window is rejected', !r.sb.saveMutualScan(c,r.initial.chartA,r.initial.chartB,{...scan,parameters:{...scan.parameters,centerJd:NaN}}));
  }
  {
    const r=rig(); r.render(r.initial); r.flush(4);
    const oldRun=r.history();
    const next={...r.initial,chartB:{...r.initial.chartB,birth:{...birthB,subjectName:'New partner',lng:-97}}};
    r.render(next); r.flush();
    const all=r.runs.loadRuns(null);
    t('changing a partner at the same birth JD cancels the old scope', !all.find(x=>x.id===oldRun.id).evidence.mutualPerfections);
    t('only the new partner receives the completed calculation', all.some(x=>x.input.partnerBirth.subjectName==='New partner' && x.evidence.mutualPerfections?.value.scans[0].input.birthB.lng===-97));
  }
  {
    const r=rig(); r.render(r.initial); r.failBody('Saturn'); r.flush();
    t('failed scans show a useful error and save no partial calculations', r.text().includes('Ephemeris unavailable') && r.text().includes('No partial results were saved') && !r.history().evidence.mutualPerfections);
  }
  {
    const r=rig(); r.render(r.initial); r.failStorage(); r.flush();
    t('storage failures are visible while completed results remain available', r.text().includes('could not be saved in browser history') && r.text().includes('36 pairs') && !r.history().evidence.mutualPerfections);
  }
  {
    const r=rig(); r.render({...r.initial,chartB:{...r.initial.chartB,timeUnknown:true,birth:{...birthB,timeUnknown:true}}}); r.flush();
    t('assumed-time scan limitations are both stored and visible', r.history().evidence.mutualPerfections.value.scans[0].limitations.some(line=>/birth time is unknown/.test(line))
      && r.text().includes('contact dates can change when the birth time is corrected'));
  }
  {
    const r=rig(), props={hit:{a:'Sun',b:'Moon',aspect:'Trine',orb:1},A:'Owner',B:'Partner',agentOn:true,
      syn:{chartA:r.initial.chartA,chartB:r.initial.chartB,readingContext:{cacheFingerprint:'before-scan'}}};
    r.renderAspect(props); r.requests[0].resolve('Verified first-context interpretation'); await Promise.resolve(); r.renderAspect(props);
    t('aspect detail shows a verified interpretation for its current context', r.text().includes('Verified first-context interpretation'));
    const enriched={...props,syn:{...props.syn,readingContext:{cacheFingerprint:'completed-scan'}}};
    r.renderAspect(enriched);
    t('completed scan context invalidates the displayed aspect interpretation', r.requests.length===2 && !r.text().includes('Verified first-context interpretation'));
    r.provider.model='qwen/two:free'; r.provider.generation++; r.renderAspect(enriched);
    r.requests[1].resolve('Stale old-provider interpretation'); await Promise.resolve(); r.renderAspect(enriched);
    t('provider changes cancel stale aspect interpretation results', r.requests.length===3 && !r.text().includes('Stale old-provider interpretation'));
    r.requests[2].resolve('Current-model interpretation'); await Promise.resolve(); r.renderAspect(enriched);
    t('the selected model interpretation can replace the local detail', r.text().includes('Current-model interpretation'));
    r.provider.available=false; r.provider.generation++; r.renderAspect(enriched);
    t('disconnect restores local aspect detail without stale AI text', !r.text().includes('Current-model interpretation') && r.text().includes('A symbolic possibility') && r.requests.length===3);
  }
  return rows;
}
