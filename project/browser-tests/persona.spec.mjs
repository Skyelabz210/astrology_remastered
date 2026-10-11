import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});
test('Moon, Earth, natal Persona, chart storage, narration and return navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  await expect(page.getByRole('img', { name: /percent illuminated/ })).toBeVisible();
  await page.getByRole('button', { name: /Show Earth/ }).click();
  await expect(page.getByRole('button', { name: 'Show Moon' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Moon' }).click();
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
  expect(errors).toEqual([]);
});
test('HCRM console still renders its landing and chart', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/standalone.html');
  await expect(page.getByRole('button', { name: 'Register ledger' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('button', { name: /Show Earth/ })).toBeVisible();
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
  await expect.poll(() => page.evaluate(() => window.ReadingRuns.loadRuns().filter(r => r.evidence.hcrm).length)).toBe(1);
  const ledger = await page.evaluate(() => window.ReadingRuns.loadRuns().find(r => r.evidence.hcrm).evidence.hcrm.ledger);
  expect(ledger).toHaveLength(10);
  expect(ledger.every(e => e.certificate.status === 'IMPORTED_INTEGER_LEDGER')).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.ReadingRuns.loadRuns().length)).toBe(2);
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
    localStorage.setItem('resonance.reading-runs.v1', JSON.stringify([{ version: 1, id: 'foreign',
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
