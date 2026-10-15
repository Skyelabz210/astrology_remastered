import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { collectPersonalData, safeSnapshot, buildPersonalZip, archiveReport, natalChartSvg } from '../../src/astro/user-export.js';
import { profileKey } from '../../src/astro/reading-runs.js';

// Parse standard ZIP central directory and inflate with Node's zlib, independently
// of the archive writer/reader. This verifies compression interoperability.
function inflateStandardZip(bytes) {
  const b = Buffer.from(bytes), files = {}, count = b.readUInt16LE(b.length - 12);
  let pos = b.readUInt32LE(b.length - 6);
  for (let i = 0; i < count; i++) {
    if (b.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid central directory');
    const method = b.readUInt16LE(pos + 10), size = b.readUInt32LE(pos + 20);
    const nameLength = b.readUInt16LE(pos + 28), extraLength = b.readUInt16LE(pos + 30), commentLength = b.readUInt16LE(pos + 32);
    const local = b.readUInt32LE(pos + 42), name = b.subarray(pos + 46, pos + 46 + nameLength).toString('utf8');
    if (b.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid local file header');
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const compressed = b.subarray(start, start + size);
    files[name] = method === 0 ? compressed : inflateRawSync(compressed);
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
export async function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  const birth = { dateISO: '1993-06-10T11:45:00Z', lat: -33.8688, lng: 151.2093,
    tz: 'Australia/Sydney', subjectName: 'Renée', placeLabel: 'Sydney', houseSystem: 'whole' };
  const otherBirth = { ...birth, subjectName: 'Another person', lat: 51.5, lng: 0 };
  const owner = profileKey(birth);
  const chart = { birth, jd: 2449148.989583333, asc: 5, mc: 280, ascSignIdx: 0, mcSignIdx: 9,
    isDayChart: true, houseSystemActual: 'whole', planets: [
      { name: 'Sun', lon: 79.5, sign: 2, house: 3, arcsec: 286200,
        dignity: { kind: 'neutral' }, positionSource: 'ephemeris', glyph: '☉' },
    ], cards: [], lots: [], aspectGrid: [], positionWarnings: ['Numerical ephemeris'] };
  const context = { at: '2026-10-11T12:00:00.000Z', jd: 2461325, profileKey: owner,
    input: { birth, chapters: [], modelRevision: 'personal-reading-v1' },
    evidence: { transits: { status: 'ready', value: { hits: [] } } }, limitations: ['Geocentric tropical positions'] };
  const ownRun = { version: 1, id: 'own', profileKey: owner, at: context.at,
    input: { birth }, evidence: { natal: chart }, reading: 'Renée: Sun in Gemini.' };
  const foreignRun = { ...ownRun, id: 'other', profileKey: profileKey(otherBirth), input: { birth: otherBirth }, reading: 'PRIVATE OTHER READING' };
  const forgedRun = { ...foreignRun, profileKey: owner };
  let getterCalled = false;
  const guarded = { plain: 1, apiKey: 'API-SECRET', accessToken: 'TOKEN-SECRET',
    elevenLabsApiKey: 'VOICE-SECRET', nested: { secret: 'NESTED-SECRET', value: 123n },
    get unsafeGetter() { getterCalled = true; throw new Error('should not run'); }, toJSON() { throw new Error('should not run'); } };
  const clean = safeSnapshot(guarded);
  t('snapshot does not invoke getters or toJSON', !getterCalled && clean.plain === 1);
  t('credentials removed recursively and BigInts survive as strings', clean.apiKey === undefined && clean.accessToken === undefined && clean.elevenLabsApiKey === undefined && clean.nested.secret === undefined && clean.nested.value === '123');
  guarded.loop = guarded;
  t('cycles do not break export', safeSnapshot(guarded).loop === '[circular reference omitted]');
  const profile = { settings: { ...birth, apiKey: 'PROFILE-SECRET' }, birthForm: { subjectName: birth.subjectName, providerKey: 'FORM-SECRET' }, chapters: [] };
  const data = collectPersonalData({ chart, context, narrative: { text: 'Renée: Sun in Gemini.', segments: [] },
    runs: [ownRun, foreignRun, forgedRun], profile, additional: { diagnostics: guarded }, exportedAt: context.at });
  t('unrelated and forged owner records are excluded', data.runs.length === 1 && data.runs[0].id === 'own');
  t('only the selected owner profile is collected', data.profile.settings.subjectName === 'Renée');
  const foreignProfile = collectPersonalData({ chart, profile: { ...profile, settings: otherBirth } });
  t('foreign saved profile is excluded', foreignProfile.profile === null);
  t('equivalent UTC spellings identify the same user', profileKey(birth) === profileKey({ ...birth, dateISO: '1993-06-10T21:45:00+10:00' }));
  let wrongContext = false; try { collectPersonalData({ chart, context: { ...context, profileKey: 'other' } }); } catch { wrongContext = true; }
  t('context cannot be mixed into a different profile archive', wrongContext);
  let forgedContext = false; try { collectPersonalData({ chart,
    context: { ...context, input: { ...context.input, birth: otherBirth } } }); } catch { forgedContext = true; }
  t('context ownership also verifies the actual birth record', forgedContext);
  let badBirth = false; try { collectPersonalData({ chart: { ...chart, birth: { ...birth, lat: Infinity } } }); } catch { badBirth = true; }
  t('invalid owner coordinates fail before ZIP creation', badBirth);
  const zip = await buildPersonalZip(data);
  t('Unicode names produce portable filenames', /^resonance-Renee-.*\.zip$/.test(zip.filename));
  const files = unzipSync(zip.bytes), nativeFiles = inflateStandardZip(zip.bytes);
  t('ZIP has all expected persistent artifacts', ['report.html', 'charts/natal.svg', 'data/personal-data.json', 'data/saved-profile.json', 'history/01.json', 'history/01.txt', 'readings/current.txt', 'manifest.json', 'README.txt'].every(name => name in files));
  t('standard zlib inflates every file identically', Object.keys(files).every(name => Buffer.from(files[name]).equals(nativeFiles[name])));
  const exported = strFromU8(files['data/personal-data.json']);
  t('archive contains computed chart and reading', exported.includes('286200') && exported.includes('Renée: Sun in Gemini.'));
  t('archive excludes unrelated readings and credentials', !/PRIVATE OTHER READING|API-SECRET|TOKEN-SECRET|VOICE-SECRET|PROFILE-SECRET|FORM-SECRET|NESTED-SECRET/.test(exported));
  t('manifest checksums match independently hashed file bytes', zip.manifest.files.every(f => f.sha256 === createHash('sha256').update(files[f.path]).digest('hex') && f.bytes === files[f.path].length));
  t('manifest names the owner and bounded run count', zip.manifest.profileKey === owner && zip.manifest.runCount === 1);
  t('offline report embeds chart and reading with no external script', strFromU8(files['report.html']).includes('<svg') && strFromU8(files['report.html']).includes('Renée: Sun in Gemini.') && !strFromU8(files['report.html']).includes('<script'));
  const malicious = { ...data, subject: '../<script>alert(1)</script>', chart: { ...data.chart,
    birth: { ...data.chart.birth, subjectName: '../<script>alert(1)</script>' }, planets: [{ ...chart.planets[0], name: '<img src=x onerror=alert(1)>' }] } };
  t('report escapes user labels', !archiveReport(malicious).includes('<script>') && !archiveReport(malicious).includes('<img src=x'));
  t('SVG escapes chart labels', !natalChartSvg(malicious.chart).includes('<script>') && !natalChartSvg(malicious.chart).includes('<img src=x'));
  const noCrypto = await buildPersonalZip(data, { crypto: null });
  t('missing checksum capability is explicit, not a fake certificate', noCrypto.manifest.checksumStatus === 'unavailable in this environment' && noCrypto.manifest.files.every(f => f.sha256 === null));
  const unknown = { ...chart, timeUnknown: true, birth: { ...birth, timeUnknown: true } };
  t('unknown birth time archive does not draw asserted house cusps', !natalChartSvg(unknown).includes('stroke-dasharray'));
  t('unknown birth time report withholds placement houses', archiveReport(collectPersonalData({ chart: unknown })).includes('<td>Unknown</td>'));
  const repeats = Array.from({ length: 60 }, (_, i) => ({ ...ownRun, id: `run-${i}` }));
  t('collection bounds saved runs', collectPersonalData({ chart, runs: repeats }).runs.length === 50);
  const moduleSource = readFileSync(new URL('../../src/astro/user-export.js', import.meta.url), 'utf8');
  t('collector never reads arbitrary browser storage or cookies', !/localStorage|document\.cookie|sessionStorage/.test(moduleSource.replace(/\/\/[^\n]*/g, '')));
  t('vendored ZIP implementation matches the locked upstream version', readFileSync(new URL('../../vendor/fflate.js', import.meta.url), 'utf8') === readFileSync(new URL('../../node_modules/fflate/esm/browser.js', import.meta.url), 'utf8'));
  const avatarOwner = JSON.stringify([new Date(birth.dateISO).toISOString(),birth.lat,birth.lng]);
  const avatar = {profile:{ownerKey:avatarOwner,birth,observations:[{note:"A counterexample I want to keep",domain:"Sun",rating:0}]},summary:{ownerKey:avatarOwner,engagement:{xp:10,level:1},observationCount:1,preferences:{goals:"Finish my project"},history:[{at:"2026-10-14T12:00:00Z",domain:"Sun",note:"A counterexample I want to keep",rating:0}],limitation:"Participation is not proof"}};
  const avatarData = collectPersonalData({chart,additional:{livingAvatar:{status:"ready",value:avatar}}});
  const avatarZip = await buildPersonalZip(avatarData);
  const avatarFiles = unzipSync(avatarZip.bytes);
  t("living avatar and full journal have portable JSON entries",JSON.parse(strFromU8(avatarFiles["profile/living-avatar.json"])).observations[0].note==="A counterexample I want to keep" && avatarFiles["profile/avatar-summary.json"]);
  t("offline report includes goals and authored counterexamples",strFromU8(avatarFiles["report.html"]).includes("Finish my project") && strFromU8(avatarFiles["report.html"]).includes("A counterexample I want to keep"));
  const foreignAvatarData = collectPersonalData({chart,additional:{livingAvatar:{status:"ready",value:{...avatar,profile:{...avatar.profile,ownerKey:"foreign"}}}}});
  t("another birth's living avatar is excluded from archive",foreignAvatarData.additional.livingAvatar.status==="unavailable" && !archiveReport(foreignAvatarData).includes("A counterexample I want to keep"));
  return rows;
}
