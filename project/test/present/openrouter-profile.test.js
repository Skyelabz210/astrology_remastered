import { createOpenRouter, freeVisionModels } from '../../src/present/openrouter.js';
import { behavioralProfile } from '../../src/present/behavioral-profile.js';
import { matchesPlace } from '../../src/present/place-search.js';
export async function run() {
  const rows = [], test = (name, ok) => rows.push({ name, ok: !!ok });
  const vision = { id: 'qwen/qwen-vl:free', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text','image'], output_modalities: ['text'] } };
  test('only zero-price open-weight vision models qualify', freeVisionModels([vision, { ...vision, id: 'qwen/paid', pricing: { prompt: '1', completion: '0' } }, { ...vision, id: 'closed/vision:free' }, { ...vision, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }]).length === 1);
  const calls = [];
  const client = createOpenRouter(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => url.endsWith('/models') ? { data: [vision] } : { choices: [{ message: { content: 'Sun in Libra' } }] } }; });
  test('no credential means unavailable', !client.available());
  await client.models();
  let rejected = false; try { client.configure('key', 'unverified/model:free'); } catch { rejected = true; }
  test('unverified model rejected', rejected);
  client.configure('key', vision.id);
  test('verified configuration becomes available', client.available());
  test('completion returned', await client.complete('verified facts', 'data:image/png;base64,AA==') === 'Sun in Libra');
  const request = JSON.parse(calls[1].options.body);
  test('sends image and text to multimodal endpoint', request.messages[0].content[1].type === 'image_url' && request.messages[0].content[0].text === 'verified facts');
  test('provider price ceiling prevents paid fallback', request.provider.max_price.prompt === 0 && request.provider.max_price.completion === 0);
  test('key stays out of prompt body', !calls[1].options.body.includes('"key"') && calls[1].options.headers.Authorization === 'Bearer key');
  const queued = client.complete('must not be sent');
  client.setConsent(false);
  let cancelled = false; try { await queued; } catch (error) { cancelled = error.message.includes('permission changed'); }
  test('withdrawing permission cancels queued birth-data requests', cancelled && calls.length === 2);
  client.setConsent(true);
  client.disconnect(); test('disconnect makes interpreter unavailable', !client.available());
  let errorText = ''; try { await client.complete('facts'); } catch (error) { errorText = error.message; }
  test('disconnected requests fail before transport', errorText.includes('Connect OpenRouter') && calls.length === 2);
  const limited = createOpenRouter(async url => url.endsWith('/models') ? { ok: true, json: async () => ({ data: [vision] }) } : { ok: false, status: 429 });
  await limited.models(); limited.configure('key', vision.id);
  try { await limited.complete('facts'); } catch (error) { errorText = error.message; }
  test('rate limit exposes useful fallback message', errorText.includes('limit reached') && errorText.includes('local reading'));
  test('typos match canonical place suggestions', matchesPlace('san antonoi', 'San Antonio TX'));
  test('old base names match canonical aliases', matchesPlace('ft bragg', 'Fort Liberty Bragg NC Fort Bragg'));
  test('accent differences match', matchesPlace('sao paulo', 'São Paulo BR'));
  test('unrelated place does not match', !matchesPlace('london', 'San Antonio TX'));
  const birth = { dateISO: '1980-10-21T21:31:00Z', lat: 35.14, lng: -79, subjectName: 'One' };
  const chart = { birth, timeUnknown: true, planets: [{ name: 'Sun', sign: 6 }, { name: 'Moon', sign: 11 }, { name: 'Mercury', sign: 7 }, { name: 'Venus', sign: 5 }, { name: 'Mars', sign: 8 }] };
  const profile = behavioralProfile(chart);
  test('behavioral profile covers five computed domains', profile.sections.length === 5);
  test('computed placement anchors every domain', profile.sections.every(s => s.text.includes(s.source)));
  test('unknown birth time marks Moon uncertainty', profile.sections.find(s => s.body === 'Moon').uncertainty.includes('assumed birth time'));
  test('profile is bound to its birth owner', profile.ownerBirth.subjectName === 'One' && profile.ownerBirth !== birth);
  test('personality claim is qualified', profile.limitation.includes('not a measured personality'));
  const other = behavioralProfile({ ...chart, birth: { ...birth, subjectName: 'Two' }, planets: [{ name: 'Sun', sign: 0 }] });
  test('new owner gets its own computed profile', other.ownerBirth.subjectName === 'Two' && other.text.includes('Sun in Aries') && !other.text.includes('Sun in Libra'));
  test('invalid sign not interpreted', behavioralProfile({ ...chart, planets: [{ name: 'Sun', sign: 15 }] }).sections.length === 0);
  return rows;
}
