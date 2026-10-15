// The living avatar joins computed astrology with explicitly self-reported
// experience. Participation changes its history, never the astronomical facts.
import { behavioralProfile } from './behavioral-profile.js';
import { evidenceFingerprint } from '../astro/reading-runs.js';
import { admitForCore } from '../ledger/import-ledger.js';

export const STORAGE_KEY = 'resonance.living-profile.v1';
export const VERSION = 1;
export const MAX_PROFILES = 25;
export const MAX_OBSERVATIONS = 200;
export const MAX_REVISIONS = 30;
export const DOMAINS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'cognitive', 'preferences'];
export const PREFERENCE_FIELDS = ['goals', 'values', 'learningStyle', 'decisionStyle', 'attention', 'routines', 'socialContext'];
const LIMITATION = 'Computed astrology and exact-integer correspondences are symbolic lenses, not measured personality traits, diagnoses or proof. Preferences, ratings and agreements below are self-reported. Player levels measure participation only.';
const listeners = new Set();
let sequence = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = value => Number.isFinite(value) ? value : null;
function timestamp(value) {
  if (typeof value !== 'string') return null;
  const p = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!p) return null;
  const y = Number(p[1]), m = Number(p[2]), d = Number(p[3]);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  if (m < 1 || m > 12 || d < 1 || d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]) return null;
  if (p[4] && (Number(p[4]) > 23 || Number(p[5]) > 59 || Number(p[6] || 0) > 59)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function cleanBirth(birth) {
  const dateISO = timestamp(birth?.dateISO);
  if (!dateISO || !Number.isFinite(birth.lat) || Math.abs(birth.lat) > 90 || !Number.isFinite(birth.lng) || Math.abs(birth.lng) > 180) return null;
  return { dateISO, lat: birth.lat, lng: birth.lng, timeUnknown: birth.timeUnknown === true,
    subjectName: text(birth.subjectName, 80), tz: text(birth.tz, 160), placeLabel: text(birth.placeLabel, 160),
    placeKey: text(birth.placeKey, 160), houseSystem: text(birth.houseSystem, 30), sect: text(birth.sect, 30), orbScale: number(birth.orbScale) };
}
export function ownerKey(birth) {
  const clean = cleanBirth(birth);
  return clean ? JSON.stringify([clean.dateISO, clean.lat, clean.lng]) : null;
}
function preferences(value) {
  const result = {};
  for (const field of PREFERENCE_FIELDS) result[field] = text(value?.[field]);
  return result;
}
function textFields(value, fields, max = 6000) {
  const result = {};
  for (const field of fields) if (typeof value?.[field] === 'string') result[field] = text(value[field], max);
  return result;
}
function planetBasis(value) {
  if (!object(value) || !text(value.name, 80)) return null;
  return { name: text(value.name, 80), lon: number(value.lon), sign: number(value.sign), house: number(value.house),
    speed: number(value.speed), retrograde: value.retrograde === true };
}
function aspect(value) {
  if (!object(value)) return null;
  return { ...textFields(value, ['a', 'b', 'other', 'aspect', 'phase', 'orbText', 'peerSource'], 500),
    angle: number(value.angle), orb: number(value.orb), cardIdx: number(value.cardIdx) };
}
function chapter(value) {
  if (!object(value)) return null;
  return { placeKey: text(value.placeKey || value.place || value.label, 160),
    startISO: text(value.startISO ?? value.from, 80), endISO: text(value.endISO ?? value.to, 80),
    approximate: value.approximate === true, open: value.open !== false };
}
function cleanBasis(value) {
  const birth = cleanBirth(value?.birth);
  if (!birth || !Array.isArray(value.natalPlanets) || !value.natalPlanets.length) return null;
  return { birth: { dateISO: birth.dateISO, lat: birth.lat, lng: birth.lng, timeUnknown: birth.timeUnknown },
    houseSystem: text(value.houseSystem, 30), orbScale: number(value.orbScale), sect: text(value.sect, 30),
    isDayChart: birth.timeUnknown ? null : typeof value.isDayChart === 'boolean' ? value.isDayChart : null,
    asc: number(value.asc), mc: number(value.mc),
    natalPlanets: value.natalPlanets.slice(0, 32).map(planetBasis).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)),
    natalAspects: Array.isArray(value.natalAspects) ? value.natalAspects.slice(0, 256).map(aspect).filter(Boolean) : [],
    chapters: Array.isArray(value.chapters) ? value.chapters.slice(0, 50).map(chapter).filter(Boolean) : [] };
}
function makeBasis(chart, context) {
  return cleanBasis({ birth: { ...chart.birth, timeUnknown: chart.timeUnknown === true || chart.birth.timeUnknown === true },
    houseSystem: chart.houseSystemActual || chart.birth.houseSystem,
    orbScale: chart.birth.orbScale ?? context?.input?.settings?.orbScale ?? 1,
    sect: chart.birth.sect || context?.input?.settings?.sect || 'auto', isDayChart: chart.isDayChart, asc: chart.asc, mc: chart.mc,
    natalPlanets: chart.planets, natalAspects: chart.aspectGrid,
    chapters: context?.input?.chapters || [] });
}
function cleanTrajectory(value) {
  return { status: value?.status === 'ready' ? 'ready' : 'unavailable', at: timestamp(value?.at),
    horizonDays: number(value?.horizonDays), scope: text(value?.scope, 1000), text: text(value?.text, 6000),
    hits: Array.isArray(value?.hits) ? value.hits.slice(0, 6).flatMap(hit => {
      const exactHitDate = timestamp(hit?.exactHitDate);
      return exactHitDate ? [{ ...textFields(hit, ['transitPlanet', 'natalPlanet', 'aspect'], 80), exactHitDate,
        exactHitJd: number(hit.exactHitJd), orbArcsec: number(hit.orbArcsec) }] : [];
    }) : [] };
}
function cleanSection(section) {
  if (!object(section) || !DOMAINS.slice(0, 5).includes(section.body)) return null;
  const anchor = { ...textFields(section.anchor, ['sign', 'degreeText', 'text', 'houseSystem'], 1000),
    lon: number(section.anchor?.lon), arcsec: number(section.anchor?.arcsec), house: number(section.anchor?.house) };
  return { ...textFields(section, ['body', 'title', 'source', 'text', 'uncertainty']), anchor,
    conditions: { dignity: { ...textFields(section.conditions?.dignity, ['kind', 'ruler'], 100), score: number(section.conditions?.dignity?.score) },
      term: text(section.conditions?.term, 80), face: text(section.conditions?.face, 80),
      retrograde: section.conditions?.retrograde === true, sect: text(section.conditions?.sect, 30),
      solar: section.conditions?.solar ? { condition: text(section.conditions.solar.condition, 80), separationArcsec: number(section.conditions.solar.separationArcsec) } : null },
    aspects: Array.isArray(section.aspects) ? section.aspects.slice(0, 32).map(aspect).filter(Boolean) : [],
    facts: Array.isArray(section.facts) ? section.facts.slice(0, 50).map(f => text(f, 1000)).filter(Boolean) : [],
    tension: { ...textFields(section.tension, ['interpretation', 'text']), facts: Array.isArray(section.tension?.facts) ? section.tension.facts.slice(0, 12).map(f => text(f, 1000)) : [] },
    trajectory: cleanTrajectory(section.trajectory), falsifier: textFields(section.falsifier, ['hypothesis', 'protocol', 'counterexample', 'text']),
    resonance: Array.isArray(section.resonance) ? section.resonance.slice(0, 32).map(relation => ({
      ...textFields(relation, ['body', 'aspect', 'orbText', 'phase', 'text', 'separationArcsec'], 1000), cardIdx: number(relation.cardIdx),
      lanes: Array.isArray(relation.lanes) ? relation.lanes.slice(0, 8).flatMap(lane => [2, 3, 5, 7, 11, 13, 17, 19].includes(lane?.prime) && /^\d+$/.test(String(lane.residue))
        ? [{ prime: lane.prime, residue: String(lane.residue).slice(0, 20) }] : []) : [],
    })) : [] };
}
function cleanAstrology(value, owner) {
  const birth = cleanBirth(value?.ownerBirth);
  if (!birth || ownerKey(birth) !== owner || !Array.isArray(value.sections)) return null;
  const seen = new Set();
  const sections = value.sections.map(cleanSection).filter(section => {
    if (!section || seen.has(section.body)) return false;
    seen.add(section.body); return true;
  }).slice(0, 5);
  if (!sections.length) return null;
  return { version: Number.isInteger(value.version) ? value.version : 1, ownerBirth: birth,
    source: 'computed chart with explicitly symbolic interpretation', readingAt: timestamp(value.readingAt),
    sections, text: text(value.text, 50000), limitation: text(value.limitation, 4000) || LIMITATION };
}
function suppliedFramework(context, birth) {
  const owner = ownerKey(birth);
  if (context?.input?.birth && ownerKey(context.input.birth) !== owner) return null;
  const candidate = context?.evidence?.hcrm || context?.evidence?.admittedLedgerAndHcrm;
  const data = candidate?.value || candidate;
  if (data?.status !== 'ready' || !Array.isArray(data.ledger) || !data.ledger.length) return null;
  try {
    for (const entry of data.ledger) {
      admitForCore(entry);
      if (timestamp(entry.event_id.split('#')[0]) !== cleanBirth(birth).dateISO) return null;
    }
    return { source: 'supplied admitted calculation record', status: 'admitted', at: timestamp(context?.at),
      entryCount: data.ledger.length, bodies: [...new Set(data.ledger.map(e => text(e.body, 80)))].slice(0, 32),
      certificateStatuses: [...new Set(data.ledger.map(e => e.certificate.status))],
      limitation: 'Ledger admission validates the integer calculation input contract; it does not validate a personality interpretation or measure behavior.' };
  } catch { return null; }
}
function cleanFramework(value) {
  if (!object(value) || value.status !== 'admitted' || !Number.isInteger(value.entryCount) || value.entryCount < 1) return null;
  const statuses = Array.isArray(value.certificateStatuses) ? value.certificateStatuses.filter(s => ['IMPORTED_INTEGER_LEDGER', 'CERTIFIED_EXACT_LEDGER'].includes(s)) : [];
  if (!statuses.length) return null;
  return { source: 'supplied admitted calculation record', status: 'admitted', at: timestamp(value.at), entryCount: value.entryCount,
    bodies: Array.isArray(value.bodies) ? value.bodies.slice(0, 32).map(v => text(v, 80)).filter(Boolean) : [],
    certificateStatuses: [...new Set(statuses)], limitation: 'Ledger admission validates the integer calculation input contract; it does not validate a personality interpretation or measure behavior.' };
}
function cleanObservation(value, owner) {
  if (!object(value) || value.ownerKey !== owner || value.source !== 'user' || !DOMAINS.includes(value.domain) ||
      !['check-in', 'reading-feedback'].includes(value.kind) || !text(value.id, 120) || !timestamp(value.at || value.createdAt)) return null;
  const rating = value.rating ?? null, agreement = value.agreement ?? null;
  if (rating !== null && (!Number.isInteger(rating) || rating < 0 || rating > 4)) return null;
  if (agreement !== null && !['fits', 'mixed', 'does-not-fit'].includes(agreement)) return null;
  if (value.contextAt != null && !timestamp(value.contextAt)) return null;
  return { id: text(value.id, 120), ownerKey: owner, domain: value.domain, kind: value.kind, rating, agreement,
    note: text(value.note, 2000), contextAt: timestamp(value.contextAt), readingId: text(value.readingId, 500) || null,
    source: 'user', at: timestamp(value.at || value.createdAt) };
}
function cleanRevision(value) {
  if (!object(value) || !text(value.id, 120) || !timestamp(value.at) || !['onboarding', 'baseline-update', 'framework-added', 'preferences', 'observation-add', 'observation-delete'].includes(value.kind)) return null;
  return { id: text(value.id, 120), at: timestamp(value.at), kind: value.kind,
    basisKey: text(value.basisKey, 64), observationCount: Math.min(MAX_OBSERVATIONS, Math.max(0, Math.trunc(number(value.observationCount) || 0))) };
}
function cleanProfile(value) {
  const birth = cleanBirth(value?.birth), owner = ownerKey(birth);
  if (!owner || value.version !== VERSION || value.ownerKey !== owner || !timestamp(value.createdAt) || !timestamp(value.updatedAt) ||
      !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.observations) || !Array.isArray(value.revisions)) return null;
  const basis = cleanBasis(value.baseline?.basis), astrology = cleanAstrology(value.baseline?.computedAstrology, owner);
  if (!basis || ownerKey(basis.birth) !== owner || !astrology || value.baseline.basisKey !== evidenceFingerprint(basis)) return null;
  const seen = new Set();
  const observations = value.observations.map(v => cleanObservation(v, owner)).filter(v => {
    if (!v || seen.has(v.id)) return false; seen.add(v.id); return true;
  }).slice(-MAX_OBSERVATIONS);
  return { version: VERSION, ownerKey: owner, birth, createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt), revision: value.revision,
    baseline: { basisKey: value.baseline.basisKey, basis, computedAstrology: astrology, admittedFramework: cleanFramework(value.baseline.admittedFramework) },
    selfReported: { preferences: preferences(value.selfReported?.preferences || value.preferences) }, observations,
    revisions: value.revisions.map(cleanRevision).filter(Boolean).slice(-MAX_REVISIONS), limitation: LIMITATION };
}
function storageFor(storage) { return storage || globalThis.localStorage; }
function readStore(storage) {
  try {
    const raw = storageFor(storage).getItem(STORAGE_KEY);
    if (!raw) return { version: VERSION, profiles: [] };
    const data = JSON.parse(raw);
    if (!object(data) || data.version !== VERSION || !Array.isArray(data.profiles)) return null;
    const seen = new Set();
    return { version: VERSION, profiles: data.profiles.map(cleanProfile).filter(profile => {
      if (!profile || seen.has(profile.ownerKey)) return false; seen.add(profile.ownerKey); return true;
    }).slice(0, MAX_PROFILES) };
  } catch { return null; }
}
function emit(owner, revision) {
  const event = Object.freeze({ ownerKey: owner, revision });
  for (const subscription of listeners) if (!subscription.owner || subscription.owner === owner) {
    try { subscription.listener(event); } catch { /* one subscriber cannot prevent others from refreshing */ }
  }
}
function writeStore(storage, profiles, owner, revision) {
  try { storageFor(storage).setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, profiles: profiles.slice(0, MAX_PROFILES) })); }
  catch { return false; }
  emit(owner, revision); return true;
}
function id(kind) {
  sequence += 1;
  const random = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${kind}-${random}`;
}
function revised(profile, kind) {
  const at = new Date().toISOString();
  return { ...profile, updatedAt: at, revision: profile.revision + 1,
    revisions: [...profile.revisions, { id: id('revision'), at, kind, basisKey: profile.baseline.basisKey, observationCount: profile.observations.length }].slice(-MAX_REVISIONS) };
}
function saveProfile(storage, store, profile) {
  const clean = cleanProfile(profile);
  if (!clean || !writeStore(storage, [clean, ...store.profiles.filter(p => p.ownerKey !== clean.ownerKey)], clean.ownerKey, clean.revision)) return null;
  return clone(clean);
}
export function loadProfile(birth, storage = null) {
  const owner = ownerKey(birth), store = readStore(storage);
  const profile = owner && store?.profiles.find(p => p.ownerKey === owner);
  return profile ? clone(profile) : null;
}
export function ensureProfile(chart, context = null, storage = null) {
  try {
    const birth = cleanBirth({ ...chart.birth, timeUnknown: chart.timeUnknown === true || chart.birth.timeUnknown === true });
    const owner = ownerKey(birth), store = readStore(storage), basis = makeBasis(chart, context);
    if (!owner || !store || !basis) return null;
    if (context?.input?.birth && ownerKey(context.input.birth) !== owner) return null;
    const basisKey = evidenceFingerprint(basis), previous = store.profiles.find(p => p.ownerKey === owner);
    const framework = suppliedFramework(context, birth);
    if (previous?.baseline.basisKey === basisKey) {
      if (framework && !previous.baseline.admittedFramework) return saveProfile(storage, store, revised({ ...previous,
        baseline: { ...previous.baseline, admittedFramework: framework } }, 'framework-added'));
      return clone(previous);
    }
    // The live UI may marry observations into behavioralProfile's prose.
    // The stored natal baseline must remain free of those private reports.
    const astroOnlyContext = context ? { ...context, evidence: Object.fromEntries(Object.entries(context.evidence || {}).filter(([name]) => name !== 'livingProfile')) } : null;
    const computedAstrology = cleanAstrology(behavioralProfile({ ...chart, birth, readingContext: astroOnlyContext }, astroOnlyContext), owner);
    if (!computedAstrology) return null;
    const baseline = { basisKey, basis, computedAstrology, admittedFramework: framework || previous?.baseline.admittedFramework || null };
    if (previous) return saveProfile(storage, store, revised({ ...previous, birth, baseline }, 'baseline-update'));
    const at = new Date().toISOString();
    return saveProfile(storage, store, { version: VERSION, ownerKey: owner, birth, createdAt: at, updatedAt: at, revision: 1,
      baseline, selfReported: { preferences: preferences(null) }, observations: [], limitation: LIMITATION,
      revisions: [{ id: id('revision'), at, kind: 'onboarding', basisKey, observationCount: 0 }] });
  } catch { return null; }
}
function mutate(birth, storage, apply, kind) {
  const owner = ownerKey(birth), store = readStore(storage), previous = store?.profiles.find(p => p.ownerKey === owner);
  if (!previous) return null;
  const next = apply(clone(previous));
  if (!next) return null;
  if (JSON.stringify(next) === JSON.stringify(previous)) return clone(previous);
  return saveProfile(storage, store, revised(next, kind));
}
export function updatePreferences(birth, fields, storage = null) {
  if (!object(fields)) return null;
  const allowed = {};
  for (const field of PREFERENCE_FIELDS) if (Object.hasOwn(fields, field)) {
    if (typeof fields[field] !== 'string') return null;
    allowed[field] = text(fields[field]);
  }
  return mutate(birth, storage, p => ({ ...p, selfReported: { preferences: { ...p.selfReported.preferences, ...allowed } } }), 'preferences');
}
export function addObservation(birth, observation, storage = null) {
  const owner = ownerKey(birth);
  if (!owner || !object(observation)) return null;
  const clean = cleanObservation({ ...observation, id: id('observation'), ownerKey: owner, at: new Date().toISOString() }, owner);
  if (!clean) return null;
  return mutate(birth, storage, p => ({ ...p, observations: [...p.observations, clean].slice(-MAX_OBSERVATIONS) }), 'observation-add');
}
export function deleteObservation(birth, observationId, storage = null) {
  if (typeof observationId !== 'string') return null;
  return mutate(birth, storage, p => p.observations.some(o => o.id === observationId)
    ? { ...p, observations: p.observations.filter(o => o.id !== observationId) } : null, 'observation-delete');
}
export function clearProfile(birth, storage = null) {
  const owner = ownerKey(birth), store = readStore(storage);
  if (!owner || !store) return false;
  if (!store.profiles.some(p => p.ownerKey === owner)) return true;
  return writeStore(storage, store.profiles.filter(p => p.ownerKey !== owner), owner, 0);
}
export function getRevision(birth, storage = null) { return loadProfile(birth, storage)?.revision || 0; }
export function subscribe(birthOrListener, listener = null) {
  const callback = typeof birthOrListener === 'function' ? birthOrListener : listener;
  if (typeof callback !== 'function') return () => {};
  const owner = typeof birthOrListener === 'function' ? null : ownerKey(birthOrListener);
  if (typeof birthOrListener !== 'function' && !owner) return () => {};
  const subscription = { owner, listener: callback }; listeners.add(subscription);
  return () => listeners.delete(subscription);
}
function observationSummary(observations) {
  const ratings = observations.filter(o => o.rating !== null).map(o => o.rating);
  const agreement = { fits: 0, mixed: 0, 'does-not-fit': 0 };
  for (const entry of observations) if (entry.agreement !== null) agreement[entry.agreement] += 1;
  return { count: observations.length, checkIns: observations.filter(o => o.kind === 'check-in').length,
    readingFeedback: observations.filter(o => o.kind === 'reading-feedback').length,
    ratings: { count: ratings.length, mean: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      latest: ratings.length ? ratings[ratings.length - 1] : null, scale: 'Self-reported 0–4; descriptive, not a validated personality score' },
    agreement, history: clone(observations) };
}
export function summarizeProfile(profile) {
  const clean = cleanProfile(profile);
  if (!clean) return null;
  const domains = clean.baseline.computedAstrology.sections.map(section => ({ id: section.body, body: section.body, title: section.title,
    astrology: clone(section), ...observationSummary(clean.observations.filter(o => o.domain === section.body)) }));
  const credited = new Set(), days = new Set(); let checkInCreditCount = 0, feedbackCreditCount = 0;
  for (const observation of clean.observations) {
    const day = observation.at.slice(0, 10); days.add(day);
    const key = `${day}:${observation.kind}:${observation.kind === 'reading-feedback' ? observation.readingId || observation.domain : observation.domain}`;
    if (credited.has(key)) continue; credited.add(key);
    if (observation.kind === 'check-in') checkInCreditCount += 1; else feedbackCreditCount += 1;
  }
  const xp = 5 + checkInCreditCount * 10 + feedbackCreditCount * 5, level = 1 + Math.floor(xp / 100);
  return { version: VERSION, ownerKey: clean.ownerKey, revision: clean.revision, createdAt: clean.createdAt, updatedAt: clean.updatedAt,
    source: 'An integrated astrological avatar, informed by computed chart facts and your self-reported experience',
    baselineBasisKey: clean.baseline.basisKey, domains,
    cognitive: { title: 'Your reported thinking and learning preferences', source: 'self-reported',
      preferences: Object.fromEntries(['learningStyle', 'decisionStyle', 'attention', 'routines'].map(key => [key, clean.selfReported.preferences[key]])),
      ...observationSummary(clean.observations.filter(o => o.domain === 'cognitive')) },
    preferences: { ...clean.selfReported.preferences }, preferenceObservations: observationSummary(clean.observations.filter(o => o.domain === 'preferences')),
    observationCount: clean.observations.length, history: clone(clean.observations), revisionHistory: clone(clean.revisions),
    admittedFramework: clone(clean.baseline.admittedFramework),
    engagement: { xp, level, nextLevelXp: level * 100, checkInCreditCount, feedbackCreditCount, participationDays: days.size,
      label: 'Participation level', source: 'Participation in the retained journal; agreement and disagreement earn identical points',
      repeatPolicy: 'One credited check-in per domain/day and one feedback credit per reading/day; repeated observations remain in your journal.' },
    quests: domains.map(domain => ({ id: `observe-${domain.body}`, body: domain.body, domain: domain.body, title: domain.title,
      anchor: clone(domain.astrology.anchor), aspects: clone(domain.astrology.aspects), trajectory: clone(domain.astrology.trajectory),
      hypothesis: domain.astrology.falsifier.hypothesis || '', protocol: domain.astrology.falsifier.protocol || '', prompt: domain.astrology.falsifier.protocol || '',
      counterexample: domain.astrology.falsifier.counterexample || '', source: 'Computed chart anchor with a symbolic hypothesis; observations are self-reported',
      points: 10, goal: clean.selfReported.preferences.goals || null })), limitation: LIMITATION };
}
if (typeof window !== 'undefined') window.LivingProfile = { STORAGE_KEY, VERSION, MAX_PROFILES, MAX_OBSERVATIONS, MAX_REVISIONS,
  DOMAINS, PREFERENCE_FIELDS, ownerKey, loadProfile, ensureProfile, updatePreferences, addObservation, deleteObservation,
  clearProfile, summarizeProfile, getRevision, subscribe };
