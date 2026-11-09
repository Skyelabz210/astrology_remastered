import { test, expect } from '@playwright/test';

// Each entrypoint must execute the ES module, not merely contain a matching tag.
const pages = [
  'API Reference.html',
  'HCRM Console-print.html',
  'HCRM Console.html',
  'Resonance Spread.html',
  'Test Harness.html',
];

for (const entry of pages) {
  test(`canonical exact ring initializes on ${entry}`, async ({ page }) => {
    // Module imports are local; the external React/Babel CDNs aren't needed
    // to establish that the canonical arithmetic module initialized.
    await page.route('https://**/*', (route) => route.abort());
    await page.goto('/' + encodeURIComponent(entry), { waitUntil: 'domcontentloaded' });
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

test('offline spread selects canonical arithmetic, not the legacy fallback', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  // npm run build generates this offline entrypoint from Resonance Spread.html.
  await page.goto('/resonance-spread.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => window.EXACT_RING_MODE)).toBe('EXACT_RING');
});
