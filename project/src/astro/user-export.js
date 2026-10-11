import { zipSync, strToU8 } from '../../vendor/fflate.js';
import { profileKey } from './reading-runs.js';

const BIRTH_FIELDS = ['dateISO', 'lat', 'lng', 'tz', 'subjectName', 'placeLabel',
  'placeKey', 'timeUnknown', 'houseSystem', 'sect', 'orbScale'];
const CHART_FIELDS = ['jd', 'asc', 'mc', 'desc', 'ic', 'ascSignIdx', 'mcSignIdx',
  'isDayChart', 'timeUnknown', 'houseSystemActual', 'houseCusps', 'planets', 'cards',
  'lots', 'phase', 'shape', 'aspectGrid', 'antisciaContacts', 'joys', 'receptions',
  'elementCount', 'modalityCount', 'hemisphereCount', 'quadrantCount', 'stelliums',
  'patterns', 'ascR11', 'outOfBounds', 'voidOfCourse', 'obliquity', 'positionWarnings',
  'relocated', 'relocatedPlace'];
const PRIVATE_FIELD = /(?:api.?keys?|access.?token|refresh.?token|authorization|password|secret|cookie|credentials?|private.?key|session.?token|elevenlabs.?key|provider.?key)/i;
const UNSAFE_FIELD = /^(?:__proto__|prototype|constructor)$/;
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra',
  'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
const MAX_BYTES = 20 * 1024 * 1024;

// Read data properties only: do not call getters, toJSON or application code.
// Files are selected explicitly; arbitrary localStorage/cookies are never read.
export function safeSnapshot(value, state = { nodes: 0, ancestors: new Set() }, depth = 0) {
  if (++state.nodes > 2000000 || depth > 24) throw new RangeError('Export data exceeds the snapshot limit');
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return undefined;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (state.ancestors.has(value)) return '[circular reference omitted]';
  state.ancestors.add(value);
  const output = Array.isArray(value) ? [] : Object.create(null);
  for (const [key, property] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (!property.enumerable || !('value' in property) || PRIVATE_FIELD.test(key) || UNSAFE_FIELD.test(key)) continue;
    const clean = safeSnapshot(property.value, state, depth + 1);
    if (clean !== undefined) output[key] = clean;
  }
  state.ancestors.delete(value);
  return output;
}
function select(value, keys) {
  const output = {};
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value || {}, key);
    if (property && 'value' in property) output[key] = property.value;
  }
  return safeSnapshot(output);
}
export function chartSnapshot(chart) {
  return { birth: select(chart.birth, BIRTH_FIELDS), ...select(chart, CHART_FIELDS) };
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;',
    '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function ownerOf(birth) {
  if (!birth || !Number.isFinite(new Date(birth.dateISO).getTime())
    || !Number.isFinite(birth.lat) || Math.abs(birth.lat) > 90
    || !Number.isFinite(birth.lng) || Math.abs(birth.lng) > 180) throw new RangeError('Valid personal birth record required for export');
  return profileKey(birth);
}
export function collectPersonalData({ chart, context = null, narrative = null,
  cardReadings = [], runs = [], profile = null, additional = {}, exportedAt = new Date() }) {
  const owner = ownerOf(chart && chart.birth);
  if (context && (context.profileKey !== owner || ownerOf(context.input && context.input.birth) !== owner))
    throw new Error('Reading context belongs to a different profile');
  const ownedRuns = runs.filter(run => {
    try { return run.profileKey === owner && ownerOf(run.input.birth) === owner; }
    catch { return false; }
  }).slice(0, 50);
  let ownedProfile = null;
  try { if (profile && ownerOf(profile.settings) === owner) ownedProfile = {
    settings: select(profile.settings, BIRTH_FIELDS), birthForm: profile.birthForm,
    chapters: profile.chapters, savedAt: profile.savedAt }; } catch { /* unrelated/invalid profile */ }
  return safeSnapshot({ schema: 'resonance-personal-export-v1', exportedAt: new Date(exportedAt).toISOString(),
    owner, subject: chart.birth.subjectName || 'Your chart', chart: chartSnapshot(chart),
    context: context ? { at: context.at, jd: context.jd, input: context.input,
      evidence: context.evidence, limitations: context.limitations, modelRevision: context.input.modelRevision } : null,
    readings: { text: narrative && narrative.text || '', segments: narrative && narrative.segments || [], cardReadings },
    runs: ownedRuns, profile: ownedProfile, additional });
}
export function natalChartSvg(chart) {
  const radial = (longitude, radius) => {
    const radians = (longitude - 90) * Math.PI / 180;
    return [250 + radius * Math.cos(radians), 250 + radius * Math.sin(radians)];
  };
  const marks = [];
  for (let sign = 0; sign < 12; sign++) {
    const [x, y] = radial(sign * 30, 215), [tx, ty] = radial(sign * 30 + 15, 232);
    marks.push(`<line x1="250" y1="250" x2="${x}" y2="${y}" stroke="#b8b6ac" stroke-width=".6"/><text x="${tx}" y="${ty}" text-anchor="middle" fill="#3c4354" font-size="20">${GLYPHS[sign]}</text>`);
  }
  for (const [i, planet] of (chart.planets || []).entries()) {
    if (!Number.isFinite(planet.lon)) continue;
    const radius = 120 + (i % 4) * 19, [x, y] = radial(planet.lon, radius);
    marks.push(`<circle cx="${x}" cy="${y}" r="3" fill="#6e3d82"/><text x="${x}" y="${y - 7}" font-size="11" text-anchor="middle" fill="#352945">${escapeHtml(planet.glyph || planet.name)}<title>${escapeHtml(`${planet.name}: ${planet.lon.toFixed(4)}°`)}</title></text>`);
  }
  const cusps = !chart.timeUnknown ? chart.houseCusps || Array.from({ length: 12 }, (_, i) =>
    chart.houseSystemActual === 'whole' ? ((chart.ascSignIdx + i) % 12) * 30 : (chart.asc + i * 30) % 360) : [];
  cusps.forEach((lon, i) => {
    const [x, y] = radial(lon, 206), [tx, ty] = radial(lon + 2, 197);
    marks.push(`<line x1="250" y1="250" x2="${x}" y2="${y}" stroke="#97723f" stroke-width=".7" stroke-dasharray="3 3"/><text x="${tx}" y="${ty}" font-size="10" fill="#73511f">${i + 1}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500" role="img" aria-labelledby="title desc"><title id="title">Natal chart for ${escapeHtml(chart.birth.subjectName || 'your chart')}</title><desc id="desc">Geocentric tropical longitude wheel. Aries starts at the top; longitude increases clockwise. Dashed lines are computed house cusps. Label rows stagger to reduce overlap.</desc><rect width="500" height="500" fill="#faf8f2"/><circle cx="250" cy="250" r="215" fill="none" stroke="#3c4354"/>${marks.join('')}<circle cx="250" cy="250" r="70" fill="#faf8f2"/><text x="250" y="245" text-anchor="middle" font-size="16" fill="#3c4354">Natal chart</text><text x="250" y="267" text-anchor="middle" font-size="11" fill="#3c4354">${escapeHtml(chart.timeUnknown ? 'Birth time unknown' : chart.houseSystemActual)}</text></svg>`;
}
export function archiveReport(data) {
  const c = data.chart, subject = escapeHtml(data.subject);
  const rows = (c.planets || []).map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(SIGNS[p.sign])}</td><td>${Number(p.lon).toFixed(4)}°</td><td>${c.timeUnknown ? 'Unknown' : escapeHtml(p.house)}</td><td>${escapeHtml(p.dignity && p.dignity.kind)}</td><td>${escapeHtml(p.positionSource)}</td></tr>`).join('');
  const history = data.runs.map(run => `<details><summary>${escapeHtml(run.at)}</summary><p class="reading">${escapeHtml(run.reading)}</p></details>`).join('');
  const limitations = data.context && data.context.limitations || c.positionWarnings || [];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'"><title>${subject} — saved astrology reading</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:960px;margin:auto;padding:24px;color:#252936;background:#faf8f2}h1,h2{line-height:1.3}.reading{white-space:pre-wrap;overflow-wrap:anywhere}svg{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{padding:9px;text-align:left;border-bottom:1px solid #c9c9c0}.scroll{overflow:auto}summary{cursor:pointer;padding:12px}li{margin:6px 0}code{overflow-wrap:anywhere}</style><h1>${subject}</h1><p>Birth record: ${escapeHtml(c.birth.dateISO)} · ${escapeHtml(c.birth.placeLabel)} · ${escapeHtml(c.birth.lat)}°, ${escapeHtml(c.birth.lng)}°</p><p>Reading instant: ${escapeHtml(data.context && data.context.at || data.exportedAt)}. Saved: ${escapeHtml(data.exportedAt)}.</p>${natalChartSvg(c)}<div class="scroll"><table><caption>Natal placements and source</caption><thead><tr><th>Body</th><th>Sign</th><th>Longitude</th><th>House</th><th>Dignity</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div><h2>Your reading</h2><p class="reading">${escapeHtml(data.readings.text || 'No narrative was composed. Computed chart data is included.')}</p><h2>Saved readings (${data.runs.length})</h2>${history}<h2>Calculation assumptions</h2><ul>${limitations.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><p>All calculation snapshots and admitted ledgers are in the data folder. No internet connection is required to read this report.</p></html>`;
}
export async function buildPersonalZip(data, { crypto = globalThis.crypto } = {}) {
  if (!data || data.schema !== 'resonance-personal-export-v1' || ownerOf(data.chart.birth) !== data.owner) throw new Error('Invalid personal export snapshot');
  const files = {
    'report.html': strToU8(archiveReport(data)),
    'charts/natal.svg': strToU8(natalChartSvg(data.chart)),
    'data/personal-data.json': strToU8(JSON.stringify(data, null, 2)),
    'readings/current.txt': strToU8(data.readings.text),
    'README.txt': strToU8('Resonance personal archive\n\nExtract this ZIP and open report.html to read it offline.\ncharts/natal.svg: vector natal chart.\ndata/personal-data.json: complete selected-user snapshot, readings, prior runs, calculated charts, provenance and availability.\nmanifest.json: format, owner and SHA-256 file checksums where available.\n\nThe archive contains personal birth information and readings. It contains no provider credentials and makes no network requests. It is a snapshot, not a cross-device account or automatic backup.\n'),
  };
  if (data.profile) files['data/saved-profile.json'] = strToU8(JSON.stringify(data.profile, null, 2));
  data.runs.forEach((run, index) => {
    const number = String(index + 1).padStart(2, '0');
    files[`history/${number}.json`] = strToU8(JSON.stringify(run, null, 2));
    files[`history/${number}.txt`] = strToU8(run.reading);
  });
  const bytes = Object.values(files).reduce((sum, file) => sum + file.length, 0);
  if (bytes > MAX_BYTES) throw new RangeError('This snapshot exceeds 20 MiB; export fewer saved runs');
  const checksums = await Promise.all(Object.entries(files).map(async ([path, content]) => {
    const hash = crypto && crypto.subtle ? await crypto.subtle.digest('SHA-256', content) : null;
    return { path, bytes: content.length, sha256: hash ? Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('') : null };
  }));
  const manifest = { schema: data.schema, exportedAt: data.exportedAt, subject: data.subject,
    profileKey: data.owner, runCount: data.runs.length, files: checksums,
    checksumStatus: checksums.every(f => f.sha256) ? 'SHA-256' : 'unavailable in this environment',
    credentialPolicy: 'Explicit profile/chart/run inputs only; credential fields omitted; no arbitrary storage or cookies.' };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const slug = String(data.subject).normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'personal';
  return { bytes: zipSync(files, { level: 6, mtime: new Date('2000-01-01T00:00:00Z') }), manifest,
    filename: `resonance-${slug}-${data.exportedAt.slice(0, 10)}.zip` };
}
if (typeof window !== 'undefined') window.UserExport = { collectPersonalData, buildPersonalZip, chartSnapshot, safeSnapshot };
