// Browser-local, bounded calculation snapshots. Each run keeps its own inputs
// and evidence; a later run supplements history rather than changing birth data.
export const RUNS_KEY = 'resonance.reading-runs.v1';
export const RUNS_MAX = 50;
// Compact deterministic cache identifier, not an authentication certificate.
// FNV-1a 128 over UTF-16 bytes keeps repeated input snapshots out of cache keys.
export function evidenceFingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  const prime = 0x1000000000000000000013bn, mask = (1n << 128n) - 1n;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    hash = ((hash ^ BigInt(code & 255)) * prime) & mask;
    hash = ((hash ^ BigInt(code >> 8)) * prime) & mask;
  }
  return hash.toString(16).padStart(32, '0');
}
export function profileKey(birth) {
  return JSON.stringify([new Date(birth.dateISO).toISOString(), birth.lat, birth.lng, birth.tz || null,
    birth.subjectName || 'You', !!birth.timeUnknown]);
}
export function loadRuns(storage, owner = null) {
  try {
    storage = storage || globalThis.localStorage;
    const data = JSON.parse(storage.getItem(RUNS_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(r => r && r.version === 1 && typeof r.id === 'string'
      && typeof r.profileKey === 'string' && Number.isFinite(new Date(r.at).getTime())
      && r.input && r.evidence && typeof r.reading === 'string')
      .slice(0, RUNS_MAX).filter(r => owner === null || r.profileKey === owner);
  } catch { return []; }
}
export function saveRun(storage, run) {
  try {
    storage = storage || globalThis.localStorage;
    const clean = JSON.parse(JSON.stringify(run));
    if (!clean || clean.version !== 1 || typeof clean.id !== 'string'
      || typeof clean.profileKey !== 'string' || !Number.isFinite(new Date(clean.at).getTime())
      || !clean.input || !clean.evidence || typeof clean.reading !== 'string') return false;
    const rows = loadRuns(storage).filter(r => r.id !== clean.id);
    storage.setItem(RUNS_KEY, JSON.stringify([clean, ...rows].slice(0, RUNS_MAX)));
    return true;
  } catch { return false; }
}
export function clearRuns(storage, owner) {
  try {
    storage = storage || globalThis.localStorage;
    storage.setItem(RUNS_KEY, JSON.stringify(loadRuns(storage).filter(r => r.profileKey !== owner)));
    return true;
  } catch { return false; }
}
export function attachEvidence(storage, id, section, value) {
  const run = loadRuns(storage).find(r => r.id === id);
  if (!run) return false;
  return saveRun(storage, { ...run, evidence: { ...run.evidence, [section]: value } });
}
if (typeof window !== 'undefined') window.ReadingRuns = { profileKey, loadRuns, saveRun, clearRuns, attachEvidence, evidenceFingerprint, RUNS_MAX };
