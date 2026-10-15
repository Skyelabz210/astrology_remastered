import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('a selected historical lifecycle and completed scan persist in the owned ZIP', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  await page.getByRole('button', { name: 'Cast the spread', exact: true }).click();
  await page.getByRole('button', { name: 'full spread', exact: true }).click();
  const panel = page.locator('.cl');
  await page.getByLabel('target date — address the chart at this moment of its lifecycle', { exact: true }).fill('1990-04-12');
  await expect(panel.locator('.cl-place').filter({ hasText: 'location at target' })).toContainText('Wetzlar · DE');
  await expect(panel.getByText('charting the year around the target…', { exact: true })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Save reading for this date', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('with the completed perfection scan');
  const run = await page.evaluate(() => window.ReadingRuns.loadRuns().find(row => row.input.calculation?.kind === 'lifecycle'));
  expect(run.at).toBe('1990-04-12T12:00:00.000Z');
  expect(new Date(run.createdAt).getUTCFullYear()).toBeGreaterThan(1990);
  expect(run.input.birth.placeKey).toBe('Fort Liberty (Bragg) · NC');
  expect(run.evidence.residence.value.active.place.placeKey).toBe('Wetzlar · DE');
  expect(run.evidence.returnCharts.value.every(r => r.placeLabel === 'Wetzlar · DE')).toBe(true);
  expect(run.evidence.perfectionScan.status).toBe('ready');
  expect(run.evidence.perfectionScan.value.hits.length).toBeGreaterThan(16);
  expect(run.evidence.perfectionScan.value.hits.every(h => h.daysFromTarget === h.jd - run.input.target.jd)).toBe(true);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all my data as ZIP', exact: true }).click();
  const archive = await downloading;
  const files = unzipSync(await readFile(await archive.path()));
  const data = JSON.parse(strFromU8(files['data/personal-data.json']));
  const archived = data.runs.find(row => row.id === run.id);
  expect(archived.evidence.perfectionScan.value.hits).toEqual(run.evidence.perfectionScan.value.hits);
  expect(archived.evidence.secondaryProgressions.value).toEqual(run.evidence.secondaryProgressions.value);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cast the spread', exact: true })).toBeVisible();
  expect(await page.evaluate(id => window.ReadingRuns.loadRuns().some(row => row.id === id && row.at === '1990-04-12T12:00:00.000Z'), run.id)).toBe(true);
  expect(errors).toEqual([]);
});

test('standalone HCRM hydrates the saved personal birth and residence for its archive and form', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1,
    settings: { dateISO: '1993-06-10T11:45:00Z', lat: -33.8688, lng: 151.2093,
      tz: 'Australia/Sydney', placeKey: 'Sydney · AU', placeLabel: 'Sydney · AU',
      subjectName: 'Sydney reader', houseSystem: 'porphyry', sect: 'auto', orbScale: 1.5, agentOn: false },
    chapters: [{ id: 'la', placeKey: 'Los Angeles · CA', startISO: '2010-01-01', endISO: '' }] })));
  await page.goto('/standalone.html');
  await expect(page.locator('.hc-sub')).toContainText('Sydney · AU');
  await expect(page.locator('body')).toContainText('Register view of your saved local birth profile.');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all my data as ZIP', exact: true }).click();
  const archive = await downloading;
  const files = unzipSync(await readFile(await archive.path()));
  const data = JSON.parse(strFromU8(files['data/personal-data.json']));
  expect(data.chart.birth.subjectName).toBe('Sydney reader');
  expect(data.chart.birth.lat).toBe(-33.8688);
  expect(data.chart.houseSystemActual).toBe('porphyry');
  expect(data.context.input.chapters.map(ch => ch.placeKey)).toEqual(['Los Angeles · CA']);
  expect(data.context.evidence.residence.value.active.place.placeKey).toBe('Los Angeles · CA');
  expect(data.additional.returnCharts.value.every(r => r.placeLabel === 'Los Angeles · CA')).toBe(true);
  expect(data.context.evidence.lifecycle.status).toBe('ready');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Birth calendar', { exact: true })).toHaveValue('1993-06-10');
  await expect(page.getByPlaceholder('your name or initial', { exact: true })).toHaveValue('Sydney reader');
  await expect(page.locator('.profile-chapter')).toHaveCount(1);
  await page.getByLabel('Birth calendar', { exact: true }).fill('1990-01-01');
  await expect(page.locator('.profile-chapter')).toHaveCount(0);
  expect(errors).toEqual([]);
});
