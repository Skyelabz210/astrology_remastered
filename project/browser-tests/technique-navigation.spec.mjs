import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// Independent acceptance set: each entry is an actual computed UI surface,
// not a helper-only tradition from the integer-core inventory.
const techniques = [
  'natal-aspects', 'essential-dignities', 'four-angles', 'natal-moon-phase',
  'void-of-course', 'hellenistic-lots', 'antiscia', 'annual-profection',
  'firdaria', 'lunar-mansions', 'mutual-receptions', 'prenatal-syzygy',
  'fixed-stars', 'zodiacal-releasing', 'solar-conditions', 'live-transits',
  'solar-return', 'lunar-return', 'secondary-progressions', 'eclipses',
];
const screens = [
  { name: 'birth entry', id: 'birth-entry', selector: '.landing', text: 'Astrology, remastered.' },
  { name: 'reading', id: 'reading-session', selector: '.rs' },
  { name: 'full spread', id: 'natal-aspects', selector: '.spread' },
  { name: 'Persona', id: 'live-transits', selector: '.persona-page:not(.behavioral-page)' },
  { name: 'behavioral profile', id: 'behavioral-profile', selector: '.behavioral-page' },
  { name: 'second birth entry', id: 'partner-birth', selector: '.landing', text: 'Who are you meeting?' },
  { name: 'synastry results', id: 'synastry', selector: '.synastry' },
  { name: 'Persona add chart', id: 'live-transits', selector: '.landing', text: 'Who are you meeting?', add: true },
];
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
});
async function openTechnique(page, id) {
  let clicks = 0;
  await page.getByRole('button', { name: 'Explore techniques', exact: true }).click(); clicks++;
  await expect(page.getByRole('dialog', { name: 'Explore techniques', exact: true })).toBeVisible();
  await page.locator(`[data-technique-id="${id}"]`).click(); clicks++;
  await expect(page.locator(`[data-technique-target="${id}"]`)).toBeVisible();
  await expect(page.locator(`[data-technique-target="${id}"]`)).toBeFocused();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(clicks).toBe(2);
  return clicks;
}
async function resetTo(page, screen) {
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('astrology-technique-navigate', { detail: { id } })), screen.id);
  if (screen.add) {
    await expect(page.getByRole('heading', { name: 'Natal Persona Inspector' })).toBeVisible();
    await page.getByRole('button', { name: 'Add birth chart' }).click();
  }
  await expect(page.locator(screen.selector)).toBeVisible();
  if (screen.text) await expect(page.locator('h1')).toHaveText(screen.text);
  await expect(page.getByRole('button', { name: 'Explore techniques', exact: true })).toBeVisible();
}
test('20 actual techniques are reachable in two actions from a cold app', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [], matrix = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const id of techniques) {
    await page.goto('/resonance-spread.html');
    await expect(page.getByRole('button', { name: 'Cast the spread' })).toBeVisible();
    const actions = await openTechnique(page, id);
    matrix.push({ from: 'cold birth entry', technique: id, actions, reached: true });
  }
  expect(errors).toEqual([]);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/technique-access-cold.json', JSON.stringify(matrix, null, 2));
});
test('the same 20 techniques are reachable in two actions from every healthy app screen', async ({ page }) => {
  test.setTimeout(420000);
  const errors = [], matrix = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  // Prepare one genuine second chart. Setup/data entry is deliberately not
  // counted as navigating to computed synastry results.
  await page.getByRole('button', { name: 'Cast the spread' }).click();
  await page.getByRole('button', { name: 'synastry', exact: true }).click();
  await page.getByPlaceholder('a name or initial', { exact: true }).fill('Navigation partner');
  await page.getByLabel('Birth calendar', { exact: true }).fill('1990-01-01');
  await page.getByRole('button', { name: 'Read the relationship', exact: true }).click();
  await expect(page.locator('.synastry')).toBeVisible();
  for (const screen of screens) {
    for (const id of techniques) {
      await resetTo(page, screen);
      const actions = await openTechnique(page, id);
      matrix.push({ from: screen.name, technique: id, actions, reached: true });
    }
  }
  expect(matrix).toHaveLength(160);
  expect(errors).toEqual([]);
  await writeFile('test-results/technique-access-screens.json', JSON.stringify(matrix, null, 2));
});
test('technique directory supports keyboard, dismissal, search, mobile and prerequisite notices', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resonance-spread.html');
  const trigger = page.getByRole('button', { name: 'Explore techniques', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Explore techniques', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('cast changed details first');
  await expect(dialog).toContainText('Levels 2–4 and loosing of the bond are absent.');
  await page.getByRole('searchbox', { name: 'Find a technique' }).fill('profection');
  await expect(dialog.locator('[data-technique-id]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await trigger.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/technique-directory-mobile.png', fullPage: true });
  await page.locator('[data-technique-id="synastry"]').click();
  await expect(page.getByRole('button', { name: 'Read the relationship', exact: true })).toBeVisible();
  await expect(page.locator('.synastry')).toHaveCount(0);
  // Unknown time still routes to a clear withholding notice rather than
  // claiming that access to a page supplies missing birth data.
  await page.getByRole('button', { name: 'Explore techniques', exact: true }).click();
  await page.getByRole('button', { name: 'Your birth details', exact: true }).click();
  await page.getByLabel(/Time unknown/).check();
  await page.getByRole('button', { name: 'Cast the spread' }).click();
  await openTechnique(page, 'four-angles');
  await expect(page.locator('.tp-card').filter({ has: page.getByRole('heading', { name: 'Four angles' }) })).toContainText('birth time unknown');
  expect(errors).toEqual([]);
});
