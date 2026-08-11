// test/wcag-contrast.test.js — WP-20 accessibility & privacy.
//
// Two things pinned here:
//   1. The OKLCH → WCAG-contrast math in src/present/contrast.js itself,
//      against reference values that don't depend on this app's palette
//      (pure black vs white, a color against itself).
//   2. The actual :root color tokens read live out of project/styles.css
//      (regex-extracted, not hand-copied) — reproducing every ratio
//      documented in the audit comment directly above styles.css's :root
//      block, so that comment and this app's real CSS can never quietly
//      drift apart. This is the test that would have caught the pre-fix
//      --ink-dim (5.10:1 today; was 4.15:1 against --bg before the WP-20
//      fix, which failed the 4.5:1 AA threshold for normal text).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { contrastRatio, relativeLuminance, AA_NORMAL_TEXT } from "../src/present/contrast.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(HERE, "..", "styles.css");

// Pulls `--name: oklch(L C H ...)` (alpha channel, if any, ignored — alpha
// only matters composited over a known backdrop, and every pair audited
// here is an opaque token) out of styles.css's :root block.
function readOklchVar(css, name) {
  const re = new RegExp(`--${name}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`);
  const m = css.match(re);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── math sanity, palette-independent ────────────────────────────
  t("contrastRatio(white, black) ≈ 21:1 (WCAG's maximum)",
    Math.abs(contrastRatio([1, 0, 0], [0, 0, 0]) - 21) < 0.05,
    String(contrastRatio([1, 0, 0], [0, 0, 0])));
  t("contrastRatio of a color against itself is 1:1",
    Math.abs(contrastRatio([0.6, 0.05, 120], [0.6, 0.05, 120]) - 1) < 1e-9,
    String(contrastRatio([0.6, 0.05, 120], [0.6, 0.05, 120])));
  t("contrastRatio is order-independent (lighter/darker resolved internally)",
    contrastRatio([0.9, 0.01, 80], [0.1, 0.01, 60]) === contrastRatio([0.1, 0.01, 60], [0.9, 0.01, 80]),
    "");
  t("relativeLuminance(black) is 0, relativeLuminance(white) is 1",
    relativeLuminance(0, 0, 0) === 0 && Math.abs(relativeLuminance(1, 0, 0) - 1) < 1e-9,
    `${relativeLuminance(0, 0, 0)} / ${relativeLuminance(1, 0, 0)}`);

  // ── live styles.css :root tokens ─────────────────────────────────
  const css = readFileSync(CSS_PATH, "utf8");
  const tokens = {
    bg: readOklchVar(css, "bg"),
    bg2: readOklchVar(css, "bg-2"),
    ink: readOklchVar(css, "ink"),
    ink2: readOklchVar(css, "ink-2"),
    inkDim: readOklchVar(css, "ink-dim"),
    cardBg: readOklchVar(css, "card-bg"),
    cardBg2: readOklchVar(css, "card-bg-2"),
    cardInk: readOklchVar(css, "card-ink"),
    cardInkDim: readOklchVar(css, "card-ink-dim"),
  };
  for (const [k, v] of Object.entries(tokens)) {
    t(`styles.css :root defines a parseable oklch() for token "${k}"`,
      Array.isArray(v), v ? "" : "regex found no match — token renamed or format changed?");
  }

  // Every normal-text pair the WP-20 audit comment above styles.css's
  // :root documents, re-derived here rather than hand-copied, at the
  // 4.5:1 AA threshold for normal text.
  const pairs = [
    ["bg", "ink"], ["bg", "ink2"], ["bg", "inkDim"],
    ["bg2", "ink"], ["bg2", "inkDim"],
    ["cardBg", "cardInk"], ["cardBg", "cardInkDim"],
    ["cardBg2", "cardInk"], ["cardBg2", "cardInkDim"],
  ];
  for (const [a, b] of pairs) {
    const ratio = contrastRatio(tokens[a], tokens[b]);
    t(`--${a} vs --${b} clears WCAG AA normal-text 4.5:1 (actual ${ratio.toFixed(2)}:1)`,
      ratio >= AA_NORMAL_TEXT,
      `${ratio.toFixed(2)}:1`);
  }

  // The specific regression this package fixed: --ink-dim was raised from
  // L 0.55 to L 0.60 because 0.55 failed AA on both dark backgrounds it's
  // actually used against (--bg 4.15:1, --bg-2 4.00:1 — both < 4.5).
  t("the OLD --ink-dim (L=0.55) would have failed AA against --bg (regression pin)",
    contrastRatio(tokens.bg, [0.55, tokens.inkDim[1], tokens.inkDim[2]]) < AA_NORMAL_TEXT,
    String(contrastRatio(tokens.bg, [0.55, tokens.inkDim[1], tokens.inkDim[2]])));
  t("the OLD --ink-dim (L=0.55) would have failed AA against --bg-2 too (regression pin)",
    contrastRatio(tokens.bg2, [0.55, tokens.inkDim[1], tokens.inkDim[2]]) < AA_NORMAL_TEXT,
    String(contrastRatio(tokens.bg2, [0.55, tokens.inkDim[1], tokens.inkDim[2]])));

  return R;
}
