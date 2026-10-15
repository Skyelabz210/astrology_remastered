import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { createOpenRouter } from '../../src/present/openrouter.js';

export async function run() {
  const rows = [], t = (name, ok) => rows.push({ name, ok: !!ok });
  const vision = id => ({ id, pricing: { prompt: '0', completion: '0' },
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } });
  const provider = createOpenRouter(async () => ({ ok: true, json: async () => ({ data: [vision('qwen/one:free'), vision('qwen/two:free')] }) }));
  await provider.models(); provider.configure('private-test-key', 'qwen/one:free');
  let cursor = 0;
  const slots = [], equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const React = {
    useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useMemo(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !equal(slots[i].deps, deps)) {
      if (slots[i]?.cleanup) slots[i].cleanup(); slots[i] = { deps, cleanup: fn() }; } },
  };
  let revision = 1;
  const livingListeners = new Set();
  const privateSummary = { preferences: { goals: 'Private goal' }, observationCount: 1,
    history: [{ id: 'observation-1', domain: 'Sun', kind: 'check-in', note: 'Private check-in', at: '2026-10-14T00:00:00Z' }] };
  const sb = { React, Date, OpenRouter: provider, Astronomy: {}, EPHEMERIS_MODE: 'REAL',
    dateToJD: date => date.getTime() / 86400000 + 2440587.5,
    lifecycleDigest: () => ({ lines: ['Computed lifecycle fact'] }), progressionsDigest: () => ({ lines: [] }),
    currentTransits: () => ({ hits: [] }), PersonaModel: { personaForChart: () => ({ dominantElement: 'Fire', dominantModality: 'Fixed', receptions: [] }) },
    chapterAware: () => ({ active: null, dropped: 0, chapters: [] }), EnhancedReading: { natalEclipseText: () => '' },
    BehavioralProfile: { behavioralTrajectories: (chart, jd) => ({ status: 'ready', at: new Date((jd - 2440587.5) * 86400000).toISOString(), byBody: {}, horizonDays: 60 }) },
    LivingProfile: { loadProfile: birth => birth.subjectName === 'Owner' ? { revision } : null,
      summarizeProfile: profile => ({ ...privateSummary, revision: profile.revision }),
      getRevision: birth => birth.subjectName === 'Owner' ? revision : 0,
      subscribe: fn => { livingListeners.add(fn); return () => livingListeners.delete(fn); } } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(transformSync(readFileSync(new URL('../../reading-context.jsx', import.meta.url), 'utf8'), { loader: 'jsx' }).code, sb);
  const natal = { birth: { dateISO: '1980-10-21T21:31:00Z', lat: 35, lng: -79, subjectName: 'Owner' }, planets: [] };
  const settings = { agentOn: true, orbScale: 1, sect: 'auto' }, chapters = [];
  const render = (chart = natal, tweaks = settings) => { cursor = 0; return sb.usePersonalReading(chart, chapters, tweaks).context; };
  const first = render(); provider.chooseModel('qwen/two:free'); const switched = render();
  t('switching models updates the current run input without recasting the natal chart', first.input.interpreter.model === 'qwen/one:free' && switched.input.interpreter.model === 'qwen/two:free'
    && first.profileKey === switched.profileKey && first.cacheFingerprint !== switched.cacheFingerprint);
  t('changing interpreter keeps one frozen reading instant', first.at === switched.at);
  provider.disconnect(); const disconnected = render();
  t('disconnect removes the provider from current recorded provenance', disconnected.input.interpreter === null);
  revision++; for (const listener of livingListeners) listener(); const revised = render();
  t('a local check-in revision refreshes local personalized evidence', revised.evidence.livingProfile.value.revision === 2 && revised.cacheFingerprint !== disconnected.cacheFingerprint);
  t('each living revision has a distinct saved reading identity without notes in the input', revised.input.livingAvatar.revision === 2
    && disconnected.input.livingAvatar.revision === 1 && JSON.stringify([revised.at, revised.input]) !== JSON.stringify([disconnected.at, disconnected.input])
    && !JSON.stringify(revised.input).includes('Private check-in') && !JSON.stringify(revised.input).includes('Private goal'));
  t('private goals and check-ins stay out of shared personal prose by default', revised.input.settings.shareBehavioralDataWithAI === false
    && !revised.personalText.includes('Private') && revised.evidence.livingProfile.value.history[0].note === 'Private check-in');
  const shared = render(natal, { ...settings, shareBehavioralDataWithAI: true });
  t('sharing behavioral feedback is a separate explicit setting in the run', shared.input.settings.shareBehavioralDataWithAI === true && shared.cacheFingerprint !== revised.cacheFingerprint);
  const foreign = render({ ...natal, birth: { ...natal.birth, subjectName: 'Other' } });
  t('another chart does not receive the owner’s living profile evidence', !foreign.evidence.livingProfile);
  const large = { ...privateSummary, observationCount: 200,
    history: Array.from({ length: 200 }, (_, i) => ({ id: `note-${i}`, domain: 'Sun', note: 'x'.repeat(1200) })),
    domains: [{ body: 'Sun', count: 200, history: Array.from({ length: 200 }, () => ({ note: 'duplicated-private-note' })) }] };
  const compact = sb.compactLivingSummary(large);
  t('context retains full counts with bounded notes and nonduplicating domain references', compact.observationCount === 200
    && compact.history.length === 20 && compact.history[0].id === 'note-180' && compact.history.every(row => row.note.length <= 300)
    && compact.domains[0].count === 200 && compact.domains[0].recentObservationIds.length === 3 && !('history' in compact.domains[0])
    && !JSON.stringify(compact).includes('duplicated-private-note'));
  t('explicit AI summary bounds can further restrict notes without mutating the journal', sb.compactLivingSummary(large, 10).history.length === 10
    && sb.compactLivingSummary(large, 0).history.length === 0 && large.history[0].note.length === 1200);
  for (const slot of slots) if (slot?.cleanup) slot.cleanup();
  return rows;
}
