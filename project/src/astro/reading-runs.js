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
function validRun(run) {
  try {
    const birth = run && run.input && run.input.birth;
    return !!(run && run.version === 1 && typeof run.id === 'string'
      && typeof run.profileKey === 'string' && Number.isFinite(new Date(run.at).getTime())
      && birth && Number.isFinite(birth.lat) && Math.abs(birth.lat) <= 90
      && Number.isFinite(birth.lng) && Math.abs(birth.lng) <= 180
      && run.profileKey === profileKey(birth) && run.evidence && typeof run.reading === 'string');
  } catch { return false; }
}
export function loadRuns(storage, owner = null) {
  try {
    storage = storage || globalThis.localStorage;
    const data = JSON.parse(storage.getItem(RUNS_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.filter(validRun)
      .slice(0, RUNS_MAX).filter(r => owner === null || r.profileKey === owner);
  } catch { return []; }
}
export function saveRun(storage, run) {
  try {
    storage = storage || globalThis.localStorage;
    const clean = JSON.parse(JSON.stringify(run));
    if (!validRun(clean)) return false;
    const rows = loadRuns(storage).filter(r => r.id !== clean.id || r.profileKey !== clean.profileKey);
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
export function attachEvidence(storage, id, section, value, owner = null) {
  const matches = loadRuns(storage, owner).filter(r => r.id === id);
  if (matches.length !== 1) return false;
  const run = matches[0];
  return saveRun(storage, { ...run, evidence: { ...run.evidence, [section]: value } });
}
if (typeof window !== 'undefined') window.ReadingRuns = { profileKey, loadRuns, saveRun, clearRuns, attachEvidence, evidenceFingerprint, RUNS_MAX };
