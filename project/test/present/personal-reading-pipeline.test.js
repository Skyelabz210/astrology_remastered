import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import * as Astronomy from 'astronomy-engine';
import * as AstroCore from '../../src/present/astro-core.js';
import * as Houses from '../../tools/ephemeris/houses.js';
import * as Transits from '../../src/astro/transits.js';
import * as PersonaModel from '../../src/astro/persona.js';
import * as ReadingRuns from '../../src/astro/reading-runs.js';
import * as EnhancedReading from '../../src/present/enhanced-reading.js';
import * as BehavioralProfile from '../../src/present/behavioral-profile.js';
import * as VariantCalculations from '../../src/astro/variant-calculations.js';

export function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  const backing = new Map(), storage = { getItem: k => backing.get(k) || null,
    setItem: (k, value) => backing.set(k, value) };
  const sb = { Astronomy, AstroCore, Houses, Transits, PersonaModel, ReadingRuns,
    EnhancedReading, BehavioralProfile, VariantCalculations, localStorage: storage, Date, console,
    React: { useState: () => [null, () => {}], useEffect() {}, useMemo: fn => fn() } };
  sb.window = sb;
  vm.createContext(sb);
  for (const name of ['astro.jsx', 'time.jsx', 'synastry.jsx', 'cities.jsx', 'chapters.jsx', 'readings.jsx', 'agent.jsx', 'narrative.jsx', 'reading-context.jsx']) {
    const src = readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
    vm.runInContext(name === 'reading-context.jsx' ? transformSync(src, { loader: 'jsx' }).code : src, sb);
  }
  const birth = { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058,
    tz: 'America/New_York', placeLabel: 'Fort Liberty (Bragg) · NC',
    subjectName: 'Anthony', houseSystem: 'whole', sect: 'auto' };
  const natal = sb.computeNatal(birth);
  const jd = sb.dateToJD(new Date('2026-10-02T12:00:00Z'));
  const chapters = [{ placeKey: 'Los Angeles · CA', startISO: '2010-01-01', endISO: '' }];
  const context = sb.buildPersonalReadingContext(natal, jd, chapters, { eclipseOrb: 2.5, orbScale: 1 });
  t('evidence cache fingerprint is compact and stable', context.cacheFingerprint.length === 32 && ReadingRuns.evidenceFingerprint([context.at, context.input, context.evidence]) === context.cacheFingerprint);
  const chart = { ...natal, readingContext: context };
  t('all personal context providers produce real evidence', Object.values(context.evidence).every(e => e.status === 'ready'), JSON.stringify(context.evidence));
  t('solar arc shares the frozen reading instant and owned birth', context.evidence.solarArc.value.input.targetAt === context.at
    && ReadingRuns.profileKey(context.evidence.solarArc.value.input.birth) === context.profileKey);
  t('bounded behavioral contacts share the reading instant and current model revision', context.evidence.behavioralTrajectories.value.at === context.at
    && context.evidence.behavioralTrajectories.value.horizonDays === 60 && context.input.modelRevision === 'personal-reading-v3');
  t('per-chart angle and sect conventions accompany saved calculations', context.natal.anglesMode === natal.anglesMode
    && context.natal.angleSource === natal.angleSource && context.natal.sectSource === natal.sectSource && context.natal.solarAltitude === natal.solarAltitude);
  const invalidResidence = sb.buildPersonalReadingContext(natal, jd, [{ placeKey: 'Los Angeles · CA', startISO: 'not-a-date', endISO: '' }], {});
  t('dropped residence entries are visible in narrative context and assumptions', invalidResidence.personalText.includes('excluded') && invalidResidence.limitations.some(s => s.includes('invalid residence entries')));
  t('residence is applied to narrated return charts', context.lifecycleText.includes('Los Angeles'));
  t('run has one explicit instant', context.at === '2026-10-02T12:00:00.000Z');
  const narrative = sb.buildChartNarrative(chart, { lifecycleText: context.lifecycleText,
    progressionsText: context.progressionsText, eclipseText: context.eclipseText, personalText: context.personalText });
  t('full narration includes residence and current transits', narrative.text.includes('Los Angeles') && narrative.text.includes('Closest current transits at 2026-10-02'));
  t('voice offsets still index the combined personal reading', narrative.segments.every(s => narrative.text.slice(s.start, s.end) === s.text));
  const exported = sb.buildReadingMarkdown(chart, chart.cards, narrative);
  t('export contains context, assumptions and complete narration', exported.includes(context.at)
    && exported.includes('Los Angeles') && exported.includes(narrative.text) && exported.includes('mean lunar nodes'));
  const prompt = sb.buildChartPrompt(chart, jd);
  t('AI prompt receives the same residence and captured instant', prompt.includes('Los Angeles') && prompt.includes(context.at));
  t('follow-ups receive personal context', sb.buildNatalFollowUpPrompt('What is current?', chart).includes(context.personalText));
  const changed = { ...chart, readingContext: { ...context, cacheFingerprint: context.cacheFingerprint + ':next-run' } };
  t('AI card cache cannot replay a different run', sb.cacheKey(chart.cards[0], chart) !== sb.cacheKey(chart.cards[0], changed));
  for (const card of natal.cards) {
    const p = card.principal, sign = sb.ZODIAC[p.sign];
    t(`actual dignity ${card.name}`, card.dignity.kind === AstroCore.dignityFor(p.name, p.sign).kind);
    t(`actual term ${card.name}`, card.term === AstroCore.termRuler(p.sign, p.degInSign));
    t(`local reading uses actual placement ${card.name}`, sb.readingFor(card, chart).title === `${p.name} in ${sign.name}`);
    t(`narration uses actual placement ${card.name}`, sb.narrativeForCard(card, chart).includes(`in ${sign.name}`));
    t(`Sun never aspects itself ${card.name}`, p.name !== 'Sun' || card.aspect === null);
    t(`register rounds the natal longitude ${card.name}`, p.arcsec === Math.round(p.lon * 3600) % 1296000);
  }
  const la = sb.relocatedChart(natal, { label: 'Los Angeles', name: 'Los Angeles', region: 'CA', lat: 34.0522, lng: -118.2437, tz: 'America/Los_Angeles' });
  t('relocation preserves geocentric planetary positions', la.planets.every((p, i) => p.lon === natal.planets[i].lon));
  t('relocation recomputes house-dependent cards and Lots', la.cards !== natal.cards && la.lots.find(l => l.name === 'Fortune').lon !== natal.lots.find(l => l.name === 'Fortune').lon);
  t('sub-minute close aspect remains applying', AstroCore.applyingPhase(119.99999, 0, 13, 0, 120) === 'applying');
  t('stationary and exact phases are distinct', AstroCore.applyingPhase(120, 0, 1, 0, 120) === 'exact'
    && AstroCore.applyingPhase(119, 0, 0, 0, 120) === 'stationary');
  t('negative separations normalize', AstroCore.nearestAspect(-480).name === 'Trine');
  t('wider orb finds previously excluded contact', AstroCore.nearestAspect(82) === null && AstroCore.nearestAspect(82, 2).name === 'Square');
  t('phase sectors are centered including pre-New Moon', AstroCore.lunarPhase(0, 359).phase === 'New' && AstroCore.lunarPhase(0, 179).phase === 'Full');
  t('classical dignity table excludes speculative outer exaltations', AstroCore.dignityFor('Uranus', 7).kind === 'neutral' && AstroCore.dignityFor('Neptune', 3).kind === 'neutral');
  const porphyry = sb.computeNatal({ ...birth, houseSystem: 'porphyry' });
  t('Porphyry uses the existing verified cusp solver', porphyry.houseCusps.length === 12 && porphyry.planets.every(p => p.house === AstroCore.houseForCusps(p.lon, porphyry.houseCusps)));
  t('natal lunar illumination uses physical geometry', natal.phase.illumination === Astronomy.Illumination(Astronomy.Body.Moon, new Date(birth.dateISO)).phase_fraction && !natal.phase.illuminationApproximate);
  let invalid = false; try { sb.computeNatal({ ...birth, lat: NaN }); } catch { invalid = true; }
  t('invalid chart input is rejected before casting', invalid);
  invalid = false; try { sb.computeNatal({ ...birth, houseSystem: 'unknown-house-model' }); } catch { invalid = true; }
  t('unsupported house system cannot silently use equal houses', invalid);
  const fallback = { window: { Astronomy }, AstroCore, console }; vm.createContext(fallback);
  vm.runInContext(readFileSync(new URL('../../astro.jsx', import.meta.url), 'utf8'), fallback);
  for (const lat of [-60, 0, 35, 60]) {
    const date = new Date('2026-10-11T12:00:00Z');
    t(`fallback selects the correct eastern horizon branch ${lat}`, Math.abs(fallback.window.ascendantDeg(date, lat, -79) - Houses.ascMcFromDate(date, lat, -79).ascDeg) * 3600 < 60);
  }
  const quadrant = sb.computeNatal({ ...birth, houseSystem: 'placidus' });
  const overlays = sb.houseOverlays(quadrant, la);
  t('synastry uses the selected quadrant cusps', overlays.every(o => o.house === AstroCore.houseForCusps(la.planets.find(p => p.name === o.planet).lon, quadrant.houseCusps)));
  const polar = sb.computeNatal({ ...birth, lat: 70, houseSystem: 'placidus' });
  t('synastry honors the actual whole-sign polar fallback', sb.houseOverlays(polar, la).every(o => o.house === AstroCore.houseForSign(la.planets.find(p => p.name === o.planet).sign, polar.ascSignIdx)));
  t('unclassified-only synastry contacts yield a finite neutral ratio', sb.compatibilityScore([{ weight: 1 }]).ratio === 0.5);
  const tcoOriginal = sb.tcoPhase;
  sb.tcoPhase = jd => ({ theta: jd * Math.PI / 180 });
  const wrappedMid = sb.synastryCTM({ ...natal, jd: 359 }, { ...natal, jd: 1 });
  t('cyclic midpoint stays near zero across the wrap', wrappedMid.midThetaDeg < 1e-9 || wrappedMid.midThetaDeg > 360 - 1e-9);
  t('antipodal cyclic midpoint is explicitly ambiguous', sb.synastryCTM({ ...natal, jd: 0 }, { ...natal, jd: 180 }).midThetaDeg === null);
  sb.tcoPhase = tcoOriginal;
  const rxDate = sb.dateToJD(new Date('2023-08-30T12:00:00Z'));
  const mercury = sb.currentTransits(natal, rxDate).trans.find(p => p.name === 'Mercury');
  t('current transit velocity is signed ephemeris velocity', mercury.speed < 0 && mercury.speed === sb.planetSpeed('Mercury', rxDate));
  t('live path excludes unsupported Chiron', !sb.currentTransits(natal, jd).trans.some(p => p.name === 'Chiron'));
  const unknown = sb.computeNatal({ ...birth, timeUnknown: true });
  const unknownContext = sb.buildPersonalReadingContext(unknown, jd, chapters, {});
  t('unknown birth time propagates unavailable exact behavioral contact dates', unknownContext.evidence.behavioralTrajectories.status === 'unavailable'
    && unknownContext.limitations.some(s => s.includes('exact natal-degree contact dates are withheld')));
  t('unknown time suppresses sect-dependent traditional rulers', unknownContext.evidence.traditional.value.almuten === null && unknownContext.evidence.traditional.value.profection === null);
  t('unknown opening does not assert day or night sect', !sb.narrativeOpening(unknown).includes('It is a day chart') && !sb.narrativeOpening(unknown).includes('It is a night chart'));
  t('unknown time suppresses per-card natal lane interpretation', !sb.narrativeForCard(unknown.cards[0], unknown).includes('eleventh lane'));
  t('unknown time export does not assert sect', !sb.buildReadingMarkdown({ ...unknown, readingContext: unknownContext }, unknown.cards).includes('**Sect**'));
  const run = { version: 1, id: 'run-a', profileKey: context.profileKey, at: context.at,
    input: context.input, evidence: context.evidence, reading: narrative.text };
  t('run persists the inputs and evidence alongside the reading', ReadingRuns.saveRun(storage, run)
    && ReadingRuns.loadRuns(storage, context.profileKey)[0].reading === narrative.text);
  t('profile identities separate users with the same birth instant', ReadingRuns.profileKey(birth) !== ReadingRuns.profileKey({ ...birth, subjectName: 'Jordan' }));
  t('advanced evidence attaches to its exact saved run', ReadingRuns.attachEvidence(storage, run.id, 'hcrm', { status: 'ready', ledger: ['validated'] }) && ReadingRuns.loadRuns(storage)[0].evidence.hcrm.status === 'ready');
  t('advanced evidence cannot attach to an absent run', !ReadingRuns.attachEvidence(storage, 'different-run', 'hcrm', {}));
  t('one profile cannot read another profile history', ReadingRuns.loadRuns(storage, 'different-owner').length === 0);
  ReadingRuns.saveRun(storage, { ...run, reading: 'updated same run' });
  t('same run updates instead of duplicating', ReadingRuns.loadRuns(storage).length === 1 && ReadingRuns.loadRuns(storage)[0].reading === 'updated same run');
  for (let i = 0; i < 55; i++) ReadingRuns.saveRun(storage, { ...run, id: `run-${i}` });
  t('history is bounded and newest first', ReadingRuns.loadRuns(storage).length === 50 && ReadingRuns.loadRuns(storage)[0].id === 'run-54');
  t('unavailable storage reports save failure', !ReadingRuns.saveRun({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }, run));
  t('malformed storage is rejected', ReadingRuns.loadRuns({ getItem: () => '{broken' }).length === 0);
  t('clearing a profile removes its stored evidence', ReadingRuns.clearRuns(storage, context.profileKey) && ReadingRuns.loadRuns(storage).length === 0);
  const foreignBirth = { ...birth, subjectName: 'Jordan' };
  const foreignRun = { ...run, profileKey: ReadingRuns.profileKey(foreignBirth), input: { ...run.input, birth: foreignBirth } };
  const malformed = { ...run, input: {} };
  const forged = { ...foreignRun, profileKey: run.profileKey };
  storage.setItem(ReadingRuns.RUNS_KEY, JSON.stringify([malformed, forged, run]));
  t('bad and forged records are skipped without dropping valid history', ReadingRuns.loadRuns(storage, run.profileKey).length === 1);
  t('saving a run requires its actual birth record and matching owner', !ReadingRuns.saveRun(storage, malformed) && !ReadingRuns.saveRun(storage, forged));
  const invalidBirth = { ...birth, lat: 100 };
  t('out-of-range stored birth coordinates cannot enter history', !ReadingRuns.saveRun(storage, { ...run,
    input: { birth: invalidBirth }, profileKey: ReadingRuns.profileKey(invalidBirth) }));
  t('equal ids in different profiles do not replace another person’s run', ReadingRuns.saveRun(storage, foreignRun)
    && ReadingRuns.loadRuns(storage, run.profileKey).length === 1 && ReadingRuns.loadRuns(storage, foreignRun.profileKey).length === 1);
  t('ambiguous ids cannot acquire unscoped calculation evidence', !ReadingRuns.attachEvidence(storage, run.id, 'audit', { value: 1 }));
  t('scoped evidence reaches only its actual owner', ReadingRuns.attachEvidence(storage, run.id, 'audit', { value: 1 }, run.profileKey)
    && ReadingRuns.loadRuns(storage, run.profileKey)[0].evidence.audit.value === 1
    && ReadingRuns.loadRuns(storage, foreignRun.profileKey)[0].evidence.audit === undefined);
  t('clearing one profile preserves other profiles', ReadingRuns.clearRuns(storage, run.profileKey)
    && ReadingRuns.loadRuns(storage).length === 1 && ReadingRuns.loadRuns(storage)[0].profileKey === foreignRun.profileKey);
  return rows;
}
