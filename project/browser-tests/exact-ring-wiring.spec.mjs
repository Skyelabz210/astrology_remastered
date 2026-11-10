import { test, expect } from './fixtures/source-page.mjs';

// Each entrypoint must execute the ES module, not merely contain a matching tag.
const pages = [
  'API Reference.html',
  'HCRM Console-print.html',
  'HCRM Console.html',
  'Resonance Spread.html',
  'Test Harness.html',
];

for (const entry of pages) {
  test(`canonical exact ring initializes on ${entry}`, async ({ page, sourceURL }) => {
    // Module imports are local; the external React/Babel CDNs aren't needed
    // to establish that the canonical arithmetic module initialized.
    await page.route('https://**/*', (route) => route.abort());
    const response = await page.goto(sourceURL + '/' + encodeURIComponent(entry), { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBe(200);
    const evidence = await page.evaluate(() => {
      const ring = window.ExactRing;
      return {
        loaded: typeof ring?.wrapDegToArcsec === 'function',
        bigintSign: ring?.SIGN_ARC === 108000n,
        wrappedZero: ring?.wrapDegToArcsec?.(359.9999997) === 0n,
      };
    });
    expect(evidence).toEqual({ loaded: true, bigintSign: true, wrappedZero: true });
  });
}

test('source fixture serves the canonical module as JavaScript', async ({ request, sourceURL }) => {
  const response = await request.get(sourceURL + '/src/present/exact-ring.js');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/javascript');
  expect(await response.text()).toContain('export function laneResidues');
});

test('offline spread selects canonical arithmetic, not the legacy fallback', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  // npm run build generates this offline entrypoint from Resonance Spread.html.
  await page.goto('/resonance-spread.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.EXACT_RING_MODE)).toBe('EXACT_RING');
});

test('canonical spread renders cards and numeric residues in rigorous mode', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/resonance-spread.html');
  await page.getByRole('button', { name: 'Cast the spread', exact: true }).click();
  await page.getByRole('button', { name: 'full spread', exact: true }).click();
  await expect(page.locator('.zc')).toHaveCount(12);
  await page.getByRole('button', { name: 'rigorous', exact: true }).click();
  await expect(page.locator('.zc-residues')).toHaveCount(12);
  await expect(page.locator('.zc-residues b')).toHaveCount(48);
  for (const value of await page.locator('.zc-residues b').allTextContents()) {
    expect(value).toMatch(/^\d+$/);
  }
  await page.locator('.zc').first().click();
  await expect(page.locator('.zc').first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'prime layer', exact: true }).click();
  await expect(page.locator('.pl-table')).toBeVisible();
  await expect(page.locator('.pl-table tbody tr').first()).toBeVisible();
  for (const value of await page.locator('.pl-table tbody tr td:last-child').allTextContents()) {
    expect(value).toMatch(/^\d+$/);
  }
  expect(errors).toEqual([]);
});
