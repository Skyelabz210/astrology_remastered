import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as Astronomy from 'astronomy-engine';
import * as AstroCore from '../../src/present/astro-core.js';
import * as Houses from '../../tools/ephemeris/houses.js';
import * as Transits from '../../src/astro/transits.js';
import * as PersonaModel from '../../src/astro/persona.js';
import * as ReadingRuns from '../../src/astro/reading-runs.js';
import * as UserExport from '../../src/astro/user-export.js';
import * as EnhancedReading from '../../src/present/enhanced-reading.js';
import { unzipSync, strFromU8 } from '../../vendor/fflate.js';

export async function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  const memory = new Map(), storage = { getItem: key => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, String(value)) };
  const hooks = []; let cursor = 0;
  const useState = initial => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks[index], next => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
  };
  const React = { useState, useMemo: fn => fn(), useEffect() {},
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }) };
  const box = { Astronomy, AstroCore, Houses, Transits, PersonaModel, ReadingRuns,
    UserExport, EnhancedReading, localStorage: storage, React, Date, Intl, console,
    document: { getElementById() {} }, ReactDOM: { createRoot: () => ({ render() {} }) } };
  box.window = box;
  vm.createContext(box);
  for (const file of ['astro.jsx', 'time.jsx', 'cities.jsx', 'chapters.jsx', 'reading-context.jsx', 'live.jsx', 'hcrm-app.jsx']) {
    vm.runInContext(transformSync(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'), { loader: 'jsx' }).code, box);
  }
  const birth = { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058,
    tz: 'America/New_York', subjectName: 'Alpha', placeLabel: 'Fort Liberty (Bragg) · NC',
    placeKey: 'Fort Liberty (Bragg) · NC', houseSystem: 'whole', sect: 'auto', orbScale: 1.5 };
  const natal = box.computeNatal(birth), chapters = box.alphaLifeChapters(birth);
  const jd = box.dateToJD(new Date('1990-04-12T12:00:00Z'));
  const calculation = { jdT: jd, ctm: box.ctmState(jd, natal.jd),
    lift: box.windingLift(natal, jd), digest: box.lifecycleDigest(natal, jd, chapters),
    returns: ['Sun', 'Moon'].map(body => box.returnChart(natal, body, jd, chapters)),
    prog: box.progressedAt(natal.jd, (jd - natal.jd) / 365.25) };
  const pending = box.buildLifecycleRun(natal, chapters, calculation, null, 'date', new Date('2026-10-13T09:00:00Z'));
  t('historical target and recording clock remain distinct', pending.at === '1990-04-12T12:00:00.000Z'
    && pending.createdAt === '2026-10-13T09:00:00.000Z' && pending.input.target.dateISO === pending.at);
  t('selected-date noon convention and calculation methods are recorded', pending.input.target.dateOnlyConvention.includes('12:00 UTC')
    && pending.input.calculation.secondaryProgressionYearDays === 365.25
    && pending.input.calculation.perfectionScan.gridStepDays === 2);
  t('historical residence and natal origin coexist in one owned run', pending.evidence.residence.value.active.place.placeKey === 'Wetzlar · DE'
    && pending.input.birth.lat === birth.lat && pending.input.birth.placeKey === birth.placeKey
    && pending.profileKey === ReadingRuns.profileKey(birth));
  t('selected-date return snapshots retain the actual residence coordinates', pending.evidence.returnCharts.value.length === 2
    && pending.evidence.returnCharts.value.every(r => r.placeLabel === 'Wetzlar · DE' && r.chart.birth.lat === 50.5558));
  t('selected progressions retain the actual displayed target computation', JSON.stringify(pending.evidence.secondaryProgressions.value) === JSON.stringify(calculation.prog));
  t('local calculation retains settings without an AI attribution', pending.input.settings.orbScale === 1.5 && pending.input.interpreter === null);
  t('incomplete scan contains metadata and no invented events', pending.evidence.perfectionScan.status === 'pending'
    && !('hits' in pending.evidence.perfectionScan.value));
  const centre = Math.round(jd / 30) * 30;
  const scan = { key: box.lifecycleScanKey(natal, jd), centreJd: centre,
    hits: box.transitPerfections(natal, centre, 366).hits };
  const complete = box.buildLifecycleRun(natal, chapters, calculation, scan, 'date', new Date('2026-10-13T09:01:00Z'));
  t('completed scan stores every calculated hit in the recorded window', complete.evidence.perfectionScan.status === 'ready'
    && complete.evidence.perfectionScan.value.hits.length === scan.hits.length && scan.hits.length > 0
    && complete.evidence.perfectionScan.value.hits.every(h => h.jd >= centre - 183 && h.jd <= centre + 183));
  t('scan offsets refer to the selected target instead of recording time', complete.evidence.perfectionScan.value.hits.every(h => h.daysFromTarget === h.jd - jd));
  t('saving again after completion replaces the pending snapshot', ReadingRuns.saveRun(storage, pending)
    && ReadingRuns.saveRun(storage, complete) && ReadingRuns.loadRuns(storage).length === 1
    && ReadingRuns.loadRuns(storage)[0].evidence.perfectionScan.status === 'ready');
  const nextJd = jd + 90;
  const stale = box.buildLifecycleRun(natal, chapters, { ...calculation, jdT: nextJd }, scan, 'date');
  t('another target block cannot claim the earlier scan is complete', stale.evidence.perfectionScan.status === 'pending');
  t('scan identity includes natal results and angle uncertainty', box.lifecycleScanKey(natal, jd) !== box.lifecycleScanKey({ ...natal, timeUnknown: true }, jd)
    && box.lifecycleScanKey(natal, jd) !== box.lifecycleScanKey({ ...natal, asc: natal.asc + 1 }, jd));
  t('run snapshots are detached from editable input arrays', complete.input.chapters !== chapters
    && complete.evidence.perfectionScan.value.hits !== scan.hits);
  const otherBirth = { ...birth, subjectName: 'Other reader' }, otherChart = box.computeNatal(otherBirth);
  const other = box.buildLifecycleRun(otherChart, [], { ...calculation, returns: [] }, scan, 'date');
  t('another reader cannot inherit an alpha scan or browse its run', other.profileKey !== complete.profileKey
    && other.evidence.perfectionScan.status === 'pending'
    && ReadingRuns.loadRuns(storage, other.profileKey).length === 0);
  const data = UserExport.collectPersonalData({ chart: natal, runs: ReadingRuns.loadRuns(storage) });
  const archive = await UserExport.buildPersonalZip(data);
  const contents = unzipSync(archive.bytes);
  const exported = JSON.parse(strFromU8(contents['history/01.json']));
  t('historical results survive into the offline ZIP history', exported.at === complete.at
    && exported.evidence.perfectionScan.value.hits.length === scan.hits.length
    && exported.evidence.returnCharts.value[0].placeLabel === 'Wetzlar · DE');
  const unknown = box.computeNatal({ ...birth, timeUnknown: true });
  const uncertain = box.buildLifecycleRun(unknown, chapters, { ...calculation, returns: [] }, null, 'date');
  t('unknown-time snapshots preserve withheld angle and residence interpretation', uncertain.evidence.natal.asc === null
    && uncertain.evidence.natal.mc === null && uncertain.evidence.residence.value.active === null
    && uncertain.evidence.limitations.some(line => line.includes('Unknown birth time')));

  const sydneyBirth = { dateISO: '1993-06-10T11:45:00Z', lat: -33.8688, lng: 151.2093,
    tz: 'Australia/Sydney', subjectName: 'Sydney reader', placeLabel: 'Sydney · AU', placeKey: 'Sydney · AU', houseSystem: 'placidus', sect: 'auto' };
  const form = box.hcrmBirthForm(sydneyBirth);
  t('console can reconstruct missing form data in the saved birth timezone', form.year === 1993 && form.month === 6 && form.day === 10
    && form.hour12 === 9 && form.minute === 45 && form.meridiem === 'PM' && form.place === 'Sydney · AU');
  box.ProfileStore = { load: () => ({ settings: sydneyBirth, chapters: [{ placeKey: 'Los Angeles · CA', startISO: '2010-01-01' }] }) };
  box.useErrorBanner = () => ({ banners: [], pushError() {}, dismiss() {} });
  box.PersonalArchiveButton = function Archive() {};
  box.HCRMConsole = function Console() {};
  box.Landing = function Landing() {};
  let personalInput;
  box.usePersonalReading = (chart, history, settings) => {
    personalInput = { chart, history, settings };
    return { chart, context: chart ? { profileKey: ReadingRuns.profileKey(chart.birth), input: { chapters: history } } : null };
  };
  cursor = 0;
  const consoleTree = box.HCRMApp();
  t('console hydrates the saved birth instead of the alpha fixture', personalInput.chart.birth.subjectName === 'Sydney reader'
    && personalInput.chart.birth.lat === sydneyBirth.lat && personalInput.chart.birth.houseSystem === 'placidus');
  t('console carries only the saved owner residence into its shared context', personalInput.history.length === 1
    && personalInput.history[0].placeKey === 'Los Angeles · CA' && personalInput.settings.agentOn === false);
  const archiveElement = consoleTree.props.children.find(element => element.type === box.PersonalArchiveButton);
  t('console archive receives the actual bound personal context', archiveElement.props.context.profileKey === ReadingRuns.profileKey(sydneyBirth)
    && archiveElement.props.context.input.chapters[0].placeKey === 'Los Angeles · CA');
  const consoleElement = consoleTree.props.children.find(element => element.type === box.HCRMConsole);
  consoleElement.props.onBack(); cursor = 0;
  const landing = box.HCRMApp().props.children;
  const anotherBirth = { ...sydneyBirth, dateISO: '1990-01-01T11:45:00Z', subjectName: 'Another reader' };
  t('console form switching birth starts with an isolated chapter draft', landing.props.chaptersForBirth(anotherBirth).length === 0);
  landing.props.onChaptersChange([{ placeKey: 'Tokyo · JP', startISO: '2015-01-01' }], anotherBirth);
  cursor = 0;
  const editedLanding = box.HCRMApp().props.children;
  editedLanding.props.onCast({ ...anotherBirth, formState: box.hcrmBirthForm(anotherBirth) });
  cursor = 0; box.HCRMApp();
  t('casting another console profile applies only its own edited residences', personalInput.history.length === 1
    && personalInput.history[0].placeKey === 'Tokyo · JP' && personalInput.chart.birth.subjectName === 'Another reader');
  return rows;
}
