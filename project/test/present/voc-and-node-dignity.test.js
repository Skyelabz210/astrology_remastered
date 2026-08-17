// test/present/voc-and-node-dignity.test.js — two small, real defects from
// docs/COMPLETION_AUDIT.md §3 items 10-11, fixed together since both are
// small corrections inside astro.jsx's computeNatal() and neither needed a
// dedicated file of its own.
//
// Item 10 — void-of-course Moon counted ANY aspect (applying or
// separating) as "not VOC." A separating aspect is one the Moon has
// already left behind; only a remaining APPLYING aspect keeps it "in
// aspect" going forward. Fixed to check aspectGrid's own applyingPhase()
// result instead.
//
// Item 11 — the South Node's per-planet `.dignity` field called
// dignityFor("Sun", southNodeSign) instead of dignityFor("SouthNode", ...),
// fabricating a Leo-domicile / Aries-exaltation / Aquarius-detriment /
// Libra-fall dignity a node does not classically carry. dignityFor()
// already falls through to {kind:"neutral", score:0} for any name absent
// from DOMICILE/EXALT, and neither table has a node entry, so the fix is
// simply calling it with the node's own name.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const astroSrc = readFileSync(join(ROOT, "astro.jsx"), "utf8");
const vendorSrc = readFileSync(join(ROOT, "vendor", "astronomy.browser.min.js"), "utf8");
const astroCoreModule = await import("../../src/present/astro-core.js");
const housesModule = await import("../../tools/ephemeris/houses.js");

function makeSandbox() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.AstroCore = astroCoreModule;
  sandbox.Houses = housesModule;
  vm.createContext(sandbox);
  vm.runInContext(vendorSrc, sandbox, { filename: "astronomy.browser.min.js" });
  vm.runInContext(astroSrc, sandbox, { filename: "astro.jsx" });
  return sandbox;
}

const MAJOR = ["Conjunction", "Opposition", "Trine", "Square", "Sextile"];

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const sandbox = makeSandbox();
  const { computeNatal, dignityFor } = sandbox;

  // ── South Node dignity ──────────────────────────────────────────────
  // dignityFor() itself, direct: neither table has a node entry, so it
  // must read neutral in EVERY sign — this is the primitive the fix relies
  // on, verified in isolation first.
  {
    let allNeutral = true;
    for (let sign = 0; sign < 12; sign++) {
      const d = dignityFor("SouthNode", sign);
      if (d.kind !== "neutral" || d.score !== 0) allNeutral = false;
    }
    t("dignityFor('SouthNode', *) is neutral in every sign (no table entry)", allNeutral);

    const d2 = dignityFor("NorthNode", 0);
    t("dignityFor('NorthNode', *) is likewise neutral (sanity check on the same primitive)",
      d2.kind === "neutral" && d2.score === 0);
  }

  // ── The shipped chart: South Node's own field, across every sign ──────
  // Sweep birth dates so the South Node lands in each of the 12 signs at
  // least once (its ~18.6-year regression period covers the whole zodiac);
  // a handful of fixed dates spread ~1.5 years apart is enough to hit all
  // 12 without depending on any one instant's exact node position.
  const PROBE_DATES = [
    "1990-01-01T12:00:00Z", "1991-06-01T12:00:00Z", "1993-01-01T12:00:00Z",
    "1994-06-01T12:00:00Z", "1996-01-01T12:00:00Z", "1997-06-01T12:00:00Z",
    "1999-01-01T12:00:00Z", "2000-06-01T12:00:00Z", "2002-01-01T12:00:00Z",
    "2003-06-01T12:00:00Z", "2005-01-01T12:00:00Z", "2006-06-01T12:00:00Z",
  ];
  const seenSigns = new Set();
  let anyFabricatedDignity = false;
  for (const dateISO of PROBE_DATES) {
    const chart = computeNatal({ dateISO, lat: 40, lng: -74, houseSystem: "whole", sect: "auto" });
    const sn = chart.planets.find((p) => p.name === "SouthNode");
    seenSigns.add(sn.sign);
    if (sn.dignity.kind !== "neutral" || sn.dignity.score !== 0) anyFabricatedDignity = true;
    t(`${dateISO}: South Node dignity is neutral (sign ${sn.sign})`,
      sn.dignity.kind === "neutral" && sn.dignity.score === 0,
      `got ${JSON.stringify(sn.dignity)}`);
  }
  t("probe dates cover a real spread of South Node signs (not all the same one)",
    seenSigns.size >= 6, `signs seen: ${[...seenSigns].sort((a, b) => a - b).join(",")}`);
  t("no probe date reproduces the old Sun-substitution defect",
    !anyFabricatedDignity);

  // North Node was never affected (it flows through the generic per-planet
  // dignityFor call in PLANET_ORDER's own .map()), confirmed here anyway so
  // a future regression on either node is caught by the same suite.
  {
    const chart = computeNatal({ dateISO: "1990-03-21T12:30:00-06:00", lat: 40, lng: -74, houseSystem: "whole", sect: "auto" });
    const nn = chart.planets.find((p) => p.name === "NorthNode");
    t("North Node dignity is neutral", nn.dignity.kind === "neutral" && nn.dignity.score === 0);
  }

  // ── Void-of-course Moon ────────────────────────────────────────────────
  // A chart whose only Moon aspect is separating: previously read as
  // not-VOC (any aspect counted); must now read as VOC (no applying
  // aspect remains).
  {
    const chart = computeNatal({ dateISO: "1990-03-21T12:30:00-06:00", lat: 40, lng: -74, houseSystem: "whole", sect: "auto" });
    const moonAspects = chart.aspectGrid.filter((a) => (a.a === "Moon" || a.b === "Moon") && MAJOR.includes(a.aspect));
    const hasApplying = moonAspects.some((a) => a.phase === "applying");
    t("fixture chart: Moon's major aspects are recorded with a phase",
      moonAspects.length > 0, JSON.stringify(moonAspects));
    t("fixture chart: isVoc matches 'no applying major aspect', not 'no aspect at all'",
      chart.voidOfCourse.isVoc === !hasApplying,
      `isVoc=${chart.voidOfCourse.isVoc} hasApplying=${hasApplying} moonAspects=${JSON.stringify(moonAspects)}`);
  }

  // Broader sweep: for every probe chart, isVoc must be the exact logical
  // negation of "some major Moon aspect is applying" — the discriminating
  // property between the old and new behavior. Also assert AT LEAST ONE
  // probe has a separating-only Moon (so this suite would have caught the
  // original bug) and at least one has an applying Moon aspect (so a
  // regression to "always VOC" would also be caught.
  let sawVocFromSeparatingOnly = false;
  let sawNotVocFromApplying = false;
  for (const dateISO of PROBE_DATES) {
    const chart = computeNatal({ dateISO, lat: 40, lng: -74, houseSystem: "whole", sect: "auto" });
    const moonMajors = chart.aspectGrid.filter((a) => (a.a === "Moon" || a.b === "Moon") && MAJOR.includes(a.aspect));
    const hasApplying = moonMajors.some((a) => a.phase === "applying");
    const hasSeparatingOnly = moonMajors.length > 0 && !hasApplying;
    if (hasSeparatingOnly && chart.voidOfCourse.isVoc) sawVocFromSeparatingOnly = true;
    if (hasApplying && !chart.voidOfCourse.isVoc) sawNotVocFromApplying = true;
    t(`${dateISO}: isVoc === !hasApplyingMajorMoonAspect`,
      chart.voidOfCourse.isVoc === !hasApplying,
      `isVoc=${chart.voidOfCourse.isVoc} hasApplying=${hasApplying}`);
  }
  t("at least one probe demonstrates the fixed behavior: separating-only Moon reads VOC",
    sawVocFromSeparatingOnly, "if this fails, the discriminator never exercised the old bug's exact scenario");
  t("at least one probe demonstrates: an applying Moon aspect reads not-VOC",
    sawNotVocFromApplying);

  // daysToNextSignChange is untouched by this fix — sanity-check it still
  // reports a small positive number (the Moon crosses a sign every ~2.5
  // days, so this must always be well under 3).
  {
    const chart = computeNatal({ dateISO: "1990-03-21T12:30:00-06:00", lat: 40, lng: -74, houseSystem: "whole", sect: "auto" });
    t("daysToNextSignChange stays a small positive number",
      chart.voidOfCourse.daysToNextSignChange > 0 && chart.voidOfCourse.daysToNextSignChange < 3,
      `got ${chart.voidOfCourse.daysToNextSignChange}`);
  }

  return rows;
}
