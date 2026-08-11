// project/src/present/contrast.js — WP-20 accessibility & privacy.
//
// Real WCAG 2.1 contrast-ratio computation for the OKLCH color tokens
// styles.css's :root block uses throughout (project/styles.css — see the
// audit comment directly above :root there). Not an approximation: OKLCH →
// OKLab → linear sRGB via Björn Ottosson's published matrices
// (https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab,
// inverted), then the standard WCAG relative-luminance dot product on the
// (already-linear) channels, then contrast = (L_lighter + 0.05) /
// (L_darker + 0.05).
//
// Dual-environment export (mirrors astro-core.js / a11y-table-data.js):
// plain ES exports for Node (project/test/wcag-contrast.test.js pins the
// exact numbers documented in styles.css's audit comment, straight from
// this module, so the two can never quietly drift apart) and, if ever
// wanted from a page for a live contrast check, `window.Contrast`.

export function oklchToLinearSrgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [r, g, bl];
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// relativeLuminance — WCAG's L = 0.2126 R + 0.7152 G + 0.0722 B, taken
// directly on the linear-sRGB channels above (no separate gamma step:
// those channels are already linear, which is what WCAG's formula wants —
// gamma-encoding them and then "undoing" it would be a no-op done twice).
// Out-of-gamut components (OKLCH can express colors sRGB cannot) are
// clamped rather than left negative/>1, matching how a real browser would
// display the color.
export function relativeLuminance(L, C, Hdeg) {
  const [r, g, b] = oklchToLinearSrgb(L, C, Hdeg);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

// contrastRatio — WCAG 1.4.3: (L1 + 0.05) / (L2 + 0.05), lighter over
// darker, so pair order never matters. Each argument is [L, C, H].
export function contrastRatio([L1, C1, H1], [L2, C2, H2]) {
  const a = relativeLuminance(L1, C1, H1);
  const b = relativeLuminance(L2, C2, H2);
  const lighter = Math.max(a, b), darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// AA thresholds (WCAG 2.1 SC 1.4.3 / 1.4.11).
export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3.0;

if (typeof window !== "undefined") {
  window.Contrast = { oklchToLinearSrgb, relativeLuminance, contrastRatio, AA_NORMAL_TEXT, AA_LARGE_TEXT };
}
