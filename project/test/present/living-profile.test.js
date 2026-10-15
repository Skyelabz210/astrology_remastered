import assert from 'node:assert/strict';
import { ownerKey, loadProfile, ensureProfile, updatePreferences, addObservation, deleteObservation,
  clearProfile, summarizeProfile, getRevision, subscribe, STORAGE_KEY, VERSION,
  MAX_PROFILES, MAX_OBSERVATIONS, MAX_REVISIONS } from '../../src/present/living-profile.js';

function memoryStorage() {
  const memory = new Map(); let writes = 0;
  return { memory, get writes() { return writes; }, getItem: key => memory.get(key) || null,
    setItem(key, value) { writes += 1; memory.set(key, String(value)); } };
}
const copy = value => JSON.parse(JSON.stringify(value));
function chartFor(overrides = {}) {
  const birth = { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058,
    tz: 'America/New_York', subjectName: 'Alpha', placeLabel: 'Fort Bragg', houseSystem: 'whole', orbScale: 1, sect: 'auto', ...overrides };
  const planets = [['Sun', 210.1, 2], ['Moon', 24.25, 8], ['Mercury', 195.8, 1], ['Venus', 160.2, 12], ['Mars', 270.6, 4]]
    .map(([name, lon, house]) => ({ name, lon, house, sign: Math.floor(lon / 30), speed: 1, retrograde: false }));
  return { birth, planets, timeUnknown: birth.timeUnknown === true, houseSystemActual: birth.houseSystem, asc: 195.2, mc: 99.2,
    isDayChart: true, aspectGrid: [{ a: 'Sun', b: 'Mars', aspect: 'Sextile', angle: 60, orb: 0.5, phase: 'applying' }], cards: [] };
}
function contextFor(chart, changes = {}) {
  return { at: '2026-10-14T12:00:00Z', input: { birth: { ...chart.birth },
    chapters: [{ placeKey: 'Wetzlar · DE', startISO: '1980-10-22', endISO: '1993-10-22', approximate: true }],
    settings: { orbScale: 1, sect: 'auto' }, interpreter: { provider: 'OpenRouter', model: 'model-A' } },
    evidence: { behavioralTrajectories: { status: 'ready', value: { status: 'ready', at: '2026-10-14T12:00:00Z', horizonDays: 60,
      scope: 'Located ephemeris crossings', byBody: { Sun: [{ transitPlanet: 'Mars', natalPlanet: 'Sun', aspect: 'Square', exactHitDate: '2026-10-20T12:00:00Z', exactHitJd: 2461334, orbArcsec: 1200 }] } } } }, ...changes };
}
const observation = (domain = 'Sun', changes = {}) => ({ domain, kind: 'check-in', rating: 2, agreement: 'mixed',
  note: 'A concrete example and counterexample.', source: 'user', contextAt: '2026-10-14T12:00:00Z', ...changes });
function ledgerEntry(birth, overrides = {}) {
  return { ledger_version: 'hcrm-ephemeris-ledger-v1', event_id: new Date(birth.dateISO).toISOString() + '#Sun', body: 'Sun',
    longitude_arcsec: '756360', source: { kind: 'provided', name: 'fixture', checksum: 'fixture-checksum' },
    certificate: { status: 'IMPORTED_INTEGER_LEDGER', notes: 'A structurally admitted integer input, not a personality proof.' }, ...overrides };
}
export async function run() {
  const rows = [], test = (name, fn) => { try { fn(); rows.push({ name, ok: true }); } catch (error) { rows.push({ name, ok: false, detail: error.message }); } };
  const storage = memoryStorage(), chart = chartFor(), context = contextFor(chart);
  let profile;
  test('onboarding creates a persisted owner-bound living avatar from the computed five domains', () => {
    profile = ensureProfile(chart, context, storage);
    assert.equal(profile.version, VERSION); assert.equal(profile.ownerKey, ownerKey(chart.birth));
    assert.equal(profile.revision, 1); assert.equal(profile.baseline.computedAstrology.sections.length, 5);
    assert.equal(loadProfile(chart.birth, storage).revision, 1);
  });
  test('birth ownership canonicalizes offsets and ignores editable name and time-zone labels', () => {
    assert.equal(ownerKey(chart.birth), ownerKey({ ...chart.birth, dateISO: '1980-10-21T17:31:00-04:00', subjectName: 'Renamed', tz: 'Europe/Berlin' }));
  });
  test('different birth epochs and coordinates own independent avatars', () => {
    assert.notEqual(ownerKey(chart.birth), ownerKey({ ...chart.birth, dateISO: '1980-10-22T21:31:00Z' }));
    assert.notEqual(ownerKey(chart.birth), ownerKey({ ...chart.birth, lat: -33.8688 }));
  });
  test('invalid and impossible birth dates or non-finite/out-of-range coordinates cannot own profiles', () => {
    for (const change of [{ dateISO: 'garbage' }, { dateISO: '2025-02-30T12:00:00Z' }, { lat: NaN }, { lat: 91 }, { lng: Infinity }, { lng: -181 }, { lat: '35.1408' }]) assert.equal(ownerKey({ ...chart.birth, ...change }), null);
  });
  test('reading context from another person cannot seed this avatar', () => {
    const other = chartFor({ dateISO: '1993-06-10T11:45:00Z' });
    const target = memoryStorage(); assert.equal(ensureProfile(chart, contextFor(other), target), null); assert.equal(target.writes, 0);
  });
  test('load and summary safely return null for invalid or missing avatars', () => {
    assert.equal(loadProfile({ ...chart.birth, lat: NaN }, storage), null); assert.equal(summarizeProfile(null), null); assert.equal(summarizeProfile({ ownerKey: profile.ownerKey }), null);
  });
  test('idempotent onboarding does not write, emit, change timestamps or award additional XP', () => {
    const events = [], stop = subscribe(event => events.push(event)), writes = storage.writes;
    const again = ensureProfile(chart, context, storage); stop();
    assert.equal(storage.writes, writes); assert.equal(events.length, 0); assert.equal(again.createdAt, profile.createdAt); assert.equal(again.revision, 1);
    assert.equal(summarizeProfile(again).engagement.xp, 5);
  });
  test('current clock, provider and collected feedback cannot cause a baseline/context feedback loop', () => {
    const changed = copy(context); changed.at = '2027-01-01T12:00:00Z'; changed.input.interpreter.model = 'model-B';
    changed.evidence.livingProfile = { observations: [observation()] }; changed.evidence.behavioralTrajectories.value.at = changed.at;
    const again = ensureProfile(chart, changed, storage); assert.equal(again.baseline.basisKey, profile.baseline.basisKey); assert.equal(again.revision, 1);
  });
  test('cosmetic chapter identifiers do not change the computed baseline hash', () => {
    const changed = copy(context); changed.input.chapters[0].id = 'different-id';
    assert.equal(ensureProfile(chart, changed, storage).revision, 1);
  });
  test('private feedback merged into the live context is excluded from the stored astrological baseline', () => {
    const x = copy(context); x.evidence.livingProfile = { status: 'ready', value: { ownerKey: ownerKey(chart.birth),
      domains: [{ body: 'Sun', count: 1, agreement: { fits: 1, mixed: 0, 'does-not-fit': 0 }, history: [{ note: 'PRIVATE-SELF-REPORTED-NOTE' }] }] } };
    const p = ensureProfile(chart, x, memoryStorage());
    assert.equal(JSON.stringify(p.baseline.computedAstrology).includes('PRIVATE-SELF-REPORTED-NOTE'), false);
    assert.equal(p.baseline.basisKey, profile.baseline.basisKey);
  });
  test('changing a chapter, house system, natal planet, orb or sect refreshes the actual baseline', () => {
    for (const mutate of [
      (c, x) => { x.input.chapters[0].endISO = '1994-01-01'; },
      c => { c.houseSystemActual = 'equal'; c.birth.houseSystem = 'equal'; },
      c => { c.planets[0].lon += 0.1; }, c => { c.birth.orbScale = 2; }, c => { c.birth.sect = 'night'; },
    ]) {
      const local = memoryStorage(), c = copy(chart), x = copy(context); const initial = ensureProfile(c, x, local);
      mutate(c, x); const changed = ensureProfile(c, x, local);
      assert.equal(changed.revision, 2); assert.notEqual(changed.baseline.basisKey, initial.baseline.basisKey); assert.equal(changed.createdAt, initial.createdAt);
    }
  });
  test('unknown birth time is a baseline input and withholds unsupported houses and exact trajectory', () => {
    const c = { ...chart, timeUnknown: true, birth: { ...chart.birth, timeUnknown: true } };
    const p = ensureProfile(c, context, memoryStorage()); assert.equal(p.baseline.basis.birth.timeUnknown, true);
    assert.ok(p.baseline.computedAstrology.sections.every(s => s.anchor.house === null && s.trajectory.status === 'unavailable'));
  });
  test('preferences are explicitly self-reported, allowlisted and bounded at 1000 characters', () => {
    const changed = updatePreferences(chart.birth, { goals: 'Observe communication', learningStyle: 'examples', values: 'v'.repeat(1500), apiKey: 'DO-NOT-STORE', diagnosis: 'DROP' }, storage);
    assert.equal(changed.selfReported.preferences.goals, 'Observe communication'); assert.equal(changed.selfReported.preferences.values.length, 1000);
    assert.equal(changed.selfReported.preferences.apiKey, undefined); assert.equal(changed.selfReported.preferences.diagnosis, undefined);
  });
  test('invalid preference types do not mutate storage', () => {
    const writes = storage.writes; assert.equal(updatePreferences(chart.birth, { attention: 5 }, storage), null); assert.equal(storage.writes, writes);
  });
  test('one check-in catalogs stable identity, source, timestamp, rating and disagreement', () => {
    const changed = addObservation(chart.birth, observation('Sun', { agreement: 'does-not-fit' }), storage), item = changed.observations.at(-1);
    assert.ok(item.id); assert.equal(item.ownerKey, profile.ownerKey); assert.equal(item.source, 'user'); assert.ok(Number.isFinite(new Date(item.at).getTime()));
    assert.equal(item.agreement, 'does-not-fit'); assert.equal(item.rating, 2); assert.equal(item.contextAt, '2026-10-14T12:00:00.000Z');
  });
  test('user notes are bounded at 2000 characters and arbitrary observation fields are not retained', () => {
    const changed = addObservation(chart.birth, observation('Moon', { note: 'n'.repeat(2500), confidence: 1, apiKey: 'DO-NOT-STORE' }), storage);
    assert.equal(changed.observations.at(-1).note.length, 2000); assert.equal(changed.observations.at(-1).confidence, undefined); assert.equal(changed.observations.at(-1).apiKey, undefined);
  });
  test('invalid rating, agreement, domain, context time or non-user provenance never enters the journal', () => {
    for (const change of [{ rating: 4.1 }, { rating: -1 }, { rating: 5 }, { agreement: 'proven' }, { domain: 'diagnosis' }, { source: 'ai' }, { kind: 'certainty' }, { contextAt: '2025-02-30T12:00:00Z' }]) {
      const writes = storage.writes; assert.equal(addObservation(chart.birth, observation('Sun', change), storage), null); assert.equal(storage.writes, writes);
    }
  });
  test('unrated observations are retained without inventing a personality score', () => {
    const local = memoryStorage(); ensureProfile(chart, context, local);
    const changed = addObservation(chart.birth, observation('cognitive', { rating: null, agreement: null }), local);
    const summary = summarizeProfile(changed); assert.equal(summary.cognitive.ratings.mean, null); assert.equal(summary.cognitive.ratings.count, 0);
  });
  test('five chart domains and cognitive/preferences observations remain integrated but sourced', () => {
    addObservation(chart.birth, observation('cognitive', { note: 'I prefer written instructions.' }), storage);
    const changed = addObservation(chart.birth, observation('preferences', { rating: null, agreement: null, note: 'I value space to reflect.' }), storage);
    const summary = summarizeProfile(changed);
    assert.equal(summary.domains.length, 5); assert.equal(summary.cognitive.source, 'self-reported'); assert.equal(summary.cognitive.count, 1); assert.equal(summary.preferenceObservations.count, 1);
    assert.equal(summary.preferences.goals, 'Observe communication'); assert.match(summary.limitation, /not measured personality/);
  });
  test('domain ratings and agreement counts describe observations rather than validating astrology', () => {
    const local = memoryStorage(); ensureProfile(chart, context, local);
    addObservation(chart.birth, observation('Sun', { rating: 0, agreement: 'fits' }), local);
    const changed = addObservation(chart.birth, observation('Sun', { rating: 4, agreement: 'does-not-fit' }), local);
    const domain = summarizeProfile(changed).domains.find(d => d.body === 'Sun');
    assert.equal(domain.ratings.mean, 2); assert.equal(domain.ratings.count, 2); assert.equal(domain.agreement.fits, 1); assert.equal(domain.agreement['does-not-fit'], 1);
    assert.match(domain.ratings.scale, /not a validated personality score/); assert.equal(domain.confidence, undefined);
  });
  test('participation XP awards identical credit to fits, mixed and does-not-fit feedback', () => {
    const scores = ['fits', 'mixed', 'does-not-fit'].map(agreement => {
      const local = memoryStorage(); ensureProfile(chart, context, local);
      return summarizeProfile(addObservation(chart.birth, observation('Sun', { kind: 'reading-feedback', readingId: 'same-reading', agreement }), local)).engagement.xp;
    }); assert.deepEqual(scores, [10, 10, 10]);
  });
  test('repeated check-ins and feedback remain cataloged without farming participation credit', () => {
    const local = memoryStorage(); ensureProfile(chart, context, local);
    for (let i = 0; i < 5; i++) addObservation(chart.birth, observation('Sun'), local);
    for (let i = 0; i < 5; i++) addObservation(chart.birth, observation('Moon', { kind: 'reading-feedback', readingId: 'one-reading' }), local);
    const summary = summarizeProfile(loadProfile(chart.birth, local));
    assert.equal(summary.observationCount, 10); assert.equal(summary.engagement.xp, 20); assert.equal(summary.engagement.checkInCreditCount, 1); assert.equal(summary.engagement.feedbackCreditCount, 1); assert.equal(summary.engagement.participationDays, 1);
  });
  test('quests retain actual chart anchors, natal contacts, supplied trajectory and counterexample protocol', () => {
    const summary = summarizeProfile(loadProfile(chart.birth, storage)), quest = summary.quests.find(q => q.body === 'Sun');
    assert.equal(summary.quests.length, 5); assert.ok(Math.abs(quest.anchor.lon - 210.1) < 1e-10); assert.equal(quest.aspects[0].aspect, 'Sextile');
    assert.equal(quest.trajectory.hits[0].exactHitDate, '2026-10-20T12:00:00.000Z'); assert.match(quest.protocol, /counterexample/); assert.match(quest.counterexample, /set this interpretation aside/);
    assert.equal(quest.goal, 'Observe communication'); assert.match(summary.engagement.label, /Participation/);
  });
  test('computed integer relation lanes are retained with no confidence weight or personality proof', () => {
    const p = loadProfile(chart.birth, storage), section = p.baseline.computedAstrology.sections.find(s => s.body === 'Sun');
    assert.equal(section.resonance[0].lanes.length, 8); assert.equal(section.resonance[0].lanes[0].prime, 2);
    assert.equal(section.resonance[0].confidence, undefined); assert.match(summarizeProfile(p).limitation, /not measured personality traits/);
  });
  test('only supplied structurally admitted integer ledgers become the framework summary', () => {
    const local = memoryStorage(), x = copy(context); x.evidence.hcrm = { status: 'ready', ledger: [ledgerEntry(chart.birth)] };
    const p = ensureProfile(chart, x, local); assert.equal(p.baseline.admittedFramework.status, 'admitted'); assert.equal(p.baseline.admittedFramework.entryCount, 1);
    assert.match(p.baseline.admittedFramework.limitation, /does not validate a personality/); assert.equal(loadProfile(chart.birth, storage).baseline.admittedFramework, null);
  });
  test('framework evidence arriving later changes one revision without a repeated baseline loop', () => {
    const local = memoryStorage(), x = copy(context); const initial = ensureProfile(chart, x, local);
    x.evidence.hcrm = { status: 'ready', ledger: [ledgerEntry(chart.birth)] };
    const changed = ensureProfile(chart, x, local); assert.equal(changed.revision, 2); assert.equal(changed.baseline.basisKey, initial.baseline.basisKey);
    assert.equal(ensureProfile(chart, x, local).revision, 2);
  });
  test('synthetic, malformed and wrong-birth ledger records are never called admitted', () => {
    for (const invalid of [ledgerEntry(chart.birth, { certificate: { status: 'SYNTHETIC_DEMO', notes: 'demo' } }), ledgerEntry(chart.birth, { longitude_arcsec: '1.5' }), ledgerEntry(chart.birth, { event_id: '2000-01-01T00:00:00Z#Sun' })]) {
      const x = copy(context); x.evidence.hcrm = { status: 'ready', ledger: [invalid] }; assert.equal(ensureProfile(chart, x, memoryStorage()).baseline.admittedFramework, null);
    }
  });
  test('successful writes notify subscribers and getRevision agrees with the persisted snapshot', () => {
    const events = [], stop = subscribe(chart.birth, e => events.push(e));
    const changed = updatePreferences(chart.birth, { routines: 'Morning walk' }, storage); stop();
    assert.equal(events.length, 1); assert.equal(events[0].ownerKey, ownerKey(chart.birth)); assert.equal(events[0].revision, changed.revision); assert.equal(getRevision(chart.birth, storage), changed.revision);
  });
  test('owner-filtered listeners ignore another person and global listeners can unsubscribe', () => {
    const local = memoryStorage(), other = chartFor({ dateISO: '1993-06-10T11:45:00Z' });
    const owned = [], all = [], stopOwn = subscribe(chart.birth, e => owned.push(e)), stopAll = subscribe(e => all.push(e));
    ensureProfile(other, null, local); stopOwn(); stopAll(); ensureProfile(chart, null, local);
    assert.equal(owned.length, 0); assert.equal(all.length, 1);
  });
  test('subscriber errors do not prevent successful persistence or other UI updates', () => {
    const events = [], stopBad = subscribe(() => { throw new Error('broken view'); }), stopGood = subscribe(e => events.push(e));
    const changed = updatePreferences(chart.birth, { decisionStyle: 'Write alternatives down' }, storage); stopBad(); stopGood();
    assert.ok(changed); assert.equal(events.length, 1);
  });
  test('loaded profiles, observations and summaries are immutable clones of stored owner data', () => {
    const p = loadProfile(chart.birth, storage), original = p.observations[0].note;
    p.observations[0].note = 'mutated'; p.selfReported.preferences.goals = 'mutated'; p.baseline.basis.birth.lat = 90;
    const summary = summarizeProfile(loadProfile(chart.birth, storage)); summary.history[0].note = 'mutated';
    const stored = loadProfile(chart.birth, storage); assert.equal(stored.observations[0].note, original); assert.equal(stored.selfReported.preferences.goals, 'Observe communication'); assert.equal(stored.birth.lat, chart.birth.lat);
  });
  test('updating, deleting and clearing one owner leaves the other owner intact', () => {
    const local = memoryStorage(), other = chartFor({ dateISO: '1993-06-10T11:45:00Z', subjectName: 'Other' });
    ensureProfile(chart, context, local); ensureProfile(other, null, local); const otherBefore = loadProfile(other.birth, local);
    const p = addObservation(chart.birth, observation(), local); deleteObservation(chart.birth, p.observations[0].id, local); clearProfile(chart.birth, local);
    assert.deepEqual(loadProfile(other.birth, local), otherBefore); assert.equal(loadProfile(chart.birth, local), null);
  });
  test('deleting an observation removes its journal entry and updates a bounded revision history', () => {
    const p = loadProfile(chart.birth, storage), removed = p.observations[0].id, result = deleteObservation(chart.birth, removed, storage);
    assert.equal(result.observations.some(o => o.id === removed), false); assert.equal(result.revision, p.revision + 1);
    assert.equal(deleteObservation(chart.birth, 'missing', storage), null);
  });
  test('failed writes return no success, emit no change and retain the previous owner snapshot', () => {
    const local = memoryStorage(); const p = ensureProfile(chart, context, local); const added = addObservation(chart.birth, observation(), local);
    const blocked = { getItem: key => local.getItem(key), setItem() { throw new Error('quota'); } }, events = [], stop = subscribe(e => events.push(e));
    assert.equal(updatePreferences(chart.birth, { goals: 'new' }, blocked), null); assert.equal(addObservation(chart.birth, observation(), blocked), null);
    assert.equal(deleteObservation(chart.birth, added.observations[0].id, blocked), null); assert.equal(clearProfile(chart.birth, blocked), false);
    const changed = copy(chart); changed.birth.orbScale = 2; assert.equal(ensureProfile(changed, context, blocked), null); stop();
    assert.equal(events.length, 0); assert.equal(loadProfile(chart.birth, local).revision, added.revision); assert.equal(loadProfile(chart.birth, local).createdAt, p.createdAt);
  });
  test('failed initial writes and blocked reads cannot create avatars or overwrite other owners', () => {
    const local = memoryStorage(), blocked = { getItem: key => local.getItem(key), setItem() { throw new Error('blocked'); } };
    assert.equal(ensureProfile(chart, context, blocked), null); assert.equal(local.memory.has(STORAGE_KEY), false);
    const readBlocked = { getItem() { throw new Error('denied'); }, setItem() { assert.fail('must not overwrite an unread store'); } };
    assert.equal(loadProfile(chart.birth, readBlocked), null); assert.equal(ensureProfile(chart, context, readBlocked), null); assert.equal(clearProfile(chart.birth, readBlocked), false);
  });
  test('forged owner keys and wrong-birth baselines are dropped without losing valid profiles', () => {
    const local = memoryStorage(); const good = ensureProfile(chart, context, local), forged = copy(good), mismatched = copy(good);
    forged.ownerKey = 'another-person'; mismatched.baseline.computedAstrology.ownerBirth.lat = 0;
    local.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, profiles: [forged, mismatched, good] }));
    assert.deepEqual(loadProfile(chart.birth, local), good);
  });
  test('forged observations and arbitrary fields are removed on parse', () => {
    const local = memoryStorage(); const p = ensureProfile(chart, context, local); const changed = addObservation(chart.birth, observation(), local);
    const good = changed.observations[0]; changed.observations.push({ ...good, id: 'foreign', ownerKey: 'foreign' }, { ...good, id: 'bad-rating', rating: 20 }, { ...good, id: 'bad-source', source: 'ai' });
    changed.password = 'DROP'; changed.selfReported.preferences.apiKey = 'DROP';
    local.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, profiles: [changed] })); const loaded = loadProfile(chart.birth, local);
    assert.equal(loaded.observations.length, 1); assert.equal(loaded.password, undefined); assert.equal(loaded.selfReported.preferences.apiKey, undefined); assert.equal(loaded.createdAt, p.createdAt);
  });
  test('unsupported newer schema and malformed JSON fail without corrupting the store', () => {
    for (const raw of ['{broken', JSON.stringify({ version: VERSION + 1, profiles: [] }), JSON.stringify({ version: VERSION, profiles: null })]) {
      const local = memoryStorage(); local.setItem(STORAGE_KEY, raw); assert.equal(loadProfile(chart.birth, local), null); assert.equal(ensureProfile(chart, context, local), null); assert.equal(local.getItem(STORAGE_KEY), raw);
    }
  });
  test('journal bounds keep the latest 200 observations and 30 revisions with unique stable IDs', () => {
    const local = memoryStorage(); ensureProfile(chart, context, local);
    for (let i = 0; i < MAX_OBSERVATIONS + 5; i++) addObservation(chart.birth, observation('Sun', { note: `entry-${i}` }), local);
    const p = loadProfile(chart.birth, local); assert.equal(p.observations.length, MAX_OBSERVATIONS); assert.equal(p.revisions.length, MAX_REVISIONS);
    assert.equal(p.observations[0].note, 'entry-5'); assert.equal(p.observations.at(-1).note, `entry-${MAX_OBSERVATIONS + 4}`);
    assert.equal(new Set(p.observations.map(o => o.id)).size, MAX_OBSERVATIONS); assert.equal(new Set(p.revisions.map(r => r.id)).size, MAX_REVISIONS);
  });
  test('the local catalog is bounded to 25 distinct profiles rather than silently merging owners', () => {
    const local = memoryStorage();
    for (let i = 0; i < MAX_PROFILES + 1; i++) ensureProfile(chartFor({ lat: -70 + i }), null, local);
    const stored = JSON.parse(local.getItem(STORAGE_KEY)); assert.equal(stored.profiles.length, MAX_PROFILES);
    assert.equal(new Set(stored.profiles.map(p => p.ownerKey)).size, MAX_PROFILES); assert.equal(loadProfile(chartFor({ lat: -70 }).birth, local), null);
    assert.ok(loadProfile(chartFor({ lat: -70 + MAX_PROFILES }).birth, local));
  });
  test('clear removes only this living avatar and emits revision zero without touching unrelated storage', () => {
    const local = memoryStorage(); ensureProfile(chart, context, local); local.setItem('other-key', 'KEEP');
    const events = [], stop = subscribe(chart.birth, e => events.push(e)); assert.equal(clearProfile(chart.birth, local), true); stop();
    assert.equal(getRevision(chart.birth, local), 0); assert.equal(local.getItem('other-key'), 'KEEP'); assert.equal(events[0].revision, 0);
  });
  return rows;
}
