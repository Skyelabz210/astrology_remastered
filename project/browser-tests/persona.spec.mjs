import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const releaseVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});
test('Moon, Earth, natal Persona, chart storage, narration and return navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  await expect(page.locator('#app-release')).toContainText(`v${releaseVersion}`);
  await expect(page.getByRole('img', { name: /percent illuminated/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Moon' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Moon' }).click();
  await page.getByRole('button', { name: /Show Earth/ }).click();
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await page.getByRole('button', { name: 'persona', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Natal Persona Inspector' })).toBeVisible();
  await expect(page.locator('.transit-table tbody tr').first()).toBeVisible();
  await expect(page.getByText('1980-10-21T21:31:00.000Z', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/persona-desktop.png', fullPage: true });
  const snapshot = await page.locator('.transit-table tbody').innerText();
  await page.getByRole('button', { name: 'Narrate today' }).click();
  await expect(page.locator('.persona-reading')).toContainText('closest current transit aspects');
  await page.getByRole('button', { name: 'Add birth chart' }).click();
  // A genuine second birth record, rather than cloning the default.
  await page.getByPlaceholder('a name or initial', { exact: true }).fill('Second chart');
  await page.getByRole('button', { name: 'Read the relationship' }).click();
  await expect(page.getByRole('heading', { name: /Second chart/ })).toBeVisible();
  await expect(page.locator('.transit-table tbody')).not.toHaveText(snapshot);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('personaCharts')).length)).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await page.getByRole('button', { name: 'persona', exact: true }).click();
  await expect(page.getByRole('button', { name: /Second chart ·/ })).toBeVisible();
  await page.getByRole('button', { name: /Remove Second chart/ }).click();
  await expect(page.getByRole('button', { name: /Second chart ·/ })).toHaveCount(0);
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('button', { name: 'persona', exact: true })).toBeVisible();
  await expect(page.locator('#app-release')).toBeVisible();
  expect(errors).toEqual([]);
});
test('Persona supports narrow screens without page overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resonance-spread.html');
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await page.getByRole('button', { name: 'persona', exact: true }).click();
  await expect(page.locator('.transit-table tbody tr').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/persona-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stamp = await page.locator('#app-release').boundingBox();
  expect(stamp.x + stamp.width).toBeLessThanOrEqual(390);
  expect(stamp.y + stamp.height).toBeLessThanOrEqual(844);
  expect(errors).toEqual([]);
});
test('HCRM console still renders its landing and chart', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/standalone.html');
  await expect(page.locator('#app-release')).toContainText(`v${releaseVersion}`);
  await expect(page.getByRole('button', { name: 'Register ledger' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Moon' })).toBeVisible();
  await page.getByRole('button', { name: 'Build the register map' }).click();
  await expect(page.locator('body')).toContainText('HCRM');
  expect(errors).toEqual([]);
});
test('malformed chart storage and unknown birth time are handled', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('personaCharts', 'null'));
  await page.goto('/resonance-spread.html');
  await page.getByLabel(/Time unknown/).check();
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await page.getByRole('button', { name: 'persona', exact: true }).click();
  await expect(page.locator('.transit-table tbody tr').first()).toBeVisible();
  await expect(page.getByText('Birth time unknown. Angles and sect-dependent time lords are omitted; Moon degree is uncertain.')).toBeVisible();
  await expect(page.locator('.transit-table tbody')).not.toContainText('Ascendant');
  await expect(page.locator('.transit-table tbody')).not.toContainText('Midheaven');
  await expect(page.getByRole('heading', { name: 'Sect', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('personal runs preserve residence, narration, exports and admitted diagnostics', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1,
      settings: { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058,
        tz: 'America/New_York', placeLabel: 'Fort Liberty (Bragg) · NC',
        houseSystem: 'placidus', sect: 'auto', orbScale: 1, subjectName: 'Alex', agentOn: false },
      birthForm: { year: 1980, month: 10, day: 21, hour12: 5, minute: 31,
        meridiem: 'PM', place: 'Fort Liberty (Bragg) · NC', subjectName: 'Alex', timeUnknown: false },
      chapters: [{ id: 'la', placeKey: 'Los Angeles · CA', startISO: '2010-01-01', endISO: '' }] }));
  });
  await page.goto('/resonance-spread.html');
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await expect.poll(() => page.evaluate(() => window.ReadingRuns.loadRuns().length)).toBe(1);
  const first = await page.evaluate(() => window.ReadingRuns.loadRuns()[0]);
  expect(first.input.release.version).toBe(releaseVersion);
  expect(first.reading).toContain('Los Angeles');
  expect(first.reading).toContain('Closest current transits at');
  expect(first.evidence.lifecycle.status).toBe('ready');
  expect(first.evidence.natal.planets.some(p => p.name === 'Chiron')).toBe(false);
  await page.locator('.personal-history > details > summary').click();
  await expect(page.locator('.personal-history')).toContainText('Los Angeles');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export this reading', exact: true }).click();
  const file = await download;
  const contents = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8');
  expect(contents).toContain(first.at);
  expect(contents).toContain('Calculation assumptions');
  expect(contents).toContain('Los Angeles');
  await page.getByRole('button', { name: 'full spread', exact: true }).click();
  await page.getByText('Advanced → Shadow, Harmonic Closure and HCRM', { exact: true }).click();
  await expect(page.getByText('HCRM placement diagnostics', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.ReadingRuns.loadRuns().filter(r => r.evidence.hcrm).length)).toBeGreaterThan(0);
  const ledger = await page.evaluate(() => window.ReadingRuns.loadRuns().find(r => r.evidence.hcrm).evidence.hcrm.ledger);
  expect(ledger).toHaveLength(10);
  expect(ledger.every(e => e.certificate.status === 'IMPORTED_INTEGER_LEDGER')).toBe(true);
  const savedIds = await page.evaluate(() => window.ReadingRuns.loadRuns().map(run => run.id));
  await page.reload();
  expect(await page.evaluate(() => window.ReadingRuns.loadRuns().map(run => run.id))).toEqual(savedIds);
  expect(errors).toEqual([]);
});

test('a fresh Sydney user can save a complete private ZIP and read it offline', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const birth = { dateISO: '1993-06-10T11:45:00Z', lat: -33.8688, lng: 151.2093,
      tz: 'Australia/Sydney', placeLabel: 'Sydney · AU', placeKey: 'Sydney · AU',
      houseSystem: 'porphyry', sect: 'auto', orbScale: 1, subjectName: 'Renée', agentOn: false };
    localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1, settings: birth,
      birthForm: { year: 1993, month: 6, day: 10, hour12: 9, minute: 45,
        meridiem: 'PM', place: 'Sydney · AU', subjectName: 'Renée', timeUnknown: false }, chapters: [] }));
    const foreignBirth = { ...birth, subjectName: 'Unrelated user', lat: 51.5, lng: 0 };
    const owner = JSON.stringify([foreignBirth.dateISO, foreignBirth.lat, foreignBirth.lng, foreignBirth.tz, foreignBirth.subjectName, false]);
    const ownKey = JSON.stringify(['1993-06-10T11:45:00.000Z', birth.lat, birth.lng, birth.tz, birth.subjectName, false]);
    localStorage.setItem('resonance.reading-runs.v1', JSON.stringify([{ version: 1, id: 'malformed',
      profileKey: ownKey, at: '2026-10-01T12:00:00Z', input: {}, evidence: {}, reading: 'BROKEN HISTORY' }, { version: 1, id: 'foreign',
      profileKey: owner, at: '2026-10-01T12:00:00Z', input: { birth: foreignBirth },
      evidence: { anything: true }, reading: 'PRIVATE UNRELATED READING' }]));
    localStorage.setItem('elevenlabs.apiKey', 'FAKE-SECRET-KEY');
  });
  await page.goto('/resonance-spread.html');
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await expect(page.getByRole('button', { name: 'Export all my data as ZIP', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all my data as ZIP', exact: true }).click();
  const archive = await pending;
  const { readFile } = await import('node:fs/promises');
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(await readFile(await archive.path()));
  const text = strFromU8(files['data/personal-data.json']);
  const data = JSON.parse(text);
  expect(data.chart.birth.subjectName).toBe('Renée');
  expect(data.chart.birth.lat).toBe(-33.8688);
  expect(data.chart.birth.lng).toBe(151.2093);
  expect(data.chart.birth.dateISO).toBe('1993-06-10T11:45:00.000Z');
  expect(data.chart.houseSystemActual).toBe('porphyry');
  expect(data.chart.houseCusps).toHaveLength(12);
  expect(data.runs).toHaveLength(1);
  expect(data.release.version).toBe(releaseVersion);
  expect(data.additional.returnCharts.status).toBe('ready');
  expect(data.additional.admittedLedgerAndHcrm.value.ledger).toHaveLength(10);
  expect(data.additional.eclipseProfile.status).toBe('ready');
  expect(data.readings.text).toContain('1993');
  expect(text).not.toContain('PRIVATE UNRELATED READING');
  expect(text).not.toContain('Unrelated user');
  expect(text).not.toContain('FAKE-SECRET-KEY');
  expect(archive.suggestedFilename()).toMatch(/^resonance-Renee-.*\.zip$/);
  const offline = await context.newPage();
  await offline.setContent(strFromU8(files['report.html']));
  await expect(offline.getByRole('heading', { name: 'Renée', exact: true })).toBeVisible();
  await expect(offline.getByRole('table')).toContainText('Sun');
  await expect(offline.locator('svg')).toBeVisible();
  expect(errors).toEqual([]);
});

test('calendar, spinning time, aliases and drag globe preserve canonical birth input', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1,
    settings: { dateISO: '1980-10-21T17:31:00-04:00', lat: 35.1408, lng: -79.0058, tz: 'America/New_York', subjectName: 'You' },
    birthForm: { year: 1980, month: 10, day: 21, hour12: 5, minute: 31, meridiem: 'PM', place: 'Fort Bragg · NC', subjectName: 'You', timeUnknown: false }, chapters: [] })));
  await page.goto('/resonance-spread.html');
  await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue('Fort Liberty (Bragg) · NC');
  await expect(page.locator('.landing-brand')).toHaveCount(0);
  await expect(page.locator('.moon-phase-icon canvas')).toBeVisible();
  await page.getByLabel('Birth calendar', { exact: true }).fill('1968-02-29');
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveValue('1968');
  await expect(page.getByRole('combobox', { name: 'Day', exact: true })).toHaveValue('29');
  await page.getByRole('spinbutton', { name: 'Spin Minute' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('combobox', { name: 'Minute', exact: true })).toHaveValue('32');
  const globe = page.getByRole('group', { name: /Birthplace globe/ });
  await globe.scrollIntoViewIfNeeded();
  const box = await globe.boundingBox();
  const before = await page.locator('.glb-readout-name').innerText();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 55, box.y + box.height / 2 + 35, { steps: 8 }); await page.mouse.up();
  await page.mouse.move(5, 5);
  await expect(page.getByRole('combobox', { name: 'City', exact: true })).toHaveValue(before + ' · NC');
  await expect(page.locator('.glb-readout-name')).toHaveText(before);
  const city = page.getByRole('combobox', { name: 'City', exact: true });
  await city.fill('ft brag');
  await page.getByRole('option', { name: /Fort Liberty/ }).click();
  await expect(page.locator('.glb-readout-name')).toHaveText('Fort Liberty (Bragg)');
  await page.screenshot({ path: 'test-results/birth-entry-mobile.png', fullPage: true });
  const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, overflow: Array.from(document.querySelectorAll('body *')).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })).filter(el => el.right > innerWidth + 1).slice(0, 15) }));
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
  await page.getByRole('button', { name: 'Cast the spread' }).click();
  await page.getByRole('button', { name: 'behavior', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Behavioral profile', exact: true })).toBeVisible();
  await expect(page.locator('.behavioral-page')).toContainText('Thinking and communication');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('resonance.reading-runs.v1')).find(r => r.evidence.behavioralProfile));
  expect(saved.input.birth.dateISO).toContain('1968-02-29');
  expect(saved.evidence.behavioralProfile.ownerBirth.dateISO).toBe(saved.input.birth.dateISO);
  expect(errors).toEqual([]);
});

test('OpenRouter free vision integration generates and saves a grounded behavioral profile', async ({ page }) => {
  const errors = [], requests = []; page.on('pageerror', e => errors.push(e.message));
  let verified = '';
  await page.route('https://openrouter.ai/api/v1/**', async route => {
    if (route.request().url().endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'qwen/vision:free', name: 'Test free vision', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text','image'], output_modalities: ['text'] } }] } });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { choices: [{ message: { content: verified } }] } });
  });
  await page.goto('/resonance-spread.html');
  verified = await page.evaluate(() => { const c = window.computeNatal({ dateISO: "1980-10-21T17:31:00-04:00", lat: 35.1408, lng: -79.0058, tz: "America/New_York", houseSystem: "whole", sect: "auto", subjectName: "You" }); return c.planets.filter(p => ['Sun','Moon','Mercury'].includes(p.name)).map(p => `Your ${p.name} in ${window.ZODIAC[p.sign].name} is a starting point for reflection.`).join(' '); });
  await page.getByText('Interpreter settings · OpenRouter', { exact: true }).click();
  await page.getByLabel('OpenRouter API key', { exact: true }).fill('test-key');
  await page.getByRole('button', { name: 'Connect OpenRouter', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Configured/ })).toBeVisible();
  await expect(page.getByLabel('OpenRouter API key', { exact: true })).toHaveValue('');
  await page.getByLabel(/Send my birth data/).check();
  await page.getByRole('button', { name: 'Cast the spread' }).click();
  await page.getByRole('button', { name: 'behavior', exact: true }).click();
  await page.getByRole('button', { name: 'Generate behavioral profile', exact: true }).click();
  await expect(page.locator('.behavior-expanded')).toContainText(verified);
  expect(requests.some(r => Array.isArray(r.messages[0].content) && r.messages[0].content.some(c => c.type === 'image_url'))).toBe(true);
  expect(requests.every(r => r.provider.max_price.prompt === 0 && r.model.endsWith(':free'))).toBe(true);
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('resonance.reading-runs.v1')));
  expect(rows.some(r => r.evidence.behavioralProfile?.aiText === verified)).toBe(true);
  expect(JSON.stringify(rows)).not.toContain('test-key');
  await page.getByRole('button', { name: '← Back', exact: true }).click();
  await page.getByRole('button', { name: 'behavior', exact: true }).click();
  await page.getByText(/Previously generated behavioral profiles/).click();
  await expect(page.locator('.previous-behavior')).toContainText(verified);
  await page.screenshot({ path: 'test-results/behavioral-profile.png', fullPage: true });
  expect(errors).toEqual([]);
});


test('an unrecognized saved birthplace cannot silently cast at a fallback city', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1,
    settings: { dateISO: '1980-10-21T17:31:00-04:00', lat: 35.1408, lng: -79.0058, subjectName: 'You' },
    birthForm: { year: 1980, month: 10, day: 21, hour12: 5, minute: 31, meridiem: 'PM', place: 'Not a listed birthplace', subjectName: 'You', timeUnknown: false }, chapters: [] })));
  await page.goto('/resonance-spread.html');
  await expect(page.locator('.glb-readout-name')).toHaveText('Choose a listed birthplace');
  await page.getByRole('button', { name: 'Cast the spread' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a listed birthplace');
  await expect(page.getByRole('button', { name: 'Cast the spread' })).toBeVisible();
});

test('alpha journey is editable, persistent and does not follow another birth record', async ({ page }) => {
  await page.goto('/resonance-spread.html');
  await expect(page.locator('.profile-chapter')).toHaveCount(4);
  await expect(page.locator('.profile-chapter').nth(1).getByRole('combobox')).toHaveValue('Wetzlar · DE');
  await page.getByRole('button', { name: '+ add a life chapter' }).click();
  await expect(page.locator('.profile-chapter')).toHaveCount(5);
  await page.getByRole('button', { name: 'Remove life chapter 5' }).click();
  await page.getByRole('button', { name: 'save profile locally' }).click();
  await page.reload();
  await expect(page.locator('.profile-chapter')).toHaveCount(4);
  await expect(page.locator('.profile-chapter').last().getByRole('combobox')).toHaveValue('San Antonio · TX');
  await page.getByLabel('Birth calendar', { exact: true }).fill('1990-01-01');
  await page.getByRole('button', { name: /Cast the spread/i }).click();
  await page.getByRole('button', { name: 'behavior', exact: true }).click();
  await expect(page.locator('body')).not.toContainText('Wetzlar');
});
