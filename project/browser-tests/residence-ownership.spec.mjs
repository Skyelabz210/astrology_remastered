import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});

test('chapter edits stay with the form birth before saving or casting', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  await expect(page.locator('.profile-chapter')).toHaveCount(4);
  await page.getByRole('button', { name: '+ add a life chapter' }).click();
  await expect(page.locator('.profile-chapter')).toHaveCount(5);
  await page.getByLabel('Birth calendar', { exact: true }).fill('1990-01-01');
  await expect(page.locator('.profile-chapter')).toHaveCount(0);
  await page.getByRole('button', { name: '+ add a life chapter' }).click();
  const place = page.locator('.profile-chapter').getByRole('combobox');
  await place.fill('Los Angeles');
  await page.getByRole('option', { name: /Los Angeles · CA/ }).click();
  await page.locator('.profile-chapter input[type=date]').first().fill('2010-01-01');
  await page.getByLabel('Birth calendar', { exact: true }).fill('1980-10-21');
  await expect(page.locator('.profile-chapter')).toHaveCount(5);
  await page.getByLabel('Birth calendar', { exact: true }).fill('1990-01-01');
  await expect(page.locator('.profile-chapter')).toHaveCount(1);
  await expect(page.locator('.profile-chapter').getByRole('combobox')).toHaveValue('Los Angeles · CA');
  await page.getByPlaceholder('your name or initial', { exact: true }).fill('Other reader');
  await expect(page.locator('.profile-chapter')).toHaveCount(1);
  await page.getByRole('button', { name: 'save profile locally' }).click();
  const profile = await page.evaluate(() => window.ProfileStore.load());
  expect(profile.chapters.map(ch => ch.placeKey)).toEqual(['Los Angeles · CA']);
  await page.getByRole('button', { name: 'Cast the spread', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.ReadingRuns.loadRuns()[0]?.input.chapters.map(ch => ch.placeKey))).toEqual(['Los Angeles · CA']);
  await page.getByRole('button', { name: 'behavior', exact: true }).click();
  await expect(page.locator('body')).not.toContainText('Wetzlar');
  expect(errors).toEqual([]);
});

test('all-invalid saved residence dates stay visible and are excluded from readings', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('resonance.profile.v1', JSON.stringify({ version: 1,
    settings: { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058,
      tz: 'America/New_York', placeLabel: 'Fort Liberty (Bragg) · NC', placeKey: 'Fort Liberty (Bragg) · NC', subjectName: 'Alpha', agentOn: false },
    birthForm: { year: 1980, month: 10, day: 21, hour12: 5, minute: 31, meridiem: 'PM', place: 'Fort Liberty (Bragg) · NC', subjectName: 'Alpha', timeUnknown: false },
    chapters: [{ id: 'invalid', placeKey: 'Wetzlar · DE', startISO: '2025-02-30', endISO: '' }] })));
  await page.goto('/resonance-spread.html');
  await expect(page.getByText('The start date must be a real calendar date.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'save profile locally' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cast the spread', exact: true }).click();
  await expect(page.locator('.chapter-summary')).toContainText('No usable residence history');
  await expect(page.locator('.chapter-summary')).toContainText('skipped because the place or dates were invalid');
  const run = await page.evaluate(() => window.ReadingRuns.loadRuns()[0]);
  expect(run.evidence.residence.value.dropped).toBe(1);
  expect(run.evidence.residence.value.active).toBeNull();
  expect(run.reading).not.toContain('Your residence at this reading\'s instant is Wetzlar');
});
